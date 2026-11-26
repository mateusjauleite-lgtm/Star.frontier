#!/usr/bin/env python3
"""Prepare a compact, georeferenced Jaú environmental texture set from GeoTIFFs.

Requires: rasterio, numpy, Pillow, scipy.
Inputs: ESA WorldCover categorical GeoTIFF (class codes) and a DEM GeoTIFF.
Outputs: 1000x1000 (by default) albedo, water, roughness, normal and AO PNGs,
plus metadata.json. This is an offline preparation tool; it is not a game runtime.
"""
import argparse
import json
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.transform import from_bounds
from rasterio.warp import Resampling, reproject, transform
from scipy.ndimage import gaussian_filter

LATITUDE = -22.2964
LONGITUDE = -48.5570
CLASS_COLORS = {
    10: (0, 100, 0), 20: (255, 187, 34), 30: (255, 255, 76),
    40: (240, 150, 255), 50: (250, 0, 0), 60: (180, 180, 180),
    70: (240, 240, 240), 80: (0, 100, 200), 90: (0, 150, 160),
    95: (0, 207, 117), 100: (250, 230, 160)
}
CLASS_ROUGHNESS = {10: 150, 20: 160, 30: 175, 40: 170, 50: 90,
                   60: 205, 70: 185, 80: 22, 90: 65, 95: 55, 100: 185}

def write_png(path, array, mode):
    Image.fromarray(array, mode=mode).save(path, optimize=True)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--land-cover', required=True, type=Path)
    parser.add_argument('--dem', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--radius-km', type=float, default=5.0)
    parser.add_argument('--resolution-m', type=float, default=10.0)
    args = parser.parse_args()
    if args.radius_km <= 0 or args.radius_km > 50 or args.resolution_m <= 0:
        parser.error('radius-km deve estar entre 0 e 50; resolution-m deve ser positiva')

    target_crs = 'EPSG:32722'  # WGS 84 / UTM zone 22S; Jaú
    center_x, center_y = transform('EPSG:4326', target_crs, [LONGITUDE], [LATITUDE])
    half = args.radius_km * 1000.0
    left, bottom, right, top = center_x[0] - half, center_y[0] - half, center_x[0] + half, center_y[0] + half
    width = height = int(round((2 * half) / args.resolution_m))
    affine = from_bounds(left, bottom, right, top, width, height)
    shape = (height, width)
    args.output.mkdir(parents=True, exist_ok=True)

    classes = np.zeros(shape, dtype=np.uint8)
    with rasterio.open(args.land_cover) as source:
        reproject(source=rasterio.band(source, 1), destination=classes,
                  src_transform=source.transform, src_crs=source.crs, src_nodata=source.nodata,
                  dst_transform=affine, dst_crs=target_crs, dst_nodata=0,
                  resampling=Resampling.nearest)

    dem = np.full(shape, np.nan, dtype=np.float32)
    with rasterio.open(args.dem) as source:
        reproject(source=rasterio.band(source, 1), destination=dem,
                  src_transform=source.transform, src_crs=source.crs, src_nodata=source.nodata,
                  dst_transform=affine, dst_crs=target_crs, dst_nodata=np.nan,
                  resampling=Resampling.bilinear)
    valid_dem = np.isfinite(dem)
    if not valid_dem.any():
        raise RuntimeError('O DEM não cobre a área de teste de Jaú.')
    if not valid_dem.all():
        fill = float(np.nanmedian(dem))
        dem = np.where(valid_dem, dem, fill).astype(np.float32)

    albedo = np.zeros((height, width, 4), dtype=np.uint8)
    roughness = np.full(shape, 180, dtype=np.uint8)
    for code, color in CLASS_COLORS.items():
        mask = classes == code
        albedo[mask, :3] = color
        albedo[mask, 3] = 255
        roughness[mask] = CLASS_ROUGHNESS[code]
    water = np.where(classes == 80, 255, 0).astype(np.uint8)

    dz_drow, dz_dcol = np.gradient(dem, args.resolution_m, args.resolution_m)
    nx, ny, nz = -dz_dcol, dz_drow, np.ones_like(dem)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    normal = np.stack(((nx / length + 1) * 127.5,
                       (ny / length + 1) * 127.5,
                       (nz / length + 1) * 127.5), axis=-1)
    normal = np.clip(normal, 0, 255).astype(np.uint8)

    local_mean = gaussian_filter(dem, sigma=max(1.0, 120.0 / args.resolution_m))
    relief = dem - local_mean
    relief_scale = max(float(np.percentile(np.abs(relief), 95)), 0.01)
    ao = np.clip(190.0 - (relief / relief_scale) * 38.0, 96, 255).astype(np.uint8)

    write_png(args.output / 'albedo.png', albedo, 'RGBA')
    write_png(args.output / 'water-mask.png', water, 'L')
    write_png(args.output / 'roughness.png', roughness, 'L')
    write_png(args.output / 'normal.png', normal, 'RGB')
    write_png(args.output / 'ambient-occlusion.png', ao, 'L')
    metadata = {
        'regionId': 'earth-surface-jau-sp-br', 'center': {'latitudeDeg': LATITUDE, 'longitudeDeg': LONGITUDE},
        'radiusKm': args.radius_km, 'resolutionMeters': args.resolution_m,
        'width': width, 'height': height, 'crs': target_crs,
        'transform': list(affine)[:6], 'boundsProjectedMeters': [left, bottom, right, top],
        'landCoverSource': 'ESA WorldCover 2021 v200', 'landCoverLicense': 'CC-BY-4.0',
        'landCoverAttribution': '© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium',
        'demSource': 'User-supplied DEM; record exact product, version, license and vertical datum before packaging',
        'waterClassCode': 80, 'generatedLayers': ['albedo', 'water-mask', 'roughness', 'normal', 'ambient-occlusion'],
        'notes': 'AO and normal are derived from the supplied DEM; inspect nodata coverage and vertical datum before use.'
    }
    (args.output / 'metadata.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
    print(json.dumps({'output': str(args.output), 'size': f'{width}x{height}', 'crs': target_crs,
                      'radiusKm': args.radius_km, 'layers': metadata['generatedLayers']}, indent=2))

if __name__ == '__main__':
    main()