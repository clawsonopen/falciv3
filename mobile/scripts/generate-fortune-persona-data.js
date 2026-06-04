const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const identityRoot = path.join(root, 'src', 'identity', 'assistants', 'fortune-family');
const commonIdentityPath = path.join(identityRoot, 'common.md');
const outputPath = path.join(root, 'src', 'services', 'fortunePersonaData.ts');

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error('Identity file is missing frontmatter.');
  }
  const yaml = match[1];
  const body = match[2].trim();
  const readScalar = (key) => {
    const scalar = yaml.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'));
    return scalar ? scalar[1].replace(/^['"]|['"]$/g, '').trim() : '';
  };
  const primaryBlock = yaml.match(/^primary_domain:\s*\r?\n([\s\S]*?)(?=\r?\n\S|$)/m);
  const primaryDomainLabel = primaryBlock?.[1]?.match(/^\s+label:\s*(.+?)\s*$/m)?.[1]?.trim() || '';
  const ageValue = readScalar('age');
  return {
    body,
    id: readScalar('id'),
    displayName: readScalar('display_name') || readScalar('public_label') || readScalar('id'),
    age: ageValue ? Number(ageValue) : null,
    primaryDomainLabel,
  };
}

function parseClosingLibrary(body, id) {
  const section = body.match(/# Persona Closing Library\s*([\s\S]*?)(?=\r?\n# Implementation Notes|\r?\n# [^\n]+|$)/);
  if (!section) {
    throw new Error(`${id}: missing Persona Closing Library section.`);
  }
  const library = {};
  const lines = section[1].split(/\r?\n/);
  let tone = null;
  let current = null;
  const flush = () => {
    if (tone && current) {
      const sentence = current.join(' ').replace(/\s+/g, ' ').trim();
      if (sentence) library[tone].push(sentence);
    }
    current = null;
  };
  for (const line of lines) {
    const heading = line.match(/^##\s+([a-z_ -]+)\s*$/i);
    if (heading) {
      flush();
      tone = heading[1].trim();
      library[tone] = [];
      continue;
    }
    if (!tone) continue;
    const numbered = line.match(/^\s*\d+\.\s+(.+?)\s*$/);
    if (numbered) {
      flush();
      current = [numbered[1]];
      continue;
    }
    const continuation = line.trim();
    if (current && continuation) {
      current.push(continuation);
    }
  }
  flush();
  for (const [toneName, sentences] of Object.entries(library)) {
    if (!sentences.length) throw new Error(`${id}: empty closing tone ${toneName}.`);
    const broken = sentences.find((sentence) => !/[.!?…]$/.test(sentence));
    if (broken) throw new Error(`${id}: closing is not terminally punctuated: ${broken}`);
  }
  return library;
}

function stripClosingLibrary(body) {
  return body
    .replace(/\r?\n# Persona Closing Library\s*[\s\S]*?(?=\r?\n# Implementation Notes|\r?\n# [^\n]+|$)/, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const entries = fs
  .readdirSync(identityRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const filePath = path.join(identityRoot, entry.name, 'identity.md');
    const raw = fs.readFileSync(filePath, 'utf8');
    const meta = parseFrontmatter(raw);
    if (!meta.id) throw new Error(`${filePath}: missing id.`);
    return [
      meta.id,
      {
        assistantId: meta.id,
        displayName: meta.displayName,
        age: meta.age,
        primaryDomainLabel: meta.primaryDomainLabel,
        systemBody: stripClosingLibrary(meta.body),
        closingLibrary: parseClosingLibrary(meta.body, meta.id),
      },
    ];
  })
  .sort(([a], [b]) => a.localeCompare(b, 'tr'));

const data = Object.fromEntries(entries);
const commonIdentityBody = fs.readFileSync(commonIdentityPath, 'utf8').trim();
const source = `// Generated from mobile/src/identity/assistants/fortune-family/*/identity.md and common.md. Do not edit by hand. Update identity markdown and regenerate.\n\nexport const COMMON_FORTUNE_IDENTITY_BODY = ${JSON.stringify(commonIdentityBody, null, 2)};\n\nexport const FORTUNE_PERSONA_DATA = ${JSON.stringify(data, null, 2)} as Record<string, { assistantId: string; displayName: string; age: number | null; primaryDomainLabel: string; systemBody: string; closingLibrary: Record<string, string[]> }>;\n`;

fs.writeFileSync(outputPath, source, 'utf8');
console.log(`Generated ${path.relative(root, outputPath)} with ${entries.length} personas.`);
