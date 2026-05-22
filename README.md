---
title: APEX Fitness RAG Coach
emoji: 🏋️
colorFrom: indigo
colorTo: blue
sdk: streamlit
sdk_version: 1.41.1
app_file: app.py
pinned: false
license: mit
---

# APEX Fitness RAG Coach

Personal fitness coach powered by **Retrieval-Augmented Generation (RAG)** over your workout, metrics, and goal data.

## Features

- **BM25 retrieval** over chunked fitness logs (workouts, body metrics, goals, streaks)
- **Optional OpenAI LLM** for natural-language answers grounded in retrieved context
- **Demo dataset** included — works without uploading data
- **JSON upload** — import exports from the web tracker (`apex_workouts`, etc.)

## Web tracker

The static APEX Fitness dashboard (`index.html`) lives in this repo. To host it separately, create a [Static Space](https://huggingface.co/docs/hub/spaces-sdks-static) with `sdk: static` and `index.html` at the root.

## Local run

```bash
pip install -r requirements.txt
streamlit run app.py
```

## Secrets (optional LLM)

In your Space **Settings → Repository secrets**, add:

| Name | Value |
|------|--------|
| `OPENAI_API_KEY` | Your OpenAI API key |

Then enable **Use LLM** in the app sidebar.

## Suggested questions

- How many workouts did I do this week?
- What is my bench press progress?
- Am I on track for my weight goal?
