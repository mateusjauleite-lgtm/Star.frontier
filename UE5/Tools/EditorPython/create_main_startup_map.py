"""Create or repair the Star Frontier UE5.8 startup map inside Unreal Editor.

Run this file from the UE Python console or execute it as an Editor Python script.
It creates the configured startup level, binds the native Main GameMode, and
ensures a safe PlayerStart plus basic sky lighting. The GameMode owns runtime
ship creation and D1 placement; this script does not spawn gameplay actors.
"""

import unreal

MAP_PATH = "/Game/StarFrontier/Maps/L_StarFrontier_Main"
GAME_MODE_PATH = "/Script/Frontier.FrontierGameMode"
PLAYER_START_LOCATION = unreal.Vector(0.0, 0.0, 5000.0)


def current_level_actors():
    # Always query again after spawning; do not reuse a stale actor snapshot.
    return unreal.EditorLevelLibrary.get_all_level_actors()


def find_actor(actor_class):
    return next(
        (actor for actor in current_level_actors() if isinstance(actor, actor_class)),
        None
    )


def spawn_if_missing(actor_class, location, rotation, label):
    actor = find_actor(actor_class)
    if actor:
        return actor

    actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
        actor_class, location, rotation
    )
    if not actor:
        raise RuntimeError("Could not create " + label + ".")
    actor.set_actor_label(label)
    return actor


unreal.EditorAssetLibrary.make_directory("/Game/StarFrontier/Maps")

if unreal.EditorAssetLibrary.does_asset_exist(MAP_PATH):
    world = unreal.EditorLevelLibrary.load_level(MAP_PATH)
    unreal.log_warning("Opened existing Star Frontier startup map.")
else:
    world = unreal.EditorLevelLibrary.new_level(MAP_PATH)

if not world:
    raise RuntimeError("Could not create or open startup map: " + MAP_PATH)

# Bind the map explicitly as well as keeping the project-wide default in INI.
game_mode_class = unreal.load_class(None, GAME_MODE_PATH)
if not game_mode_class:
    raise RuntimeError(
        "FrontierGameMode is unavailable. Compile the Frontier module first."
    )

world_settings = world.get_world_settings()
world_settings.set_editor_property("default_game_mode", game_mode_class)

# Keep PlayerStart clear of the exploration ship's large temporary collision proxy.
spawn_if_missing(
    unreal.PlayerStart,
    PLAYER_START_LOCATION,
    unreal.Rotator(0.0, 0.0, 0.0),
    "SF_PlayerStart_AboveShip"
)

sun = spawn_if_missing(
    unreal.DirectionalLight,
    unreal.Vector(0.0, 0.0, 0.0),
    unreal.Rotator(-25.0, 35.0, 0.0),
    "SF_Sun"
)
sun_component = sun.get_component_by_class(unreal.DirectionalLightComponent)
if sun_component:
    sun_component.set_editor_property("intensity", 2.0)
    sun_component.set_editor_property("atmosphere_sun_light", True)

sky = spawn_if_missing(
    unreal.SkyLight,
    unreal.Vector(0.0, 0.0, 0.0),
    unreal.Rotator(0.0, 0.0, 0.0),
    "SF_SkyLight"
)
sky_component = sky.get_component_by_class(unreal.SkyLightComponent)
if sky_component:
    sky_component.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
    sky_component.set_editor_property("real_time_capture", True)

spawn_if_missing(
    unreal.SkyAtmosphere,
    unreal.Vector(0.0, 0.0, 0.0),
    unreal.Rotator(0.0, 0.0, 0.0),
    "SF_SkyAtmosphere"
)
spawn_if_missing(
    unreal.ExponentialHeightFog,
    unreal.Vector(0.0, 0.0, 0.0),
    unreal.Rotator(0.0, 0.0, 0.0),
    "SF_ExponentialHeightFog"
)

unreal.EditorLevelLibrary.save_current_level()

# Confirm the saved level still contains the expected entry actors.
if not find_actor(unreal.PlayerStart):
    raise RuntimeError("Startup map validation failed: PlayerStart is missing.")
if not find_actor(unreal.DirectionalLight):
    raise RuntimeError("Startup map validation failed: DirectionalLight is missing.")
if not find_actor(unreal.SkyLight):
    raise RuntimeError("Startup map validation failed: SkyLight is missing.")

unreal.log("Star Frontier startup map saved: " + MAP_PATH)
unreal.log("WorldSettings GameMode: " + GAME_MODE_PATH)
unreal.log("Runtime order: map -> GameMode/ship -> PlayerController -> pawn possession -> D1 placement.")
