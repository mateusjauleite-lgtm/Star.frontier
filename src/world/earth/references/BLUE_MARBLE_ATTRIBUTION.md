# NASA Blue Marble Next Generation — Topography and Bathymetry

The visual Earth surface uses NASA Earth Observatory's **Blue Marble: Next Generation — Base Map with Topography and Bathymetry**, January global composite.

- Source page: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/
- Packaged build asset: `public/earth/blue-marble-topography-bathymetry.jpg`
- Global source resolution: 5400 × 2700 pixels (8 km/pixel)
- Direct source: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/january/world.topo.bathy.200401.3x5400x2700.jpg

The Android build workflow downloads this image into the public asset directory before Vite builds the application. The game does not fetch the texture from NASA at runtime.

The image supplies visual color and bathymetric/topographic shading. It is not used as elevation data, collision data, or a substitute for ETOPO/DEM. Physical terrain remains owned by the existing Earth terrain runtime.


## Jaú regional color crop

The local ground-color texture is cropped at build time from NASA Blue Marble Next Generation — January topography and bathymetry, 500 m tiled product. Jaú lies in quadrant B2 (0°N to 90°S, 90°W to 0°). The packaged 1920x1920 crop covers -52.557° to -44.557° longitude and -26.2964° to -18.2964° latitude around the BT-01 Jaú coordinates. The source tile is downloaded during CI and is not committed to the repository.
