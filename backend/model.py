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
import tldextract
from urllib.parse import urlparse

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
    prompt += "Use the following excerpts from legal chapters and Google search results to answer the question. Cite all relevant sources including chapters, sections, and websites.\n\n"

    # Sort faiss_results by score and take only the top 3
    sorted_faiss = sorted(faiss_results, key=lambda x: x["score"])
    top_faiss = sorted_faiss[:3]

    for r in top_faiss:
        prompt += f"From {r['chapter']}:\n{r['text']}\n\n"

    # Take only the top 3 web results (using the dictionary keys)
    top_web = web_results[:3]

    for i, result in enumerate(top_web, 1):
        title = result["title"]
        snippet = result["snippet"]
        url = result["url"]
        prompt += f"Web Source {i} ({title} - {url}):\n{snippet}\n\n"

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

        # Get title
        title_tag = soup.find("title")
        title = title_tag.get_text().strip() if title_tag else "No Title"

        # Get snippet
        paragraphs = soup.find_all("p")
        text = " ".join([p.get_text() for p in paragraphs])
        snippet = text[:max_length]

        return {"title": title, "snippet": snippet}
    except Exception as e:
        print(f"❌ Error extracting {url}: {e}")
        return None


def get_google_search_results(query, num_results=3):
    results = []
    for url in search(query, num_results=num_results):
        data = extract_snippet_from_url(url)
        if data:
            results.append(
                {"url": url, "title": data["title"], "snippet": data["snippet"]}
            )
    return results


def get_website_name(url: str) -> str:
    extracted = tldextract.extract(url)
    return extracted.domain.capitalize()


# === MAIN ===
def run_full_pipeline(QUERY: str):
    API_KEY = os.getenv("API_KEY")
    MODEL = "sentence-transformers/all-MiniLM-l6-v2"
    CHAPTER_CSV = "src.csv"
    CHAPTER_FOLDER = "chapter_files"

    # Step 1: Top Chapters
    chapters = get_top_chapters(CHAPTER_CSV, QUERY, API_KEY, MODEL)

    # Step 2: FAISS search
    all_results = []
    for chapter in chapters:
        index, metadata = build_faiss_for_chapter(
            chapter, CHAPTER_FOLDER, API_KEY, MODEL
        )
        all_results.extend(query_faiss(index, metadata, QUERY, API_KEY, MODEL))

    # Step 3: Google results
    google_results = get_google_search_results(QUERY)

    # Step 4: Prompt and LLM response
    final_prompt = build_prompt_from_results(QUERY, all_results, google_results)
    answer = ask_taxcopilot(final_prompt)

    # Step 5: Format sources
    sorted_faiss = sorted(all_results, key=lambda x: x["score"])[:3]
    sources = []

    for item in sorted_faiss:
        sources.append(
            {
                "chapter_name": item["chapter"],
                # "name": "Tax Code",
                "excerpt": item["text"],
            }
        )

    for i, result in enumerate(google_results[:3], 1):
        website_name = get_website_name(result["url"])
        sources.append(
            {
                "chapter_name": f"Web Source {i}",
                "name": website_name,
                "sourcelink": result["url"],
                "excerpt": result["snippet"],
            }
        )

    print("Answer:", answer)
    print("Sources:", sources)

    # hardcode
    # answer = "According to CHAPTER_X, section 190, a non-resident person is entitled to a deduction from the Indian income-tax payable by them of a sum calculated on doubly taxed income, at the Indian rate of tax or the rate of tax of the said country, whichever is lower.\n As per the section, if a non-resident person is assessed on their share in the income of a registered firm assessed as resident in India and such share includes any income accruing or arising outside India, they can claim a deduction from the Indian income-tax payable by them if they have paid income-tax in the other country.\n However, this relief is subject to certain conditions, including that the income must be doubly taxed, and the non-resident person must have paid income-tax in the other country.\n Web Source 1 (https://taxsummaries.pwc.com/india/individual/foreign-tax-relief-and-tax-treaties) also confirms that residents are allowed a credit against their Indian tax liability for income tax paid abroad on income arising abroad, which is doubly taxed, according to the terms of the provisions of the relevant tax treaty.\nWeb Source 2 (https://cleartax.in/s/how-nris-can-claim-benefits-under-dtaa) explains that the Double Taxation Avoidance Agreement (DTAA) allows NRIs to claim benefits under the agreement, but it does not specifically address the scenario where there is no DTAA with the country in question.\nWeb Source 3 (https://www.indiafilings.com/learn/how-to-claim-double-taxation-relief-in-absence-of-dtaa/) provides guidance on how to claim double taxation relief in the absence of a DTAA, which may be relevant in this scenario.\n In conclusion, based on the excerpts from CHAPTER_X and the web sources, a non-resident partner in an Indian firm may be able to claim tax relief on income earned abroad even if there is no double taxation agreement with that country, subject to meeting the conditions outlined in section 190 of CHAPTER_X.\nSources:\n- CHAPTER_X, section 190\n- Web Source 1: https://taxsummaries.pwc.com/india/individual/foreign-tax-relief-and-tax-treaties\n- Web Source 2: https://cleartax.in/s/how-nris-can-claim-benefits-under-dtaa\n- Web Source 3: https://www.indiafilings.com/learn/how-to-claim-double-taxation-relief-in-absence-of-dtaa/"

    # sources = [
    #     {
    #         "chapter_name": "CHAPTER_X",
    #         "excerpt": "190\n(a) at the Indian rate of tax or the rate of tax of the said country, whichever\nis the lower; or\n(b) at the Indian rate of tax, if both the rates are equal.\n(2) If any non-resident person is assessed on his share in the income of a\nregistered firm assessed as resident in India in any tax year and such share includes\nany income accruing or arising outside India during that tax year (and which is not\ndeemed to accrue or arise in India) in a country with which there is no agreement\nunder section 159 for the relief or avoidance of double taxation and he proves that\nhe has paid income-tax by deduction or otherwise under the law in force in that\ncountry in respect of the income so included he shall be entitled to a deduction from\nthe Indian income-tax payable by him of a sum calculated on such doubly taxed\nincome so included,––\n5\n10\n(a) at the Indian rate of tax or the rate of tax of the said country, whichever\nis the lower; or\n(b) at the Indian rate of tax, if both the rates are equal.\n15\n(3) In this section,—\n(a) “income-tax” in relation to any country includes any excess profits tax\nor business profits tax charged on the profits by the Government of any part of\nthat country or a local authority in that country;\n(b) “Indian income-tax” means income-tax charged as per this Act;\n20\n(c) “Indian rate of tax” means the rate determined by dividing Indian\nincome-tax after deduction of any relief due under the provisions of this Act but\nbefore deduction of any relief due under this section, by the total income; and\n(d) “rate of tax of the said country” means income-tax and super-tax\nactually paid in the said country as per the corresponding laws in force in the\nsaid country after deduction of all relief due, but before deduction of any relief\ndue in the said country in respect of double taxation, divided by the whole\namount of the income as assessed in the said country.\n25\nCHAPTER X\nSPECIAL PROVISIONS RELATING TO AVOIDANCE OF TAX\nComputation of\nincome from\ninternational\ntransaction and\nspecified\ndomestic\ntransaction\nhaving regard to\narm’s length\nprice.\n30\n161. (1) Any income arising from an international transaction or a specified\ndomestic transaction shall be determined having regard to the arm’s length price.\n(2) Any allowance for any expense or interest arising from an international\ntransaction or a specified domestic transaction shall also be determined having regard to\nthe arm’s length price.\n35\n(3) If in an international transaction or specified domestic transaction, two or more\nassociated enterprises enter into a mutual agreement or arrangement for––\n(a) allocation or apportionment of any cost or expense incurred or to be\nincurred in connection with a benefit, service or facility provided or to be provided\nto any one or more of such enterprises; or\n(b) any contribution to any cost or expense incurred or to be incurred in\nconnection with a benefit, service or facility provided or to be provided to any one\nor more of such enterprises,\n40\n191\nthe cost or expense allocated or apportioned to, or, contributed by, any such\nenterprise shall be determined having regard to the arm’s length price of such\nbenefit, service or facility.\n5\n10\n(4) The provisions of this section shall not apply if the determination under\nsub-section (1) or (2) or (3) has the effect of reducing the income chargeable to tax\nor increasing the loss, computed on the basis of entries made in the books of account\nin respect of the tax year in which the international transaction or specified domestic\ntransaction was entered.\n162. (1) In this Chapter, “associated enterprise”, in relation to another\nenterprise, means an enterprise—\n(a) which participates, directly or indirectly, or through one or more\nintermediaries, in the management or control or capital of the other\nenterprise; or\n15\n20\n(b) in respect of which one or more persons who participate, directly or\nindirectly, or through one or more intermediaries, in its management or control\nor capital, are the same persons who participate, directly or indirectly, or\nthrough one or more intermediaries, in the management or control or capital\nof the other enterprise.\n(2) Without affecting the generality of the provisions of sub-section (1), two\nenterprises shall be deemed to be associated enterprises if, at any time during the\ntax year,—\n(a) one enterprise holds, directly or indirectly, shares carrying\nat least 26% of the voting power in the other enterprise; or\n25\n(b) any person or enterprise holds, directly or indirectly, shares carrying\nat least 26% of the voting power in each of such enterprises; or\n(c) a loan advanced by one enterprise to the other enterprise constitutes\nat least 51% of the book value of the total assets of the other enterprise; or\n(d) one enterprise guarantees at least 10% of the total borrowings of the\nother enterprise; or\n30\n35\n40",
    #     },
    #     {
    #         "chapter_name": "CHAPTER_IX",
    #         "excerpt": "(d) arrears of “family pension” as defined in section 93(1)(d),\nthe Assessing Officer shall on an application made to him by the assessee in this\nbehalf, grant such relief, as prescribed.\n25\n(2) No relief shall be granted on any income on which deduction has been\nclaimed by the assessee in section 19(1)(Table: Sl. No. 12) for any amount\nmentioned therein, for such, or any other, tax year.\n158. (1) The income accrued in a specified account, maintained in a notified\ncountry by a specified person, shall be taxed in a tax year, as prescribed.\n(2) In this section,—\n30\n(a) “notified country” means a country as notified by the Central Government;\nRelief from\ntaxation in\nincome from\nretirement\nbenefit account\nmaintained in a\nnotified country.\n(b) “specified account” means an account maintained in a notified country\nby the specified person for his retirement benefits, which is taxed by that notified\ncountry at the time of withdrawal or redemption and, not on accrual basis;\n35\n(c) “specified person” means a person resident in India having opened a\nspecified account in a notified country while being non-resident in India and\nresident in that country.\nB.—Double taxation relief\n159. (1) The Central Government may enter into an agreement with the\nGovernment of—\n40\n(a) any other country;or\n(b) any specified territory,\nfor the purposes mentioned in sub-section (3), and may, by notification, make such\nprovisions as necessary for implementing the agreement.\nAgreement with\nforeign countries\nor specified\nterritories and\nadoption by\nCentral\nGovernment of\nagreement\nbetween\nspecified\nassociations for\ndouble taxation\nrelief.\n188\n(2) Any specified association in India may enter into an agreement with any\nspecified association in the specified territory for the purposes mentioned in\nsub-section (3) and the Central Government may, by notification, make such\nprovisions as may be necessary for adopting and implementing such agreement.\n(3) The agreement mentioned in sub-section (1) or (2) may be entered for—\n5\n(a) the granting of relief in respect of—\n(i) income on which income-tax has been paid both under this Act\nand income-tax in that country or specified territory, as the case may\nbe; or\n(ii) income-tax chargeable under this Act and under the\ncorresponding law in force in that country or specified territory, as the\ncase may be, to promote mutual economic relations, trade and\ninvestment; or\n(b) the avoidance of double taxation of income under this Act and under\nthe corresponding law in force in that country or specified territory, as the case\nmay be, without creating opportunities for non-taxation or reduced taxation\nthrough tax evasion or avoidance (including through treaty-shopping\narrangements aimed at obtaining reliefs provided in the said agreement for the\nindirect benefit to residents of any other country or territory);\n(c) exchange of information for––\n10\n15\n20\n(i) the prevention of evasion or avoidance of income-tax\nchargeable under this Act or under the corresponding law in force in that\ncountry or specified territory, as the case may be; or\n(ii) investigation of cases of such evasion or avoidance; or\n(d) recovery of income-tax under this Act and under the corresponding\nlaw in force in that country or specified territory, as the case may be.\n25\n(4) Where,––\n(a) the Central Government has entered into an agreement with the\nGovernment of any country or specified territory, as the case may be, under\nsub-section (1); or\n30\n(b) a specified association in India has entered into an agreement with a\nspecified association of any specified territory under sub-section (2) and such\nagreement has been notified under that sub-section,\nfor granting relief of tax, or avoidance of double taxation, then, in relation to the\nassessee to whom such agreement applies, the provisions of this Act shall apply to\nthe extent they are more beneficial to that assessee.\n35\n(5) The charge of tax,––\n(a) in respect of a foreign company at a rate higher than the rate at which\na domestic company is chargeable; or\n(b) in respect of a company incorporated in the specified territory at a\nrate higher than the rate at which a domestic company is chargeable,\n40\nshall not be regarded as less favourable charge or levy of tax in respect of such\nforeign company or such company incorporated in the specified territory, as the case\nmay be.",
    #     },
    #     {
    #         "chapter_name": "CHAPTER_X",
    #         "excerpt": "which, or obligation of any other person to whom, those assets, that income or\nthose accumulations are or have been transferred;\n(b) any body corporate incorporated outside India shall be treated as if it\nwere a non-resident;\n45\n50\n203\n(c) a person shall be deemed to have power to enjoy the income of a nonresident if—\n5\n(i) the income is in fact so dealt with by any person as to be\ncalculated at some point of time and, whether in the form of income or\nnot, to ensure for the benefit of the first mentioned person in\nsub-section (2) or (3); or\n(ii) the receipt or accrual of the income operates to increase the\nvalue to such first mentioned person of any assets held by him or for his\nbenefit; or\n10\n(iii) such first mentioned person receives or is entitled to receive at\nany time any benefit provided or to be provided out of that income or\nout of moneys which are or shall be available for the purpose by reason\nof the effect or successive effects of the associated operations on that\nincome and assets which represent that income; or\n15\n(iv) such first mentioned person has power by means of the\nexercise of any power of appointment or power of revocation or\notherwise to obtain for himself, whether with or without the consent of\nany other person, the beneficial enjoyment of the income; or\n20\n(v) such first mentioned person is able, in any manner whatsoever and\nwhether directly or indirectly, to control the application of the income;\n25\n(d) in determining whether a person has power to enjoy income, regard\nshall be had to the substantial result and effect of the transfer and any\nassociated operations, and all benefits which may at any time accrue to such\nperson as a result of the transfer and any associated operations shall be taken\ninto account irrespective of the nature or form of the benefits.\n(7) In this section,—\n(a) “assets” includes property or rights of any kind and “transfer” in\nrelation to rights includes the creation of those rights;\n30\n(b) “associated operation” in relation to any transfer, means an operation\nof any kind effected by any person in relation to—\n(i) any of the assets transferred; or\n(ii) any assets representing, whether directly or indirectly, any of\nthe assets transferred; or\n(iii) the income arising from any such assets; or\n35\n(iv) any assets representing, whether directly or indirectly, the\naccumulations of income arising from any such assets;\n(c) “benefit” includes a payment of any kind;\n(d) “capital sum” means—\n40\n(i) any sum paid or payable by way of a loan or repayment of a\nloan; and\n(ii) any other sum paid or payable otherwise than as income, being\na sum, which is not paid or payable for full consideration in money or\nmoney’s worth.\n45\n175 (1) Where the owner of any securities (hereinafter referred to as “the\nowner”) sells or transfers such securities and buys back or reacquires them or buys\nor acquires any similar securities, any interest that becomes payable in respect of\nsuch securities,––\n(a) is receivable by a person other than the owner, shall be deemed, for\nall purposes of this Act, to be the income of the owner; and\nAvoidance of\ntax by certain\ntransactions in\nsecurities.\n204\n(b) shall not be the income of the other person,\nirrespective of whether it would have been chargeable to income-tax under any other\nprovision of this Act.\n(2) Where similar securities as referred to in sub-section (1) are bought or\nacquired, the owner shall not be under greater liability to income-tax than he would\nif the original securities had been bought back or reacquired.\n5\n(3) If any person has had a beneficial interest in any securities at any time\nduring a tax year, and the result of any transaction relating to such securities or the\nincome from it is that, in respect of such securities within such year,––\n(a) either no income is received by him; or\n10\n(b) the income received by him is less than what would have been if the\nincome from such securities had accrued from day to day and been\napportioned accordingly,\nthe income from such securities for such year shall be deemed to be the income of\nsuch person.\n15\n(4) The provisions of sub-sections (1), (2) and (3) shall not apply if the owner,\nor the person who has had a beneficial interest in the securities, proves to the\nsatisfaction of the Assessing Officer that—\n(a) there has been no avoidance of income-tax; or\n(b) the avoidance of income-tax was exceptional and not systematic and\nalso that in any of the three preceding years any avoidance of income-tax by a\ntransaction of the nature referred to in sub-sections (1), (2) or (3) was not there\nin his case.\n(5) If a person carrying on a business which consists wholly or partly in\ndealing in securities, buys or acquires any securities and sells back or retransfers the\nsecurities, then, if the result of the transaction is that interest in respect of the\nsecurities receivable by him is not deemed to be his income by reason of the\nprovisions contained in sub-section (1), no account shall be taken of the transaction",
    #     },
    #     {
    #         "chapter_name": "Web Source 1",
    #         "name": "Pwc",
    #         "sourcelink": "https://taxsummaries.pwc.com/india/individual/foreign-tax-relief-and-tax-treaties",
    #         "excerpt": "WWTS Operations Director, PwC US Please contact for general WWTS inquiries (by clicking name above).   By submitting your email address, you acknowledge that you have read the Privacy Statement and that you consent to our processing data in accordance with the Privacy Statement. Residents are allowed a credit against their Indian tax liability for income tax paid abroad on income arising abroad, which is doubly taxed, according to the terms of the provisions of the relevant tax treaty. India has",
    #     },
    #     {
    #         "chapter_name": "Web Source 2",
    #         "name": "Cleartax",
    #         "sourcelink": "https://cleartax.in/s/how-nris-can-claim-benefits-under-dtaa",
    #         "excerpt": "G1-G9 filing ASP/GSP solution Elevate processes with AI automation and vendor delight Streamline vendor management and collaboration in one unified portal Optimise ITC for profitability Bulk invoicing within any ERP e-TDS return filing solution Maximise EBITDA with early vendor payments Instant working capital financing Automated secretarial compliance Connected finance ecosystem for process automation, greater control, higher savings and productivity GST and direct tax compliance Complete suppl",
    #     },
    #     {
    #         "chapter_name": "Web Source 3",
    #         "name": "Indiafilings",
    #         "sourcelink": "https://www.indiafilings.com/learn/how-to-claim-double-taxation-relief-in-absence-of-dtaa/",
    #         "excerpt": "",
    #     },
    # ]

    return answer.strip(), sources