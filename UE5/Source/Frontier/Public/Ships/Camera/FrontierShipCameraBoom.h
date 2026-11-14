#pragma once

#include "CoreMinimal.h"
#include "GameFramework/SpringArmComponent.h"
#include "FrontierShipCameraBoom.generated.h"

class UCameraComponent;

UCLASS(ClassGroup=(Frontier), BlueprintType, meta=(BlueprintSpawnableComponent))
class FRONTIER_API UFrontierShipCameraBoom : public USpringArmComponent
{
    GENERATED_BODY()

public:
    UFrontierShipCameraBoom();

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Ship|Camera")
    TObjectPtr<UCameraComponent> ShipCamera;
};
