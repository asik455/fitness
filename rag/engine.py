"""BM25 retrieval + optional OpenAI generation."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from rank_bm25 import BM25Okapi

from .chunker import Chunk, build_chunks, tokenize


@dataclass
class RetrievedChunk:
    chunk: Chunk
    score: float


@dataclass
class RAGResponse:
    answer: str
    hits: list[RetrievedChunk]
    mode: str
    error: str | None = None


class FitnessRAG:
    def __init__(self, data: dict[str, Any], top_k: int = 6):
        self.data = data
        self.top_k = top_k
        self.chunks = build_chunks(data)
        self._corpus_tokens = [tokenize(c.text) for c in self.chunks]
        self._bm25 = BM25Okapi(self._corpus_tokens) if self.chunks else None

    @property
    def chunk_count(self) -> int:
        return len(self.chunks)

    def _phrase_boost(self, query: str, text: str) -> float:
        q = query.lower().strip()
        t = text.lower()
        if len(q) >= 4 and q in t:
            return 3.0
        words = tokenize(q)
        if not words:
            return 0.0
        hits = sum(1 for w in words if w in t)
        return hits / len(words)

    def retrieve(self, query: str, top_k: int | None = None) -> list[RetrievedChunk]:
        k = top_k or self.top_k
        if not self._bm25 or not query.strip():
            return []

        tokens = tokenize(query)
        if not tokens:
            return []

        scores = list(self._bm25.get_scores(tokens))
        ranked: list[RetrievedChunk] = []
        for i, base in enumerate(scores):
            boost = self._phrase_boost(query, self.chunks[i].text)
            ranked.append(RetrievedChunk(chunk=self.chunks[i], score=float(base) + boost))

        ranked.sort(key=lambda x: x.score, reverse=True)
        top = [r for r in ranked if r.score > 0][:k]

        if top:
            return top

        fallback = [c for c in self.chunks if c.source in ("profile", "summary")]
        return [RetrievedChunk(chunk=c, score=0.1) for c in fallback[:k]]

    def build_context(self, hits: list[RetrievedChunk]) -> str:
        parts = []
        for i, h in enumerate(hits):
            c = h.chunk
            date_part = f", {c.date}" if c.date else ""
            parts.append(f"[{i + 1}] ({c.source}{date_part})\n{c.text}")
        return "\n\n".join(parts)

    def answer_extractive(self, query: str, hits: list[RetrievedChunk]) -> str:
        if not hits:
            return (
                "I don't have enough fitness data indexed yet. "
                "Load demo data or upload a JSON export, then ask again."
            )
        bullets = "\n\n".join(f"• {h.chunk.text}" for h in hits)
        return (
            f"Here's what I found in your APEX Fitness data for \"{query}\":\n\n"
            f"{bullets}\n\n"
            "_Enable LLM in the sidebar for natural-language coaching._"
        )

    def answer_llm(
        self,
        query: str,
        hits: list[RetrievedChunk],
        *,
        api_key: str,
        model: str = "gpt-4o-mini",
    ) -> str:
        from openai import OpenAI

        context = self.build_context(hits)
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model=model,
            temperature=0.3,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are APEX Fitness Coach, a personal trainer assistant. "
                        "Answer ONLY using the retrieved context below. "
                        "If the context does not contain the answer, say you do not have that data. "
                        "Be concise, encouraging, and cite dates or numbers from context. "
                        "Never invent workouts, weights, or metrics not in the context."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Retrieved context:\n{context}\n\nUser question: {query}",
                },
            ],
        )
        return (response.choices[0].message.content or "").strip()

    def ask(
        self,
        query: str,
        *,
        use_llm: bool = False,
        api_key: str | None = None,
        model: str = "gpt-4o-mini",
    ) -> RAGResponse:
        hits = self.retrieve(query)
        if use_llm and api_key:
            try:
                answer = self.answer_llm(query, hits, api_key=api_key, model=model)
                return RAGResponse(answer=answer, hits=hits, mode="llm")
            except Exception as e:
                return RAGResponse(
                    answer=self.answer_extractive(query, hits),
                    hits=hits,
                    mode="extractive-fallback",
                    error=str(e),
                )
        return RAGResponse(
            answer=self.answer_extractive(query, hits),
            hits=hits,
            mode="extractive",
        )
