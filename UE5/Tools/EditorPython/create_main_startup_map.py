"""Create the first Star Frontier startup map inside Unreal Editor.

Run from the UE Python console or execute as an Editor Python script.
The script creates a clean space test map, a PlayerStart and basic sky lighting.
The configured Main Core GameMode spawns the exploration ship and moves the
possessed character to deck D1 after the map starts.
"""

import unreal

MAP_PATH = "/Game/StarFrontier/Maps/L_StarFrontier_Main"

if unreal.EditorAssetLibrary.does_asset_exist(MAP_PATH):
    unreal.log_warning("Star Frontier startup map already exists; creating a fresh level at the same path.")

world = unreal.EditorLevelLibrary.new_level(MAP_PATH)
if not world:
    raise RuntimeError("Could not create Star Frontier startup map: " + MAP_PATH)

spawn = unreal.EditorLevelLibrary.spawn_actor_from_class(
    unreal.PlayerStart,
    unreal.Vector(0.0, 0.0, 250.0),
    unreal.Rotator(0.0, 0.0, 0.0)
)
if not spawn:
    raise RuntimeError("Could not place PlayerStart.")

sun = unreal.EditorLevelLibrary.spawn_actor_from_class(
    unreal.DirectionalLight,
    unreal.Vector(0.0, 0.0, 0.0),
    unreal.Rotator(-25.0, 35.0, 0.0)
)
if sun:
    light = sun.get_component_by_class(unreal.DirectionalLightComponent)
    if light:
        light.set_editor_property("intensity", 2.0)
        light.set_editor_property("atmosphere_sun_light", True)

sky = unreal.EditorLevelLibrary.spawn_actor_from_class(
    unreal.SkyLight,
    unreal.Vector(0.0, 0.0, 0.0),
    unreal.Rotator(0.0, 0.0, 0.0)
)
if sky:
    sky_component = sky.get_component_by_class(unreal.SkyLightComponent)
    if sky_component:
        sky_component.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
        sky_component.set_editor_property("real_time_capture", True)

atmosphere = unreal.EditorLevelLibrary.spawn_actor_from_class(
    unreal.SkyAtmosphere,
    unreal.Vector(0.0, 0.0, 0.0),
    unreal.Rotator(0.0, 0.0, 0.0)
)

fog = unreal.EditorLevelLibrary.spawn_actor_from_class(
    unreal.ExponentialHeightFog,
    unreal.Vector(0.0, 0.0, 0.0),
    unreal.Rotator(0.0, 0.0, 0.0)
)

unreal.EditorLevelLibrary.save_current_level()
unreal.log("Star Frontier Main startup map created: " + MAP_PATH)
unreal.log("Expected flow: Unreal splash -> startup map -> FrontierGameMode -> ship spawn -> player on D1.")
