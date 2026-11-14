#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "FrontierShipComputerComponent.generated.h"

USTRUCT(BlueprintType)
struct FRONTIER_API FFrontierShipComputerSystemStatus
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FName SystemId;

    UPROPERTY(BlueprintReadOnly)
    FText DisplayName;

    UPROPERTY(BlueprintReadOnly)
    FName Status = TEXT("standby");
};

USTRUCT(BlueprintType)
struct FRONTIER_API FFrontierShipTelemetry
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FVector Location = FVector::ZeroVector;

    UPROPERTY(BlueprintReadOnly)
    FRotator Rotation = FRotator::ZeroRotator;

    UPROPERTY(BlueprintReadOnly)
    float SpeedCmPerSecond = 0.0f;
};

UCLASS(ClassGroup=(Frontier), BlueprintType, Blueprintable, meta=(BlueprintSpawnableComponent))
class FRONTIER_API UFrontierShipComputerComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UFrontierShipComputerComponent();

    UPROPERTY(BlueprintReadOnly, Category="Ship|Computer")
    bool bOnline = false;

    UPROPERTY(BlueprintReadOnly, Category="Ship|Computer")
    FName ActiveTerminalId = NAME_None;

    UPROPERTY(BlueprintReadOnly, Category="Ship|Computer")
    FName ActiveOperatorId = NAME_None;

    UPROPERTY(BlueprintReadOnly, Category="Ship|Computer")
    TArray<FFrontierShipComputerSystemStatus> Systems;

    UFUNCTION(BlueprintCallable, Category="Ship|Computer")
    void Boot();

    UFUNCTION(BlueprintCallable, Category="Ship|Computer")
    void Shutdown();

    UFUNCTION(BlueprintCallable, Category="Ship|Computer")
    void RegisterTerminal(FName TerminalId, const TArray<FName>& AllowedSystems);

    UFUNCTION(BlueprintCallable, Category="Ship|Computer")
    bool ConnectTerminal(FName TerminalId, FName OperatorId);

    UFUNCTION(BlueprintCallable, Category="Ship|Computer")
    void DisconnectTerminal(FName TerminalId);

    UFUNCTION(BlueprintCallable, Category="Ship|Computer")
    bool IsTerminalConnected(FName TerminalId) const;

    UFUNCTION(BlueprintCallable, Category="Ship|Computer")
    bool DispatchNavigationTelemetry(FName TerminalId, FFrontierShipTelemetry& OutTelemetry) const;

private:
    TMap<FName, TSet<FName>> TerminalPermissions;
};
