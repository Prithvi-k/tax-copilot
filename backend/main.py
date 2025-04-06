from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict
from model import run_full_pipeline

app = FastAPI()

# CORS: allow requests from your Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # adjust if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------
# Request & Response Models
# ----------------------
class QueryRequest(BaseModel):
    prompt: str
    user_name: str


class Source(BaseModel):
    chapter_name: str
    name: str
    tag: str
    excerpt: str
    sourcelink: str = None


class QueryResponse(BaseModel):
    content: str
    sources: List[Source]


# ----------------------
# API Endpoint
# ----------------------
@app.post("/api/query", response_model=QueryResponse)
async def query_llm(query_req: QueryRequest):
    try:
        answer, raw_sources = run_full_pipeline(query_req.prompt)

        formatted_sources = []
        for src in raw_sources:
            is_web_source = src["chapter_name"].startswith("Web Source")

            formatted_sources.append(
                {
                    "chapter_name": src.get("chapter_name", "Indian Tax Code"),
                    "name": src.get(
                        "name",
                        src.get("chapter_name", "Unknown Title") + " | Indian Tax Code",
                    ),
                    "excerpt": src.get("excerpt", "Excerpt unavailable."),
                    "tag": "web" if is_web_source else "official",
                    "sourcelink": src["sourcelink"]
                    if is_web_source
                    else f"https://github.com/Prithvi-k/tax-copilot/blob/main/data/{src.get('chapter_name', 'TAX_CODE_2025')}.pdf",
                }
            )

        return {"content": answer, "sources": formatted_sources}

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})
