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

The native character actor uses a dedicated Character Movement Component subclass and a Data Asset for Enhanced Input actions/mapping. The dedicated camera boom provides the elevated third-person follow view and unrestricted yaw orbit. Model assets are supplied through a Data Asset; animation state is exposed to an Animation Blueprint. The interaction interface keeps target behavior outside the character, and the UMG HUD observes the Character Core state. Entering ship-control mode seats the character, stops on-foot movement and hides the on-foot HUD through the state event; Ship Core remains the owner of ship state.

This is a source scaffold, not a finished playable character. Input assets, skeletal mesh/rig, Animation Blueprint, HUD Blueprint and ship-seat handoff still need Editor-side setup and validation.

## Implemented source scaffold: Ship Core

```text
Ships/
  Core/ FrontierShip.h/.cpp
  Exploration/ FrontierShipExplorationProfile.h; FrontierShipExplorationHullComponent.h/.cpp
  Interior/ FrontierShipDeckDefinition.h; FrontierShipDeckModule.h/.cpp; FrontierShipInteriorComponent.h/.cpp; FrontierShipElevator.h/.cpp
  Bridge/ FrontierPilotStation.h/.cpp
  Computer/ FrontierShipComputerComponent.h/.cpp
  Engines/ FrontierShipEngineComponent.h/.cpp
  Camera/ FrontierShipCameraBoom.h/.cpp
  Controls/ FrontierShipControlsComponent.h/.cpp
  PlayerShip/ FrontierPlayerShipSubsystem.h/.cpp
```

The Ship Core owns ShipId, CommanderId, flight state and its feature components. Its root now uses a configurable collision box so swept actor movement checks a blocking root shape; this is a temporary proxy and must be fitted to the imported hull or replaced with a dedicated hull collision mesh. The exploration hull is assembled from a profile of independently transformed mesh parts.

Deck definitions are held by the interior branch, which can spawn any missing deck modules at runtime. Decks remain separate actors driven by Data Assets; wall pieces have individual transforms and collision flags, with protected hangar/elevator clearance volumes. The elevator routes among the four original deck stops and determines the current stop in ship-local coordinates. The bridge pilot station enters Ship Core piloting, attaches the character to the ship's local frame, switches the view target and registers the current player ship. Pilot exit is exposed through a requester-checked API for Enhanced Input or a mobile HUD action. Ship Core also exposes a deck-placement API for placing the character on D1–D4. The computer has terminal permissions and navigation telemetry; engines and controls are separate components, with boost affecting the top speed.

The legacy ship used Three.js Y-up coordinates and metre-like source units. The migration helper converts local positions to UE5 X-forward/Z-up centimetres: UE X = -legacy Z, UE Y = legacy X, UE Z = legacy Y, multiplied by 100. Imported hull/deck assets must follow this convention or provide an explicit import transform.

The native Ship Core code path is now organized for Editor integration, but it is **not yet a validated playable ship**. Actual hull/deck meshes, four authored deck Data Assets and clearance bounds, terminal permissions, Enhanced Input/mobile UI bindings, final hull collision, and Editor-side layout verification remain. No Unreal compile or Editor test has been performed.

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

Planetary Core, Character Core and Ship Core source scaffolds have not been compiled with Unreal Build Tool or tested in Editor. No runnable `.uproject` or packaged game is claimed to exist.
