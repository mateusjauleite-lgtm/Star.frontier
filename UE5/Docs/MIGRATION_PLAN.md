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
- [ ] Validate remaining system branches against the registry as they are migrated.

## Phase 1 — Planetary Core

- Port the engine-neutral planetary profile into native UE5 data structures and a UE5 adapter.
- Preserve physical units independently from Unreal visual scale.
- Separate body identity, dimensions, gravity, rotation/orientation and coordinate rules.
- Make Earth one profile using the existing measured reference values; future planets receive their own profiles.
- Add automated validation for units, scale conversion and profile integrity.

**Exit gate:** Earth profile loads in UE5 without changing its physical values; visual scale conversion is explicit and tested.

## Phase 2 — Character Core and branches

Existing branches: model, animation, HUD, movement/look, camera and interaction.

Port:
- Character state and mode contract.
- Third-person camera above and behind the character.
- 360-degree look/aim, independent movement and look input.
- Compact HUD with movement, action, aim and interaction feedback.
- Hide the on-foot HUD while seated at a ship pilot station.

**Exit gate:** character behavior matches the established core contract in a UE5 test map.

## Phase 3 — Ship Core and branches

Preserve the existing ship branch ownership: exploration hull, interior/decks, bridge, computer, engines, camera, controls and player-ship association.

- Keep ShipId and CommanderId owned by Ship Core.
- Keep each deck independently loadable and editable.
- Keep walls, openings, doors, elevator and collision as independent modules.
- Deck 1 remains the command bridge; Deck 2 operations/science; Deck 3 engineering; Deck 4 hangar/support.
- Protect the Deck 4 hangar opening and Deck 2 elevator access from wall/collision overlap.
- Pilot-seat interaction changes Character Core mode and camera/HUD presentation without moving ship state into Character Core.

**Exit gate:** Deck 1 bridge and other decks load as separate modules; hangar and elevator circulation are unobstructed.

## Phase 4 — Earth Core and domain branches

Earth Core v1.6.0 remains the orchestrator of seven branches: interior, surface, terrain, oceans, atmosphere, clouds and lighting.

- Planetary Core supplies physical body data and coordinate rules.
- Atmosphere & Climate Core owns scientific atmosphere/climate data; Sky Atmosphere and cloud rendering are UE5 implementation branches.
- Geology & Biomes Core owns geological/ecological domain data; terrain, surface and oceans remain distinct Earth branches.
- Keep all seven Earth branches independently testable and replaceable.
- Prototype spherical geometry and local tile coordinates before regional detail/streaming.

**Exit gate:** Earth Core composes the seven branches using the shared domain cores; scale and module lifecycle are validated.

## Phase 5 — Integration and target-device validation

- Integrate all migrated cores into one UE5 game runtime.
- Validate asset rights, import scale, axes, materials and GLB/glTF interchange fidelity.
- Profile CPU, GPU, memory, thermal behavior and battery on the target Android device.
- Establish mobile rendering tiers before enabling expensive effects.
- Verify that no gameplay-critical runtime dependency remains on Three.js.

**Exit gate:** all core-level tests pass, the integrated UE5 build runs on the target device, and Three.js is no longer required at runtime.

## Non-goals for the first port

- Full Earth geophysics or climate simulation.
- Full ship interior art pass before modular geometry is stable.
- High-end desktop rendering features before Android profiling.
- Automatic conversion of JavaScript into Unreal C++/Blueprints.

## Current risks

1. UE5 editor and Android packaging requirements depend on the installed engine/toolchain.
2. Planet-scale spherical streaming needs a dedicated coordinate/tile design; World Partition alone does not solve a spherical planet.
3. High-end rendering features can exceed the target Android budget.
4. Asset scale, axes and materials must be validated before bulk import.
