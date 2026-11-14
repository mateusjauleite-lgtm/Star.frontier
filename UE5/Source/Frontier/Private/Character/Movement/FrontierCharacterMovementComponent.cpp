#include "Character/Movement/FrontierCharacterMovementComponent.h"

UFrontierCharacterMovementComponent::UFrontierCharacterMovementComponent()
{
    bOrientRotationToMovement = true;
    RotationRate = FRotator(0.0f, 540.0f, 0.0f);
    MaxWalkSpeed = 420.0f;
    JumpZVelocity = 460.0f;
    AirControl = 0.35f;
}
