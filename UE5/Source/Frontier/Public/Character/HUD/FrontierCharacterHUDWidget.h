#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "Character/Core/FrontierCharacterStateComponent.h"
#include "FrontierCharacterHUDWidget.generated.h"

UCLASS(Abstract, Blueprintable)
class FRONTIER_API UFrontierCharacterHUDWidget : public UUserWidget
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category="Character|HUD")
    void ObserveCharacter(UFrontierCharacterStateComponent* CharacterState);

    UFUNCTION(BlueprintImplementableEvent, Category="Character|HUD")
    void RefreshCharacterHUD(const FFrontierCharacterState& State, bool bVisible);

protected:
    UPROPERTY(BlueprintReadOnly, Category="Character|HUD")
    TObjectPtr<UFrontierCharacterStateComponent> ObservedState;

    UFUNCTION()
    void HandleCharacterStateChanged(const FFrontierCharacterState& State);
};
