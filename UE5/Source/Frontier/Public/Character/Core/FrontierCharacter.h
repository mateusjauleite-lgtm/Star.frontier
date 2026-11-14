#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "FrontierCharacter.generated.h"

class UCameraComponent;
class UFrontierCharacterCameraBoom;
class UFrontierCharacterInputConfig;
class UFrontierCharacterMovementComponent;
class UFrontierCharacterStateComponent;
class UFrontierCharacterPresentationData;
class UFrontierCharacterHUDWidget;
struct FInputActionValue;

UCLASS(Blueprintable)
class FRONTIER_API AFrontierCharacter : public ACharacter
{
    GENERATED_BODY()

public:
    explicit AFrontierCharacter(const FObjectInitializer& ObjectInitializer);

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Character|Core")
    TObjectPtr<UFrontierCharacterStateComponent> CharacterState;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Character|Movement")
    TObjectPtr<UFrontierCharacterMovementComponent> CharacterMovementBranch;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Character|Camera")
    TObjectPtr<UFrontierCharacterCameraBoom> CameraBoom;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Character|Camera")
    TObjectPtr<UCameraComponent> FollowCamera;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Character|Model")
    TObjectPtr<UFrontierCharacterPresentationData> PresentationData;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Character|Input")
    TObjectPtr<UFrontierCharacterInputConfig> InputConfig;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Character|HUD")
    TSubclassOf<UFrontierCharacterHUDWidget> CharacterHUDClass;

    UFUNCTION(BlueprintCallable, Category="Character|Core")
    void EnterShipControlMode();

    UFUNCTION(BlueprintCallable, Category="Character|Core")
    void LeaveShipControlMode();

protected:
    virtual void BeginPlay() override;
    virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
    virtual void OnMovementModeChanged(EMovementMode PrevMovementMode, uint8 PreviousCustomMode = 0) override;

private:
    UPROPERTY()
    TObjectPtr<UFrontierCharacterHUDWidget> CharacterHUD;

    void Move(const FInputActionValue& Value);
    void Look(const FInputActionValue& Value);
    void Interact();
    void ApplyPresentation();
};
