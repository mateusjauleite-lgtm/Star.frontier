#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "FrontierPlayerShipSubsystem.generated.h"

class AFrontierShip;

UCLASS()
class FRONTIER_API UFrontierPlayerShipSubsystem : public UWorldSubsystem
{
    GENERATED_BODY()

public:
    UPROPERTY(BlueprintReadOnly, Category="Ship|PlayerShip")
    TObjectPtr<AFrontierShip> CurrentPlayerShip;

    UFUNCTION(BlueprintCallable, Category="Ship|PlayerShip")
    void SetPlayerShip(AFrontierShip* Ship);

    UFUNCTION(BlueprintCallable, Category="Ship|PlayerShip")
    AFrontierShip* GetPlayerShip() const { return CurrentPlayerShip; }

    UFUNCTION(BlueprintCallable, Category="Ship|PlayerShip")
    void ClearPlayerShip();
};
