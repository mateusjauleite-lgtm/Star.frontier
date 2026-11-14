#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "Input/Reply.h"
#include "Character/Core/FrontierCharacterStateComponent.h"
#include "FrontierCharacterHUDWidget.generated.h"

class UCanvasPanel;
class UButton;

UCLASS(Blueprintable)
class FRONTIER_API UFrontierCharacterHUDWidget : public UUserWidget
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category="Character|HUD")
    void ObserveCharacter(UFrontierCharacterStateComponent* CharacterState);

    UFUNCTION(BlueprintCallable, Category="Character|HUD|MobileControls")
    void MoveCharacter(FVector2D Axis);

    UFUNCTION(BlueprintCallable, Category="Character|HUD|MobileControls")
    void LookCharacter(FVector2D Axis);

    UFUNCTION(BlueprintCallable, Category="Character|HUD|MobileControls")
    void StopCharacterMovement();

    UFUNCTION(BlueprintCallable, Category="Character|HUD|MobileControls")
    void JumpCharacter();

    UFUNCTION(BlueprintCallable, Category="Character|HUD|MobileControls")
    void InteractCharacter();

    UFUNCTION(BlueprintCallable, Category="Character|HUD|Elevator")
    bool ElevatorUp();

    UFUNCTION(BlueprintCallable, Category="Character|HUD|Elevator")
    bool ElevatorDown();

    UFUNCTION(BlueprintImplementableEvent, Category="Character|HUD")
    void RefreshCharacterHUD(const FFrontierCharacterState& State, bool bVisible);

protected:
    virtual void NativeConstruct() override;
    virtual void NativeTick(const FGeometry& MyGeometry, float InDeltaTime) override;
    virtual FReply NativeOnTouchStarted(const FGeometry& Geometry, const FPointerEvent& Event) override;
    virtual FReply NativeOnTouchMoved(const FGeometry& Geometry, const FPointerEvent& Event) override;
    virtual FReply NativeOnTouchEnded(const FGeometry& Geometry, const FPointerEvent& Event) override;

    UPROPERTY(BlueprintReadOnly, Category="Character|HUD")
    TObjectPtr<UFrontierCharacterStateComponent> ObservedState;

    UFUNCTION()
    void HandleCharacterStateChanged(const FFrontierCharacterState& State);

    UFUNCTION()
    void OnJumpPressed();

    UFUNCTION()
    void OnInteractPressed();

    UFUNCTION()
    void OnElevatorUpPressed();

    UFUNCTION()
    void OnElevatorDownPressed();

private:
    void BuildNativeLayout();
    TMap<int32, FVector2D> TouchOrigins;
    TMap<int32, FVector2D> CurrentTouchPositions;
    TMap<int32, FVector2D> LastTouchPositions;
    TSet<int32> MovementPointers;
    TSet<int32> LookPointers;
};
