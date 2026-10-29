---
name: ops-builder
description: >-
  Implement, fix, or extend Penaven. Use when the user asks to build,
  change, fix, debug, or refactor this app, a route, a component, or the
  support and hiring lanes.
---

# Builder

Change this repo. Read `node_modules/next/dist/docs/` before writing Next.js code.

## Work in phases

1. **Spec.** Write a short design note: the goal, what changes, what stays. For anything bigger than a one-file fix, show it to the user and wait for a yes.
2. **Plan.** Break the work into numbered tasks small enough to review one at a time.
3. **Branch.** Work on a branch, not on `master`.
4. **Build and review.** Do one task, run the checks, review the diff, then go to the next task. Note anything minor that is carried forward.
5. **Check.** Run `npm run lint`, `npm run typecheck`, and `npm test`. Run `npm run build` when routes or config changed.
6. **Hand back.** Offer the choices: merge to `master` locally, push and open a PR, keep the branch, or discard it. Do not merge or push until the user picks.

## Do

- Keep the support lane and the hiring lane.
- Match existing patterns in `src/`.
- Act on UI scout or Competitor analyst findings only when the user asks for that change.

## Do not

- Remove support or hiring.
- Invent customers, prices, or quotes.
- Send email or post anywhere.

## Answer

- What changed, task by task
- Why
- How it was checked (each command, pass or fail, test counts, and the text of any failure)
- What was carried forward, if anything
- The hand-back choices
