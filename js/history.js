// ─── APEX Fitness · History Module ─────────────────────────────────────────────
// Workout history with calendar view, filters, personal records, and stats.

(function () {
  const { $, $$, html, toast, formatDate, formatDateShort, formatRelative,
          formatDuration, formatNumber, getMonthDays, getFirstDayOfMonth,
          formatWeight, formatDistance } = window.Utils;
  const Storage = window.Storage;
  const Types   = window.WorkoutTypes;

  /* ── State ─────────────────────────────────────────────────────────────── */

  let currentMonth  = new Date().getMonth();
  let currentYear   = new Date().getFullYear();
  let selectedDate  = null;
  let activeFilter  = 'all';
  let expandedId    = null;

  /* ── Helpers ────────────────────────────────────────────────────────────── */

  function pad(n) { return String(n).padStart(2, '0'); }

  function dateStr(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }

  function monthLabel(y, m) {
    return new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function workoutsForMonth(workouts, y, m) {
    const prefix = `${y}-${pad(m + 1)}`;
    return workouts.filter(w => w.date && w.date.startsWith(prefix));
  }

  function workoutDatesSet(workouts) {
    const s = new Set();
    workouts.forEach(w => { if (w.date) s.add(w.date); });
    return s;
  }

  function filterWorkouts(list) {
    if (activeFilter === 'all') return list;
    return list.filter(w => w.type === activeFilter);
  }

  function sortDesc(list) {
    return [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  /* ── Personal Records ──────────────────────────────────────────────────── */

  function computePRs(allWorkouts) {
    const prMap = {}; // exerciseName → { weight, date }

    allWorkouts.forEach(w => {
      if (w.type !== 'strength' || !w.exercises) return;
      w.exercises.forEach(ex => {
        if (!ex.sets) return;
        ex.sets.forEach(s => {
          if (!s.weight) return;
          const key = ex.name;
          if (!prMap[key] || s.weight > prMap[key].weight) {
            prMap[key] = { weight: s.weight, date: w.date };
          }
        });
      });
    });

    return Object.entries(prMap)
      .map(([name, data]) => ({ name, weight: data.weight, date: data.date }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5);
  }

  /* ── Stats ─────────────────────────────────────────────────────────────── */

  function computeStats(monthWorkouts) {
    let totalDuration = 0;
    let totalCalories = 0;
    monthWorkouts.forEach(w => {
      totalDuration += w.duration || 0;
      totalCalories += w.caloriesBurned || 0;
    });
    return {
      count: monthWorkouts.length,
      duration: totalDuration,
      calories: totalCalories,
    };
  }

  /* ── Calendar Render ───────────────────────────────────────────────────── */

  function renderCalendar(workoutDates) {
    const totalDays  = getMonthDays(currentYear, currentMonth);
    let firstDay     = getFirstDayOfMonth(currentYear, currentMonth);
    // Convert Sunday=0 to Monday-start: Mon=0 … Sun=6
    firstDay = (firstDay + 6) % 7;

    const todayStr = Storage.today();
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Previous month overflow
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear  = currentMonth === 0 ? currentYear - 1 : currentYear;
    const prevDays  = getMonthDays(prevYear, prevMonth);

    let cells = '';

    // Day-of-week labels
    dayLabels.forEach(dl => {
      cells += `<div class="calendar-day-label">${dl}</div>`;
    });

    // Leading days from previous month
    for (let i = firstDay - 1; i >= 0; i--) {
      const d   = prevDays - i;
      const ds  = dateStr(prevYear, prevMonth, d);
      const dot = workoutDates.has(ds) ? ' has-workout' : '';
      cells += `<div class="calendar-day other-month${dot}" data-date="${ds}">${d}</div>`;
    }

    // Days of current month
    for (let d = 1; d <= totalDays; d++) {
      const ds  = dateStr(currentYear, currentMonth, d);
      let cls   = 'calendar-day';
      if (ds === todayStr)     cls += ' today';
      if (ds === selectedDate) cls += ' selected';
      if (workoutDates.has(ds)) cls += ' has-workout';
      cells += `<div class="${cls}" data-date="${ds}">${d}</div>`;
    }

    // Trailing days to fill last row (always show complete rows of 7)
    const totalCells = firstDay + totalDays;
    const trailing   = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    const nextMonth  = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYear   = currentMonth === 11 ? currentYear + 1 : currentYear;
    for (let d = 1; d <= trailing; d++) {
      const ds  = dateStr(nextYear, nextMonth, d);
      const dot = workoutDates.has(ds) ? ' has-workout' : '';
      cells += `<div class="calendar-day other-month${dot}" data-date="${ds}">${d}</div>`;
    }

    return `
      <div class="calendar">
        <div class="calendar-header">
          <button class="btn-ghost" data-cal="prev" aria-label="Previous month">&#8249;</button>
          <span class="calendar-title">${monthLabel(currentYear, currentMonth)}</span>
          <button class="btn-ghost" data-cal="next" aria-label="Next month">&#8250;</button>
        </div>
        <div class="calendar-grid">
          ${cells}
        </div>
      </div>`;
  }

  /* ── Filter Bar ────────────────────────────────────────────────────────── */

  function renderFilterBar() {
    const filters = [
      { key: 'all',         label: 'All' },
      { key: 'strength',    label: 'Strength' },
      { key: 'cardio',      label: 'Cardio' },
      { key: 'flexibility', label: 'Flexibility' },
      { key: 'hiit',        label: 'HIIT' },
    ];

    const pills = filters.map(f => {
      const active = f.key === activeFilter ? ' active' : '';
      return `<button class="filter-pill${active}" data-filter="${f.key}">${f.label}</button>`;
    }).join('');

    return `<div class="filter-bar">${pills}</div>`;
  }

  /* ── Exercise Detail Rendering ─────────────────────────────────────────── */

  function renderExerciseDetail(ex, workoutType) {
    // Strength: sets/reps/weight
    if (ex.sets && ex.sets.length) {
      const rows = ex.sets.map((s, i) => `
        <tr>
          <td>Set ${i + 1}</td>
          <td>${s.reps || '—'}</td>
          <td>${s.weight ? formatWeight(s.weight) : '—'}</td>
        </tr>`).join('');

      return `
        <div class="exercise-detail">
          <strong>${ex.name}</strong>
          <table>
            <thead><tr><th></th><th>Reps</th><th>Weight</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }

    // Cardio: distance / duration
    if (ex.distance != null || ex.duration != null) {
      const parts = [];
      if (ex.distance != null) parts.push(formatDistance(ex.distance));
      if (ex.duration != null) parts.push(formatDuration(ex.duration));
      if (ex.pace != null) parts.push(window.Utils.formatPace(ex.pace));
      return `
        <div class="exercise-detail">
          <strong>${ex.name}</strong>
          <span class="exercise-meta-line">${parts.join(' · ')}</span>
        </div>`;
    }

    // Flexibility / HIIT: just name + optional duration
    const dur = ex.duration ? ` — ${formatDuration(ex.duration)}` : '';
    return `
      <div class="exercise-detail">
        <strong>${ex.name}</strong>${dur}
      </div>`;
  }

  /* ── Workout Item ──────────────────────────────────────────────────────── */

  function renderWorkoutItem(w) {
    const type = Types[w.type] || { label: w.type, icon: '🏋️' };
    const isExpanded = expandedId === w.id;

    const meta = [
      formatRelative(w.date),
      w.duration ? formatDuration(w.duration) : null,
      w.caloriesBurned ? `${formatNumber(w.caloriesBurned)} cal` : null,
    ].filter(Boolean).join(' · ');

    let details = '';
    if (isExpanded) {
      const exercises = (w.exercises || []).map(ex => renderExerciseDetail(ex, w.type)).join('');
      const notes = w.notes ? `<div class="workout-notes"><em>${w.notes}</em></div>` : '';
      details = `
        <div class="workout-exercises">
          ${exercises}
          ${notes}
          <div class="divider"></div>
          <button class="btn-danger btn-sm" data-delete="${w.id}">Delete Workout</button>
        </div>`;
    }

    return `
      <div class="workout-item${isExpanded ? ' expanded' : ''}" data-id="${w.id}">
        <div class="workout-item-header" data-toggle="${w.id}">
          <div class="workout-item-title">
            <span class="workout-name">${w.name || 'Workout'}</span>
            <span class="workout-type-badge">${type.icon} ${type.label}</span>
          </div>
          <div class="workout-meta">${meta}</div>
        </div>
        ${details}
      </div>`;
  }

  /* ── Workout List ──────────────────────────────────────────────────────── */

  function renderWorkoutList(workouts) {
    if (!workouts.length) {
      return `
        <div class="empty-state">
          <span class="empty-state-icon">📋</span>
          <p>No workouts found.</p>
          <p class="empty-state-sub">Try a different filter or log a new workout!</p>
        </div>`;
    }

    return workouts.map(renderWorkoutItem).join('');
  }

  /* ── Personal Records Card ─────────────────────────────────────────────── */

  function renderPRs(prs) {
    if (!prs.length) return '';

    const rows = prs.map(pr => `
      <div class="pr-row">
        <span class="pr-name">${pr.name}</span>
        <span class="badge badge--accent">PR</span>
        <span class="pr-weight">${formatWeight(pr.weight)}</span>
        <span class="pr-date">${formatDateShort(pr.date)}</span>
      </div>`).join('');

    return `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">🏆 Personal Records</h3>
        </div>
        <div class="card-body">${rows}</div>
      </div>`;
  }

  /* ── Stats Summary ─────────────────────────────────────────────────────── */

  function renderStats(stats) {
    return `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${formatNumber(stats.count)}</div>
          <div class="stat-label">Workouts</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatDuration(stats.duration)}</div>
          <div class="stat-label">Total Time</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatNumber(stats.calories)}</div>
          <div class="stat-label">Calories</div>
        </div>
      </div>`;
  }

  /* ── Main Render ───────────────────────────────────────────────────────── */

  function render() {
    const container = $('#page-history .page-content');
    if (!container) return;

    const allWorkouts    = Storage.getWorkouts();
    const monthWorkouts  = workoutsForMonth(allWorkouts, currentYear, currentMonth);
    const dates          = workoutDatesSet(allWorkouts);
    const stats          = computeStats(monthWorkouts);
    const prs            = computePRs(allWorkouts);

    // Determine visible workouts
    let visible;
    if (selectedDate) {
      visible = allWorkouts.filter(w => w.date === selectedDate);
    } else {
      visible = monthWorkouts;
    }
    visible = sortDesc(filterWorkouts(visible));

    const markup = `
      ${renderStats(stats)}
      ${renderCalendar(dates)}
      ${renderFilterBar()}
      <div class="workout-list">
        ${renderWorkoutList(visible)}
      </div>
      ${renderPRs(prs)}
    `;

    html(container, markup);
    bindEvents(container);
  }

  /* ── Event Binding ─────────────────────────────────────────────────────── */

  function bindEvents(root) {
    // Calendar nav
    root.addEventListener('click', function handler(e) {
      const calBtn = e.target.closest('[data-cal]');
      if (calBtn) {
        const dir = calBtn.dataset.cal;
        if (dir === 'prev') {
          currentMonth--;
          if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        } else {
          currentMonth++;
          if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        }
        selectedDate = null;
        render();
        return;
      }

      // Day click
      const dayEl = e.target.closest('.calendar-day');
      if (dayEl && dayEl.dataset.date) {
        selectedDate = selectedDate === dayEl.dataset.date ? null : dayEl.dataset.date;
        render();
        return;
      }

      // Filter pill
      const pill = e.target.closest('.filter-pill');
      if (pill) {
        activeFilter = pill.dataset.filter;
        render();
        return;
      }

      // Expand / collapse workout
      const toggle = e.target.closest('[data-toggle]');
      if (toggle) {
        const id = toggle.dataset.toggle;
        expandedId = expandedId === id ? null : id;
        render();
        return;
      }

      // Delete workout
      const delBtn = e.target.closest('[data-delete]');
      if (delBtn) {
        const id = delBtn.dataset.delete;
        if (confirm('Delete this workout? This cannot be undone.')) {
          Storage.deleteWorkout(id);
          expandedId = null;
          toast('Workout deleted', 'success');
          render();
        }
        return;
      }
    });
  }

  /* ── Init ───────────────────────────────────────────────────────────────── */

  function init() {
    currentMonth = new Date().getMonth();
    currentYear  = new Date().getFullYear();
    selectedDate = null;
    activeFilter = 'all';
    expandedId   = null;
    render();
  }

  /* ── Export ─────────────────────────────────────────────────────────────── */

  window.History = { init, render };
})();
