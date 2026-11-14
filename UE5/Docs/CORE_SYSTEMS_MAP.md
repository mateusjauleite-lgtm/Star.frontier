# Frontier — Core and Branch Migration Registry

This registry preserves the existing Star Frontier architecture. UE5 work must update the established cores and their branches; it must not replace them with a new generic hierarchy.

## Architecture rule

Each **Core** owns its domain state, contracts and lifecycle. Its **branches** are focused modules that extend that core. In UE5, preserve these boundaries with C++ core classes/subsystems, Actor Components, Blueprint Actors and Data Assets as appropriate. Do not create a monolithic Blueprint that combines unrelated systems.

The current Three.js files remain legacy reference material for behavior, data and geometry recovery. UE5 is the only target runtime; do not add new Three.js features.

## 0. Main Core

Main Core owns the world-entry sequence after Unreal Engine has initialized and loaded the selected map. It coordinates startup; it does not absorb the responsibilities of Character Core or Ship Core.

UE5 mapping:
- World startup and default player class → `AFrontierGameMode`.
- Initial exploration ship creation → configurable `StartingShipClass` and `StartingShipTransform`.
- Initial player placement → `StartingDeckCode`, defaulting to D1, delegated to `AFrontierShip::PlaceCharacterOnDeck`.
- Global default GameMode registration → `Config/DefaultEngine.ini`.
- Unreal Engine's own startup splash/logo remains an engine/project presentation setting, not a gameplay screen owned by Main Core.
- `StarFrontier.uproject`, game/editor Target.cs files and the default map configuration are now present. `Tools/EditorPython/create_main_startup_map.py` creates the initial map in Unreal Editor; the `.umap` package, successful project generation/build and Editor validation are still outstanding.

## 1. Character Core

Existing source: `src/character/characterCore.js`

Current branches:
- Character model — `src/character/characterModel.js`
- Character animation — `src/character/characterAnimator.js`
- Character HUD — `src/character/characterHUD.js`

UE5 mapping:
- Core state and mode contract → `UFrontierCharacterStateComponent`, composed by `AFrontierCharacter`.
- Physical player → `AFrontierCharacter` derived from `ACharacter`.
- Camera and 360-degree look → dedicated `UFrontierCharacterCameraBoom` + camera, driven by Enhanced Input.
- Model and animation → `UFrontierCharacterPresentationData`, Skeletal Mesh and `UFrontierCharacterAnimInstance` base for an Animation Blueprint.
- HUD → `UFrontierCharacterHUDWidget` observes state changes; it does not own gameplay state.
- Movement → dedicated `UFrontierCharacterMovementComponent` subclass of Unreal Character Movement; movement and look inputs are independent.
- Input → `UFrontierCharacterInputConfig` Data Asset stores the Enhanced Input mapping context and action assets.
- Interaction → `UFrontierInteractable` interface; character performs a camera trace and delegates behavior to the target.
- Seat state → explicit transition to ship-control mode; stop on-foot movement and hide on-foot HUD while seated.

Preserve the existing state contract: on-foot vs ship-control, standing vs seated, health, stamina, grounded, movement, look, interaction target and equipment.

## 2. Ship Core

Existing source areas: `src/ships/`

Current branches/modules:
- Exploration hull and flight hierarchy — `exploration.js`
- Interior and deck layout — `interior.js`
- Ship camera — `camera.js`
- Ship controls — `shipControls.js`
- Player/owned ship association — `playerShip.js`
- Engines — `engines.js`
- Command bridge — `bridge/commandBridge.js`
- Ship computer — `computer/shipComputer.js` and `computer/shipComputerSystems.js`

UE5 mapping:
- Ship Core → `AFrontierShip`; owns `FFrontierShipIdentity` (ShipId/CommanderId), flight state and ship lifecycle.
- Collision/movement → movable `UBoxComponent` root proxy so actor sweep has a blocking shape; fit or replace it with final hull collision after mesh import.
- Exploration hull → `UFrontierShipExplorationHullComponent` assembled from `UFrontierShipExplorationProfile` mesh parts.
- Interior/decks → `UFrontierShipInteriorComponent`, `AFrontierShipDeckModule` and `UFrontierShipDeckDefinition`; interior can spawn missing deck actors from its definition list. Each wall segment has its own transform and collision setting.
- Elevator → `AFrontierShipElevator`, with the four original D1–D4 stops and ship-local deck selection/routing.
- Bridge → `AFrontierPilotStation` interaction actor; the legacy pilot-console location is converted to UE5 coordinates.
- Computer → `UFrontierShipComputerComponent` with boot/shutdown, one active terminal, terminal system permissions and navigation telemetry.
- Engine dynamics → `UFrontierShipEngineComponent` for acceleration, speed, boost and braking; boost scales the maximum speed.
- Engine FX → `UFrontierShipEngineFXComponent` reads flight telemetry and drives two aft exhaust glow lights plus optional Niagara emitters. It is visual-only and does not own or alter movement, acceleration or speed.
- Camera → `UFrontierShipCameraBoom` with its own camera.
- Controls → `UFrontierShipControlsComponent` exposes throttle, pitch, yaw, brake, boost and a requester-checked pilot-exit request.
- Player/owned ship → `UFrontierPlayerShipSubsystem` stores the current player ship.
- Character deck placement → `AFrontierShip::PlaceCharacterOnDeck` attaches the character to the ship frame and places it on D1–D4 using the converted legacy positions.
- Pilot handoff → Ship Core attaches the character to its local frame, switches the view target and restores the character to the bridge deck exit when piloting ends.

Deck constraints to carry forward:
- Deck 1 is the command bridge and the intended initial command location. The legacy source places the pilot station at local Three.js (0, 8.91, -29.5) and the deck return point at (0, 8.91, -25.5).
- Deck 2 operations/science; Deck 3 engineering; Deck 4 hangar/support.
- Deck 4 hangar exit must remain a clear opening; do not place wall meshes or collision across its circulation volume.
- Deck 2 elevator/vertical access must remain unobstructed.
- Do not generate a second independent ceiling plate where the next deck already provides the ceiling.
- Wall segments and door openings remain separately editable and collision-tested. Deck definitions provide protected clearance bounds for the hangar exit and elevator access.

## 3. Earth Core

Existing source: `src/world/earth/earthCore.js`, version 1.6.0.

Earth Core remains the orchestrator of seven established branches:
1. Interior
2. Surface
3. Terrain
4. Oceans
5. Atmosphere
6. Clouds
7. Lighting

Existing runtime modules live under `src/world/earth/modules/runtime/`; definitions and lifecycle are registered through `modules/index.js` and `earthUpdatePipeline.js`.

UE5 mapping:
- Earth Core → `AFrontierEarth` or a dedicated World Subsystem that owns planet identity, profile, module registration and lifecycle.
- Each of the seven branches remains independently replaceable.
- Physical profile → Data Asset/JSON, never embedded in a material or mesh.
- Earth renderers are UE5 implementations of the branches, not direct ports of Three.js runtime code.

## 4. Planetary Core

Domain core for planet-scale physical identity and coordinate rules. It is shared by Earth and future planetary bodies.

Primary existing data:
- `src/world/earth/planetaryProfile.js`
- `src/world/planetary/planetaryScience.js`

UE5 mapping:
- Planetary Core → reusable planetary data model + coordinate/scale subsystem.
- Child data branches: body identity, physical dimensions, gravity, rotation/orientation, altitude and coordinate reference.
- Earth is one body profile; other planets must not inherit Earth's values by default.
- Mean physical radius (Earth): 6,371.0088 km. Current visual radius (300 render units) is an independent preview scale.

## 5. Atmosphere & Climate Core

Domain core for atmospheric composition, vertical structure and climate variables.

Existing Earth branches currently represented by:
- Atmosphere
- Clouds
- Lighting (rendering dependency only; not the owner of climate science)

UE5 mapping:
- Scientific state/data stays in this core.
- Sky Atmosphere, Volumetric Clouds, fog and lighting are renderer branches/adapters.
- Climate/atmosphere data must not be conflated with the visual scattering settings.
- Future weather, pressure, density, temperature and circulation branches attach here without bloating Earth Core.
- Initial UE5 source slice: `FAtmosphericComposition`, `FAtmosphericLayerDefinition`, `FAtmosphericClimateBaseline`, `UAtmosphereClimateProfileDataAsset` and `UAtmosphereClimateSubsystem`. The profile references `UPlanetaryProfileDataAsset`; the runtime subsystem exposes deterministic pressure, temperature and ideal-gas density samples by altitude.
- The current model is a baseline approximation only. Earth-specific profile assets, rendering adapters, automated tests and UE5 compilation remain outstanding.

## 6. Geology & Biomes Core

Domain core for solid-surface structure, terrain, geology, water/land context and ecological distribution.

Existing Earth branches:
- Interior
- Surface
- Terrain
- Oceans

UE5 mapping:
- Scientific and classification data remains separate from mesh generation.
- Terrain/planet mesh, landscape tiles, materials and PCG are implementation branches.
- Biome distribution must be data-driven (latitude, elevation, temperature, precipitation, substrate and water availability), not just slope.
- Oceans are a distinct branch and must preserve shoreline/coastline interfaces with terrain and surface.

## 7. Cross-core dependencies

- Character Core requests movement/interaction and may enter Ship Core pilot mode; it does not own ship state.
- Ship Core owns ship identity and commander association; it does not own the character's persistent identity.
- Earth Core composes the seven Earth branches and consumes Planetary, Atmosphere & Climate, and Geology & Biomes domain cores.
- Planetary Core provides body dimensions and coordinate conventions to all planet instances.
- Atmosphere & Climate and Geology & Biomes provide domain data; Earth Core coordinates their Earth-specific presentation.
- HUD branches observe core state and never become the source of gameplay truth.

## Migration status

Planetary Core, Character Core, Ship Core and the initial Atmosphere & Climate Core now have native UE5 source scaffolds on the migration branch. Ship Core includes its root collision proxy, deck-definition composition, ship-local elevator selection, boost speed scaling, a guarded pilot-exit API and a visual-only Engine FX branch. Atmosphere & Climate includes composition, vertical layers, climate baseline and altitude sampling. These are source-level integrations only; they have not been compiled or tested in Unreal Editor. Ship assets, authored Data Assets, terminal configuration, Enhanced Input/mobile UI bindings and final collision tuning remain Editor-side work. The existing core names and branch boundaries must remain recognizable throughout the port.
