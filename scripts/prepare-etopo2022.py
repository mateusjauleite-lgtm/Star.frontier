#!/usr/bin/env python3
"""Build the compact Star Frontier ETOPO 2022 global grid.

The NOAA ERDDAP request samples the official 60-arc-second global grid every
15 cells, producing the exact 0.25-degree node grid used by the runtime.
Only the compact NetCDF response is downloaded; no full-resolution source
raster is needed.
"""
from pathlib import Path
import shutil
import struct
import urllib.parse
import urllib.request

import numpy as np
from netCDF4 import Dataset

ERDDAP_BASE = (
    "https://oceanwatch.pifsc.noaa.gov/erddap/griddap/"
    "ETOPO_2022_v1_60s.nc"
)
# ETOPO 60s axes are 1 arc-minute. Index 7 is the first 0.25-degree
# cell center; stepping by 15 yields 720 x 1440 values worldwide.
QUERY = "z[(-89.875):15:(89.875)][(0.125):15:(359.875)]"
OUTPUT = Path("public/earth/data/etopo2022-global-0.25deg.bin")
SOURCE = Path(".cache/etopo2022-global-0.25deg.nc")
WIDTH, HEIGHT = 1440, 720
WEST, EAST, SOUTH, NORTH = -179.875, 179.875, -89.875, 89.875
NODATA = -32768
HEADER_BYTES = 56


def download_compact_source():
    expected_output_size = HEADER_BYTES + WIDTH * HEIGHT * 2
    if OUTPUT.exists() and OUTPUT.stat().st_size == expected_output_size:
        print(f"Using prepared compact ETOPO grid: {OUTPUT}")
        return

    SOURCE.parent.mkdir(parents=True, exist_ok=True)
    if SOURCE.exists() and SOURCE.stat().st_size > 1_000_000:
        return

    encoded_query = urllib.parse.quote(QUERY, safe="[]():,")
    url = f"{ERDDAP_BASE}?{encoded_query}"
    temporary = SOURCE.with_suffix(".nc.download")
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "StarFrontier-ETOPO2022/1.0"}
    )
    print("Requesting the compact 0.25-degree NOAA ETOPO 2022 grid from ERDDAP")
    with urllib.request.urlopen(request, timeout=180) as response:
        with temporary.open("wb") as destination:
            shutil.copyfileobj(response, destination)

    if temporary.stat().st_size < 1_000_000:
        temporary.unlink(missing_ok=True)
        raise RuntimeError("NOAA ERDDAP returned an incomplete ETOPO subset")
    temporary.replace(SOURCE)


def build_grid():
    expected_output_size = HEADER_BYTES + WIDTH * HEIGHT * 2
    if OUTPUT.exists() and OUTPUT.stat().st_size == expected_output_size:
        print(f"Compact ETOPO grid is already prepared: {OUTPUT}")
        return

    download_compact_source()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    with Dataset(SOURCE, "r") as dataset:
        for name in ("latitude", "longitude", "z"):
            if name not in dataset.variables:
                raise RuntimeError(f"NOAA ETOPO subset is missing variable: {name}")

        latitudes = np.asarray(dataset.variables["latitude"][:], dtype=np.float64)
        longitudes = np.asarray(dataset.variables["longitude"][:], dtype=np.float64)
        raw = np.ma.asarray(dataset.variables["z"][:])

        if raw.shape != (HEIGHT, WIDTH):
            raise RuntimeError(f"Unexpected ETOPO array shape: {raw.shape}")
        if not np.allclose(latitudes, np.linspace(SOUTH, NORTH, HEIGHT), atol=1e-5):
            raise RuntimeError("ETOPO latitude coordinates do not match the 0.25-degree grid")
        if not np.allclose(longitudes, np.linspace(0.125, 359.875, WIDTH), atol=1e-5):
            raise RuntimeError("ETOPO longitude coordinates do not match the expected 0..360 grid")

        values = np.asarray(raw.filled(np.nan), dtype=np.float32)

    invalid = ~np.isfinite(values) | (values <= NODATA) | (values > 32767)
    values[invalid] = NODATA
    values = np.rint(values).astype(np.int16)

    # Convert ascending latitude to north-to-south rows and rotate 0..360
    # longitude into the runtime's -180..180 west-to-east convention.
    values = values[::-1, :]
    values = np.concatenate((values[:, WIDTH // 2:], values[:, :WIDTH // 2]), axis=1)

    if values.shape != (HEIGHT, WIDTH):
        raise RuntimeError("ETOPO grid dimensions changed during coordinate normalization")
    if np.count_nonzero(values != NODATA) < int(WIDTH * HEIGHT * 0.95):
        raise RuntimeError("ETOPO subset contains too many no-data cells")

    header = struct.pack(
        "<8sII4dhHI",
        b"ETOPO22\0", WIDTH, HEIGHT, WEST, EAST, SOUTH, NORTH,
        NODATA, 1, HEADER_BYTES
    )
    temporary = OUTPUT.with_suffix(".bin.tmp")
    with temporary.open("wb") as destination:
        destination.write(header)
        destination.write(values.astype("<i2", copy=False).tobytes(order="C"))
    temporary.replace(OUTPUT)

    if OUTPUT.stat().st_size != expected_output_size:
        raise RuntimeError("Generated ETOPO binary has an unexpected file size")

    print(f"Created {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")
    print("Source: NOAA NCEI ETOPO 2022, DOI 10.25921/fd45-gt74")
    print("Source resolution: 60 arc-seconds; packaged spacing: 0.25 degrees")
    print("Vertical reference: EGM2008 geoid")


if __name__ == "__main__":
    build_grid()
