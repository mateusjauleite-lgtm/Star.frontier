#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "FrontierEarth.generated.h"

class UFrontierEarthBranchComponent;
class UPlanetaryProfileDataAsset;
class UAtmosphereClimateProfileDataAsset;
class USceneComponent;

/**
 * Earth-specific composition root. It coordinates the seven established
 * visual branches and consumes shared planetary and atmosphere data assets.
 */
UCLASS(BlueprintType, Blueprintable)
class FRONTIER_API AFrontierEarth : public AActor
{
    GENERATED_BODY()

public:
    AFrontierEarth();

    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

    UFUNCTION(BlueprintCallable, Category="Earth|Core")
    bool InitializeEarth();

    UFUNCTION(BlueprintPure, Category="Earth|Core")
    bool IsEarthReady() const { return bEarthReady; }

    UFUNCTION(BlueprintPure, Category="Earth|Core")
    double GetVisualUnitsPerKilometre() const;

    UFUNCTION(BlueprintPure, Category="Earth|Core")
    UPlanetaryProfileDataAsset* GetPlanetaryProfile() const { return PlanetaryProfile; }

    UFUNCTION(BlueprintPure, Category="Earth|Core")
    UAtmosphereClimateProfileDataAsset* GetAtmosphereProfile() const { return AtmosphereProfile; }

protected:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Earth|Core")
    TObjectPtr<USceneComponent> SceneRoot;

    UPROPERTY(EditInstanceOnly, BlueprintReadOnly, Category="Earth|Profiles")
    TObjectPtr<UPlanetaryProfileDataAsset> PlanetaryProfile = nullptr;

    UPROPERTY(EditInstanceOnly, BlueprintReadOnly, Category="Earth|Profiles")
    TObjectPtr<UAtmosphereClimateProfileDataAsset> AtmosphereProfile = nullptr;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Earth|Rendering", meta=(ClampMin="0.001"))
    double VisualRadiusUnits = 300.0;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Earth|Branches")
    TObjectPtr<UFrontierEarthBranchComponent> InteriorBranch;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Earth|Branches")
    TObjectPtr<UFrontierEarthBranchComponent> SurfaceBranch;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Earth|Branches")
    TObjectPtr<UFrontierEarthBranchComponent> TerrainBranch;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Earth|Branches")
    TObjectPtr<UFrontierEarthBranchComponent> OceansBranch;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Earth|Branches")
    TObjectPtr<UFrontierEarthBranchComponent> AtmosphereBranch;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Earth|Branches")
    TObjectPtr<UFrontierEarthBranchComponent> CloudsBranch;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Earth|Branches")
    TObjectPtr<UFrontierEarthBranchComponent> LightingBranch;

private:
    UPROPERTY()
    TArray<TObjectPtr<UFrontierEarthBranchComponent>> BranchesInDependencyOrder;

    UPROPERTY(VisibleInstanceOnly, Category="Earth|Core")
    bool bEarthReady = false;
};
