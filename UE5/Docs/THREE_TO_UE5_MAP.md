# Existing Frontier Cores → Unreal Engine 5

This map follows the established core/branch ownership. It is not a new hierarchy and does not claim that a runnable UE5 project already exists.

See [CORE_SYSTEMS_MAP.md](CORE_SYSTEMS_MAP.md) for the full registry and branch inventory.

| Existing core / branch | UE5 implementation target | Ownership rule |
|---|---|---|
| Character Core | Character/Pawn + state component | Owns character state and on-foot/ship-control mode |
| Character model branch | Skeletal Mesh / Character Actor | Visual representation only |
| Character animation branch | Animation Blueprint | Consumes character state |
| Character HUD branch | UMG widgets | Observes state; never owns movement |
| Ship Core | Ship Actor + ship components | Owns ShipId, CommanderId and ship state |
| Exploration hull branch | Static/Skeletal Mesh components | Hull and flight hierarchy remain separate from interior |
| Interior/deck branch | Deck Actors / Level Instances | One independently editable module per deck |
| Bridge/computer/engines branches | Dedicated actors/components | Each system owns its own lifecycle |
| Camera/controls branches | PlayerController, Enhanced Input, camera components | Character input and pilot input are distinct modes |
| Earth Core | Earth Actor or World Subsystem | Coordinates seven Earth branches |
| Earth: interior/surface/terrain/oceans | Mesh/tile/material/terrain branches | Keep domain data separate from renderer |
| Earth: atmosphere/clouds/lighting | Sky Atmosphere, Volumetric Clouds, lights/material adapters | Visual effects do not own climate science |
| Planetary Core | Data Assets + planetary coordinate subsystem | Shared physical profile and scale contract |
| Atmosphere & Climate Core | Data Assets/subsystem + UE atmosphere adapters | Scientific state is independent of rendering |
| Geology & Biomes Core | Data Assets + terrain/PCG/tile adapters | Biome logic consumes climate, elevation and substrate data |

## Proposed content layout preserving core boundaries

```text
Content/Frontier/
  Core/
  Character/
    Core/
    Model/
    Animation/
    Camera/
    Input/
    HUD/
  Ships/
    Core/
    Exploration/
    Interior/
    Decks/
    Bridge/
    Computer/
    Engines/
    Camera/
    Controls/
  Worlds/
    Earth/
      Core/
      Interior/
      Surface/
      Terrain/
      Oceans/
      Atmosphere/
      Clouds/
      Lighting/
    Planetary/
      Core/
      Profiles/
      Coordinates/
    AtmosphereClimate/
      Core/
      Data/
      Rendering/
    GeologyBiomes/
      Core/
      Data/
      Terrain/
      Ecology/
  Shared/
    Materials/
    Meshes/
    Audio/
  Maps/
    Tests/
    Earth/
    Ships/
```

## UE5 building blocks

- C++ core classes/subsystems for stable domain logic and shared contracts.
- Actor Components for reusable behavior attached to actors.
- Blueprint Actors for visual/interactable modules such as doors, elevator modules, bridge stations and deck assemblies.
- Data Assets for planetary profiles, ship configuration and other stable data.
- UMG for HUD and menus.
- Enhanced Input for touch, gamepad and keyboard mappings.

Use components within an Actor where independent placement/lifecycle is unnecessary; use separate Actors/Level Instances where a module must be independently edited, loaded, collided or replaced. Epic documents Actors, Components, Data Assets and the Gameplay Framework as the native building blocks for this modular approach.

## Naming

- `A_` / `BP_`: Actor / Blueprint Actor.
- `U_`: UObject or subsystem classes.
- `WBP_`: UMG Widget.
- `DA_`: Data Asset.
- `MI_`: Material Instance.
- `M_`: Material.
- `SM_`: Static Mesh.
