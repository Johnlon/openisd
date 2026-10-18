# Advanced tab: Sound velocity and Air density cannot be typed

Status: open. Found by John on the Work Board (QO236), 18 Oct 2026.

## What is wrong

The Advanced tab (phone and desktop) shows Sound velocity (c) and Air density (ρ) as greyed
readonly readouts. The user cannot type either.

## What John ruled

17 Oct 2026 (project air model, "go"): the project holds five air fields, temperature, humidity,
pressure, c and ρ. Each is entered or calculated. A typed c or ρ pins and the solver back-calculates
a cleared temperature, humidity or pressure. A loaded .wpr puts its c and roo on the project as entered.

## Where it comes from

T361 (d3dcc245) made the two rows `UIFixedField ... readonly` before the five-field model (T375)
landed, and T375 did not make them editable. The engine side (T372 solver, T375 fields) already
supports a typed c or ρ.

## Fix

The two rows are ordinary editable fields with the E/C mark and the clear rule, like temperature,
humidity and pressure. A typed value pins; clearing it goes back to the calculated value.
Visual baselines for the Advanced tab are retaken.
