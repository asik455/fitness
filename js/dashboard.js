/* =========================================================
 *  Dashboard Module  –  window.Dashboard
 *  Renders the main dashboard page into #page-dashboard .page-content
 * ========================================================= */
(function () {
  'use strict';

  const { $, $$, html, toast, formatNumber, formatDuration,
          formatRelative, getWeekDates, getDayName, animateCounter } = window.Utils;
  const Storage      = window.Storage;
  const WorkoutTypes = window.WorkoutTypes;

  /* ----- helpers -------------------------------------------------- */

  function weekWorkouts() {
    const end   = Storage.today();
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    const fmt = d => d.toISOString().slice(0, 10);
    return Storage.getWorkoutsInRange(fmt(start), fmt(end));
  }

  function dayKey(d) {
    return typeof d === 'string' ? d : d.toISOString().slice(0, 10);
  }

  /* ----- section builders ----------------------------------------- */

  function buildStatsRow(workouts, waterCount) {
    const totalWorkouts = workouts.length;
    const totalCalories = workouts.reduce((s, w) => s + (w.caloriesBurned || 0), 0);
    const totalMinutes  = workouts.reduce((s, w) => s + (w.duration || 0), 0);

    return `
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-value" data-counter="${totalWorkouts}">0</span>
          <span class="stat-label">Workouts This Week</span>
        </div>
        <div class="stat-card">
          <span class="stat-value" data-counter="${totalCalories}">0</span>
          <span class="stat-label">Calories Burned</span>
        </div>
        <div class="stat-card">
          <span class="stat-value" data-counter="${totalMinutes}">0</span>
          <span class="stat-label">Active Minutes</span>
        </div>
        <div class="stat-card stat-card--water">
          <div class="water-control">
            <button class="water-btn" data-action="water-dec" aria-label="Remove glass">−</button>
            <span class="stat-value" data-counter="${waterCount}">0</span>
            <button class="water-btn" data-action="water-inc" aria-label="Add glass">+</button>
          </div>
          <span class="stat-label">Water Today (glasses)</span>
        </div>
      </div>`;
  }

  function buildStreak(profile) {
    const current = profile.currentStreak || 0;
    const longest = profile.longestStreak || 0;
    const glowClass = current > 0 ? ' streak--active' : '';

    return `
      <div class="card streak-card${glowClass}">
        <div class="card-header"><h3 class="card-title">🔥 Streak</h3></div>
        <div class="streak-body">
          <div class="streak-stat">
            <span class="streak-value">${current}</span>
            <span class="streak-label">Current streak (days)</span>
          </div>
          <div class="streak-stat">
            <span class="streak-value">${longest}</span>
            <span class="streak-label">Longest streak</span>
          </div>
        </div>
      </div>`;
  }

  function buildWeeklyBars() {
    const today = Storage.today();
    const days  = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key      = dayKey(d);
      const workouts = Storage.getWorkoutsForDate(key);
      const minutes  = workouts.reduce((s, w) => s + (w.duration || 0), 0);
      const calories = workouts.reduce((s, w) => s + (w.caloriesBurned || 0), 0);
      const count    = workouts.length;
      days.push({
        label: getDayName(d).slice(0, 3),
        minutes,
        calories,
        count,
        date: key
      });
    }

    const maxMin = Math.max(1, ...days.map(d => d.minutes));

    const bars = days.map(d => {
      const pct = Math.round((d.minutes / maxMin) * 100);
      return `
        <div class="activity-bar-wrapper"
             data-tooltip="${d.label}: ${d.minutes} min, ${d.calories} cal, ${d.count} workout(s)">
          <div class="activity-bar" style="height:${pct}%"></div>
          <span class="activity-bar-label">${d.label}</span>
        </div>`;
    }).join('');

    return `
      <div class="card">
        <div class="card-header"><h3 class="card-title">Weekly Activity</h3></div>
        <div class="activity-bars">${bars}</div>
      </div>`;
  }

  function buildQuote() {
    const quote = window.getDailyQuote();
    return `
      <div class="card quote-card">
        <div class="card-header"><h3 class="card-title">Daily Motivation</h3></div>
        <blockquote class="quote-text"><em>"${quote.text}"</em></blockquote>
        <span class="quote-author">— ${quote.author}</span>
      </div>`;
  }

  function buildRecentActivity() {
    const all    = Storage.getWorkouts();
    const recent = all.slice(-5).reverse();

    let listHTML;
    if (recent.length === 0) {
      listHTML = '<p class="empty-state">No workouts logged yet. Get moving! 💪</p>';
    } else {
      listHTML = '<ul class="recent-list">' + recent.map(w => {
        const type = WorkoutTypes[w.type] || { label: w.type, icon: '🏋️' };
        return `
          <li class="recent-item" data-action="view-workout" data-id="${w.id}">
            <span class="recent-icon">${type.icon}</span>
            <div class="recent-info">
              <span class="recent-name">${w.name || type.label}</span>
              <span class="recent-meta">
                ${formatRelative(w.date)} · ${formatDuration(w.duration)} · ${formatNumber(w.caloriesBurned || 0)} cal
              </span>
            </div>
          </li>`;
      }).join('') + '</ul>';
    }

    return `
      <div class="card">
        <div class="card-header"><h3 class="card-title">Recent Activity</h3></div>
        ${listHTML}
      </div>`;
  }

  function buildQuickActions() {
    return `
      <div class="quick-actions">
        <button class="quick-action-btn" data-modal="modal-workout">
          <span class="quick-action-icon">🏋️</span>
          <span class="quick-action-label">Log Workout</span>
        </button>
        <button class="quick-action-btn" data-modal="modal-metric">
          <span class="quick-action-icon">⚖️</span>
          <span class="quick-action-label">Add Weight</span>
        </button>
        <button class="quick-action-btn" data-modal="modal-goal">
          <span class="quick-action-icon">🎯</span>
          <span class="quick-action-label">Set Goal</span>
        </button>
      </div>`;
  }

  /* ----- render & init -------------------------------------------- */

  function render() {
    const container = $('#page-dashboard .page-content');
    if (!container) return;

    const workouts   = weekWorkouts();
    const profile    = Storage.getProfile();
    const waterCount = Storage.getWaterToday();

    const markup = [
      buildStatsRow(workouts, waterCount),
      buildStreak(profile),
      buildWeeklyBars(),
      buildQuote(),
      buildRecentActivity(),
      buildQuickActions()
    ].join('');

    html(container, markup);

    // Animate stat counters
    $$('.stat-value[data-counter]').forEach(el => {
      const target = parseInt(el.getAttribute('data-counter'), 10);
      animateCounter(el, target);
    });
  }

  function handleContainerClick(e) {
    const target = e.target;

    // Water increment
    const incBtn = target.closest('[data-action="water-inc"]');
    if (incBtn) {
      Storage.addWater(1);
      render();
      return;
    }

    // Water decrement
    const decBtn = target.closest('[data-action="water-dec"]');
    if (decBtn) {
      Storage.addWater(-1);
      render();
      return;
    }

    // Quick action modals
    const modalBtn = target.closest('[data-modal]');
    if (modalBtn) {
      const modalId = modalBtn.getAttribute('data-modal');
      const modal   = $('#' + modalId);
      if (modal) modal.classList.add('active');
      return;
    }

    // View workout
    const workoutItem = target.closest('[data-action="view-workout"]');
    if (workoutItem) {
      // Propagate via custom event so other modules can handle navigation
      document.dispatchEvent(new CustomEvent('navigate', {
        detail: { page: 'history', workoutId: workoutItem.getAttribute('data-id') }
      }));
    }
  }

  function showBarTooltip(e) {
    const wrapper = e.target.closest('.activity-bar-wrapper');
    if (!wrapper) return;
    const text = wrapper.getAttribute('data-tooltip');
    if (!text) return;

    let tip = $('#bar-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'bar-tooltip';
      tip.className = 'bar-tooltip';
      document.body.appendChild(tip);
    }
    tip.textContent = text;
    tip.style.display = 'block';

    const rect = wrapper.getBoundingClientRect();
    tip.style.left = rect.left + rect.width / 2 - tip.offsetWidth / 2 + 'px';
    tip.style.top  = rect.top - tip.offsetHeight - 6 + 'px';
  }

  function hideBarTooltip() {
    const tip = $('#bar-tooltip');
    if (tip) tip.style.display = 'none';
  }

  function init() {
    const container = $('#page-dashboard .page-content');
    if (!container) return;

    container.addEventListener('click', handleContainerClick);
    container.addEventListener('mouseover', showBarTooltip);
    container.addEventListener('mouseout', hideBarTooltip);
  }

  /* ----- public API ----------------------------------------------- */

  window.Dashboard = { init, render };
})();
