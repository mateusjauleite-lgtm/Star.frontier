#pragma once

#include "CoreMinimal.h"
#include "AtmosphericLayer.generated.h"

USTRUCT(BlueprintType)
struct FRONTIER_API FAtmosphericLayerDefinition
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Atmosphere|Layer")
    FName LayerId = NAME_None;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Atmosphere|Layer", meta=(Units="km"))
    double MinAltitudeKm = 0.0;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Atmosphere|Layer", meta=(Units="km"))
    double MaxAltitudeKm = 100.0;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Atmosphere|Layer", meta=(Units="km"))
    double ReferenceAltitudeKm = 0.0;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Atmosphere|Layer", meta=(Units="Pa", ClampMin="0.0"))
    double ReferencePressurePa = 101325.0;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Atmosphere|Layer", meta=(Units="K", ClampMin="1.0"))
    double ReferenceTemperatureK = 288.15;

    // Positive values cool with altitude; negative values warm with altitude.
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Atmosphere|Layer", meta=(Units="K/km"))
    double TemperatureLapseRateKPerKm = 6.5;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Atmosphere|Layer", meta=(Units="km", ClampMin="0.001"))
    double PressureScaleHeightKm = 8.0;

    bool IsValidLayer() const
    {
        return !LayerId.IsNone()
            && MinAltitudeKm <= ReferenceAltitudeKm
            && ReferenceAltitudeKm <= MaxAltitudeKm
            && MinAltitudeKm < MaxAltitudeKm
            && ReferencePressurePa > 0.0
            && ReferenceTemperatureK > 0.0
            && PressureScaleHeightKm > 0.0;
    }
};
