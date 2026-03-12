# Mobile app optimization (APK size & performance)

This document summarizes optimizations applied to reduce APK size and improve runtime behavior.

## Applied optimizations

### Android build (app.json)

- **buildArchs**: `["arm64-v8a", "armeabi-v7a"]` — Build only ARM architectures (no x86/x86_64). Cuts APK size significantly; x86 is mainly for emulators. For smallest size you can use only `["arm64-v8a"]` (most current devices).
- **enableMinifyInReleaseBuilds**: Already enabled (R8 minification).
- **enableShrinkResourcesInReleaseBuilds**: Already enabled (removes unused resources).
- **enableBundleCompression**: Enabled — Compresses the JS bundle in the APK. If you notice slower cold start, set to `false` in the `expo-build-properties` plugin config.

### EAS Build (eas.json)

- **Production Android**: `buildType: "app-bundle"` — Produces an AAB for Play Store. Users download a smaller, device-specific APK. For local/preview APKs the build type remains `apk` if needed.

### Metro (metro.config.js)

- **drop_console**: Removes `console.*` in release builds.
- **passes: 2**, **mangle.toplevel**, **format.comments: false** — Stronger minification for a smaller JS bundle.

### Dependencies (package.json)

- **eas-cli** moved to devDependencies — Not needed at runtime; keeps production dependency set smaller.

## Optional further steps

1. **Smaller APK for testing**: In `eas.json` under `preview` or `development`, you can limit to one ABI (e.g. `"buildType": "apk"` with an env or profile that builds only `arm64-v8a`) for smaller preview APKs.
2. **Assets**: Use WebP for images where possible; run image compression on PNGs/JPEGs in `assets/`.
3. **Audit dependencies**: Run `npx depcheck` and remove unused packages. Keep only required Expo/React Native modules.
4. **Hermes**: Already enabled in app.json (`jsEngine: "hermes"`) for smaller bytecode and better performance.
5. **React Compiler**: Already enabled in app.json (`experiments.reactCompiler`) for optimized render path.

## Rebuilding

After changing `app.json` (e.g. build properties), run a new EAS build or `npx expo prebuild --clean` before a local release build so native config is applied.
