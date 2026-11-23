# NASA Blue Marble Next Generation — Topography and Bathymetry

The visual Earth surface uses NASA Earth Observatory's **Blue Marble: Next Generation — Base Map with Topography and Bathymetry**, January global composite.

- Source page: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/
- Packaged build asset: `public/earth/blue-marble-topography-bathymetry.jpg`
- Global source resolution: 5400 × 2700 pixels (8 km/pixel)
- Direct source: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/january/world.topo.bathy.200401.3x5400x2700.jpg

The Android build workflow downloads this image into the public asset directory before Vite builds the application. The game does not fetch the texture from NASA at runtime.

The image supplies visual color and bathymetric/topographic shading. It is not used as elevation data, collision data, or a substitute for ETOPO/DEM. Physical terrain remains owned by the existing Earth terrain runtime.
