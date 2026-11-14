#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "AtmosphereClimateSubsystem.generated.h"

class UAtmosphereClimateProfileDataAsset;

USTRUCT(BlueprintType)
struct FRONTIER_API FAtmosphericSample
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category="Atmosphere|Sample", meta=(Units="km"))
    double AltitudeKm = 0.0;

    UPROPERTY(BlueprintReadOnly, Category="Atmosphere|Sample", meta=(Units="Pa"))
    double PressurePa = 0.0;

    UPROPERTY(BlueprintReadOnly, Category="Atmosphere|Sample", meta=(Units="K"))
    double TemperatureK = 0.0;

    UPROPERTY(BlueprintReadOnly, Category="Atmosphere|Sample", meta=(Units="kg/m^3"))
    double DensityKgPerM3 = 0.0;
};

UCLASS()
class FRONTIER_API UAtmosphereClimateSubsystem : public UWorldSubsystem
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category="Atmosphere|Runtime")
    bool SetActiveProfile(UAtmosphereClimateProfileDataAsset* Profile);

    UFUNCTION(BlueprintPure, Category="Atmosphere|Runtime")
    const UAtmosphereClimateProfileDataAsset* GetActiveProfile() const;

    UFUNCTION(BlueprintPure, Category="Atmosphere|Sampling")
    bool SampleAtAltitude(double AltitudeKm, FAtmosphericSample& OutSample) const;

private:
    UPROPERTY()
    TObjectPtr<UAtmosphereClimateProfileDataAsset> ActiveProfile = nullptr;
};
