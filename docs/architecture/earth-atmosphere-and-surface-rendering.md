# Earth atmosphere and surface rendering

## Atmosphere: active implementation

The active Earth core is assembled by `src/world/earth/earthCore.js`. Its runtime factory map binds the `atmosphere` module to `src/world/earth/modules/runtime/blueMarbleAtmosphere.js`.

The active visual layer is a single thin Fresnel limb:
- a sphere at `1.018 × Earth visual radius`;
- a blue `ShaderMaterial` using the view-angle rim term `pow(1 - facing, 2.35)`;
- additive blending, transparent rendering, and depth writes disabled;
- registered as `layers.atmosphere` and reported as `blue-fresnel-atmosphere`.

This is a visual atmospheric rim, not a volumetric scattering simulation. It does not calculate weather, clouds, atmospheric light transport, or altitude-dependent color scattering.

## Physical atmosphere model

`src/world/earth/modules/runtime/atmosphereModel.js` remains the physical/gameplay data source. It defines the five named layers (troposphere through exosphere), converts physical altitude to a compressed visual extent, and samples temperature, pressure, density, layer identity, and inverse-square gravity factor. Physical altitude is in kilometres; visual compression does not alter the physical values.

## Legacy visual implementation (retained, not active)

`src/world/earth/modules/runtime/atmosphere.js` contains the earlier multi-shell renderer. It builds separate translucent shells for the five atmospheric layers using `EARTH_ATMOSPHERE_LAYERS` and `atmosphereAltitudeToVisualKm`.

That renderer is not selected by `earthCore.js`: the active runtime factory imports `createBlueMarbleAtmosphereRuntime`, not `createAtmosphereRuntime`. Keep the legacy file as a comparison/reference implementation until its consumers and desired future role are explicitly reviewed. Do not describe its five shells as the current visual result.

The module contract in `src/world/earth/modules/atmosphere.js` describes both visual and physical responsibilities. Its `implementation` points to the active Blue Marble runtime, while `physicalModel` points to `atmosphereModel.js`.

## Blue Marble surface and regional tile handoff

The global surface uses the NASA Blue Marble topography/bathymetry texture at `public/earth/blue-marble-topography-bathymetry.jpg` (runtime URL: `earth/blue-marble-topography-bathymetry.jpg`). The texture is loaded asynchronously and the surface status reports `loading`, `ready`, or `fallback`. A successful bundle/asset check proves packaging, not the appearance on a physical Android display.

Regional cube-sphere tiles clone the global surface material and synchronize its texture map after asynchronous loading. Their UV longitude convention must match Three.js `SphereGeometry`: longitude 0° maps to U=0.5, +90° to U=0.25, and -90° to U=0.75. The tile UV mapping is covered by a regression test so the Blue Marble image does not mirror when the renderer hands off from the global sphere to regional tiles.

The global sphere remains the distant fallback. Regional tiles are built asynchronously and installed as a complete generation before older tiles are retired. The regional DEM is activated during closer approach; cached Terrarium samples are also used by the shared collision sampler, with the global ETOPO grid as the synchronous fallback when no regional sample is cached.

## Known validation limits and remaining visual checks

Automated tests can verify UV mapping, tile selection bounds, elevation sampling, status transitions, and resource lifecycle. They cannot establish that the atmospheric rim, Blue Marble colors, horizon, or tile seams look correct on the Galaxy A34.

Device validation should inspect:
1. the globe from orbit after the texture status becomes `ready`;
2. the limb against black space, including day/night edges;
3. approach across the global-sphere to regional-tile activation altitude;
4. tile generation while moving the camera, including generation handoff;
5. low-altitude terrain texture alignment, elevation continuity, and collision agreement;
6. DEM unavailable/slow-load behavior, where the ETOPO-backed surface should remain visible.

Record any visible seam, mirrored texture, flicker, abrupt elevation step, or missing tile with the camera altitude and approximate latitude/longitude. Do not claim the visual result is confirmed until this device pass is completed.
