#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "FrontierGameMode.generated.h"

class AFrontierCharacter;
class AFrontierShip;

/**
 * Main Core entry point for a Star Frontier world.
 *
 * The Unreal Engine startup splash is handled by the engine/project settings.
 * This GameMode takes over after the initial world has loaded: it creates the
 * configured player ship and places the newly spawned character on its
 * configured starting deck.
 */
UCLASS(Blueprintable)
class FRONTIER_API AFrontierGameMode : public AGameModeBase
{
    GENERATED_BODY()

public:
    AFrontierGameMode();

    /** Ship class to create when the game world starts. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Main|Startup")
    TSubclassOf<AFrontierShip> StartingShipClass;

    /** World transform used for the initial exploration ship. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Main|Startup")
    FTransform StartingShipTransform = FTransform::Identity;

    /** Deck where the player character is placed after possession. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Main|Startup")
    FName StartingDeckCode = TEXT("D1");

    /** Allows menu/test maps to opt out of automatic ship creation. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Main|Startup")
    bool bSpawnStartingShip = true;

    UPROPERTY(Transient, BlueprintReadOnly, Category="Main|Runtime")
    TObjectPtr<AFrontierShip> StartingShip;

protected:
    virtual void BeginPlay() override;
    virtual void HandleStartingNewPlayer_Implementation(APlayerController* NewPlayer) override;

private:
    void EnsureStartingShip();
    void PlacePlayerOnStartingDeck(APlayerController* NewPlayer);
};
