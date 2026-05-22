// ─── APEX Fitness · Achievements Module ───────────────────────────────────────
// Gamification layer: XP, levels, achievement tracking, weekly challenges.
// Attaches to window.Achievements

(function () {
  'use strict';

  const { $, $$, html, toast, confetti, formatNumber } = window.Utils;
  const Storage = window.Storage;
  const Defs = window.AchievementDefs;

  /* ── Constants ────────────────────────────────────────────────────────────── */

  const XP_PER_LEVEL = 500;

  const LEVEL_TITLES = {
    1: 'Beginner',
    2: 'Novice',
    3: 'Intermediate',
    4: 'Advanced',
    5: 'Expert',
    6: 'Master',
    7: 'Champion',
    8: 'Legend',
    9: 'Titan',
  };

  const MAJOR_ACHIEVEMENTS = new Set([
    'streak_7', 'streak_30',
    'fifty_workouts', 'hundred_workouts',
    'goal_completed',
  ]);

  /* ── Helpers ─────────────────────────────────────────────────────────────── */

  function getLevelTitle(level) {
    if (level >= 10) return 'Apex';
    return LEVEL_TITLES[level] || 'Beginner';
  }

  function xpForLevel(level) {
    return level * XP_PER_LEVEL;
  }

  function xpProgress(totalXP) {
    const level = Math.floor(totalXP / XP_PER_LEVEL) + 1;
    const currentLevelXP = (level - 1) * XP_PER_LEVEL;
    const xpIntoLevel = totalXP - currentLevelXP;
    const xpNeeded = XP_PER_LEVEL;
    return { level, xpIntoLevel, xpNeeded, percent: Math.min((xpIntoLevel / xpNeeded) * 100, 100) };
  }

  function getWeekNumber() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    return Math.floor(diff / (7 * 86400000));
  }

  /* ── Weekly Challenge Generator ──────────────────────────────────────────── */

  function getWeeklyChallenge() {
    const week = getWeekNumber();
    const challenges = [
      { text: 'Complete 5 workouts this week', target: 5, type: 'workouts' },
      { text: 'Log 3 cardio sessions', target: 3, type: 'cardio' },
      { text: 'Drink 8 glasses of water 3 days this week', target: 3, type: 'water_days' },
      { text: 'Complete 3 strength workouts', target: 3, type: 'strength' },
      { text: 'Work out 4 days this week', target: 4, type: 'workout_days' },
      { text: 'Log 2 different workout types', target: 2, type: 'variety' },
      { text: 'Complete 6 workouts this week', target: 6, type: 'workouts' },
      { text: 'Run a total of 10 km this week', target: 10, type: 'distance' },
    ];

    const challenge = challenges[week % challenges.length];
    const progress = calcChallengeProgress(challenge);
    return { ...challenge, progress };
  }

  function getWeekStart() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    const start = new Date(now);
    start.setDate(diff);
    return start.toISOString().slice(0, 10);
  }

  function calcChallengeProgress(challenge) {
    const weekStart = getWeekStart();
    const today = Storage.today();
    const workouts = Storage.getWorkouts().filter(w => w.date >= weekStart && w.date <= today);

    switch (challenge.type) {
      case 'workouts':
        return Math.min(workouts.length, challenge.target);
      case 'cardio':
        return Math.min(workouts.filter(w => w.type === 'cardio').length, challenge.target);
      case 'strength':
        return Math.min(workouts.filter(w => w.type === 'strength').length, challenge.target);
      case 'workout_days': {
        const uniqueDays = new Set(workouts.map(w => w.date));
        return Math.min(uniqueDays.size, challenge.target);
      }
      case 'variety': {
        const types = new Set(workouts.map(w => w.type));
        return Math.min(types.size, challenge.target);
      }
      case 'distance': {
        let total = 0;
        workouts.forEach(w => {
          if (w.exercises) {
            w.exercises.forEach(ex => { if (ex.distance) total += ex.distance; });
          }
        });
        return Math.min(Math.round(total * 10) / 10, challenge.target);
      }
      case 'water_days': {
        const profile = Storage.getProfile();
        const log = profile.waterLog || {};
        let count = 0;
        // Check each day from week start to today
        const d = new Date(weekStart + 'T00:00:00');
        const end = new Date(today + 'T00:00:00');
        while (d <= end) {
          const dateStr = d.toISOString().slice(0, 10);
          if ((log[dateStr] || 0) >= 8) count++;
          d.setDate(d.getDate() + 1);
        }
        return Math.min(count, challenge.target);
      }
      default:
        return 0;
    }
  }

  /* ── Render ──────────────────────────────────────────────────────────────── */

  function render() {
    const container = $('#page-achievements .page-content');
    if (!container) return;

    const profile = Storage.getProfile();
    const unlocked = Storage.getAchievements();
    const progress = xpProgress(profile.xp || 0);
    const unlockedCount = Object.keys(unlocked).length;
    const totalCount = Defs.length;
    const totalXP = profile.xp || 0;

    // Sort: unlocked first, then locked
    const sortedDefs = [...Defs].sort((a, b) => {
      const aUnlocked = !!unlocked[a.id];
      const bUnlocked = !!unlocked[b.id];
      if (aUnlocked === bUnlocked) return 0;
      return aUnlocked ? -1 : 1;
    });

    const challenge = getWeeklyChallenge();
    const challengePercent = Math.min((challenge.progress / challenge.target) * 100, 100);

    html(container, `
      <!-- Level & XP Bar -->
      <div class="card" style="text-align:center; padding: 2rem 1.5rem;">
        <div style="font-size: 3rem; font-weight: 800; line-height: 1;">
          ${progress.level}
        </div>
        <div style="font-size: 0.85rem; opacity: 0.7; margin-top: 0.25rem; text-transform: uppercase; letter-spacing: 0.1em;">
          ${getLevelTitle(progress.level)}
        </div>
        <div class="xp-bar" style="margin-top: 1rem;">
          <div class="xp-fill" style="width: ${progress.percent}%;"></div>
        </div>
        <div class="xp-info" style="margin-top: 0.5rem; font-size: 0.8rem; opacity: 0.6;">
          ${formatNumber(progress.xpIntoLevel)} / ${formatNumber(progress.xpNeeded)} XP to Level ${progress.level + 1}
        </div>
      </div>

      <!-- Stats Row -->
      <div class="stats-grid" style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-top: 1rem;">
        <div class="stat-card card" style="text-align:center; padding: 1rem;">
          <div class="stat-value">${unlockedCount} / ${totalCount}</div>
          <div class="stat-label">Achievements</div>
        </div>
        <div class="stat-card card" style="text-align:center; padding: 1rem;">
          <div class="stat-value">${formatNumber(totalXP)}</div>
          <div class="stat-label">Total XP</div>
        </div>
        <div class="stat-card card" style="text-align:center; padding: 1rem;">
          <div class="stat-value">${profile.streak || 0} 🔥</div>
          <div class="stat-label">Current Streak</div>
        </div>
      </div>

      <!-- Weekly Challenge -->
      <div class="card" style="margin-top: 1rem;">
        <div class="card-header">
          <h3 class="card-title">⚔️ Weekly Challenge</h3>
          <span class="badge badge--accent">${challenge.progress >= challenge.target ? 'Complete!' : 'In Progress'}</span>
        </div>
        <p style="margin: 0.75rem 0 0.5rem; font-size: 0.95rem;">${challenge.text}</p>
        <div class="xp-bar" style="margin-top: 0.5rem;">
          <div class="xp-fill" style="width: ${challengePercent}%;"></div>
        </div>
        <div class="xp-info" style="margin-top: 0.35rem; font-size: 0.8rem; opacity: 0.6;">
          ${challenge.progress} / ${challenge.target}
        </div>
      </div>

      <!-- Achievement Grid -->
      <div style="margin-top: 1.25rem;">
        <h3 class="card-title" style="margin-bottom: 0.75rem;">All Achievements</h3>
        <div class="achievement-grid">
          ${sortedDefs.map(def => renderCard(def, unlocked[def.id])).join('')}
        </div>
      </div>
    `);
  }

  function renderCard(def, unlock) {
    const isUnlocked = !!unlock;
    const lockClass = isUnlocked ? '' : ' locked';
    const dateStr = isUnlocked
      ? new Date(unlock.unlockedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';

    return `
      <div class="achievement-card${lockClass}" data-id="${def.id}">
        <div class="achievement-icon">${isUnlocked ? def.icon : '🔒'}</div>
        <div class="achievement-name">${def.name}</div>
        <div class="achievement-desc">${def.desc}</div>
        <div style="margin-top:auto; padding-top:0.5rem; font-size:0.75rem; opacity:0.6;">
          ${isUnlocked ? dateStr : `+${def.xp} XP`}
        </div>
      </div>
    `;
  }

  /* ── Achievement Checking ────────────────────────────────────────────────── */

  function checkAchievements() {
    const profile = Storage.getProfile();
    const workouts = Storage.getWorkouts();
    const goals = Storage.getGoals();
    const metrics = Storage.getMetrics();
    const water = Storage.getWaterToday();
    const unlocked = Storage.getAchievements();
    const newlyUnlocked = [];

    const conditions = {
      first_workout:    () => workouts.length >= 1,
      streak_3:         () => profile.streak >= 3,
      streak_7:         () => profile.streak >= 7,
      streak_30:        () => profile.streak >= 30,
      ten_workouts:     () => workouts.length >= 10,
      fifty_workouts:   () => workouts.length >= 50,
      hundred_workouts: () => workouts.length >= 100,
      first_cardio:     () => workouts.some(w => w.type === 'cardio'),
      first_strength:   () => workouts.some(w => w.type === 'strength'),
      first_goal:       () => goals.length >= 1,
      goal_completed:   () => goals.some(g => g.completed === true),
      water_8:          () => water >= 8,
      logged_weight:    () => metrics.length >= 1,
      five_km:          () => workouts.some(w =>
        w.type === 'cardio' && w.exercises && w.exercises.some(ex => ex.distance >= 5)
      ),
      // early_bird: skipped — can't easily check time
      level_5:          () => profile.level >= 5,
      level_10:         () => profile.level >= 10,
    };

    Defs.forEach(def => {
      // Skip already-unlocked or no condition defined
      if (unlocked[def.id]) return;
      const check = conditions[def.id];
      if (!check) return;

      if (check()) {
        const isNew = Storage.unlockAchievement(def.id);
        if (isNew) {
          newlyUnlocked.push(def.id);

          // Toast
          toast(`Achievement Unlocked: ${def.name}! +${def.xp} XP`, 'success');

          // Confetti for major achievements
          if (MAJOR_ACHIEVEMENTS.has(def.id)) {
            confetti();
          }

          // Pop animation on the card if it exists in the DOM
          setTimeout(() => {
            const card = document.querySelector(`.achievement-card[data-id="${def.id}"]`);
            if (card) {
              card.classList.remove('locked');
              card.style.animation = 'achievePop 0.5s ease';
              // Re-render icon & date
              const iconEl = card.querySelector('.achievement-icon');
              if (iconEl) iconEl.textContent = def.icon;
            }
          }, 100);
        }
      }
    });

    return newlyUnlocked;
  }

  /* ── Init ─────────────────────────────────────────────────────────────────── */

  function init() {
    // Initial render handled by app.js navigation
  }

  /* ── Export ───────────────────────────────────────────────────────────────── */

  window.Achievements = {
    init,
    render,
    checkAchievements,
  };
})();
