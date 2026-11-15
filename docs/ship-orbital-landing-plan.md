# Ship Core, orbital navigation and planetary landing

This branch is a foundation, not a claim that the ship can already land.

## Six stages

1. **Audit and boundary:** current flight movement, nitro, model, Earth collision and four-deck interior are preserved. The existing playerShip.js and shipControls.js files are placeholders; flight movement currently lives in src/main.js.
2. **C++/WASM Ship Core:** an independent orbital kernel uses SI units. Three.js remains responsible for rendering, HUD, input and animation. The arcade speed value is not silently treated as SI velocity.
3. **Orbital calculations:** Earth gravity and a velocity-Verlet integration step use Earth's standard gravitational parameter. State conversion, orbital initial conditions, atmosphere and rotating reference frames remain to be integrated and validated.
4. **Predefined site:** a candidate near Salar de Uyuni (20.2° S, 67.5° W) is registered. It is not approved; ETOPO and finer local elevation, slope, roughness, hazards and approach corridor must be checked before placing a pad.
5. **Automatic landing:** guidance calculation and touchdown safety envelope are established. They do not yet move the live ship. Integration waits for normalized ship velocity, Earth/ship transforms and validated collision contact.
6. **Manual readiness:** both modes share a normalized flight-command contract. Manual input has priority and revokes autopilot authority.

## Coordinate and scale rules

- Orbital calculations use SI: metres, metres per second, seconds and m^3/s^2.
- Earth visual radius (600 Three.js units) is a render scale, not a physical radius.
- Never compare SI orbital state directly with the current arcade speed value.
- Geographic site coordinates must be transformed through Earth's live transform, including rotation.
- The landing pad must use the same elevation source as terrain collision.
- No changes to the four decks, character core, current flight controls or Earth PR are included here.

## Validation gates before live landing

- Compile the C++ kernel with the same Emscripten toolchain as Earth.
- Compare C++/WASM output with JavaScript fallback.
- Validate orbital integration error over bounded time steps and reject invalid states.
- Sample candidate ETOPO elevation and neighboring slopes; inspect finer local terrain before approval.
- Normalize ship position/velocity and Earth rotation/world-local transforms.
- Only then connect autopilot guidance to live ship controls and add the HUD landing action.
- Validate stable contact, gear clearance and collision against actual terrain before character disembarkation.
