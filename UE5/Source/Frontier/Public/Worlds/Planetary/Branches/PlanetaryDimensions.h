#pragma once

#include "CoreMinimal.h"
#include "PlanetaryDimensions.generated.h"

USTRUCT(BlueprintType)
struct FRONTIER_API FPlanetaryDimensions
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Planetary|Dimensions", meta=(ClampMin="0.0", Units="km"))
    double MeanRadiusKm = 0.0;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Planetary|Dimensions", meta=(ClampMin="0.0", Units="km"))
    double EquatorialRadiusKm = 0.0;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Planetary|Dimensions", meta=(ClampMin="0.0", Units="km"))
    double PolarRadiusKm = 0.0;

    bool IsValid() const
    {
        return MeanRadiusKm > 0.0
            && EquatorialRadiusKm > 0.0
            && PolarRadiusKm > 0.0;
    }
};
