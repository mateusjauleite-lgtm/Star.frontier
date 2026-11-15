#!/usr/bin/env python3
"""Build Star Frontier's compact ETOPO 2022 global grid.

Requires: Python 3, numpy, rasterio (GDAL).
Downloads NOAA's official 60-arc-second global Ice Surface GeoTIFF (about 444 MB),
then resamples it to a 0.25-degree node-registered Int16 grid (~2.1 MB).
"""
from pathlib import Path
import struct
import urllib.request

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.warp import reproject

SOURCE_URL = (
    "https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/data/60s/"
    "60s_surface_elev_gtif/ETOPO_2022_v1_60s_N90W180_surface.tif"
)
OUTPUT = Path("public/earth/data/etopo2022-global-0.25deg.bin")
SOURCE = Path(".cache/ETOPO_2022_v1_60s_N90W180_surface.tif")
WIDTH, HEIGHT = 1440, 720
WEST, EAST, SOUTH, NORTH = -179.875, 179.875, -89.875, 89.875
NODATA = -32768
HEADER_BYTES = 56
MAGIC = b"ETOPO22\0"


def download_source():
    expected_output_size = HEADER_BYTES + WIDTH * HEIGHT * 2
    if OUTPUT.exists() and OUTPUT.stat().st_size == expected_output_size:
        print(f"Using cached compact ETOPO grid: {OUTPUT}")
        return
    SOURCE.parent.mkdir(parents=True, exist_ok=True)
    if SOURCE.exists() and SOURCE.stat().st_size > 100_000_000:
        return
    temporary = SOURCE.with_suffix(".download")
    print(f"Downloading official NOAA ETOPO 2022 source: {SOURCE_URL}")
    urllib.request.urlretrieve(SOURCE_URL, temporary)
    if temporary.stat().st_size < 100_000_000:
        raise RuntimeError("NOAA download is incomplete or invalid")
    temporary.replace(SOURCE)


def build_grid():
    expected_output_size = HEADER_BYTES + WIDTH * HEIGHT * 2
    if OUTPUT.exists() and OUTPUT.stat().st_size == expected_output_size:
        print(f"Compact ETOPO grid is already prepared: {OUTPUT}")
        return
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    destination = np.full((HEIGHT, WIDTH), NODATA, dtype=np.int16)
    # ETOPO's global GeoTIFF is pixel-registered. The output stores sample
    # centers from -179.875..179.875 / 89.875..-89.875 at 0.25-degree spacing.
    target_transform = from_origin(-180.0, 90.0, 0.25, 0.25)
    with rasterio.open(SOURCE) as source:
        reproject(
            source=rasterio.band(source, 1),
            destination=destination,
            src_transform=source.transform,
            src_crs=source.crs,
            src_nodata=source.nodata,
            dst_transform=target_transform,
            dst_crs="EPSG:4326",
            dst_nodata=NODATA,
            resampling=Resampling.bilinear,
            init_dest_nodata=True,
        )

    header = struct.pack(
        "<8sII4dhHI",
        MAGIC, WIDTH, HEIGHT, WEST, EAST, SOUTH, NORTH,
        NODATA, 1, HEADER_BYTES
    )
    temporary = OUTPUT.with_suffix(".bin.tmp")
    with temporary.open("wb") as output:
        output.write(header)
        output.write(destination.astype("<i2", copy=False).tobytes(order="C"))
    temporary.replace(OUTPUT)
    print(f"Created {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")
    print("Source: NOAA NCEI ETOPO 2022, DOI 10.25921/fd45-gt74")
    print("Vertical datum preserved: EGM2008 geoid")


if __name__ == "__main__":
    download_source()
    build_grid()
