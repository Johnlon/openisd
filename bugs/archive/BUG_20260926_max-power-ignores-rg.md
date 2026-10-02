# BUG_20260926_max-power-ignores-rg

**Status:** RESOLVED

## Symptom

With Rg set, OpenISD's max power is (Re+Rg)/Re too high where Xmax limits it, and its max SPL
is 10·log10((Re+Rg)/Re) too low where Pe limits it. W5-1138SMF, Rg 0.1: +2.94 % and −0.126 dB.

## Evidence

Fresh capture `winisd_research/runs/sweep-w5-sealed-fresh-20260926`; WinISD's max power is
P·(Xmax/x)² capped at Pe, with P the power into Re + Rg (`toys/w5_fresh_model_check.py`, 2e-15).

## Cause

There are two power references, the drive solve's and `maxCurves`'. The drive solve uses
Re + Rs, `maxCurves` uses Re. We need Re + Rs in both.

## Fix

`sweep.ts` `maxCurves`: the power reference is `Re_terminal + Rs`.

## Verification

`winisdDriverModel.test.ts`: max power at 1 Hz is WinISD's 21.254886 W; max SPL at 3.909 Hz is
WinISD's 45.221447 dB (both red before).
