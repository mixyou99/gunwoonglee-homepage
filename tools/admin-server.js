const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const PORT = 3000;
const ROOT_DIR = path.join(__dirname, '..');
const DATA_PATH = path.join(ROOT_DIR, 'data', 'content.json');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function readBodyRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseMultipart(buffer, boundary) {
  const parts = [];
  const boundaryBuf = Buffer.from('--' + boundary);
  let pos = 0;

  // Find first boundary
  pos = buffer.indexOf(boundaryBuf, pos);
  if (pos === -1) return parts;
  pos += boundaryBuf.length;

  while (pos < buffer.length) {
    // Skip CRLF after boundary
    if (buffer[pos] === 0x0d && buffer[pos + 1] === 0x0a) pos += 2;

    // Check for end boundary --
    if (buffer[pos] === 0x2d && buffer[pos + 1] === 0x2d) break;

    // Parse headers
    const headerEnd = buffer.indexOf('\r\n\r\n', pos);
    if (headerEnd === -1) break;
    const headers = buffer.slice(pos, headerEnd).toString('utf8');
    pos = headerEnd + 4;

    // Find next boundary
    const nextBoundary = buffer.indexOf(boundaryBuf, pos);
    if (nextBoundary === -1) break;

    // Body is between pos and nextBoundary - 2 (strip trailing CRLF)
    const body = buffer.slice(pos, nextBoundary - 2);
    pos = nextBoundary + boundaryBuf.length;

    const filenameMatch = headers.match(/filename="([^"]+)"/);
    const nameMatch = headers.match(/name="([^"]+)"/);
    parts.push({
      name: nameMatch ? nameMatch[1] : '',
      filename: filenameMatch ? filenameMatch[1] : '',
      data: body,
      headers
    });
  }
  return parts;
}

function extractDocxText(docxBuffer) {
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, 'cv_upload_' + Date.now() + '.docx');
  fs.writeFileSync(tmpFile, docxBuffer);

  try {
    const xml = execSync(`unzip -p "${tmpFile}" word/document.xml`, { maxBuffer: 10 * 1024 * 1024 }).toString('utf8');
    return parseDocxXml(xml);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (e) {}
  }
}

function parseDocxXml(xml) {
  // Extract text from paragraphs
  const paragraphs = [];
  const pRegex = /<w:p[ >][\s\S]*?<\/w:p>/g;
  let match;
  while ((match = pRegex.exec(xml)) !== null) {
    const pXml = match[0];
    // Extract all text runs
    const texts = [];
    const tRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
    let tMatch;
    while ((tMatch = tRegex.exec(pXml)) !== null) {
      texts.push(tMatch[1]);
    }
    const line = texts.join('').trim();
    if (line) paragraphs.push(line);
  }
  return paragraphs;
}

function parseCvSections(paragraphs) {
  const result = {
    publications: [],
    education: [],
    positions: [],
    honors: [],
    service: [],
    consulting: [],
    labMembers: []
  };

  // Try to detect section headers and categorize content
  let currentSection = '';
  const sectionPatterns = {
    publication: /^(publications?|journal\s*(articles?|papers?)|working\s*papers?|conference\s*(papers?|proceedings?)|research\s*papers?|selected\s*publications?|refereed\s*(journal|publications?))/i,
    education: /^(education|academic\s*qualifications?|degrees?)/i,
    position: /^(academic\s*(positions?|appointments?|experience)|employment|professional\s*(experience|positions?)|positions?|experience)/i,
    honor: /^(honors?|awards?|fellowships?|grants?|honors?\s*(and|&)\s*awards?)/i,
    service: /^(service|professional\s*service|editorial|committee|academic\s*service|professional\s*activities)/i,
    consulting: /^(consulting|industry\s*(experience|consulting)|professional\s*consulting)/i,
    lab: /^(lab\s*members?|students?|advisees?|ph\.?d\.?\s*students?|master|graduate\s*students?)/i
  };

  for (const para of paragraphs) {
    // Check if this is a section header
    let matched = false;
    for (const [section, pattern] of Object.entries(sectionPatterns)) {
      if (pattern.test(para)) {
        currentSection = section;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Skip empty or very short lines
    if (para.length < 3) continue;

    // Add content to current section
    switch (currentSection) {
      case 'publication':
        result.publications.push(para);
        break;
      case 'education':
        result.education.push(para);
        break;
      case 'position':
        result.positions.push(para);
        break;
      case 'honor':
        result.honors.push(para);
        break;
      case 'service':
        result.service.push(para);
        break;
      case 'consulting':
        result.consulting.push(para);
        break;
      case 'lab':
        result.labMembers.push(para);
        break;
    }
  }

  return result;
}

const server = http.createServer(async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);

  // API routes
  if (req.url === '/api/data' && req.method === 'GET') {
    try {
      const data = fs.readFileSync(DATA_PATH, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (req.url === '/api/data' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      // Validate JSON
      JSON.parse(body);
      fs.writeFileSync(DATA_PATH, body, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Data saved successfully' }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (req.url === '/api/parse-cv' && req.method === 'POST') {
    try {
      const contentType = req.headers['content-type'] || '';
      const boundaryMatch = contentType.match(/boundary=(.+)/);
      if (!boundaryMatch) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing multipart boundary' }));
        return;
      }

      const rawBody = await readBodyRaw(req);
      const parts = parseMultipart(rawBody, boundaryMatch[1]);
      const filePart = parts.find(p => p.filename && p.filename.endsWith('.docx'));

      if (!filePart) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No .docx file found in upload' }));
        return;
      }

      const paragraphs = extractDocxText(filePart.data);
      const parsed = parseCvSections(paragraphs);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, paragraphs, parsed, filename: filePart.filename }));
    } catch (err) {
      console.error('Parse CV error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (req.url === '/api/build' && req.method === 'POST') {
    try {
      // Clear require cache so build.js picks up changes
      delete require.cache[require.resolve('./build.js')];
      const { build } = require('./build.js');
      build();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Build completed successfully' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (req.url === '/api/deploy' && req.method === 'POST') {
    try {
      // Build first
      delete require.cache[require.resolve('./build.js')];
      const { build } = require('./build.js');
      build();

      // Git add, commit, push
      const gitCommands = [
        'git add -A',
        'git commit -m "Update site content" --allow-empty',
        'git push origin main'
      ];
      let output = '';
      for (const cmd of gitCommands) {
        try {
          output += execSync(cmd, { cwd: ROOT_DIR, timeout: 30000 }).toString() + '\n';
        } catch (cmdErr) {
          // git commit may fail if nothing to commit - that's ok
          if (!cmd.includes('commit')) throw cmdErr;
          output += 'Nothing new to commit.\n';
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Deployed successfully', output }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Static file serving
  let filePath = req.url.split('?')[0];
  if (filePath === '/') filePath = '/index.html';

  const fullPath = path.join(ROOT_DIR, filePath);

  // Prevent directory traversal
  if (!fullPath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(fullPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(fullPath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  }
});

server.listen(PORT, () => {
  console.log(`Admin panel: http://localhost:${PORT}/admin.html`);
});
