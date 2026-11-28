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

The global surface uses NASA's January Blue Marble topography/bathymetry 2 km composite, packaged at `public/earth/blue-marble-topography-bathymetry.jpg` (runtime URL: `earth/blue-marble-topography-bathymetry.jpg`). It is resized to 6144x3072 to bound mobile GPU memory. The local Jaú region uses a native 500 m/pixel crop from NASA's B2 quadrant at `public/earth/jau-regional-500m.jpg`, covering longitude -52.557..-44.557 and latitude -26.2964..-18.2964. The 1920x1920 crop is built at CI time and cached; neither source image is committed to Git.

Both textures are loaded asynchronously with `SRGBColorSpace`. Global tiles retain the global material; regional tiles fully inside the Jaú crop use dedicated local UVs and the 500 m image. Tiles crossing the crop boundary remain on the global texture, avoiding stretched edge pixels. Surface status reports global and regional texture states separately. A successful bundle/asset check proves packaging, not the appearance on a physical Android display.

Regional cube-sphere tiles clone the global surface material and synchronize its texture map after asynchronous loading. Jaú tiles use a dedicated local UV set normalized against the crop bounds; the tile is assigned the local image only when every vertex is inside those bounds. The original global UV longitude convention remains unchanged: longitude 0° maps to U=0.5, +90° to U=0.25, and -90° to U=0.75. Regression tests cover both conventions and ensure global material synchronization cannot overwrite the local 500 m map.

The global sphere remains the distant fallback. Regional tiles are built asynchronously and installed as a complete generation before older tiles are retired. The regional DEM is activated during closer approach; cached Terrarium samples are also used by the shared collision sampler, with the global ETOPO grid as the synchronous fallback when no regional sample is cached.

## Known validation limits and remaining visual checks

Automated tests can verify global and local UV mapping, local-crop coverage, texture assignment through material synchronization, tile selection bounds, elevation sampling, status transitions, and resource lifecycle. The optional `layers.terrain.setTextureDebug(true)` diagnostic tints any active tile without a loaded color map red; `getStatus()` reports global-color, local-color, and untextured tile counts. They cannot establish that the atmospheric rim, Blue Marble colors, horizon, or tile seams look correct on the Galaxy A34.

Device validation should inspect:
1. the globe from orbit after the texture status becomes `ready`;
2. the limb against black space, including day/night edges;
3. approach across the global-sphere to regional-tile activation altitude;
4. tile generation while moving the camera, including generation handoff;
5. low-altitude terrain texture alignment, elevation continuity, and collision agreement;
6. DEM unavailable/slow-load behavior, where the ETOPO-backed surface should remain visible.

Record any visible seam, mirrored texture, flicker, abrupt elevation step, or missing tile with the camera altitude and approximate latitude/longitude. Do not claim the visual result is confirmed until this device pass is completed.
