#pragma once

#include "CoreMinimal.h"
#include "Engine/PrimaryDataAsset.h"
#include "Worlds/Planetary/Branches/PlanetaryBodyIdentity.h"
#include "Worlds/Planetary/Branches/PlanetaryDimensions.h"
#include "Worlds/Planetary/Branches/PlanetaryGravity.h"
#include "Worlds/Planetary/Branches/PlanetaryRotation.h"
#include "Worlds/Planetary/Branches/PlanetaryAltitude.h"
#include "Worlds/Planetary/Branches/PlanetaryCoordinates.h"
#include "PlanetaryProfileDataAsset.generated.h"

UCLASS(BlueprintType)
class FRONTIER_API UPlanetaryProfileDataAsset : public UPrimaryDataAsset
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Planetary|Core")
    FPlanetaryBodyIdentity Identity;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Planetary|Core")
    FPlanetaryDimensions Dimensions;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Planetary|Core")
    FPlanetaryGravity Gravity;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Planetary|Core")
    FPlanetaryRotation Rotation;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Planetary|Core")
    FPlanetaryAltitudeReference Altitude;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Planetary|Core")
    FPlanetaryCoordinateReference Coordinates;

    UFUNCTION(BlueprintPure, Category="Planetary|Validation")
    bool IsProfileValid() const;
};
