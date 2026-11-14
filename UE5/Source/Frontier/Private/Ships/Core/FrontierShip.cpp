#include "Ships/Core/FrontierShip.h"
#include "Ships/Controls/FrontierShipControlsComponent.h"
#include "Ships/Engines/FrontierShipEngineComponent.h"
#include "Ships/Interior/FrontierShipInteriorComponent.h"
#include "Ships/Computer/FrontierShipComputerComponent.h"
#include "Ships/Camera/FrontierShipCameraBoom.h"
#include "Ships/Exploration/FrontierShipExplorationHullComponent.h"
#include "Ships/PlayerShip/FrontierPlayerShipSubsystem.h"
#include "Character/Core/FrontierCharacter.h"
#include "GameFramework/PlayerController.h"
#include "Components/BoxComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/SceneComponent.h"

AFrontierShip::AFrontierShip()
{
    PrimaryActorTick.bCanEverTick = true;

    CollisionRoot = CreateDefaultSubobject<UBoxComponent>(TEXT("ShipCollisionRoot"));
    SetRootComponent(CollisionRoot);
    CollisionRoot->SetBoxExtent(CollisionHalfExtent);
    CollisionRoot->SetMobility(EComponentMobility::Movable);
    CollisionRoot->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
    CollisionRoot->SetCollisionObjectType(ECC_WorldDynamic);
    CollisionRoot->SetCollisionResponseToAllChannels(ECR_Block);
    // Interior characters and interaction traces must remain usable while inside the ship.
    CollisionRoot->SetCollisionResponseToChannel(ECC_Pawn, ECR_Ignore);
    CollisionRoot->SetCollisionResponseToChannel(ECC_Visibility, ECR_Ignore);
    CollisionRoot->SetCollisionResponseToChannel(ECC_Camera, ECR_Ignore);

    ShipRoot = CreateDefaultSubobject<USceneComponent>(TEXT("ShipRoot"));
    ShipRoot->SetupAttachment(CollisionRoot);

    Controls = CreateDefaultSubobject<UFrontierShipControlsComponent>(TEXT("ShipControls"));
    Engines = CreateDefaultSubobject<UFrontierShipEngineComponent>(TEXT("ShipEngines"));
    Interior = CreateDefaultSubobject<UFrontierShipInteriorComponent>(TEXT("ShipInterior"));
    Computer = CreateDefaultSubobject<UFrontierShipComputerComponent>(TEXT("ShipComputer"));
    ShipCamera = CreateDefaultSubobject<UFrontierShipCameraBoom>(TEXT("ShipCameraBoom"));
    ShipCamera->SetupAttachment(ShipRoot);
    ExplorationHull = CreateDefaultSubobject<UFrontierShipExplorationHullComponent>(TEXT("ExplorationHull"));
    ExplorationHull->SetupAttachment(ShipRoot);
}

FVector AFrontierShip::ThreeToUnrealLocalPosition(const FVector& ThreePosition)
{
    // Three.js source: Y-up, Z-forward. UE5: Z-up, X-forward. Source units are metres.
    constexpr float CentimetresPerSourceUnit = 100.0f;
    return FVector(-ThreePosition.Z, ThreePosition.X, ThreePosition.Y) * CentimetresPerSourceUnit;
}

void AFrontierShip::AssignCommander(FName NewCommanderId)
{
    Identity.CommanderId = NewCommanderId;
    OnIdentityChanged.Broadcast(Identity.ShipId, Identity.CommanderId);
}

bool AFrontierShip::PlaceCharacterOnDeck(AFrontierCharacter* Character, FName DeckCode)
{
    if (!Character) return false;

    FVector LegacyPosition;
    if (DeckCode == TEXT("D1")) LegacyPosition = FVector(0.0f, 8.91f, -25.5f);
    else if (DeckCode == TEXT("D2")) LegacyPosition = FVector(0.0f, 3.13f, 25.0f);
    else if (DeckCode == TEXT("D3")) LegacyPosition = FVector(0.0f, -2.67f, 25.0f);
    else if (DeckCode == TEXT("D4")) LegacyPosition = FVector(0.0f, -8.47f, 25.0f);
    else return false;

    Character->AttachToActor(this, FAttachmentTransformRules::KeepWorldTransform);
    Character->SetActorRelativeLocation(ThreeToUnrealLocalPosition(LegacyPosition));
    Character->GetCapsuleComponent()->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
    return true;
}

void AFrontierShip::BeginPiloting(AFrontierCharacter* Character, FName NewCommanderId)
{
    if (!Character || (ActivePilot.IsValid() && ActivePilot.Get() != Character)) return;

    ActivePilot = Character;
    AssignCommander(NewCommanderId);
    Character->EnterShipControlMode();
    Character->AttachToActor(this, FAttachmentTransformRules::KeepWorldTransform);
    Character->SetActorRelativeLocation(ThreeToUnrealLocalPosition(FVector(0.0f, 8.91f, -29.5f)));
    Character->GetCapsuleComponent()->SetCollisionEnabled(ECollisionEnabled::NoCollision);

    if (UWorld* World = GetWorld())
        if (UFrontierPlayerShipSubsystem* PlayerShip = World->GetSubsystem<UFrontierPlayerShipSubsystem>())
            PlayerShip->SetPlayerShip(this);

    if (APlayerController* PC = Cast<APlayerController>(Character->GetController()))
        PC->SetViewTarget(this);
}

bool AFrontierShip::RequestPilotExit(AActor* RequestingActor)
{
    if (!RequestingActor || ActivePilot.Get() != RequestingActor) return false;
    EndPiloting();
    return true;
}

void AFrontierShip::EndPiloting()
{
    AFrontierCharacter* Character = ActivePilot.Get();
    if (Character)
    {
        if (APlayerController* PC = Cast<APlayerController>(Character->GetController()))
            PC->SetViewTarget(Character);

        Character->SetActorRelativeLocation(ThreeToUnrealLocalPosition(FVector(0.0f, 8.91f, -25.5f)));
        Character->GetCapsuleComponent()->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
        Character->LeaveShipControlMode();
    }

    ActivePilot.Reset();
    if (UWorld* World = GetWorld())
        if (UFrontierPlayerShipSubsystem* PlayerShip = World->GetSubsystem<UFrontierPlayerShipSubsystem>())
            if (PlayerShip->GetPlayerShip() == this) PlayerShip->ClearPlayerShip();

    ClearFlightInputs();
}

void AFrontierShip::SetFlightInputs(
    float NewThrottle, float NewPitch, float NewYaw, bool bNewBraking, bool bNewBoosting)
{
    FlightState.Throttle = FMath::Clamp(NewThrottle, -1.0f, 1.0f);
    FlightState.PitchInput = FMath::Clamp(NewPitch, -1.0f, 1.0f);
    FlightState.YawInput = FMath::Clamp(NewYaw, -1.0f, 1.0f);
    FlightState.bBraking = bNewBraking;
    FlightState.bBoosting = bNewBoosting;
    OnFlightStateChanged.Broadcast(FlightState);
}

void AFrontierShip::ClearFlightInputs()
{
    SetFlightInputs(0.0f, 0.0f, 0.0f, false, false);
}

void AFrontierShip::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    if (FMath::Abs(FlightState.Throttle) > KINDA_SMALL_NUMBER)
        TravelDirectionSign = FMath::Sign(FlightState.Throttle);

    const FRotator RotationDelta(
        FlightState.PitchInput * PitchRateDegrees * DeltaSeconds,
        FlightState.YawInput * YawRateDegrees * DeltaSeconds,
        0.0f);
    AddActorLocalRotation(RotationDelta, true);

    if (Engines)
    {
        FlightState.SpeedCmPerSecond = Engines->GetCurrentSpeedCmPerSecond();
        const float TravelDistance = FlightState.SpeedCmPerSecond * TravelDirectionSign * DeltaSeconds;
        AddActorLocalOffset(FVector(TravelDistance, 0.0f, 0.0f), true);
        OnFlightStateChanged.Broadcast(FlightState);
    }
}
