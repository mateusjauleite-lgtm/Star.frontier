#include "Character/Camera/FrontierCharacterCameraBoom.h"

UFrontierCharacterCameraBoom::UFrontierCharacterCameraBoom()
{
    TargetArmLength = 320.0f;
    SocketOffset = FVector(0.0f, 48.0f, 62.0f);
    bUsePawnControlRotation = true;
    bEnableCameraLag = true;
    CameraLagSpeed = 12.0f;
    bDoCollisionTest = true;
    ProbeSize = 12.0f;
}
