# Frontier UE5 Source Layout

This source tree preserves the established Star Frontier **Core → branches** architecture. The full ownership registry is [CORE_SYSTEMS_MAP.md](../../Docs/CORE_SYSTEMS_MAP.md).

## Native module

- `Frontier.Build.cs` — Core, CoreUObject, Engine, EnhancedInput, UMG and Niagara dependencies.
- `Private/Frontier.cpp` — module entry point.

## Initial Main Core source scaffold

```text
Main/
  FrontierGameMode.h/.cpp
Config/
  DefaultEngine.ini
```

`AFrontierGameMode` is the world-entry coordinator after the Unreal Engine startup splash and map load. It selects `AFrontierCharacter` as the default pawn, spawns the configured exploration ship and places the possessed character on the configured starting deck (D1 by default). The default GameMode is registered in `Config/DefaultEngine.ini`. The project descriptor is `UE5/StarFrontier.uproject`; game and Editor targets are provided alongside the module. `Tools/EditorPython/create_main_startup_map.py` creates the initial map package inside Unreal Editor.

The `.uproject` descriptor is present, but the generated startup `.umap`, authored ship Blueprint/assets and Editor validation are still outstanding. The engine's splash/logo is not implemented as a game menu by this class.

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

The native character actor uses a dedicated Character Movement Component subclass and a Data Asset for Enhanced Input actions/mapping. The Character HUD builds a native UMG layout at runtime: left movement touch zone, right 360° camera touch zone, jump/action buttons and contextual elevator up/down buttons. It hides while seated. The Ship HUD builds a separate pilot layout with throttle/steering touch zones and impulse, brake and exit buttons; Ship Core creates/removes it with the pilot-seat lifecycle. Both HUDs fall back to their native classes if no Blueprint subclass is assigned. See [HUD_CONTROLS_MIGRATION.md](../../Docs/HUD_CONTROLS_MIGRATION.md) for the touch control contract. The dedicated camera boom provides the elevated third-person follow view and unrestricted yaw orbit. Model assets are supplied through a Data Asset; animation state is exposed to an Animation Blueprint. The interaction interface keeps target behavior outside the character, and the UMG HUD observes the Character Core state. Entering ship-control mode seats the character, stops on-foot movement and hides the on-foot HUD through the state event; Ship Core remains the owner of ship state.

This is a source scaffold, not a finished playable character. Input assets, skeletal mesh/rig, Animation Blueprint, mobile HUD scale/safe-area tuning and touch-device validation still need Editor-side verification.

## Implemented source scaffold: Ship Core

```text
Ships/
  Core/ FrontierShip.h/.cpp
  Exploration/ FrontierShipExplorationProfile.h; FrontierShipExplorationHullComponent.h/.cpp
  Interior/ FrontierShipDeckDefinition.h; FrontierShipDeckModule.h/.cpp; FrontierShipInteriorComponent.h/.cpp; FrontierShipElevator.h/.cpp
  Bridge/ FrontierPilotStation.h/.cpp
  Computer/ FrontierShipComputerComponent.h/.cpp
  Engines/ FrontierShipEngineComponent.h/.cpp; FrontierShipEngineFXComponent.h/.cpp
  Camera/ FrontierShipCameraBoom.h/.cpp
  Controls/ FrontierShipControlsComponent.h/.cpp
  PlayerShip/ FrontierPlayerShipSubsystem.h/.cpp
```

The Ship Core owns ShipId, CommanderId, flight state and its feature components. Its root now uses a configurable collision box so swept actor movement checks a blocking root shape; this is a temporary proxy and must be fitted to the imported hull or replaced with a dedicated hull collision mesh. The exploration hull is assembled from a profile of independently transformed mesh parts.

Deck definitions are held by the interior branch, which creates runtime D1–D4 fallback definitions from the legacy layout when no Editor Data Assets are assigned, then spawns any missing deck modules. Each fallback deck receives an elliptical engine-cylinder floor at the original elevation and footprint; final imported floor and wall meshes can replace these primitives through the same Data Asset contract. Decks remain separate actors driven by Data Assets; wall pieces have individual transforms and collision flags, with protected hangar/elevator clearance volumes. The elevator routes among the four original deck stops and determines the current stop in ship-local coordinates. The bridge pilot station enters Ship Core piloting, attaches the character to the ship's local frame, switches the view target and registers the current player ship. Pilot exit is exposed through a requester-checked API for Enhanced Input or a mobile HUD action. Ship Core also exposes a deck-placement API for placing the character on D1–D4. The computer has terminal permissions and navigation telemetry; engine dynamics, visual Engine FX and controls are separate components. The visual FX branch reads throttle/speed/boost/braking telemetry, drives two aft exhaust glow lights and supports optional Niagara systems; it never changes engine physics. Boost affects the top speed.

The legacy ship used Three.js Y-up coordinates and metre-like source units. The migration helper converts local positions to UE5 X-forward/Z-up centimetres: UE X = -legacy Z, UE Y = legacy X, UE Z = legacy Y, multiplied by 100. Imported hull/deck assets must follow this convention or provide an explicit import transform.

The native Ship Core code path is now organized for Editor integration, but it is **not yet a validated playable ship**. A Python Editor creation script is available at `UE5/Content/Editor/Python/create_ship_deck_assets.py`; running it inside Unreal Editor creates or updates these four assets under `/Game/StarFrontier/Ships/Decks`: `DA_Deck01_Command`, `DA_Deck02_OperationsScience`, `DA_Deck03_Engineering` and `DA_Deck04_HangarSupport`. The script sets each deck identity, code, display name and clearance flags. It deliberately leaves floor/wall meshes and clearance boxes unset until the real geometry is imported and measured. The four binary `.uasset` files are generated by Unreal Editor, not by GitHub source commits, so they have not yet been created in the project Content folder. The interior component's `DeckDefinitions` array must then be assigned these assets on the ship Blueprint/instance. Terminal permissions, Enhanced Input/mobile UI bindings, final hull collision and Editor-side layout verification remain. No Unreal compile or Editor test has been performed. Niagara emitter assets have not yet been authored or assigned.

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

Planetary Core, Character Core and Ship Core source scaffolds have not been compiled with Unreal Build Tool or tested in Editor. The `.uproject` descriptor exists, but the generated startup `.umap`, successful Unreal build and packaged game are not yet available.
