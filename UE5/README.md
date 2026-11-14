# Star Frontier — Unreal Engine 5

This workspace is the destination for the **complete migration** of Star Frontier to Unreal Engine 5. UE5 is the sole target engine for future development.

## Migration direction

- No new gameplay, world, ship, character, HUD or rendering features will be developed in Three.js.
- Three.js is legacy source material used only to inspect existing behavior, data and assets while each system is ported.
- The final game runtime is intended to be Unreal Engine 5; this is not a dual-engine project.
- Existing cores and their branches must be migrated with their ownership boundaries intact. Do not replace them with a generic hierarchy or merge unrelated responsibilities.
- As each UE5 core passes its acceptance checks, its Three.js counterpart becomes obsolete for active development.

## Existing core systems to migrate

- Character Core → model, animation, HUD, movement/look, camera and interaction branches.
- Ship Core → exploration hull, interior/decks, bridge, computer, engines, camera, controls and player-ship association.
- Earth Core v1.6.0 → seven branches: interior, surface, terrain, oceans, atmosphere, clouds and lighting.
- Planetary Core → planetary identity, physical dimensions, gravity, rotation, altitude and coordinate rules.
- Atmosphere & Climate Core → scientific atmospheric and climate data, separate from rendering effects.
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
- Frontier module rules and module entry point are committed.
- The C++ has not yet been compiled by Unreal Build Tool or validated in Unreal Editor.
- A runnable `.uproject`, generated content assets and packaged game have not yet been produced.

## Workspace

- `Docs/CORE_SYSTEMS_MAP.md` — authoritative core/branch ownership registry.
- `Docs/MIGRATION_PLAN.md` — migration phases and acceptance gates.
- `Docs/THREE_TO_UE5_MAP.md` — legacy implementation to UE5 mapping.
- `Data/planetary-profile.json` — engine-neutral Earth reference data.
- `Source/Frontier/` — native UE5 C++ module and core implementations.
