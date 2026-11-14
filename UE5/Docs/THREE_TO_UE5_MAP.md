# Three.js → Unreal Engine 5 System Map

This is an implementation map, not a claim that these systems have already been ported.

| Existing Frontier area | UE5 destination | Migration note |
|---|---|---|
| Character movement and camera | Character/Pawn + PlayerController + Spring Arm + Camera | Preserve the third-person and 360-degree control contract |
| Character HUD | UMG Widget + HUD/controller state | Keep UI state separate from movement and interaction logic |
| Ship root and identity | Ship Actor + components | Store ship ID and commander ID independently |
| Decks | Level Instances or modular Actors | One deck per independently editable unit |
| Walls and openings | Static Mesh Actors / Blueprint components | Walls must remain independently selectable |
| Doors and elevators | Blueprint Actors | State, animation, collision and access rules stay modular |
| Hangar | Dedicated Actor/Level Instance | Explicit clearance and opening volumes |
| Earth physical profile | Data Asset / JSON import | Keep physical units independent of visual scale |
| Earth spherical mesh | Procedural Mesh / custom planet mesh | Prototype cube-sphere tiles before global streaming |
| Terrain and biomes | Landscape for local terrain; PCG for distribution | Planet-scale terrain needs a spherical tile strategy |
| Atmosphere and clouds | Sky Atmosphere / Volumetric Clouds / materials | Rebuild rendering effects; do not expect direct shader portability |
| Lighting | Directional Light / Sky Light / UE5 environment | Tune for mobile renderer and target device |

## Proposed content layout

```text
Content/Frontier/
  Core/
  Character/
    Input/
    Camera/
    UI/
  Ships/
    Core/
    Hull/
    Decks/
    Modules/
    Interactables/
  Worlds/
    Earth/
      Data/
      Planet/
      Surface/
      Terrain/
      Atmosphere/
      Clouds/
  Shared/
    Materials/
    Meshes/
    Audio/
  Maps/
    Tests/
    Earth/
    Ships/
```

## Naming and ownership

- `BP_`: Blueprint Actor/Character/Controller.
- `WBP_`: UMG Widget.
- `DA_`: Data Asset.
- `MI_`: Material Instance.
- `M_`: Material.
- `SM_`: Static Mesh.
- Each system owns its own state; avoid putting ship walls, HUD state and character movement into one monolithic Blueprint.
