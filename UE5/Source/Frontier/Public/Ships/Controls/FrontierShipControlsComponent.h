#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "FrontierShipControlsComponent.generated.h"

UCLASS(ClassGroup=(Frontier), BlueprintType, Blueprintable, meta=(BlueprintSpawnableComponent))
class FRONTIER_API UFrontierShipControlsComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category="Ship|Controls")
    void SetThrottle(float Value);

    UFUNCTION(BlueprintCallable, Category="Ship|Controls")
    void SetPitch(float Value);

    UFUNCTION(BlueprintCallable, Category="Ship|Controls")
    void SetYaw(float Value);

    UFUNCTION(BlueprintCallable, Category="Ship|Controls")
    void SetBraking(bool bEnabled);

    UFUNCTION(BlueprintCallable, Category="Ship|Controls")
    void SetBoosting(bool bEnabled);

    UFUNCTION(BlueprintCallable, Category="Ship|Controls")
    void ClearControls();

    UFUNCTION(BlueprintCallable, Category="Ship|Controls")
    bool RequestPilotExit(AActor* RequestingActor);

private:
    void Publish();
    bool CanAcceptInput() const;
    float Throttle = 0.0f;
    float Pitch = 0.0f;
    float Yaw = 0.0f;
    bool bBraking = false;
    bool bBoosting = false;
};
