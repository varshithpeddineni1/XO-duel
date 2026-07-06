#!/usr/bin/env node
// The 8-layer AI pull-request reviewer required by rules.md CI-4. Runs in
// .github/workflows/pr-review.yml on every PR. Computes the PR diff, asks
// claude-sonnet-4-6 to review it across 8 fixed layers, and upserts a single
// PR comment (found again on later pushes via a hidden marker) rather than
// spamming a new comment per push.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const COMMENT_MARKER = '<!-- xo-duel-pr-review -->';
const MODEL = 'claude-sonnet-4-6';
const MAX_DIFF_CHARS = 100_000;

const REVIEW_LAYERS = [
  'Correctness & logic — bugs, edge cases, off-by-one errors, incorrect assumptions.',
  'Security (rules.md Part VIII) — secrets, injection, auth/session handling, input validation.',
  'Architecture & design (rules.md Part V, ARC-1..ARC-5) — pure domain logic with no I/O, ' +
    'thin handlers with logic in the service layer, server-authoritative game state, token-only styling.',
  'Performance & efficiency — N+1 queries, unnecessary re-renders, unbounded loops, missing indexes.',
  'Test coverage & quality (rules.md Part IX) — are the required cases covered (TEST-3, TEST-4, TEST-5)? Are tests meaningful, not tautological?',
  'Style & consistency (rules.md Part IV) — function/file size limits, nesting depth, naming, formatting.',
  'Documentation & Definition of Done (rules.md DOD-1..DOD-5) — docs updated, ADR needed, coverage gate honored.',
  'Dependencies & supply chain — new dependencies justified, no known-vulnerable or unnecessary packages.',
];

function env(name, { required = true } = {}) {
  const value = process.env[name];
  if (required && !value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function loadPullRequestEvent() {
  const eventPath = env('GITHUB_EVENT_PATH');
  const event = JSON.parse(readFileSync(eventPath, 'utf8'));
  const pr = event.pull_request;
  if (!pr) {
    console.error('This workflow only supports pull_request events.');
    process.exit(1);
  }
  return pr;
}

function getDiff(baseSha, headSha) {
  const diff = execFileSync('git', ['diff', '--no-color', `${baseSha}...${headSha}`], {
    maxBuffer: 1024 * 1024 * 50,
    encoding: 'utf8',
  });
  if (diff.length > MAX_DIFF_CHARS) {
    return `${diff.slice(0, MAX_DIFF_CHARS)}\n\n[diff truncated at ${MAX_DIFF_CHARS} characters]`;
  }
  return diff;
}

async function requestReview(diff) {
  const apiKey = env('ANTHROPIC_API_KEY');
  const systemPrompt =
    'You are reviewing a pull request for XO Duel, an online Tic Tac Toe app. ' +
    'Review the diff below across exactly these 8 layers, in order. For each layer, either ' +
    'report specific, concrete findings (file/line if you can tell from the diff) or write ' +
    '"No issues found." Be concise — this is a PR comment, not an essay. Do not invent ' +
    'issues to fill space.\n\n' +
    REVIEW_LAYERS.map((layer, i) => `${i + 1}. ${layer}`).join('\n');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Diff:\n\n${diff || '(empty diff)'}` }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${body.slice(0, 500)}`);
  }

  const data = await response.json();
  const text = data.content?.map((block) => block.text ?? '').join('\n') ?? '';
  return text.trim() || '_The reviewer returned an empty response._';
}

async function githubRequest(path, options = {}) {
  const token = env('GITHUB_TOKEN');
  const repo = env('GITHUB_REPOSITORY');
  const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...options,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API error ${response.status} on ${path}: ${body.slice(0, 500)}`);
  }
  return response.status === 204 ? null : response.json();
}

async function upsertComment(prNumber, body) {
  const commentBody = `${COMMENT_MARKER}\n${body}`;
  const comments = await githubRequest(`/issues/${prNumber}/comments?per_page=100`);
  const existing = comments.find((c) => c.body?.startsWith(COMMENT_MARKER));

  if (existing) {
    await githubRequest(`/issues/comments/${existing.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: commentBody }),
    });
  } else {
    await githubRequest(`/issues/${prNumber}/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: commentBody }),
    });
  }
}

async function main() {
  const pr = loadPullRequestEvent();
  const diff = getDiff(pr.base.sha, pr.head.sha);
  const review = await requestReview(diff);
  const body = `## 8-layer AI review (${MODEL})\n\n${review}`;
  await upsertComment(pr.number, body);
  console.log(`Posted review comment on PR #${pr.number}.`);
}

main().catch((err) => {
  console.error('pr-review failed:', err.message);
  process.exit(1);
});
