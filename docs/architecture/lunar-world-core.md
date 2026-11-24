# Lunar world core

The Moon is a physical celestial body, not an Earth-attached visual prop.

## Ownership and frames

- `SolarSystemDynamics` owns the Moon's SI position, velocity, mass and rotation state.
- `MoonCore` owns the Moon body-fixed frame, physical profile, terrain runtime and collision sampling.
- The Moon's scene transform is derived from the N-body snapshot relative to Earth's current world transform.
- Grounded actors must be attached to the Moon body-fixed frame; changing frames must preserve world pose and inertial velocity.

## Physics contract

- SI units are authoritative: metres, seconds, kilograms and m/s.
- Lunar gravity uses `mu = 4.9048695e12 m³/s²` and inverse-square falloff from the Moon centre.
- Earth gravity remains active during the transfer and near the Moon. The combined acceleration is the vector sum of all registered celestial gravity sources.
- Surface rotation velocity is `omega × r`; a landed object inherits the Moon's inertial surface velocity when leaving the body-fixed frame.

## Terrain contract

The initial runtime provides a deterministic cratered relief field. The same elevation function displaces the rendered mesh and answers collision queries. This is an explicit procedural baseline, not a claim that a measured LOLA DEM has been installed. The surface runtime is designed so a real lunar DEM can replace the sampler without changing the frame or collision API.

## Current scope

This change establishes the Moon's astronomical scene placement, independent profile and gravity contribution, body-fixed frame, procedural cratered surface and collision query API. Full ship landing/departure state transitions and on-foot traversal still require a subsequent integration pass through the existing landing and character physics controllers.
