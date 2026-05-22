"""Turn fitness JSON into RAG text chunks."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from .seed import ACHIEVEMENT_DEFS, latest_metric, water_today


@dataclass
class Chunk:
    id: str
    source: str
    date: str | None
    text: str
    meta: dict


def _format_exercise(ex: dict) -> str:
    if ex.get("sets"):
        sets = "; ".join(
            f"set {i + 1}: {s.get('reps', 0)} reps @ {s.get('weight', 0)} kg"
            for i, s in enumerate(ex["sets"])
        )
        return f"{ex.get('name', 'Exercise')}: {sets}"
    parts = [ex.get("name", "Exercise")]
    if ex.get("distance") is not None:
        parts.append(f"{ex['distance']} km")
    if ex.get("duration") is not None:
        parts.append(f"{ex['duration']} min")
    if ex.get("pace") is not None:
        parts.append(f"pace {ex['pace']} min/km")
    return ", ".join(parts)


def build_chunks(data: dict[str, Any]) -> list[Chunk]:
    workouts = data.get("workouts") or []
    metrics = data.get("metrics") or []
    goals = data.get("goals") or []
    profile = data.get("profile") or {}
    achievements = data.get("achievements") or {}
    today = date.today().isoformat()

    chunks: list[Chunk] = []

    latest = latest_metric(metrics)
    chunks.append(Chunk(
        id="profile-summary",
        source="profile",
        date=today,
        text=" ".join(filter(None, [
            f"Athlete profile: {profile.get('name', 'Athlete')}, level {profile.get('level', 1)}, XP {profile.get('xp', 0)}.",
            f"Workout streak {profile.get('streak', 0)} days (longest {profile.get('longestStreak', 0)}).",
            f"Water today {water_today(profile)} glasses.",
            f"Latest weight {latest['weight']:.1f} kg on {latest['date']}." if latest and latest.get("weight") else "",
            f"Member since {(profile.get('joinedAt') or '')[:10] or 'unknown'}.",
        ])),
        meta={},
    ))

    week_start = (date.today() - timedelta(days=6)).isoformat()
    week = [w for w in workouts if w.get("date", "") >= week_start]
    by_type: dict[str, int] = {}
    for w in week:
        t = w.get("type", "other")
        by_type[t] = by_type.get(t, 0) + 1
    total_cal = sum(w.get("caloriesBurned") or 0 for w in week)
    total_min = sum(w.get("duration") or 0 for w in week)
    type_str = ", ".join(f"{t} x{n}" for t, n in by_type.items()) if by_type else ""
    chunks.append(Chunk(
        id="weekly-summary",
        source="summary",
        date=today,
        text=(
            f"Weekly summary ({week_start} to {today}): "
            f"{len(week)} workouts, {total_min} active minutes, {total_cal} calories. "
            f"{('Types: ' + type_str + '. ') if type_str else ''}"
            f"All-time total workouts: {len(workouts)}."
        ),
        meta={},
    ))

    for w in workouts:
        exercises = ". ".join(_format_exercise(ex) for ex in (w.get("exercises") or []))
        text = " ".join(filter(None, [
            f"Workout on {w.get('date')}: {w.get('name', 'Untitled')} ({w.get('type', 'general')}).",
            f"Duration {w.get('duration', 0)} minutes, calories {w.get('caloriesBurned', 0)}.",
            f"Exercises: {exercises}." if exercises else "",
            f"Notes: {w['notes']}" if w.get("notes") else "",
        ]))
        chunks.append(Chunk(
            id=f"workout-{w.get('id', w.get('date'))}",
            source="workout",
            date=w.get("date"),
            text=text,
            meta={"type": w.get("type"), "name": w.get("name")},
        ))

    for m in metrics:
        meas = m.get("measurements") or {}
        meas_text = ", ".join(f"{k} {float(v):.1f} cm" for k, v in meas.items())
        text = ", ".join(filter(None, [
            f"Body metrics on {m.get('date')}:",
            f"weight {m['weight']:.1f} kg" if m.get("weight") is not None else "",
            f"body fat {m['bodyFat']:.1f}%" if m.get("bodyFat") is not None else "",
            f"measurements: {meas_text}" if meas_text else "",
        ]))
        chunks.append(Chunk(
            id=f"metric-{m.get('id', m.get('date'))}",
            source="metric",
            date=m.get("date"),
            text=text,
            meta={},
        ))

    for g in goals:
        target = g.get("target") or 0
        current = g.get("current") or 0
        pct = round((current / target) * 100) if target else 0
        status = "completed" if g.get("completed") else "active"
        chunks.append(Chunk(
            id=f"goal-{g.get('id', g.get('title'))}",
            source="goal",
            date=g.get("deadline") or (g.get("createdAt") or "")[:10],
            text=(
                f"Goal: {g.get('title', g.get('type'))} ({status}). "
                f"Progress {current} / {target} {g.get('unit', '')} ({pct}%). "
                f"{('Deadline ' + g['deadline'] + '.') if g.get('deadline') else ''}"
            ),
            meta={"completed": g.get("completed")},
        ))

    lines = [
        f"{d['name']}: {d['desc']}"
        for d in ACHIEVEMENT_DEFS
        if d["id"] in achievements
    ]
    chunks.append(Chunk(
        id="achievements-summary",
        source="achievement",
        date=today,
        text=(
            f"Unlocked achievements: {'; '.join(lines)}."
            if lines else "No achievements unlocked yet."
        ),
        meta={"count": len(lines)},
    ))

    return chunks


def tokenize(text: str) -> list[str]:
    return [t for t in re.sub(r"[^\w\s]", " ", text.lower()).split() if len(t) > 1]
