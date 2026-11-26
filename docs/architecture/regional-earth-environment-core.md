# Regional Earth environment core — Jaú first

## Scope

Use the existing BT-01 transport destination as the center of the first local environment:

- Latitude: -22.2964°
- Longitude: -48.5570°
- Initial test footprint: 5 km radius around the transport point
- Target land-cover raster resolution: 10 m
- Local projected processing CRS: EPSG:32722 (WGS 84 / UTM zone 22S)

The 5 km radius is the first mobile-sized test area, not a global coverage decision.
Expand it only after performance and visual alignment are validated on the target device.

## Existing systems to preserve

- EarthCore owns the body-fixed surface frame and geographic coordinate conversion.
- terrain.js owns the shared elevation sampler used by visual terrain and collision.
- regionalSurface.js selects and builds cube-sphere terrain tiles.
- regionalElevation.js provides cached Terrarium DEM sampling.
- EarthTerrainReferenceCore supports georeferenced regional mesh references.
- The BT-01 remains at its current geodetic coordinate and current arrival placement.

No second Earth, elevation sampler, collision surface, or transport destination is introduced.

## Regional environment layers

Prepare and register the following local assets for this footprint:

1. Elevation: reuse the existing authoritative DEM sampler; add a locally clipped DEM only as a visual detail source, never as a competing collision sampler.
2. Land cover: ESA WorldCover 2021 v200 classification (10 m) for the initial regional dataset.
3. Water mask: derive from WorldCover class 80; keep water separate from dry terrain materials.
4. Albedo: derive a land-cover color texture from the classification palette.
5. Roughness: derive a grayscale PBR roughness texture by land-cover class; water receives lower roughness.
6. Normal / micro-relief: derive a tangent-space normal texture from the local DEM, retaining the DEM's real vertical scale.
7. Ambient occlusion: derive a subtle local-relief occlusion texture from the DEM; do not bake lighting or solar direction into it.
8. Vegetation and local props: distribute by land-cover class and slope, with deterministic placement and distance-based density/LOD.
9. Atmosphere: improve the existing atmospheric shader with view/solar-angle scattering; keep the single scene-owned solar light.
10. Fog and post-processing: distance haze and exposure/color grading must preserve horizon visibility and avoid mobile overdraw.

## Data preparation

Use ESA WorldCover's regional Cloud-Optimized GeoTIFF as the categorical source. Clip only the 5 km Jaú footprint and reproject to EPSG:32722 at 10 m for consistent metric processing.
Prepare albedo, roughness and water mask from the class raster. Derive normal and ambient-occlusion maps from the DEM, resampled to the same grid.
Write geospatial metadata (CRS, transform, bounds, pixel size, source, version, license and attribution) beside the generated textures.
Do not ship source GeoTIFFs or depend on an external data service at runtime; package only optimized local assets.

Official source and license: https://esa-worldcover.org/en/data-access
Required attribution: © ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium.

## Integration constraints

- Three.js owns regional textures, PBR blending, water appearance, vegetation, atmosphere and fog presentation.
- C++/WASM remains responsible for core simulation and physical calculations; do not move visual material work into it.
- Local material overlays must use the same geographic coordinate convention as the existing cube-sphere terrain tiles.
- Regional textures must fade/clip cleanly at the footprint boundary and leave the global Blue Marble fallback untouched outside it.
- Water visuals must not silently alter physical collision or elevation.
- Vegetation and props must be presentation-only unless a separate, explicitly tested collision feature is approved.
- Preserve the existing transport, spawn, collision, gravity, physical scale and Earth rotation behavior.

## Delivery order

1. Prepare and validate the local geospatial assets.
2. Integrate albedo, roughness and water mask into regional terrain tile materials.
3. Add DEM-derived normal and ambient-occlusion maps.
4. Add deterministic vegetation and nearby props with mobile LOD.
5. Refine Rayleigh/Mie atmosphere and distance fog/post-processing.
6. Validate the landing point, surrounding terrain, seams, performance and memory on Android.

## Current implementation state

The code contract defines the 5 km Jaú footprint and validates that a dataset covers the entire footprint. An offline preparation script now converts an ESA WorldCover GeoTIFF plus a DEM GeoTIFF into albedo, water-mask, roughness, normal and ambient-occlusion PNG assets with a metadata sidecar. The input rasters must still be acquired and processed, and the resulting assets are not yet wired into the Three.js runtime. No terrain appearance or physical behavior has been changed yet.