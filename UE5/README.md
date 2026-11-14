# Star Frontier — Unreal Engine 5

This directory is the UE5 migration workspace. It follows the existing Star Frontier **Core → branches/modules** architecture; it is not a replacement architecture.

## Status

- Migration branch: `ue5/frontier-migration`
- Baseline: `feature/character-core`
- Current Three.js runtime: preserved as behavioral and visual reference
- UE5 runtime: not yet generated or compiled
- Strategy: migrate existing cores and their branches incrementally, without destructive engine replacement

## Existing core systems to preserve

- Character Core → model, animation, HUD, movement/look and interaction branches.
- Ship Core → exploration hull, interior/decks, bridge, computer, engines, camera and controls.
- Earth Core v1.6.0 → seven branches: interior, surface, terrain, oceans, atmosphere, clouds and lighting.
- Planetary Core → shared planetary identity, physical dimensions, gravity, rotation and coordinate rules.
- Atmosphere & Climate Core → atmospheric science and climate data; rendering effects remain replaceable branches.
- Geology & Biomes Core → interior, surface, terrain, oceans and biome/geology data.

The exact existing-to-UE5 mapping and ownership rules are in [CORE_SYSTEMS_MAP.md](Docs/CORE_SYSTEMS_MAP.md).

## Migration sequence

1. Update the existing core/branch registry and data contracts.
2. Port Planetary Core as an engine-neutral data contract and UE5 adapter.
3. Port Character Core state/input/camera behavior.
4. Port Ship Core and its existing branches, keeping decks and wall modules independent.
5. Port Earth Core and its seven branches, consuming the Planetary, Atmosphere & Climate, and Geology & Biomes domain cores.
6. Profile and validate on the target Android device before increasing rendering quality.

## Important boundaries

- The Earth physical profile is scientific reference data, not a complete planetary simulation.
- Three.js modules are behavioral references, not drop-in UE5 code.
- GLB/glTF is the first asset interchange format; renderer-specific materials and atmospheric effects must be rebuilt in UE5.
- Never merge this branch into the active baseline until the migration gates pass.

## Workspace

- `Docs/CORE_SYSTEMS_MAP.md` — authoritative existing core/branch registry for migration.
- `Docs/MIGRATION_PLAN.md` — phases and acceptance gates.
- `Docs/THREE_TO_UE5_MAP.md` — implementation mapping.
- `Data/planetary-profile.json` — engine-neutral Earth reference data.
- `Source/Frontier/README.md` — proposed C++/Blueprint module boundaries.
