# Earth modular visual system

The Earth core initializes six independent renderers. Each renderer owns its
geometry, materials, textures, update behavior, and disposal lifecycle.
None imports or derives code from the former monolithic renderer in
`../earth.js`.

## Active preview modules

| Module | First implementation | Current scope |
| --- | --- | --- |
| `surface` | Equirectangular canvas texture and independent sphere | Stylized global land/ocean layout |
| `terrain` | Deterministic procedural vertex relief | Relief prototype; not measured elevation data |
| `oceans` | Separate physical-material shell | Ocean sheen and water appearance prototype |
| `atmosphere` | Five altitude-defined atmospheric bands plus physical sampler | Layer visualization and altitude-based pressure, density, temperature, gravity sampling |
| `clouds` | Independent animated transparent texture | Procedural cloud coverage prototype |
| `lighting` | Independent directional and ambient lights | Sunlit side and night-side fill |

## Atmospheric reference model

The atmospheric module now defines five primary layers using NASA/NOAA
reference boundaries: troposphere 0–12 km, stratosphere 12–50 km,
mesosphere 50–85 km, thermosphere 85–600 km, and exosphere 600–10,000 km.
The ionosphere is an overlapping region and is not represented as a separate
stacked shell.

Physical altitude remains in kilometres. The renderer maps altitude
logarithmically to a compact visual envelope extending 160 game units beyond
the 300-unit Earth radius. This is deliberate visual compression: it does not
change the altitude values used by the simulation. The model exposes
`sampleEarthAtmosphere(altitudeKm)` with temperature, pressure, density,
layer identity, and inverse-square gravity factor. The lower atmosphere uses
layered standard-atmosphere equations; the upper thermosphere/exosphere
continues with an explicitly approximate exponential gameplay model and must
be refined before claiming high-altitude engineering accuracy.

References:
- NOAA JetStream, Layers of the Atmosphere:
  https://www.noaa.gov/jetstream/atmosphere/layers-of-atmosphere
- NASA Glenn, Earth Atmosphere Equation (Metric):
  https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/earth-atmosphere-equation-metric/
- NASA, Earth's Atmospheric Layers:
  https://www.nasa.gov/image-article/earths-atmospheric-layers-3/

## Surface and geographic references

The current surface map remains a stylized procedural placeholder and is not
accepted as the final NASA-style appearance. The next surface pass must replace
it with a reviewed, bundled NASA Blue Marble equirectangular texture; do not
use remote runtime loading. Terrain is currently procedural and must not be
presented as real-world elevation. Cloud placement is a visual prototype,
not observed weather. Coastlines and continent shapes are approximations
pending replacement with reviewed geographic datasets.

NASA/USGS elevation products can replace procedural relief after exact asset,
credit, resolution, and usage terms are reviewed. NASA Worldview is a research
reference, not a live runtime dependency. Google Earth remains a visual
comparison reference only unless the applicable terms permit intended reuse.

## Architecture and replacement rules

Every new visual element must be implemented as a complete independent module.
Do not inherit legacy geometry, materials, internal functions, or behavior.
A module owns construction, resources, update behavior, integration contract,
and disposal. Dependencies between new modules must remain explicit and minimal.

The old `../earth.js` file is retained temporarily as a comparison artifact
only. It is not imported by the active Earth core. Remove it after visual,
performance, and mobile tests confirm that the new system is accepted.

## Test sequence

1. Confirm Earth and all five atmospheric bands appear at the configured position.
2. Verify that the compact visual envelope does not obstruct the station or
   exceed the mobile camera framing.
3. Check the altitude sampler at layer boundaries and confirm continuous
   pressure/density behavior.
4. Check relief, ocean sheen, clouds, atmosphere, and day/night lighting.
5. Test frame rate, memory, and thermal behavior on the Galaxy A34.
6. Only after acceptance, replace procedural preview assets with reviewed
   geographic data and remove superseded code.
