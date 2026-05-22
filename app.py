"""
APEX Fitness — RAG Coach (Streamlit)
Run: streamlit run app.py
"""

from __future__ import annotations

import json
from typing import Any

import streamlit as st

from rag.engine import FitnessRAG
from rag.seed import build_demo_dataset

st.set_page_config(
    page_title="APEX Fitness RAG Coach",
    page_icon="🏋️",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(
    """
    <style>
    .stApp { background-color: #09090b; }
    [data-testid="stSidebar"] { background-color: #111113; }
    h1, h2, h3, p, label, .stMarkdown { color: #ececef !important; }
    .source-pill {
        display: inline-block;
        background: #1c1c21;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 999px;
        padding: 2px 10px;
        margin: 2px 4px 2px 0;
        font-size: 0.75rem;
        color: #8a8a95;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

SUGGESTIONS = [
    "How many workouts did I do this week?",
    "What is my bench press progress?",
    "Am I on track for my weight goal?",
    "Summarize my cardio sessions",
    "What is my workout streak?",
]


def parse_upload(raw: bytes) -> dict[str, Any]:
    data = json.loads(raw.decode("utf-8"))
    if isinstance(data, dict) and "workouts" in data:
        return data
    # Browser localStorage export: { apex_workouts: "[...]", ... }
    mapping = {
        "apex_workouts": "workouts",
        "apex_metrics": "metrics",
        "apex_goals": "goals",
        "apex_profile": "profile",
        "apex_achievements": "achievements",
    }
    out: dict[str, Any] = {}
    for src, dst in mapping.items():
        if src not in data:
            continue
        val = data[src]
        out[dst] = json.loads(val) if isinstance(val, str) else val
    if out:
        return out
    raise ValueError(
        "Unrecognized JSON. Use {workouts, metrics, goals, profile, achievements} "
        "or localStorage keys (apex_workouts, etc.)."
    )


def init_session():
    if "messages" not in st.session_state:
        st.session_state.messages = []
    if "dataset" not in st.session_state:
        st.session_state.dataset = build_demo_dataset()
    if "rag" not in st.session_state:
        st.session_state.rag = FitnessRAG(st.session_state.dataset)


def rebuild_rag(data: dict[str, Any]):
    st.session_state.dataset = data
    st.session_state.rag = FitnessRAG(data)


init_session()

# ── Sidebar ──────────────────────────────────────────────────────────────────

with st.sidebar:
    st.title("⚙️ RAG Settings")

    data_source = st.radio(
        "Data source",
        ["Demo dataset", "Upload JSON"],
        index=0,
    )

    if data_source == "Upload JSON":
        uploaded = st.file_uploader(
            "Fitness JSON export",
            type=["json"],
            help="Export from the web app or use {workouts, metrics, goals, profile, achievements}.",
        )
        if uploaded:
            try:
                rebuild_rag(parse_upload(uploaded.getvalue()))
                st.success("Data loaded & index rebuilt")
            except Exception as e:
                st.error(str(e))
    else:
        if st.button("Reload demo data"):
            rebuild_rag(build_demo_dataset())
            st.session_state.messages = []
            st.success("Demo data loaded")

    st.divider()

    use_llm = st.toggle("Use LLM (OpenAI)", value=False)
    def _default_api_key() -> str:
        try:
            return st.secrets["OPENAI_API_KEY"]
        except Exception:
            return ""

    api_key = st.text_input(
        "OpenAI API key",
        type="password",
        value=_default_api_key(),
        disabled=not use_llm,
    )
    model = st.text_input("Model", value="gpt-4o-mini", disabled=not use_llm)
    top_k = st.slider("Top-K chunks", 1, 12, 6)

    if st.button("Rebuild index"):
        rebuild_rag(st.session_state.dataset)
        st.success("Index rebuilt")

    if st.button("Clear chat"):
        st.session_state.messages = []
        st.rerun()

    rag: FitnessRAG = st.session_state.rag
    st.metric("Indexed chunks", rag.chunk_count)
    st.metric("Workouts", len(st.session_state.dataset.get("workouts", [])))

# ── Main ─────────────────────────────────────────────────────────────────────

st.title("🏋️ APEX Fitness RAG Coach")
st.caption("Retrieval-Augmented Generation over your workouts, metrics, and goals")

col1, col2 = st.columns([2, 1])
with col2:
    st.info("**Pipeline:** chunk → BM25 retrieve → augment prompt → answer")

with col1:
    for s in SUGGESTIONS:
        if st.button(s, key=f"suggest-{s}"):
            st.session_state.pending_query = s

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])
        if msg.get("hits"):
            pills = " ".join(
                f'<span class="source-pill">{h["source"]}{" · " + h["date"] if h.get("date") else ""} ({h["score"]:.2f})</span>'
                for h in msg["hits"]
            )
            st.markdown(pills, unsafe_allow_html=True)
            if msg.get("mode"):
                st.caption(f"Mode: {msg['mode']}")

query = st.chat_input("Ask about your training…")
if "pending_query" in st.session_state:
    query = st.session_state.pop("pending_query")

if query:
    st.session_state.messages.append({"role": "user", "content": query})

    rag = st.session_state.rag
    rag.top_k = top_k

    with st.spinner("Retrieving relevant fitness data…"):
        result = rag.ask(
            query,
            use_llm=use_llm,
            api_key=api_key.strip() or None,
            model=model,
        )

    if result.error:
        st.warning(f"LLM failed, used retrieval-only: {result.error}")

    hit_meta = [
        {
            "source": h.chunk.source,
            "date": h.chunk.date,
            "score": h.score,
            "preview": h.chunk.text[:140] + ("…" if len(h.chunk.text) > 140 else ""),
        }
        for h in result.hits
    ]

    st.session_state.messages.append({
        "role": "assistant",
        "content": result.answer,
        "hits": hit_meta,
        "mode": result.mode,
    })
    st.rerun()

if not st.session_state.messages:
    st.markdown("### Try asking")
    for s in SUGGESTIONS:
        st.markdown(f"- {s}")

    with st.expander("View sample retrieved chunks"):
        rag = st.session_state.rag
        preview = rag.retrieve("workout streak bench press weight", top_k=4)
        for h in preview:
            st.text(f"[{h.chunk.source}] score={h.score:.2f}")
            st.write(h.chunk.text)
