#pragma once

#include "CoreMinimal.h"
#include "PlanetaryRotation.generated.h"

UENUM(BlueprintType)
enum class EPlanetaryRotationDirection : uint8
{
    Unknown,
    Prograde,
    Retrograde
};

USTRUCT(BlueprintType)
struct FRONTIER_API FPlanetaryRotation
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Planetary|Rotation", meta=(Units="s"))
    double SiderealRotationPeriodSeconds = 0.0;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Planetary|Rotation", meta=(Units="deg"))
    double AxialTiltDegrees = 0.0;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Planetary|Rotation")
    EPlanetaryRotationDirection Direction = EPlanetaryRotationDirection::Unknown;
};
