---
description: Formatting rules for file links and URLs
globs: *
---
# Communication & Links
- CLARITY VIA REFERENCES: Always provide explicit, clickable absolute file links or URLs so the user can instantly click to review source files or logs.
- For local files on WSL, ALWAYS format links using Windows-compatible UNC syntax (e.g., `[filename](file://wsl.localhost/Ubuntu-22.04/absolute/path/to/file#L123-145)`).
- For running application screens, use `http://localhost:PORT/path` links.
- Never output plain-text file paths when a clickable link can be provided.
