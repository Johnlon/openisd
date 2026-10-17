# BUG: no way back to the automatic skin; number steppers follow the saved choice, not the skin shown

Status: OPEN
Found: 2026-10-17, back-door removal 1 (bob)

## Symptom
- There are two things, the skin that is shown and the saved "phone-friendly layout" choice. The skin follows the window width unless the choice is saved; the number step buttons act as on a phone only when the choice is saved or the pointer is touch.
- A phone-sized window with a mouse shows the mobile skin, but ▲▼ keep focus in the box (desktop behaviour).
- Once a user picks "Switch to Mobile view" or "Switch to Desktop view", the choice is saved and the skin no longer follows the window. No control returns it to automatic.

## Why it matters to the tests
- A spec that needs the saved choice cannot undo it through the UI, so it plants it on a fresh page only, and a spec that reloads the shared page must not use it.

## Fix wanted
- A "Follow window size" entry beside the two switch entries, or Options setting, that clears the saved choice.
- Decide with John whether ▲▼ should follow the skin shown.
