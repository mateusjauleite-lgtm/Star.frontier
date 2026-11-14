#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "FrontierEarthBranchComponent.generated.h"

/**
 * Lifecycle contract for one independently replaceable Earth branch.
 * Rendering and scientific state remain owned by their respective domain cores.
 */
UCLASS(ClassGroup=(Frontier), BlueprintType, Blueprintable, meta=(BlueprintSpawnableComponent))
class FRONTIER_API UFrontierEarthBranchComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UFrontierEarthBranchComponent();

    void ConfigureBranch(FName InBranchId, const TArray<FName>& InDependencies, bool bInEnabledByDefault);

    UFUNCTION(BlueprintCallable, Category="Earth|Branch")
    bool InitializeBranch(const TArray<FName>& InitializedBranchIds);

    UFUNCTION(BlueprintCallable, Category="Earth|Branch")
    void DeinitializeBranch();

    UFUNCTION(BlueprintPure, Category="Earth|Branch")
    FName GetBranchId() const { return BranchId; }

    UFUNCTION(BlueprintPure, Category="Earth|Branch")
    bool IsBranchInitialized() const { return bInitialized; }

    UFUNCTION(BlueprintPure, Category="Earth|Branch")
    bool IsEnabledByDefault() const { return bEnabledByDefault; }

    UFUNCTION(BlueprintPure, Category="Earth|Branch")
    const TArray<FName>& GetDependencies() const { return Dependencies; }

private:
    UPROPERTY(VisibleAnywhere, Category="Earth|Branch")
    FName BranchId = NAME_None;

    UPROPERTY(VisibleAnywhere, Category="Earth|Branch")
    TArray<FName> Dependencies;

    UPROPERTY(EditAnywhere, Category="Earth|Branch")
    bool bEnabledByDefault = true;

    UPROPERTY(VisibleInstanceOnly, Category="Earth|Branch")
    bool bInitialized = false;
};
