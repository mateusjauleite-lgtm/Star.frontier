# Frontier — Core and Branch Migration Registry

This registry preserves the existing Star Frontier architecture. UE5 work must update the established cores and their branches; it must not replace them with a new generic hierarchy.

## Architecture rule

Each **Core** owns its domain state, contracts and lifecycle. Its **branches** are focused modules that extend that core. In UE5, preserve these boundaries with C++ core classes/subsystems, Actor Components, Blueprint Actors and Data Assets as appropriate. Do not create a monolithic Blueprint that combines unrelated systems.

The current Three.js files remain the source of behavior and data until each corresponding UE5 implementation is validated.

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
- Movement → Unreal Character Movement Component; movement and look inputs are independent.
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
- Ship computer — `computer/shipComputer.js` and `shipComputerSystems.js`

UE5 mapping:
- Ship Core → `AFrontierShip` with stable ShipId and CommanderId.
- Hull, bridge, engine groups and hangar → independent Scene/Static Mesh components or child Actors according to independent lifecycle needs.
- Decks → separate Level Instances or modular Actors; deck identity and connection graph are data-driven.
- Walls, openings and doors → separate modular actors/components with independent collision.
- Elevators → dedicated actor with deck-to-deck routing.
- Ship computer and bridge stations → separate feature components/actors communicating through ship interfaces.
- Pilot seat → interaction actor; possessing ship controls changes character mode and camera/HUD state.

Deck constraints to carry forward:
- Deck 1 is the command bridge and the intended initial command location.
- Deck 2 operations/science; Deck 3 engineering; Deck 4 hangar/support.
- Deck 4 hangar exit must remain a clear opening; do not place wall meshes or collision across its circulation volume.
- Deck 2 elevator/vertical access must remain unobstructed.
- Do not generate a second independent ceiling plate where the next deck already provides the ceiling.
- Wall segments and door openings remain separately editable and collision-tested.

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

This registry remains the authority for core ownership and branch boundaries. Native UE5 source scaffolds are now committed for Planetary Core and the first Character Core slice. Character Core includes its state/mode component, ACharacter actor, model presentation Data Asset, animation state base, dedicated camera boom, Enhanced Input bindings, movement integration, interaction interface and observer-only UMG HUD. These source scaffolds have not yet been compiled or tested in Unreal Editor. Character setup still needs input assets, mesh/rig, Animation Blueprint, HUD Blueprint and ship-seat integration. The existing core names and branch boundaries must remain recognizable throughout the port.
