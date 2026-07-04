# WinISD Driver Archive

This directory contains 1121 driver files extracted from the WinISD v7 distribution — these drivers are from **circa 2006 or earlier and are obsolete**.

## Why this folder exists

This is an archived snapshot of the driver database bundled with the last public WinISD release. It's kept here for:
- Historical reference
- Fallback lookups if a user has a very old design file
- Comparison against modern driver databases to identify legacy models

## Do not use for new designs

These drivers should **not** be used for new speaker designs. Most models are:
- Out of production
- No longer manufactured
- Superseded by newer generations
- From discontinued brands

## What's here

The archive includes ~1120 drivers spanning many brands (Seas, Peerless, Eminence, Tang Band, etc.), but the specific models are 15–25 years old. While some brand names are still active, their current product lines do not overlap with these archived models.

No exact driver matches exist between this archive and any of OpenISD's active driver sources (Parts Express, SB Acoustics, Scan-Speak, Wavecor, etc.).

## Using this folder

If you need a driver from this archive:
1. Copy the `.wdr` file to another directory
2. Validate the T/S parameters against the manufacturer datasheet (if available)
3. Do not trust the data without independent verification

For new work, use one of the curated driver sources listed in `drivers/sources.json`.
