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
navToggle.addEventListener('click', () => {
  navToggle.classList.toggle('active');
  navMenu.classList.toggle('active');
});

// Close mobile menu on link click
navLinks.forEach(link => {
  link.addEventListener('click', () => {
    navToggle.classList.remove('active');
    navMenu.classList.remove('active');
  });
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
