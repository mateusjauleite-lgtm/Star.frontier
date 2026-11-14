#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "FrontierShipEngineFXComponent.generated.h"

class UNiagaraComponent;
class UNiagaraSystem;
class UPointLightComponent;
class USceneComponent;

/**
 * Visual-only engine branch. Reads Ship Core flight telemetry but never changes
 * acceleration, speed, boost or movement.
 *
 * Optional Niagara systems can be assigned in a ship Blueprint. Two point-light
 * exhaust glows remain available as a native fallback while authored Niagara
 * assets are not yet present.
 */
UCLASS(ClassGroup=(Frontier), BlueprintType, Blueprintable, meta=(BlueprintSpawnableComponent))
class FRONTIER_API UFrontierShipEngineFXComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UFrontierShipEngineFXComponent();

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Engine FX")
    TObjectPtr<UNiagaraSystem> EngineSystem;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Engine FX")
    FName ThrottleParameter = TEXT("User.Throttle");

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Engine FX")
    FName SpeedParameter = TEXT("User.SpeedNormalized");

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Engine FX")
    FName BoostParameter = TEXT("User.Boost");

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Engine FX")
    FName BrakingParameter = TEXT("User.Braking");

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Engine FX")
    float CruiseGlowIntensity = 1400.0f;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Engine FX")
    float BoostGlowIntensity = 3600.0f;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Engine FX")
    float GlowAttenuationRadius = 1800.0f;

    UFUNCTION(BlueprintCallable, Category="Ship|Engine FX")
    void RefreshEngineFX();

protected:
    virtual void BeginPlay() override;
    virtual void TickComponent(float DeltaSeconds, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

private:
    UPROPERTY(Transient)
    TArray<TObjectPtr<UNiagaraComponent>> NiagaraEmitters;

    UPROPERTY(Transient)
    TArray<TObjectPtr<UPointLightComponent>> ExhaustGlows;

    float CurrentGlowIntensity = 0.0f;

    void CreateEngineVisuals();
    void UpdateEngineVisuals(float DeltaSeconds);
};
