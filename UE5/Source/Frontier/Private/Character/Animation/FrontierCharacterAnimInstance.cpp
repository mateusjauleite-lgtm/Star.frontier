#include "Character/Animation/FrontierCharacterAnimInstance.h"
#include "Character/Core/FrontierCharacterStateComponent.h"
#include "GameFramework/Character.h"
#include "GameFramework/CharacterMovementComponent.h"

void UFrontierCharacterAnimInstance::NativeUpdateAnimation(float DeltaSeconds)
{
    Super::NativeUpdateAnimation(DeltaSeconds);

    const ACharacter* Character = Cast<ACharacter>(TryGetPawnOwner());
    if (!Character) return;

    const UCharacterMovementComponent* Movement = Character->GetCharacterMovement();
    GroundSpeed = Movement ? Movement->Velocity.Size2D() : 0.0f;
    bIsGrounded = Movement && Movement->IsMovingOnGround();

    const UFrontierCharacterStateComponent* StateComponent =
        Character->FindComponentByClass<UFrontierCharacterStateComponent>();

    bIsSeated = StateComponent &&
        StateComponent->State.Mode == EFrontierCharacterMode::ShipControl;
    bIsMoving = GroundSpeed > 3.0f;
}
