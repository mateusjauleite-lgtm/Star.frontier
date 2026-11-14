#include "Ships/PlayerShip/FrontierPlayerShipSubsystem.h"
#include "Ships/Core/FrontierShip.h"

void UFrontierPlayerShipSubsystem::SetPlayerShip(AFrontierShip* Ship)
{
    CurrentPlayerShip = Ship;
}

void UFrontierPlayerShipSubsystem::ClearPlayerShip()
{
    CurrentPlayerShip = nullptr;
}
