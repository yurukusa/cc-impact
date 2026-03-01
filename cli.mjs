#!/usr/bin/env node
/**
 * cc-impact — What did you actually build with Claude Code?
 *
 * cc-session-stats shows how much TIME you spent.
 * cc-impact shows what you PRODUCED: commits, files changed, lines written.
 *
 * Scans git repos under ~/projects/, ~/aetheria/, and ~/draemorth/
 * and aggregates git stats for the last N days.
 *
 * Zero dependencies. Node.js 18+. ESM.
 */

import { execSync, spawnSync } from 'node:child_process';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const HOME = homedir();

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const helpFlag   = args.includes('--help') || args.includes('-h');
const jsonFlag   = args.includes('--json');
const daysFlag   = args.find(a => a.startsWith('--days='));
const DAYS       = daysFlag ? Math.max(1, parseInt(daysFlag.replace('--days=', '')) || 30) : 30;

if (helpFlag) {
  console.log(`cc-impact — Measure what you actually built with Claude Code

USAGE
  npx cc-impact [options]

OPTIONS
  --days=N    Look back N days (default: 30)
  --json      Output JSON for piping / other tools
  --help      Show this help

OUTPUT
  Scans git repos in ~/projects/, ~/aetheria/, ~/draemorth/
  Shows: commits, lines added, lines deleted, files touched
  Ranks repos by activity
  Pairs with cc-session-stats to see hours vs output

EXAMPLE
  npx cc-impact                  # Last 30 days
  npx cc-impact --days=7         # Last week
  npx cc-impact --days=90        # Last quarter
  npx cc-impact --json | jq .    # JSON output
`);
  process.exit(0);
}

// ── Scan roots ────────────────────────────────────────────────────────────────
const SCAN_ROOTS = [
  join(HOME, 'projects'),
  join(HOME, 'aetheria'),
  join(HOME, 'draemorth'),
].filter(r => existsSync(r));

function findGitRepos(root, depth = 0) {
  if (depth > 2) return [];
  const repos = [];
  let entries;
  try { entries = readdirSync(root); } catch { return repos; }
  for (const entry of entries) {
    if (entry.startsWith('.')) continue;
    const full = join(root, entry);
    try {
      const st = statSync(full);
      if (!st.isDirectory()) continue;
    } catch { continue; }
    const gitDir = join(full, '.git');
    if (existsSync(gitDir)) {
      repos.push(full);
    } else {
      // recurse one level for monorepos (e.g. ~/projects/cc-loop/cc-session-stats)
      repos.push(...findGitRepos(full, depth + 1));
    }
  }
  return repos;
}

// ── Git stats for one repo ────────────────────────────────────────────────────
function repoStats(repoPath, days) {
  const since = `${days} days ago`;
  try {
    // commit count
    const countResult = spawnSync(
      'git', ['log', `--since=${since}`, '--oneline', '--no-merges'],
      { cwd: repoPath, encoding: 'utf8', timeout: 5000 }
    );
    const commitLines = (countResult.stdout || '').trim().split('\n').filter(Boolean);
    const commits = commitLines.length;
    if (commits === 0) return null;

    // shortstat: files changed, insertions, deletions
    const statResult = spawnSync(
      'git', ['log', `--since=${since}`, '--no-merges', '--shortstat', '--format='],
      { cwd: repoPath, encoding: 'utf8', timeout: 10000 }
    );
    let insertions = 0, deletions = 0, filesChanged = 0;
    const statLines = (statResult.stdout || '').split('\n');
    for (const line of statLines) {
      const fm = line.match(/(\d+) file/);
      const im = line.match(/(\d+) insertion/);
      const dm = line.match(/(\d+) deletion/);
      if (fm) filesChanged += parseInt(fm[1]);
      if (im) insertions += parseInt(im[1]);
      if (dm) deletions += parseInt(dm[1]);
    }

    // project name = last path segment
    const name = repoPath.split('/').pop();

    return { name, path: repoPath, commits, insertions, deletions, filesChanged };
  } catch {
    return null;
  }
}

// ── Collect all repos ─────────────────────────────────────────────────────────
if (!jsonFlag) {
  process.stdout.write(`  Scanning repos (last ${DAYS} days)...  \r`);
}

const allRepos = [];
for (const root of SCAN_ROOTS) {
  allRepos.push(...findGitRepos(root));
}

const results = [];
for (const repo of allRepos) {
  const st = repoStats(repo, DAYS);
  if (st) results.push(st);
}

// ── Totals ────────────────────────────────────────────────────────────────────
const total = results.reduce((acc, r) => {
  acc.commits     += r.commits;
  acc.insertions  += r.insertions;
  acc.deletions   += r.deletions;
  acc.filesChanged += r.filesChanged;
  return acc;
}, { commits: 0, insertions: 0, deletions: 0, filesChanged: 0 });

// Sort by commits desc
results.sort((a, b) => b.commits - a.commits);

// ── JSON output ───────────────────────────────────────────────────────────────
if (jsonFlag) {
  console.log(JSON.stringify({
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    days: DAYS,
    summary: {
      repos: results.length,
      commits: total.commits,
      insertions: total.insertions,
      deletions: total.deletions,
      filesChanged: total.filesChanged,
      netLines: total.insertions - total.deletions,
    },
    repos: results,
  }, null, 2));
  process.exit(0);
}

// ── Terminal output ───────────────────────────────────────────────────────────
const bold  = '\x1b[1m';
const dim   = '\x1b[2m';
const cyan  = '\x1b[36m';
const green = '\x1b[32m';
const red   = '\x1b[31m';
const yellow = '\x1b[33m';
const reset = '\x1b[0m';

function fmt(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

console.log('');
console.log(`  ${bold}${cyan}cc-impact v1.0.0${reset}`);
console.log(`  ${'═'.repeat(39)}`);
console.log(`  ${dim}What did you actually build? Last ${DAYS} days.${reset}`);
console.log('');

if (results.length === 0) {
  console.log(`  ${yellow}No git activity found in the last ${DAYS} days.${reset}`);
  console.log(`  Scanned: ${SCAN_ROOTS.join(', ')}`);
  process.exit(0);
}

// Summary box
console.log(`  ${bold}▸ Output (last ${DAYS} days)${reset}`);
console.log(`    Commits:      ${bold}${total.commits.toLocaleString()}${reset}`);
console.log(`    Lines added:  ${bold}${green}+${total.insertions.toLocaleString()}${reset}`);
console.log(`    Lines removed:${bold}${red} -${total.deletions.toLocaleString()}${reset}`);
console.log(`    Net lines:    ${bold}${total.insertions - total.deletions >= 0 ? green : red}${(total.insertions - total.deletions > 0 ? '+' : '')}${(total.insertions - total.deletions).toLocaleString()}${reset}`);
console.log(`    Files changed:${bold} ${total.filesChanged.toLocaleString()}${reset}`);
console.log(`    Active repos: ${bold}${results.length}${reset}`);
console.log('');

// Top repos
const TOP = Math.min(10, results.length);
console.log(`  ${bold}▸ Most Active Repos${reset} ${dim}(top ${TOP})${reset}`);
const maxName = Math.max(...results.slice(0, TOP).map(r => r.name.length), 12);
for (const r of results.slice(0, TOP)) {
  const name = r.name.padEnd(maxName);
  const bar = '█'.repeat(Math.ceil(r.commits / Math.max(results[0].commits, 1) * 15)).padEnd(15);
  console.log(`    ${dim}${name}${reset}  ${yellow}${bar}${reset}  ${bold}${r.commits}${reset}${dim} commits  +${fmt(r.insertions)}${reset}`);
}

if (results.length > TOP) {
  console.log(`    ${dim}... and ${results.length - TOP} more repos${reset}`);
}

console.log('');

// Insight
const commitsPerDay = (total.commits / DAYS).toFixed(1);
const linesPerDay   = Math.round((total.insertions - total.deletions) / DAYS);
console.log(`  ${bold}▸ Pace${reset}`);
console.log(`    ${commitsPerDay} commits/day  |  ${linesPerDay > 0 ? '+' : ''}${linesPerDay.toLocaleString()} net lines/day`);
console.log('');

console.log(`  ${dim}Pair with ${reset}${bold}npx cc-session-stats${reset}${dim} to see hours → this is what those hours built.${reset}`);
console.log('');
