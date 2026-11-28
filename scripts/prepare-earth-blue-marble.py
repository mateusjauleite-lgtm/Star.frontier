#!/usr/bin/env python3
"""Download and package NASA Blue Marble global and Jaú regional color assets."""
from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen

from PIL import Image

NASA_BASE = (
    "https://assets.science.nasa.gov/content/dam/science/esd/eo/images/"
    "bmng/bmng-topography-bathymetry/january/"
)
GLOBAL_SOURCE_URL = NASA_BASE + "world.topo.bathy.200401.3x21600x10800.jpg"
JAU_SOURCE_URL = NASA_BASE + "world.topo.bathy.200401.3x21600x21600.B2.jpg"

GLOBAL_OUTPUT = Path("public/earth/blue-marble-topography-bathymetry.jpg")
JAU_OUTPUT = Path("public/earth/jau-regional-500m.jpg")

# Bounded global texture for mobile GPU memory; local Jaú crop keeps native detail.
GLOBAL_SIZE = (6144, 3072)
JAU_SIZE = (1920, 1920)
JAU_BOUNDS = {
    "west": -52.557,
    "east": -44.557,
    "south": -26.2964,
    "north": -18.2964,
}
PIXELS_PER_DEGREE = 240  # 21600 px / 90 degrees in NASA's 500 m quadrant.


def download(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "StarFrontier-build/1.0"})
    with urlopen(request, timeout=120) as response:
        return response.read()


def output_has_size(path: Path, expected: tuple[int, int]) -> bool:
    if not path.is_file():
        return False
    try:
        with Image.open(path) as image:
            return image.size == expected
    except OSError:
        return False


def prepare_global() -> None:
    if output_has_size(GLOBAL_OUTPUT, GLOBAL_SIZE):
        print(f"Using cached {GLOBAL_OUTPUT} ({GLOBAL_SIZE[0]}x{GLOBAL_SIZE[1]}).")
        return
    source_bytes = download(GLOBAL_SOURCE_URL)
    with Image.open(BytesIO(source_bytes)) as source:
        if source.size != (21600, 10800):
            raise RuntimeError(f"Unexpected NASA 2 km global dimensions: {source.size}")
        image = source.convert("RGB")
        image.thumbnail(GLOBAL_SIZE, Image.Resampling.LANCZOS)
        if image.size != GLOBAL_SIZE:
            raise RuntimeError(f"Unexpected optimized global dimensions: {image.size}")
        GLOBAL_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        image.save(GLOBAL_OUTPUT, "JPEG", quality=88, optimize=True, progressive=True)
    print(
        f"Prepared {GLOBAL_OUTPUT} at {GLOBAL_SIZE[0]}x{GLOBAL_SIZE[1]} "
        f"from NASA's 21600x10800 global 2 km composite "
        f"({len(source_bytes)} source bytes)."
    )


def prepare_jau_region() -> None:
    if output_has_size(JAU_OUTPUT, JAU_SIZE):
        print(f"Using cached {JAU_OUTPUT} ({JAU_SIZE[0]}x{JAU_SIZE[1]}).")
        return
    source_bytes = download(JAU_SOURCE_URL)
    with Image.open(BytesIO(source_bytes)) as source:
        if source.size != (21600, 21600):
            raise RuntimeError(f"Unexpected NASA B2 quadrant dimensions: {source.size}")
        # B2 covers 90W..0 and 0N..90S. Jaú lies inside this quadrant.
        left = round((JAU_BOUNDS["west"] + 90) * PIXELS_PER_DEGREE)
        right = round((JAU_BOUNDS["east"] + 90) * PIXELS_PER_DEGREE)
        top = round((0 - JAU_BOUNDS["north"]) * PIXELS_PER_DEGREE)
        bottom = round((0 - JAU_BOUNDS["south"]) * PIXELS_PER_DEGREE)
        crop = source.crop((left, top, right, bottom)).convert("RGB")
        if crop.size != JAU_SIZE:
            raise RuntimeError(f"Unexpected Jaú crop dimensions: {crop.size}")
        JAU_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        crop.save(JAU_OUTPUT, "JPEG", quality=91, optimize=True, progressive=True)
    print(
        f"Prepared {JAU_OUTPUT} at native 500 m/pixel, "
        f"{JAU_SIZE[0]}x{JAU_SIZE[1]} covering "
        f"{JAU_BOUNDS['west']}..{JAU_BOUNDS['east']} longitude and "
        f"{JAU_BOUNDS['south']}..{JAU_BOUNDS['north']} latitude "
        f"({len(source_bytes)} source bytes)."
    )


def main() -> None:
    prepare_global()
    prepare_jau_region()


if __name__ == "__main__":
    main()
