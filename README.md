# Go Forge

Learn Go from first principles, then practise system design on a canvas that grades your architecture.

**Live:** https://go-forge.vercel.app

- **Track:** 13 modules, 43 lessons. Each lesson opens with a short program you predict before you may run it, then shows what Go really printed and why, with the Python and JavaScript contrast.
- **Real Go in the browser:** the actual `gc` compiler and linker, compiled to WebAssembly, run in a Web Worker. No server runs your code.
- **Review:** wrong predictions come back on a spaced schedule.
- **Design canvas:** sketch a system (load balancers, caches, queues, databases…), set replicas and QPS, and grade it against a scenario. A deterministic rule engine shows the arithmetic behind every finding.

Every output a lesson shows was produced by running the program, checked against native Go by `scripts/verify-content.mjs`.

## Found a bug?

[Open an issue](https://github.com/AjitShetti/Go_Forge/issues/new/choose). Each lesson page also has a "Report a problem with this lesson" link that fills in which lesson you were on. Want to fix it yourself? See [CONTRIBUTING.md](CONTRIBUTING.md).

## Run it locally

Needs Node 22+ and Go 1.27.1 (the version every lesson's expected output was recorded with).

```sh
npm install
npm run engine:build     # compiles the in-browser Go engine into public/engine/gen (about 2 minutes)
npm run dev              # http://localhost:3000
```

Without Supabase settings the app still runs: lessons, the engine and the canvas work, and the header shows "DB not connected" because nothing is saved. To save progress, point `.env.local` at a Supabase project (see [docs/supabase-setup.md](docs/supabase-setup.md)).

## How it's built

| Area | Where | Notes |
|---|---|---|
| App | `src/app`, `src/components` | Next.js App Router, React 19, Tailwind 4 |
| Go engine | `public/engine`, `scripts/build-engine.mjs` | [docs/execution-engine.md](docs/execution-engine.md) |
| Lessons | `content/go` | [docs/content-pipeline.md](docs/content-pipeline.md), [docs/lesson-loop.md](docs/lesson-loop.md) |
| Review and mastery | `src/lib/review` | [docs/review-and-mastery.md](docs/review-and-mastery.md) |
| Canvas and grader | `src/components/canvas`, `src/lib/grader` | [docs/design-canvas.md](docs/design-canvas.md), [docs/grading.md](docs/grading.md) |
| Database | `supabase/migrations` | Postgres with row-level security, publishable key only |

Deployed on Vercel: `scripts/vercel-build.mjs` installs Go and builds the engine during the deploy.
