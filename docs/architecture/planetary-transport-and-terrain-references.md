# Planetary transport and terrain references

## Scope

This layer introduces two cooperating services without replacing the global Earth elevation model:

- `PlanetaryTransportCore` stores named, georeferenced destinations and moves a selected actor only after the world resolver returns a valid position. It is explicitly developer-test-only.
- `EarthTerrainReferenceCore` imports GLB/GLTF, OBJ and FBX meshes, validates their geometry and georeference, and attaches them to the Earth body-fixed frame at a sampled terrain location.

## Coordinate contract

Every imported reference requires latitude and longitude in degrees and elevation in metres. Model scale is expressed as metres per source-model unit. The Earth physical-scale adapter converts those dimensions to render units. The reference is aligned to the sampled terrain normal.

## Important limits

Imported meshes are regional overlays and test assets. They do not replace ETOPO/DEM, modify global elevation, generate continents, or automatically become landing sites. A later terrain-authoring pipeline can explicitly bake approved regional data into a terrain tile/DEM source. A destination is searchable only after it has been registered with the transport core.

## Safety and lifecycle

Transport is disabled when the developer tool is disabled, rejects unknown destinations and invalid altitudes, and does not alter flight dynamics. Imported objects are owned by the Earth reference core and disposed when removed or when the core shuts down.
