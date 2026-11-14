# Earth structural core

The Earth system is split into a stable baseline and optional update modules.

## Stable baseline

- `../earth.js` remains the current visual renderer.
- `earthCore.js` is the single integration boundary used by the scene.
- The core delegates its frame update and disposal to the current renderer.

## Update domains

| Module | Responsibility |
| --- | --- |
| `surface` | Surface materials, continental meshes, coastlines |
| `terrain` | Elevation, displacement, mountain ranges |
| `oceans` | Ocean material, water detail, coastal transitions |
| `atmosphere` | Atmospheric layers, scattering, horizon glow |
| `clouds` | Cloud layers, shadows, movement |
| `lighting` | Day/night boundary, sun angle, night side |

Each module file currently defines a contract and a roadmap only. The update
pipeline can host a reviewed runtime implementation later, but none is attached
or activated by this structural update. This avoids changing the current Earth
appearance or adding new rendering cost.

## Integration rules

1. Keep the current renderer as the fallback baseline.
2. Implement each domain independently behind its own module contract.
3. Check declared dependencies before attaching a runtime module.
4. Compare against the baseline and test on mobile before activation.
5. Keep reference data advisory; never turn a reference entry into an asset
   or runtime change automatically.
