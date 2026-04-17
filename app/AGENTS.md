# app/ — Next.js web app

This folder is a Next.js app built with **shadcn/ui** (see `components.json`, `components/ui/`).

## When working on UI in this folder

**Always use the dedicated shadcn skill first.** It was installed via `pnpm dlx skills add shadcn/ui` and lives in `.agents/skills/shadcn/` at the repo root. Read `.agents/skills/shadcn/SKILL.md` before adding, editing, searching, styling, or composing any component — it contains the enforced rules (styling, forms, composition, icons) and the correct CLI workflow.

The skill is the **primary source of truth** for anything shadcn-related. Do not guess component APIs, reinvent patterns already covered by the rules files, or hand-roll styles that the skill forbids.

## Secondary references

Use these only when the skill does not already answer the question (e.g. a component that is not yet documented in the local rules):

- Components index: https://ui.shadcn.com/docs/components.md
- Chart (radix): https://ui.shadcn.com/docs/components/radix/chart.md
- Blocks: https://ui.shadcn.com/blocks
- Forms with react-hook-form: https://ui.shadcn.com/docs/forms/react-hook-form.md
- Dark mode (Next.js): https://ui.shadcn.com/docs/dark-mode/next.md
- Full docs (LLM-friendly): https://ui.shadcn.com/llms.txt
