// ─── APEX Fitness · Storage Layer ─────────────────────────────────────────────
// Wraps localStorage with typed accessors for every data domain.

const KEYS = {
  WORKOUTS: 'apex_workouts',
  METRICS: 'apex_metrics',
  GOALS: 'apex_goals',
  ACHIEVEMENTS: 'apex_achievements',
  PROFILE: 'apex_profile',
  TEMPLATES: 'apex_templates',
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/* ── generic helpers ──────────────────────────────────────────────────────── */

function _get(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function _set(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function _notifyDataChange() {
  if (typeof window.onDataChange === 'function') {
    window.onDataChange('storage');
  }
}

/* ── Profile ──────────────────────────────────────────────────────────────── */

function getProfile() {
  return _get(KEYS.PROFILE, _defaultProfile());
}

function saveProfile(data) {
  _set(KEYS.PROFILE, { ...getProfile(), ...data });
}

function _defaultProfile() {
  return {
    name: 'Athlete',
    xp: 0,
    level: 1,
    streak: 0,
    longestStreak: 0,
    lastWorkoutDate: null,
    waterLog: {},
    joinedAt: new Date().toISOString(),
  };
}

/* ── Workouts ─────────────────────────────────────────────────────────────── */

function getWorkouts() {
  return _get(KEYS.WORKOUTS, []);
}

function saveWorkout(workout) {
  const all = getWorkouts();
  workout.id = workout.id || uid();
  workout.createdAt = workout.createdAt || new Date().toISOString();
  all.unshift(workout);
  _set(KEYS.WORKOUTS, all);
  _updateStreakAfterWorkout(workout);
  _addXP(workout.xp || 50);
  _notifyDataChange();
  return workout;
}

function deleteWorkout(id) {
  _set(KEYS.WORKOUTS, getWorkouts().filter(w => w.id !== id));
  _notifyDataChange();
}

function getWorkoutsForDate(dateStr) {
  return getWorkouts().filter(w => w.date === dateStr);
}

function getWorkoutsInRange(startDate, endDate) {
  return getWorkouts().filter(w => w.date >= startDate && w.date <= endDate);
}

/* ── Metrics ──────────────────────────────────────────────────────────────── */

function getMetrics() {
  return _get(KEYS.METRICS, []);
}

function saveMetric(metric) {
  const all = getMetrics();
  metric.id = metric.id || uid();
  metric.date = metric.date || today();
  // Replace existing entry for same date or add new
  const idx = all.findIndex(m => m.date === metric.date);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...metric };
  } else {
    all.push(metric);
  }
  all.sort((a, b) => a.date.localeCompare(b.date));
  _set(KEYS.METRICS, all);
  _notifyDataChange();
  return metric;
}

function getLatestMetric() {
  const all = getMetrics();
  return all.length ? all[all.length - 1] : null;
}

function deleteMetric(id) {
  _set(KEYS.METRICS, getMetrics().filter(m => m.id !== id));
  _notifyDataChange();
}

/* ── Goals ────────────────────────────────────────────────────────────────── */

function getGoals() {
  return _get(KEYS.GOALS, []);
}

function saveGoal(goal) {
  const all = getGoals();
  goal.id = goal.id || uid();
  goal.createdAt = goal.createdAt || new Date().toISOString();
  goal.completed = goal.completed || false;
  all.push(goal);
  _set(KEYS.GOALS, all);
  _notifyDataChange();
  return goal;
}

function updateGoal(id, updates) {
  const all = getGoals();
  const idx = all.findIndex(g => g.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...updates };
    _set(KEYS.GOALS, all);
    _notifyDataChange();
  }
}

function deleteGoal(id) {
  _set(KEYS.GOALS, getGoals().filter(g => g.id !== id));
  _notifyDataChange();
}

/* ── Achievements ─────────────────────────────────────────────────────────── */

function getAchievements() {
  return _get(KEYS.ACHIEVEMENTS, {});
}

function unlockAchievement(achievementId) {
  const all = getAchievements();
  if (!all[achievementId]) {
    all[achievementId] = { unlockedAt: new Date().toISOString() };
    _set(KEYS.ACHIEVEMENTS, all);
    _addXP(100);
    _notifyDataChange();
    return true;  // newly unlocked
  }
  return false;
}

/* ── Workout Templates ────────────────────────────────────────────────────── */

function getTemplates() {
  return _get(KEYS.TEMPLATES, _defaultTemplates());
}

function saveTemplate(template) {
  const all = getTemplates();
  template.id = template.id || uid();
  all.push(template);
  _set(KEYS.TEMPLATES, all);
  return template;
}

function deleteTemplate(id) {
  _set(KEYS.TEMPLATES, getTemplates().filter(t => t.id !== id));
}

/* ── Water Log ────────────────────────────────────────────────────────────── */

function getWaterToday() {
  const profile = getProfile();
  return (profile.waterLog && profile.waterLog[today()]) || 0;
}

function addWater(glasses = 1) {
  const profile = getProfile();
  if (!profile.waterLog) profile.waterLog = {};
  profile.waterLog[today()] = (profile.waterLog[today()] || 0) + glasses;
  saveProfile(profile);
  _notifyDataChange();
  return profile.waterLog[today()];
}

/* ── Internal helpers ─────────────────────────────────────────────────────── */

function _updateStreakAfterWorkout(workout) {
  const profile = getProfile();
  const workoutDate = workout.date || today();
  const lastDate = profile.lastWorkoutDate;

  if (!lastDate) {
    profile.streak = 1;
  } else if (workoutDate === lastDate) {
    // same day — no change
  } else {
    const diff = _daysBetween(lastDate, workoutDate);
    if (diff === 1) {
      profile.streak += 1;
    } else {
      profile.streak = 1;
    }
  }

  profile.longestStreak = Math.max(profile.longestStreak || 0, profile.streak);
  profile.lastWorkoutDate = workoutDate;
  saveProfile(profile);
}

function _addXP(amount) {
  const profile = getProfile();
  profile.xp = (profile.xp || 0) + amount;
  // Level up every 500 XP
  profile.level = Math.floor(profile.xp / 500) + 1;
  saveProfile(profile);
}

function _daysBetween(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  return Math.round(Math.abs((d2 - d1) / 86400000));
}

/* ── Default Templates ────────────────────────────────────────────────────── */

function _defaultTemplates() {
  return [
    {
      id: 'tpl_push',
      name: 'Push Day',
      type: 'strength',
      exercises: [
        { name: 'Bench Press', sets: 4, reps: 8 },
        { name: 'Overhead Press', sets: 3, reps: 10 },
        { name: 'Incline Dumbbell Press', sets: 3, reps: 10 },
        { name: 'Lateral Raises', sets: 3, reps: 15 },
        { name: 'Tricep Pushdowns', sets: 3, reps: 12 },
      ],
    },
    {
      id: 'tpl_pull',
      name: 'Pull Day',
      type: 'strength',
      exercises: [
        { name: 'Deadlift', sets: 4, reps: 5 },
        { name: 'Barbell Rows', sets: 4, reps: 8 },
        { name: 'Pull-Ups', sets: 3, reps: 8 },
        { name: 'Face Pulls', sets: 3, reps: 15 },
        { name: 'Barbell Curls', sets: 3, reps: 12 },
      ],
    },
    {
      id: 'tpl_legs',
      name: 'Leg Day',
      type: 'strength',
      exercises: [
        { name: 'Squats', sets: 4, reps: 8 },
        { name: 'Romanian Deadlift', sets: 3, reps: 10 },
        { name: 'Leg Press', sets: 3, reps: 12 },
        { name: 'Leg Curl', sets: 3, reps: 12 },
        { name: 'Calf Raises', sets: 4, reps: 15 },
      ],
    },
    {
      id: 'tpl_hiit',
      name: 'HIIT Cardio',
      type: 'cardio',
      exercises: [
        { name: 'Burpees', duration: 45 },
        { name: 'Mountain Climbers', duration: 45 },
        { name: 'Jump Squats', duration: 45 },
        { name: 'High Knees', duration: 45 },
        { name: 'Box Jumps', duration: 45 },
      ],
    },
  ];
}

/* ── Seed demo data for first-time users ──────────────────────────────────── */

function seedIfEmpty() {
  if (getWorkouts().length > 0) return;

  const now = new Date();
  const daysAgo = (n) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };

  // Seed workouts
  const seedWorkouts = [
    {
      id: uid(), date: daysAgo(0), type: 'strength', name: 'Push Day',
      duration: 55, caloriesBurned: 420, notes: '',
      exercises: [
        { name: 'Bench Press', sets: [{ reps: 8, weight: 80 }, { reps: 8, weight: 85 }, { reps: 6, weight: 90 }, { reps: 6, weight: 90 }] },
        { name: 'Overhead Press', sets: [{ reps: 10, weight: 40 }, { reps: 10, weight: 40 }, { reps: 8, weight: 45 }] },
        { name: 'Lateral Raises', sets: [{ reps: 15, weight: 10 }, { reps: 15, weight: 10 }, { reps: 12, weight: 12 }] },
      ],
    },
    {
      id: uid(), date: daysAgo(1), type: 'cardio', name: 'Morning Run',
      duration: 35, caloriesBurned: 320, notes: 'Felt great',
      exercises: [
        { name: 'Running', distance: 5.2, duration: 35, pace: 6.73 },
      ],
    },
    {
      id: uid(), date: daysAgo(2), type: 'strength', name: 'Pull Day',
      duration: 60, caloriesBurned: 450, notes: '',
      exercises: [
        { name: 'Deadlift', sets: [{ reps: 5, weight: 120 }, { reps: 5, weight: 130 }, { reps: 3, weight: 140 }] },
        { name: 'Barbell Rows', sets: [{ reps: 8, weight: 60 }, { reps: 8, weight: 65 }, { reps: 8, weight: 65 }] },
        { name: 'Pull-Ups', sets: [{ reps: 10, weight: 0 }, { reps: 8, weight: 0 }, { reps: 7, weight: 0 }] },
      ],
    },
    {
      id: uid(), date: daysAgo(4), type: 'strength', name: 'Leg Day',
      duration: 50, caloriesBurned: 500, notes: '',
      exercises: [
        { name: 'Squats', sets: [{ reps: 8, weight: 100 }, { reps: 8, weight: 105 }, { reps: 6, weight: 110 }] },
        { name: 'Romanian Deadlift', sets: [{ reps: 10, weight: 80 }, { reps: 10, weight: 80 }, { reps: 10, weight: 85 }] },
      ],
    },
    {
      id: uid(), date: daysAgo(5), type: 'cardio', name: 'Evening Run',
      duration: 25, caloriesBurned: 240, notes: '',
      exercises: [
        { name: 'Running', distance: 3.8, duration: 25, pace: 6.58 },
      ],
    },
    {
      id: uid(), date: daysAgo(7), type: 'strength', name: 'Push Day',
      duration: 50, caloriesBurned: 400, notes: '',
      exercises: [
        { name: 'Bench Press', sets: [{ reps: 8, weight: 75 }, { reps: 8, weight: 80 }, { reps: 6, weight: 85 }] },
        { name: 'Overhead Press', sets: [{ reps: 10, weight: 35 }, { reps: 10, weight: 40 }, { reps: 8, weight: 40 }] },
      ],
    },
    {
      id: uid(), date: daysAgo(9), type: 'flexibility', name: 'Yoga Session',
      duration: 40, caloriesBurned: 150, notes: 'Stretching & recovery',
      exercises: [
        { name: 'Sun Salutation', duration: 15 },
        { name: 'Warrior Poses', duration: 10 },
        { name: 'Hip Openers', duration: 15 },
      ],
    },
    {
      id: uid(), date: daysAgo(10), type: 'cardio', name: 'Cycling',
      duration: 45, caloriesBurned: 380, notes: '',
      exercises: [
        { name: 'Cycling', distance: 18, duration: 45, pace: 2.5 },
      ],
    },
    {
      id: uid(), date: daysAgo(12), type: 'strength', name: 'Full Body',
      duration: 65, caloriesBurned: 520, notes: '',
      exercises: [
        { name: 'Squats', sets: [{ reps: 8, weight: 95 }, { reps: 8, weight: 100 }] },
        { name: 'Bench Press', sets: [{ reps: 8, weight: 75 }, { reps: 8, weight: 80 }] },
        { name: 'Barbell Rows', sets: [{ reps: 8, weight: 55 }, { reps: 8, weight: 60 }] },
      ],
    },
    {
      id: uid(), date: daysAgo(14), type: 'cardio', name: 'Swimming',
      duration: 30, caloriesBurned: 300, notes: 'Pool session',
      exercises: [
        { name: 'Swimming', distance: 1.5, duration: 30 },
      ],
    },
  ];
  _set(KEYS.WORKOUTS, seedWorkouts);

  // Seed metrics
  const seedMetrics = [];
  for (let i = 30; i >= 0; i -= 3) {
    seedMetrics.push({
      id: uid(),
      date: daysAgo(i),
      weight: 78 - (i * 0.08) + (Math.random() * 0.6 - 0.3),
      bodyFat: 18 - (i * 0.03),
      measurements: {
        chest: 102 + Math.random() * 0.5,
        waist: 84 - (i * 0.03),
        hips: 98,
        leftArm: 35 + (i < 15 ? 0.5 : 0),
        rightArm: 35.5 + (i < 15 ? 0.5 : 0),
        leftThigh: 58,
        rightThigh: 58.5,
      },
    });
  }
  _set(KEYS.METRICS, seedMetrics);

  // Seed profile
  const profile = _defaultProfile();
  profile.streak = 3;
  profile.longestStreak = 7;
  profile.lastWorkoutDate = daysAgo(0);
  profile.xp = 750;
  profile.level = 2;
  profile.waterLog = {
    [daysAgo(0)]: 5,
    [daysAgo(1)]: 8,
    [daysAgo(2)]: 6,
  };
  _set(KEYS.PROFILE, profile);

  // Seed goals
  const seedGoals = [
    {
      id: uid(), type: 'weight', title: 'Reach 75 kg',
      target: 75, current: 76.2, unit: 'kg',
      deadline: new Date(now.getTime() + 60 * 86400000).toISOString().slice(0, 10),
      createdAt: daysAgo(20), completed: false,
    },
    {
      id: uid(), type: 'workouts', title: '20 workouts this month',
      target: 20, current: 10, unit: 'workouts',
      deadline: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
      createdAt: daysAgo(15), completed: false,
    },
    {
      id: uid(), type: 'strength', title: 'Bench Press 100 kg',
      target: 100, current: 90, unit: 'kg',
      deadline: new Date(now.getTime() + 90 * 86400000).toISOString().slice(0, 10),
      createdAt: daysAgo(30), completed: false,
    },
  ];
  _set(KEYS.GOALS, seedGoals);

  // Seed some achievements
  const ach = {};
  ach['first_workout'] = { unlockedAt: daysAgo(14) };
  ach['streak_3'] = { unlockedAt: daysAgo(0) };
  ach['ten_workouts'] = { unlockedAt: daysAgo(2) };
  _set(KEYS.ACHIEVEMENTS, ach);
}

/* ── Reset ────────────────────────────────────────────────────────────────── */

function clearAll() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}

/* ── Export ────────────────────────────────────────────────────────────────── */

window.Storage = {
  uid,
  today,
  getProfile,
  saveProfile,
  getWorkouts,
  saveWorkout,
  deleteWorkout,
  getWorkoutsForDate,
  getWorkoutsInRange,
  getMetrics,
  saveMetric,
  getLatestMetric,
  deleteMetric,
  getGoals,
  saveGoal,
  updateGoal,
  deleteGoal,
  getAchievements,
  unlockAchievement,
  getTemplates,
  saveTemplate,
  deleteTemplate,
  getWaterToday,
  addWater,
  seedIfEmpty,
  clearAll,
};
