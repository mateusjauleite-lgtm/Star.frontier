#pragma once

#include "CoreMinimal.h"
#include "GameFramework/SpringArmComponent.h"
#include "FrontierCharacterCameraBoom.generated.h"

UCLASS(ClassGroup=(Frontier), BlueprintType, meta=(BlueprintSpawnableComponent))
class FRONTIER_API UFrontierCharacterCameraBoom : public USpringArmComponent
{
    GENERATED_BODY()

public:
    UFrontierCharacterCameraBoom();
};
