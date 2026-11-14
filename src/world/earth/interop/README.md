# Earth interoperability: Three.js ↔ Unreal Engine 5

The Earth system remains active in Three.js. The UE5 integration is currently
an **interoperability contract**, not a second renderer or an executable
Unreal project.

The contract lives in `ue5Contract.js` and is exposed by `createEarthCore()`
as `engineInterop`. It defines the proposed exchange boundary:

- glTF 2.0 / GLB for portable static geometry, textures, and basic PBR data;
- a versioned JSON sidecar for Earth parameters, layer identity, provenance,
  physical units, and the explicit visual scale;
- scientific values remain in SI units (with planetary altitudes in km);
- renderer-specific atmosphere, volumetric clouds, lighting, and post-process
  effects are rebuilt in the destination engine rather than assumed portable.

## Important distinction

A GLB round-trip can transfer a useful subset of content, but it does not
reproduce Unreal's complete rendering pipeline inside Three.js. Features such
as Lumen, Nanite, Unreal material graphs, volumetric atmosphere, and engine
post-processing are not portable as equivalent runtime features through GLB.
The UE5 Earth must be rendered by an Unreal runtime to retain UE-specific
visual features.

## Current implementation status

- No Unreal Engine source code, plugin, project file, or binary asset has been
  added to the Android/Vite project.
- No Three.js Earth module has been replaced or removed.
- No automatic GLB export is performed at runtime.
- The current Earth renderer remains the stable fallback and comparison build.
- The contract is advisory and does not alter the existing visual baseline.

## Next validation steps

1. Create a separate UE5 mobile project and a minimal Earth test scene.
2. Import a small GLB sample and verify orientation, scale, UVs, texture color
   space, and PBR material interpretation.
3. Rebuild atmosphere, cloud shading, and day/night lighting natively in UE5.
4. Package a standalone Android test and profile it on the target device.
5. Decide whether the UE5 Earth should be a separate Android experience, a
   future full-engine migration, or only a content-authoring tool.

Do not embed a UE5 desktop-renderer stream in the existing Android app as the
default production path. Pixel Streaming requires a separately running UE
application, encoding hardware, network services, and a stable connection.


## Physical planetary profile

The active Earth core also exposes `src/world/earth/planetaryProfile.js`. It
keeps the physical mean radius (6,371.0088 km) separate from the current
Three.js visual radius (300 units by default) and supplies explicit conversion
helpers. The profile is scientific metadata, not an Unreal runtime or a
geophysical simulation. The UE5 Sky Atmosphere value of 6,360 km is recorded
only as an Epic documentation example; match the atmosphere to the final mesh.
