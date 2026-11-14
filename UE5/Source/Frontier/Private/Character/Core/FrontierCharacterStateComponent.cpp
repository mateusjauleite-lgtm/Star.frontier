#include "Character/Core/FrontierCharacterStateComponent.h"

UFrontierCharacterStateComponent::UFrontierCharacterStateComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

void UFrontierCharacterStateComponent::PublishState()
{
    OnStateChanged.Broadcast(State);
}

void UFrontierCharacterStateComponent::SetMode(EFrontierCharacterMode NewMode)
{
    State.Mode = NewMode;
    State.Posture = NewMode == EFrontierCharacterMode::ShipControl
        ? EFrontierCharacterPosture::Seated
        : EFrontierCharacterPosture::Standing;

    // Movement is owned by the character while on foot, never by the ship.
    State.Movement = FVector2D::ZeroVector;
    PublishState();
}

void UFrontierCharacterStateComponent::SetMovementInput(FVector2D Input)
{
    if (State.Mode != EFrontierCharacterMode::OnFoot) return;
    State.Movement = Input.GetClampedToMaxSize(1.0f);
    PublishState();
}

void UFrontierCharacterStateComponent::SetLookInput(FVector2D Input)
{
    if (State.Mode != EFrontierCharacterMode::OnFoot) return;
    State.Look = Input;
    PublishState();
}

void UFrontierCharacterStateComponent::SetGrounded(bool bNewGrounded)
{
    State.bGrounded = bNewGrounded;
    PublishState();
}

void UFrontierCharacterStateComponent::SetHealth(float NewHealth)
{
    State.Health = FMath::Clamp(NewHealth, 0.0f, 100.0f);
    PublishState();
}

void UFrontierCharacterStateComponent::SetStamina(float NewStamina)
{
    State.Stamina = FMath::Clamp(NewStamina, 0.0f, 100.0f);
    PublishState();
}

void UFrontierCharacterStateComponent::SetInteractionTarget(FName TargetId)
{
    State.InteractionTarget = TargetId;
    PublishState();
}

void UFrontierCharacterStateComponent::SetEquipment(FName SuitId, FName ToolId)
{
    State.Equipment.SuitId = SuitId;
    State.Equipment.ToolId = ToolId;
    PublishState();
}

void UFrontierCharacterStateComponent::ResetState()
{
    State = FFrontierCharacterState();
    PublishState();
}
