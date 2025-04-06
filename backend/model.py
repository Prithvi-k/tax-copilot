import os
import numpy as np
import requests
import faiss
import json
import pandas as pd
from groq import Groq
from googlesearch import search
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# === CONFIG ===
load_dotenv()


# === EMBEDDING ===
def get_embedding(text, api_key, model):
    API_URL = (
        f"https://api-inference.huggingface.co/pipeline/feature-extraction/{model}"
    )
    headers = {"Authorization": f"Bearer {api_key}"}
    response = requests.post(API_URL, headers=headers, json={"inputs": text})
    response.raise_for_status()
    output = response.json()
    if isinstance(output[0], list):
        return np.array(output, dtype=np.float32)
    else:
        return np.array([output], dtype=np.float32)


def cosine_similarity_manual(a, b):
    a = np.array(a).flatten()
    b = np.array(b).flatten()
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-10)


# === STEP 1: Get Top 3 Relevant Chapters ===
def get_top_chapters(csv_path, query, api_key, model, k=4):
    df = pd.read_csv(csv_path)
    df["full_text"] = df["Title"] + " " + df["Description"]
    df["embedding"] = df["full_text"].apply(lambda x: get_embedding(x, api_key, model))
    query_embedding = get_embedding(query, api_key, model)
    df["similarity"] = df["embedding"].apply(
        lambda emb: cosine_similarity_manual(query_embedding, emb)
    )
    top_df = df.sort_values(by="similarity", ascending=False).head(k)
    return top_df["Chapter"].tolist()


# === STEP 2: Build FAISS Index for a Chapter ===
def build_faiss_for_chapter(chapter_name, folder, api_key, model, chunk_size=100):
    file_path = os.path.join(folder, f"{chapter_name}.txt")
    with open(file_path, "r", encoding="utf-8") as f:
        lines = [line.strip() for line in f if line.strip()]

    chunks = [
        "\n".join(lines[i : i + chunk_size]) for i in range(0, len(lines), chunk_size)
    ]

    embeddings = []
    metadata = []

    for i, chunk in enumerate(chunks):
        print(i)
        emb = get_embedding(chunk, api_key, model)
        embeddings.append(emb)
        metadata.append({"chunk_id": i, "text": chunk, "chapter": chapter_name})

    embeddings = np.vstack(embeddings)
    index = faiss.IndexFlatL2(embeddings.shape[1])
    index.add(embeddings)

    return index, metadata


# === STEP 3: Query FAISS ===
def query_faiss(index, metadata, query, api_key, model, top_k=3):
    query_embedding = get_embedding(query, api_key, model)
    distances, indices = index.search(query_embedding, top_k)

    results = []
    for idx, dist in zip(indices[0], distances[0]):
        results.append(
            {
                "score": float(dist),
                "chapter": metadata[idx]["chapter"],
                "text": metadata[idx]["text"],
            }
        )
    return results


def build_prompt_from_results(query, faiss_results, web_results):
    prompt = "You are a helpful assistant specialized in Indian taxation law.\n"
    prompt += "Use the following excerpts from legal chapters and Google search results to answer the question. Cite all relevant sources including chapters , sections and websites\n\n"

    # Sort faiss_results by score and take only the top 3
    sorted_faiss = sorted(faiss_results, key=lambda x: x["score"])
    top_faiss = sorted_faiss[:3]

    for r in top_faiss:
        prompt += f"From {r['chapter']}:\n{r['text']}\n\n"

    # Take only the top 3 web results
    top_web = web_results[:3]

    for i, (url, snippet) in enumerate(top_web, 1):
        prompt += f"Web Source {i} ({url}):\n{snippet}\n\n"

    prompt += f"Question: {query}\nAnswer:"

    return prompt


def ask_taxcopilot(
    prompt: str,
):
    """
    Sends a prompt to the Groq LLaMA-3.3-70b model and returns the response.

    Args:
        prompt (str): The user query or constructed final prompt.
        api_key (str): Your Groq API key.

    Returns:
        str: The model's generated answer.
    """
    GROK_KEY = os.getenv("GROK_API_KEY")
    client = Groq(api_key=GROK_KEY)

    chat_completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You are a helpful TaxCopilot AI assistant."},
            {"role": "user", "content": prompt},
        ],
    )

    return chat_completion.choices[0].message.content


# === Google Search Integration ===
def extract_snippet_from_url(url, max_length=500):
    try:
        response = requests.get(url, timeout=10)
        soup = BeautifulSoup(response.text, "html.parser")
        paragraphs = soup.find_all("p")
        text = " ".join([p.get_text() for p in paragraphs])
        return text[:max_length]
    except Exception as e:
        print(f"❌ Error extracting {url}: {e}")
        return ""


def get_google_search_results(query, num_results=3):
    results = []
    for url in search(query, num_results=num_results):
        snippet = extract_snippet_from_url(url)
        if snippet:
            results.append((url, snippet))
    return results


# === MAIN ===
def run_full_pipeline(QUERY: str):
    API_KEY = os.getenv("API_KEY")
    MODEL = "sentence-transformers/all-MiniLM-l6-v2"
    CHAPTER_CSV = "src.csv"
    CHAPTER_FOLDER = "chapter_files"
    chapters = get_top_chapters(CHAPTER_CSV, QUERY, API_KEY, MODEL)
    all_results = []
    for chapter in chapters:
        index, metadata = build_faiss_for_chapter(
            chapter, CHAPTER_FOLDER, API_KEY, MODEL
        )
        all_results.extend(query_faiss(index, metadata, QUERY, API_KEY, MODEL))

    google_results = get_google_search_results(QUERY)
    final_prompt = build_prompt_from_results(QUERY, all_results, google_results)
    answer = ask_taxcopilot(final_prompt)

    sorted_faiss = sorted(all_results, key=lambda x: x["score"])[:3]
    sources = []
    for item in sorted_faiss:
        sources.append(
            {
                "chapter_name": item["chapter"],
                "name": "Tax Code",
                "excerpt": item["text"],
            }
        )

    for i, (url, snippet) in enumerate(google_results[:3], 1):
        sources.append(
            {"chapter_name": f"Web Source {i}", "name": url, "excerpt": snippet}
        )

    print("Answer:", answer)
    print("Sources:", sources)

    return answer.strip(), sources

