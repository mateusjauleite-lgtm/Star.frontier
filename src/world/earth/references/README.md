# Earth reference library

This folder is a research catalogue, separate from game assets.

## Non-negotiable boundary

References may challenge, improve, or inspire future ideas. They must never
silently replace the current implementation. The current Earth renderer remains
the stable baseline until a proposed change is reviewed, implemented, tested,
and intentionally integrated.

Workflow:

1. Record the source, exact item URL, access date, attribution, and license.
2. Describe the proposed improvement and which existing behavior it affects.
3. Compare it with the current baseline; keep both alternatives available.
4. Implement behind a separate module or controlled option where practical.
5. Test visual quality, performance, mobile compatibility, and gameplay.
6. Integrate only after review. Never auto-apply reference updates.

## Sources

- NASA Visible Earth: https://visibleearth.nasa.gov/
- NASA Earth Observatory: https://earthobservatory.nasa.gov/
- Google Earth: https://earth.google.com/

A provider homepage is not a license for every item hosted there. Verify the
license and attribution requirements of each individual asset before copying,
embedding, redistributing, or using it in a shipped build.

Google Earth imagery is catalogued for visual study only unless the applicable
Google terms explicitly permit the intended use.

## Current implementation

src/world/earth.js remains the existing renderer and visual baseline.
earthCore.js is the stable integration boundary and currently delegates to that
renderer without changing its appearance or behavior.
