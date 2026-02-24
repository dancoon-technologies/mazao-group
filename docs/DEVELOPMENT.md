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
- **WatermelonDB (offline sync):** Native module is linked via Expo config plugin. You must use a **development build** (not Expo Go). See below.

### Backend (Django)

- **Lint/format:** [Ruff](https://docs.astral.sh/ruff/) is configured in `backend/pyproject.toml`.
- From `backend/`: `ruff check .` (lint), `ruff format .` (format).
- Install: `pip install -r requirements-dev.txt` or `pip install ruff` (optional; not in main `requirements.txt`).
- If Ruff is installed in your venv but not on PATH: `python -m ruff check .` and `python -m ruff format .`.

## Editor

- **EditorConfig:** Root `.editorconfig` enforces indent (2 spaces JS/TS, 4 Python), UTF-8, LF, trim trailing whitespace, final newline.

## Linking WatermelonDB (mobile)

WatermelonDB uses a native bridge (`WMDatabaseBridge`). **Expo Go does not include it**, so offline sync will only work in a custom development build.

1. **Plugins are already configured** in `mobile/app.json`:
   - `@morrowdigital/watermelondb-expo-plugin` – links WatermelonDB native code.
   - `expo-build-properties` – Android `packagingOptions.pickFirst` for `libc++_shared.so` (required for WatermelonDB JSI).

2. **Create a development build** (from `mobile/`):
   ```bash
   npx expo prebuild
   npx expo run:android
   # or
   npx expo run:ios
   ```
   Or use EAS Build: `eas build --profile development --platform android` (and/or `ios`).

3. **Do not use Expo Go** for testing offline sync; use the dev build from step 2.

4. If you see `NativeModules.WMDatabaseBridge is not defined`, you are still in Expo Go or the native build is stale. Run `npx expo prebuild --clean` then `npx expo run:android` (or `run:ios`) again.

5. **Android: "Unresolved reference JSIModulePackage"** – The WatermelonDB Expo plugin injects JSI code that uses `JSIModulePackage`, which was removed in React Native 0.81. The plugin is configured with `disableJsi: true` so it won’t add that code. If you run `npx expo prebuild --clean` and the error reappears, edit `android/app/.../MainApplication.kt` and remove the `WatermelonDBJSIPackage` and `JSIModulePackage` imports.

6. **Android: "SDK location not found"** – Gradle needs the Android SDK path. Either set the `ANDROID_HOME` environment variable to your SDK root (e.g. `C:\Users\<You>\AppData\Local\Android\Sdk` on Windows), or ensure `android/local.properties` exists with `sdk.dir=<path>`. The file is gitignored; a template is created with a default path—edit it if your SDK is elsewhere.

## Conventions

- **TypeScript/JavaScript:** Use the project’s ESLint config; fix warnings before merging.
- **Python:** Follow Ruff rules in `pyproject.toml`; keep line length ≤ 100.
- **Imports:** Prefer ES module `import`; avoid `require()` in TS/JS.
- **Unused code:** Remove unused imports, variables, and dead code; no stray `console.log` in app code.
