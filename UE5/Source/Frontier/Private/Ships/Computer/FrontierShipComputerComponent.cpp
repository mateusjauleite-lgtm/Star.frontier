#include "Ships/Computer/FrontierShipComputerComponent.h"
#include "Ships/Core/FrontierShip.h"
#include "Ships/Engines/FrontierShipEngineComponent.h"

UFrontierShipComputerComponent::UFrontierShipComputerComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
    Systems = {
        { TEXT("navigation"), FText::FromString(TEXT("Navegação")), TEXT("standby") },
        { TEXT("sensors"), FText::FromString(TEXT("Sensores")), TEXT("standby") },
        { TEXT("power"), FText::FromString(TEXT("Energia e recursos")), TEXT("standby") }
    };
}

void UFrontierShipComputerComponent::Boot()
{
    bOnline = true;
    for (FFrontierShipComputerSystemStatus& System : Systems)
        System.Status = TEXT("online");
}

void UFrontierShipComputerComponent::Shutdown()
{
    ActiveTerminalId = NAME_None;
    bOnline = false;
    for (FFrontierShipComputerSystemStatus& System : Systems)
        System.Status = TEXT("standby");
}

bool UFrontierShipComputerComponent::ConnectTerminal(FName TerminalId, FName OperatorId)
{
    if (!bOnline || TerminalId.IsNone() || OperatorId.IsNone()) return false;
    if (!ActiveTerminalId.IsNone() && ActiveTerminalId != TerminalId) return false;
    ActiveTerminalId = TerminalId;
    return true;
}

void UFrontierShipComputerComponent::DisconnectTerminal(FName TerminalId)
{
    if (ActiveTerminalId == TerminalId) ActiveTerminalId = NAME_None;
}

bool UFrontierShipComputerComponent::IsTerminalConnected(FName TerminalId) const
{
    return bOnline && ActiveTerminalId == TerminalId;
}

bool UFrontierShipComputerComponent::GetNavigationTelemetry(
    FVector& OutLocation, FRotator& OutRotation, float& OutSpeed) const
{
    const AFrontierShip* Ship = Cast<AFrontierShip>(GetOwner());
    if (!bOnline || !Ship || !Ship->Engines) return false;
    OutLocation = Ship->GetActorLocation();
    OutRotation = Ship->GetActorRotation();
    OutSpeed = Ship->Engines->GetCurrentSpeedCmPerSecond();
    return true;
}
