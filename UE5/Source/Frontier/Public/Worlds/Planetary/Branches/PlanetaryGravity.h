#pragma once

#include "CoreMinimal.h"
#include "PlanetaryGravity.generated.h"

USTRUCT(BlueprintType)
struct FRONTIER_API FPlanetaryGravity
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Planetary|Gravity", meta=(ClampMin="0.0", Units="m/s^2"))
    double StandardSurfaceGravityMps2 = 0.0;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Planetary|Gravity")
    bool bHasDefinedSurface = false;
};
