#pragma once

#include "CoreMinimal.h"
#include "Animation/AnimInstance.h"
#include "FrontierCharacterAnimInstance.generated.h"

UCLASS(Blueprintable, BlueprintType)
class FRONTIER_API UFrontierCharacterAnimInstance : public UAnimInstance
{
    GENERATED_BODY()

public:
    UPROPERTY(BlueprintReadOnly, Category="Character|Animation")
    float GroundSpeed = 0.0f;

    UPROPERTY(BlueprintReadOnly, Category="Character|Animation")
    bool bIsGrounded = true;

    UPROPERTY(BlueprintReadOnly, Category="Character|Animation")
    bool bIsSeated = false;

    UPROPERTY(BlueprintReadOnly, Category="Character|Animation")
    bool bIsMoving = false;

    virtual void NativeUpdateAnimation(float DeltaSeconds) override;
};
