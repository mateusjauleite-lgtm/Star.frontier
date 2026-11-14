#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "PlanetaryCoordinateSubsystem.generated.h"

UCLASS()
class FRONTIER_API UPlanetaryCoordinateSubsystem : public UWorldSubsystem
{
    GENERATED_BODY()

public:
    // Unreal world distance is centimetres. Planetary source data remains in kilometres.
    UFUNCTION(BlueprintPure, Category="Planetary|Scale")
    static double KilometresToUnrealCentimetres(double DistanceKm);

    UFUNCTION(BlueprintPure, Category="Planetary|Scale")
    static double UnrealCentimetresToKilometres(double DistanceCm);

    // Visual radius is a project-specific preview scale, never a physical radius.
    UFUNCTION(BlueprintPure, Category="Planetary|Scale")
    static double GetVisualRadiusFromPhysicalKm(double PhysicalRadiusKm, double UnrealUnitsPerKm);
};
