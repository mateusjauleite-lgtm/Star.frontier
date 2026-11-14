# Three.js → Unreal Engine 5: Earth migration assessment

## Executive assessment

A gradual Earth-only migration is technically possible, but there is no
drop-in conversion of the current Three.js runtime into an Unreal scene.
Three.js modules are JavaScript code using Three.js objects and lifecycle
methods. Unreal uses its own scene, material, asset, Blueprint, and C++
systems. The existing Earth science baseline and source datasets can be
reused; renderer implementations must be recreated or imported as assets.

The current project should therefore remain on Three.js while a separate UE5
Earth prototype is developed and measured. Do not migrate the whole game or
remove the current Earth renderer at this stage.

## What can move

| Current Earth content | Migration route | Expected portability |
| --- | --- | --- |
| Scientific parameters and units | Versioned JSON data contract | High |
| Reviewed surface maps and texture assets | Import textures into UE5 | High, subject to format and rights |
| Static spherical meshes and authored terrain meshes | GLB/glTF or FBX import | High, with scale/axis checks |
| Basic PBR material inputs | Rebuild/import using supported glTF material subset | Medium |
| Procedural terrain algorithms | Reimplement in UE5 tools, Blueprint, or C++ | Low; algorithm can guide, code is not drop-in |
| Atmosphere and cloud rendering | Rebuild with UE materials and rendering features | Low |
| Lighting and post-processing | Rebuild in UE5 | Low |
| Three.js update pipeline and scene graph | Reimplement with UE Actors/Components/Tick | None as executable code |

## Coordinate and scale rules

The current Earth core uses a configurable game radius (default 300) and a
Three.js position. That is a visual game scale, not the physical Earth radius.
The physical reference values must remain separate from render dimensions.
The UE5 handoff must explicitly record:

- physical mean radius in kilometres (current data profile: 6,371.0088 km);
- chosen UE world radius and scale factor, kept independent from physical values;
- UE5 Large World Coordinates for high-precision world transforms, while
  retaining local tile coordinates and camera-relative rendering for GPU work;
- altitude in kilometres and its visual mapping;
- object origin and export transform;
- axis/up-direction conversion and handedness verification;
- texture UV orientation and color-space settings.

Use GLB as the first interchange test because it packages geometry, material
inputs, and textures in one portable asset. Verify a round-trip before
batch-exporting the Earth. Do not assume that a successful import means
materials, orientation, scale, or lighting are visually identical.

## Rendering feature boundary

glTF 2.0 is a portable asset format, not a serialization of an entire game
engine. Basic meshes, textures, and a subset of PBR material data can cross
the boundary. UE-specific material graphs, Lumen lighting, Nanite geometry,
volumetric atmosphere, cloud effects, and post-processing must be rebuilt in
the engine that renders them.

If UE5 is the final Earth renderer, the Earth scene must run inside a UE5
application/runtime. It cannot simply be embedded as a native UE renderer
inside the existing Three.js canvas. Pixel Streaming is a separate option for
remote rendering: it runs the UE application on a PC/server and streams frames
and input to a browser/mobile client, adding server, GPU-encoding, network,
latency, and operating-cost dependencies. It is not the default recommendation
for this Android game.

## Android compatibility and target device

Unreal supports Android packaging, Vulkan, and OpenGL ES 3.2 on supported
hardware. This establishes platform support, not a guarantee that every UE5
rendering feature will run well on every phone.

The current Galaxy A34 target needs an actual device profile and on-device
benchmark. The Earth physical profile now records a mean radius of
6,371.0088 km separately from the existing 300-unit Three.js visual radius.
Epic's Sky Atmosphere documentation uses 6,360 km in one Earth-like example;
that is a renderer example, not the project's authoritative physical radius.
Match the UE atmosphere ground radius to the actual imported spherical mesh
before visual acceptance. Start with UE's mobile renderer and scalable settings. Do not make
Lumen or the Android desktop renderer a requirement: Epic documents mobile
Lumen as experimental and limited to high-end Android Vulkan SM5 profiles,
and warns of significant performance costs. A supported GPU family alone
does not guarantee a stable frame rate, thermal behavior, or memory budget.

## Proposed staged migration

1. **Contract first (completed in this branch):** expose the Earth UE5
   interoperability contract from the current Earth core without changing its
   rendering behavior.
2. **Asset round-trip:** test one sphere, one surface texture, and one simple
   PBR material through GLB; inspect scale, axes, UVs, and color space.
3. **UE5 Earth proof of concept:** create a separate mobile UE5 project with
   surface, ocean, atmosphere, clouds, and directional sunlight.
4. **Device profiling:** package and test on the Galaxy A34; record frame rate,
   memory, load time, temperature, and visual quality at scalable presets.
5. **Decision gate:** compare against the existing Three.js Earth. Migrate
   Earth only if the UE5 build meets visual goals and device budgets.
6. **Integration decision:** choose a standalone UE5 game runtime for Earth,
   a future whole-game migration, or an asset-authoring-only role. Avoid a
   hybrid dual-engine runtime until a concrete interaction requirement justifies
   its complexity.

## Current status

This assessment and the interoperability contract do not create an Unreal
project, produce a GLB, or claim that an import/export round-trip has passed.
Those tasks require the Unreal Editor and a real target build. The existing
Three.js Earth remains unchanged and is the active implementation.
