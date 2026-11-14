# Frontier UE5 Source Layout

This source tree preserves the established Star Frontier **Core → branches** architecture. The full ownership registry is [CORE_SYSTEMS_MAP.md](../../Docs/CORE_SYSTEMS_MAP.md).

## Native module

- `Frontier.Build.cs` — Core, CoreUObject, Engine, EnhancedInput and UMG dependencies.
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

## Implemented source scaffold: Character Core

```text
Character/
  Core/
    FrontierCharacter.h/.cpp
    FrontierCharacterStateComponent.h/.cpp
  Model/
    FrontierCharacterPresentationData.h
  Animation/
    FrontierCharacterAnimInstance.h/.cpp
  Camera/
    FrontierCharacterCameraBoom.h/.cpp
  Interaction/
    FrontierInteractable.h
  HUD/
    FrontierCharacterHUDWidget.h/.cpp
```

The native character actor uses Unreal's Character Movement Component and Enhanced Input. The dedicated camera boom provides the elevated third-person follow view and unrestricted yaw orbit. Model assets are supplied through a Data Asset; animation state is exposed to an Animation Blueprint. The interaction interface keeps target behavior outside the character, and the UMG HUD observes the Character Core state. Entering ship-control mode seats the character, stops on-foot movement and hides the on-foot HUD through the state event; Ship Core remains the owner of ship state.

This is a source scaffold, not a finished playable character. Input assets, skeletal mesh/rig, Animation Blueprint, HUD Blueprint and ship-seat handoff still need Editor-side setup and validation.

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

Planetary Core and the first Character Core source scaffold are committed but have **not** yet been compiled with Unreal Build Tool or tested in Editor. No runnable `.uproject` or packaged game is claimed to exist.
