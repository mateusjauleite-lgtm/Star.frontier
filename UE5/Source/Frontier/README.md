# Frontier UE5 Source Layout

The following is the planned module boundary. C++ classes and project build files will be introduced after the UE5 version and local build toolchain are confirmed.

```text
Source/Frontier/
  Core/          Game mode, shared interfaces, save/game state
  Character/     Character pawn, movement, camera, interaction
  UI/            HUD data model and widget coordination
  Ships/         Ship identity, decks, modules, doors, elevators
  Worlds/        Planet profile, planet coordinates, world streaming
  Interop/       GLB import validation and engine-neutral data
```

## Dependency rules

- Character code must not depend on a specific ship deck implementation.
- HUD widgets display state; they do not own movement or ship simulation.
- Ship modules communicate through narrow interfaces/events.
- Planet physical data is independent of mesh/rendering implementation.
- Rendering effects are replaceable and must not own scientific reference data.
