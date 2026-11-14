# Earth structural core

The Earth system is organized as a clean architecture for independently built
visual layers. The existing renderer is retained only as a comparison and
temporary recovery baseline; it is not a required foundation for new modules.

## New-layer rule

Every new visual element must be implemented as a complete, independent module.
Do not extend, inherit from, or reuse legacy element code when that would carry
old constraints, hidden coupling, geometry assumptions, materials, or behavior
into the new implementation.

A new module must own its complete implementation and lifecycle: construction,
resources, update behavior, integration contract, and disposal. Shared utilities
are allowed only when deliberately designed as neutral, documented services and
when they do not impose legacy behavior on the new layer.

## Replacement and retirement

1. Build the new element in its own module and branch of responsibility.
2. Integrate it through the Earth core using an explicit contract.
3. Validate visual completeness, dependencies, performance, and mobile behavior.
4. Compare it with the legacy baseline without making the new code depend on it.
5. Once the replacement is complete and verified, remove the corresponding
   legacy implementation and obsolete references in a deliberate cleanup.
6. Do not delete the current baseline prematurely; retain it only until the
   replacement has passed review and testing.

This is a clean replacement strategy, not a permanent parallel stack. Old code
must not remain as an active dependency merely for compatibility after its
replacement is accepted.

## Stable baseline and integration boundary

- `../earth.js` is the current visual baseline and temporary fallback only.
- `earthCore.js` is the scene-facing integration boundary.
- New modules must not import the legacy renderer or derive their implementation
  from its geometry, materials, or internal functions.

## Update domains

| Module | Responsibility |
| --- | --- |
| `surface` | Surface materials, continental meshes, coastlines |
| `terrain` | Elevation, displacement, mountain ranges |
| `oceans` | Ocean material, water detail, coastal transitions |
| `atmosphere` | Atmospheric layers, scattering, horizon glow |
| `clouds` | Cloud layers, shadows, movement |
| `lighting` | Day/night boundary, sun angle, night side |

Each module currently defines a contract and roadmap. The update pipeline hosts
future implementations only when explicitly attached. Reference catalogues
remain advisory and cannot automatically alter assets or runtime behavior.

## Integration rules

- Each element is new, self-contained, and independently replaceable.
- Dependencies between new modules must be explicit and minimal.
- No hidden dependency on legacy code is permitted.
- Remove superseded legacy code only after the replacement passes review and tests.
- Validate visual quality, performance, and mobile compatibility before activation.
