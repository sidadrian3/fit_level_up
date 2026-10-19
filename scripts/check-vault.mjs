import { readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const vaultDir = join(fileURLToPath(new URL('..', import.meta.url)), 'vault');
const MARKER_EXEMPT_NOTES = new Set([
  'Codebase Simplification Audit.md',
  'Apartment Dashboard UX Audit.md',
]);
const WIKILINK = /!?\[\[([^\]]+)\]\]/g;
const MARKER = /~~|\*\*Corrected/;

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.')) {
      return [];
    }
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

function stripCode(text) {
  return text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
}

function linkTarget(raw) {
  return raw.split('|')[0].split('#')[0].trim();
}

const files = listFiles(vaultDir);
const knownTargets = new Set();
for (const file of files) {
  const path = relative(vaultDir, file);
  knownTargets.add(path.toLowerCase());
  knownTargets.add(
    (extname(file) === '.md' ? path.slice(0, -3) : path).toLowerCase(),
  );
  knownTargets.add(basename(file).toLowerCase());
  knownTargets.add(basename(file, '.md').toLowerCase());
}

const problems = [];
for (const file of files.filter((f) => extname(f) === '.md')) {
  const note = relative(vaultDir, file);
  const text = readFileSync(file, 'utf8');

  for (const [, raw] of stripCode(text).matchAll(WIKILINK)) {
    const target = linkTarget(raw);
    if (target !== '' && !knownTargets.has(target.toLowerCase())) {
      problems.push(`${note}: [[${raw}]] resolves to no file`);
    }
  }

  const inVaultRoot = !note.includes('/');
  if (inVaultRoot && !MARKER_EXEMPT_NOTES.has(note) && MARKER.test(text)) {
    problems.push(`${note}: contains a strikethrough or Corrected marker`);
  }
}

if (problems.length > 0) {
  console.error(`${problems.length} vault problem(s):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`Vault OK: ${files.length} files checked.`);
