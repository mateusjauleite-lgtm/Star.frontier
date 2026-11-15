# Ship Core, orbital navigation and planetary landing

This branch is a foundation, not a claim that the ship can already land.

## Six stages

1. **Audit and boundary:** current flight movement, nitro, model, Earth collision and four-deck interior are preserved. The existing playerShip.js and shipControls.js files are placeholders; flight movement currently lives in src/main.js.
2. **C++/WASM Ship Core:** an independent orbital kernel uses SI units. Three.js remains responsible for rendering, HUD, input and animation. The arcade speed value is not silently treated as SI velocity.
3. **Orbital calculations:** Earth gravity and a velocity-Verlet integration step use Earth's standard gravitational parameter. State conversion, orbital initial conditions, atmosphere and rotating reference frames remain to be integrated and validated.
4. **Predefined site and base:** the project candidate is anchored to GPS survey point UY04 in Salar de Uyuni: WGS84 latitude -20.211888829°, longitude -67.422529683°, reference elevation 3697.2995 m. A compact base and landing platform are now positioned from the ETOPO collision surface at this anchor. This is a visual candidate, not a landing approval; local DEM, seasonal water/brine, crust, roughness, hazards and approach corridor still require validation.
5. **Automatic landing orientation:** calculateLandingOrientation builds a local tangent frame from the surface normal and true-north vector transformed into the same world frame. Heading 0° is true north. The base uses this same local tangent orientation; the calculation does not yet rotate or move the live ship.
6. **Automatic landing and manual readiness:** guidance, touchdown envelope and shared command contract are established. Live integration waits for normalized ship velocity, Earth/ship transforms, scale alignment and validated collision contact. Manual input must retain priority and revoke autopilot authority.

## Coordinate and scale rules

- Orbital calculations use SI: metres, metres per second, seconds and m^3/s^2.
- Earth visual radius (600 Three.js units) is a render scale, not a physical radius.
- Never compare SI orbital state directly with the current arcade speed value.
- Geographic site coordinates must be transformed through Earth's live transform, including rotation.
- The landing pad must use the same elevation source as terrain collision.
- The current ship mesh spans roughly 100 render units longitudinally, while the existing station landing deck is about 27.5 render units across. With the Earth radius set to 600 units, these proportions cannot be treated as real-world metres for a ground base. Establish a consistent local ship/base scale before placing the station mesh or final pad.
- The existing orbital station remains at scene position [24, 3, -65]. A separate compact planetary base is placed at the UY04 candidate by querying the same ETOPO collision sampler, transforming the returned surface point and normal into the Earth-local frame, and aligning its approach mark to the local true-north tangent.
- The new pad has a 63-unit radius (126-unit diameter) to accommodate the current ~100-unit ship hull, with one small technical habitat and perimeter lights. It is a visual placement, not proof of safe touchdown or terrain suitability.
- The exploration ship now has four landing legs with contact pads distributed under the hull. Their foot points are included in the existing five-point hull/terrain contact pass.
- The landing pad's upper deck is sampled as an additional surface inside the same contact pass as ETOPO; the higher valid surface is selected for each probe. This does not introduce a separate physics engine.
- Contact telemetry distinguishes upright, sideways, inverted and tilted attitudes relative to the platform normal, and counts how many of the four landing feet are touching. Contact alone is not touchdown completion: stable velocity and settling still need validation before the game may mark a landing complete.
- The pilot HUD now exposes a UY04 destination panel and can mark the candidate as the selected target. The button does not yet command the live ship; automatic movement remains blocked until ship/terrain scale, approach corridor, contact and manual-override behavior are validated.
- No changes to the four decks, character core, current flight controls or Earth PR are included here.

## Validation gates before live landing

- Compile the C++ kernel with the same Emscripten toolchain as Earth.
- Compare C++/WASM output with JavaScript fallback.
- Validate orbital integration error over bounded time steps and reject invalid states.
- Sample candidate ETOPO elevation and neighboring slopes; inspect finer local terrain before approval.
- Normalize ship position/velocity and Earth rotation/world-local transforms.
- Confirm the ship, landing gear, pad and station share a consistent local scale.
- Only then connect autopilot guidance to live ship controls. The HUD target-selection panel exists, but must not issue movement commands before these gates pass.
- Validate stable contact, gear clearance and collision against actual terrain before character disembarkation.
