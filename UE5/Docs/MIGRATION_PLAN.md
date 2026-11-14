# Star Frontier — UE5 Migration Plan

## Goal

Create a parallel Unreal Engine 5 implementation while preserving the current Three.js game as the behavioral and visual reference. The migration is incremental, testable and reversible.

## Phase 0 — Baseline and contract

- [x] Create a dedicated migration branch from `feature/character-core`.
- [x] Preserve the current Three.js implementation.
- [x] Reuse the engine-neutral planetary profile and UE5 interchange contract.
- [ ] Inventory existing ship, character, Earth and HUD behavior from the current implementation.
- [ ] Confirm the installed UE5 version and target device/toolchain before generating engine project files.

## Phase 1 — UE5 project foundation

- Create a UE5 Games project with C++ support and Blueprint authoring.
- Start with a mobile renderer profile; do not assume desktop Lumen/Nanite settings are suitable for Android.
- Configure Android SDK/NDK, packaging and device deployment only after checking the local UE5 version requirements.
- Establish content folders and naming conventions before importing assets.
- Keep project configuration and platform-specific settings under source control.

**Exit gate:** empty project opens, builds and launches on the target device with a stable frame-time baseline.

## Phase 2 — Character vertical slice

Implement and validate:
- Third-person camera above and behind the character.
- 360-degree camera/aim control with separate movement and look input.
- Compact character HUD with movement, action and aim controls.
- Interaction target and world-context labels.
- Character HUD hidden while seated in the ship pilot seat.
- Input mapping separated from HUD presentation.

**Exit gate:** movement, camera, aim and HUD behave consistently in a small test room on the target device.

## Phase 3 — Modular ship

Proposed actor/component boundaries:
- `BP_ShipRoot`: ship identity, commander identity and shared systems.
- `BP_ShipHull`: exterior hull and collision shell.
- `BP_ShipDeck`: one actor/level instance per deck.
- `BP_ShipWallModule`: independent wall segments and openings.
- `BP_ShipDoor`: door animation and access state.
- `BP_ShipElevator`: elevator movement and deck routing.
- `BP_Hangar`: hangar volume, clearance and access boundaries.
- `BP_Bridge`: bridge stations and pilot interaction.
- `BP_PilotSeat`: enter/exit state, pilot camera and HUD switching.

Walls must not be baked into a single deck mesh where they block the hangar or elevator. Keep wall segments, doorways and collision independently selectable and testable. Use Level Instances or reusable Blueprint actors for repeated modules.

**Exit gate:** Deck 1 bridge and one additional deck load independently; hangar/elevator openings remain clear; collision and navigation paths are verified.

## Phase 4 — Earth prototype

- Import `Data/planetary-profile.json` as engine-neutral reference data.
- Keep physical radius in kilometres separate from visual render scale.
- Begin with a low-detail cube-sphere or equivalent spherical mesh and local coordinate frame.
- Add surface imagery and terrain only after the sphere, scale and camera precision are validated.
- Rebuild atmosphere, clouds and lighting with UE5-native rendering systems.
- Stream regional detail; do not load a full-resolution planet at once.

**Exit gate:** stable orbit/approach camera, consistent scale conversion and acceptable device memory/frame time.

## Phase 5 — Integration and migration

- Compare behavior against the Three.js baseline.
- Validate asset rights and GLB round-trip fidelity.
- Profile CPU, GPU, memory, thermal behavior and battery on the target Android device.
- Keep a fallback quality tier and a route back to the existing implementation.
- Only then decide whether UE5 becomes the primary runtime.

## Non-goals for the first prototype

- Full Earth geophysics or climate simulation.
- Full ship interior art pass.
- High-end desktop rendering features before mobile profiling.
- Automatic conversion of Three.js JavaScript into Unreal C++/Blueprints.

## Current known risks

1. UE5 editor and Android packaging requirements may exceed the available development machine/device workflow.
2. A global spherical world needs a planetary coordinate/streaming design; World Partition alone does not make a spherical planet.
3. High-end rendering features can exceed the Galaxy A34 budget.
4. Asset scale, axes and material conversion must be validated in a small test scene before bulk import.
