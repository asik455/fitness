(function () {
  'use strict';

  const Storage = window.Storage;
  const Utils = window.Utils;
  const $ = Utils.$;
  const $$ = Utils.$$;

  /* ─── Goal type metadata ─── */

  const GOAL_TYPES = {
    weight: { label: 'Weight Target', unit: 'kg', icon: '⚖️', badge: 'Weight' },
    workouts: { label: 'Workout Frequency', unit: '/month', icon: '🏋️', badge: 'Workouts' },
    strength: { label: 'Strength PR', unit: 'kg', icon: '💪', badge: 'Strength' },
    cardio: { label: 'Cardio Distance', unit: 'km', icon: '🏃', badge: 'Cardio' }
  };

  /* ─── Progress ring SVG helper ─── */

  function createProgressRing(percent, size) {
    size = size || 60;
    var clamped = Math.min(100, Math.max(0, percent));
    var radius = (size - 8) / 2;
    var circumference = 2 * Math.PI * radius;
    var offset = circumference - (clamped / 100) * circumference;
    return '<svg class="progress-ring" width="' + size + '" height="' + size + '">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + radius + '" ' +
        'stroke="var(--bg-elevated)" stroke-width="4" fill="none"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + radius + '" ' +
        'stroke="var(--accent)" stroke-width="4" fill="none" ' +
        'stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '" ' +
        'stroke-linecap="round" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')" ' +
        'style="transition: stroke-dashoffset 1s ease"/>' +
      '<text x="50%" y="50%" text-anchor="middle" dy=".35em" ' +
        'fill="var(--text-primary)" font-size="' + size / 5 + '" font-weight="600">' +
        Math.round(clamped) + '%</text>' +
    '</svg>';
  }

  /* ─── Auto-calculate current value ─── */

  function calculateCurrent(goal) {
    if (goal.type === 'workouts') {
      var workouts = Storage.getWorkouts();
      var now = new Date();
      var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return workouts.filter(function (w) {
        return new Date(w.date) >= monthStart;
      }).length;
    }

    if (goal.type === 'weight') {
      var latest = Storage.getLatestMetric();
      return latest && latest.weight ? latest.weight : goal.current || 0;
    }

    // strength & cardio — manual
    return goal.current || 0;
  }

  /* ─── Compute progress percentage ─── */

  function computePercent(goal) {
    var current = calculateCurrent(goal);
    if (!goal.target || goal.target === 0) return 0;

    // Weight target: progress is how close we've moved toward goal from start
    if (goal.type === 'weight' && goal.startValue !== undefined) {
      var totalDelta = Math.abs(goal.target - goal.startValue);
      if (totalDelta === 0) return 100;
      var currentDelta = Math.abs(current - goal.startValue);
      // Make sure we're moving in the right direction
      var direction = goal.target > goal.startValue ? 1 : -1;
      var moved = (current - goal.startValue) * direction;
      return Math.min(100, Math.max(0, (moved / totalDelta) * 100));
    }

    return Math.min(100, (current / goal.target) * 100);
  }

  /* ─── Render a single goal card ─── */

  function renderGoalCard(goal) {
    var current = calculateCurrent(goal);
    var percent = computePercent(goal);
    var meta = GOAL_TYPES[goal.type] || GOAL_TYPES.workouts;
    var deadlineStr = goal.deadline ? Utils.formatDate(goal.deadline) : '—';
    var showComplete = percent >= 95;

    return '<div class="goal-card card" data-goal-id="' + goal.id + '">' +
      '<div class="goal-card-body">' +
        '<div class="goal-card-ring">' +
          createProgressRing(percent) +
        '</div>' +
        '<div class="goal-card-details">' +
          '<div class="goal-card-header">' +
            '<h3 class="goal-card-title">' + escapeHtml(goal.title) + '</h3>' +
            '<span class="badge">' + meta.badge + '</span>' +
          '</div>' +
          '<div class="goal-card-meta">' +
            '<span class="goal-card-values">' +
              '<strong>' + formatValue(current, meta.unit) + '</strong> / ' +
              formatValue(goal.target, meta.unit) +
            '</span>' +
            '<span class="goal-card-deadline">📅 ' + deadlineStr + '</span>' +
          '</div>' +
          '<div class="goal-progress-bar">' +
            '<div class="goal-progress-fill" style="width:' + Math.min(100, percent) + '%"></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="goal-card-actions">' +
        (showComplete
          ? '<button class="btn btn-primary btn-sm goal-complete-btn" data-id="' + goal.id + '">✓ Complete</button>'
          : '') +
        '<button class="btn btn-ghost btn-sm btn-danger goal-delete-btn" data-id="' + goal.id + '">🗑 Delete</button>' +
      '</div>' +
    '</div>';
  }

  /* ─── Render completed goal card ─── */

  function renderCompletedCard(goal) {
    var meta = GOAL_TYPES[goal.type] || GOAL_TYPES.workouts;
    var completedDate = goal.completedAt ? Utils.formatDate(goal.completedAt) : '';

    return '<div class="goal-card card goal-card--completed" data-goal-id="' + goal.id + '">' +
      '<div class="goal-card-body">' +
        '<div class="goal-card-ring">' +
          '<div class="goal-check-icon">✅</div>' +
        '</div>' +
        '<div class="goal-card-details">' +
          '<div class="goal-card-header">' +
            '<h3 class="goal-card-title">' + escapeHtml(goal.title) + '</h3>' +
            '<span class="badge">' + meta.badge + '</span>' +
          '</div>' +
          '<div class="goal-card-meta">' +
            '<span class="goal-card-values">' + formatValue(goal.target, meta.unit) + ' achieved</span>' +
            '<span class="goal-card-deadline">Completed ' + completedDate + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ─── Helpers ─── */

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  function formatValue(val, unit) {
    if (val === undefined || val === null) return '0' + unit;
    return Number(val).toLocaleString() + unit;
  }

  function checkAchievement(key) {
    if (window.AchievementDefs && window.AchievementDefs.check) {
      window.AchievementDefs.check(key);
    }
  }

  /* ─── Auto-generate title ─── */

  function autoTitle(type, extra) {
    switch (type) {
      case 'weight': return 'Reach ' + (extra.target || '??') + ' kg';
      case 'workouts': return (extra.target || '??') + ' workouts/month';
      case 'strength': return (extra.exercise || 'Lift') + ' ' + (extra.target || '??') + ' kg';
      case 'cardio': return 'Run ' + (extra.target || '??') + ' km';
      default: return 'New Goal';
    }
  }

  /* ─── Create Add-Goal Modal ─── */

  function createGoalModal() {
    if ($('#modal-goal')) return;

    var modalHtml =
      '<div id="modal-goal" class="modal">' +
        '<div class="modal-content">' +
          '<div class="modal-header">' +
            '<h2>Set a New Goal</h2>' +
            '<button class="modal-close-btn" data-close-modal="modal-goal">&times;</button>' +
          '</div>' +
          '<div class="modal-body">' +
            '<div class="form-group">' +
              '<label class="form-label" for="goal-type">Goal Type</label>' +
              '<select class="form-select" id="goal-type">' +
                '<option value="weight">⚖️ Weight Target</option>' +
                '<option value="workouts">🏋️ Workout Frequency</option>' +
                '<option value="strength">💪 Strength PR</option>' +
                '<option value="cardio">🏃 Cardio Distance</option>' +
              '</select>' +
            '</div>' +
            '<div id="goal-dynamic-fields"></div>' +
            '<div class="form-group">' +
              '<label class="form-label" for="goal-title">Goal Title</label>' +
              '<input class="form-input" type="text" id="goal-title" placeholder="Auto-generated title">' +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label" for="goal-deadline">Deadline</label>' +
              '<input class="form-input" type="date" id="goal-deadline">' +
            '</div>' +
          '</div>' +
          '<div class="modal-footer">' +
            '<button class="btn btn-secondary" data-close-modal="modal-goal">Cancel</button>' +
            '<button class="btn btn-primary" id="goal-save-btn">Save Goal</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Wire up type selector to swap dynamic fields
    var typeSelect = $('#goal-type');
    typeSelect.addEventListener('change', function () {
      renderDynamicFields(typeSelect.value);
      updateAutoTitle();
    });

    // Initial render of dynamic fields
    renderDynamicFields(typeSelect.value);

    // Save handler
    $('#goal-save-btn').addEventListener('click', handleSaveGoal);

    // Close button
    var closeBtn = document.querySelector('[data-close-modal="modal-goal"]');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        Utils.closeModal('modal-goal');
      });
    }
    // Also close on cancel
    var cancelBtns = document.querySelectorAll('#modal-goal [data-close-modal="modal-goal"]');
    cancelBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        Utils.closeModal('modal-goal');
      });
    });
  }

  /* ─── Dynamic fields per goal type ─── */

  function renderDynamicFields(type) {
    var container = $('#goal-dynamic-fields');
    if (!container) return;

    var html = '';

    switch (type) {
      case 'weight':
        html =
          '<div class="form-group">' +
            '<label class="form-label" for="goal-target-weight">Target Weight (kg)</label>' +
            '<input class="form-input" type="number" id="goal-target-weight" min="1" step="0.1" placeholder="e.g. 75">' +
          '</div>';
        break;

      case 'workouts':
        html =
          '<div class="form-group">' +
            '<label class="form-label" for="goal-target-count">Target Workouts per Month</label>' +
            '<input class="form-input" type="number" id="goal-target-count" min="1" step="1" placeholder="e.g. 20">' +
          '</div>';
        break;

      case 'strength':
        html =
          '<div class="form-group">' +
            '<label class="form-label" for="goal-exercise">Exercise Name</label>' +
            '<input class="form-input" type="text" id="goal-exercise" placeholder="e.g. Bench Press">' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label" for="goal-target-strength">Target Weight (kg)</label>' +
            '<input class="form-input" type="number" id="goal-target-strength" min="1" step="0.5" placeholder="e.g. 100">' +
          '</div>';
        break;

      case 'cardio':
        html =
          '<div class="form-group">' +
            '<label class="form-label" for="goal-target-distance">Target Distance (km)</label>' +
            '<input class="form-input" type="number" id="goal-target-distance" min="0.1" step="0.1" placeholder="e.g. 10">' +
          '</div>';
        break;
    }

    Utils.html(container, html);

    // Listen for changes on new fields to auto-update title
    var inputs = container.querySelectorAll('input');
    inputs.forEach(function (inp) {
      inp.addEventListener('input', updateAutoTitle);
    });
  }

  /* ─── Auto-update title from fields ─── */

  function updateAutoTitle() {
    var titleInput = $('#goal-title');
    if (!titleInput) return;

    var type = $('#goal-type').value;
    var extra = readDynamicValues(type);

    // Only auto-fill if user hasn't manually typed something different
    var generated = autoTitle(type, extra);
    if (!titleInput.dataset.userEdited) {
      titleInput.value = generated;
    }
  }

  /* ─── Read dynamic field values ─── */

  function readDynamicValues(type) {
    var vals = { target: 0, exercise: '' };

    switch (type) {
      case 'weight':
        var tw = $('#goal-target-weight');
        vals.target = tw ? parseFloat(tw.value) || 0 : 0;
        break;
      case 'workouts':
        var tc = $('#goal-target-count');
        vals.target = tc ? parseInt(tc.value, 10) || 0 : 0;
        break;
      case 'strength':
        var ex = $('#goal-exercise');
        var ts = $('#goal-target-strength');
        vals.exercise = ex ? ex.value : '';
        vals.target = ts ? parseFloat(ts.value) || 0 : 0;
        break;
      case 'cardio':
        var td = $('#goal-target-distance');
        vals.target = td ? parseFloat(td.value) || 0 : 0;
        break;
    }

    return vals;
  }

  /* ─── Save goal handler ─── */

  function handleSaveGoal() {
    var type = $('#goal-type').value;
    var titleInput = $('#goal-title');
    var deadlineInput = $('#goal-deadline');
    var dynVals = readDynamicValues(type);

    if (!dynVals.target || dynVals.target <= 0) {
      Utils.toast('Please enter a valid target value.', 'error');
      return;
    }

    var title = (titleInput.value || '').trim() || autoTitle(type, dynVals);
    var deadline = deadlineInput.value || null;

    // Build start value for weight goals
    var startValue;
    if (type === 'weight') {
      var latest = Storage.getLatestMetric();
      startValue = latest && latest.weight ? latest.weight : 0;
    }

    var goal = {
      id: Storage.uid(),
      type: type,
      title: title,
      target: dynVals.target,
      current: 0,
      exercise: dynVals.exercise || null,
      deadline: deadline,
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString()
    };

    if (startValue !== undefined) {
      goal.startValue = startValue;
    }

    Storage.saveGoal(goal);
    Utils.closeModal('modal-goal');
    render();
    Utils.toast('Goal created! 🎯', 'success');
    checkAchievement('first_goal');

    // Reset form
    resetGoalForm();
  }

  /* ─── Reset modal form ─── */

  function resetGoalForm() {
    var typeSelect = $('#goal-type');
    if (typeSelect) typeSelect.value = 'weight';
    var titleInput = $('#goal-title');
    if (titleInput) {
      titleInput.value = '';
      delete titleInput.dataset.userEdited;
    }
    var deadlineInput = $('#goal-deadline');
    if (deadlineInput) deadlineInput.value = '';
    renderDynamicFields('weight');
  }

  /* ─── Complete a goal ─── */

  function completeGoal(id) {
    var goals = Storage.getGoals();
    var goal = goals.find(function (g) { return g.id === id; });
    if (!goal) return;

    goal.completed = true;
    goal.completedAt = new Date().toISOString();
    Storage.updateGoal(goal);

    Utils.toast('Goal completed! 🎉', 'success');
    Utils.confetti();
    checkAchievement('goal_completed');
    render();
  }

  /* ─── Delete a goal ─── */

  function deleteGoal(id) {
    if (!confirm('Delete this goal?')) return;
    Storage.deleteGoal(id);
    Utils.toast('Goal deleted.', 'info');
    render();
  }

  /* ─── Event delegation ─── */

  function bindEvents(container) {
    container.addEventListener('click', function (e) {
      var target = e.target;

      // Complete button
      var completeBtn = target.closest('.goal-complete-btn');
      if (completeBtn) {
        completeGoal(completeBtn.dataset.id);
        return;
      }

      // Delete button
      var deleteBtn = target.closest('.goal-delete-btn');
      if (deleteBtn) {
        deleteGoal(deleteBtn.dataset.id);
        return;
      }

      // Add goal (empty state or header)
      var addBtn = target.closest('.goal-add-btn');
      if (addBtn) {
        openGoalModal();
        return;
      }

      // Toggle completed section
      var toggleBtn = target.closest('.completed-toggle');
      if (toggleBtn) {
        var section = toggleBtn.closest('.completed-section');
        if (section) {
          section.classList.toggle('expanded');
          var arrow = toggleBtn.querySelector('.toggle-arrow');
          if (arrow) {
            arrow.textContent = section.classList.contains('expanded') ? '▼' : '▶';
          }
        }
        return;
      }
    });
  }

  /* ─── Check for newly completed goals (auto-complete on 100%) ─── */

  function checkAutoComplete(goals) {
    goals.forEach(function (goal) {
      if (goal.completed) return;
      var percent = computePercent(goal);
      if (percent >= 100) {
        goal.completed = true;
        goal.completedAt = new Date().toISOString();
        Storage.updateGoal(goal);
        Utils.toast('Goal completed! 🎉', 'success');
        Utils.confetti();
        checkAchievement('goal_completed');
      }
    });
  }

  /* ─── Render ─── */

  function render() {
    var container = $('#page-goals .page-content');
    if (!container) return;

    var goals = Storage.getGoals();

    // Auto-update current values and check completions
    goals.forEach(function (goal) {
      if (!goal.completed) {
        var current = calculateCurrent(goal);
        if (current !== goal.current) {
          goal.current = current;
          Storage.updateGoal(goal);
        }
      }
    });

    checkAutoComplete(goals);

    // Refresh after possible auto-completes
    goals = Storage.getGoals();

    var active = goals.filter(function (g) { return !g.completed; });
    var completed = goals.filter(function (g) { return g.completed; });

    // No goals — empty state
    if (goals.length === 0) {
      Utils.html(container, renderEmptyState());
      bindEvents(container);
      return;
    }

    var html = '';

    // Header
    html += '<div class="card-header">' +
      '<h2 class="card-title">Your Goals</h2>' +
      '<button class="btn btn-primary btn-sm goal-add-btn">+ New Goal</button>' +
    '</div>';

    // Active goals
    if (active.length > 0) {
      html += '<div class="goals-active">';
      active.forEach(function (g) {
        html += renderGoalCard(g);
      });
      html += '</div>';
    } else {
      html += '<p style="text-align:center;color:var(--text-secondary);padding:1.5rem 0;">No active goals. Set one!</p>';
    }

    // Completed goals
    if (completed.length > 0) {
      html += '<div class="divider"></div>';
      html += '<div class="completed-section">';
      html += '<button class="completed-toggle">' +
        '<span class="toggle-arrow">▶</span> Completed Goals (' + completed.length + ')' +
      '</button>';
      html += '<div class="completed-list">';
      completed.forEach(function (g) {
        html += renderCompletedCard(g);
      });
      html += '</div>';
      html += '</div>';
    }

    Utils.html(container, html);
    bindEvents(container);
  }

  /* ─── Empty state ─── */

  function renderEmptyState() {
    return '<div class="empty-state">' +
      '<div class="empty-state-icon">🎯</div>' +
      '<p class="empty-state-text">No goals yet. Set a target and start crushing it!</p>' +
      '<button class="btn btn-primary goal-add-btn">Set Your First Goal</button>' +
    '</div>';
  }

  /* ─── Open modal ─── */

  function openGoalModal() {
    createGoalModal();
    resetGoalForm();

    // Mark title field for auto-fill tracking
    var titleInput = $('#goal-title');
    if (titleInput) {
      delete titleInput.dataset.userEdited;
      titleInput.addEventListener('input', function () {
        titleInput.dataset.userEdited = 'true';
      });
    }

    // Set default deadline to 30 days from now
    var deadlineInput = $('#goal-deadline');
    if (deadlineInput && !deadlineInput.value) {
      var d = new Date();
      d.setDate(d.getDate() + 30);
      deadlineInput.value = d.toISOString().split('T')[0];
    }

    Utils.openModal('modal-goal');
    updateAutoTitle();
  }

  /* ─── Init ─── */

  function init() {
    createGoalModal();
    render();
  }

  /* ─── Public API ─── */

  window.Goals = {
    init: init,
    render: render,
    openGoalModal: openGoalModal
  };
})();
