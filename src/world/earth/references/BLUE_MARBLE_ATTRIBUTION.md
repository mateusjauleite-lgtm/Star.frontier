# NASA Blue Marble Next Generation — Natural-Color Base Map

The visual Earth surface uses NASA Earth Observatory's **Blue Marble: Next Generation — Base Map**, January global composite. This is the base-map variant, not the separate products with topographic or bathymetric shading.

- Source page: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/
- Packaged build asset: `public/earth/blue-marble-natural-color.jpg`
- Global source resolution: 5400 × 2700 pixels (8 km/pixel)
- Direct source: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/january/world.200401.3x5400x2700.jpg

The Android build workflow downloads this image into the public asset directory before Vite builds the application. The game does not fetch the texture from NASA at runtime.

The texture supplies natural-color surface albedo only. Terrain shape, elevation and collision remain owned by the Earth terrain runtime and its ETOPO/regional DEM sources. The default vertical exaggeration is 1× (physical scale); deliberate exaggeration remains available through `terrainVerticalExaggeration`.
