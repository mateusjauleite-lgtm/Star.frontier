# Earth Core — UE5 implementation and asset contract

## Ownership

`AFrontierEarth` is the Earth-specific composition root. It owns only Earth instance configuration and the lifecycle of its seven Earth presentation branches. It does not own generic planetary physics, atmosphere science, geology classification or shared rendering technology.

- Planetary Core owns body identity, physical radii, gravity, rotation, altitude and coordinate conventions.
- Atmosphere & Climate Core owns composition, vertical layers and climate state.
- Geology & Biomes Core will own solid-surface/geological/ecological classification.
- Earth Core composes these domain profiles for this Earth instance and coordinates its render branches.

## Seven branches and dependency graph

| Branch | Required branch dependencies | Domain owner / input |
|---|---|---|
| Interior | none | Geology & Biomes |
| Surface | none | Geology & Biomes |
| Terrain | Surface | Geology & Biomes + elevation data |
| Oceans | Surface | Geology & Biomes + ocean/coast data |
| Atmosphere | none | Atmosphere & Climate |
| Clouds | Atmosphere | Atmosphere & Climate |
| Lighting | Atmosphere | Sun direction and atmospheric presentation |

The initialization order matches `src/world/earth/modules/index.js`. Lighting depends on Atmosphere, not Clouds, matching the existing module contract.

## UE5 source

- `Public/Worlds/Earth/Core/FrontierEarth.h`
- `Private/Worlds/Earth/Core/FrontierEarth.cpp`
- `Public/Worlds/Earth/Branches/FrontierEarthBranchComponent.h`
- `Private/Worlds/Earth/Branches/FrontierEarthBranchComponent.cpp`

The current component class is a lifecycle/dependency scaffold. Its seven component instances are independently configurable and replaceable, but do not yet render geometry or simulate branch systems.

## Profile and scale contract

Assign two authored assets to each Earth actor:
1. `UPlanetaryProfileDataAsset` with `Identity.BodyId = earth`.
2. `UAtmosphereClimateProfileDataAsset` whose `PlanetaryProfile` points to the exact same planetary profile asset.

Initialization rejects missing/invalid profiles and mismatched planetary references, initializes the seven branches, then activates the linked profile in `UAtmosphereClimateSubsystem`. That subsystem is currently world-scoped, so this implementation assumes one active Earth atmosphere profile per `UWorld`; multi-planet worlds will require per-body runtime state. The actor's `VisualRadiusUnits` is a presentation setting only. `GetVisualUnitsPerKilometre()` derives its ratio from the physical mean radius; it never edits scientific values.

## Asset audit — migration branch

- `UE5/Data/planetary-profile.json` exists as an engine-neutral reference.
- `assets/models/README.md` and `assets/textures/README.md` are placeholders only.
- No Earth model, Earth texture set, Earth elevation/ocean dataset, authored Earth Data Asset, or native Earth map/package was found in the tracked migration tree.
- No Earth-specific UE5 renderer assets (materials, meshes, Sky Atmosphere/Volumetric Cloud setup) were found.
- Existing Planetary and Atmosphere C++ data types are source code, not authored `.uasset` instances.

## Remaining implementation

1. Create the two linked profile assets in Unreal Editor and assign them to an Earth actor.
2. Implement the seven actual renderer/logic branches behind the component lifecycle.
3. Add Geology & Biomes Core and connect its data to Interior/Surface/Terrain/Oceans.
4. Import reviewed GLB/texture/elevation data with explicit axis, handedness and scale validation.
5. Add automated tests and verify in UE 5.8 Editor and Android device profile.

The legacy Three.js modules remain reference material only. Do not add Three.js runtime dependencies to the UE5 module.

## Canonical Earth Data Asset paths

The UE5.8 Editor authoring script is `UE5/Content/Editor/Python/create_earth_profile_assets.py`. Run it only after compiling/loading the Frontier module.

It reuses these canonical paths and updates an existing asset in place; it creates only if the path is absent:

- `/Game/StarFrontier/Worlds/Earth/DA_Earth_PlanetaryProfile`
- `/Game/StarFrontier/Worlds/Earth/DA_Earth_AtmosphereClimate`

The Planetary asset reads its radii and gravity from the existing `UE5/Data/planetary-profile.json`. The Atmosphere asset ports the vertical layer boundaries and standard-atmosphere reference calculation from `src/world/earth/modules/runtime/atmosphereModel.js`, with the pressure scale-height approximation required by the existing UE5 subsystem. Gas composition is a dry-air baseline; the climate values are an initial baseline, not a weather simulation.

The four existing ship-deck Data Asset definitions (D1–D4) are a separate Ship Core concern. Their idempotent authoring script remains `UE5/Content/Editor/Python/create_ship_deck_assets.py`; do not recreate or rename those assets as part of Earth Core.

No binary `.uasset` files are committed in the migration branch. The scripts author the assets inside the local Unreal project Content folder when run in the UE5.8 Editor. After running, assign the two Earth assets to the corresponding properties on the `AFrontierEarth` actor instance/Blueprint and save the project assets.
