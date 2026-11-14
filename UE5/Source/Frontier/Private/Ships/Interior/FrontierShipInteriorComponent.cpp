#include "Ships/Interior/FrontierShipInteriorComponent.h"
#include "Ships/Interior/FrontierShipDeckModule.h"
#include "Ships/Interior/FrontierShipDeckDefinition.h"

AFrontierShipDeckModule* UFrontierShipInteriorComponent::FindDeck(FName DeckCode) const
{
    for (AFrontierShipDeckModule* Deck : DeckModules)
        if (Deck && Deck->Definition && Deck->Definition->DeckCode == DeckCode)
            return Deck;
    return nullptr;
}
