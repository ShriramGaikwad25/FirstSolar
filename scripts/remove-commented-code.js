#!/usr/bin/env node
/*
  remove-commented-code.js
  Heuristically removes commented-out code while preserving:
  - License headers (@license, Copyright)
  - ESLint/TS directives (eslint-*, @ts-*, @jsxImportSource)
  - URLs and TODO/FIXME notes
*/

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const includeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.css']);

/**
 * Determine if a single-line comment likely contains code.
 */
function isLikelyCodeComment(line) {
  const l = line.trim();
  if (!l.startsWith('//')) return false;
  const body = l.slice(2).trim();

  // Preserve directives, docs, and notes
  const preservePatterns = [
    /^eslint-/, /@ts-/, /@jsxImportSource/, /@license/i, /copyright/i,
    /^TODO/i, /^FIXME/i, /https?:\/\//i,
  ];
  if (preservePatterns.some((re) => re.test(body))) return false;

  // Indicators of commented-out code
  const codePatterns = [
    /^(import|export)\b/,
    /^(const|let|var)\b/,
    /^function\b/,
    /=>\s*\{/,
    /return\b/,
    /class\s+\w+/,
    /\w+\s*=\s*\(/,
    /<\w+[\s>]/, // JSX-like
    /}\)\s*;?$/,
  ];
  return codePatterns.some((re) => re.test(body));
}

/**
 * Determine if a block comment likely contains code and is safe to remove.
 */
function isRemovableBlockComment(content) {
  const c = content.trim();
  // Preserve licenses and directives and notes
  const preserve = [/@license/i, /copyright/i, /eslint-/, /@ts-/, /TODO/i, /FIXME/i, /https?:\/\//i];
  if (preserve.some((re) => re.test(c))) return false;

  // Contains code-like tokens?
  const codeIndicators = [
    /\b(import|export|function|return|class|extends|implements)\b/,
    /\b(const|let|var)\b/,
    /=>\s*\{/,
    /<\w+[\s>]/, // JSX
    /\)\s*=>/,
    /\{[\s\S]*\}/,
  ];
  return codeIndicators.some((re) => re.test(c));
}

function processFile(filePath) {
  const ext = path.extname(filePath);
  if (!includeExtensions.has(ext)) return;
  let original = fs.readFileSync(filePath, 'utf8');

  // Remove single-line commented-out code lines
  const lines = original.split(/\r?\n/);
  const filteredLines = [];
  for (const line of lines) {
    if (isLikelyCodeComment(line)) {
      // Drop this line
      continue;
    }
    filteredLines.push(line);
  }
  let content = filteredLines.join('\n');

  // Remove block comments that look like code (/* ... */), but preserve JSDoc style unless they look like code
  // Use a loop with regex to progressively remove matches
  const blockRe = /\/\*[\s\S]*?\*\//g;
  content = content.replace(blockRe, (match) => {
    return isRemovableBlockComment(match.replace(/^\/\*/,'').replace(/\*\/$/, '')) ? '' : match;
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.git')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

const files = walk(root);
let changed = 0;
for (const file of files) {
  try {
    if (processFile(file)) changed += 1;
  } catch (err) {
    // Non-fatal; continue
  }
}

console.log(`Removed commented-out code from ${changed} files.`);


