# Planetary transport and terrain references

## Scope

This layer introduces two cooperating services without replacing the global Earth elevation model:

- `PlanetaryTransportCore` stores named, georeferenced destinations and moves a selected actor only after the world resolver returns a valid position. It is explicitly developer-test-only.
- `EarthTerrainReferenceCore` imports GLB/GLTF, OBJ and FBX meshes, validates their geometry and georeference, and attaches them to the Earth body-fixed frame at a sampled terrain location. Explicit `surfaceRole: 'terrain'` references can also provide regional raycast collision and override the global DEM sample locally; ordinary scene props remain non-collidable overlays.

## Coordinate contract

Every imported reference requires latitude and longitude in degrees and elevation in metres. Model scale is expressed as metres per source-model unit. The Earth physical-scale adapter converts those dimensions to render units. The reference is aligned to the sampled terrain normal.

## Important limits

Imported meshes remain regional references and do not replace ETOPO/DEM or modify global elevation. A reference declared with `surfaceRole: 'terrain'` is sampled as a local collision surface by raycasting the imported geometry; outside its coverage, queries fall back to the authoritative global DEM. These terrain references are automatically registered as transport destinations, so a player can be transferred directly to the region without a landing base or transporter installation there. Ordinary props default to `surfaceRole: 'overlay'`, remain visual-only, and do not become destinations. Seam blending and baking approved regional data into DEM tiles remain later terrain-authoring work.

## Safety and lifecycle

Transport is disabled when the developer tool is disabled, rejects unknown destinations and invalid altitudes, and does not alter flight dynamics. Imported objects are owned by the Earth reference core and disposed when removed or when the core shuts down.
