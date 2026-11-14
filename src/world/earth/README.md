# Earth modular visual system

The Earth core now initializes six independent renderers. Each renderer
owns its geometry, materials, textures, update behavior, and disposal lifecycle.
None imports or derives code from the former monolithic renderer in
`../earth.js`.

## Active preview modules

| Module | First implementation | Current scope |
| --- | --- | --- |
| `surface` | Equirectangular canvas texture and independent sphere | Stylized global land/ocean layout |
| `terrain` | Deterministic procedural vertex relief | Relief prototype; not measured elevation data |
| `oceans` | Separate physical-material shell | Ocean sheen and water appearance prototype |
| `atmosphere` | Independent additive rim shader | Atmospheric edge glow prototype |
| `clouds` | Independent animated transparent texture | Procedural cloud coverage prototype |
| `lighting` | Independent directional and ambient lights | Sunlit side and night-side fill |

The current surface map remains a stylized procedural placeholder and is not accepted as the final NASA-style appearance. The next surface pass must replace it with a reviewed, bundled NASA Blue Marble equirectangular texture; do not use remote runtime loading. The radius is calibrated to 300 game units while the Earth center remains at [0, 0, -850] and the station remains fixed. In particular, terrain is currently procedural and must not be presented
as real-world elevation. Cloud placement is a visual prototype, not observed
weather. Coastlines and continent shapes are approximations pending replacement
with reviewed geographic datasets.

## Reference-driven next upgrades

- NASA Blue Marble / Visible Earth: use reviewed global imagery for a higher
  fidelity surface texture. Record the exact asset, credit, resolution, and
  usage terms before adding it to the app.
- NASA/USGS elevation products: replace procedural relief with a real elevation
  source and a suitable level-of-detail strategy.
- NASA Worldview: compare cloud, sea-ice, and atmospheric layers as research
  references; do not make live network data a runtime dependency.
- Google Earth: visual comparison of terrain and coastlines only unless the
  applicable Google terms permit the intended reuse.

## Architecture and replacement rules

Every new visual element must be implemented as a complete independent module.
Do not inherit legacy geometry, materials, internal functions, or behavior.
A module owns construction, resources, update behavior, integration contract,
and disposal. Dependencies between new modules must remain explicit and minimal.

The old `../earth.js` file is retained temporarily as a comparison artifact
only. It is not imported by the active Earth core. Remove it after visual,
performance, and mobile tests confirm that the new system is accepted.

## Test sequence

1. Confirm Earth appears in the existing scene at the configured position.
2. Inspect continent orientation, poles, coastlines, and seam at the date line.
3. Check relief visibility without visible surface flicker or z-fighting.
4. Check ocean sheen, atmosphere edge, cloud motion, and day/night lighting.
5. Test frame rate, memory, and thermal behavior on the Galaxy A34.
6. Only after acceptance, replace procedural preview assets with reviewed
   geographic data and remove superseded code.
