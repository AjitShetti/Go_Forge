# Contributing

Thanks for helping. Bug reports, lesson fixes and code changes are all welcome.

## Reporting

- **Something broken on the site:** [bug report](https://github.com/AjitShetti/Go_Forge/issues/new?template=bug_report.yml). Say which page, what you did and what you saw.
- **A lesson is wrong or confusing:** use "Report a problem with this lesson" on the lesson page, or the [lesson problem form](https://github.com/AjitShetti/Go_Forge/issues/new?template=lesson_problem.yml). If you think the engine's output differs from Go on your machine, include your code and `go version`.

Security problems: please don't open a public issue. Use "Report a vulnerability" on the repository's Security tab.

## Setting up

Needs Node 22+ and Go 1.27.1.

```sh
npm install
npm run engine:build   # the in-browser Go engine
npm run dev            # http://localhost:3000
```

Supabase is optional for most work. Without `.env.local` the app runs and saves nothing. For signed-in features, create a free Supabase project, apply `supabase/migrations` in order and then `supabase/seed.sql`, and put its URL and publishable key in `.env.local` (see [docs/supabase-setup.md](docs/supabase-setup.md)).

## Before you open a pull request

```sh
npm run typecheck
npm test                                  # unit tests + database tests (in-process Postgres, no setup)
npm run build && npm run test:e2e         # browser flows in Edge; signed-in flows skip without a test user
```

If you changed a lesson in `content/go`:

```sh
node scripts/verify-content.mjs <lesson-slug>   # runs every program with local Go AND the browser engine
```

Never edit `expected.json` by hand. Run `node scripts/verify-content.mjs --update <lesson-slug>` and review the diff. A lesson may only show output that real Go produced. The rules are in [docs/content-pipeline.md](docs/content-pipeline.md).

If you changed the grader, update [docs/grading.md](docs/grading.md) and the tests in `tests/unit/grader`. The home page walkthrough's scores are pinned in `tests/unit/grader/demo.test.ts`.

## Pull requests

- One change per pull request, with a sentence on why.
- Match the surrounding code: its naming, comment density and the visual style (paper background, one blue, mono labels, serif prose, square 1px borders).
- Say what you ran to check it.
