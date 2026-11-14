#include "Character/HUD/FrontierCharacterHUDWidget.h"

void UFrontierCharacterHUDWidget::ObserveCharacter(UFrontierCharacterStateComponent* CharacterState)
{
    if (ObservedState)
    {
        ObservedState->OnStateChanged.RemoveDynamic(
            this, &UFrontierCharacterHUDWidget::HandleCharacterStateChanged);
    }

    ObservedState = CharacterState;
    if (!ObservedState) return;

    ObservedState->OnStateChanged.AddDynamic(
        this, &UFrontierCharacterHUDWidget::HandleCharacterStateChanged);

    HandleCharacterStateChanged(ObservedState->State);
}

void UFrontierCharacterHUDWidget::HandleCharacterStateChanged(
    const FFrontierCharacterState& State)
{
    const bool bOnFoot = State.Mode == EFrontierCharacterMode::OnFoot;
    RefreshCharacterHUD(State, bOnFoot);
}
