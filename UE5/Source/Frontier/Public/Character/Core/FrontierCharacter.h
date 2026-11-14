#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "FrontierCharacter.generated.h"

class UCameraComponent;
class USpringArmComponent;
class UInputMappingContext;
class UInputAction;
class UFrontierCharacterStateComponent;
class UFrontierCharacterPresentationData;
class UFrontierCharacterHUDWidget;
struct FInputActionValue;

UCLASS(Blueprintable)
class FRONTIER_API AFrontierCharacter : public ACharacter
{
    GENERATED_BODY()

public:
    AFrontierCharacter();

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Character|Core")
    TObjectPtr<UFrontierCharacterStateComponent> CharacterState;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Character|Camera")
    TObjectPtr<USpringArmComponent> CameraBoom;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Character|Camera")
    TObjectPtr<UCameraComponent> FollowCamera;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Character|Model")
    TObjectPtr<UFrontierCharacterPresentationData> PresentationData;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Character|Input")
    TObjectPtr<UInputMappingContext> DefaultMappingContext;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Character|Input")
    TObjectPtr<UInputAction> MoveAction;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Character|Input")
    TObjectPtr<UInputAction> LookAction;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Character|Input")
    TObjectPtr<UInputAction> JumpAction;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Character|Input")
    TObjectPtr<UInputAction> InteractAction;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Character|HUD")
    TSubclassOf<UFrontierCharacterHUDWidget> CharacterHUDClass;

    UFUNCTION(BlueprintCallable, Category="Character|Core")
    void EnterShipControlMode();

    UFUNCTION(BlueprintCallable, Category="Character|Core")
    void LeaveShipControlMode();

protected:
    virtual void BeginPlay() override;
    virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;

private:
    UPROPERTY()
    TObjectPtr<UFrontierCharacterHUDWidget> CharacterHUD;

    void Move(const FInputActionValue& Value);
    void Look(const FInputActionValue& Value);
    void Interact();
    void ApplyPresentation();
};
