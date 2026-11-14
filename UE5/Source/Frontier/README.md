# Frontier UE5 Source Layout

The source layout preserves the established Star Frontier Core → branches architecture. The full ownership and existing module mapping is maintained in [CORE_SYSTEMS_MAP.md](../../Docs/CORE_SYSTEMS_MAP.md).

## Planned source modules

```text
Source/Frontier/
  Core/                  Shared interfaces, events and lifecycle
  Character/
    Core/                Character state and mode contract
    Model/               Character visual integration
    Animation/           Animation state adapters
    Camera/              Third-person camera and 360 look
    Input/               Enhanced Input mappings
    HUD/                 UMG view models/widgets
  Ships/
    Core/                Ship identity, commander and shared state
    Exploration/          Hull and flight assembly
    Interior/             Interior composition
    Decks/                Deck modules and connection graph
    Bridge/               Bridge and pilot stations
    Computer/             Ship computer and subsystem interfaces
    Engines/              Engine subsystem
    Camera/               Ship camera
    Controls/             Pilot control mapping
  Worlds/
    Earth/Core/           Earth Core and seven branch adapters
    Planetary/Core/       Shared planetary profile and coordinates
    AtmosphereClimate/    Scientific atmosphere/climate domain
    GeologyBiomes/        Geological and ecological domain
  Interop/                GLB validation and engine-neutral data
```

## Dependency rules

- Character Core may enter Ship Core pilot mode; it does not own ship state.
- Ship Core owns ShipId and CommanderId; it does not own character identity.
- Earth Core composes its seven established branches and consumes shared domain cores.
- Planetary Core owns physical body/coordinate contracts, not visual meshes.
- Atmosphere & Climate and Geology & Biomes own domain data, not renderer-specific effects.
- HUD widgets display state; they do not own movement, ship simulation or world science.
- Use Actor Components for reusable behavior; use independent Actors/Level Instances where placement, loading, collision or replacement must be independent.
- Avoid per-frame Tick when event-driven updates or explicit update intervals are sufficient.

## Implementation status

This is the intended C++/Blueprint source boundary. No UE5 C++ classes or runnable project files are claimed to exist until generated and compiled with the selected Unreal Engine toolchain.
