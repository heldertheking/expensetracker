// Builds the CI validation report: a job summary plus shields.io endpoint badges for the README.
// Inputs (all optional, missing data is skipped):
//   reports/<app>-reports/coverage-summary.json  vitest json-summary coverage
//   eslint-report.json                           eslint -f json output
//   prettier.txt                                 prettier --list-different output
//   TYPECHECK_OUTCOME, LINT_OUTCOME  step outcomes (success|failure)
//   FORMAT_BLOCKING                              'true' makes unformatted files fail the report
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';

const COLORS = { green: 'brightgreen', yellow: 'yellow', red: 'red' };
const BADGE_DIR = 'badges';
mkdirSync(BADGE_DIR, { recursive: true });

const readJson = (path) =>
  existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;

// shields.io endpoint format: https://shields.io/badges/endpoint-badge
function badge(name, label, message, color) {
  const json = { schemaVersion: 1, label, message, color };
  writeFileSync(`${BADGE_DIR}/${name}.json`, JSON.stringify(json));
}

const rows = [];
let failed = false;

// Coverage
for (const app of ['api', 'web']) {
  const summary = readJson(`reports/${app}-reports/coverage-summary.json`);
  if (!summary) {
    rows.push(`| Coverage ${app} | not run (unchanged) | |`);
    continue;
  }
  const t = summary.total;
  const pct = t.lines.pct;
  const color =
    pct >= 80 ? COLORS.green : pct >= 60 ? COLORS.yellow : COLORS.red;
  badge(`coverage-${app}`, `coverage ${app}`, `${pct}%`, color);
  rows.push(
    `| Coverage ${app} | ${pct}% lines | statements ${t.statements.pct}% · branches ${t.branches.pct}% · functions ${t.functions.pct}% |`,
  );
}

// Typecheck
if (process.env.TYPECHECK_OUTCOME) {
  const ok = process.env.TYPECHECK_OUTCOME === 'success';
  failed ||= !ok;
  badge(
    'typecheck',
    'typecheck',
    ok ? 'passing' : 'failing',
    ok ? COLORS.green : COLORS.red,
  );
  rows.push(`| Typecheck | ${ok ? 'passing' : 'failing'} | schema, api, web |`);
}

// Lint
const eslint = readJson('eslint-report.json');
if (!eslint && process.env.LINT_OUTCOME === 'failure') {
  failed = true;
  rows.push('| ESLint | crashed | no report produced |');
}
if (eslint) {
  const errors = eslint.reduce((n, f) => n + f.errorCount, 0);
  const warnings = eslint.reduce((n, f) => n + f.warningCount, 0);
  failed ||= errors > 0;
  const value = errors
    ? `${errors} errors`
    : warnings
      ? `${warnings} warnings`
      : 'clean';
  badge(
    'lint',
    'eslint',
    value,
    errors ? COLORS.red : warnings ? COLORS.yellow : COLORS.green,
  );
  rows.push(
    `| ESLint | ${value} | ${errors} errors · ${warnings} warnings in ${eslint.length} files |`,
  );
}

// Format
if (existsSync('prettier.txt')) {
  const files = readFileSync('prettier.txt', 'utf8')
    .split('\n')
    .filter(Boolean);
  const blocking = process.env.FORMAT_BLOCKING === 'true';
  failed ||= blocking && files.length > 0;
  const value = files.length ? `${files.length} files` : 'clean';
  const color = !files.length
    ? COLORS.green
    : blocking
      ? COLORS.red
      : COLORS.yellow;
  badge('format', 'prettier', value, color);
  rows.push(`| Prettier | ${value} | ${blocking ? 'blocking' : 'warn only'} |`);
  if (files.length) {
    rows.push(
      '',
      `<details><summary>Unformatted files</summary>\n\n${files.map((f) => `- ${f}`).join('\n')}\n\n</details>`,
    );
  }
}

const summary = [
  '## Validation report',
  '',
  '| Check | Result | Details |',
  '|---|---|---|',
  ...rows,
  '',
].join('\n');
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
process.exit(failed ? 1 : 0);
