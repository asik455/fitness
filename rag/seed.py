"""Demo fitness data matching the APEX web app seed."""

from __future__ import annotations

import random
from datetime import date, datetime, timedelta, timezone
from typing import Any


def _uid() -> str:
    import time
    return hex(int(time.time() * 1000))[2:] + hex(random.randint(0, 2**24))[2:]


def _days_ago(n: int) -> str:
    return (date.today() - timedelta(days=n)).isoformat()


ACHIEVEMENT_DEFS = [
    {"id": "first_workout", "name": "First Step", "desc": "Complete your first workout"},
    {"id": "streak_3", "name": "On Fire", "desc": "3-day workout streak"},
    {"id": "streak_7", "name": "Unstoppable", "desc": "7-day workout streak"},
    {"id": "ten_workouts", "name": "Getting Serious", "desc": "Complete 10 workouts"},
]


def build_demo_dataset() -> dict[str, Any]:
    workouts = [
        {
            "id": _uid(), "date": _days_ago(0), "type": "strength", "name": "Push Day",
            "duration": 55, "caloriesBurned": 420, "notes": "",
            "exercises": [
                {"name": "Bench Press", "sets": [{"reps": 8, "weight": 80}, {"reps": 8, "weight": 85}, {"reps": 6, "weight": 90}]},
                {"name": "Overhead Press", "sets": [{"reps": 10, "weight": 40}, {"reps": 10, "weight": 40}]},
            ],
        },
        {
            "id": _uid(), "date": _days_ago(1), "type": "cardio", "name": "Morning Run",
            "duration": 35, "caloriesBurned": 320, "notes": "Felt great",
            "exercises": [{"name": "Running", "distance": 5.2, "duration": 35, "pace": 6.73}],
        },
        {
            "id": _uid(), "date": _days_ago(2), "type": "strength", "name": "Pull Day",
            "duration": 60, "caloriesBurned": 450, "notes": "",
            "exercises": [
                {"name": "Deadlift", "sets": [{"reps": 5, "weight": 120}, {"reps": 5, "weight": 130}]},
                {"name": "Barbell Rows", "sets": [{"reps": 8, "weight": 60}, {"reps": 8, "weight": 65}]},
            ],
        },
        {
            "id": _uid(), "date": _days_ago(4), "type": "strength", "name": "Leg Day",
            "duration": 50, "caloriesBurned": 500, "notes": "",
            "exercises": [
                {"name": "Squats", "sets": [{"reps": 8, "weight": 100}, {"reps": 8, "weight": 105}]},
            ],
        },
        {
            "id": _uid(), "date": _days_ago(5), "type": "cardio", "name": "Evening Run",
            "duration": 25, "caloriesBurned": 240, "notes": "",
            "exercises": [{"name": "Running", "distance": 3.8, "duration": 25, "pace": 6.58}],
        },
        {
            "id": _uid(), "date": _days_ago(7), "type": "strength", "name": "Push Day",
            "duration": 50, "caloriesBurned": 400, "notes": "",
            "exercises": [
                {"name": "Bench Press", "sets": [{"reps": 8, "weight": 75}, {"reps": 8, "weight": 80}]},
            ],
        },
    ]

    metrics = []
    for i in range(30, -1, -3):
        metrics.append({
            "id": _uid(),
            "date": _days_ago(i),
            "weight": round(78 - (i * 0.08) + random.uniform(-0.3, 0.3), 1),
            "bodyFat": round(18 - (i * 0.03), 1),
            "measurements": {"chest": 102, "waist": 84 - (i * 0.03), "hips": 98},
        })

    today = date.today().isoformat()
    profile = {
        "name": "Athlete",
        "xp": 750,
        "level": 2,
        "streak": 3,
        "longestStreak": 7,
        "lastWorkoutDate": _days_ago(0),
        "waterLog": {_days_ago(0): 5, _days_ago(1): 8, _days_ago(2): 6},
        "joinedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }

    goals = [
        {
            "id": _uid(), "type": "weight", "title": "Reach 75 kg",
            "target": 75, "current": 76.2, "unit": "kg",
            "deadline": (date.today() + timedelta(days=60)).isoformat(),
            "createdAt": _days_ago(20), "completed": False,
        },
        {
            "id": _uid(), "type": "strength", "title": "Bench Press 100 kg",
            "target": 100, "current": 90, "unit": "kg",
            "deadline": (date.today() + timedelta(days=90)).isoformat(),
            "createdAt": _days_ago(30), "completed": False,
        },
    ]

    achievements = {
        "first_workout": {"unlockedAt": _days_ago(14)},
        "streak_3": {"unlockedAt": _days_ago(0)},
        "ten_workouts": {"unlockedAt": _days_ago(2)},
    }

    return {
        "workouts": workouts,
        "metrics": metrics,
        "goals": goals,
        "profile": profile,
        "achievements": achievements,
    }


def water_today(profile: dict) -> int:
    today = date.today().isoformat()
    return (profile.get("waterLog") or {}).get(today, 0)


def latest_metric(metrics: list) -> dict | None:
    if not metrics:
        return None
    return sorted(metrics, key=lambda m: m.get("date", ""))[-1]
