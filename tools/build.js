const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'content.json');
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
  if (type === 'conference') return 2;
  return 3;
}

function sortPublications(pubs) {
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

function generatePublicationHtml(pub) {
  const year = escapeHtml(pub.year || '');
  const title = escapeHtml(pub.title || '');
  const authors = escapeHtml(pub.authors || '');
  const type = pub.type || '';
  const award = pub.award || '';
  const venue = pub.venue || '';

  const awardSpan = award
    ? ` <span style="color:var(--accent);font-size:0.8rem;">(${escapeHtml(award)})</span>`
    : '';

  const venueP = venue
    ? `\n            <p class="pub-venue"><em>${escapeHtml(venue)}</em></p>`
    : '';

  return `        <div class="pub-item fade-in" data-type="${type}">
          <div class="pub-year">${year}</div>
          <div class="pub-details">
            <h3>${title}${awardSpan}</h3>
            <p class="pub-authors">${authors}</p>${venueP}
          </div>
        </div>`;
}

function generateLabHtml(members) {
  const current = members.filter(m => m.status === 'current');
  const alumni = members.filter(m => m.status === 'alumni');

  const cards = [];

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

    cards.push(`          <div class="member-card fade-in">
            <div class="member-avatar">${degree}</div>
            <h4>${name}</h4>${topicP}${pubsUl}
          </div>`);
  }

  // Alumni cards grouped by degree
  const degreeGroups = [
    { degree: 'PhD', label: 'PhD Alumni' },
    { degree: 'MS', label: 'MS Alumni' },
    { degree: 'MSBA', label: 'MSBA Alumni' },
  ];

  for (const group of degreeGroups) {
    const groupAlumni = alumni.filter(a => a.degree === group.degree);
    if (groupAlumni.length === 0) continue;

    const alumniItems = groupAlumni.map(a => {
      const name = escapeHtml(a.name || '');
      const placement = a.placement || '';
      const gradYear = a.gradYear || '';
      const details = [gradYear, placement].filter(Boolean).join(', ');
      if (details) {
        return `              <li><strong>${name}</strong> — ${escapeHtml(details)}</li>`;
      }
      return `              <li><strong>${name}</strong></li>`;
    }).join('\n');

    cards.push(`          <div class="member-card fade-in">
            <div class="member-avatar subtitle">${group.label}</div>
            <h4>${group.label}</h4>
            <ul class="member-pubs">
${alumniItems}
            </ul>
          </div>`);
  }

  return cards.join('\n\n');
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

  // Education
  if (cv.education && cv.education.length > 0) {
    const items = cv.education.map(e => `          <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-date">${escapeHtml(e.year)}</div>
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

  // List sections: honors, service, consulting
  const listSections = [
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
          <p>${officeParts.map(p => escapeHtml(p)).join('<br>')}</p>
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
  let html = fs.readFileSync(INDEX_PATH, 'utf8');

  // Filter hidden items from all sections
  const publications = (data.publications || []).filter(p => !p.hidden);
  const labMembers = (data.labMembers || []).filter(m => !m.hidden);
  const research = (data.research || []).filter(r => !r.hidden);
  const teaching = (data.teaching || []).filter(t => !t.hidden);
  const news = (data.news || []).filter(n => !n.hidden);

  // Generate and replace publications
  const sortedPubs = sortPublications(publications);
  const pubHtml = sortedPubs.map(generatePublicationHtml).join('\n');
  html = replaceSection(html, '<!-- DATA:PUBLICATIONS:START -->', '<!-- DATA:PUBLICATIONS:END -->', pubHtml, '        ');

  // Generate and replace lab members
  const labHtml = generateLabHtml(labMembers);
  html = replaceSection(html, '<!-- DATA:LAB:START -->', '<!-- DATA:LAB:END -->', labHtml, '          ');

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
