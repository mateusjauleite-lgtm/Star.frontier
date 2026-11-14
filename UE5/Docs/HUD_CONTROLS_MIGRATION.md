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

Native mobile layout is now constructed by the C++ widget at runtime; a separate Widget Blueprint is not required for the first usable pass. It draws left/right touch-pad areas, compact jump/action buttons, and contextual deck up/down buttons. The left touch area drives movement continuously while held; the right touch area applies relative camera yaw/pitch for 360-degree look. Jump and action buttons call their native methods directly. Elevator buttons appear only while the character is near a ship elevator.

The right touch area is the camera/mira control; do not bind it to ship steering while on foot. Character HUD remains separate from the seated pilot HUD.

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

The widget observes `OnFlightStateChanged` and calls `RefreshShipHUD(FlightState, ShipName, bVisible)`. Its native runtime layout provides left-side throttle and right-side steering touch zones, plus compact impulse, brake and exit buttons. Elevator navigation is deliberately kept on the on-foot HUD, not shown while seated.

The left touch area controls forward/reverse throttle; the right touch area controls yaw and pitch. Impulse and brake are hold buttons; exit returns control to the character. The ship HUD is created automatically when the player enters the pilot station and removed on exit.

## Deck and elevator behavior

The elevator keeps the existing four-stop order:
- D1 — command bridge.
- D2 — operations/science.
- D3 — engineering.
- D4 — hangar/support.

Up from D4 and down from D1 are blocked. The current deck is determined in the owning ship's local coordinate frame, not world height.

## Remaining validation

The native runtime layouts and input handlers are in the migration branch, and both HUD classes are used as defaults when no Blueprint subclass is assigned. Visual tuning against the actual mobile aspect ratio/safe areas, Unreal compilation, multiplayer ownership checks, and touch-device testing remain. Enhanced Input assets are still required for keyboard/controller parity. No Unreal compile or touch-device test has been performed yet.
