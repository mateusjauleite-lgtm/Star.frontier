# Earth modular visual system

The Earth core initializes seven independent renderers. Each renderer owns its
geometry, materials, textures, update behavior, and disposal lifecycle.
None imports or derives code from the former monolithic renderer in
`../earth.js`.

## Active preview modules

| Module | First implementation | Current scope |
| --- | --- | --- |
| `interior` | Independent translucent spherical boundaries | Crust, mantle, outer core, inner core; reference radii mapped to game scale |
| `surface` | Equirectangular canvas texture and independent sphere | Stylized global land/ocean layout |
| `terrain` | Deterministic procedural vertex relief | Relief prototype; not measured elevation data |
| `oceans` | Separate physical-material shell | Ocean sheen and water appearance prototype |
| `atmosphere` | Five altitude-defined atmospheric bands plus physical sampler | Layer visualization and altitude-based pressure, density, temperature, gravity sampling |
| `clouds` | Independent animated transparent texture | Procedural cloud coverage prototype |
| `lighting` | Independent directional and ambient lights | Sunlit side and night-side fill |

## Shared planetary science baseline

Earth now consumes the shared reference contract at
`src/world/planetary/planetaryScience.js` through
`references/index.js`. This contract is reusable by future real or fictional
planets and establishes consistency rules for:

- mass, radius, density, rotation, axial tilt, orbit, and surface gravity;
- internal structure, thermal state, and magnetic-field assumptions;
- tectonic plates, subduction, rifts, ridges, volcanism, and mineral distribution;
- atmospheric composition, pressure, density, temperature, and radiative balance;
- stellar insolation, winds, ocean currents, precipitation, and biomes;
- watersheds, rivers, sediment, hydraulic erosion, and thermal erosion;
- spherical continuity, floating origin, coordinate precision, and LOD.

The full research and validation guidance is in
`references/planetary-science.md`. These additions are reference metadata and
architecture guidance, not a claim that the current game already runs a
geophysics or climate simulation. Physical units must remain separate from
compressed visual scale.

## Unreal Engine 5 interoperability

The Earth core exposes a versioned, engine-neutral handoff contract at
`interop/ue5Contract.js`. It defines a proposed GLB/glTF 2.0 asset boundary,
explicit visual scale and coordinate verification, and the separation of
scientific values from renderer-specific units. This is not a UE5 runtime,
asset exporter, or completed migration. The active seven-layer Three.js Earth
is unchanged. See `interop/README.md` and
`references/three-to-unreal-migration.md` for compatibility limits and staged
migration gates.

## Physical Earth profile and render scale

`planetaryProfile.js` now defines a data-only Earth reference profile with
mean radius 6,371.0088 km, equatorial and polar reference radii, and standard
gravity. These scientific values are independent from the current Three.js
visual radius (300 render units by default). The profile exposes explicit
kilometre-to-render-unit conversion helpers; it does not rescale the existing
scene automatically.

The UE5 profile records 6,360 km as an Epic Sky Atmosphere documentation
example only. The final atmosphere ground radius must be matched to the
selected spherical mesh and visual scale. LWC is a precision aid, not a
substitute for local tile coordinates, camera-relative rendering, or device
profiling. The character HUD now displays the physical mean radius as compact
planetary context; it does not claim a live altitude, gravity, or climate
measurement.

## Planetary interior

The new interior module is independent from the surface and atmosphere
renderers. It adds translucent internal boundaries using mean Earth reference
radii: inner core 1,221 km, outer-core boundary 3,480 km, mantle boundary
6,346 km, and surface/crust reference 6,371 km. Those radii are converted
proportionally to the configured game radius. The crust boundary receives a
small visual thickness boost for readability.

This is an initial navigable visualization layer, not a geological cutaway,
terrain collision system, or subsurface simulation. It deliberately adds only
four low-complexity spherical meshes; detailed geology, temperature, pressure,
and material behavior can be layered later without coupling them to the
surface renderer.

## Atmospheric reference model

The atmospheric module defines five primary layers using NASA/NOAA
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
2. Enter the planet and verify that the interior boundaries render without
   hiding the atmosphere or disrupting the station camera.
3. Verify that the compact atmospheric envelope does not exceed mobile framing.
4. Check relief, ocean sheen, clouds, atmosphere, and day/night lighting.
5. Test frame rate, memory, and thermal behavior on the Galaxy A34.
6. Validate scientific parameters and reference provenance before replacing
   procedural preview assets with measured geographic imagery/elevation data.
7. Only after acceptance, remove superseded code.
