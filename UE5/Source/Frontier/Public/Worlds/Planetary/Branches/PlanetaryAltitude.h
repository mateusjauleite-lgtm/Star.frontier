#pragma once

#include "CoreMinimal.h"
#include "PlanetaryAltitude.generated.h"

USTRUCT(BlueprintType)
struct FRONTIER_API FPlanetaryAltitudeReference
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Planetary|Altitude", meta=(Units="km"))
    double ReferenceAltitudeKm = 0.0;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Planetary|Altitude")
    FName ReferenceDatum = FName(TEXT("MeanSurface"));
};
