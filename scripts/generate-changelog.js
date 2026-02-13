#!/usr/bin/env node

/**
 * Generiert eine changelog.json aus der Git-Historie.
 * Wird im Prebuild-Step ausgeführt, damit die Daten auf Vercel verfügbar sind.
 * 
 * Usage: node scripts/generate-changelog.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Git log format: hash|shortHash|author|date|subject
const GIT_LOG_FORMAT = '%H|%h|%an|%ai|%s';
const MAX_COMMITS = 500;

// Bekannte Typen und Aliase normalisieren
const KNOWN_TYPES = new Set(['feat', 'fix', 'refactor', 'chore', 'docs', 'style', 'perf', 'test', 'ci', 'build']);
const TYPE_ALIASES = {
  feature: 'feat',
  bugfix: 'fix',
  hotfix: 'fix',
  doc: 'docs',
  styling: 'style',
  performance: 'perf',
  tests: 'test',
  testing: 'test',
  maintenance: 'chore',
  cleanup: 'chore',
};

function normalizeType(rawType) {
  const lower = rawType.toLowerCase();
  if (KNOWN_TYPES.has(lower)) return lower;
  if (TYPE_ALIASES[lower]) return TYPE_ALIASES[lower];
  return 'other';
}

function parseCommitMessage(subject) {
  // Conventional commit pattern: type(scope): message
  const conventionalMatch = subject.match(/^(\w+)(?:\(([^)]+)\))?\s*:\s*(.+)$/);
  
  if (conventionalMatch) {
    return {
      type: normalizeType(conventionalMatch[1]),
      scope: conventionalMatch[2] || null,
      message: conventionalMatch[3].trim(),
    };
  }

  // Fallback: kein conventional commit format
  return {
    type: 'other',
    scope: null,
    message: subject,
  };
}

function getTypeLabel(type) {
  const labels = {
    feat: 'Feature',
    fix: 'Bugfix',
    refactor: 'Refactoring',
    chore: 'Wartung',
    docs: 'Dokumentation',
    style: 'Styling',
    perf: 'Performance',
    test: 'Tests',
    ci: 'CI/CD',
    build: 'Build',
    other: 'Sonstiges',
  };
  return labels[type] || 'Sonstiges';
}

function main() {
  try {
    const gitLog = execSync(
      `git log --pretty=format:'${GIT_LOG_FORMAT}' -${MAX_COMMITS}`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );

    const commits = gitLog
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const parts = line.split('|');
        const hash = parts[0];
        const shortHash = parts[1];
        const author = parts[2];
        const date = parts[3];
        const subject = parts.slice(4).join('|'); // Subject kann | enthalten

        const parsed = parseCommitMessage(subject);

        return {
          hash,
          shortHash,
          author,
          date: date.trim(),
          subject,
          type: parsed.type,
          typeLabel: getTypeLabel(parsed.type),
          scope: parsed.scope,
          message: parsed.message,
        };
      });

    // Nach Datum gruppieren (YYYY-MM-DD)
    const grouped = {};
    commits.forEach(commit => {
      const dateKey = commit.date.substring(0, 10); // YYYY-MM-DD
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(commit);
    });

    const changelog = {
      generatedAt: new Date().toISOString(),
      totalCommits: commits.length,
      commits,
      groupedByDate: grouped,
    };

    // Output-Verzeichnis erstellen falls nötig
    const outputDir = path.join(__dirname, '..', 'src', 'data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'changelog.json');
    fs.writeFileSync(outputPath, JSON.stringify(changelog, null, 2), 'utf-8');

    console.log(`✅ Changelog generiert: ${commits.length} Commits → ${outputPath}`);
  } catch (error) {
    console.error('❌ Fehler beim Generieren des Changelogs:', error.message);
    
    // Fallback: leere Datei erstellen damit der Build nicht fehlschlägt
    const outputDir = path.join(__dirname, '..', 'src', 'data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, 'changelog.json');
    fs.writeFileSync(outputPath, JSON.stringify({ 
      generatedAt: new Date().toISOString(), 
      totalCommits: 0, 
      commits: [], 
      groupedByDate: {} 
    }, null, 2), 'utf-8');
    console.log('⚠️  Leere Changelog-Datei erstellt als Fallback.');
  }
}

main();
