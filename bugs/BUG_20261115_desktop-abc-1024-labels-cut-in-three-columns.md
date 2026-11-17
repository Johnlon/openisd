# At a 1024 px window the ABC Box tab cuts the labels "Tuning freq (Fb)" and "1st port resonance" and the End Correction text

Found 15 Nov 2026 while fixing the three ABC columns that ran past the pane (T800, `abc-vent-columns-fit.browser.spec.ts`). Rows were 540 px wide each since T742 (the count field and its Round/Slotted toggle ask for 266 px), so the second and third columns sat outside the pane. They now share the pane (226 px each) and the toggle takes its own line.

What is still cut at 1024 x 768 (the pane is 687 px; the container rule in `OriginalShell.vue` gives each label 74 px): the labels "Tuning freq (Fb)" and "1st port resonance" show as "Tuning freq (F" and "1st port resona", and the End Correction pick shows "1 flange (0.732" of its text. The spec checks only controls against the pane and a label's own overflow, so it does not see an ellipsis clip.

Field layout rule 2 (nothing clipped): fix, then make the spec read text the box cuts.
