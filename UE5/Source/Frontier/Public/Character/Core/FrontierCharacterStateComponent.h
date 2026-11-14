#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "FrontierCharacterStateComponent.generated.h"

UENUM(BlueprintType)
enum class EFrontierCharacterMode : uint8
{
    OnFoot,
    ShipControl
};

UENUM(BlueprintType)
enum class EFrontierCharacterPosture : uint8
{
    Standing,
    Seated
};

USTRUCT(BlueprintType)
struct FRONTIER_API FFrontierCharacterEquipment
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FName SuitId = TEXT("exploration-basic");

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FName ToolId = NAME_None;
};

USTRUCT(BlueprintType)
struct FRONTIER_API FFrontierCharacterState
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    EFrontierCharacterMode Mode = EFrontierCharacterMode::OnFoot;

    UPROPERTY(BlueprintReadOnly)
    EFrontierCharacterPosture Posture = EFrontierCharacterPosture::Standing;

    UPROPERTY(BlueprintReadOnly)
    float Health = 100.0f;

    UPROPERTY(BlueprintReadOnly)
    float Stamina = 100.0f;

    UPROPERTY(BlueprintReadOnly)
    bool bGrounded = true;

    UPROPERTY(BlueprintReadOnly)
    FVector2D Movement = FVector2D::ZeroVector;

    UPROPERTY(BlueprintReadOnly)
    FVector2D Look = FVector2D::ZeroVector;

    UPROPERTY(BlueprintReadOnly)
    FName InteractionTarget = NAME_None;

    UPROPERTY(BlueprintReadOnly)
    FFrontierCharacterEquipment Equipment;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FFrontierCharacterStateChanged, const FFrontierCharacterState&, State);

UCLASS(ClassGroup=(Frontier), BlueprintType, Blueprintable, meta=(BlueprintSpawnableComponent))
class FRONTIER_API UFrontierCharacterStateComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UFrontierCharacterStateComponent();

    UPROPERTY(BlueprintAssignable, Category="Character|State")
    FFrontierCharacterStateChanged OnStateChanged;

    UPROPERTY(BlueprintReadOnly, Category="Character|State")
    FFrontierCharacterState State;

    UFUNCTION(BlueprintCallable, Category="Character|State")
    void SetMode(EFrontierCharacterMode NewMode);

    UFUNCTION(BlueprintCallable, Category="Character|State")
    void SetMovementInput(FVector2D Input);

    UFUNCTION(BlueprintCallable, Category="Character|State")
    void SetLookInput(FVector2D Input);

    UFUNCTION(BlueprintCallable, Category="Character|State")
    void SetGrounded(bool bNewGrounded);

    UFUNCTION(BlueprintCallable, Category="Character|State")
    void SetHealth(float NewHealth);

    UFUNCTION(BlueprintCallable, Category="Character|State")
    void SetStamina(float NewStamina);

    UFUNCTION(BlueprintCallable, Category="Character|State")
    void SetInteractionTarget(FName TargetId);

    UFUNCTION(BlueprintCallable, Category="Character|State")
    void SetEquipment(FName SuitId, FName ToolId);

    UFUNCTION(BlueprintCallable, Category="Character|State")
    void ResetState();

private:
    void PublishState();
};
