#include <cmath>
#include <cstddef>

#if defined(__EMSCRIPTEN__)
#include <emscripten/emscripten.h>
#define EARTH_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define EARTH_EXPORT
#endif

// Grid contract: rows north-to-south, columns west-to-east.
extern "C" {

EARTH_EXPORT float earth_sample_bilinear(
    const float* values,
    int width,
    int height,
    float longitude,
    float latitude,
    float west,
    float east,
    float south,
    float north,
    float no_data
) {
    if (!values || width < 2 || height < 2 || !(east > west) || !(north > south)) {
        return NAN;
    }

    const float u = fmaxf(0.0f, fminf(1.0f, (longitude - west) / (east - west))) * (width - 1);
    const float v = fmaxf(0.0f, fminf(1.0f, (north - latitude) / (north - south))) * (height - 1);
    const int x0 = static_cast<int>(floorf(u));
    const int y0 = static_cast<int>(floorf(v));
    const int x1 = x0 + 1 < width ? x0 + 1 : width - 1;
    const int y1 = y0 + 1 < height ? y0 + 1 : height - 1;
    const float tx = u - x0;
    const float ty = v - y0;

    const float a = values[y0 * width + x0];
    const float b = values[y0 * width + x1];
    const float c = values[y1 * width + x0];
    const float d = values[y1 * width + x1];

    const auto valid = [no_data](float value) {
        return std::isfinite(value) && (!std::isfinite(no_data) || value != no_data);
    };

    // Ignore neighbours whose interpolation weight is exactly zero. This
    // preserves valid edge samples next to a no-data cell.
    if ((1.0f - tx) * (1.0f - ty) > 0.0f && !valid(a)) return NAN;
    if (tx * (1.0f - ty) > 0.0f && !valid(b)) return NAN;
    if ((1.0f - tx) * ty > 0.0f && !valid(c)) return NAN;
    if (tx * ty > 0.0f && !valid(d)) return NAN;

    const float top = (1.0f - tx) * (valid(a) ? a : 0.0f) + tx * (valid(b) ? b : 0.0f);
    const float bottom = (1.0f - tx) * (valid(c) ? c : 0.0f) + tx * (valid(d) ? d : 0.0f);
    return (1.0f - ty) * top + ty * bottom;
}


EARTH_EXPORT void earth_sample_bilinear_batch(
    const float* values,
    int width,
    int height,
    const float* longitudes,
    const float* latitudes,
    float* output,
    int count,
    float west,
    float east,
    float south,
    float north,
    float no_data
) {
    if (!values || !longitudes || !latitudes || !output || count < 0 ||
        width < 2 || height < 2 || !(east > west) || !(north > south)) return;
    for (int i = 0; i < count; ++i) {
        output[i] = earth_sample_bilinear(
            values, width, height, longitudes[i], latitudes[i],
            west, east, south, north, no_data
        );
    }
}

EARTH_EXPORT float earth_elevation_meters_to_units(
    float elevation_meters,
    float visual_radius_units,
    float mean_radius_km,
    float exaggeration
) {
    if (!std::isfinite(elevation_meters) || !(visual_radius_units > 0.0f) ||
        !(mean_radius_km > 0.0f) || !(exaggeration > 0.0f)) {
        return NAN;
    }
    return (elevation_meters / 1000.0f) *
        (visual_radius_units / mean_radius_km) * exaggeration;
}


namespace {
float earth_hash_lattice(int x, int y, int z) {
    unsigned int h = static_cast<unsigned int>(x) * 374761393u
        + static_cast<unsigned int>(y) * 668265263u
        + static_cast<unsigned int>(z) * 2246822519u
        + 3266489917u;
    h = (h ^ (h >> 13)) * 1274126177u;
    h ^= h >> 16;
    return static_cast<float>(h & 0x00ffffffu) / 8388607.5f - 1.0f;
}
float earth_fade(float t) { return t * t * (3.0f - 2.0f * t); }
float earth_value_noise(float x, float y, float z) {
    const int ix = static_cast<int>(floorf(x));
    const int iy = static_cast<int>(floorf(y));
    const int iz = static_cast<int>(floorf(z));
    const float tx = earth_fade(x - ix), ty = earth_fade(y - iy), tz = earth_fade(z - iz);
    const float c000 = earth_hash_lattice(ix, iy, iz);
    const float c100 = earth_hash_lattice(ix + 1, iy, iz);
    const float c010 = earth_hash_lattice(ix, iy + 1, iz);
    const float c110 = earth_hash_lattice(ix + 1, iy + 1, iz);
    const float c001 = earth_hash_lattice(ix, iy, iz + 1);
    const float c101 = earth_hash_lattice(ix + 1, iy, iz + 1);
    const float c011 = earth_hash_lattice(ix, iy + 1, iz + 1);
    const float c111 = earth_hash_lattice(ix + 1, iy + 1, iz + 1);
    const float x00 = c000 + (c100 - c000) * tx;
    const float x10 = c010 + (c110 - c010) * tx;
    const float x01 = c001 + (c101 - c001) * tx;
    const float x11 = c011 + (c111 - c011) * tx;
    const float y0 = x00 + (x10 - x00) * ty;
    const float y1 = x01 + (x11 - x01) * ty;
    return y0 + (y1 - y0) * tz;
}
}

EARTH_EXPORT float earth_procedural_detail_meters(
    float longitude_degrees, float latitude_degrees, float amplitude_meters
) {
    if (!std::isfinite(longitude_degrees) || !std::isfinite(latitude_degrees) ||
        !std::isfinite(amplitude_meters) || amplitude_meters < 0.0f ||
        latitude_degrees < -90.0f || latitude_degrees > 90.0f) return NAN;
    const float lon = longitude_degrees * 0.01745329251994329577f;
    const float lat = latitude_degrees * 0.01745329251994329577f;
    const float x = cosf(lat) * cosf(lon);
    const float y = sinf(lat);
    const float z = cosf(lat) * sinf(lon);
    float sum = 0.0f, weight = 0.0f, frequency = 7.0f, gain = 0.5f;
    for (int octave = 0; octave < 5; ++octave) {
        const float n = earth_value_noise(x * frequency + 17.0f,
            y * frequency - 31.0f, z * frequency + 11.0f);
        const float ridge = 1.0f - fabsf(n);
        sum += (n * 0.55f + (ridge * 2.0f - 1.0f) * 0.45f) * gain;
        weight += gain;
        frequency *= 2.03f;
        gain *= 0.5f;
    }
    return weight > 0.0f ? (sum / weight) * amplitude_meters : 0.0f;
}

}
