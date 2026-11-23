#!/usr/bin/env python3
"""Download and package NASA Blue Marble Next Generation natural-color base map."""
from pathlib import Path
from urllib.request import Request, urlopen
from io import BytesIO
from PIL import Image

SOURCE_URL = (
    "https://assets.science.nasa.gov/content/dam/science/esd/eo/images/"
    "bmng/bmng-base/january/"
    "world.200401.3x5400x2700.jpg"
)
OUTPUT = Path("public/earth/blue-marble-natural-color.jpg")
TARGET_SIZE = (4096, 2048)


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    request = Request(SOURCE_URL, headers={"User-Agent": "StarFrontier-build/1.0"})
    with urlopen(request, timeout=60) as response:
        source_bytes = response.read()
    with Image.open(BytesIO(source_bytes)) as source:
        if source.size != (5400, 2700):
            raise RuntimeError(f"Unexpected NASA texture dimensions: {source.size}")
        image = source.convert("RGB")
        image.thumbnail(TARGET_SIZE, Image.Resampling.LANCZOS)
        if image.size != TARGET_SIZE:
            raise RuntimeError(f"Unexpected optimized texture dimensions: {image.size}")
        image.save(OUTPUT, "JPEG", quality=90, optimize=True, progressive=True)
    print(f"Prepared {OUTPUT} at {TARGET_SIZE[0]}x{TARGET_SIZE[1]} "
          f"from NASA Blue Marble natural-color base map ({len(source_bytes)} source bytes).")


if __name__ == "__main__":
    main()
