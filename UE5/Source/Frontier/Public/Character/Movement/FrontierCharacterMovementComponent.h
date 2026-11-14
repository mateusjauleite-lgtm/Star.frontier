#pragma once

#include "CoreMinimal.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "FrontierCharacterMovementComponent.generated.h"

UCLASS(ClassGroup=(Frontier), BlueprintType, meta=(BlueprintSpawnableComponent))
class FRONTIER_API UFrontierCharacterMovementComponent : public UCharacterMovementComponent
{
    GENERATED_BODY()

public:
    UFrontierCharacterMovementComponent();
};
