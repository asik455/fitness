// ─── APEX Fitness · Body Metrics Module ───────────────────────────────────────
// Handles body metrics tracking, weight charting, BMI display, and metric logging.

(function () {
  'use strict';

  const { $, $$, html, toast, openModal, closeModal, formatDate, formatDateShort, formatWeight, formatNumber } = window.Utils;
  const Storage = window.Storage;

  const HEIGHT_CM = 175;
  const ACCENT = 'rgba(139,139,245,0.8)';
  const ACCENT_FILL_TOP = 'rgba(139,139,245,0.2)';
  const ACCENT_FILL_BOT = 'transparent';
  const GRID_COLOR = 'rgba(255,255,255,0.05)';
  const FONT_COLOR = '#8a8a95';

  let weightChart = null;
  let activeRange = 'All';

  /* ══════════════════════════════════════════════════════════════════════════
     Initialisation
  ══════════════════════════════════════════════════════════════════════════ */

  function init() {
    _ensureModal();
    render();
  }

  /* ══════════════════════════════════════════════════════════════════════════
     Main Render
  ══════════════════════════════════════════════════════════════════════════ */

  function render() {
    const container = $('#page-metrics .page-content');
    if (!container) return;

    const metrics = Storage.getMetrics();
    const latest = Storage.getLatestMetric();

    html(container, `
      ${_renderStatsCards(metrics, latest)}
      ${_renderWeightChart(metrics)}
      ${_renderTrendIndicator(metrics)}
      ${_renderBMIGauge(latest)}
      ${_renderMeasurements(latest)}
    `);

    _bindEvents();
    _buildChart(metrics);
  }

  /* ══════════════════════════════════════════════════════════════════════════
     1. Current Stats Cards
  ══════════════════════════════════════════════════════════════════════════ */

  function _renderStatsCards(metrics, latest) {
    const currentWeight = latest && latest.weight != null ? formatWeight(latest.weight) : '--';
    const bodyFat = latest && latest.bodyFat != null ? `${formatNumber(latest.bodyFat, 1)}%` : '--';

    // Weight change — first to latest
    let changeHtml = '<span class="stat-value">--</span>';
    if (metrics.length >= 2) {
      const first = metrics[0];
      const diff = latest.weight - first.weight;
      const sign = diff > 0 ? '+' : '';
      const colorClass = diff < 0 ? 'success' : diff > 0 ? 'danger' : '';
      changeHtml = `<span class="stat-value ${colorClass}">${sign}${formatNumber(diff, 1)} kg</span>`;
    }

    // BMI
    let bmiVal = '--';
    if (latest && latest.weight != null) {
      const heightM = HEIGHT_CM / 100;
      bmiVal = formatNumber(latest.weight / (heightM * heightM), 1);
    }

    return `
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-label">Current Weight</span>
          <span class="stat-value">${currentWeight}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Weight Change</span>
          ${changeHtml}
        </div>
        <div class="stat-card">
          <span class="stat-label">BMI</span>
          <span class="stat-value">${bmiVal}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Body Fat %</span>
          <span class="stat-value">${bodyFat}</span>
        </div>
      </div>
      <div style="text-align:center;margin:1.2rem 0 0.5rem;">
        <button class="btn btn-primary" id="btn-log-metrics">Log Metrics</button>
      </div>
    `;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     2. Weight Chart
  ══════════════════════════════════════════════════════════════════════════ */

  function _renderWeightChart(/* metrics */) {
    const ranges = ['1W', '1M', '3M', '6M', 'All'];
    const btns = ranges.map(r =>
      `<button class="chart-range-btn${r === activeRange ? ' active' : ''}" data-range="${r}">${r}</button>`
    ).join('');

    return `
      <div class="card">
        <div class="chart-header">
          <h3 class="card-title">Weight Over Time</h3>
          <div class="chart-range-btns">${btns}</div>
        </div>
        <div class="chart-container">
          <canvas id="weight-chart"></canvas>
        </div>
      </div>
    `;
  }

  function _filterByRange(metrics, range) {
    if (range === 'All' || !metrics.length) return metrics;

    const now = new Date();
    let cutoff;
    switch (range) {
      case '1W': cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 7); break;
      case '1M': cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - 1); break;
      case '3M': cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - 3); break;
      case '6M': cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - 6); break;
      default: return metrics;
    }
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return metrics.filter(m => m.date >= cutoffStr);
  }

  function _buildChart(metrics) {
    const canvas = document.getElementById('weight-chart');
    if (!canvas) return;

    // Destroy previous chart instance
    if (weightChart) {
      weightChart.destroy();
      weightChart = null;
    }

    const filtered = _filterByRange(
      metrics.filter(m => m.weight != null),
      activeRange
    );

    if (!filtered.length) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = FONT_COLOR;
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No weight data for this range', canvas.width / 2, canvas.height / 2);
      return;
    }

    const labels = filtered.map(m => formatDateShort(m.date));
    const data = filtered.map(m => +m.weight.toFixed(1));

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.parentElement.clientHeight || 260);
    gradient.addColorStop(0, ACCENT_FILL_TOP);
    gradient.addColorStop(1, ACCENT_FILL_BOT);

    weightChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Weight',
          data,
          borderColor: ACCENT,
          backgroundColor: gradient,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: ACCENT,
          pointBorderColor: ACCENT,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => items[0].label,
              label: (item) => `${item.parsed.y} kg`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: GRID_COLOR },
            ticks: { color: FONT_COLOR, maxTicksLimit: 10 },
          },
          y: {
            grid: { color: GRID_COLOR },
            ticks: {
              color: FONT_COLOR,
              callback: (v) => `${v} kg`,
            },
          },
        },
      },
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     3. Body Measurements Card
  ══════════════════════════════════════════════════════════════════════════ */

  function _renderMeasurements(latest) {
    const m = (latest && latest.measurements) || {};

    const fields = [
      { label: 'Chest',      key: 'chest' },
      { label: 'Waist',      key: 'waist' },
      { label: 'Hips',       key: 'hips' },
      { label: 'Left Arm',   key: 'leftArm' },
      { label: 'Right Arm',  key: 'rightArm' },
      { label: 'Left Thigh', key: 'leftThigh' },
      { label: 'Right Thigh',key: 'rightThigh' },
    ];

    const items = fields.map(f => {
      const val = m[f.key] != null ? `${formatNumber(m[f.key], 1)} cm` : '--';
      return `
        <div class="measurement-item">
          <span class="stat-label">${f.label}</span>
          <span class="stat-value">${val}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Body Measurements</h3>
        </div>
        <div class="stats-grid measurements-grid">${items}</div>
      </div>
    `;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     4. BMI Gauge
  ══════════════════════════════════════════════════════════════════════════ */

  function _renderBMIGauge(latest) {
    if (!latest || latest.weight == null) {
      return `
        <div class="card">
          <div class="card-header"><h3 class="card-title">BMI Indicator</h3></div>
          <p style="color:${FONT_COLOR};text-align:center;padding:1rem;">No weight data available</p>
        </div>
      `;
    }

    const heightM = HEIGHT_CM / 100;
    const bmi = latest.weight / (heightM * heightM);

    // Determine category
    let category = 'Obese';
    if (bmi < 18.5) category = 'Underweight';
    else if (bmi < 25) category = 'Normal';
    else if (bmi < 30) category = 'Overweight';

    // Map BMI to percentage position on bar (clamped 14–40 range)
    const minBmi = 14;
    const maxBmi = 40;
    const pct = Math.max(0, Math.min(100, ((bmi - minBmi) / (maxBmi - minBmi)) * 100));

    // Range boundaries as percentages
    const r1 = ((18.5 - minBmi) / (maxBmi - minBmi)) * 100;
    const r2 = ((25 - minBmi) / (maxBmi - minBmi)) * 100;
    const r3 = ((30 - minBmi) / (maxBmi - minBmi)) * 100;

    return `
      <div class="card">
        <div class="card-header"><h3 class="card-title">BMI Indicator</h3></div>
        <div class="bmi-gauge">
          <div class="bmi-bar">
            <div class="bmi-segment bmi-underweight" style="width:${r1}%"></div>
            <div class="bmi-segment bmi-normal" style="width:${r2 - r1}%"></div>
            <div class="bmi-segment bmi-overweight" style="width:${r3 - r2}%"></div>
            <div class="bmi-segment bmi-obese" style="width:${100 - r3}%"></div>
            <div class="bmi-marker" style="left:${pct}%">
              <span class="bmi-marker-label">${formatNumber(bmi, 1)}</span>
            </div>
          </div>
          <div class="bmi-labels">
            <span class="${category === 'Underweight' ? 'bmi-active' : ''}">Underweight<br>&lt;18.5</span>
            <span class="${category === 'Normal' ? 'bmi-active' : ''}">Normal<br>18.5–24.9</span>
            <span class="${category === 'Overweight' ? 'bmi-active' : ''}">Overweight<br>25–29.9</span>
            <span class="${category === 'Obese' ? 'bmi-active' : ''}">Obese<br>30+</span>
          </div>
        </div>
      </div>
    `;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     5. Metrics Log Modal
  ══════════════════════════════════════════════════════════════════════════ */

  function _ensureModal() {
    if (document.getElementById('modal-metric')) return;

    const modal = document.createElement('div');
    modal.id = 'modal-metric';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Log Body Metrics</h3>
          <button class="btn btn-ghost modal-close-btn" data-close="modal-metric">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label" for="metric-date">Date</label>
            <input class="form-input" type="date" id="metric-date" />
          </div>
          <div class="form-group">
            <label class="form-label" for="metric-weight">Weight (kg)</label>
            <input class="form-input" type="number" id="metric-weight" step="0.1" min="0" placeholder="e.g. 75.0" />
          </div>
          <div class="form-group">
            <label class="form-label" for="metric-bodyfat">Body Fat %</label>
            <input class="form-input" type="number" id="metric-bodyfat" step="0.1" min="0" max="100" placeholder="e.g. 18.0" />
          </div>

          <details class="measurements-section">
            <summary class="btn btn-ghost" style="cursor:pointer;margin-top:0.5rem;">Body Measurements</summary>
            <div class="measurements-fields">
              <div class="form-group">
                <label class="form-label" for="metric-chest">Chest (cm)</label>
                <input class="form-input" type="number" id="metric-chest" step="0.1" min="0" />
              </div>
              <div class="form-group">
                <label class="form-label" for="metric-waist">Waist (cm)</label>
                <input class="form-input" type="number" id="metric-waist" step="0.1" min="0" />
              </div>
              <div class="form-group">
                <label class="form-label" for="metric-hips">Hips (cm)</label>
                <input class="form-input" type="number" id="metric-hips" step="0.1" min="0" />
              </div>
              <div class="form-group">
                <label class="form-label" for="metric-left-arm">Left Arm (cm)</label>
                <input class="form-input" type="number" id="metric-left-arm" step="0.1" min="0" />
              </div>
              <div class="form-group">
                <label class="form-label" for="metric-right-arm">Right Arm (cm)</label>
                <input class="form-input" type="number" id="metric-right-arm" step="0.1" min="0" />
              </div>
              <div class="form-group">
                <label class="form-label" for="metric-left-thigh">Left Thigh (cm)</label>
                <input class="form-input" type="number" id="metric-left-thigh" step="0.1" min="0" />
              </div>
              <div class="form-group">
                <label class="form-label" for="metric-right-thigh">Right Thigh (cm)</label>
                <input class="form-input" type="number" id="metric-right-thigh" step="0.1" min="0" />
              </div>
            </div>
          </details>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-close="modal-metric">Cancel</button>
          <button class="btn btn-primary" id="btn-save-metric">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Close buttons
    modal.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => closeModal('modal-metric'));
    });

    // Backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal('modal-metric');
    });

    // Save
    document.getElementById('btn-save-metric').addEventListener('click', _handleSave);
  }

  function openMetricModal() {
    // Reset form
    const dateInput = document.getElementById('metric-date');
    dateInput.value = Storage.today();
    document.getElementById('metric-weight').value = '';
    document.getElementById('metric-bodyfat').value = '';

    // Clear measurement fields
    ['chest', 'waist', 'hips', 'left-arm', 'right-arm', 'left-thigh', 'right-thigh'].forEach(f => {
      const el = document.getElementById('metric-' + f);
      if (el) el.value = '';
    });

    openModal('modal-metric');
  }

  function _handleSave() {
    const weight = parseFloat(document.getElementById('metric-weight').value);
    const bodyFat = parseFloat(document.getElementById('metric-bodyfat').value);
    const date = document.getElementById('metric-date').value;

    if (!weight || isNaN(weight)) {
      toast('Please enter your weight', 'error');
      return;
    }

    const metric = {
      date: date || Storage.today(),
      weight,
    };

    if (!isNaN(bodyFat) && bodyFat > 0) {
      metric.bodyFat = bodyFat;
    }

    // Gather measurements
    const measurementMap = {
      chest: 'metric-chest',
      waist: 'metric-waist',
      hips: 'metric-hips',
      leftArm: 'metric-left-arm',
      rightArm: 'metric-right-arm',
      leftThigh: 'metric-left-thigh',
      rightThigh: 'metric-right-thigh',
    };

    const measurements = {};
    let hasMeasurements = false;
    Object.entries(measurementMap).forEach(([key, id]) => {
      const val = parseFloat(document.getElementById(id).value);
      if (!isNaN(val) && val > 0) {
        measurements[key] = val;
        hasMeasurements = true;
      }
    });

    if (hasMeasurements) {
      metric.measurements = measurements;
    }

    Storage.saveMetric(metric);
    closeModal('modal-metric');
    toast('Metrics saved!', 'success');
    render();

    // Trigger achievement check for logging weight
    if (typeof Storage.unlockAchievement === 'function') {
      const unlocked = Storage.unlockAchievement('logged_weight');
      if (unlocked) {
        toast('🏆 Achievement unlocked: Self Aware!', 'success');
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     6. Trend Indicator
  ══════════════════════════════════════════════════════════════════════════ */

  function _renderTrendIndicator(metrics) {
    const withWeight = metrics.filter(m => m.weight != null);
    if (withWeight.length < 2) {
      return `<div class="trend-indicator"><span style="color:${FONT_COLOR}">Not enough data to show a trend</span></div>`;
    }

    // Calculate change over the past month
    const now = new Date();
    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const monthAgoStr = monthAgo.toISOString().slice(0, 10);

    // Find the metric closest to one month ago
    let baseline = withWeight[0];
    for (const m of withWeight) {
      if (m.date <= monthAgoStr) {
        baseline = m;
      } else {
        break;
      }
    }

    const latest = withWeight[withWeight.length - 1];
    const diff = latest.weight - baseline.weight;
    const absDiff = Math.abs(diff).toFixed(1);

    let arrow, verb, colorClass;
    if (diff < -0.05) {
      arrow = '↓';
      verb = 'Down';
      colorClass = 'success';
    } else if (diff > 0.05) {
      arrow = '↑';
      verb = 'Up';
      colorClass = 'danger';
    } else {
      arrow = '→';
      verb = 'Stable';
      colorClass = '';
    }

    const text = verb === 'Stable'
      ? `${arrow} Weight stable this month`
      : `${arrow} ${verb} ${absDiff} kg this month`;

    return `<div class="trend-indicator"><span class="${colorClass}">${text}</span></div>`;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     Event Binding
  ══════════════════════════════════════════════════════════════════════════ */

  function _bindEvents() {
    // Log Metrics button
    const logBtn = document.getElementById('btn-log-metrics');
    if (logBtn) {
      logBtn.addEventListener('click', openMetricModal);
    }

    // Chart range buttons
    $$('.chart-range-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeRange = btn.dataset.range;

        // Update active class
        $$('.chart-range-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Rebuild chart with new range
        _buildChart(Storage.getMetrics());
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     Export
  ══════════════════════════════════════════════════════════════════════════ */

  window.Metrics = {
    init,
    render,
    openMetricModal,
  };
})();
