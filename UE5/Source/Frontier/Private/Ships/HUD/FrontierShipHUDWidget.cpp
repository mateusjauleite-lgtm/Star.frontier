#include "Ships/HUD/FrontierShipHUDWidget.h"
#include "UI/FrontierUIStyle.h"
#include "Ships/Controls/FrontierShipControlsComponent.h"
#include "Character/Core/FrontierCharacter.h"
#include "Components/CanvasPanel.h"
#include "Components/CanvasPanelSlot.h"
#include "Components/Border.h"
#include "Components/Button.h"
#include "Components/TextBlock.h"
#include "Blueprint/WidgetTree.h"

namespace
{
    UButton* AddShipHUDButton(UCanvasPanel* Canvas, UWidgetTree* Tree, const TCHAR* Label,
        FVector2D Position, FVector2D Size, FAnchors Anchors)
    {
        UButton* Button = Tree->ConstructWidget<UButton>();
        UTextBlock* Text = Tree->ConstructWidget<UTextBlock>();
        Text->SetText(FText::FromString(Label));
        Text->SetJustification(ETextJustify::Center);
        Text->SetColorAndOpacity(FSlateColor(FFrontierUIStyle::Text()));
        Button->AddChild(Text);
        FFrontierUIStyle::ApplyButton(Button);
        UCanvasPanelSlot* Slot = Canvas->AddChildToCanvas(Button);
        Slot->SetAnchors(Anchors);
        Slot->SetPosition(Position);
        Slot->SetSize(Size);
        return Button;
    }
}

void UFrontierShipHUDWidget::NativeConstruct()
{
    Super::NativeConstruct();
    BuildNativeLayout();
}

void UFrontierShipHUDWidget::BuildNativeLayout()
{
    if (!WidgetTree || WidgetTree->RootWidget) return;
    UCanvasPanel* Canvas = WidgetTree->ConstructWidget<UCanvasPanel>(UCanvasPanel::StaticClass(), TEXT("ShipHUDCanvas"));
    WidgetTree->RootWidget = Canvas;

    auto AddPad = [this, Canvas](FVector2D Position, FAnchors Anchors, const TCHAR* Label)
    {
        UBorder* Pad = WidgetTree->ConstructWidget<UBorder>();
        Pad->SetBrushColor(FFrontierUIStyle::ControlSurface());
        UTextBlock* Text = WidgetTree->ConstructWidget<UTextBlock>();
        Text->SetText(FText::FromString(Label));
        Text->SetJustification(ETextJustify::Center);
        Text->SetColorAndOpacity(FSlateColor(FFrontierUIStyle::Primary()));
        Pad->SetContent(Text);
        Pad->SetVisibility(ESlateVisibility::HitTestInvisible);
        UCanvasPanelSlot* Slot = Canvas->AddChildToCanvas(Pad);
        Slot->SetAnchors(Anchors);
        Slot->SetPosition(Position);
        Slot->SetSize(FVector2D(176.0f, 176.0f));
    };
    AddPad(FVector2D(34.0f, -210.0f), FAnchors(0.0f, 1.0f, 0.0f, 1.0f), TEXT("THROTTLE"));
    AddPad(FVector2D(-210.0f, -210.0f), FAnchors(1.0f, 1.0f, 1.0f, 1.0f), TEXT("DIREÇÃO"));

    const FAnchors BR(1.0f, 1.0f, 1.0f, 1.0f);
    if (UButton* Boost = AddShipHUDButton(Canvas, WidgetTree, TEXT("IMPULSO"), FVector2D(-310.0f, -126.0f), FVector2D(88.0f, 58.0f), BR))
    {
        Boost->OnPressed.AddDynamic(this, &UFrontierShipHUDWidget::OnBoostPressed);
        Boost->OnReleased.AddDynamic(this, &UFrontierShipHUDWidget::OnBoostReleased);
    }
    if (UButton* Brake = AddShipHUDButton(Canvas, WidgetTree, TEXT("FREIO"), FVector2D(-210.0f, -126.0f), FVector2D(88.0f, 58.0f), BR))
    {
        Brake->OnPressed.AddDynamic(this, &UFrontierShipHUDWidget::OnBrakePressed);
        Brake->OnReleased.AddDynamic(this, &UFrontierShipHUDWidget::OnBrakeReleased);
    }
    if (UButton* Exit = AddShipHUDButton(Canvas, WidgetTree, TEXT("SAIR"), FVector2D(-110.0f, -126.0f), FVector2D(88.0f, 58.0f), BR))
        Exit->OnClicked.AddDynamic(this, &UFrontierShipHUDWidget::OnExitPressed);

}

void UFrontierShipHUDWidget::ObserveShip(AFrontierShip* Ship, AFrontierCharacter* Character)
{
    if (ObservedShip)
        ObservedShip->OnFlightStateChanged.RemoveDynamic(this, &UFrontierShipHUDWidget::HandleFlightStateChanged);
    ObservedShip = Ship;
    ObservedCharacter = Character;
    if (!ObservedShip)
    {
        RefreshShipHUD(FFrontierShipFlightState(), FText::GetEmpty(), false);
        return;
    }
    ObservedShip->OnFlightStateChanged.AddDynamic(this, &UFrontierShipHUDWidget::HandleFlightStateChanged);
    HandleFlightStateChanged(ObservedShip->FlightState);
}

void UFrontierShipHUDWidget::HandleFlightStateChanged(const FFrontierShipFlightState& State)
{
    const bool bPiloting = ObservedShip && ObservedShip->IsPiloted();
    SetVisibility(bPiloting ? ESlateVisibility::Visible : ESlateVisibility::Collapsed);
    RefreshShipHUD(State, bPiloting ? ObservedShip->Identity.DisplayName : FText::GetEmpty(), bPiloting);
}

void UFrontierShipHUDWidget::SetThrottleInput(float Value)
{
    if (ObservedShip && ObservedShip->IsPiloted() && ObservedShip->Controls)
        ObservedShip->Controls->SetThrottle(Value);
}
void UFrontierShipHUDWidget::SetSteeringInput(float Yaw, float Pitch)
{
    if (!ObservedShip || !ObservedShip->IsPiloted() || !ObservedShip->Controls) return;
    ObservedShip->Controls->SetYaw(Yaw);
    ObservedShip->Controls->SetPitch(Pitch);
}
void UFrontierShipHUDWidget::SetBrake(bool bPressed)
{
    if (ObservedShip && ObservedShip->IsPiloted() && ObservedShip->Controls) ObservedShip->Controls->SetBraking(bPressed);
}
void UFrontierShipHUDWidget::SetBoost(bool bPressed)
{
    if (ObservedShip && ObservedShip->IsPiloted() && ObservedShip->Controls) ObservedShip->Controls->SetBoosting(bPressed);
}
void UFrontierShipHUDWidget::ClearFlightInput()
{
    if (ObservedShip && ObservedShip->IsPiloted() && ObservedShip->Controls) ObservedShip->Controls->ClearControls();
}
void UFrontierShipHUDWidget::ExitPilotSeat()
{
    if (ObservedShip && ObservedShip->IsPiloted() && ObservedCharacter) ObservedShip->RequestPilotExit(ObservedCharacter);
}
void UFrontierShipHUDWidget::OnBoostPressed() { SetBoost(true); }
void UFrontierShipHUDWidget::OnBoostReleased() { SetBoost(false); }
void UFrontierShipHUDWidget::OnBrakePressed() { SetBrake(true); }
void UFrontierShipHUDWidget::OnBrakeReleased() { SetBrake(false); }
void UFrontierShipHUDWidget::OnExitPressed() { ExitPilotSeat(); }

FReply UFrontierShipHUDWidget::NativeOnTouchStarted(const FGeometry& Geometry, const FPointerEvent& Event)
{
    if (!ObservedShip || !ObservedShip->IsPiloted()) return FReply::Unhandled();
    const FVector2D Local = Geometry.AbsoluteToLocal(Event.GetScreenSpacePosition());
    const int32 Finger = Event.GetPointerIndex();
    TouchOrigins.Add(Finger, Local);
    if (Local.X < Geometry.GetLocalSize().X * 0.5f) ThrottlePointers.Add(Finger);
    else SteeringPointers.Add(Finger);
    return FReply::Handled();
}

FReply UFrontierShipHUDWidget::NativeOnTouchMoved(const FGeometry& Geometry, const FPointerEvent& Event)
{
    const int32 Finger = Event.GetPointerIndex();
    const FVector2D* Origin = TouchOrigins.Find(Finger);
    if (!Origin) return FReply::Unhandled();
    const FVector2D Local = Geometry.AbsoluteToLocal(Event.GetScreenSpacePosition());
    const FVector2D Delta = Local - *Origin;
    if (ThrottlePointers.Contains(Finger))
        SetThrottleInput(FMath::Clamp(-Delta.Y / 100.0f, -1.0f, 1.0f));
    else if (SteeringPointers.Contains(Finger))
        SetSteeringInput(FMath::Clamp(Delta.X / 100.0f, -1.0f, 1.0f), FMath::Clamp(-Delta.Y / 100.0f, -1.0f, 1.0f));
    return FReply::Handled();
}

void UFrontierShipHUDWidget::ReleaseTouchPointer(int32 Finger)
{
    if (ThrottlePointers.Contains(Finger)) SetThrottleInput(0.0f);
    if (SteeringPointers.Contains(Finger)) SetSteeringInput(0.0f, 0.0f);
    TouchOrigins.Remove(Finger);
    ThrottlePointers.Remove(Finger);
    SteeringPointers.Remove(Finger);
}

FReply UFrontierShipHUDWidget::NativeOnTouchEnded(const FGeometry& Geometry, const FPointerEvent& Event)
{
    ReleaseTouchPointer(Event.GetPointerIndex());
    return FReply::Handled();
}

FReply UFrontierShipHUDWidget::NativeOnTouchCancelled(const FGeometry& Geometry, const FPointerEvent& Event)
{
    ReleaseTouchPointer(Event.GetPointerIndex());
    return FReply::Handled();
}
