/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const mojibakeScopes = [
  'App.tsx',
  'src',
];

const strictTurkishScopes = [
  'App.tsx',
  'src/screens',
  'src/components',
  'src/hooks',
  'src/config',
  'src/services',
];

const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.json', '.md']);

const ignorePathPart = [
  `${path.sep}node_modules${path.sep}`,
  `${path.sep}.git${path.sep}`,
  `${path.sep}android${path.sep}build${path.sep}`,
  `${path.sep}.expo${path.sep}`,
];

const mojibakeRegex = /Ã.|Ä.|Å.|�/;
const turkishCharRegex = /[çğıöşüÇĞİÖŞÜ]/;
const asciiTurkishRegex =
  /\b(icin|Icin|lutfen|Lutfen|gorsel|Gorsel|yanlis|Yanlis|hafiza|Hafiza|secim|Secim|secili|Secili|simdi|Simdi|basla|Basla|baslat|Baslat|fali|Fali|falci|Falci|giris|Giris|cikis|Cikis|fotograf|Fotograf|tabagi|Tabagi|acilis|Acilis|avuc|Avuc)\b/;

function shouldIgnore(filePath) {
  return ignorePathPart.some((part) => filePath.includes(part));
}

function collectFiles(scopePath) {
  const full = path.resolve(scopePath);
  if (!fs.existsSync(full)) return [];

  const stat = fs.statSync(full);
  if (stat.isFile()) return [full];

  const out = [];
  const stack = [full];
  while (stack.length) {
    const cur = stack.pop();
    const entries = fs.readdirSync(cur, { withFileTypes: true });
    for (const entry of entries) {
      const fp = path.join(cur, entry.name);
      if (shouldIgnore(fp)) continue;
      if (entry.isDirectory()) {
        stack.push(fp);
        continue;
      }
      if (allowedExtensions.has(path.extname(entry.name))) out.push(fp);
    }
  }
  return out;
}

function buildLineIndex(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

function lineFromIndex(starts, idx) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (starts[mid] <= idx) lo = mid + 1;
    else hi = mid - 1;
  }
  return hi + 1;
}

function looksLikeInternalToken(text) {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (trimmed.includes('${')) return true;
  if (/^[a-z0-9_.:/-]+$/i.test(trimmed)) return true;
  if (trimmed.includes('profile:')) return true;
  return false;
}

function checkMojibake(filePath, content) {
  const issues = [];
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (mojibakeRegex.test(line)) {
      issues.push({
        type: 'mojibake',
        filePath,
        line: idx + 1,
        sample: line.trim().slice(0, 180),
      });
    }
  });
  return issues;
}

function checkAsciiTurkishOnly(filePath, content) {
  const issues = [];
  const lineStarts = buildLineIndex(content);
  const literalRegex = /(["'`])((?:\\.|(?!\1)[\s\S])*)\1/g;
  let match;
  while ((match = literalRegex.exec(content)) !== null) {
    const text = match[2];
    if (!asciiTurkishRegex.test(text)) continue;
    if (turkishCharRegex.test(text)) continue;
    if (looksLikeInternalToken(text)) continue;
    const line = lineFromIndex(lineStarts, match.index);
    issues.push({
      type: 'ascii-turkish',
      filePath,
      line,
      sample: text.trim().slice(0, 180),
    });
  }
  return issues;
}

function unique(arr) {
  return [...new Set(arr)];
}

function run() {
  const mojibakeFiles = unique(mojibakeScopes.flatMap(collectFiles));
  const strictFiles = unique(strictTurkishScopes.flatMap(collectFiles));

  const findings = [];

  for (const filePath of mojibakeFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    findings.push(...checkMojibake(filePath, content));
  }

  for (const filePath of strictFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    findings.push(...checkAsciiTurkishOnly(filePath, content));
  }

  if (!findings.length) {
    console.log('UTF-8/Türkçe kontrolü geçti.');
    return;
  }

  console.error('UTF-8/Türkçe kontrol hataları:');
  findings.forEach((f) => {
    console.error(`- [${f.type}] ${path.relative(process.cwd(), f.filePath)}:${f.line} -> ${f.sample}`);
  });
  process.exitCode = 1;
}

run();
