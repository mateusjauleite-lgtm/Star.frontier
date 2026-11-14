# Star Frontier — Unreal Engine 5.8

This workspace is the destination for the **complete migration** of Star Frontier to Unreal Engine 5. **UE 5.8 is the pinned engine baseline** and sole target runtime for future development.

## Engine baseline

- Project descriptor `StarFrontier.uproject` is associated with Unreal Engine **5.8**.
- Android CI preflight rejects any engine major/minor version other than 5.8.
- Install the official stable UE 5.8 release and use its matching Android SDK/NDK/JDK through Unreal Turnkey.
- Do not upgrade the engine association or Android toolchain independently; review source compatibility and rerun the full acceptance checks together.

## Migration direction

- No new gameplay, world, ship, character, HUD or rendering features will be developed in Three.js.
- Three.js is legacy source material used only to inspect existing behavior, data and assets while each system is ported.
- The final game runtime is intended to be Unreal Engine 5; this is not a dual-engine project.
- Existing cores and their branches must be migrated with their ownership boundaries intact. Do not replace them with a generic hierarchy or merge unrelated responsibilities.
- As each UE5 core passes its acceptance checks, its Three.js counterpart becomes obsolete for active development.

## Main Core startup

The first Main Core source slice is present:
- `AFrontierGameMode` is the world-entry coordinator after the Unreal Engine splash and map load.
- It uses `AFrontierCharacter` as the default pawn, spawns the configured exploration ship and places the player on D1 by default.
- `Config/DefaultEngine.ini` registers the GameMode and sets the Android package identity.

The UE5 splash/logo belongs to Unreal's startup presentation; it is not the game's Main menu. The `.uproject` descriptor and an Editor Python map-generation script are present. The actual `.umap` package, authored Niagara assets, successful project build and Editor verification are still outstanding.

## Android build separation

Runner setup and the reusable Windows preflight are documented in [ANDROID_BUILD_RUNNER.md](Docs/ANDROID_BUILD_RUNNER.md). The validation script is `Tools/CI/Validate-AndroidRunner.ps1` and is called by the UE5 Android workflow before packaging.

- `.github/workflows/android-apk.yml` is now the native UE5 Android packaging workflow. It invokes Unreal Automation Tool (`BuildCookRun`) and does not use Node, Vite, Three.js or Capacitor.
- The UE5 workflow requires a trusted **self-hosted Windows runner** with the licensed Unreal Engine 5.8 installation and the matching Android SDK, NDK and JDK already configured.
- Configure repository Actions variables `UE_ROOT`, `ANDROID_HOME`, `NDKROOT` and `JAVA_HOME` for that runner. The Android toolchain should be installed/validated with Unreal Turnkey for UE 5.8.
- The workflow deliberately stops before packaging if the startup map is missing. Run `Tools/EditorPython/create_main_startup_map.py` in Unreal Editor, save the generated map and commit `Content/StarFrontier/Maps/L_StarFrontier_Main.umap`.
- `.github/workflows/legacy-android-apk.yml` preserves the old Vite/Three.js + Capacitor APK pipeline for historical testing. Its output is **not** a UE5 build.
- Root `package.json` is explicitly marked as legacy web/Capacitor tooling. Its Three.js and Capacitor dependencies remain only to support the legacy source and workflow; UE5 compilation and packaging do not use npm.

Epic's Android workflow requires an engine-compatible SDK/NDK/JDK toolchain and packages through Unreal's BuildCookRun automation. See the [Android Quick Start](https://dev.epicgames.com/documentation/unreal-engine/android-quick-start) and [Build Operations](https://dev.epicgames.com/documentation/unreal-engine/build-operations-cooking-packaging-deploying-and-running-projects-in-unreal-engine).

## Existing core systems to migrate

- Character Core → model, animation, HUD, movement/look, camera and interaction branches.
- Ship Core → exploration hull, interior/decks, bridge, computer, engine dynamics, visual Engine FX, camera, controls and player-ship association.
- Earth Core v1.6.0 → seven branches: interior, surface, terrain, oceans, atmosphere, clouds and lighting.
- Planetary Core → planetary identity, physical dimensions, gravity, rotation, altitude and coordinate rules.
- Atmosphere & Climate Core → scientific atmospheric and climate data, separate from rendering effects. Its first native UE5 source slice now includes composition, vertical layers, climate baseline, a Planetary Core profile reference and runtime altitude sampling.
- Geology & Biomes Core → geological/ecological data and biome rules.

The authoritative ownership map is [CORE_SYSTEMS_MAP.md](Docs/CORE_SYSTEMS_MAP.md).

## Migration sequence

1. Preserve and validate the existing core/branch registry.
2. Implement Planetary Core and its branches in native UE5 C++.
3. Migrate Character Core and its branches.
4. Migrate Ship Core and its branches, preserving independently editable decks and systems.
5. Migrate Atmosphere & Climate and Geology & Biomes domain cores.
6. Migrate Earth Core and its seven branches, integrating the shared domain cores.
7. Integrate, validate and profile the UE5 game on the target Android device.

## Current implementation status

- Migration branch: `ue5/frontier-migration`.
- Baseline branch: `feature/character-core` remains preserved and separate.
- Native Planetary Core source scaffold is committed: profile Data Asset, coordinate/scale subsystem and separate identity, dimensions, gravity, rotation, altitude and coordinate branches.
- Initial Atmosphere & Climate Core source scaffold is committed: gas composition, atmospheric layer definitions, climate baseline, a profile Data Asset linked to Planetary Core, and a World Subsystem for pressure/temperature/density sampling. Its model is a deterministic approximation and has not been compiled or tested.
- Frontier module rules and module entry point are committed.
- The UE 5.8 project descriptor and game/editor targets are present, but the C++ has not yet been compiled by Unreal Build Tool or validated in Unreal Editor.
- The initial `.umap` must still be generated in Editor; authored Niagara assets and a packaged UE5 game have not yet been produced.
- The UE5 Android workflow is authored but has not been run; no self-hosted runner or Android APK build has been verified.

## Workspace

- `Docs/CORE_SYSTEMS_MAP.md` — authoritative core/branch ownership registry.
- `Docs/MIGRATION_PLAN.md` — migration phases and acceptance gates.
- `Docs/THREE_TO_UE5_MAP.md` — legacy implementation to UE5 mapping.
- `Docs/LEGACY_UI_MIGRATION.md` — audit of the legacy HTML/CSS/JS screens and the native UMG conversion map.
- `Data/planetary-profile.json` — engine-neutral Earth reference data.
- `Docs/ATMOSPHERE_CLIMATE_CORE.md` — Atmosphere & Climate Core architecture, units, current model and validation gates.
- `Source/Frontier/` — native UE5 C++ module and core implementations.

## UI migration status

The legacy `index.html`, `style.css`, `src/main.js`, Vite and Capacitor files have been audited. They remain preserved as reference material; they are not UE5 runtime dependencies. Character and ship HUD native UMG C++ scaffolds already exist. Login/profile entry, main menu panels, inventory, loading, pause and notifications still require dedicated UMG implementation. See [LEGACY_UI_MIGRATION.md](Docs/LEGACY_UI_MIGRATION.md). The legacy password field is only a local demo check, not secure account authentication.
