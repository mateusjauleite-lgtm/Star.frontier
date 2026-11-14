#include "Character/HUD/FrontierCharacterHUDWidget.h"
#include "Character/Core/FrontierCharacter.h"
#include "Character/Interaction/FrontierInteractable.h"
#include "GameFramework/Character.h"
#include "GameFramework/PlayerController.h"
#include "Camera/CameraComponent.h"
#include "Math/RotationMatrix.h"

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

void UFrontierCharacterHUDWidget::MoveCharacter(FVector2D Axis)
{
    AFrontierCharacter* Character = Cast<AFrontierCharacter>(GetOwningPlayerPawn());
    if (!Character || !Character->CharacterState ||
        Character->CharacterState->State.Mode != EFrontierCharacterMode::OnFoot) return;
    Axis = Axis.GetClampedToMaxSize(1.0f);
    Character->CharacterState->SetMovementInput(Axis);
    if (!Character->Controller) return;
    const FRotator Yaw(0.0f, Character->Controller->GetControlRotation().Yaw, 0.0f);
    Character->AddMovementInput(FRotationMatrix(Yaw).GetUnitAxis(EAxis::X), Axis.Y);
    Character->AddMovementInput(FRotationMatrix(Yaw).GetUnitAxis(EAxis::Y), Axis.X);
}

void UFrontierCharacterHUDWidget::LookCharacter(FVector2D Axis)
{
    AFrontierCharacter* Character = Cast<AFrontierCharacter>(GetOwningPlayerPawn());
    if (!Character || !Character->CharacterState ||
        Character->CharacterState->State.Mode != EFrontierCharacterMode::OnFoot) return;
    Character->CharacterState->SetLookInput(Axis);
    Character->AddControllerYawInput(Axis.X);
    Character->AddControllerPitchInput(Axis.Y);
}

void UFrontierCharacterHUDWidget::StopCharacterMovement()
{
    if (AFrontierCharacter* Character = Cast<AFrontierCharacter>(GetOwningPlayerPawn()))
        if (Character->CharacterState)
            Character->CharacterState->SetMovementInput(FVector2D::ZeroVector);
}

void UFrontierCharacterHUDWidget::JumpCharacter()
{
    if (AFrontierCharacter* Character = Cast<AFrontierCharacter>(GetOwningPlayerPawn()))
        if (Character->CharacterState &&
            Character->CharacterState->State.Mode == EFrontierCharacterMode::OnFoot)
            Character->Jump();
}

void UFrontierCharacterHUDWidget::InteractCharacter()
{
    AFrontierCharacter* Character = Cast<AFrontierCharacter>(GetOwningPlayerPawn());
    if (!Character || !Character->CharacterState ||
        Character->CharacterState->State.Mode != EFrontierCharacterMode::OnFoot ||
        !Character->FollowCamera) return;

    const FVector Start = Character->FollowCamera->GetComponentLocation();
    const FVector End = Start + Character->FollowCamera->GetForwardVector() * 350.0f;
    FHitResult Hit;
    FCollisionQueryParams Params(SCENE_QUERY_STAT(CharacterHUDInteract), false, Character);
    if (!Character->GetWorld()->LineTraceSingleByChannel(Hit, Start, End, ECC_Visibility, Params)) return;

    AActor* Target = Hit.GetActor();
    if (Target && Target->GetClass()->ImplementsInterface(UFrontierInteractable::StaticClass()) &&
        IFrontierInteractable::Execute_CanBeInteractedWith(Target, Character))
    {
        Character->CharacterState->SetInteractionTarget(Target->GetFName());
        IFrontierInteractable::Execute_Interact(Target, Character);
    }
}
