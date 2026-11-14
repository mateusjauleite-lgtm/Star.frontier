#include "Character/HUD/FrontierCharacterHUDWidget.h"
#include "Character/Core/FrontierCharacter.h"
#include "Character/Interaction/FrontierInteractable.h"
#include "Ships/Core/FrontierShip.h"
#include "Ships/Interior/FrontierShipInteriorComponent.h"
#include "Ships/Interior/FrontierShipElevator.h"
#include "Components/CanvasPanel.h"
#include "Components/CanvasPanelSlot.h"
#include "Components/Border.h"
#include "Components/Button.h"
#include "Components/TextBlock.h"
#include "Blueprint/WidgetTree.h"
#include "GameFramework/PlayerController.h"
#include "Camera/CameraComponent.h"
#include "EngineUtils.h"
#include "Math/RotationMatrix.h"

namespace
{
    UButton* AddHUDButton(UCanvasPanel* Canvas, UWidgetTree* Tree, const TCHAR* Label,
        FVector2D Position, FVector2D Size, FAnchors Anchors)
    {
        UButton* Button = Tree->ConstructWidget<UButton>(UButton::StaticClass());
        UTextBlock* Text = Tree->ConstructWidget<UTextBlock>(UTextBlock::StaticClass());
        Text->SetText(FText::FromString(Label));
        Text->SetJustification(ETextJustify::Center);
        Button->AddChild(Text);
        UCanvasPanelSlot* Slot = Canvas->AddChildToCanvas(Button);
        Slot->SetAnchors(Anchors);
        Slot->SetPosition(Position);
        Slot->SetSize(Size);
        return Button;
    }
}

void UFrontierCharacterHUDWidget::NativeConstruct()
{
    Super::NativeConstruct();
    BuildNativeLayout();
}

void UFrontierCharacterHUDWidget::BuildNativeLayout()
{
    if (!WidgetTree || WidgetTree->RootWidget) return;
    UCanvasPanel* Canvas = WidgetTree->ConstructWidget<UCanvasPanel>(UCanvasPanel::StaticClass(), TEXT("CharacterHUDCanvas"));
    WidgetTree->RootWidget = Canvas;

    auto AddPad = [this, Canvas](FVector2D Position, FAnchors Anchors, const TCHAR* Label)
    {
        UBorder* Pad = WidgetTree->ConstructWidget<UBorder>();
        Pad->SetBrushColor(FLinearColor(0.04f, 0.12f, 0.18f, 0.34f));
        Pad->SetPadding(FMargin(8.0f));
        UTextBlock* Text = WidgetTree->ConstructWidget<UTextBlock>();
        Text->SetText(FText::FromString(Label));
        Text->SetJustification(ETextJustify::Center);
        Text->SetColorAndOpacity(FSlateColor(FLinearColor(0.65f, 0.88f, 0.96f, 0.9f)));
        Pad->SetContent(Text);
        Pad->SetVisibility(ESlateVisibility::HitTestInvisible);
        UCanvasPanelSlot* Slot = Canvas->AddChildToCanvas(Pad);
        Slot->SetAnchors(Anchors);
        Slot->SetPosition(Position);
        Slot->SetSize(FVector2D(176.0f, 176.0f));
    };
    AddPad(FVector2D(34.0f, -210.0f), FAnchors(0.0f, 1.0f, 0.0f, 1.0f), TEXT("MOVIMENTO"));
    AddPad(FVector2D(-210.0f, -210.0f), FAnchors(1.0f, 1.0f, 1.0f, 1.0f), TEXT("CÂMERA 360°"));

    const FAnchors BottomRight(1.0f, 1.0f, 1.0f, 1.0f);
    if (UButton* Jump = AddHUDButton(Canvas, WidgetTree, TEXT("PULO"), FVector2D(-300.0f, -118.0f), FVector2D(82.0f, 58.0f), BottomRight))
        Jump->OnClicked.AddDynamic(this, &UFrontierCharacterHUDWidget::OnJumpPressed);
    if (UButton* Action = AddHUDButton(Canvas, WidgetTree, TEXT("AÇÃO"), FVector2D(-205.0f, -118.0f), FVector2D(82.0f, 58.0f), BottomRight))
        Action->OnClicked.AddDynamic(this, &UFrontierCharacterHUDWidget::OnInteractPressed);

    const FAnchors BottomLeft(0.0f, 1.0f, 0.0f, 1.0f);
    if (UButton* Up = AddHUDButton(Canvas, WidgetTree, TEXT("↑"), FVector2D(72.0f, -278.0f), FVector2D(58.0f, 48.0f), BottomLeft))
        Up->OnClicked.AddDynamic(this, &UFrontierCharacterHUDWidget::OnElevatorUpPressed);
    if (UButton* Down = AddHUDButton(Canvas, WidgetTree, TEXT("↓"), FVector2D(72.0f, -98.0f), FVector2D(58.0f, 48.0f), BottomLeft))
        Down->OnClicked.AddDynamic(this, &UFrontierCharacterHUDWidget::OnElevatorDownPressed);
}

void UFrontierCharacterHUDWidget::NativeTick(const FGeometry& MyGeometry, float InDeltaTime)
{
    Super::NativeTick(MyGeometry, InDeltaTime);
    for (int32 Finger : MovementPointers)
    {
        const FVector2D* Origin = TouchOrigins.Find(Finger);
        const FVector2D* Current = CurrentTouchPositions.Find(Finger);
        if (Origin && Current)
        {
            const FVector2D Delta = *Current - *Origin;
            MoveCharacter(FVector2D(Delta.X / 85.0f, -Delta.Y / 85.0f).GetClampedToMaxSize(1.0f));
        }
    }
}

void UFrontierCharacterHUDWidget::ObserveCharacter(UFrontierCharacterStateComponent* CharacterState)
{
    if (ObservedState)
        ObservedState->OnStateChanged.RemoveDynamic(this, &UFrontierCharacterHUDWidget::HandleCharacterStateChanged);
    ObservedState = CharacterState;
    if (!ObservedState) return;
    ObservedState->OnStateChanged.AddDynamic(this, &UFrontierCharacterHUDWidget::HandleCharacterStateChanged);
    HandleCharacterStateChanged(ObservedState->State);
}

void UFrontierCharacterHUDWidget::HandleCharacterStateChanged(const FFrontierCharacterState& State)
{
    const bool bOnFoot = State.Mode == EFrontierCharacterMode::OnFoot;
    SetVisibility(bOnFoot ? ESlateVisibility::Visible : ESlateVisibility::Collapsed);
    RefreshCharacterHUD(State, bOnFoot);
}

void UFrontierCharacterHUDWidget::MoveCharacter(FVector2D Axis)
{
    AFrontierCharacter* Character = Cast<AFrontierCharacter>(GetOwningPlayerPawn());
    if (!Character || !Character->CharacterState || Character->CharacterState->State.Mode != EFrontierCharacterMode::OnFoot) return;
    Axis = Axis.GetClampedToMaxSize(1.0f);
    Character->CharacterState->SetMovementInput(Axis);
    if (!Character->Controller) return;
    const FRotator Yaw(0.0f, Character->Controller->GetControlRotation().Yaw, 0.0f);
    Character->AddMovementInput(FRotationMatrix(Yaw).GetUnitAxis(EAxis::X), Axis.Y);
    Character->AddMovementInput(FRotationMatrix(Yaw).GetUnitAxis(EAxis::Y), Axis.X);
}

void UFrontierCharacterHUDWidget::LookCharacter(FVector2D Axis)
{
    AFrontierCharacter* Character = Cast<AFrontierCharacter>(GetOwningPlayerPawn());
    if (!Character || !Character->CharacterState || Character->CharacterState->State.Mode != EFrontierCharacterMode::OnFoot) return;
    Character->CharacterState->SetLookInput(Axis);
    Character->AddControllerYawInput(Axis.X);
    Character->AddControllerPitchInput(Axis.Y);
}

void UFrontierCharacterHUDWidget::StopCharacterMovement()
{
    if (AFrontierCharacter* Character = Cast<AFrontierCharacter>(GetOwningPlayerPawn()))
        if (Character->CharacterState) Character->CharacterState->SetMovementInput(FVector2D::ZeroVector);
}

void UFrontierCharacterHUDWidget::JumpCharacter()
{
    if (AFrontierCharacter* Character = Cast<AFrontierCharacter>(GetOwningPlayerPawn()))
        if (Character->CharacterState && Character->CharacterState->State.Mode == EFrontierCharacterMode::OnFoot)
            Character->Jump();
}

void UFrontierCharacterHUDWidget::InteractCharacter()
{
    AFrontierCharacter* Character = Cast<AFrontierCharacter>(GetOwningPlayerPawn());
    if (!Character || !Character->CharacterState || Character->CharacterState->State.Mode != EFrontierCharacterMode::OnFoot || !Character->FollowCamera) return;
    const FVector Start = Character->FollowCamera->GetComponentLocation();
    const FVector End = Start + Character->FollowCamera->GetForwardVector() * 350.0f;
    FHitResult Hit;
    FCollisionQueryParams Params(SCENE_QUERY_STAT(CharacterHUDInteract), false, Character);
    if (!Character->GetWorld()->LineTraceSingleByChannel(Hit, Start, End, ECC_Visibility, Params)) return;
    AActor* Target = Hit.GetActor();
    if (Target && Target->GetClass()->ImplementsInterface(UFrontierInteractable::StaticClass()) &&
        IFrontierInteractable::Execute_CanBeInteractedWith(Target, Character))
    {
        Character->CharacterState->SetInteractionTarget(Target->GetFName());
        IFrontierInteractable::Execute_Interact(Target, Character);
    }
}

bool UFrontierCharacterHUDWidget::ElevatorUp()
{
    AFrontierCharacter* Character = Cast<AFrontierCharacter>(GetOwningPlayerPawn());
    if (!Character) return false;
    for (TActorIterator<AFrontierShip> It(Character->GetWorld()); It; ++It)
    {
        AFrontierShip* Ship = *It;
        if (Ship->Interior && Ship->Interior->ElevatorActor &&
            FVector::DistSquared(Ship->Interior->ElevatorActor->GetActorLocation(), Character->GetActorLocation()) < FMath::Square(1200.0f))
            return Ship->Interior->ElevatorActor->MoveUp(Character);
    }
    return false;
}

bool UFrontierCharacterHUDWidget::ElevatorDown()
{
    AFrontierCharacter* Character = Cast<AFrontierCharacter>(GetOwningPlayerPawn());
    if (!Character) return false;
    for (TActorIterator<AFrontierShip> It(Character->GetWorld()); It; ++It)
    {
        AFrontierShip* Ship = *It;
        if (Ship->Interior && Ship->Interior->ElevatorActor &&
            FVector::DistSquared(Ship->Interior->ElevatorActor->GetActorLocation(), Character->GetActorLocation()) < FMath::Square(1200.0f))
            return Ship->Interior->ElevatorActor->MoveDown(Character);
    }
    return false;
}

void UFrontierCharacterHUDWidget::OnJumpPressed() { JumpCharacter(); }
void UFrontierCharacterHUDWidget::OnInteractPressed() { InteractCharacter(); }
void UFrontierCharacterHUDWidget::OnElevatorUpPressed() { ElevatorUp(); }
void UFrontierCharacterHUDWidget::OnElevatorDownPressed() { ElevatorDown(); }

FReply UFrontierCharacterHUDWidget::NativeOnTouchStarted(const FGeometry& Geometry, const FPointerEvent& Event)
{
    const FVector2D Local = Geometry.AbsoluteToLocal(Event.GetScreenSpacePosition());
    const int32 Finger = Event.GetPointerIndex();
    TouchOrigins.Add(Finger, Local);
    CurrentTouchPositions.Add(Finger, Local);
    LastTouchPositions.Add(Finger, Local);
    if (Local.X < Geometry.GetLocalSize().X * 0.5f) MovementPointers.Add(Finger);
    else LookPointers.Add(Finger);
    return FReply::Handled();
}

FReply UFrontierCharacterHUDWidget::NativeOnTouchMoved(const FGeometry& Geometry, const FPointerEvent& Event)
{
    const int32 Finger = Event.GetPointerIndex();
    const FVector2D* Origin = TouchOrigins.Find(Finger);
    if (!Origin) return FReply::Unhandled();
    const FVector2D Local = Geometry.AbsoluteToLocal(Event.GetScreenSpacePosition());
    CurrentTouchPositions.Add(Finger, Local);
    const FVector2D* Previous = LastTouchPositions.Find(Finger);
    if (LookPointers.Contains(Finger) && Previous)
        LookCharacter(FVector2D(Local.X - Previous->X, Previous->Y - Local.Y) * 0.012f);
    LastTouchPositions.Add(Finger, Local);
    return FReply::Handled();
}

FReply UFrontierCharacterHUDWidget::NativeOnTouchEnded(const FGeometry& Geometry, const FPointerEvent& Event)
{
    const int32 Finger = Event.GetPointerIndex();
    if (MovementPointers.Contains(Finger)) StopCharacterMovement();
    if (LookPointers.Contains(Finger)) LookCharacter(FVector2D::ZeroVector);
    TouchOrigins.Remove(Finger);
    CurrentTouchPositions.Remove(Finger);
    LastTouchPositions.Remove(Finger);
    MovementPointers.Remove(Finger);
    LookPointers.Remove(Finger);
    return FReply::Handled();
}
