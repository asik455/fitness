// ─── APEX Fitness · RAG Engine ───────────────────────────────────────────────
// Indexes local fitness data, retrieves relevant chunks, augments LLM answers.

(function () {
  'use strict';

  const INDEX_KEY = 'apex_rag_index';
  const SETTINGS_KEY = 'apex_rag_settings';
  const K1 = 1.5;
  const B = 0.75;

  /* ── Settings ───────────────────────────────────────────────────────────── */

  function getSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : _defaultSettings();
    } catch {
      return _defaultSettings();
    }
  }

  function saveSettings(updates) {
    const next = { ...getSettings(), ...updates };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    return next;
  }

  function _defaultSettings() {
    return {
      apiKey: '',
      model: 'gpt-4o-mini',
      useLlm: true,
      topK: 6,
      endpoint: 'https://api.openai.com/v1/chat/completions',
    };
  }

  /* ── Tokenization & fingerprint ─────────────────────────────────────────── */

  function tokenize(text) {
    return (text || '')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);
  }

  function fingerprint() {
    const blob = JSON.stringify({
      workouts: Storage.getWorkouts(),
      metrics: Storage.getMetrics(),
      goals: Storage.getGoals(),
      profile: Storage.getProfile(),
      achievements: Storage.getAchievements(),
    });
    let h = 5381;
    for (let i = 0; i < blob.length; i++) {
      h = ((h << 5) + h) ^ blob.charCodeAt(i);
    }
    return (h >>> 0).toString(36);
  }

  /* ── Chunk builders ───────────────────────────────────────────────────────── */

  function formatExercise(ex) {
    if (ex.sets && ex.sets.length) {
      const sets = ex.sets
        .map((s, i) => `set ${i + 1}: ${s.reps || 0} reps @ ${s.weight || 0} kg`)
        .join('; ');
      return `${ex.name}: ${sets}`;
    }
    const parts = [ex.name];
    if (ex.distance != null) parts.push(`${ex.distance} km`);
    if (ex.duration != null) parts.push(`${ex.duration} min`);
    if (ex.pace != null) parts.push(`pace ${ex.pace} min/km`);
    return parts.join(', ');
  }

  function chunkWorkouts() {
    return Storage.getWorkouts().map(w => {
      const exercises = (w.exercises || []).map(formatExercise).join('. ');
      const text = [
        `Workout on ${w.date}: ${w.name || 'Untitled'} (${w.type || 'general'}).`,
        `Duration ${w.duration || 0} minutes, calories ${w.caloriesBurned || 0}.`,
        exercises ? `Exercises: ${exercises}.` : '',
        w.notes ? `Notes: ${w.notes}` : '',
      ].filter(Boolean).join(' ');

      return {
        id: `workout-${w.id}`,
        source: 'workout',
        date: w.date,
        text,
        meta: { type: w.type, name: w.name },
      };
    });
  }

  function chunkMetrics() {
    return Storage.getMetrics().map(m => {
      const meas = m.measurements || {};
      const measText = Object.entries(meas)
        .map(([k, v]) => `${k} ${Number(v).toFixed(1)} cm`)
        .join(', ');
      const text = [
        `Body metrics on ${m.date}:`,
        m.weight != null ? `weight ${Number(m.weight).toFixed(1)} kg` : '',
        m.bodyFat != null ? `body fat ${Number(m.bodyFat).toFixed(1)}%` : '',
        measText ? `measurements: ${measText}` : '',
      ].filter(Boolean).join(', ');

      return {
        id: `metric-${m.id}`,
        source: 'metric',
        date: m.date,
        text,
        meta: {},
      };
    });
  }

  function chunkGoals() {
    return Storage.getGoals().map(g => {
      const pct = g.target ? Math.round((g.current / g.target) * 100) : 0;
      const text = [
        `Goal: ${g.title || g.type} (${g.completed ? 'completed' : 'active'}).`,
        `Progress ${g.current || 0} / ${g.target || 0} ${g.unit || ''} (${pct}%).`,
        g.deadline ? `Deadline ${g.deadline}.` : '',
      ].join(' ');

      return {
        id: `goal-${g.id}`,
        source: 'goal',
        date: g.deadline || g.createdAt?.slice(0, 10),
        text,
        meta: { completed: g.completed },
      };
    });
  }

  function chunkProfile() {
    const p = Storage.getProfile();
    const latest = Storage.getLatestMetric();
    const text = [
      `Athlete profile: ${p.name}, level ${p.level || 1}, XP ${p.xp || 0}.`,
      `Workout streak ${p.streak || 0} days (longest ${p.longestStreak || 0}).`,
      `Water today ${Storage.getWaterToday()} glasses.`,
      latest ? `Latest weight ${Number(latest.weight).toFixed(1)} kg on ${latest.date}.` : '',
      `Member since ${p.joinedAt ? p.joinedAt.slice(0, 10) : 'unknown'}.`,
    ].join(' ');

    return [{
      id: 'profile-summary',
      source: 'profile',
      date: Storage.today(),
      text,
      meta: {},
    }];
  }

  function chunkAchievements() {
    const unlocked = Storage.getAchievements();
    const defs = window.AchievementDefs || [];
    const lines = defs
      .filter(d => unlocked[d.id])
      .map(d => `${d.name}: ${d.desc}`);
    const text = lines.length
      ? `Unlocked achievements: ${lines.join('; ')}.`
      : 'No achievements unlocked yet.';

    return [{
      id: 'achievements-summary',
      source: 'achievement',
      date: Storage.today(),
      text,
      meta: { count: lines.length },
    }];
  }

  function chunkSummaries() {
    const workouts = Storage.getWorkouts();
    const weekStart = new Date(Storage.today());
    weekStart.setDate(weekStart.getDate() - 6);
    const ws = weekStart.toISOString().slice(0, 10);
    const week = workouts.filter(w => w.date >= ws);
    const byType = {};
    week.forEach(w => { byType[w.type] = (byType[w.type] || 0) + 1; });
    const totalCal = week.reduce((s, w) => s + (w.caloriesBurned || 0), 0);
    const totalMin = week.reduce((s, w) => s + (w.duration || 0), 0);

    const text = [
      `Weekly summary (${ws} to ${Storage.today()}):`,
      `${week.length} workouts, ${totalMin} active minutes, ${totalCal} calories.`,
      Object.keys(byType).length
        ? `Types: ${Object.entries(byType).map(([t, n]) => `${t} x${n}`).join(', ')}.`
        : '',
      `All-time total workouts: ${workouts.length}.`,
    ].join(' ');

    return [{
      id: 'weekly-summary',
      source: 'summary',
      date: Storage.today(),
      text,
      meta: {},
    }];
  }

  function buildChunks() {
    return [
      ...chunkProfile(),
      ...chunkSummaries(),
      ...chunkWorkouts(),
      ...chunkMetrics(),
      ...chunkGoals(),
      ...chunkAchievements(),
    ].map(c => ({
      ...c,
      tokens: tokenize(c.text),
    }));
  }

  /* ── BM25 index ───────────────────────────────────────────────────────────── */

  function buildBm25Stats(chunks) {
    const docFreq = {};
    const docLens = chunks.map(c => c.tokens.length);
    const avgDl = docLens.reduce((a, b) => a + b, 0) / (docLens.length || 1);

    chunks.forEach(c => {
      const seen = new Set(c.tokens);
      seen.forEach(t => { docFreq[t] = (docFreq[t] || 0) + 1; });
    });

    const N = chunks.length;
    return { docFreq, docLens, avgDl, N };
  }

  function bm25Score(queryTokens, chunk, idx, stats) {
    const { docFreq, docLens, avgDl, N } = stats;
    let score = 0;
    const dl = docLens[idx];

    queryTokens.forEach(term => {
      if (!chunk.tokens.includes(term)) return;
      const tf = chunk.tokens.filter(t => t === term).length;
      const df = docFreq[term] || 0;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      const norm = tf * (K1 + 1) / (tf + K1 * (1 - B + B * (dl / avgDl)));
      score += idf * norm;
    });

    return score;
  }

  function phraseBoost(query, text) {
    const q = query.toLowerCase().trim();
    const t = text.toLowerCase();
    if (q.length < 4) return 0;
    if (t.includes(q)) return 3;
    const words = tokenize(q);
    let hits = 0;
    words.forEach(w => { if (t.includes(w)) hits++; });
    return hits / Math.max(words.length, 1);
  }

  /* ── Index persistence ────────────────────────────────────────────────────── */

  function getIndex() {
    try {
      const raw = localStorage.getItem(INDEX_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function rebuildIndex(force = false) {
    const fp = fingerprint();
    const existing = getIndex();
    if (!force && existing && existing.fingerprint === fp) {
      return existing;
    }

    const chunks = buildChunks();
    const index = {
      fingerprint: fp,
      builtAt: new Date().toISOString(),
      chunks,
      stats: buildBm25Stats(chunks),
    };
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
    return index;
  }

  /* ── Retrieval ────────────────────────────────────────────────────────────── */

  function retrieve(query, topK) {
    const settings = getSettings();
    const k = topK || settings.topK || 6;
    const index = rebuildIndex();
    const queryTokens = tokenize(query);

    if (!queryTokens.length) return [];

    const scored = index.chunks.map((chunk, i) => ({
      chunk,
      score: bm25Score(queryTokens, chunk, i, index.stats) + phraseBoost(query, chunk.text),
    }));

    scored.sort((a, b) => b.score - a.score);
    const top = scored.filter(s => s.score > 0).slice(0, k);

    if (top.length) return top;

    // Fallback: return profile + weekly summary for generic questions
    return index.chunks
      .filter(c => c.source === 'profile' || c.source === 'summary')
      .slice(0, k)
      .map(chunk => ({ chunk, score: 0.1 }));
  }

  function buildContext(hits) {
    return hits
      .map((h, i) => `[${i + 1}] (${h.chunk.source}${h.chunk.date ? ', ' + h.chunk.date : ''})\n${h.chunk.text}`)
      .join('\n\n');
  }

  /* ── Generation ─────────────────────────────────────────────────────────── */

  function generateExtractive(query, hits) {
    if (!hits.length) {
      return "I don't have enough fitness data indexed yet. Log a workout or metric first, then ask again.";
    }

    const lines = hits.map(h => `• ${h.chunk.text}`);
    return `Here's what I found in your APEX Fitness data for "${query}":\n\n${lines.join('\n\n')}\n\n_Add an OpenAI API key in settings for natural-language coaching._`;
  }

  async function generateWithLlm(query, hits, settings) {
    const context = buildContext(hits);
    const res = await fetch(settings.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: [
              'You are APEX Fitness Coach, a personal trainer assistant.',
              'Answer ONLY using the retrieved context below.',
              'If the context does not contain the answer, say you do not have that data.',
              'Be concise, encouraging, and cite dates or numbers from context.',
              'Never invent workouts, weights, or metrics not in the context.',
            ].join(' '),
          },
          {
            role: 'user',
            content: `Retrieved context:\n${context}\n\nUser question: ${query}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || `API error ${res.status}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || 'No response from model.';
  }

  async function ask(query) {
    const settings = getSettings();
    const hits = retrieve(query, settings.topK);
    const sources = hits.map(h => ({
      id: h.chunk.id,
      source: h.chunk.source,
      date: h.chunk.date,
      score: Math.round(h.score * 100) / 100,
      preview: h.chunk.text.slice(0, 120) + (h.chunk.text.length > 120 ? '…' : ''),
    }));

    let answer;
    let mode = 'extractive';

    if (settings.useLlm && settings.apiKey?.trim()) {
      try {
        answer = await generateWithLlm(query, hits, settings);
        mode = 'llm';
      } catch (e) {
        answer = generateExtractive(query, hits);
        mode = 'extractive-fallback';
        return {
          answer,
          sources,
          mode,
          chunkCount: getIndex()?.chunks?.length || 0,
          error: e.message,
        };
      }
    } else {
      answer = generateExtractive(query, hits);
    }

    return { answer, sources, mode, chunkCount: getIndex()?.chunks?.length || 0 };
  }

  /* ── Export ───────────────────────────────────────────────────────────────── */

  window.RAG = {
    getSettings,
    saveSettings,
    rebuildIndex,
    retrieve,
    ask,
    fingerprint,
    getIndex,
  };
})();
