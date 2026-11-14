#include "Worlds/Planetary/Core/PlanetaryProfileDataAsset.h"

bool UPlanetaryProfileDataAsset::IsProfileValid() const
{
    return Identity.BodyId != NAME_None && Dimensions.IsValid();
}
