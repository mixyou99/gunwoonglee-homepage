// ===========================
// Navigation
// ===========================
const nav = document.getElementById('nav');
const navToggle = document.getElementById('nav-toggle');
const navMenu = document.getElementById('nav-menu');
const navLinks = document.querySelectorAll('.nav-link');

// Scroll-based nav background
window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
});

// Mobile menu toggle
function closeMobileMenu() {
  navToggle.classList.remove('active');
  navMenu.classList.remove('active');
}

navToggle.addEventListener('click', () => {
  navToggle.classList.toggle('active');
  navMenu.classList.toggle('active');
});

// Close mobile menu on link click
navLinks.forEach(link => {
  link.addEventListener('click', () => {
    closeMobileMenu();
  });
});

// Close mobile menu when clicking outside it
document.addEventListener('click', (e) => {
  if (
    navMenu.classList.contains('active') &&
    !navMenu.contains(e.target) &&
    !navToggle.contains(e.target)
  ) {
    closeMobileMenu();
  }
});

// Close mobile menu on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && navMenu.classList.contains('active')) {
    closeMobileMenu();
  }
});

// Active nav link on scroll
const sections = document.querySelectorAll('.section, .hero');

function updateActiveNav() {
  const scrollPos = window.scrollY + 100;

  sections.forEach(section => {
    const top = section.offsetTop;
    const height = section.offsetHeight;
    const id = section.getAttribute('id');

    if (scrollPos >= top && scrollPos < top + height) {
      navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${id}`) {
          link.classList.add('active');
        }
      });
    }
  });
}

window.addEventListener('scroll', updateActiveNav);

// ===========================
// Scroll Animations (Intersection Observer)
// ===========================
const fadeElements = document.querySelectorAll('.fade-in');

const fadeObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        // Stagger animation for siblings
        const siblings = entry.target.parentElement.querySelectorAll('.fade-in');
        let delay = 0;
        siblings.forEach((sibling, i) => {
          if (sibling === entry.target) {
            delay = i * 100;
          }
        });

        setTimeout(() => {
          entry.target.classList.add('visible');
        }, Math.min(delay, 400));

        fadeObserver.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px',
  }
);

fadeElements.forEach(el => fadeObserver.observe(el));

// Trigger hero fade-ins immediately on load
window.addEventListener('DOMContentLoaded', () => {
  const heroFades = document.querySelectorAll('.hero .fade-in');
  heroFades.forEach((el, i) => {
    setTimeout(() => {
      el.classList.add('visible');
    }, 200 + i * 150);
  });
});

// ===========================
// Publications: CV-style groups + conference year sub-menu
// ===========================
const pubFilters = document.querySelectorAll('.pub-filter');
const pubGroups = document.querySelectorAll('.pub-group');

pubFilters.forEach(filter => {
  filter.addEventListener('click', () => {
    const value = filter.dataset.filter;
    pubFilters.forEach(f => {
      const on = f === filter;
      f.classList.toggle('active', on);
      f.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    pubGroups.forEach(group => {
      group.hidden = !(value === 'all' || group.dataset.group === value);
    });
  });
});

document.querySelectorAll('.pub-group').forEach(group => {
  const yearButtons = group.querySelectorAll('.pub-year-btn');
  const yearPanels = group.querySelectorAll('.pub-year-panel');
  yearButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const year = btn.dataset.year;
      yearButtons.forEach(b => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      yearPanels.forEach(panel => {
        panel.hidden = panel.dataset.year !== year;
      });
    });
  });
});

// ===========================
// Media: type filter (Newspaper Article / Video / Op-Ed) — no "All" button;
// the first filter button starts active, so apply it on load too.
// ===========================
const mediaFilters = document.querySelectorAll('.media-filter');
const mediaItems = document.querySelectorAll('.media-item');

function applyMediaFilter(value) {
  mediaItems.forEach(item => {
    item.hidden = !(value === 'all' || item.dataset.type === value);
  });
}

mediaFilters.forEach(filter => {
  filter.addEventListener('click', () => {
    const value = filter.dataset.filter;
    mediaFilters.forEach(f => {
      const on = f === filter;
      f.classList.toggle('active', on);
      f.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    applyMediaFilter(value);
  });
});

if (mediaFilters.length > 0) {
  applyMediaFilter(mediaFilters[0].dataset.filter);
}

// ===========================
// Smooth scroll offset for fixed nav
// ===========================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      const offset = 72;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// ===========================
// Lab members: click a name to see co-authored publications
// ===========================
(() => {
  const dataEl = document.getElementById('lab-pub-data');
  const overlay = document.getElementById('memberModalOverlay');
  if (!dataEl || !overlay) return;

  let memberPubs = {};
  try {
    // HTML comments are not stripped inside <script> content, so the
    // DATA:LABPUBS marker comments build.js uses to locate this block
    // are still present in textContent — remove them before parsing.
    const raw = (dataEl.textContent || '{}').replace(/<!--\s*DATA:LABPUBS:(START|END)\s*-->/g, '').trim();
    memberPubs = JSON.parse(raw || '{}');
  } catch (e) {
    memberPubs = {};
  }

  const modalTitle = document.getElementById('memberModalTitle');
  const modalList = document.getElementById('memberModalList');
  const closeBtn = document.getElementById('memberModalClose');
  let lastFocused = null;

  const TYPE_LABELS = {
    journal: 'Published',
    working: 'Journal Working Paper',
    wp: 'Working Paper',
    progress: 'Work-in-Progress',
    conference: 'Conference'
  };

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function renderModal(memberName, pubs) {
    modalTitle.textContent = `Research with ${memberName}`;
    modalList.innerHTML = pubs.map(p => {
      const titleHtml = p.url
        ? `<a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">${escapeHtml(p.title)}</a>`
        : escapeHtml(p.title);
      const meta = [p.year, p.venue].filter(Boolean).join(' · ');
      return `<div class="member-modal-item">
        <span class="member-modal-type">${escapeHtml(TYPE_LABELS[p.type] || p.type)}</span>
        <h4>${titleHtml}</h4>
        <p class="member-modal-meta">${escapeHtml(p.authors || '')}${meta ? ' — ' + escapeHtml(meta) : ''}</p>
      </div>`;
    }).join('');
  }

  function openModal(memberId, memberName) {
    const pubs = memberPubs[memberId];
    if (!pubs || pubs.length === 0) return;
    renderModal(memberName, pubs);
    lastFocused = document.activeElement;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function closeModal() {
    overlay.hidden = true;
    document.body.style.overflow = '';
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.member-name-btn');
    if (!btn) return;
    const memberId = btn.dataset.member;
    const memberName = btn.textContent.trim().replace(/\d+$/, '').trim();
    openModal(memberId, memberName);
  });

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) closeModal();
  });
})();
