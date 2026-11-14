# Star Frontier — Unreal Engine 5

This directory is the migration workspace for the Unreal Engine 5 implementation.

## Status

- Migration branch: `ue5/frontier-migration`
- Baseline: `feature/character-core`
- Current runtime: Three.js (preserved and unchanged by this workspace)
- UE5 runtime: not yet created or compiled
- Migration strategy: parallel implementation; no destructive engine replacement

## First implementation targets

1. Establish a clean UE5 project using a mobile-capable rendering baseline.
2. Port the character controller and third-person camera as the first playable vertical slice.
3. Build the ship as independent modular components: hull, decks, walls, doors, elevators, hangar and bridge.
4. Import the Earth scientific profile and build a low-detail spherical planet prototype.
5. Profile on the Galaxy A34 before increasing visual quality.

## Important boundaries

- The existing Earth profile is scientific data, not a complete planetary simulation.
- The current Three.js modules are references and behavior specifications, not drop-in UE5 code.
- GLB/glTF is the first asset interchange format; renderer-specific materials, atmosphere and volumetrics must be rebuilt in UE5.
- Never merge this branch into the active baseline until the UE5 prototype passes the migration gates in [the plan](Docs/MIGRATION_PLAN.md).

## Workspace map

- `Docs/MIGRATION_PLAN.md` — phases, architecture and acceptance gates.
- `Docs/THREE_TO_UE5_MAP.md` — current systems mapped to UE5 equivalents.
- `Data/planetary-profile.json` — engine-neutral Earth reference data.
- `Source/Frontier/README.md` — proposed C++/Blueprint module boundaries.
