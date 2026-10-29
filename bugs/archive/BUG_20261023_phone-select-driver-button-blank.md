# BUG_20261023_phone-select-driver-button-blank

**Status:** FIXED (T575)

## Symptom
John, 23 Oct 2026: "missing button label on the drive tab mobile". On the phone Driver tab the blue "Select driver" button shows no text: it is a white button with white text. The same happens to "Select passive radiator" on the Box tab of a passive-radiator project. Only the blue (primary) buttons in a button row are blank; the outlined ones (Edit, Save to library) read fine.

## Cause
The button row rule `.mob-classic .mob-cbtns button` in `packages/ui/src/style.css` paints every button in the row white. It is more specific than `.mob-btn-primary`, so the white background wins while the primary's white text stays: white on white.

## Fix
The row rule skips buttons that are `.mob-btn` (`button:not(.mob-btn)`), so the one phone button style (`.mob-btn`, `-primary`, `-secondary`) draws them. The desktop skin has no such button (it has its own Select driver control), so nothing to change there.

## Verification
`bash scripts/test.sh packages/ui/test/ui/mobile-driver-tab.browser.spec.ts` ("Select driver button text is visible against its background").
