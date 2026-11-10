const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'content.json');
const NEWS_PATH = path.join(__dirname, '..', 'data', 'news.json');
const LAB_PATH = path.join(__dirname, '..', 'data', 'lab.json');
const INDEX_PATH = path.join(__dirname, '..', 'index.html');

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;');
}

function yearSortKey(year) {
  // Non-numeric years sort before numeric ones (lower = first)
  const num = parseInt(year, 10);
  if (isNaN(num)) return 0;
  return 1;
}

function yearSortValue(year) {
  const num = parseInt(year, 10);
  if (isNaN(num)) {
    // Order among non-numeric: R&R first, Under Review next, Working last
    if (year === 'R&R') return 3;
    if (year === 'Under Review') return 2;
    if (year === 'Working') return 1;
    return 0;
  }
  return num;
}

function typeSortKey(type) {
  if (type === 'journal') return 0;
  if (type === 'working') return 1;
  if (type === 'wp') return 2;
  if (type === 'progress') return 3;
  if (type === 'conference') return 4;
  return 5;
}

function sortPublications(pubs) {
  // 관리자(admin.html)에서 수동으로 지정한 순서(order)가 모두 있으면 그 순서를 그대로 사용
  const allHaveOrder = pubs.length > 0 && pubs.every(p => typeof p.order === 'number');
  if (allHaveOrder) {
    return pubs.slice().sort((a, b) => a.order - b.order);
  }

  // order가 없으면 기존 기본 정렬(종류 → 연도 내림차순)로 폴백
  return pubs.slice().sort((a, b) => {
    // First sort by type: journal, working, conference
    const typeDiff = typeSortKey(a.type) - typeSortKey(b.type);
    if (typeDiff !== 0) return typeDiff;

    // Within same type, sort by year descending
    // Non-numeric years come before numeric years
    const aIsNonNumeric = yearSortKey(a.year);
    const bIsNonNumeric = yearSortKey(b.year);
    if (aIsNonNumeric !== bIsNonNumeric) return aIsNonNumeric - bIsNonNumeric;

    // Both non-numeric or both numeric: sort descending by value
    return yearSortValue(b.year) - yearSortValue(a.year);
  });
}

// 공개 사이트 Publications 구성 — CV와 같은 순서·이름의 묶음
const PUB_GROUPS = [
  { type: 'journal', title: 'Published', note: 'Journal Articles', showYear: true, showCount: false },
  { type: 'working', title: 'Journal Working Papers', note: 'Revise & Resubmit (R&R) / Under Review', showYear: false },
  { type: 'wp', title: 'Working Papers', note: 'Complete manuscripts available at SSRN · target journals noted', showYear: false },
  { type: 'progress', title: 'Work-in-Progress', note: '', showYear: false },
  { type: 'conference', title: 'Conferences', note: 'Selected conference proceedings & presentations', showYear: false }
];
// CV처럼 2015년 이전 학회 발표는 한 묶음("~2015")으로 보여준다
const CONF_EARLY_CUTOFF = 2015;
const CONF_EARLY_LABEL = '~2015';

function sortWithinGroup(pubs) {
  return sortPublications(pubs);
}

function generatePublicationHtml(pub, showYear) {
  const year = escapeHtml(pub.year || '');
  const title = escapeHtml(pub.title || '');
  const authors = escapeHtml(pub.authors || '');
  const type = pub.type || '';
  const award = pub.award || '';
  const venue = pub.venue || '';

  const awardSpan = award ? ` <span class="pub-award">${escapeHtml(award)}</span>` : '';
  const venueP = venue ? `\n    <p class="pub-venue"><em>${escapeHtml(venue)}</em></p>` : '';
  const yearDiv = showYear ? `\n  <div class="pub-year">${year}</div>` : '';
  const url = pub.url || '';
  const titleHtml = url
    ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${title}<span class="pub-link-icon" aria-hidden="true">&#8599;</span></a>`
    : title;

  return `<div class="pub-item${showYear ? '' : ' no-year'}" data-type="${type}" data-id="${pub.id}">${yearDiv}
  <div class="pub-details">
    <h3>${titleHtml}${awardSpan}</h3>
    <p class="pub-authors">${authors}</p>${venueP}
  </div>
</div>`;
}

function indentBlock(text, spaces) {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map(line => (line ? pad + line : line)).join('\n');
}

function confYearKey(year) {
  const num = parseInt(year, 10);
  if (isNaN(num)) return String(year || 'Other');
  return num <= CONF_EARLY_CUTOFF ? CONF_EARLY_LABEL : String(num);
}

function generateConferenceBody(pubs) {
  const byYear = new Map();
  for (const p of sortWithinGroup(pubs)) {
    const key = confYearKey(p.year);
    if (!byYear.has(key)) byYear.set(key, []);
    byYear.get(key).push(p);
  }
  const rank = k => (k === CONF_EARLY_LABEL ? CONF_EARLY_CUTOFF : (parseInt(k, 10) || -1));
  const keys = [...byYear.keys()].sort((a, b) => rank(b) - rank(a));

  const buttons = keys.map((k, i) =>
    `  <button class="pub-year-btn${i === 0 ? ' active' : ''}" data-year="${escapeHtml(k)}" role="tab" aria-selected="${i === 0}">${escapeHtml(k)}<span class="pub-year-count">${byYear.get(k).length}</span></button>`
  ).join('\n');

  const panels = keys.map((k, i) => {
    const items = byYear.get(k).map(p => generatePublicationHtml(p, k === CONF_EARLY_LABEL)).join('\n');
    return `<div class="pub-year-panel" data-year="${escapeHtml(k)}" role="tabpanel"${i === 0 ? '' : ' hidden'}>
${indentBlock(items, 2)}
</div>`;
  }).join('\n');

  return `<div class="pub-years" role="tablist" aria-label="Conference year">
${buttons}
</div>
${panels}`;
}

function generatePublicationsHtml(publications) {
  const known = new Set(PUB_GROUPS.map(g => g.type));
  const groups = PUB_GROUPS.slice();
  // 알 수 없는 종류가 생겨도 사라지지 않도록 맨 뒤에 따로 보여준다
  for (const t of new Set(publications.map(p => p.type))) {
    if (!known.has(t)) groups.push({ type: t, title: t || 'Other', note: '', showYear: true });
  }

  return groups.map(g => {
    const pubs = publications.filter(p => p.type === g.type);
    if (pubs.length === 0) return '';
    const note = g.note ? `\n    <span class="pub-group-note">${escapeHtml(g.note)}</span>` : '';
    const countSpan = g.showCount === false ? '' : `\n    <span class="pub-group-count">${pubs.length}</span>`;
    const body = g.type === 'conference'
      ? generateConferenceBody(pubs)
      : `<div class="pub-group-items">
${indentBlock(sortWithinGroup(pubs).map(p => generatePublicationHtml(p, g.showYear)).join('\n'), 2)}
</div>`;
    return `<div class="pub-group" data-group="${g.type}">
  <div class="pub-group-head fade-in">
    <h3 class="pub-group-title">${escapeHtml(g.title)}</h3>${note}${countSpan}
  </div>
${indentBlock(body, 2)}
</div>`;
  }).filter(Boolean).join('\n');
}

// 학생 이름 ↔ 같이 쓴 논문 매칭 (성 + 이름 첫 글자로 매칭, 흔한 성+이니셜 충돌은 수동 보정)
const MEMBER_PUB_OVERRIDE_INCLUDE = {
  'Seunghun Lee': [4],
  'Seonyoung Lee': [82, 98, 99, 102],
  // MSBA alumni (professional track, no co-authored research listed in CV) —
  // force zero matches since last-name+initial matching produces false
  // positives against unrelated authors with common Korean surnames.
  'Jonghan Park': [],
  'Jeonghyo Lee': [],
  'Eunbyeol Shin': [],
  'Heeseok Kim': [],
  'Seongjin Jeon': [],
  'Dasom Lee': [],
  'Ayoung Kim': [],
  'Jakyung Lee': [],
  'Sujin Lee': [],
  'Jeongeun Oh': [],
  'Jonghan Kim': [],
  'Eunchan Jang': [],
  'Eunwon Cha': []
};
const MEMBER_PUB_OVERRIDE_EXCLUDE = {
  'JeeHee Kim': [7, 13, 92, 138, 154, 175, 182, 212]
};

function authorTokens(authors) {
  const a = (authors || '').replace(/\([^)]*\)/g, '').replace(/ and /g, ', ').replace(/&/g, ',');
  const parts = a.split(',').map(s => s.trim()).filter(Boolean);
  const out = [];
  let i = 0;
  while (i < parts.length - 1) {
    const last = parts[i];
    const m = parts[i + 1].match(/^([A-Z])(?:[-.][A-Z])*\.?$/);
    if (m) {
      out.push(last + '|' + m[1]);
      i += 2;
    } else {
      i += 1;
    }
  }
  return out;
}

function memberKey(name) {
  const toks = (name || '').trim().split(/\s+/);
  return toks[toks.length - 1] + '|' + toks[0][0];
}

function buildMemberPubIndex(members, publications) {
  const visible = publications.filter(p => !p.hidden);
  const idx = {};
  for (const m of members) {
    const key = memberKey(m.name);
    let ids = visible.filter(p => authorTokens(p.authors).includes(key)).map(p => p.id);
    if (MEMBER_PUB_OVERRIDE_INCLUDE[m.name]) ids = MEMBER_PUB_OVERRIDE_INCLUDE[m.name].slice();
    if (MEMBER_PUB_OVERRIDE_EXCLUDE[m.name]) {
      const excl = new Set(MEMBER_PUB_OVERRIDE_EXCLUDE[m.name]);
      ids = ids.filter(id => !excl.has(id));
    }
    if (ids.length > 0) {
      idx[m.id] = ids.map(id => {
        const p = visible.find(x => x.id === id);
        return { id: p.id, type: p.type, year: p.year, title: p.title, authors: p.authors, venue: p.venue, award: p.award || '', url: p.url || '' };
      });
    }
  }
  return idx;
}

function generateLabHtml(members, publications) {
  const memberPubIndex = buildMemberPubIndex(members, publications || []);
  const current = members.filter(m => m.status === 'current');
  const alumni = members.filter(m => m.status === 'alumni');

  const currentCards = [];
  const alumniCards = [];

  // Current members
  for (const member of current) {
    const degree = escapeHtml(member.degree || '');
    const name = escapeHtml(member.name || '');
    const topic = member.topic || '';
    const pubs = member.pubs || [];

    const topicP = topic
      ? `\n            <p class="member-topic">${escapeHtml(topic)}</p>`
      : '';

    let pubsUl = '';
    if (pubs.length > 0) {
      const items = pubs.map(p => `              <li>${escapeHtml(p)}</li>`).join('\n');
      pubsUl = `\n            <ul class="member-pubs">\n${items}\n            </ul>`;
    }

    const hasPubs = !!memberPubIndex[member.id];
    const nameHtml = hasPubs
      ? `<button type="button" class="member-name-btn" data-member="${member.id}">${name}<span class="member-pub-badge">${memberPubIndex[member.id].length}</span></button>`
      : name;

    currentCards.push(`          <div class="member-card fade-in">
            <div class="member-avatar">${degree}</div>
            <h4>${nameHtml}</h4>${topicP}${pubsUl}
          </div>`);
  }

  // Alumni cards grouped by degree
  const degreeGroups = [
    { degree: 'PhD', label: 'PhD' },
    { degree: 'MS', label: 'MS' },
    { degree: 'MSBA', label: 'MSBA' },
  ];

  for (const group of degreeGroups) {
    const groupAlumni = alumni.filter(a => a.degree === group.degree).slice().sort((a, b) => {
      const ya = parseInt(a.gradYear, 10);
      const yb = parseInt(b.gradYear, 10);
      const aNum = !isNaN(ya), bNum = !isNaN(yb);
      if (aNum && bNum) return ya - yb;
      if (aNum !== bNum) return aNum ? -1 : 1; // unknown year sorts last
      return 0;
    });
    if (groupAlumni.length === 0) continue;

    const alumniItems = groupAlumni.map(a => {
      const name = escapeHtml(a.name || '');
      const placement = a.placement || '';
      const gradYear = a.gradYear || '';
      const details = [gradYear, placement].filter(Boolean).join(', ');
      const hasPubs = !!memberPubIndex[a.id];
      const nameHtml = hasPubs
        ? `<button type="button" class="member-name-btn" data-member="${a.id}"><strong>${name}</strong><span class="member-pub-badge">${memberPubIndex[a.id].length}</span></button>`
        : `<strong>${name}</strong>`;
      if (details) {
        return `              <li>${nameHtml} — ${escapeHtml(details)}</li>`;
      }
      return `              <li>${nameHtml}</li>`;
    }).join('\n');

    alumniCards.push(`          <div class="member-card fade-in">
            <div class="member-avatar subtitle">${group.label}</div>
            <h4>${group.label} Alumni</h4>
            <ul class="member-pubs">
${alumniItems}
            </ul>
          </div>`);
  }

  const html = `        <h4 class="lab-group-subtitle fade-in">Current Members</h4>
        <div class="member-grid">
${currentCards.join('\n\n')}
        </div>
        <h4 class="lab-group-subtitle fade-in">Alumni</h4>
        <div class="member-grid">
${alumniCards.join('\n\n')}
        </div>`;

  return { html, index: memberPubIndex };
}

function generateAboutHtml(about) {
  if (!about || !about.paragraphs || about.paragraphs.length === 0) return '';
  return about.paragraphs.map(p => {
    // paragraphs may contain safe HTML tags (strong, em, a), so don't escape those
    return `        <p>\n          ${p}\n        </p>`;
  }).join('\n');
}

function generateCvHtml(cv) {
  if (!cv) return '';
  const sections = [];

  // Education (dates intentionally omitted per site policy)
  if (cv.education && cv.education.length > 0) {
    const items = cv.education.map(e => `          <div class="timeline-item no-date">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <h4>${escapeHtml(e.title)}</h4>
              <p>${escapeHtml(e.institution)}</p>
            </div>
          </div>`).join('\n');
    sections.push(`      <div class="cv-section fade-in">
        <h3 class="cv-subtitle">Education</h3>
        <div class="timeline">
${items}
        </div>
      </div>`);
  }

  // Academic Positions
  if (cv.positions && cv.positions.length > 0) {
    const items = cv.positions.map(p => {
      const dotClass = p.current ? ' active' : '';
      const date = p.date.replace(/—/g, '&mdash;').replace(/–/g, '&ndash;');
      return `          <div class="timeline-item">
            <div class="timeline-dot${dotClass}"></div>
            <div class="timeline-date">${date}</div>
            <div class="timeline-content">
              <h4>${escapeHtml(p.title)}</h4>
              <p>${escapeHtml(p.institution)}</p>
            </div>
          </div>`;
    }).join('\n');
    sections.push(`\n      <div class="cv-section fade-in">
        <h3 class="cv-subtitle">Academic Positions</h3>
        <div class="timeline">
${items}
        </div>
      </div>`);
  }

  // List sections: university service, honors, service, consulting
  const listSections = [
    { key: 'universityService', title: 'University & School Service' },
    { key: 'honors', title: 'Honors & Awards' },
    { key: 'service', title: 'Academic Service' },
    { key: 'consulting', title: 'Industry Consulting' }
  ];

  for (const ls of listSections) {
    const items = cv[ls.key];
    if (items && items.length > 0) {
      const lis = items.map(item => {
        const escaped = escapeHtml(item).replace(/—/g, '&mdash;').replace(/–/g, '&ndash;');
        return `          <li>${escaped}</li>`;
      }).join('\n');
      sections.push(`      <div class="cv-section fade-in">
        <h3 class="cv-subtitle">${escapeHtml(ls.title).replace(/&amp;/g, '&amp;')}</h3>
        <ul class="cv-list">
${lis}
        </ul>
      </div>`);
    }
  }

  return sections.join('\n');
}

const ICON_SVG = {
  cube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>'
};

function generateResearchHtml(items) {
  if (!items || items.length === 0) return '';
  return items.map(r => {
    const svg = ICON_SVG[r.icon] || ICON_SVG.cube;
    return `        <div class="research-card fade-in">
          <div class="research-icon">
            ${svg}
          </div>
          <h3>${escapeHtml(r.title)}</h3>
          <p>${escapeHtml(r.description)}</p>
        </div>`;
  }).join('\n');
}

function generateTeachingHtml(items) {
  if (!items || items.length === 0) return '';
  return items.map(t => `        <div class="teaching-card fade-in">
          <div class="teaching-level">${escapeHtml(t.level)}</div>
          <h3>${escapeHtml(t.title)}</h3>
          <p>${escapeHtml(t.description)}</p>
        </div>`).join('\n');
}

function generateNewsHtml(items) {
  if (!items || items.length === 0) return '';
  return items.map(n => {
    const linkHtml = n.link ? ` <a href="${n.link}" target="_blank" rel="noopener">[${escapeHtml(n.linkLabel || 'Link')}]</a>` : '';
    // content may contain safe HTML tags
    return `        <div class="news-item fade-in">
          <div class="news-date">${escapeHtml(n.date)}</div>
          <div class="news-content">
            <h3>${escapeHtml(n.title)}</h3>
            <p>${n.content}${linkHtml}</p>
          </div>
        </div>`;
  }).join('\n');
}

const MEDIA_TYPE_LABELS = {
  'article': 'Newspaper Article',
  'video': 'Video',
  'op-ed': 'Op-Ed'
};

function generateMediaHtml(items) {
  if (!items || items.length === 0) {
    return { html: '<p class="media-empty">No media items yet.</p>', filters: [] };
  }
  const typesPresent = [];
  items.forEach(m => { if (!typesPresent.includes(m.type)) typesPresent.push(m.type); });

  const cards = items.map(m => {
    const linkHtml = m.link
      ? ` <a href="${escapeHtml(m.link)}" target="_blank" rel="noopener">${escapeHtml(m.linkLabel || 'Link')}<span class="pub-link-icon" aria-hidden="true">&#8599;</span></a>`
      : '';
    const outlet = m.outlet ? `<span class="media-outlet">${escapeHtml(m.outlet)}</span>` : '';
    return `        <div class="media-item fade-in" data-type="${escapeHtml(m.type)}">
          <div class="media-type-badge">${escapeHtml(MEDIA_TYPE_LABELS[m.type] || m.type)}</div>
          <div class="media-date">${escapeHtml(m.date)}</div>
          <div class="media-content">
            <h3>${escapeHtml(m.title)}</h3>
            ${outlet}
            <p>${m.content || ''}${linkHtml}</p>
          </div>
        </div>`;
  }).join('\n');

  return { html: cards, filters: typesPresent };
}

function generateMediaFilterHtml(filters) {
  if (!filters || filters.length === 0) return '';
  const buttons = ['        <button type="button" class="media-filter active" data-filter="all" aria-pressed="true">All</button>']
    .concat(filters.map(t => `        <button type="button" class="media-filter" data-filter="${escapeHtml(t)}" aria-pressed="false">${escapeHtml(MEDIA_TYPE_LABELS[t] || t)}</button>`));
  return buttons.join('\n');
}

function generateStoryHtml(items) {
  if (!items || items.length === 0) {
    return '<p class="story-empty">Photos coming soon.</p>';
  }
  return items.map(s => `        <figure class="story-item fade-in">
          <img src="${escapeHtml(s.image)}" alt="${escapeHtml(s.caption || '')}" loading="lazy">
          ${s.caption ? `<figcaption>${escapeHtml(s.caption)}</figcaption>` : ''}
        </figure>`).join('\n');
}

function generateContactHtml(contact) {
  if (!contact) return '';
  const officeParts = (contact.office || '').split('\n');
  const hoursParts = (contact.hours || '').split('\n');
  return `        <div class="contact-card fade-in">
          <div class="contact-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          </div>
          <h3>Email</h3>
          <a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a>
        </div>
        <div class="contact-card fade-in">
          <div class="contact-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          </div>
          <h3>Phone</h3>
          <a href="tel:+82-2-3290-1920">${escapeHtml(contact.phone)}</a>
        </div>
        <div class="contact-card fade-in">
          <div class="contact-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <h3>Office</h3>
          <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((contact.office || '').replace(/\n/g, ', '))}" target="_blank" rel="noopener">${officeParts.map(p => escapeHtml(p)).join('<br>')}</a>
        </div>
        <div class="contact-card fade-in">
          <div class="contact-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <h3>Office Hours</h3>
          <p>${hoursParts.map(p => escapeHtml(p).replace(/—/g, '&mdash;')).join('<br>')}</p>
        </div>`;
}

function replaceSection(html, startMarker, endMarker, newContent, indent) {
  const regex = new RegExp(
    `(${escapeRegex(startMarker)})[\\s\\S]*?(${escapeRegex(endMarker)})`,
    ''
  );
  return html.replace(regex, `$1\n${newContent}\n${indent}$2`);
}

function build() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  // news/labMembers는 CMS(학생 편집 가능 범위)가 다루는 별도 파일로 분리되어 있음 - 합쳐서 사용
  const newsData = JSON.parse(fs.readFileSync(NEWS_PATH, 'utf8'));
  const labData = JSON.parse(fs.readFileSync(LAB_PATH, 'utf8'));
  data.news = newsData.news;
  data.labMembers = labData.labMembers;
  let html = fs.readFileSync(INDEX_PATH, 'utf8');

  // Filter hidden items from all sections
  const publications = (data.publications || []).filter(p => !p.hidden);
  const labMembers = (data.labMembers || []).filter(m => !m.hidden);
  const research = (data.research || []).filter(r => !r.hidden);
  const teaching = (data.teaching || []).filter(t => !t.hidden);
  const news = (data.news || []).filter(n => !n.hidden);
  const media = (data.media || []).filter(m => !m.hidden);
  const story = (data.story || []).filter(s => !s.hidden);

  // Generate and replace publications
  const pubHtml = indentBlock(generatePublicationsHtml(publications), 8);
  html = replaceSection(html, '<!-- DATA:PUBLICATIONS:START -->', '<!-- DATA:PUBLICATIONS:END -->', pubHtml, '        ');

  // Generate and replace lab members
  const labResult = generateLabHtml(labMembers, publications);
  html = replaceSection(html, '<!-- DATA:LAB:START -->', '<!-- DATA:LAB:END -->', labResult.html, '          ');

  // Embed the member -> co-authored-publications index for the client-side modal
  const labPubJson = JSON.stringify(labResult.index);
  html = replaceSection(html, '<!-- DATA:LABPUBS:START -->', '<!-- DATA:LABPUBS:END -->', labPubJson, '  ');

  // Generate and replace About
  const aboutHtml = generateAboutHtml(data.about);
  html = replaceSection(html, '<!-- DATA:ABOUT:START -->', '<!-- DATA:ABOUT:END -->', aboutHtml, '        ');

  // Generate and replace CV
  const cvHtml = generateCvHtml(data.cv);
  html = replaceSection(html, '<!-- DATA:CV:START -->', '<!-- DATA:CV:END -->', cvHtml, '      ');

  // Generate and replace Research
  const researchHtml = generateResearchHtml(research);
  html = replaceSection(html, '<!-- DATA:RESEARCH:START -->', '<!-- DATA:RESEARCH:END -->', researchHtml, '        ');

  // Generate and replace Teaching
  const teachingHtml = generateTeachingHtml(teaching);
  html = replaceSection(html, '<!-- DATA:TEACHING:START -->', '<!-- DATA:TEACHING:END -->', teachingHtml, '        ');

  // Generate and replace News
  const newsHtml = generateNewsHtml(news);
  html = replaceSection(html, '<!-- DATA:NEWS:START -->', '<!-- DATA:NEWS:END -->', newsHtml, '        ');

  // Generate and replace Media
  const mediaResult = generateMediaHtml(media);
  html = replaceSection(html, '<!-- DATA:MEDIA:START -->', '<!-- DATA:MEDIA:END -->', mediaResult.html, '        ');
  html = replaceSection(html, '<!-- DATA:MEDIA_FILTERS:START -->', '<!-- DATA:MEDIA_FILTERS:END -->', generateMediaFilterHtml(mediaResult.filters), '        ');

  // Generate and replace Story
  const storyHtml = generateStoryHtml(story);
  html = replaceSection(html, '<!-- DATA:STORY:START -->', '<!-- DATA:STORY:END -->', storyHtml, '        ');

  // Generate and replace Contact
  const contactHtml = generateContactHtml(data.contact);
  html = replaceSection(html, '<!-- DATA:CONTACT:START -->', '<!-- DATA:CONTACT:END -->', contactHtml, '        ');

  fs.writeFileSync(INDEX_PATH, html, 'utf8');

  const currentCount = labMembers.filter(m => m.status === 'current').length;
  const alumniCount = labMembers.filter(m => m.status === 'alumni').length;
  const totalMembers = currentCount + alumniCount;

  console.log(`Built index.html: ${publications.length} publications, ${totalMembers} lab members, ${(data.about?.paragraphs || []).length} about paragraphs, ${Object.keys(data.cv || {}).length} cv sections`);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { build };

if (require.main === module) {
  build();
}
