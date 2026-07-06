# Mock prompt log

Running, verbatim log of the user's prompts driving `mock/`. Kept per explicit
request — this is a prompt archive, not project documentation, so it does not
follow the "no history in docs" rule elsewhere in this repo.

---

Build me a mock/ dir in the root of this project that mocks up all the html and css to create a fake winisd based on the screen shots in docs/winisd and the app logic we have and MD files. Make it entirely logic free just the screens, fake realistic values, buttons and links with actions to take one to fake models or fake overlay transitions. Not calcs though and no need for reuse — just quick and dirty.

---

Constrain the mock to 1022x768

---

Constrain the mock to 1024x768

---

On driver editor parameters page line up the field in cols like the original / Voicecoils 1 is an input box with range 1..n.
On the dimensions view put the label to left of field like original and use the same speaker illustration used in the modern skin.
On the first tab General put the label above the field - look at the screen shot and mimic it.
Re 1024x768 I mean the page must render within the bounds of the browser frame - not scroll within it.

---

When selecting a graph type the drop down should dismiss when graph selected

---

Continue and the chart is overlapping the lower panel

---

(repeat) On driver editor parameters page line up the field in cols like the original / Voicecoils 1 is an input box with range 1..n.
On the dimensions view put the label to left of field like original and use the same speaker illustration used in the modern skin.
On the first tab General put the label above the field - look at the screen shot and mimic it.
Re 1024x768 I mean the page must render within the bounds of the browser frame - not scroll within it.

---

Mistake made - the bottom bar has now crossed across the entire width instead of being under the graph. The detail panel MUST be under the graph so the left nav can get full height

---

And also add this for a fix here - the filter popups need to have left aligned fields, check all panels to ensure fields are left aligned (eg signal, advanced, pr, vented etc et all them)
And the project list window inc the generator feature should have same height as the chart
Maybe...
To speed up thinking only consider this mock and the files in docs/winisd including docs/winisd/info files

---

In the real winisd the tablist ... driver/box/vents/filters etc thing is a narrow bottom left feature BUT for us it's ok if it's a bit wider - but fix the layout please the tablist needs to be bottom left quadrant

---

The tab panel and colour picker MUST fit onscreen without scrolling. Maybe make the tab panel on the left actually look like a book of tabs attached to the detail pane?

---

The project list should fill the remaining left side with the sig gen under it still

---

Just make the driver/box/filters etc into tab extensions of the details pane. DON'T LOOK AT OTHER FILES JUST DO THIS!!!!

---

Just make the driver/box/filters etc into tab extensions of the details pane. Look only at the 3 mock files!!! DON'T LOOK AT OTHER FILES JUST DO THIS!!!!

---

I like the tab look but the project tab and colour picker need to stay visible without scrolling
Btw make the page flow to meet the size of the browser pane again — no scrolling of content — as this is mimicking a fixed-width windows native app

---

GOOD STUFF

---

What are you working on still?

---

Put these and all other previous prompts from me into a new MOCK_PROMPTS.md file....

Editor popup:

The adv tab:

- Input field Mcost is pushed right and out of alignment - this is cos the label N/sqrt(W) is quite wide - so change layout so that the labels to the second col are pushed over to the right to make some space and fix the input field alignments.
- Also there is a massive gap between labels and field because you are fitting to width - don't fit to width as it looks stupid - all screens this isn't a good approach

Dimensions:

- The label should go to left of field not above
- Fix the image of the driver - use the svg we have from the main modern skinned app

General:

- Model and date added need to align to each other

All editor views - need to explain the buttons better

- Is save saving to a custom driver image or is it saving to the project or is it overwriting the driver in the common store?
- Need a reset button to reset to the original values - not just clear which presumably wipes it blank

All detail panes should have a what-if feature that allows hold and dragging a field left/right or down/up to explore alternative values - on the original app this was only possible on the box vol input field and in that case it wasn't what-if, it actually changed the project values, however I want the user to have to make a choice and so I want a distinct what-if mode that's visible on the top level toolbar as a status and an apply-to-project and an exit-whatif-mode that resets everything

Put spinners on all numeric fields where there is a possibility of reactive what-if updating of the charts - to support and prompt the what-if behaviour - spinners should spin exponentially

Do not use spinners where it is a modal where what-if is impossible

All screens - make the unit clickable so that it rotates through the units as previously defined.

All editor / whatif fields / to use the colour coding previously discussed to show what is calculated and which is N or E or error (out of range or impossible)

Standard vs isobaric:

- std - the drivers count is per driver and the label to the right of the input field is 'driver(s)'
- iso - the label is 'pairs'
- std mode shows a driver facing out on a baffle
- iso shows two drivers in clamshell alignment on a baffle (facing in not out)

ABC box type is ABC (Aperiodic Bi-Chamber)
The driver should be shown mounted on the baffle of the larger chamber - bottom one that also contains the label ABC

Keep this in the aforementioned MOCK_PROMPT file

---

Whats happening?

---

Put these and all other previous prompts from me into a new MOCK_PROMPTS.md file... Also new to read and update to the mock MD tracker design file.

Let align here is wrong:
Voice coil temp rise / 0.00 / K
Voice coil resistance TC / 3.9000 / 1000/K
Added mass to cone / 0.00000 / kg

Selecting multiple projects should show both sets of lines on charts. Currently highlighted project drives the tabbed detail sections and editors and what-its.

All tabs - the driver tab should show an illustration of the box - see the screenshots.

CHANGE TO WINISD?? Consider - is there space on the BOX panel to support integrating the supplementary vented/pr/nth order content onto right of the Box pane? Maybe with a vertical division line - and lose the distinct tab for those features? May also be advantageous for the what-if to have it all on one pane?

Driver editor allows 'Customise' which clones into a 'My Drivers' list that is also available for selection when changing the driver.
Driver editor save - cannot overwrite internal drivers - but can save a local wdr file - but I don't think local wpr can be automagically accessed by the SPA app can it? User would have to load the WDR. Of course it can save something volatile to local browser storage? And of course it can save into volatile project WPR storage. And we do need the toolbar save button to allow saving WPR to physical and internal storage - but I don't think it can auto load from physical, is that correct? Add these points and question to the MOCK app md file and respond to them.

IMPORTANT REALISATION: What-if is confused.

- All field edits are essentially what-if unless I hit save on the project button.
- Therefore what-if is actually 'Edit' after all.
- I think there should be a distinct Select driver button and Edit button on the detail pane.
  - Edit edits what's already in the project WPR model.
  - The select driver pane just populates the detached driver into the current WPR model, not the original WDR file and not into My Drivers.
    - Once selected for the project the user can then edit it if wanted - see prev bullet.
- Then Manage drivers on top nav allows related fn:
  - customise driver to my drivers
  - save as new
  - edit custom driver (not built in ones tho)
  - delete custom driver
  - disable custom driver (so doesn't appear in pickers)

Mock add filter isn't adding filters anymore.

Diff vs winisd -- filter view - keep +LP +HP etc - buttons on screen at bottom of pane or left side as there is space.

- Put filters in scrollable section above.
- Blue [x] next to each for active/inactive.
- Put a red 'x' or bin on each filter to delete.
- Put all the fields for the filters as editable spinners on that panel and ditch the popup — more reactive possible that way (maybe single, maybe multi).

---

continue building the mock - fix 3 4 and 5 and 6 7 8 first

(referring to the tracked task list: #14 exponential-accel spinners, #15
clickable unit labels, #16 ParState color coding consistently, #20 Manage
Drivers menu, #21 Filters tab redesign, #22 multi-project chart traces.)

---

you need to screen shot file://wsl.localhost/Ubuntu-22.04/home/john/work/winisd/openisd/mock/index.html and look at the chart - it is generally aligned and narrow

---

Change this button '✎ Edit\n♫ Tune' to Edit Project'

---

This is strange tro hace on then Box tab ...

passive radiator
(mock control — real WinISD sets this via the enclosure-type project setting)
Sealed
Ported
Passive Radiator

Under Passive Radiator we can chnge the type - seems it ought to be outside. Maybe move Box first above Driver and take that header Passive Radiator off and make the Box Type : [v Passive Radiator] etc?

---

Edit Project was better as Edit but it needs a hint or something so its clear you are editing the copy of the driver woithion the current project not an independent copy - but save would save an indep copy of whatever you have.

---

Driver Editor when invoked from rhe project as opposed tothe manage drivers - is editing the project embedded driect - make this clear in the UI

---

Editor popup from within the projet context

Heading : "Editing driver embeeded in current project..."
Buttons:
"Done" updates the driver copy embedded in the current project — not the original drived definition.
"Clone..." creates a new custom driver in My Drivers with whatever the current settings are on this editor and does not affect the current project.
"Select Driver" allows selection of an alternative driver definition from the database and My Drivers.
"Clear" sets all fields to default values"
"Cancel" dismisses the editir without any changes

---

Editor popup from tool bar - opens empty until a Load is made to load off disk or until a driver is selected
Therefore this modal has these buttons
Select Driver (from db) / Load driver (from disk) / Clone / Save as to disk / Save to My Drivers (internal) << suggested.
And special - Create Box ..

Also please add the additional box types and their specific tab and custom field values

---

lose thie ' — changes apply live to the project immediately; Done updates this copy.'

---

"Select driver" in the edotor should not instantl dismiss - driver shod not be actually activiated in the project unless done is selected

---

done should ne second from dight as its equove to ok

---

the clone button pops up a strange input dialog for the name - is that just a mock feature as Im eexpecting an more integrated method to ask gthe drive rname
if tune has been selected then it actually is a different optoion to edit aftwer all - and it leaves the current modell modified but not saved - we need an indicator or unsaved changes somewhere. eg the bar at the top of the detail pane has C N E onthe right - lets put [Save Changes] (save local) [Save as file] (to physical disk) button there if tweeked in any way without having saved in local or physical storage

Save as to disk -> Save to disk'

---

nothing is actually saved to the project permanently unless the Save changes is hit
