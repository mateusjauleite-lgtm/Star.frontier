#include "Main/FrontierGameMode.h"
#include "Main/FrontierPlayerController.h"

#include "Character/Core/FrontierCharacter.h"
#include "Ships/Core/FrontierShip.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"

AFrontierGameMode::AFrontierGameMode()
{
    PlayerControllerClass = AFrontierPlayerController::StaticClass();
    DefaultPawnClass = AFrontierCharacter::StaticClass();
    StartingShipClass = AFrontierShip::StaticClass();
    StartingDeckCode = TEXT("D1");
}

void AFrontierGameMode::BeginPlay()
{
    Super::BeginPlay();
    EnsureStartingShip();
}

void AFrontierGameMode::EnsureStartingShip()
{
    if (!bSpawnStartingShip || IsValid(StartingShip) || !GetWorld())
    {
        return;
    }

    const TSubclassOf<AFrontierShip> ShipClass =
        StartingShipClass ? StartingShipClass : AFrontierShip::StaticClass();

    FActorSpawnParameters SpawnParameters;
    SpawnParameters.SpawnCollisionHandlingOverride =
        ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    SpawnParameters.Name = TEXT("StarFrontier_PlayerExplorationShip");

    StartingShip = GetWorld()->SpawnActor<AFrontierShip>(
        ShipClass,
        StartingShipTransform,
        SpawnParameters);
}

void AFrontierGameMode::HandleStartingNewPlayer_Implementation(
    APlayerController* NewPlayer)
{
    EnsureStartingShip();

    Super::HandleStartingNewPlayer_Implementation(NewPlayer);

    PlacePlayerOnStartingDeck(NewPlayer);
}

void AFrontierGameMode::PlacePlayerOnStartingDeck(APlayerController* NewPlayer)
{
    if (!IsValid(NewPlayer) || !IsValid(StartingShip))
    {
        return;
    }

    AFrontierCharacter* Character =
        Cast<AFrontierCharacter>(NewPlayer->GetPawn());

    if (!Character)
    {
        return;
    }

    StartingShip->PlaceCharacterOnDeck(Character, StartingDeckCode);
}
