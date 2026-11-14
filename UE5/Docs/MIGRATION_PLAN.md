# Star Frontier — UE5 Migration Plan

## Goal

Migrate the existing Star Frontier cores and their branches into Unreal Engine 5 while preserving the Three.js implementation as the reference baseline. This is a parallel, incremental and reversible port—not a redesign of the game's architecture.

The authoritative ownership map is [CORE_SYSTEMS_MAP.md](CORE_SYSTEMS_MAP.md).

## Phase 0 — Core and branch alignment

- [x] Create a dedicated migration branch from `feature/character-core`.
- [x] Preserve the existing Three.js implementation.
- [x] Reuse the planetary profile and UE5 interchange contract.
- [x] Inventory Character Core, Ship Core, Earth Core and their existing branches.
- [x] Register Planetary Core, Atmosphere & Climate Core and Geology & Biomes Core as shared domain cores.
- [ ] Validate remaining system branches against the registry as they are migrated.

## Phase 1 — Planetary Core

- Port the engine-neutral planetary profile first.
- Preserve physical units independently from Unreal visual scale.
- Separate body identity, dimensions, gravity, rotation/orientation and coordinate rules.
- Make Earth one profile using the existing measured reference values; future planets receive their own profiles.
- Add a UE5 Data Asset or subsystem adapter only after the data contract is stable.

**Exit gate:** Earth profile loads in UE5 without changing its physical values; visual scale conversion is explicit and tested.

## Phase 2 — Character Core and branches

Existing branches: model, animation and HUD; core state is in `src/character/characterCore.js`.

Port:
- Character state/mode contract.
- Third-person camera above and behind the character.
- 360-degree look/aim, independent movement and look input.
- Compact HUD with movement, action, aim and interaction feedback.
- Hide the on-foot HUD while seated at a ship pilot station.

**Exit gate:** character behavior matches the existing core contract in a small UE5 test map.

## Phase 3 — Ship Core and branches

Preserve the existing ship branch ownership: exploration hull, interior/decks, bridge, computer, engines, camera, controls and player-ship association.

- Keep ShipId and CommanderId owned by Ship Core.
- Keep each deck independently loadable/editable.
- Keep walls, openings, doors, elevator and collision as independent modules.
- Deck 1 remains the command bridge; Deck 2 operations/science; Deck 3 engineering; Deck 4 hangar/support.
- Protect the Deck 4 hangar opening and Deck 2 elevator access from wall/collision overlap.
- Pilot-seat interaction changes Character Core mode and camera/HUD presentation without moving ship state into Character Core.

**Exit gate:** Deck 1 bridge and other decks load as separate modules; hangar and elevator circulation are unobstructed.

## Phase 4 — Earth Core and domain branches

Earth Core v1.6.0 remains the orchestrator of seven branches: interior, surface, terrain, oceans, atmosphere, clouds and lighting.

- Planetary Core supplies physical body data and coordinate rules.
- Atmosphere & Climate Core owns scientific atmosphere/climate data; Sky Atmosphere and cloud rendering are replaceable UE5 branches.
- Geology & Biomes Core owns geological/ecological domain data; terrain, surface and oceans remain distinct Earth branches.
- Keep the seven Earth branches independently testable and replaceable.
- Prototype spherical geometry and local tile coordinates before regional detail/streaming.

**Exit gate:** Earth Core composes the seven branches using the shared domain cores; scale and module lifecycle are validated.

## Phase 5 — Integration and target-device validation

- Compare each UE5 core against its Three.js baseline and behavior contract.
- Validate asset rights and GLB round-trip fidelity.
- Profile CPU, GPU, memory, thermal behavior and battery on the target Android device.
- Keep rendering quality tiers and the existing Three.js baseline until the UE5 build is proven.

**Exit gate:** core-level tests pass and the integrated build meets agreed target-device performance.

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
