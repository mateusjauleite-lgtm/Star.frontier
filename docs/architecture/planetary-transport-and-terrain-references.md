# Planetary transport and Earth terrain

## Destination selection

The AURORA OS transporter does not expose manual coordinate entry or mesh import to the player. The pilot selects **Mark destination**, then clicks a visible point on the rendered Earth surface. The Earth body-fixed frame converts that surface hit into latitude and longitude using the same axis convention used by the global elevation sampler.

The Ship Computer validates the selected location against the shared Earth surface resolver and registers it as a named destination. The player confirms the destination, walks to the ship's transporter platform, and activates the transfer. No destination-side base or transporter installation is required.

## Runtime architecture

- `PlanetaryTransportCore` stores named, georeferenced destinations and moves the selected actor only after the Earth surface resolver returns a valid position.
- `EarthCore` owns the rotating terrestrial reference frame, rendered surface and geographic coordinate conversion.
- `EarthTerrainReferenceCore` remains an internal terrain-authoring/runtime service; its file-import controls are not exposed in AURORA OS.
- `Ship Computer` authorizes destination registration and transfer commands.
- The transporter checks the EPS operations bus and consumes the configured energy cost before moving the character.

## Coordinate and terrain contract

A map pick is converted from the world-space raycast hit into the Earth body-fixed frame. Latitude and longitude are derived from the normalized local surface direction, following the exact convention used by the global terrain elevation sampler. Elevation is sampled by the shared Earth collision surface at resolution time; the player does not enter altitude or coordinates.

The global DEM remains authoritative. Regional terrain references can still be used internally by the terrain core, with global DEM fallback outside their coverage. They are not required for ordinary destination selection.

## Transfer flow

1. Open the physical AURORA OS terminal on Deck 2.
2. Select **Mark destination on Earth** and click a point on the visible 3D globe.
3. Review and confirm the automatically named destination.
4. Stand on the ship's transporter platform and activate the transfer.
5. Ship Computer validates the destination and EPS availability, resolves the terrain height, and transfers the character to a safe offset above the surface.

Transport remains a character transfer from ship to Earth. It does not modify ship flight dynamics or orbital state.
