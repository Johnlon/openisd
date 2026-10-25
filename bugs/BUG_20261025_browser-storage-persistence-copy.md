# BUG_20261025_browser-storage-persistence-copy

**Status:** Fixed in T583

## Symptom

The storage warning said a browser had “not promised to keep” the site's data. That wording was misleading: the warning represents the browser's persistent-storage permission result.

## Fix

When the persistence request is refused, say the browser “has not granted persistent storage for this site.” When the API is unsupported, say the browser “cannot guarantee that this site's data will be kept.” Preserve the existing storage-full warning and project recovery guidance.

## Verification

Unit tests assert both outcomes and the UI browser test checks the rendered refused-permission warning.
