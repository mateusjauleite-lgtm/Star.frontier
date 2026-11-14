"""Static preflight checks for the Earth profile migration.

Run from the repository root with:
    python UE5/Tests/validate_earth_profile.py

This does not require Unreal Engine and does not create or modify assets.
It validates the source profile and checks that the UE Editor builder still
references the canonical Data Asset paths and expected reflected properties.
It is not a substitute for running the builder in UE 5.8.
"""
import json
import math
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[2]
PROFILE_PATH = ROOT / "UE5" / "Data" / "planetary-profile.json"
BUILDER_PATH = (
    ROOT / "UE5" / "Content" / "Editor" / "Python"
    / "create_earth_profile_assets.py"
)

EXPECTED_ASSETS = (
    "DA_Earth_PlanetaryProfile",
    "DA_Earth_AtmosphereClimate",
)

REQUIRED_BUILDER_TOKENS = (
    "sidereal_rotation_period_seconds",
    "axial_tilt_degrees",
    "reference_altitude_km",
    "reference_datum",
    "coordinate_convention",
    "body_fixed_frame",
    "longitude_east_positive",
    "link_profiles_to_open_earth_actors",
    "FrontierEarth",
)


def check(condition, message):
    if not condition:
        raise AssertionError(message)
    print("[PASS] " + message)


def main():
    check(PROFILE_PATH.is_file(), "Earth planetary profile JSON exists")
    check(BUILDER_PATH.is_file(), "UE Editor Data Asset builder exists")

    profile = json.loads(PROFILE_PATH.read_text(encoding="utf-8"))
    earth = profile["earth"]
    rotation = earth["rotation"]
    altitude = earth["altitudeReference"]
    coordinates = earth["coordinates"]
    rendering = profile["rendering"]

    check(profile.get("schemaVersion") == "1.0.0", "profile schema version is 1.0.0")
    check(
        6370.0 < earth["meanRadiusKm"] < 6372.0,
        "mean Earth radius is in the expected physical range",
    )
    check(
        earth["polarRadiusKm"] < earth["meanRadiusKm"] < earth["equatorialRadiusKm"],
        "polar, mean, and equatorial radii are ordered correctly",
    )
    check(
        math.isclose(earth["standardGravityMps2"], 9.80665, rel_tol=0, abs_tol=1e-6),
        "standard gravity matches the reference value",
    )
    check(
        math.isclose(rotation["siderealRotationPeriodSeconds"], 86164.0905, abs_tol=1e-3),
        "sidereal rotation period is populated",
    )
    check(
        23.0 < rotation["axialTiltDegrees"] < 24.0
        and rotation["direction"] == "Prograde",
        "axial tilt and rotation direction are populated",
    )
    check(
        altitude["referenceAltitudeKm"] == 0
        and altitude["referenceDatum"] == "MeanSurface",
        "altitude reference uses mean surface datum",
    )
    check(
        coordinates["convention"] == "LatitudeLongitudeAltitude"
        and coordinates["bodyFixedFrame"] == "BodyFixed"
        and coordinates["longitudeEastPositive"] is True,
        "coordinate convention and body-fixed frame are explicit",
    )
    check(
        rendering["visualRadiusIsPhysical"] is False
        and rendering["conversionMustBeExplicit"] is True,
        "visual radius is kept separate from physical radius",
    )

    builder = BUILDER_PATH.read_text(encoding="utf-8")
    for asset_name in EXPECTED_ASSETS:
        check(asset_name in builder, "builder retains canonical asset name " + asset_name)
    for token in REQUIRED_BUILDER_TOKENS:
        check(token in builder, "builder includes " + token)

    print("\nStatic Earth profile preflight passed.")
    print("UE 5.8 asset generation and runtime linkage still require Unreal Editor.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (AssertionError, KeyError, OSError, json.JSONDecodeError) as error:
        print("[FAIL] " + str(error), file=sys.stderr)
        sys.exit(1)
