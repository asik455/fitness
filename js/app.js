// ─── APEX Fitness · App Controller ────────────────────────────────────────────
// Main application orchestrator: routing, initialization, global events.

(function () {
  'use strict';

  const { $, $$, toast } = Utils;

  let currentPage = 'dashboard';

  /* ── Routing ────────────────────────────────────────────────────────────── */

  function navigateTo(page) {
    if (page === currentPage) return;

    // Deactivate old page & nav
    const oldPage = $(`#page-${currentPage}`);
    const oldNav = $(`.nav-item[data-page="${currentPage}"]`);
    if (oldPage) oldPage.classList.remove('active');
    if (oldNav) oldNav.classList.remove('active');

    // Activate new page & nav
    const newPage = $(`#page-${page}`);
    const newNav = $(`.nav-item[data-page="${page}"]`);
    if (newPage) newPage.classList.add('active');
    if (newNav) newNav.classList.add('active');

    currentPage = page;
    renderCurrentPage();
  }

  function renderCurrentPage() {
    switch (currentPage) {
      case 'dashboard': Dashboard.render(); break;
      case 'coach': Coach.render(); break;
      case 'workouts': Workouts.render(); break;
      case 'metrics': Metrics.render(); break;
      case 'goals': Goals.render(); break;
      case 'history': History.render(); break;
      case 'achievements': Achievements.render(); break;
    }
  }

  /* ── Greeting ───────────────────────────────────────────────────────────── */

  function updateGreeting() {
    const hour = new Date().getHours();
    let greeting;
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 17) greeting = 'Good afternoon';
    else greeting = 'Good evening';

    const profile = Storage.getProfile();
    const el = $('#dashboard-greeting');
    if (el) el.textContent = `${greeting}, ${profile.name}`;
  }

  /* ── Global Event Delegation ────────────────────────────────────────────── */

  function setupGlobalEvents() {
    // Bottom nav
    $('#bottom-nav').addEventListener('click', (e) => {
      const navItem = e.target.closest('.nav-item');
      if (navItem) {
        const page = navItem.dataset.page;
        navigateTo(page);
      }
    });

    // Modal close on backdrop click
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal') && e.target.classList.contains('active')) {
        e.target.classList.remove('active');
        document.body.classList.remove('modal-open');
      }
    });

    // Modal close buttons
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-close-modal]')) {
        const modalId = e.target.closest('[data-close-modal]').dataset.closeModal;
        Utils.closeModal(modalId);
      }
    });

    // Quick action buttons on dashboard
    document.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]');
      if (!action) return;

      switch (action.dataset.action) {
        case 'open-workout-modal':
          Workouts.openWorkoutModal();
          break;
        case 'open-metric-modal':
          Metrics.openMetricModal();
          break;
        case 'open-goal-modal':
          Goals.openGoalModal();
          break;
        case 'add-water':
          Storage.addWater(1);
          Dashboard.render();
          Achievements.checkAchievements();
          break;
        case 'remove-water': {
          const profile = Storage.getProfile();
          const todayStr = Storage.today();
          if (profile.waterLog && profile.waterLog[todayStr] > 0) {
            profile.waterLog[todayStr]--;
            Storage.saveProfile(profile);
            Dashboard.render();
          }
          break;
        }
        case 'navigate':
          if (action.dataset.page) navigateTo(action.dataset.page);
          break;
      }
    });

    // Keyboard: Escape closes modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        Utils.closeAllModals();
      }
    });
  }

  /* ── Data Change Hook ───────────────────────────────────────────────────── */

  // Called after any data mutation to refresh views & check achievements
  window.onDataChange = function (source) {
    // Rebuild RAG index when fitness data changes
    if (window.RAG) RAG.rebuildIndex(true);

    // Re-render current page
    renderCurrentPage();

    // Always check achievements
    if (Achievements && Achievements.checkAchievements) {
      Achievements.checkAchievements();
    }
  };

  /* ── Initialization ─────────────────────────────────────────────────────── */

  function init() {
    // Seed demo data if first visit
    Storage.seedIfEmpty();

    if (window.RAG) RAG.rebuildIndex();

    // Initialize all modules
    Dashboard.init();
    Coach.init();
    Workouts.init();
    Metrics.init();
    Goals.init();
    History.init();
    Achievements.init();

    // Setup events
    setupGlobalEvents();

    // Update greeting
    updateGreeting();

    // Render dashboard
    Dashboard.render();

    console.log('🏋️ APEX Fitness initialized');
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
