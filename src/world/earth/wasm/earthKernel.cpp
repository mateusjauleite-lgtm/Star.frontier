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

}
