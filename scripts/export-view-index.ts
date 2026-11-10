import {VIEW_INDEX} from '../packages/ui/test/fixtures/viewIndex.js';
/** Prints the view index as JSON for the live review (ui-gallery/bin/live-review-build.py), which cannot import TypeScript. */
console.log(JSON.stringify(VIEW_INDEX.map(view=>({id:view.id,skin:view.skin,kind:view.kind,reach:view.reach})),null,1));
