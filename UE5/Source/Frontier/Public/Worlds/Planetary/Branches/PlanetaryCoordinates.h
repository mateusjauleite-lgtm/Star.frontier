#pragma once

#include "CoreMinimal.h"
#include "PlanetaryCoordinates.generated.h"

UENUM(BlueprintType)
enum class EPlanetaryCoordinateConvention : uint8
{
    Unspecified,
    LatitudeLongitudeAltitude
};

USTRUCT(BlueprintType)
struct FRONTIER_API FPlanetaryCoordinateReference
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Planetary|Coordinates")
    EPlanetaryCoordinateConvention Convention = EPlanetaryCoordinateConvention::Unspecified;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Planetary|Coordinates")
    FName BodyFixedFrame = FName(TEXT("BodyFixed"));

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Planetary|Coordinates")
    bool bLongitudeEastPositive = true;
};
