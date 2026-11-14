#include "Ships/Camera/FrontierShipCameraBoom.h"
#include "Camera/CameraComponent.h"

UFrontierShipCameraBoom::UFrontierShipCameraBoom()
{
    TargetArmLength = 620.0f;
    SocketOffset = FVector(0.0f, 130.0f, 90.0f);
    bUsePawnControlRotation = true;
    bEnableCameraLag = true;
    CameraLagSpeed = 5.0f;
    bDoCollisionTest = true;

    ShipCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("ShipCamera"));
    ShipCamera->SetupAttachment(this, USpringArmComponent::SocketName);
    ShipCamera->bUsePawnControlRotation = false;
}
