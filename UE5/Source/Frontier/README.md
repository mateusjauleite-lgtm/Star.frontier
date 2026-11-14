# Frontier UE5 Source Layout

This source tree preserves the established Star Frontier **Core → branches** architecture. The full ownership registry is [CORE_SYSTEMS_MAP.md](../../Docs/CORE_SYSTEMS_MAP.md).

## Native module

- `Frontier.Build.cs` — Core, CoreUObject and Engine dependencies.
- `Private/Frontier.cpp` — module entry point.

## Implemented first core: Planetary Core

```text
Worlds/Planetary/
  Core/
    PlanetaryProfileDataAsset.h/.cpp
    PlanetaryCoordinateSubsystem.h/.cpp
  Branches/
    PlanetaryBodyIdentity.h
    PlanetaryDimensions.h
    PlanetaryGravity.h
    PlanetaryRotation.h
    PlanetaryAltitude.h
    PlanetaryCoordinates.h
```

The profile is a `UPrimaryDataAsset` that composes the six distinct branch data structures. The coordinate subsystem keeps physical kilometres separate from Unreal centimetres and from project-specific visual radius. Earth physical values remain in the engine-neutral reference profile until a native Data Asset is created in Editor.

## Remaining established cores and branches

```text
Character/
  Core/
  Model/
  Animation/
  Camera/
  Input/
  Movement/
  Interaction/
  HUD/
Ships/
  Core/
  Exploration/
  Interior/
  Decks/
  Bridge/
  Computer/
  Engines/
  Camera/
  Controls/
  PlayerShip/
Worlds/
  Earth/
    Core/
    Interior/
    Surface/
    Terrain/
    Oceans/
    Atmosphere/
    Clouds/
    Lighting/
  AtmosphereClimate/
    Core/
    Composition/
    VerticalStructure/
    Climate/
    Weather/
    Rendering/
  GeologyBiomes/
    Core/
    Interior/
    Surface/
    Terrain/
    Oceans/
    Biomes/
Interop/
  AssetImport/
  Validation/
  LegacyReference/
```

## Dependency rules

- Character Core may enter Ship Core pilot mode; it does not own ship state.
- Ship Core owns ShipId and CommanderId; it does not own character identity.
- Earth Core composes its seven established branches and consumes shared domain cores.
- Planetary Core owns physical body/coordinate contracts, not visual meshes.
- Atmosphere & Climate and Geology & Biomes own domain data, not renderer-specific effects.
- HUD widgets display state; they do not own movement, ship simulation or world science.
- Use Actor Components for reusable behavior; use independent Actors/Level Instances where placement, loading, collision or replacement must be independent.
- Avoid per-frame Tick when event-driven updates or explicit update intervals are sufficient.

## Validation status

Planetary Core C++ source is committed but has **not** yet been compiled with Unreal Build Tool or tested in Editor. No runnable `.uproject` or packaged game is claimed to exist.
