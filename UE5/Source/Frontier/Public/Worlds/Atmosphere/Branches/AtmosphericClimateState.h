#pragma once

#include "CoreMinimal.h"
#include "AtmosphericClimateState.generated.h"

USTRUCT(BlueprintType)
struct FRONTIER_API FAtmosphericClimateBaseline
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Atmosphere|Climate", meta=(Units="K", ClampMin="1.0"))
    double MeanSurfaceTemperatureK = 288.15;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Atmosphere|Climate", meta=(ClampMin="0.0", ClampMax="1.0"))
    double RelativeHumidity = 0.5;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Atmosphere|Climate", meta=(Units="m/s", ClampMin="0.0"))
    double MeanWindSpeedMps = 0.0;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Atmosphere|Climate", meta=(Units="mm/day", ClampMin="0.0"))
    double MeanPrecipitationMmPerDay = 0.0;

    bool IsValidState() const
    {
        return MeanSurfaceTemperatureK > 0.0
            && RelativeHumidity >= 0.0 && RelativeHumidity <= 1.0
            && MeanWindSpeedMps >= 0.0
            && MeanPrecipitationMmPerDay >= 0.0;
    }
};
