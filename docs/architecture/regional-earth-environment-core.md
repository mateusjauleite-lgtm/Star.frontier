# Regional Earth environment core — Jaú first

## Goal

Prepare a reusable contract for regional Earth environmental datasets, beginning
with the BT-01 reference point in Jaú, São Paulo, Brazil:

- Latitude: -22.2964°
- Longitude: -48.5570°

This is a regional-first implementation. It does not attempt to download,
process, render, or package global land-cover and material datasets.

## Existing systems to preserve

The current Earth runtime already provides important foundations:

- EarthCore owns the body-fixed surface frame and geographic coordinate conversion.
- terrain.js owns the shared elevation sampler used by visual terrain and collision.
- regionalSurface.js selects and builds cube-sphere terrain tiles.
- regionalElevation.js provides cached Terrarium DEM sampling.
- EarthTerrainReferenceCore supports georeferenced regional mesh references.

These systems remain authoritative. The regional environment contract must not
create a second Earth, a second elevation sampler, or a parallel collision surface.

## First implementation slice

src/world/earth/references/regionalEnvironment.js introduces:

- a Jaú regional profile anchored to the BT-01 coordinates;
- a finite list of supported environmental layer types;
- a geographic coverage check;
- validation of source, attribution, license metadata, resolution and coverage.

The descriptor is metadata only. It deliberately does not load data or change
runtime behavior. Dataset coverage must explicitly include the Jaú anchor before
the dataset can be accepted.

## Planned regional layers

1. Elevation (existing DEM pipeline; no replacement sampler).
2. Land cover / biome classification.
3. Water mask.
4. Albedo.
5. Roughness.
6. Normal / micro-relief.
7. Ambient occlusion.

Layer data should be prepared offline and consumed as regional assets. External
data providers are sources, not mandatory runtime dependencies. Before packaging
any source, verify attribution, license, native resolution, coordinate reference
system, no-data semantics and vertical datum.

## Out of scope for this slice

- No global dataset processing.
- No new terrain mesh or global Earth renderer.
- No material/shader changes.
- No changes to collision, gravity, physical scale, transporter flow, BT-01
  placement, or character spawn.
- No claim that Jaú land-cover assets have already been downloaded or integrated.

## Next stage

Choose and verify a bounded Jaú test footprint around BT-01, then acquire a
small land-cover sample (MapBiomas or ESA WorldCover) and convert it into a
documented, game-ready raster asset. Validate coordinate alignment against the
existing Earth frame before connecting it to Three.js materials.