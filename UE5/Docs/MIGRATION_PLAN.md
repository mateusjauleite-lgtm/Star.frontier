# Star Frontier — Complete UE5 Migration Plan

## Goal

Migrate the complete Star Frontier game to Unreal Engine 5. UE5 is the sole target runtime and development engine. This is a full engine migration, not a dual-engine strategy.

The existing Three.js project is legacy source material: it may be inspected to recover behavior, data, geometry and design decisions, but it is not a target for new features. Once a system is ported and validated in UE5, its Three.js implementation is retired from active development.

Preserve the existing **Core → branches/modules** architecture and ownership rules. Do not flatten the systems into a generic hierarchy or combine independent cores.

The authoritative ownership map is [CORE_SYSTEMS_MAP.md](CORE_SYSTEMS_MAP.md).

## Phase 0 — Core and branch alignment

- [x] Create a dedicated migration branch from `feature/character-core`.
- [x] Preserve the original baseline branch as a recovery/reference point.
- [x] Inventory Character Core, Ship Core, Earth Core and their existing branches.
- [x] Register Planetary Core, Atmosphere & Climate Core and Geology & Biomes Core as shared domain cores.
- [x] Establish the UE5 workspace and engine-neutral Earth profile.
- [x] Create native Frontier module rules and module entry point.

## Phase 1 — Planetary Core

Implemented source scaffold:

- [x] `UPlanetaryProfileDataAsset` composes the established Planetary Core branches.
- [x] Body identity branch.
- [x] Physical dimensions branch with mean, equatorial and polar radii.
- [x] Gravity branch.
- [x] Rotation/orientation branch.
- [x] Altitude reference branch.
- [x] Coordinate convention branch.
- [x] `UPlanetaryCoordinateSubsystem` provides explicit km ↔ Unreal centimetre conversion and separate visual scaling.
- [x] Profile validation requires a body identity and positive physical dimensions.

Still required before this core is considered migrated:

- [ ] Import the Earth reference profile into a native UE5 Data Asset.
- [ ] Add automated C++/automation tests for profile validation and unit conversion.
- [ ] Compile with the selected Unreal Engine toolchain and verify the Data Asset in Editor.
- [ ] Add coordinate-frame transforms only after the project's axis, origin and longitude conventions are formally fixed.

**Exit gate:** Earth profile loads in UE5 without changing its physical values; visual scale conversion is explicit and tested.

## Phase 2 — Character Core and branches

Existing branches: model, animation, HUD, movement/look, camera and interaction.

Initial native source scaffold committed:
- [x] Character state/mode contract with the existing on-foot/ship-control, standing/seated, health, stamina, grounded, movement, look, interaction-target and equipment fields.
- [x] Native `AFrontierCharacter` actor using a dedicated `UFrontierCharacterMovementComponent` subclass.
- [x] Dedicated third-person camera boom, elevated rear offset and full yaw orbit.
- [x] `UFrontierCharacterInputConfig` Data Asset and independent movement/look bindings through Enhanced Input.
- [x] Model presentation Data Asset for skeletal mesh, animation class, materials and capsule height.
- [x] Animation instance base exposing movement, grounded and seated state.
- [x] Interaction interface and camera-forward interaction trace.
- [x] UMG HUD observer; it receives state and is hidden logically outside on-foot mode.
- [x] Ship-control mode transition stops on-foot movement without transferring ship state into Character Core.

Still required before Character Core is considered migrated:
- [ ] Create and assign Enhanced Input actions and mapping context in Editor.
- [ ] Import/retarget the humanoid exploration suit skeletal mesh and skeleton.
- [ ] Build the Animation Blueprint and map idle/walk/run/sit/stand poses from the legacy animator.
- [ ] Build the compact mobile HUD Blueprint, including movement, action, aim and interaction controls.
- [ ] Connect the pilot-seat interaction to Ship Core possession/camera handoff.
- [ ] Verify spawn location on Deck 1 bridge after Ship Core migration.
- [ ] Compile with Unreal Build Tool and validate behavior in a UE5 test map.

**Exit gate:** character behavior matches the established core contract in a UE5 test map.

## Phase 3 — Ship Core and branches

Native UE5 source structure and first integration pass:

- [x] `AFrontierShip` owns ShipId, CommanderId and ship flight state.
- [x] Exploration hull profile and modular mesh assembly component.
- [x] Independent deck module actor and Data Asset with per-wall transform/collision.
- [x] Four original deck identities: D1 command, D2 operations/science, D3 engineering, D4 hangar/support.
- [x] Protected hangar-exit and elevator-access clearance volumes in deck definitions.
- [x] Interior branch composes missing deck actors from its deck-definition list.
- [x] Elevator actor with D1–D4 stops and ship-local deck selection/routing.
- [x] Bridge pilot station with original local console position and character interaction.
- [x] Ship computer boot/shutdown, terminal permissions and navigation telemetry.
- [x] Engine component for acceleration, speed, boost and braking; boost now affects the speed cap.
- [x] Dedicated ship camera boom and camera.
- [x] Ship controls component exposing throttle, pitch, yaw, brake and boost.
- [x] Requester-checked pilot exit API for Enhanced Input or mobile HUD integration.
- [x] Player ship association World Subsystem.
- [x] Pilot handoff attaches the character to the ship frame, changes view target and restores the character at the bridge exit when piloting ends.
- [x] Ship Core exposes D1–D4 character placement using the original deck/elevator local positions.
- [x] Explicit Three.js Y-up/metre-like to UE5 X-forward/Z-up/centimetre position conversion.
- [x] Swept ship movement now has a blocking root collision component; its box is a configurable proxy, not final hull collision.
- [x] Elevator stop selection measures the character in the owning ship's local coordinate frame.

Still required before Ship Core is considered migrated and playable:

- [x] Port the exploration ship's main saucer hull, engineering pods, twin nacelles, engine cores, hangar lips and observation windows into a native UE5 primitive-mesh fallback based on the legacy Three.js positions and proportions.
- [x] Expand the elevator interaction volume to cover the vertical span of the four legacy deck stops, since the elevator actor is centered in the shaft.
- [ ] Import/assemble the final authored exploration hull, nacelles, engines and interior mesh assets; replace the primitive fallback once those assets are ready.
- [x] Add an Unreal Editor Python creation script for the four named deck Data Assets, including D1–D4 identity, labels and clearance flags.
- [ ] Run the script in Unreal Editor to generate the four binary `.uasset` files, then assign them to the Ship Interior component's `DeckDefinitions` array.
- [ ] Import floor/wall meshes and author each wall transform/collision separately; set clearance boxes only after measuring the real geometry.
- [x] Port the legacy interior's four deck elevations and elliptical floor footprints into the deck Data Asset schema; provide an engine-basic-mesh fallback floor so deck geometry can be instantiated before final mesh import.
- [x] Create runtime fallback definitions for D1–D4 when Editor Data Assets are not yet assigned, so the ship can spawn all four decks immediately from the migrated layout.
- [ ] Define and verify the actual hangar-exit and elevator-access clearance boxes, with no obstructing meshes or collision.
- [ ] Replace or fit the temporary box collision proxy to the final hull collision geometry.
- [ ] Add bridge stations/console meshes and configure terminal permissions per station.
- [ ] Bind flight controls and the pilot-exit request to Enhanced Input and mobile UMG controls.
- [ ] Verify character starts on Deck 1 and deck/elevator circulation is correct.
- [ ] Compile with Unreal Build Tool and test ship movement, collision, camera handoff, computer permissions and deck routing in Editor.

Preserve the existing ship branch ownership: exploration hull, interior/decks, bridge, computer, engines, camera, controls and player-ship association.

- Keep ShipId and CommanderId owned by Ship Core.
- Keep each deck independently loadable and editable.
- Keep walls, openings, doors, elevator and collision as independent modules.
- Deck 1 remains the command bridge; Deck 2 operations/science; Deck 3 engineering; Deck 4 hangar/support.
- Protect the Deck 4 hangar opening and Deck 2 elevator access from wall/collision overlap.
- Pilot-seat interaction changes Character Core mode and camera/HUD presentation without moving ship state into Character Core.

**Exit gate:** Deck 1 bridge and other decks load as separate modules; hangar and elevator circulation are unobstructed; flight and collision behavior pass a UE5 Editor test.

## Phase 4 — Atmosphere & Climate and Geology & Biomes Cores

- Port scientific atmospheric composition, vertical structure, pressure, density and temperature as domain data, separate from UE rendering effects.
- Port geological and ecological classification data independently from mesh generation.
- Keep biome distribution data-driven by latitude, elevation, temperature, precipitation, substrate and water availability.
- Provide explicit interfaces for Earth Core to consume both domain cores.

**Exit gate:** domain data can be tested without loading Earth rendering or UE visual effects.

## Phase 5 — Earth Core and its seven branches

Earth Core v1.6.0 remains the orchestrator of seven branches: interior, surface, terrain, oceans, atmosphere, clouds and lighting.

- Planetary Core supplies physical body data and coordinate rules.
- Atmosphere & Climate Core owns scientific atmosphere/climate data; Sky Atmosphere and cloud rendering are replaceable UE5 branches.
- Geology & Biomes Core owns geological/ecological domain data; terrain, surface and oceans remain distinct Earth branches.
- Keep all seven Earth branches independently testable and replaceable.
- Prototype spherical geometry and local tile coordinates before regional detail/streaming.

**Exit gate:** Earth Core composes the seven branches using the shared domain cores; scale and module lifecycle are validated.

## Phase 6 — Integration and target-device validation

- Integrate all migrated cores into one UE5 game runtime.
- Validate asset rights, import scale, axes, materials and GLB/glTF interchange fidelity.
- Profile CPU, GPU, memory, thermal behavior and battery on the target Android device.
- Establish mobile rendering tiers before enabling expensive effects.
- Verify that no gameplay-critical runtime dependency remains on Three.js.

**Exit gate:** all core-level tests pass, the integrated UE5 build runs on the target device, and Three.js is no longer required at runtime.

## Current limitations and risks

1. The native Planetary, Character and Ship Core source scaffolds have not been compiled; Unreal Editor/Build Tool validation is still required. The four ship deck `.uasset` files are generated by the committed Editor Python script and still need to be created in the actual project.
2. A runnable `.uproject` and generated UE assets are not yet present.
3. Planet-scale spherical streaming needs a dedicated coordinate/tile design; World Partition alone does not solve a spherical planet.
4. High-end rendering features can exceed the target Android budget.
5. Asset scale, axes and materials must be validated before bulk import.
