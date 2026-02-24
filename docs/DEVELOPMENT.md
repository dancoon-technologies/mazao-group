# Development & code quality

## Linting and formatting

### Web (Next.js)

- **Lint:** `pnpm lint` (runs ESLint).
- **Auto-fix:** `pnpm lint:fix`.
- Config: `web/eslint.config.mjs` (ESLint 9 flat config with `eslint-config-next`).

### Mobile (Expo)

- **Lint:** `pnpm lint` (runs `expo lint` / ESLint).
- Config: `mobile/eslint.config.js` (eslint-config-expo).
- **UI/UX:** Design tokens in `mobile/constants/theme.ts` (colors, spacing, radius). Use `SafeAreaView` from `react-native-safe-area-context` for tab content and auth screens so content respects notches and home indicator.

### Backend (Django)

- **Lint/format:** [Ruff](https://docs.astral.sh/ruff/) is configured in `backend/pyproject.toml`.
- From `backend/`: `ruff check .` (lint), `ruff format .` (format).
- Install: `pip install -r requirements-dev.txt` or `pip install ruff` (optional; not in main `requirements.txt`).
- If Ruff is installed in your venv but not on PATH: `python -m ruff check .` and `python -m ruff format .`.

## Editor

- **EditorConfig:** Root `.editorconfig` enforces indent (2 spaces JS/TS, 4 Python), UTF-8, LF, trim trailing whitespace, final newline.

## Conventions

- **TypeScript/JavaScript:** Use the project’s ESLint config; fix warnings before merging.
- **Python:** Follow Ruff rules in `pyproject.toml`; keep line length ≤ 100.
- **Imports:** Prefer ES module `import`; avoid `require()` in TS/JS.
- **Unused code:** Remove unused imports, variables, and dead code; no stray `console.log` in app code.
