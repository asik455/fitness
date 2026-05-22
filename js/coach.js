// ─── APEX Fitness · RAG Coach UI ─────────────────────────────────────────────

(function () {
  'use strict';

  const { $, html, toast } = window.Utils;
  const RAG = window.RAG;

  const SUGGESTIONS = [
    'How many workouts did I do this week?',
    'What is my current bench press progress?',
    'Am I on track for my weight goal?',
    'Summarize my cardio sessions',
    'What is my workout streak?',
  ];

  let messages = [];
  let busy = false;

  function loadHistory() {
    try {
      const raw = localStorage.getItem('apex_coach_history');
      messages = raw ? JSON.parse(raw) : [];
    } catch {
      messages = [];
    }
  }

  function saveHistory() {
    localStorage.setItem('apex_coach_history', JSON.stringify(messages.slice(-40)));
  }

  function renderMessage(msg) {
    if (msg.role === 'user') {
      return `<div class="coach-msg coach-msg--user"><p>${escapeHtml(msg.content)}</p></div>`;
    }

    const sources = (msg.sources || [])
      .filter(s => s.id)
      .map(s => `<span class="coach-source-tag">${s.source}${s.date ? ' · ' + s.date : ''}</span>`)
      .join('');

    return `
      <div class="coach-msg coach-msg--assistant">
        <p>${formatAnswer(msg.content)}</p>
        ${sources ? `<div class="coach-sources">${sources}</div>` : ''}
        ${msg.mode ? `<span class="coach-mode">${msg.mode === 'llm' ? 'RAG + LLM' : 'RAG retrieval'}</span>` : ''}
      </div>`;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function formatAnswer(text) {
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  function render() {
    const container = $('#page-coach .page-content');
    if (!container) return;

    const settings = RAG.getSettings();
    const index = RAG.rebuildIndex();
    const hasKey = Boolean(settings.apiKey?.trim());

    const msgsHtml = messages.length
      ? messages.map(renderMessage).join('')
      : `<div class="coach-empty">
          <div class="coach-empty-icon">🧠</div>
          <h3>RAG Fitness Coach</h3>
          <p>Ask questions about your workouts, metrics, and goals. Answers are grounded in your logged data.</p>
          <div class="coach-suggestions">
            ${SUGGESTIONS.map(s => `<button type="button" class="coach-chip" data-suggest="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}
          </div>
        </div>`;

    html(container, `
      <div class="coach-status card">
        <div class="coach-status-row">
          <span><strong>${index.chunks.length}</strong> indexed chunks</span>
          <span class="coach-status-dot ${hasKey && settings.useLlm ? 'coach-status-dot--on' : ''}"></span>
          <span>${hasKey && settings.useLlm ? 'LLM enabled' : 'Retrieval-only mode'}</span>
        </div>
        <button type="button" class="btn btn--ghost btn--sm" data-action="reindex">Rebuild index</button>
      </div>

      <div class="coach-thread" id="coach-thread">${msgsHtml}</div>

      ${busy ? '<div class="coach-typing">Searching your fitness data…</div>' : ''}

      <form class="coach-input-bar" id="coach-form">
        <input type="text" class="form-input" id="coach-query" placeholder="Ask about your training…" autocomplete="off" ${busy ? 'disabled' : ''}>
        <button type="submit" class="btn btn--primary" ${busy ? 'disabled' : ''}>Ask</button>
      </form>

      <details class="coach-settings card">
        <summary>RAG settings</summary>
        <div class="coach-settings-body">
          <label class="form-label">OpenAI API key (optional)</label>
          <input type="password" class="form-input" id="rag-api-key" placeholder="sk-…" value="${escapeHtml(settings.apiKey || '')}">
          <label class="form-label">Model</label>
          <input type="text" class="form-input" id="rag-model" value="${escapeHtml(settings.model)}">
          <label class="form-check">
            <input type="checkbox" id="rag-use-llm" ${settings.useLlm ? 'checked' : ''}>
            Use LLM for answers (requires API key)
          </label>
          <label class="form-label">Top-K chunks</label>
          <input type="number" class="form-input" id="rag-topk" min="1" max="12" value="${settings.topK}">
          <button type="button" class="btn btn--secondary btn--sm" data-action="save-rag-settings">Save settings</button>
          <button type="button" class="btn btn--ghost btn--sm" data-action="clear-coach-history">Clear chat</button>
        </div>
      </details>
    `);

    scrollThread();
  }

  function scrollThread() {
    const thread = $('#coach-thread');
    if (thread) thread.scrollTop = thread.scrollHeight;
  }

  async function submitQuery(query) {
    const q = (query || '').trim();
    if (!q || busy) return;

    busy = true;
    messages.push({ role: 'user', content: q });
    saveHistory();
    render();

    try {
      const result = await RAG.ask(q);
      messages.push({
        role: 'assistant',
        content: result.answer,
        sources: result.sources,
        mode: result.mode,
      });
      if (result.error) {
        toast('LLM failed — used retrieval-only answer', 'warning');
      }
    } catch (e) {
      messages.push({
        role: 'assistant',
        content: `Something went wrong: ${e.message}`,
        mode: 'error',
      });
      toast(e.message, 'error');
    }

    busy = false;
    saveHistory();
    render();
  }

  function handleAction(action) {
    switch (action) {
      case 'reindex':
        RAG.rebuildIndex(true);
        toast('RAG index rebuilt', 'success');
        render();
        break;
      case 'save-rag-settings': {
        RAG.saveSettings({
          apiKey: $('#rag-api-key')?.value?.trim() || '',
          model: $('#rag-model')?.value?.trim() || 'gpt-4o-mini',
          useLlm: $('#rag-use-llm')?.checked ?? true,
          topK: Math.min(12, Math.max(1, parseInt($('#rag-topk')?.value, 10) || 6)),
        });
        toast('RAG settings saved', 'success');
        render();
        break;
      }
      case 'clear-coach-history':
        messages = [];
        saveHistory();
        render();
        toast('Chat cleared', 'info');
        break;
    }
  }

  function init() {
    loadHistory();

    document.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-suggest]');
      if (chip) {
        submitQuery(chip.dataset.suggest);
        return;
      }

      const btn = e.target.closest('[data-action]');
      if (!btn || !$('#page-coach')?.contains(btn)) return;
      const action = btn.dataset.action;
      if (['reindex', 'save-rag-settings', 'clear-coach-history'].includes(action)) {
        handleAction(action);
      }
    });

    document.addEventListener('submit', (e) => {
      if (e.target.id !== 'coach-form') return;
      e.preventDefault();
      const input = $('#coach-query');
      const q = input?.value || '';
      if (input) input.value = '';
      submitQuery(q);
    });
  }

  window.Coach = { init, render };
})();
