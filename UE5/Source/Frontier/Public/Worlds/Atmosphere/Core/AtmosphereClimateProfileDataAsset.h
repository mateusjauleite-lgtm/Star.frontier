#pragma once

#include "CoreMinimal.h"
#include "Engine/PrimaryDataAsset.h"
#include "Worlds/Atmosphere/Branches/AtmosphericComposition.h"
#include "Worlds/Atmosphere/Branches/AtmosphericLayer.h"
#include "Worlds/Atmosphere/Branches/AtmosphericClimateState.h"
#include "AtmosphereClimateProfileDataAsset.generated.h"

class UPlanetaryProfileDataAsset;

UCLASS(BlueprintType)
class FRONTIER_API UAtmosphereClimateProfileDataAsset : public UPrimaryDataAsset
{
    GENERATED_BODY()

public:
    // Shared physical identity/dimensions are owned by Planetary Core.
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Atmosphere|Planet")
    TObjectPtr<UPlanetaryProfileDataAsset> PlanetaryProfile = nullptr;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Atmosphere|Composition")
    FAtmosphericComposition Composition;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Atmosphere|Layers")
    TArray<FAtmosphericLayerDefinition> Layers;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Atmosphere|Climate")
    FAtmosphericClimateBaseline ClimateBaseline;

    UFUNCTION(BlueprintPure, Category="Atmosphere|Validation")
    bool IsProfileValid() const;

    const FAtmosphericLayerDefinition* FindLayerAtAltitude(double AltitudeKm) const;
};
