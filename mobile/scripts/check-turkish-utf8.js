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
  'src/data',
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
// Detects Turkish words where ş,ç,ğ,ı,ö,ü were replaced with '?' by non-UTF-8 tools
// Matches patterns like ba?lang?c, g?r?n?r, d?n??t?r, se?im, etc.
const questionMarkReplacementRegex = /[a-zA-Z]\?[a-zA-Z]/;
const malformedTurkishWordRegex =
  /\b(yoğunlukede|yoğunlukdade|yoğunlukta?de|yoğunlukni|yoğunlukı|yoğunlukın|yorgunlukede|telaşede|sakinlikede|huzurede|enerjiede|ritimede|dengedede)\b/iu;

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

function extractStringLiterals(content) {
  const literals = [];
  let quote = null;
  let start = -1;
  let text = '';
  let escaped = false;

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    if (!quote) {
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
        start = i;
        text = '';
        escaped = false;
      }
      continue;
    }

    if (escaped) {
      text += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      text += ch;
      escaped = true;
      continue;
    }

    if (ch === quote) {
      literals.push({ text, index: start });
      quote = null;
      start = -1;
      text = '';
      continue;
    }

    text += ch;
  }

  return literals;
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
      // Skip lines that are themselves detection/repair code
      const trimmed = line.trim();
      if (trimmed.includes('hasBrokenUtf8') || trimmed.includes('mojibakeRegex') ||
          trimmed.includes('_repair_mojibake') || trimmed.includes('marker') ||
          /^\s*return\s+\/.*\.test\(/.test(trimmed)) {
        return;
      }
      issues.push({
        type: 'mojibake',
        filePath,
        line: idx + 1,
        sample: trimmed.slice(0, 180),
      });
    }
  });
  return issues;
}

function checkQuestionMarkReplacement(filePath, content) {
  const issues = [];
  const lineStarts = buildLineIndex(content);
  extractStringLiterals(content).forEach((literal) => {
    if (literal.text.length < 8) return;
    // Count how many '?' appear surrounded by letters
    const qmCount = (literal.text.match(/[a-zA-Z]\?[a-zA-Z]/g) || []).length;
    // If 2+ occurrences in a single string, it's almost certainly corrupted Turkish
    if (qmCount >= 2) {
      issues.push({
        type: 'question-mark-turkish',
        filePath,
        line: lineFromIndex(lineStarts, literal.index),
        sample: literal.text.trim().slice(0, 180),
      });
    }
  });
  return issues;
}

function checkAsciiTurkishOnly(filePath, content) {
  const issues = [];
  const lineStarts = buildLineIndex(content);
  extractStringLiterals(content).forEach((literal) => {
    const text = literal.text;
    if (!asciiTurkishRegex.test(text)) return;
    if (turkishCharRegex.test(text)) return;
    if (looksLikeInternalToken(text)) return;
    const line = lineFromIndex(lineStarts, literal.index);
    issues.push({
      type: 'ascii-turkish',
      filePath,
      line,
      sample: text.trim().slice(0, 180),
    });
  });
  return issues;
}

function checkMalformedTurkishWords(filePath, content) {
  const issues = [];
  const lineStarts = buildLineIndex(content);
  extractStringLiterals(content).forEach((literal) => {
    if (!malformedTurkishWordRegex.test(literal.text)) return;
    issues.push({
      type: 'malformed-turkish-word',
      filePath,
      line: lineFromIndex(lineStarts, literal.index),
      sample: literal.text.trim().slice(0, 180),
    });
  });
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
    findings.push(...checkQuestionMarkReplacement(filePath, content));
    findings.push(...checkMalformedTurkishWords(filePath, content));
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
