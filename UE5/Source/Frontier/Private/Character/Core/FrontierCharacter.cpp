#include "Character/Core/FrontierCharacter.h"
#include "Character/Core/FrontierCharacterStateComponent.h"
#include "Character/Camera/FrontierCharacterCameraBoom.h"
#include "Character/Input/FrontierCharacterInputConfig.h"
#include "Character/Movement/FrontierCharacterMovementComponent.h"
#include "Character/Model/FrontierCharacterPresentationData.h"
#include "Character/HUD/FrontierCharacterHUDWidget.h"
#include "Character/Interaction/FrontierInteractable.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Components/CapsuleComponent.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "InputActionValue.h"
#include "Engine/LocalPlayer.h"

AFrontierCharacter::AFrontierCharacter(const FObjectInitializer& ObjectInitializer)
    : Super(ObjectInitializer.SetDefaultSubobjectClass<UFrontierCharacterMovementComponent>(ACharacter::CharacterMovementComponentName))
{
    PrimaryActorTick.bCanEverTick = false;

    CharacterState = CreateDefaultSubobject<UFrontierCharacterStateComponent>(TEXT("CharacterState"));

    CameraBoom = CreateDefaultSubobject<UFrontierCharacterCameraBoom>(TEXT("CharacterCameraBoom"));
    CameraBoom->SetupAttachment(RootComponent);

    FollowCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("CharacterFollowCamera"));
    FollowCamera->SetupAttachment(CameraBoom, USpringArmComponent::SocketName);
    FollowCamera->bUsePawnControlRotation = false;

    bUseControllerRotationPitch = false;
    bUseControllerRotationYaw = false;
    bUseControllerRotationRoll = false;

    CharacterMovementBranch = Cast<UFrontierCharacterMovementComponent>(GetCharacterMovement());
}

void AFrontierCharacter::BeginPlay()
{
    Super::BeginPlay();
    ApplyPresentation();

    if (APlayerController* PC = Cast<APlayerController>(GetController()))
    {
        if (CharacterHUDClass)
        {
            CharacterHUD = CreateWidget<UFrontierCharacterHUDWidget>(PC, CharacterHUDClass);
            if (CharacterHUD)
            {
                CharacterHUD->AddToViewport();
                CharacterHUD->ObserveCharacter(CharacterState);
            }
        }
    }
}

void AFrontierCharacter::PawnClientRestart()
{
    Super::PawnClientRestart();

    APlayerController* PC = Cast<APlayerController>(GetController());
    ULocalPlayer* LocalPlayer = PC ? PC->GetLocalPlayer() : nullptr;
    UEnhancedInputLocalPlayerSubsystem* InputSubsystem = LocalPlayer
        ? LocalPlayer->GetSubsystem<UEnhancedInputLocalPlayerSubsystem>()
        : nullptr;

    if (InputSubsystem && InputConfig && InputConfig->MappingContext)
    {
        InputSubsystem->AddMappingContext(InputConfig->MappingContext, 0);
    }

    // PawnClientRestart runs after possession, so the widget receives a valid
    // owning PlayerController for mobile touch callbacks.
    if (PC && CharacterHUDClass && !CharacterHUD)
    {
        CharacterHUD = CreateWidget<UFrontierCharacterHUDWidget>(PC, CharacterHUDClass);
        if (CharacterHUD)
        {
            CharacterHUD->AddToViewport();
            CharacterHUD->ObserveCharacter(CharacterState);
        }
    }
}

void AFrontierCharacter::ApplyPresentation()
{
    if (!PresentationData) return;

    if (PresentationData->ExplorationSuitMesh)
    {
        GetMesh()->SetSkeletalMesh(PresentationData->ExplorationSuitMesh);
    }
    if (PresentationData->AnimationClass)
    {
        GetMesh()->SetAnimInstanceClass(PresentationData->AnimationClass);
    }
    for (int32 Index = 0; Index < PresentationData->SuitMaterials.Num(); ++Index)
    {
        GetMesh()->SetMaterial(Index, PresentationData->SuitMaterials[Index]);
    }
    GetCapsuleComponent()->SetCapsuleHalfHeight(PresentationData->CapsuleHalfHeightCm);
}

void AFrontierCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    Super::SetupPlayerInputComponent(PlayerInputComponent);

    UEnhancedInputComponent* EnhancedInput = Cast<UEnhancedInputComponent>(PlayerInputComponent);
    if (!EnhancedInput) return;

    if (InputConfig && InputConfig->Move)
        EnhancedInput->BindAction(InputConfig->Move, ETriggerEvent::Triggered, this, &AFrontierCharacter::Move);
    if (InputConfig && InputConfig->Look)
        EnhancedInput->BindAction(InputConfig->Look, ETriggerEvent::Triggered, this, &AFrontierCharacter::Look);
    if (InputConfig && InputConfig->Jump)
    {
        EnhancedInput->BindAction(InputConfig->Jump, ETriggerEvent::Started, this, &ACharacter::Jump);
        EnhancedInput->BindAction(InputConfig->Jump, ETriggerEvent::Completed, this, &ACharacter::StopJumping);
    }
    if (InputConfig && InputConfig->Interact)
        EnhancedInput->BindAction(InputConfig->Interact, ETriggerEvent::Started, this, &AFrontierCharacter::Interact);
}

void AFrontierCharacter::Move(const FInputActionValue& Value)
{
    if (!CharacterState || CharacterState->State.Mode != EFrontierCharacterMode::OnFoot) return;

    const FVector2D Input = Value.Get<FVector2D>();
    CharacterState->SetMovementInput(Input);

    if (!Controller) return;
    const FRotator YawRotation(0.0f, Controller->GetControlRotation().Yaw, 0.0f);
    AddMovementInput(FRotationMatrix(YawRotation).GetUnitAxis(EAxis::X), Input.Y);
    AddMovementInput(FRotationMatrix(YawRotation).GetUnitAxis(EAxis::Y), Input.X);
}

void AFrontierCharacter::Look(const FInputActionValue& Value)
{
    if (!CharacterState || CharacterState->State.Mode != EFrontierCharacterMode::OnFoot) return;

    const FVector2D Input = Value.Get<FVector2D>();
    CharacterState->SetLookInput(Input);
    AddControllerYawInput(Input.X);
    AddControllerPitchInput(Input.Y);
}

void AFrontierCharacter::Interact()
{
    if (!CharacterState || CharacterState->State.Mode != EFrontierCharacterMode::OnFoot) return;

    FHitResult Hit;
    const FVector Start = FollowCamera->GetComponentLocation();
    const FVector End = Start + FollowCamera->GetForwardVector() * 350.0f;
    FCollisionQueryParams Params(SCENE_QUERY_STAT(CharacterInteract), false, this);

    if (GetWorld()->LineTraceSingleByChannel(Hit, Start, End, ECC_Visibility, Params))
    {
        AActor* Target = Hit.GetActor();
        if (Target && Target->GetClass()->ImplementsInterface(UFrontierInteractable::StaticClass()))
        {
            if (IFrontierInteractable::Execute_CanBeInteractedWith(Target, this))
            {
                CharacterState->SetInteractionTarget(Target->GetFName());
                IFrontierInteractable::Execute_Interact(Target, this);
            }
        }
    }
}

void AFrontierCharacter::EnterShipControlMode()
{
    if (!CharacterState) return;
    CharacterState->SetMode(EFrontierCharacterMode::ShipControl);
    GetCharacterMovement()->StopMovementImmediately();
    GetCharacterMovement()->DisableMovement();
    CameraBoom->TargetArmLength = 0.0f;
}

void AFrontierCharacter::LeaveShipControlMode()
{
    if (!CharacterState) return;
    CharacterState->SetMode(EFrontierCharacterMode::OnFoot);
    GetCharacterMovement()->SetMovementMode(MOVE_Walking);
    CameraBoom->TargetArmLength = 320.0f;
}

void AFrontierCharacter::OnMovementModeChanged(
    EMovementMode PrevMovementMode, uint8 PreviousCustomMode)
{
    Super::OnMovementModeChanged(PrevMovementMode, PreviousCustomMode);
    if (CharacterState)
    {
        CharacterState->SetGrounded(GetCharacterMovement()->IsMovingOnGround());
    }
}
