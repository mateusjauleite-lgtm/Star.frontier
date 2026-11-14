# HUD and Touch Controls — UE5 Migration

## Ownership

The HUD is presentation and input routing only. Character Core owns on-foot character state; Ship Core owns ship identity, flight state and controls. The HUD must not duplicate simulation state.

## On-foot character HUD

Native class:
- `UFrontierCharacterHUDWidget` in `Source/Frontier/Character/HUD`.

It observes `UFrontierCharacterStateComponent::OnStateChanged` and calls `RefreshCharacterHUD(State, bVisible)`. The on-foot HUD is visible only when Character Core is in `OnFoot`; entering the pilot seat changes the state to `ShipControl` and hides it.

Blueprint-callable touch actions:
- `MoveCharacter(FVector2D Axis)`: normalized movement relative to controller yaw.
- `LookCharacter(FVector2D Axis)`: yaw/pitch camera input for the 360-degree look control.
- `StopCharacterMovement()`: releases the movement axis.
- `JumpCharacter()`: jump action.
- `InteractCharacter()`: camera-forward interaction trace through the existing interactable interface.

Recommended mobile UMG binding:
- Left virtual joystick `OnAnalogValueChanged` → `MoveCharacter`; release → `StopCharacterMovement`.
- Right virtual joystick `OnAnalogValueChanged` → `LookCharacter`; release → `LookCharacter(0,0)`.
- Jump button press → `JumpCharacter`.
- Action/interact button press → `InteractCharacter`.

The right stick is the camera/mira control; do not bind it to ship steering while on foot. Character HUD remains separate from the seated pilot HUD.

## Ship/pilot HUD

Native class:
- `UFrontierShipHUDWidget` in `Source/Frontier/Ships/HUD`.

The ship actor exposes `ShipHUDClass`. On successful pilot-seat entry, Ship Core creates the configured widget, calls `ObserveShip(Ship, Character)`, and adds it to the viewport. On pilot exit, the widget is removed and the flight controls are cleared.

Blueprint-callable ship actions:
- `SetThrottleInput(float)` → ship throttle.
- `SetSteeringInput(float Yaw, float Pitch)` → ship yaw and pitch.
- `SetBrake(bool)` → braking.
- `SetBoost(bool)` → boost.
- `ClearFlightInput()` → neutral flight controls.
- `ExitPilotSeat()` → requester-checked pilot exit.
- `ElevatorUp()` / `ElevatorDown()` → move the character between the four ship decks.

The widget observes `OnFlightStateChanged` and calls `RefreshShipHUD(FlightState, ShipName, bVisible)`.

Recommended mobile UMG binding:
- Throttle slider/joystick → `SetThrottleInput`.
- Right steering pad → `SetSteeringInput(Yaw, Pitch)`.
- Brake and boost buttons → press/release bool methods.
- Exit/leave pilot button → `ExitPilotSeat`.
- Deck up/down buttons → `ElevatorUp` and `ElevatorDown`.

## Deck and elevator behavior

The elevator keeps the existing four-stop order:
- D1 — command bridge.
- D2 — operations/science.
- D3 — engineering.
- D4 — hangar/support.

Up from D4 and down from D1 are blocked. The current deck is determined in the owning ship's local coordinate frame, not world height.

## Editor work still required

The C++ control endpoints and pilot-HUD lifecycle are in the migration branch. The actual visual UMG Widget Blueprints, touch joystick/button styling, anchors/safe zones, and assigned `CharacterHUDClass` / `ShipHUDClass` still need to be created in Unreal Editor. Enhanced Input assets are still required for keyboard/controller parity. No Unreal compile or touch-device test has been performed yet.
