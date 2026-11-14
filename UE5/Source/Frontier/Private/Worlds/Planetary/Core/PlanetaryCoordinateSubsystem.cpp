#include "Worlds/Planetary/Core/PlanetaryCoordinateSubsystem.h"

double UPlanetaryCoordinateSubsystem::KilometresToUnrealCentimetres(const double DistanceKm)
{
    return DistanceKm * 100000.0;
}

double UPlanetaryCoordinateSubsystem::UnrealCentimetresToKilometres(const double DistanceCm)
{
    return DistanceCm / 100000.0;
}

double UPlanetaryCoordinateSubsystem::GetVisualRadiusFromPhysicalKm(
    const double PhysicalRadiusKm,
    const double UnrealUnitsPerKm)
{
    if (PhysicalRadiusKm <= 0.0 || UnrealUnitsPerKm <= 0.0)
    {
        return 0.0;
    }

    return PhysicalRadiusKm * UnrealUnitsPerKm;
}
