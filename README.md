# MockLoop

MockLoop is a short interview coach. You give it a role title and, if you want, a few lines from your resume. It asks one question, scores your answer on a simple rubric, and follows up once. The session is saved.

It is a TypeScript MERN app: React, Express, MongoDB, and an OpenAI-compatible model. If you do not set a model key, it still runs. The screen is labeled as an offline coach, not as a model judgment.

This is practice. It does not replace a real interview.

## What you can do

- Enter a role title and an optional resume snippet.
- Get one question tailored to the role.
- Answer it in the form, then see a 1–5 score, short feedback, and one follow-up.
- Reopen past sessions. Delete ones you do not want.

The model is told not to invent employers, metrics, or skills that are not in the resume snippet. The offline path uses fixed question templates and a length-based score.

## Stack

| Piece | Choice |
| --- | --- |
| UI | React 19, TypeScript, Vite, Tailwind CSS |
| Forms | react-hook-form for the answer box |
| Client data | axios, TanStack Query |
| Dates | date-fns |
| API | Express 4, TypeScript, Zod, helmet, cors |
| Data | MongoDB via Mongoose, or an in-memory store |
| Model | `openai` SDK against any compatible base URL |
| Tests | `node:test` through `tsx` |

## Run it

Node 20 or newer.

```bash
cp .env.example .env
npm install
npm run dev
```

Open the Vite URL printed in the terminal (port 5173). The API is on port 4000. Vite proxies `/api` to it.

Production-style, one process:

```bash
npm run build
npm start
```

Then open port 4000. Express serves the built React app.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | API port. Default `4000`. |
| `MONGO_URI` | No | Example: `mongodb://127.0.0.1:27017/mockloop`. If empty, sessions live in memory and vanish when the process stops. |
| `OPENAI_API_KEY` | No | If empty, MockLoop uses the offline coach. |
| `OPENAI_BASE_URL` | No | Use this for xAI, Groq, OpenRouter, or a local server. |
| `OPENAI_MODEL` | No | Default `gpt-4o-mini`. |

Do not commit `.env`.

## API

`GET /api/health` — `{ ok, store: "memory" \| "mongo", ai: "model" \| "heuristic", model }`

`GET /api/sessions?limit=20` — newest first, limit 1–50.

`POST /api/sessions` — body `{ roleTitle, resumeSnippet? }`. `roleTitle` 3–120 characters. Returns the saved session with a question.

`POST /api/sessions/:id/answer` — body `{ answer }` (10–4,000 characters). Scores the answer and adds a follow-up. Returns the updated session.

`GET /api/sessions/:id`

`DELETE /api/sessions/:id` — `204` when removed.

## Scripts

```bash
npm test
npm run typecheck
npm run build
```

GitHub Actions runs those three on every push.

## Limits

- The offline score is mostly length. It does not judge content quality.
- The model can still be wrong. Read the feedback yourself.
- There is no login. Anyone who can reach the server can read saved sessions. Do not point this at the public internet with real resume text.

Design notes for someone changing the code are in [DEVELOPER.md](DEVELOPER.md).
