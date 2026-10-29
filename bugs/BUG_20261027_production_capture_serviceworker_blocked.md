# Production fails when browser automation blocks the Service Worker API

Status: open; bounded environment finding, not a diagnosis of all phone startup failures.

During the visual-catalogue capture on 27 October 2026, normal fresh production contexts
sometimes auto-reloaded when the first worker claimed them. A failed mobile Project Import
frame showed the startup logo rather than the requested menu. Nine desktop production frames
were quarantined after a one-colour diagnostic flagged the same capture-integrity concern;
original images and JSON attempts were preserved before retaking.

The attempted capture-context setting `serviceWorkers: block` made production show its real
Something went wrong/crash dialog. Recorded page error:
`Cannot read properties of undefined (reading 'addEventListener')`.
Evidence: `build/ui-manifest/mobile-visual-draft/captures/production/driver-info.attempt-*.json`
and other per-view attempts; original records remain in that directory.

This is a browser-capability/startup failure in that deployed build under an explicitly blocked
API. It does not establish that the phone's earlier lap:4607 failure has the same cause. Current
source has a different update attachment lifecycle; no app change or production fix is claimed.
The gallery recorder must use normal browser worker support, await the production controller
before importing the project, and check the requested root after taking the screenshot. It must
not dismiss a crash or publish a startup frame as the requested view.
