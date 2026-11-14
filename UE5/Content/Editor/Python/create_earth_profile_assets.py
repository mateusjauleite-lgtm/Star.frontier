"""Create or update the two Earth scientific Data Assets in Unreal Editor.

Run in UE 5.8 after compiling/loading the Frontier module:
    Tools > Execute Python Script

This script reuses the existing UE5 C++ Data Asset classes and the existing
UE5/Data/planetary-profile.json reference. It is idempotent: it loads and
updates the canonical asset paths if they already exist, and creates only
the missing asset. It never creates alternate/duplicate asset names.

Atmospheric vertical bands are ported from
src/world/earth/modules/runtime/atmosphereModel.js. The UE5 subsystem currently
uses a layer-local exponential pressure approximation, so pressure scale
heights are fitted to each source layer's boundary pressures; this preserves
the existing UE5 model contract rather than copying the Three.js runtime.
"""
import json
import math
import os
import unreal


PROJECT_DIR = unreal.Paths.project_dir()
PLANETARY_REFERENCE = os.path.join(PROJECT_DIR, "Data", "planetary-profile.json")
DESTINATION = "/Game/StarFrontier/Worlds/Earth"
PLANETARY_ASSET_NAME = "DA_Earth_PlanetaryProfile"
ATMOSPHERE_ASSET_NAME = "DA_Earth_AtmosphereClimate"


def normalize_name(value):
    return "".join(character for character in str(value).upper() if character.isalnum())


def enum_value(enum_type_name, member_name):
    enum_type = getattr(unreal, enum_type_name, None)
    if enum_type is None:
        raise RuntimeError("Unreal enum is not reflected: " + enum_type_name)
    wanted = normalize_name(member_name)
    for candidate in dir(enum_type):
        if normalize_name(candidate) == wanted:
            return getattr(enum_type, candidate)
    raise RuntimeError("Enum member not found: " + enum_type_name + "." + member_name)


def make_struct(struct_type_name, values):
    struct_type = getattr(unreal, struct_type_name, None)
    if struct_type is None:
        raise RuntimeError("Unreal struct is not reflected: " + struct_type_name)
    value = struct_type()
    for property_name, property_value in values.items():
        value.set_editor_property(property_name, property_value)
    return value


def load_or_create_data_asset(asset_name, class_path):
    asset_path = DESTINATION + "/" + asset_name
    asset = unreal.EditorAssetLibrary.load_asset(asset_path)
    if asset:
        unreal.log("Reusing existing Earth Data Asset: " + asset_path)
        return asset

    asset_class = unreal.load_class(None, class_path)
    if not asset_class:
        raise RuntimeError(
            "Required Frontier class is unavailable: " + class_path
            + ". Compile the Frontier module and reopen the UE5.8 Editor."
        )

    factory = unreal.DataAssetFactory()
    factory.set_editor_property("data_asset_class", asset_class)
    asset = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        asset_name, DESTINATION, asset_class, factory
    )
    if not asset:
        raise RuntimeError("Could not create Data Asset: " + asset_path)
    unreal.log("Created missing Earth Data Asset: " + asset_path)
    return asset


def standard_atmosphere_reference_layers():
    # Direct port of BASES/LAPSE and barometric boundary calculations in
    # src/world/earth/modules/runtime/atmosphereModel.js.
    bases_m = [0.0, 11000.0, 20000.0, 32000.0, 47000.0, 51000.0, 71000.0, 84852.0]
    lapse_k_per_m = [-0.0065, 0.0, 0.001, 0.0028, 0.0, -0.0028, -0.002]
    gas_constant_air = 287.05287
    gravity = 9.80665
    temperature_k = 288.15
    pressure_pa = 101325.0
    layers = []

    for index, lapse in enumerate(lapse_k_per_m):
        base_m = bases_m[index]
        top_m = bases_m[index + 1]
        delta_m = top_m - base_m
        base_temperature = temperature_k
        base_pressure = pressure_pa

        if lapse == 0.0:
            next_pressure = pressure_pa * math.exp(
                -gravity * delta_m / (gas_constant_air * temperature_k)
            )
            next_temperature = temperature_k
        else:
            next_temperature = temperature_k + lapse * delta_m
            next_pressure = pressure_pa * math.pow(
                next_temperature / temperature_k,
                -gravity / (lapse * gas_constant_air)
            )

        delta_km = delta_m / 1000.0
        pressure_scale_height_km = (
            -delta_km / math.log(next_pressure / base_pressure)
            if next_pressure < base_pressure else 8.0
        )

        layers.append({
            "id": "standard_atmosphere_" + str(index + 1),
            "min": base_m / 1000.0,
            "max": top_m / 1000.0,
            "reference_altitude": base_m / 1000.0,
            "pressure": base_pressure,
            "temperature": base_temperature,
            # UE5's struct convention is positive = cooling with altitude.
            "ue5_lapse": -lapse * 1000.0,
            "scale_height": max(0.001, pressure_scale_height_km)
        })

        temperature_k = next_temperature
        pressure_pa = next_pressure

    anchor_altitude_km = 84.852
    anchor_pressure_pa = pressure_pa
    thermosphere_top_km = 600.0
    thermosphere_top_pressure_pa = anchor_pressure_pa * math.exp(
        -(thermosphere_top_km - anchor_altitude_km) / 55.0
    )
    thermosphere_top_temperature_k = 1000.0

    layers.append({
        "id": "thermosphere_upper",
        "min": anchor_altitude_km,
        "max": thermosphere_top_km,
        "reference_altitude": anchor_altitude_km,
        "pressure": anchor_pressure_pa,
        "temperature": 190.0,
        "ue5_lapse": -(1000.0 - 190.0) / (thermosphere_top_km - anchor_altitude_km),
        "scale_height": 55.0
    })
    layers.append({
        "id": "exosphere",
        "min": thermosphere_top_km,
        "max": 10000.0,
        "reference_altitude": thermosphere_top_km,
        "pressure": thermosphere_top_pressure_pa,
        "temperature": thermosphere_top_temperature_k,
        "ue5_lapse": 0.0,
        "scale_height": 500.0
    })
    return layers


def build_planetary_asset(reference):
    asset = load_or_create_data_asset(
        PLANETARY_ASSET_NAME,
        "/Script/Frontier.PlanetaryProfileDataAsset"
    )

    earth = reference["earth"]
    asset.set_editor_property("identity", make_struct("PlanetaryBodyIdentity", {
        "body_id": "earth",
        "display_name": unreal.Text("Terra"),
        "kind": enum_value("EPlanetaryBodyKind", "Terrestrial")
    }))
    asset.set_editor_property("dimensions", make_struct("PlanetaryDimensions", {
        "mean_radius_km": earth["meanRadiusKm"],
        "equatorial_radius_km": earth["equatorialRadiusKm"],
        "polar_radius_km": earth["polarRadiusKm"]
    }))
    asset.set_editor_property("gravity", make_struct("PlanetaryGravity", {
        "standard_surface_gravity_mps2": earth["standardGravityMps2"],
        "has_defined_surface": True
    }))
    asset.set_editor_property("rotation", make_struct("PlanetaryRotation", {
        "sidereal_rotation_period_seconds": earth["rotation"]["siderealRotationPeriodSeconds"],
        "axial_tilt_degrees": earth["rotation"]["axialTiltDegrees"],
        "direction": enum_value("EPlanetaryRotationDirection", earth["rotation"]["direction"])
    }))
    asset.set_editor_property("altitude", make_struct("PlanetaryAltitudeReference", {
        "reference_altitude_km": earth["altitudeReference"]["referenceAltitudeKm"],
        "reference_datum": earth["altitudeReference"]["referenceDatum"]
    }))
    asset.set_editor_property("coordinates", make_struct("PlanetaryCoordinateReference", {
        "convention": enum_value(
            "EPlanetaryCoordinateConvention", earth["coordinates"]["convention"]
        ),
        "body_fixed_frame": earth["coordinates"]["bodyFixedFrame"],
        "longitude_east_positive": earth["coordinates"]["longitudeEastPositive"]
    }))

    unreal.EditorAssetLibrary.save_loaded_asset(asset)
    if not asset.is_profile_valid():
        raise RuntimeError("Earth Planetary Profile failed IsProfileValid().")
    return asset


def build_atmosphere_asset(planetary_asset):
    asset = load_or_create_data_asset(
        ATMOSPHERE_ASSET_NAME,
        "/Script/Frontier.AtmosphereClimateProfileDataAsset"
    )

    gases = [
        make_struct("AtmosphericGasComponent", {
            "gas_id": "nitrogen",
            "volume_fraction": 0.78084,
            "molar_mass_kg_per_mol": 0.0280134
        }),
        make_struct("AtmosphericGasComponent", {
            "gas_id": "oxygen",
            "volume_fraction": 0.20946,
            "molar_mass_kg_per_mol": 0.0319988
        }),
        make_struct("AtmosphericGasComponent", {
            "gas_id": "argon",
            "volume_fraction": 0.00934,
            "molar_mass_kg_per_mol": 0.039948
        }),
        make_struct("AtmosphericGasComponent", {
            "gas_id": "carbon_dioxide",
            "volume_fraction": 0.00042,
            "molar_mass_kg_per_mol": 0.0440095
        })
    ]

    layers = []
    for source_layer in standard_atmosphere_reference_layers():
        layers.append(make_struct("AtmosphericLayerDefinition", {
            "layer_id": source_layer["id"],
            "min_altitude_km": source_layer["min"],
            "max_altitude_km": source_layer["max"],
            "reference_altitude_km": source_layer["reference_altitude"],
            "reference_pressure_pa": source_layer["pressure"],
            "reference_temperature_k": source_layer["temperature"],
            "temperature_lapse_rate_k_per_km": source_layer["ue5_lapse"],
            "pressure_scale_height_km": source_layer["scale_height"]
        }))

    asset.set_editor_property("planetary_profile", planetary_asset)
    asset.set_editor_property("composition", make_struct("AtmosphericComposition", {
        "components": gases
    }))
    asset.set_editor_property("layers", layers)
    asset.set_editor_property("climate_baseline", make_struct("AtmosphericClimateBaseline", {
        "mean_surface_temperature_k": 288.15,
        "relative_humidity": 0.5,
        "mean_wind_speed_mps": 0.0,
        "mean_precipitation_mm_per_day": 0.0
    }))

    unreal.EditorAssetLibrary.save_loaded_asset(asset)
    if not asset.is_profile_valid():
        raise RuntimeError("Earth Atmosphere & Climate Profile failed IsProfileValid().")
    if asset.get_editor_property("planetary_profile") != planetary_asset:
        raise RuntimeError("Atmosphere profile did not retain the canonical Earth Planetary Profile reference.")
    return asset


def link_profiles_to_open_earth_actors(planetary_asset, atmosphere_asset):
    # Link every AFrontierEarth instance in the currently open level. If no
    # Earth actor is present, the assets remain ready for manual assignment.
    editor_level_library = getattr(unreal, "EditorLevelLibrary", None)
    if editor_level_library is None:
        unreal.log_warning("EditorLevelLibrary is unavailable; assign the two profiles on AFrontierEarth manually.")
        return 0

    earth_class_path = "/Script/Frontier.FrontierEarth"
    earth_base_class = unreal.load_class(None, earth_class_path)
    if not earth_base_class:
        raise RuntimeError(
            "AFrontierEarth class is unavailable: " + earth_class_path
            + ". Compile the Frontier module and reopen the UE5.8 Editor."
        )

    linked_count = 0
    for actor in editor_level_library.get_all_level_actors():
        # IsA includes Blueprint subclasses derived from AFrontierEarth.
        if not actor.is_a(earth_base_class):
            continue
        actor.set_editor_property("planetary_profile", planetary_asset)
        actor.set_editor_property("atmosphere_profile", atmosphere_asset)
        actor.modify()
        actor.mark_package_dirty()
        linked_count += 1

    if linked_count:
        editor_level_library.save_current_level()
        unreal.log("Linked Earth profiles to " + str(linked_count) + " AFrontierEarth actor(s) in the open level.")
    else:
        unreal.log_warning(
            "No AFrontierEarth actor exists in the open level. Place one, then assign: "
            + DESTINATION + "/" + PLANETARY_ASSET_NAME + " and "
            + DESTINATION + "/" + ATMOSPHERE_ASSET_NAME
        )
    return linked_count


if not os.path.isfile(PLANETARY_REFERENCE):
    raise RuntimeError("Existing planetary reference JSON not found: " + PLANETARY_REFERENCE)

with open(PLANETARY_REFERENCE, "r") as reference_file:
    planetary_reference = json.load(reference_file)

if not unreal.EditorAssetLibrary.does_directory_exist(DESTINATION):
    unreal.EditorAssetLibrary.make_directory(DESTINATION)

earth_planetary_asset = build_planetary_asset(planetary_reference)
earth_atmosphere_asset = build_atmosphere_asset(earth_planetary_asset)
linked_earth_actor_count = link_profiles_to_open_earth_actors(
    earth_planetary_asset, earth_atmosphere_asset
)

unreal.log("Earth Data Assets ready (canonical paths, no duplicates):")
unreal.log(DESTINATION + "/" + PLANETARY_ASSET_NAME)
unreal.log(DESTINATION + "/" + ATMOSPHERE_ASSET_NAME)
unreal.log("Linked AFrontierEarth actors: " + str(linked_earth_actor_count))
