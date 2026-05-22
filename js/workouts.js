// ─── APEX Fitness · Workouts Module ───────────────────────────────────────────
// Manages workout logging, templates, exercise picker, timers.
// Attaches to window.Workouts

(function () {
  'use strict';

  const { $, $$, html, toast, openModal, closeModal, formatDuration, createElement } = window.Utils;
  const Storage = window.Storage;
  const ExerciseLibrary = window.ExerciseLibrary;
  const WorkoutTypes = window.WorkoutTypes;

  /* ── Constants ──────────────────────────────────────────────────────────── */

  const CAL_RATES = { strength: 7, cardio: 10, flexibility: 3.5, hiit: 12 };
  const REST_OPTIONS = [30, 60, 90, 120]; // seconds

  /* ── State ──────────────────────────────────────────────────────────────── */

  let currentExercises = [];   // exercises in the active workout form
  let workoutTimerStart = null;
  let workoutTimerInterval = null;
  let restTimerInterval = null;
  let activeCategory = 'strength'; // exercise picker tab

  /* ══════════════════════════════════════════════════════════════════════════
     INIT – inject modal HTML, bind static listeners
     ══════════════════════════════════════════════════════════════════════════ */

  function init() {
    _injectWorkoutModal();
    _injectExercisePickerModal();
    _injectRestTimerOverlay();
    _bindStaticListeners();
  }

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER – main workouts page (templates + quick-start)
     ══════════════════════════════════════════════════════════════════════════ */

  function render() {
    const container = $('#page-workouts .page-content');
    if (!container) return;

    const templates = Storage.getTemplates();

    const typeBtns = Object.entries(WorkoutTypes)
      .map(([key, t]) => `<button class="btn btn-secondary" data-start-type="${key}">${t.icon} ${t.label}</button>`)
      .join('');

    const templateCards = templates.map(t => {
      const meta = WorkoutTypes[t.type] || WorkoutTypes.strength;
      return `
        <div class="template-card" data-template-id="${t.id}">
          <div class="template-card__header">
            <span class="template-card__name">${_esc(t.name)}</span>
            <span class="badge badge--${t.type}">${meta.icon} ${meta.label}</span>
          </div>
          <div class="template-card__meta">${t.exercises.length} exercise${t.exercises.length !== 1 ? 's' : ''}</div>
          <button class="btn btn-ghost btn-sm template-delete" data-delete-tpl="${t.id}" title="Delete template">✕</button>
        </div>`;
    }).join('');

    html(container, `
      <section class="workouts-section">
        <h2 class="section-title">Quick Start</h2>
        <div class="quick-start-grid">
          <button class="btn btn-primary btn-block" id="btn-empty-workout">🏋️ Start Empty Workout</button>
          <div class="type-selector">${typeBtns}</div>
        </div>
      </section>

      <section class="workouts-section">
        <div class="section-header">
          <h2 class="section-title">Templates</h2>
          <button class="btn btn-secondary btn-sm" id="btn-create-template">+ Create Template</button>
        </div>
        <div class="templates-grid">
          ${templateCards || '<p class="empty-text">No templates yet. Create one to get started!</p>'}
        </div>
      </section>
    `);

    _bindPageListeners(container);
  }

  /* ══════════════════════════════════════════════════════════════════════════
     WORKOUT MODAL – HTML injection
     ══════════════════════════════════════════════════════════════════════════ */

  function _injectWorkoutModal() {
    if ($('#modal-workout')) return;

    const typeOptions = Object.entries(WorkoutTypes)
      .map(([k, t]) => `<option value="${k}">${t.icon} ${t.label}</option>`)
      .join('');

    const modalEl = createElement('div', { id: 'modal-workout', className: 'modal' }, `
      <div class="modal-content modal-content--lg">
        <div class="modal-header">
          <h3 class="modal-title">Log Workout</h3>
          <span class="workout-timer" id="workout-timer" style="display:none;">00:00</span>
          <button class="btn btn-ghost btn-sm modal-close" data-close="modal-workout">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-row form-row--3">
            <div class="form-group">
              <label class="form-label">Workout Name</label>
              <input type="text" class="form-input" id="wo-name" placeholder="e.g. Push Day">
            </div>
            <div class="form-group">
              <label class="form-label">Type</label>
              <select class="form-select" id="wo-type">${typeOptions}</select>
            </div>
            <div class="form-group">
              <label class="form-label">Date</label>
              <input type="date" class="form-input" id="wo-date">
            </div>
          </div>

          <div class="exercise-list" id="exercise-list">
            <!-- exercises rendered dynamically -->
          </div>

          <button class="btn btn-secondary btn-block" id="btn-add-exercise">+ Add Exercise</button>

          <div class="form-row form-row--3" style="margin-top:1rem;">
            <div class="form-group">
              <label class="form-label">Duration (min)</label>
              <input type="number" class="form-input" id="wo-duration" min="0" placeholder="0">
            </div>
            <div class="form-group">
              <label class="form-label">Calories Burned</label>
              <div class="input-with-action">
                <input type="number" class="form-input" id="wo-calories" min="0" placeholder="0">
                <button class="btn btn-ghost btn-sm" id="btn-estimate-cal" title="Estimate calories">⚡ Est</button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Notes</label>
              <textarea class="form-textarea" id="wo-notes" rows="2" placeholder="How did it go?"></textarea>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-close="modal-workout">Cancel</button>
          <button class="btn btn-primary" id="btn-save-workout">💾 Save Workout</button>
        </div>
      </div>
    `);

    document.body.appendChild(modalEl);
  }

  /* ══════════════════════════════════════════════════════════════════════════
     EXERCISE PICKER MODAL – HTML injection
     ══════════════════════════════════════════════════════════════════════════ */

  function _injectExercisePickerModal() {
    if ($('#modal-exercise-picker')) return;

    const tabs = Object.entries(WorkoutTypes)
      .map(([k, t], i) =>
        `<button class="tab-btn${i === 0 ? ' active' : ''}" data-picker-tab="${k}">${t.icon} ${t.label}</button>`)
      .join('');

    const modalEl = createElement('div', { id: 'modal-exercise-picker', className: 'modal' }, `
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">Add Exercise</h3>
          <button class="btn btn-ghost btn-sm modal-close" data-close="modal-exercise-picker">✕</button>
        </div>
        <div class="modal-body exercise-picker">
          <div class="tabs">
            <div class="tab-list">${tabs}</div>
          </div>
          <input type="text" class="form-input" id="exercise-search" placeholder="Search exercises…" style="margin:0.75rem 0;">
          <div class="exercise-options" id="exercise-options"></div>
          <button class="btn btn-ghost btn-block" id="btn-custom-exercise" style="margin-top:0.75rem;">✏️ Custom Exercise</button>
        </div>
      </div>
    `);

    document.body.appendChild(modalEl);
  }

  /* ══════════════════════════════════════════════════════════════════════════
     REST TIMER OVERLAY
     ══════════════════════════════════════════════════════════════════════════ */

  function _injectRestTimerOverlay() {
    if ($('#rest-timer-overlay')) return;

    const btns = REST_OPTIONS.map(s => `<button class="btn btn-secondary" data-rest="${s}">${s}s</button>`).join('');

    const overlay = createElement('div', { id: 'rest-timer-overlay', className: 'rest-timer', style: 'display:none;' }, `
      <div class="rest-timer__content">
        <h3>Rest Timer</h3>
        <div class="rest-timer__display" id="rest-timer-display">00:00</div>
        <div class="rest-timer__buttons">${btns}</div>
        <button class="btn btn-danger btn-sm" id="btn-cancel-rest">Cancel</button>
      </div>
    `);

    document.body.appendChild(overlay);
  }

  /* ══════════════════════════════════════════════════════════════════════════
     STATIC LISTENERS (modals – bound once)
     ══════════════════════════════════════════════════════════════════════════ */

  function _bindStaticListeners() {
    // Close buttons (delegated on body for dynamically-added modals)
    document.body.addEventListener('click', e => {
      const closeBtn = e.target.closest('[data-close]');
      if (closeBtn) {
        const id = closeBtn.dataset.close;
        if (id === 'modal-workout') closeWorkoutModal();
        else closeModal(id);
      }
    });

    // Save workout
    document.body.addEventListener('click', e => {
      if (e.target.closest('#btn-save-workout')) _saveWorkout();
    });

    // Add exercise (open picker)
    document.body.addEventListener('click', e => {
      if (e.target.closest('#btn-add-exercise')) _openExercisePicker();
    });

    // Estimate calories
    document.body.addEventListener('click', e => {
      if (e.target.closest('#btn-estimate-cal')) _estimateCalories();
    });

    // Exercise picker – tab switch
    document.body.addEventListener('click', e => {
      const tab = e.target.closest('[data-picker-tab]');
      if (tab) {
        activeCategory = tab.dataset.pickerTab;
        $$('.tab-btn', $('#modal-exercise-picker')).forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        _renderExerciseOptions();
      }
    });

    // Exercise picker – search
    document.body.addEventListener('input', e => {
      if (e.target.id === 'exercise-search') _renderExerciseOptions();
    });

    // Exercise picker – select exercise
    document.body.addEventListener('click', e => {
      const opt = e.target.closest('.exercise-option');
      if (opt) {
        const name = opt.dataset.exerciseName;
        const cat = opt.dataset.exerciseCategory;
        _addExercise(name, cat);
        closeModal('modal-exercise-picker');
      }
    });

    // Custom exercise
    document.body.addEventListener('click', e => {
      if (e.target.closest('#btn-custom-exercise')) {
        const name = prompt('Enter custom exercise name:');
        if (name && name.trim()) {
          const type = $('#wo-type') ? $('#wo-type').value : 'strength';
          _addExercise(name.trim(), type);
          closeModal('modal-exercise-picker');
        }
      }
    });

    // Delegated: add set, delete exercise, rest timer
    document.body.addEventListener('click', e => {
      const addSet = e.target.closest('[data-add-set]');
      if (addSet) {
        const idx = parseInt(addSet.dataset.addSet, 10);
        _addSet(idx);
        return;
      }

      const delEx = e.target.closest('[data-delete-exercise]');
      if (delEx) {
        const idx = parseInt(delEx.dataset.deleteExercise, 10);
        _removeExercise(idx);
        return;
      }

      const restBtn = e.target.closest('[data-rest]');
      if (restBtn) {
        _startRestTimer(parseInt(restBtn.dataset.rest, 10));
        return;
      }

      if (e.target.closest('#btn-cancel-rest')) {
        _cancelRestTimer();
        return;
      }

      const restTrigger = e.target.closest('[data-rest-trigger]');
      if (restTrigger) {
        _showRestTimerOverlay();
      }
    });

    // Click outside modal to close
    document.body.addEventListener('click', e => {
      if (e.target.classList.contains('modal') && e.target.classList.contains('active')) {
        if (e.target.id === 'modal-workout') closeWorkoutModal();
        else closeModal(e.target.id);
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     PAGE LISTENERS (re-bound each render)
     ══════════════════════════════════════════════════════════════════════════ */

  function _bindPageListeners(container) {
    // Start empty workout
    const btnEmpty = $('#btn-empty-workout', container);
    if (btnEmpty) btnEmpty.addEventListener('click', () => openWorkoutModal());

    // Type-specific quick start
    $$('[data-start-type]', container).forEach(btn => {
      btn.addEventListener('click', () => {
        openWorkoutModal(null, btn.dataset.startType);
      });
    });

    // Template click
    $$('.template-card', container).forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('.template-delete')) return;
        const tplId = card.dataset.templateId;
        const tpl = Storage.getTemplates().find(t => t.id === tplId);
        if (tpl) openWorkoutModal(tpl);
      });
    });

    // Template delete
    $$('[data-delete-tpl]', container).forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.deleteTpl;
        if (confirm('Delete this template?')) {
          Storage.deleteTemplate(id);
          toast('Template deleted', 'info');
          render();
        }
      });
    });

    // Create template
    const btnTpl = $('#btn-create-template', container);
    if (btnTpl) btnTpl.addEventListener('click', _createTemplate);
  }

  /* ══════════════════════════════════════════════════════════════════════════
     OPEN / CLOSE WORKOUT MODAL
     ══════════════════════════════════════════════════════════════════════════ */

  function openWorkoutModal(template, defaultType) {
    currentExercises = [];

    // Reset fields
    const nameInput = $('#wo-name');
    const typeSelect = $('#wo-type');
    const dateInput = $('#wo-date');
    const durInput = $('#wo-duration');
    const calInput = $('#wo-calories');
    const notesInput = $('#wo-notes');

    if (nameInput) nameInput.value = template ? template.name : '';
    if (typeSelect) typeSelect.value = template ? template.type : (defaultType || 'strength');
    if (dateInput) dateInput.value = Storage.today();
    if (durInput) durInput.value = '';
    if (calInput) calInput.value = '';
    if (notesInput) notesInput.value = '';

    // Pre-fill exercises from template
    if (template && template.exercises) {
      template.exercises.forEach(ex => {
        const entry = { name: ex.name, category: template.type, sets: [] };
        if (template.type === 'strength') {
          const numSets = ex.sets || 3;
          const reps = ex.reps || 10;
          for (let i = 0; i < numSets; i++) {
            entry.sets.push({ reps, weight: '' });
          }
        } else if (template.type === 'cardio') {
          entry.distance = ex.distance || '';
          entry.duration = ex.duration || '';
        } else {
          entry.duration = ex.duration || '';
        }
        currentExercises.push(entry);
      });
    }

    _renderExerciseList();
    _startWorkoutTimer();
    openModal('modal-workout');
  }

  function closeWorkoutModal() {
    _stopWorkoutTimer();
    closeModal('modal-workout');
    currentExercises = [];
  }

  /* ══════════════════════════════════════════════════════════════════════════
     EXERCISE LIST RENDERING
     ══════════════════════════════════════════════════════════════════════════ */

  function _renderExerciseList() {
    const list = $('#exercise-list');
    if (!list) return;

    if (currentExercises.length === 0) {
      html(list, '<p class="empty-text">No exercises added yet. Click "Add Exercise" to begin.</p>');
      return;
    }

    const type = $('#wo-type') ? $('#wo-type').value : 'strength';

    const items = currentExercises.map((ex, i) => {
      const category = ex.category || type;
      let body = '';

      if (category === 'strength') {
        body = _renderStrengthSets(ex, i);
      } else if (category === 'cardio') {
        body = _renderCardioInputs(ex, i);
      } else {
        body = _renderDurationInput(ex, i);
      }

      return `
        <div class="workout-item" data-exercise-index="${i}">
          <div class="workout-item__header">
            <span class="workout-item__name">${_esc(ex.name)}</span>
            <div class="workout-item__actions">
              <button class="btn btn-ghost btn-sm" data-rest-trigger title="Rest Timer">⏱️</button>
              <button class="btn btn-ghost btn-sm btn-danger" data-delete-exercise="${i}" title="Remove exercise">✕</button>
            </div>
          </div>
          <div class="workout-item__body">${body}</div>
        </div>`;
    }).join('');

    html(list, items);
    _bindExerciseInputs();
  }

  function _renderStrengthSets(ex, exIdx) {
    const header = `
      <div class="set-header">
        <span>Set</span><span>Reps</span><span>Weight (kg)</span><span></span>
      </div>`;

    const rows = (ex.sets || []).map((s, si) => `
      <div class="set-row">
        <span class="set-number">${si + 1}</span>
        <input type="number" class="form-input form-input--sm" data-ex="${exIdx}" data-set="${si}" data-field="reps" value="${s.reps || ''}" min="0" placeholder="0">
        <input type="number" class="form-input form-input--sm" data-ex="${exIdx}" data-set="${si}" data-field="weight" value="${s.weight || ''}" min="0" placeholder="0" step="0.5">
        <button class="btn btn-ghost btn-sm btn-danger" data-remove-set="${exIdx}-${si}" title="Remove set">✕</button>
      </div>`).join('');

    return `${header}${rows}
      <button class="btn btn-ghost btn-sm" data-add-set="${exIdx}">+ Add Set</button>`;
  }

  function _renderCardioInputs(ex, exIdx) {
    return `
      <div class="form-row form-row--2">
        <div class="form-group">
          <label class="form-label">Distance (km)</label>
          <input type="number" class="form-input" data-ex="${exIdx}" data-field="distance" value="${ex.distance || ''}" min="0" step="0.1" placeholder="0">
        </div>
        <div class="form-group">
          <label class="form-label">Duration (min)</label>
          <input type="number" class="form-input" data-ex="${exIdx}" data-field="duration" value="${ex.duration || ''}" min="0" placeholder="0">
        </div>
      </div>`;
  }

  function _renderDurationInput(ex, exIdx) {
    return `
      <div class="form-group">
        <label class="form-label">Duration (sec)</label>
        <input type="number" class="form-input" data-ex="${exIdx}" data-field="duration" value="${ex.duration || ''}" min="0" placeholder="0">
      </div>`;
  }

  /* ── Sync inputs back to state ─────────────────────────────────────────── */

  function _bindExerciseInputs() {
    // Set-level inputs (strength)
    $$('#exercise-list input[data-set]').forEach(input => {
      input.addEventListener('change', () => {
        const exIdx = parseInt(input.dataset.ex, 10);
        const setIdx = parseInt(input.dataset.set, 10);
        const field = input.dataset.field;
        const val = parseFloat(input.value) || 0;
        if (currentExercises[exIdx] && currentExercises[exIdx].sets[setIdx]) {
          currentExercises[exIdx].sets[setIdx][field] = val;
        }
      });
    });

    // Exercise-level inputs (cardio/flexibility/hiit)
    $$('#exercise-list input[data-field]:not([data-set])').forEach(input => {
      input.addEventListener('change', () => {
        const exIdx = parseInt(input.dataset.ex, 10);
        const field = input.dataset.field;
        const val = parseFloat(input.value) || 0;
        if (currentExercises[exIdx]) {
          currentExercises[exIdx][field] = val;
        }
      });
    });

    // Remove set
    $$('#exercise-list [data-remove-set]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [exIdx, setIdx] = btn.dataset.removeSet.split('-').map(Number);
        if (currentExercises[exIdx] && currentExercises[exIdx].sets) {
          currentExercises[exIdx].sets.splice(setIdx, 1);
          _renderExerciseList();
        }
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     ADD / REMOVE EXERCISES & SETS
     ══════════════════════════════════════════════════════════════════════════ */

  function _addExercise(name, category) {
    const entry = { name, category };
    if (category === 'strength') {
      entry.sets = [{ reps: '', weight: '' }];
    } else if (category === 'cardio') {
      entry.distance = '';
      entry.duration = '';
    } else {
      entry.duration = '';
    }
    currentExercises.push(entry);
    _renderExerciseList();
  }

  function _removeExercise(idx) {
    currentExercises.splice(idx, 1);
    _renderExerciseList();
  }

  function _addSet(exIdx) {
    const ex = currentExercises[exIdx];
    if (!ex || !ex.sets) return;

    // Pre-fill from last set
    const last = ex.sets[ex.sets.length - 1];
    const newSet = last
      ? { reps: last.reps || '', weight: last.weight || '' }
      : { reps: '', weight: '' };

    ex.sets.push(newSet);
    _renderExerciseList();
  }

  /* ══════════════════════════════════════════════════════════════════════════
     EXERCISE PICKER
     ══════════════════════════════════════════════════════════════════════════ */

  function _openExercisePicker() {
    activeCategory = 'strength';
    const searchInput = $('#exercise-search');
    if (searchInput) searchInput.value = '';

    // Reset tabs
    $$('#modal-exercise-picker .tab-btn').forEach((t, i) => {
      t.classList.toggle('active', i === 0);
    });

    _renderExerciseOptions();
    openModal('modal-exercise-picker');
  }

  function _renderExerciseOptions() {
    const container = $('#exercise-options');
    if (!container) return;

    const searchInput = $('#exercise-search');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const exercises = ExerciseLibrary[activeCategory] || [];

    const filtered = exercises.filter(ex =>
      ex.name.toLowerCase().includes(query) ||
      (ex.muscles && ex.muscles.some(m => m.toLowerCase().includes(query)))
    );

    if (filtered.length === 0) {
      html(container, '<p class="empty-text">No exercises found.</p>');
      return;
    }

    const items = filtered.map(ex => {
      const muscles = ex.muscles ? `<span class="exercise-option__muscles">${ex.muscles.join(', ')}</span>` : '';
      const unit = ex.unit ? `<span class="exercise-option__unit">${ex.unit}</span>` : '';
      return `
        <div class="exercise-option" data-exercise-name="${_esc(ex.name)}" data-exercise-category="${activeCategory}">
          <span class="exercise-option__name">${_esc(ex.name)}</span>
          ${muscles}${unit}
        </div>`;
    }).join('');

    html(container, items);
  }

  /* ══════════════════════════════════════════════════════════════════════════
     SAVE WORKOUT
     ══════════════════════════════════════════════════════════════════════════ */

  function _saveWorkout() {
    // Sync all inputs before saving
    _syncAllInputs();

    const name = ($('#wo-name') || {}).value || '';
    const type = ($('#wo-type') || {}).value || 'strength';
    const date = ($('#wo-date') || {}).value || Storage.today();
    const duration = parseInt(($('#wo-duration') || {}).value, 10) || 0;
    const calories = parseInt(($('#wo-calories') || {}).value, 10) || 0;
    const notes = ($('#wo-notes') || {}).value || '';

    // Validation
    if (!name.trim()) {
      toast('Please enter a workout name', 'error');
      const el = $('#wo-name');
      if (el) el.focus();
      return;
    }

    if (currentExercises.length === 0) {
      toast('Add at least one exercise', 'error');
      return;
    }

    // Build clean exercises array
    const exercises = currentExercises.map(ex => {
      const clean = { name: ex.name };
      if (ex.category === 'strength' && ex.sets) {
        clean.sets = ex.sets
          .filter(s => s.reps || s.weight)
          .map(s => ({ reps: Number(s.reps) || 0, weight: Number(s.weight) || 0 }));
      } else if (ex.category === 'cardio') {
        clean.distance = Number(ex.distance) || 0;
        clean.duration = Number(ex.duration) || 0;
        if (clean.distance && clean.duration) {
          clean.pace = +(clean.duration / clean.distance).toFixed(2);
        }
      } else {
        clean.duration = Number(ex.duration) || 0;
      }
      return clean;
    });

    const workout = {
      name: name.trim(),
      type,
      date,
      duration,
      caloriesBurned: calories,
      notes: notes.trim(),
      exercises,
    };

    Storage.saveWorkout(workout);
    toast('Workout saved! 💪', 'success');
    closeWorkoutModal();
    render();

    // Dispatch custom event so other modules can react
    window.dispatchEvent(new CustomEvent('workout-saved', { detail: workout }));
  }

  /** Read all DOM inputs back into currentExercises state before saving */
  function _syncAllInputs() {
    $$('#exercise-list input[data-set]').forEach(input => {
      const exIdx = parseInt(input.dataset.ex, 10);
      const setIdx = parseInt(input.dataset.set, 10);
      const field = input.dataset.field;
      const val = parseFloat(input.value) || 0;
      if (currentExercises[exIdx] && currentExercises[exIdx].sets && currentExercises[exIdx].sets[setIdx]) {
        currentExercises[exIdx].sets[setIdx][field] = val;
      }
    });

    $$('#exercise-list input[data-field]:not([data-set])').forEach(input => {
      const exIdx = parseInt(input.dataset.ex, 10);
      const field = input.dataset.field;
      const val = parseFloat(input.value) || 0;
      if (currentExercises[exIdx]) {
        currentExercises[exIdx][field] = val;
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     CALORIE ESTIMATION
     ══════════════════════════════════════════════════════════════════════════ */

  function _estimateCalories() {
    const type = ($('#wo-type') || {}).value || 'strength';
    const duration = parseInt(($('#wo-duration') || {}).value, 10);

    if (!duration || duration <= 0) {
      toast('Enter a duration first to estimate calories', 'info');
      return;
    }

    const rate = CAL_RATES[type] || 7;
    const estimate = Math.round(duration * rate);
    const calInput = $('#wo-calories');
    if (calInput) calInput.value = estimate;
    toast(`Estimated ~${estimate} cal for ${duration}min ${WorkoutTypes[type]?.label || type}`, 'info');
  }

  /* ══════════════════════════════════════════════════════════════════════════
     ACTIVE WORKOUT TIMER
     ══════════════════════════════════════════════════════════════════════════ */

  function _startWorkoutTimer() {
    _stopWorkoutTimer();
    workoutTimerStart = Date.now();
    const display = $('#workout-timer');
    if (display) display.style.display = 'inline-block';

    workoutTimerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - workoutTimerStart) / 1000);
      const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const secs = (elapsed % 60).toString().padStart(2, '0');
      if (display) display.textContent = `${mins}:${secs}`;
    }, 1000);
  }

  function _stopWorkoutTimer() {
    if (workoutTimerInterval) {
      clearInterval(workoutTimerInterval);
      workoutTimerInterval = null;
    }
    workoutTimerStart = null;
    const display = $('#workout-timer');
    if (display) {
      display.style.display = 'none';
      display.textContent = '00:00';
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     REST TIMER
     ══════════════════════════════════════════════════════════════════════════ */

  function _showRestTimerOverlay() {
    const overlay = $('#rest-timer-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
      const display = $('#rest-timer-display');
      if (display) display.textContent = '00:00';
    }
  }

  function _startRestTimer(seconds) {
    _cancelRestTimer();
    let remaining = seconds;
    const display = $('#rest-timer-display');
    const overlay = $('#rest-timer-overlay');

    if (overlay) overlay.style.display = 'flex';

    const _updateDisplay = () => {
      const m = Math.floor(remaining / 60).toString().padStart(2, '0');
      const s = (remaining % 60).toString().padStart(2, '0');
      if (display) display.textContent = `${m}:${s}`;
    };

    _updateDisplay();

    restTimerInterval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        _cancelRestTimer();
        toast('Rest over — let\'s go! 🔥', 'success');
      } else {
        _updateDisplay();
      }
    }, 1000);
  }

  function _cancelRestTimer() {
    if (restTimerInterval) {
      clearInterval(restTimerInterval);
      restTimerInterval = null;
    }
    const overlay = $('#rest-timer-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  /* ══════════════════════════════════════════════════════════════════════════
     CREATE TEMPLATE
     ══════════════════════════════════════════════════════════════════════════ */

  function _createTemplate() {
    const name = prompt('Template name:');
    if (!name || !name.trim()) return;

    const type = prompt('Type (strength / cardio / flexibility / hiit):', 'strength');
    if (!type || !WorkoutTypes[type]) {
      toast('Invalid type. Use: strength, cardio, flexibility, or hiit', 'error');
      return;
    }

    const exerciseStr = prompt('Enter exercise names separated by commas:');
    if (!exerciseStr || !exerciseStr.trim()) return;

    const exercises = exerciseStr.split(',').map(n => {
      const trimmed = n.trim();
      if (type === 'strength') return { name: trimmed, sets: 3, reps: 10 };
      if (type === 'cardio') return { name: trimmed, duration: 30 };
      return { name: trimmed, duration: 30 };
    });

    Storage.saveTemplate({ name: name.trim(), type, exercises });
    toast('Template created! 🎉', 'success');
    render();
  }

  /* ══════════════════════════════════════════════════════════════════════════
     HELPERS
     ══════════════════════════════════════════════════════════════════════════ */

  function _esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     EXPORT
     ══════════════════════════════════════════════════════════════════════════ */

  window.Workouts = {
    init,
    render,
    openWorkoutModal,
    closeWorkoutModal,
  };

})();
