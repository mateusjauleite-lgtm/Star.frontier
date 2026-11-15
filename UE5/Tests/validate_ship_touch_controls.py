"""Static preflight checks for UE5 ship mobile touch controls.

Run from the repository root with:
    python UE5/Tests/validate_ship_touch_controls.py

This checks source-level wiring only. It does not compile Unreal, launch the
Editor, simulate Slate multi-touch, or validate an Android device/APK.
"""
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[2]
HUD_H = ROOT / "UE5/Source/Frontier/Public/Ships/HUD/FrontierShipHUDWidget.h"
HUD_CPP = ROOT / "UE5/Source/Frontier/Private/Ships/HUD/FrontierShipHUDWidget.cpp"
SHIP_CPP = ROOT / "UE5/Source/Frontier/Private/Ships/Core/FrontierShip.cpp"
CONTROLS_CPP = ROOT / "UE5/Source/Frontier/Private/Ships/Controls/FrontierShipControlsComponent.cpp"
DOCS = ROOT / "UE5/Docs/HUD_CONTROLS_MIGRATION.md"


def check(condition, message):
    if not condition:
        raise AssertionError(message)
    print("[PASS] " + message)


def main():
    for path in (HUD_H, HUD_CPP, SHIP_CPP, CONTROLS_CPP, DOCS):
        check(path.is_file(), path.relative_to(ROOT).as_posix() + " exists")

    header = HUD_H.read_text(encoding="utf-8")
    hud = HUD_CPP.read_text(encoding="utf-8")
    ship = SHIP_CPP.read_text(encoding="utf-8")
    controls = CONTROLS_CPP.read_text(encoding="utf-8")
    docs = DOCS.read_text(encoding="utf-8")

    check("TouchPositions" in header and "ApplyTouchInputs" in header,
          "HUD declares per-pointer position state and combined axis update")
    check("TouchPositions.Add(Finger, Local)" in hud,
          "touch start records each finger's independent position")
    check("TouchPositions.Add(Finger, Geometry.AbsoluteToLocal" in hud,
          "touch move updates only the matching finger")
    check("ThrottleDelta / static_cast<float>(ThrottleCount)" in hud
          and "SteeringDelta / static_cast<float>(SteeringCount)" in hud,
          "active throttle and steering pointers are aggregated independently")
    check("ReleaseTouchPointer(Event.GetPointerIndex())" in hud
          and "ApplyTouchInputs();" in hud,
          "finger release recomputes remaining pointers instead of blindly zeroing an axis")
    check("ApplicationWillDeactivateDelegate.AddUObject" in hud
          and "ApplicationWillEnterBackgroundDelegate.AddUObject" in hud
          and "ClearFlightInput();" in hud,
          "application interruption clears held flight and button input")
    check("ApplicationWillDeactivateDelegate.RemoveAll(this)" in hud
          and "ApplicationWillEnterBackgroundDelegate.RemoveAll(this)" in hud,
          "application delegates are unbound during HUD teardown")
    check("ObservedShip->IsPiloted()" in hud,
          "HUD input entry points are gated by active pilot state")
    check("CanAcceptInput() const" in controls and "Ship->IsPiloted()" in controls,
          "ship controls component independently rejects input outside piloting")
    check("FInputModeGameAndUI InputMode;" in ship
          and "InputMode.SetWidgetToFocus(ShipHUD->TakeWidget())" in ship,
          "pilot entry enables UMG input and focuses the ship HUD")
    check("FInputModeGameOnly InputMode;" in ship
          and "PC->SetInputMode(InputMode);" in ship,
          "pilot exit restores gameplay-only input routing")
    check("PC->SetViewTarget(Character)" in ship
          and "Character->LeaveShipControlMode()" in ship,
          "pilot exit restores character view and on-foot state")
    check("independently" in docs and "ApplicationWillDeactivateDelegate" in docs,
          "migration documentation describes multi-touch and interruption cleanup")

    source_paths = (
        ROOT / "UE5/Source/Frontier/Private/Ships/HUD/FrontierShipHUDWidget.cpp",
        ROOT / "UE5/Source/Frontier/Private/Ships/Core/FrontierShip.cpp",
        ROOT / "UE5/Source/Frontier/Private/Ships/Controls/FrontierShipControlsComponent.cpp",
    )
    for path in source_paths:
        source = path.read_text(encoding="utf-8").lower()
        check("three.js" not in source and "three/" not in source,
              path.name + " has no Three.js runtime dependency")

    print("\nStatic ship touch-control preflight passed.")
    print("UE 5.8 compilation, Editor interaction, and Android device/APK validation remain required.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (AssertionError, OSError) as error:
        print("[FAIL] " + str(error), file=sys.stderr)
        sys.exit(1)
