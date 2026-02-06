/* Network+ N10-009 Study Site - Interactive JS */

(function () {
  'use strict';

  const STORAGE_KEY = 'networkplus_progress';

  // ===== PROGRESS TRACKING =====

  function getProgress() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveProgress(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function markSectionRead(domain, sectionId, done) {
    const progress = getProgress();
    if (!progress.sections) progress.sections = {};
    const key = domain + ':' + sectionId;
    progress.sections[key] = done;
    saveProgress(progress);
    updateProgressUI();
    updateSidebarMarks();
  }

  function isSectionRead(domain, sectionId) {
    const progress = getProgress();
    if (!progress.sections) return false;
    return !!progress.sections[domain + ':' + sectionId];
  }

  function saveQuizScore(domain, score, total) {
    const progress = getProgress();
    if (!progress.quizzes) progress.quizzes = {};
    progress.quizzes[domain] = { score, total, date: Date.now() };
    saveProgress(progress);
    updateProgressUI();
  }

  function getOverallProgress() {
    const progress = getProgress();
    const sections = progress.sections || {};
    const total = document.querySelectorAll('.mark-read').length;
    if (total === 0) {
      // On home page, count from all domains
      const allKeys = Object.keys(sections);
      // Approximate: 5 domains, ~6 sections each = 30 total
      const completed = allKeys.filter(k => sections[k]).length;
      return { completed, total: Math.max(30, completed) };
    }
    let completed = 0;
    document.querySelectorAll('.mark-read').forEach(el => {
      const d = el.dataset.domain;
      const s = el.dataset.section;
      if (isSectionRead(d, s)) completed++;
    });
    return { completed, total };
  }

  function getTotalProgress() {
    const progress = getProgress();
    const sections = progress.sections || {};
    const completed = Object.keys(sections).filter(k => sections[k]).length;
    // Total sections across all 5 domains
    return { completed, total: 30 };
  }

  // ===== UI UPDATES =====

  function updateProgressUI() {
    const bar = document.querySelector('.progress-bar-fill');
    const text = document.querySelector('.progress-text');
    if (!bar || !text) return;

    const isHome = !!document.querySelector('.hero');
    const { completed, total } = isHome ? getTotalProgress() : getOverallProgress();
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    bar.style.width = pct + '%';
    text.textContent = completed + ' of ' + total + ' sections completed (' + pct + '%)';
  }

  function updateSidebarMarks() {
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
      const href = link.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      const sectionId = href.slice(1);
      const domain = document.body.dataset.domain;
      if (domain && isSectionRead(domain, sectionId)) {
        link.classList.add('completed');
      } else {
        link.classList.remove('completed');
      }
    });
  }

  // ===== SECTION READ CHECKBOXES =====

  function initMarkReadCheckboxes() {
    document.querySelectorAll('.mark-read').forEach(el => {
      const domain = el.dataset.domain;
      const section = el.dataset.section;
      const cb = el.querySelector('input');
      if (!cb) return;

      if (isSectionRead(domain, section)) {
        cb.checked = true;
        el.classList.add('done');
      }

      cb.addEventListener('change', () => {
        markSectionRead(domain, section, cb.checked);
        el.classList.toggle('done', cb.checked);
      });
    });
  }

  // ===== FLASHCARDS =====

  function initFlashcards() {
    document.querySelectorAll('.flashcard').forEach(card => {
      card.addEventListener('click', () => {
        card.classList.toggle('open');
      });
    });
  }

  // ===== QUIZZES =====

  function initQuizzes() {
    document.querySelectorAll('.quiz-container').forEach(container => {
      const domain = container.dataset.domain;
      const questions = container.querySelectorAll('.quiz-question');
      const submitBtn = container.querySelector('.btn-quiz-submit');
      const scoreBox = container.querySelector('.quiz-score');
      if (!submitBtn) return;

      // Option selection
      questions.forEach(q => {
        q.querySelectorAll('.quiz-option').forEach(opt => {
          opt.addEventListener('click', () => {
            // Deselect others in same question
            q.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            const radio = opt.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
          });
        });
      });

      submitBtn.addEventListener('click', () => {
        let score = 0;
        const total = questions.length;

        questions.forEach(q => {
          const correct = q.dataset.answer;
          const selected = q.querySelector('.quiz-option.selected');
          const explanation = q.querySelector('.quiz-explanation');

          q.querySelectorAll('.quiz-option').forEach(o => {
            o.style.pointerEvents = 'none';
            if (o.dataset.value === correct) {
              o.classList.add('correct');
            }
          });

          if (selected) {
            if (selected.dataset.value === correct) {
              score++;
            } else {
              selected.classList.add('incorrect');
            }
          }

          if (explanation) explanation.classList.add('show');
        });

        if (scoreBox) {
          const pct = Math.round((score / total) * 100);
          scoreBox.querySelector('.score-number').textContent = score + '/' + total;
          scoreBox.querySelector('.score-label').textContent = pct + '% — ' +
            (pct >= 80 ? 'Excellent!' : pct >= 60 ? 'Good, review missed topics.' : 'Keep studying, you\'ll get there!');
          scoreBox.classList.add('show');
        }

        submitBtn.style.display = 'none';
        if (domain) saveQuizScore(domain, score, total);
      });
    });
  }

  // ===== MOBILE NAV =====

  function initMobileNav() {
    const btn = document.querySelector('.hamburger');
    const links = document.querySelector('.topnav-links');
    if (!btn || !links) return;

    btn.addEventListener('click', () => {
      links.classList.toggle('open');
    });

    // Close when clicking a link
    links.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => links.classList.remove('open'));
    });
  }

  // ===== SIDEBAR SCROLL SPY =====

  function initScrollSpy() {
    const sections = document.querySelectorAll('.content-section[id]');
    const links = document.querySelectorAll('.sidebar-nav a');
    if (sections.length === 0 || links.length === 0) return;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          links.forEach(l => l.classList.remove('active'));
          const active = document.querySelector('.sidebar-nav a[href="#' + entry.target.id + '"]');
          if (active) active.classList.add('active');
        }
      });
    }, { rootMargin: '-80px 0px -60% 0px' });

    sections.forEach(s => observer.observe(s));
  }

  // ===== RESET PROGRESS =====

  window.resetProgress = function () {
    if (confirm('Reset all study progress? This cannot be undone.')) {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  };

  // ===== INIT =====

  document.addEventListener('DOMContentLoaded', () => {
    initMobileNav();
    initMarkReadCheckboxes();
    initFlashcards();
    initQuizzes();
    initScrollSpy();
    updateProgressUI();
    updateSidebarMarks();
  });
})();
