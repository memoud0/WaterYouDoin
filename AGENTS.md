# Repository Guidelines

## Project Structure & Module Organization
- `extension/` holds the Chrome extension code: `extension/scripts/` (background/content/CLI scripts), `extension/pages/` (popup/options/nudge UI), `extension/core/` (classification, storage, metrics), and `extension/data/` (model weights and examples).
- `ml/` contains training/evaluation placeholders and datasets in `ml/dataset/`.
- `diagrams/` documents architecture and flows; root configs live in `vite.config.ts` and `tsconfig.json`.

## Build, Test, and Development Commands
- `npm install` installs dependencies.
- `npm run dev` starts the Vite dev server for extension UI work.
- `npm run build` creates a production bundle.
- `npm test` runs the Vitest suite once.
- `npm run test:watch` runs tests in watch mode.
- `npm run classify` runs the CLI classifier (`extension/scripts/classify.ts`) via `tsx`.

## Coding Style & Naming Conventions
- TypeScript uses ES modules, double quotes, semicolons, and 2-space indentation; mirror nearby file style.
- Prefer `camelCase` for functions/variables and `PascalCase` for types/classes.
- Tests live in `__tests__/` and use `*.test.ts` filenames.
- `.eslintrc.cjs` and `.prettierrc` are empty, so keep formatting consistent with existing code.
- TypeScript is `strict` (see `tsconfig.json`); type public boundaries and avoid `any` unless necessary.

## Testing Guidelines
- Vitest is the test runner; existing tests are under `extension/core/classify/__tests__/`.
- Add tests for classification or redirect logic changes; follow the `*.test.ts` naming pattern.
- No coverage threshold is configured, so prioritize critical-path tests.

## Commit & Pull Request Guidelines
- Commit messages follow short, imperative sentence case (e.g., “Add messaging, redirect, and CLI classify scripts”).
- PRs should explain the behavior change, link related issues, and include manual test notes; include screenshots for UI changes in `extension/pages/`.
