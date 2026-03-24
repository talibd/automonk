# AutoMonk Agent Guide

Keep this file short. If it grows past ~200 lines, split non-essential material into task-specific docs and read them only when needed.

## Goal

Work efficiently in this repo with low token usage. Prefer focused execution over long analysis.

## Project Shape

- Backend: Node.js + Express in `src/`
- Dashboard: separate app in `dashboard/` and out of scope unless the user explicitly asks for dashboard work
- Data: Postgres + Redis
- Rendering: Satori/Resvg/Puppeteer slide pipeline
- AI: Anthropic calls in `src/ai/` and some Telegram bot commands in `src/bot/commands/`

## Scope Guard

- Do not work on the dashboard by default.
- Ignore files under `dashboard/` unless the user explicitly requests dashboard changes.
- When searching the repo, exclude `dashboard/` unless it is directly relevant.

## High-Value Commands

- Install root deps: `npm install`
- Start backend: `npm run dev`
- Start worker: `npm run dev:worker`
- Start bot: `npm run dev:bot`
- Start production app: `npm start`

Only run the command needed for the current task. Do not run all services by default.

## Token Discipline

### 1. Keep Conversations Fresh

- If the task changes substantially, start a new chat.
- Do not carry dead context from feature work into debugging or unrelated questions.
- Summarize prior conclusions in 3-6 lines instead of rehashing the full thread.

### 2. Prefer Sonnet-Class Models

- Default to a Sonnet-class model for normal coding, debugging, and repo exploration.
- Do not use Opus-class models unless the task is genuinely blocked on deeper reasoning.
- Expensive models should be the exception, not the baseline.

### 3. Avoid Agent Teams By Default

- Do not spawn sub-agents unless parallel work materially reduces total time.
- One agent is the default.
- If delegation is used, keep write scopes disjoint and the task tightly bounded.

### 4. Minimize Command Output

- Prefer targeted commands:
  - `rg pattern path`
  - `rg --files`
  - `Get-Content file | Select-Object -First N`
  - `git diff -- path`
- Avoid dumping large files, full lockfiles, long logs, or huge git histories into context.
- For tests, run the smallest relevant subset first.
- If a command is noisy, capture only the failing lines or summarize the result.

### 5. Read Less, Not More

- Read only the files needed for the task.
- Do not scan `node_modules`, `dist`, or generated assets unless the bug clearly lives there.
- Prefer narrow search terms before opening files.

## Editing Rules

- Make the smallest correct change.
- Preserve existing patterns unless they are the problem.
- Do not refactor unrelated code during a bug fix.
- Do not add large comment blocks.
- When adding docs, keep them compact and task-oriented.

## Repo-Specific Notes

### AI Cost Hotspots

These files are the main model call sites:

- `src/ai/ideaGenerator.js`
- `src/ai/scriptWriter.js`
- `src/ai/platformAdapter.js`
- `src/ai/strategyAnalyzer.js`
- `src/bot/commands/chat.js`
- `src/bot/commands/research.js`
- `src/bot/commands/connect.js`

When changing these areas:

- Reduce prompt size before changing models.
- Avoid passing full JSON blobs when a compact summary will do.
- Keep `max_tokens` tight to expected output size.
- Reuse cached/generated results where inputs are unchanged.

### Chat Handler

`src/bot/commands/chat.js` is especially sensitive to token bloat because it can accumulate:

- live DB context
- multi-turn history
- persona instructions

If working there:

- trim history aggressively
- inject only relevant live context
- avoid repeating static instructions in user messages

## Preferred Workflow

1. Identify the exact files involved.
2. Read only those files.
3. Make the minimal patch.
4. Run the narrowest useful verification.
5. Report outcome briefly.

## What Not To Do

- Do not paste massive logs into the conversation.
- Do not open whole build artifacts to inspect one error.
- Do not spawn multiple agents for routine tasks.
- Do not use expensive models for ordinary edits.
- Do not let this file become a dumping ground.

## If More Context Is Needed

Create a focused doc such as:

- `docs/ai-pipeline.md`
- `docs/deploy-notes.md`
- `docs/debugging-redis.md`

Read those only when relevant. Keep this file as the thin entry point.
