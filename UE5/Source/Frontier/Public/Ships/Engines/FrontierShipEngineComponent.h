#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "FrontierShipEngineComponent.generated.h"

UCLASS(ClassGroup=(Frontier), BlueprintType, Blueprintable, meta=(BlueprintSpawnableComponent))
class FRONTIER_API UFrontierShipEngineComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UFrontierShipEngineComponent();

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Ship|Engines")
    float MaximumSpeedCmPerSecond = 1800.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Ship|Engines")
    float AccelerationCmPerSecondSquared = 420.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Ship|Engines")
    float BoostMultiplier = 1.65f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Ship|Engines")
    float BrakeDeceleration = 900.0f;

    UPROPERTY(BlueprintReadOnly, Category="Ship|Engines")
    float CurrentSpeedCmPerSecond = 0.0f;

    UFUNCTION(BlueprintCallable, Category="Ship|Engines")
    float GetCurrentSpeedCmPerSecond() const { return CurrentSpeedCmPerSecond; }

    UFUNCTION(BlueprintCallable, Category="Ship|Engines")
    void ResetSpeed() { CurrentSpeedCmPerSecond = 0.0f; }

protected:
    virtual void BeginPlay() override;
    virtual void TickComponent(float DeltaSeconds, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;
};
