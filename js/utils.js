// ─── APEX Fitness · Utilities ─────────────────────────────────────────────────

/* ── Date helpers ─────────────────────────────────────────────────────────── */

const Utils = {
  formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  formatDateShort(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  formatRelative(dateStr) {
    const now = new Date();
    const d = new Date(dateStr + 'T00:00:00');
    const diff = Math.floor((now - d) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff} days ago`;
    if (diff < 30) return `${Math.floor(diff / 7)} week${Math.floor(diff / 7) > 1 ? 's' : ''} ago`;
    return Utils.formatDateShort(dateStr);
  },

  daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  },

  getWeekDates() {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      dates.push(Utils.daysAgo(i));
    }
    return dates;
  },

  getDayName(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  },

  getMonthDays(year, month) {
    return new Date(year, month + 1, 0).getDate();
  },

  getFirstDayOfMonth(year, month) {
    return new Date(year, month, 1).getDay();
  },

  /* ── Number formatting ──────────────────────────────────────────────────── */

  formatNumber(n, decimals = 0) {
    return Number(n).toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  formatWeight(kg) {
    return `${Number(kg).toFixed(1)} kg`;
  },

  formatDistance(km) {
    return `${Number(km).toFixed(1)} km`;
  },

  formatDuration(minutes) {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  },

  formatPace(minsPerKm) {
    const m = Math.floor(minsPerKm);
    const s = Math.round((minsPerKm - m) * 60);
    return `${m}:${s.toString().padStart(2, '0')} /km`;
  },

  /* ── DOM helpers ────────────────────────────────────────────────────────── */

  $(selector, parent = document) {
    return parent.querySelector(selector);
  },

  $$(selector, parent = document) {
    return [...parent.querySelectorAll(selector)];
  },

  html(container, content) {
    if (typeof container === 'string') container = document.querySelector(container);
    if (container) container.innerHTML = content;
  },

  createElement(tag, attrs = {}, children = '') {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'className') el.className = v;
      else if (k === 'dataset') Object.entries(v).forEach(([dk, dv]) => el.dataset[dk] = dv);
      else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v);
    });
    if (typeof children === 'string') el.innerHTML = children;
    else if (children instanceof HTMLElement) el.appendChild(children);
    return el;
  },

  animateCounter(el, target, duration = 1000, decimals = 0) {
    const start = parseFloat(el.textContent) || 0;
    const range = target - start;
    const startTime = performance.now();

    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      el.textContent = (start + range * eased).toFixed(decimals);
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  },

  /* ── Toast notification ─────────────────────────────────────────────────── */

  toast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('toast--visible'));
    setTimeout(() => {
      toast.classList.remove('toast--visible');
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  },

  /* ── Confetti ───────────────────────────────────────────────────────────── */

  confetti() {
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);

    for (let i = 0; i < 40; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + '%';
      piece.style.animationDelay = Math.random() * 0.5 + 's';
      piece.style.backgroundColor = ['#fafafa', '#71717a', '#a1a1aa', '#d4d4d8', '#52525b'][Math.floor(Math.random() * 5)];
      container.appendChild(piece);
    }

    setTimeout(() => container.remove(), 3000);
  },

  /* ── Modal helpers ──────────────────────────────────────────────────────── */

  openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('active');
      document.body.classList.add('modal-open');
    }
  },

  closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('active');
      document.body.classList.remove('modal-open');
    }
  },

  closeAllModals() {
    document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
    document.body.classList.remove('modal-open');
  },
};

/* ── Exercise Library ─────────────────────────────────────────────────────── */

const ExerciseLibrary = {
  strength: [
    { name: 'Bench Press', muscles: ['Chest', 'Triceps'] },
    { name: 'Incline Dumbbell Press', muscles: ['Upper Chest', 'Shoulders'] },
    { name: 'Overhead Press', muscles: ['Shoulders', 'Triceps'] },
    { name: 'Squats', muscles: ['Quads', 'Glutes'] },
    { name: 'Deadlift', muscles: ['Back', 'Hamstrings'] },
    { name: 'Romanian Deadlift', muscles: ['Hamstrings', 'Glutes'] },
    { name: 'Barbell Rows', muscles: ['Back', 'Biceps'] },
    { name: 'Pull-Ups', muscles: ['Back', 'Biceps'] },
    { name: 'Lat Pulldown', muscles: ['Back'] },
    { name: 'Dumbbell Curls', muscles: ['Biceps'] },
    { name: 'Barbell Curls', muscles: ['Biceps'] },
    { name: 'Tricep Pushdowns', muscles: ['Triceps'] },
    { name: 'Skull Crushers', muscles: ['Triceps'] },
    { name: 'Lateral Raises', muscles: ['Shoulders'] },
    { name: 'Face Pulls', muscles: ['Rear Delts'] },
    { name: 'Leg Press', muscles: ['Quads', 'Glutes'] },
    { name: 'Leg Curl', muscles: ['Hamstrings'] },
    { name: 'Leg Extension', muscles: ['Quads'] },
    { name: 'Calf Raises', muscles: ['Calves'] },
    { name: 'Dips', muscles: ['Chest', 'Triceps'] },
    { name: 'Cable Flyes', muscles: ['Chest'] },
    { name: 'Dumbbell Rows', muscles: ['Back'] },
    { name: 'Shrugs', muscles: ['Traps'] },
    { name: 'Hip Thrusts', muscles: ['Glutes'] },
    { name: 'Lunges', muscles: ['Quads', 'Glutes'] },
  ],
  cardio: [
    { name: 'Running', unit: 'km' },
    { name: 'Cycling', unit: 'km' },
    { name: 'Swimming', unit: 'km' },
    { name: 'Rowing', unit: 'km' },
    { name: 'Jump Rope', unit: 'min' },
    { name: 'Stair Climber', unit: 'min' },
    { name: 'Elliptical', unit: 'min' },
    { name: 'Walking', unit: 'km' },
  ],
  flexibility: [
    { name: 'Sun Salutation' },
    { name: 'Warrior Poses' },
    { name: 'Hip Openers' },
    { name: 'Hamstring Stretch' },
    { name: 'Shoulder Stretch' },
    { name: 'Spinal Twist' },
    { name: 'Foam Rolling' },
    { name: 'Dynamic Stretching' },
  ],
  hiit: [
    { name: 'Burpees' },
    { name: 'Mountain Climbers' },
    { name: 'Jump Squats' },
    { name: 'High Knees' },
    { name: 'Box Jumps' },
    { name: 'Battle Ropes' },
    { name: 'Kettlebell Swings' },
    { name: 'Plank Jacks' },
  ],
};

/* ── Achievement Definitions ──────────────────────────────────────────────── */

const AchievementDefs = [
  { id: 'first_workout', name: 'First Step', desc: 'Complete your first workout', icon: '🏃', xp: 100 },
  { id: 'streak_3', name: 'On Fire', desc: '3-day workout streak', icon: '🔥', xp: 150 },
  { id: 'streak_7', name: 'Unstoppable', desc: '7-day workout streak', icon: '⚡', xp: 300 },
  { id: 'streak_30', name: 'Iron Will', desc: '30-day workout streak', icon: '💎', xp: 1000 },
  { id: 'ten_workouts', name: 'Getting Serious', desc: 'Complete 10 workouts', icon: '💪', xp: 200 },
  { id: 'fifty_workouts', name: 'Dedicated', desc: 'Complete 50 workouts', icon: '🏋️', xp: 500 },
  { id: 'hundred_workouts', name: 'Centurion', desc: 'Complete 100 workouts', icon: '🏆', xp: 1000 },
  { id: 'first_cardio', name: 'Runner Up', desc: 'Complete a cardio workout', icon: '🫀', xp: 100 },
  { id: 'first_strength', name: 'Iron Pumper', desc: 'Complete a strength workout', icon: '🔩', xp: 100 },
  { id: 'first_goal', name: 'Goal Setter', desc: 'Set your first goal', icon: '🎯', xp: 100 },
  { id: 'goal_completed', name: 'Achiever', desc: 'Complete a goal', icon: '✅', xp: 300 },
  { id: 'water_8', name: 'Hydrated', desc: 'Drink 8 glasses of water in a day', icon: '💧', xp: 100 },
  { id: 'logged_weight', name: 'Self Aware', desc: 'Log your body weight', icon: '⚖️', xp: 100 },
  { id: 'five_km', name: 'Five K', desc: 'Run 5km in a single session', icon: '🛤️', xp: 200 },
  { id: 'early_bird', name: 'Early Bird', desc: 'Log a workout before 7 AM', icon: '🌅', xp: 150 },
  { id: 'level_5', name: 'Rising Star', desc: 'Reach level 5', icon: '⭐', xp: 300 },
  { id: 'level_10', name: 'Elite', desc: 'Reach level 10', icon: '👑', xp: 500 },
];

/* ── Motivational Quotes ──────────────────────────────────────────────────── */

const Quotes = [
  { text: "The only bad workout is the one that didn't happen.", author: "Unknown" },
  { text: "Your body can stand almost anything. It's your mind you have to convince.", author: "Unknown" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "The pain you feel today will be the strength you feel tomorrow.", author: "Unknown" },
  { text: "Success isn't always about greatness. It's about consistency.", author: "Dwayne Johnson" },
  { text: "Don't limit your challenges. Challenge your limits.", author: "Unknown" },
  { text: "The only way to define your limits is by going beyond them.", author: "Arthur C. Clarke" },
  { text: "It never gets easier, you just get stronger.", author: "Unknown" },
  { text: "Strength does not come from physical capacity. It comes from an indomitable will.", author: "Mahatma Gandhi" },
  { text: "The harder you work, the luckier you get.", author: "Gary Player" },
  { text: "What seems impossible today will one day become your warm-up.", author: "Unknown" },
  { text: "Train insane or remain the same.", author: "Unknown" },
];

function getDailyQuote() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return Quotes[dayOfYear % Quotes.length];
}

/* ── Workout type icons & labels ──────────────────────────────────────────── */

const WorkoutTypes = {
  strength: { label: 'Strength', icon: '🔩' },
  cardio:   { label: 'Cardio',   icon: '🫀' },
  flexibility: { label: 'Flexibility', icon: '🧘' },
  hiit:     { label: 'HIIT',     icon: '⚡' },
};

/* ── Export ────────────────────────────────────────────────────────────────── */

window.Utils = Utils;
window.ExerciseLibrary = ExerciseLibrary;
window.AchievementDefs = AchievementDefs;
window.getDailyQuote = getDailyQuote;
window.WorkoutTypes = WorkoutTypes;
