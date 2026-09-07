import re

with open('packages/design/domain/openisdRepo.ts', 'r') as f:
    content = f.read()

# Replace ProjectRepo doc
content = re.sub(
    r'/\*\*\n \* The app\'s door to stored projects.*?\*/\nexport interface ProjectRepo',
    '/**\n * Application interface for stored projects.\n *\n * Uses domain objects (`OpenISDProject`) exclusively to hide internal JSON structures.\n * Identifies projects by their transient in-memory UUIDs.\n */\nexport interface ProjectRepo',
    content,
    flags=re.DOTALL
)

# Replace save doc
content = re.sub(
    r'    /\*\*\n     \* Write `project`\'s current design.*?     \*/\n    save',
    '    /**\n     * Persists the active edit layer or committed state (never what-if state) under the project\'s UUID.\n     */\n    save',
    content,
    flags=re.DOTALL
)

# Replace load doc
content = re.sub(
    r'    /\*\*\n     \* Rebuild the project stored under `id`.*?     \*/\n    load',
    '    /**\n     * Rebuilds `OpenISDProject` from storage without throwing, returning parse errors if invalid.\n     * Adopts the stored `id` as the project\'s identity for idempotency.\n     */\n    load',
    content,
    flags=re.DOTALL
)

# Replace list doc
content = re.sub(
    r'    /\*\*\n     \* Everything the store holds.*?     \*/\n    list',
    '    /**\n     * Retrieves metadata for all stored projects, ordered by most recently modified.\n     */\n    list',
    content,
    flags=re.DOTALL
)

# Replace remove doc
content = re.sub(
    r'    /\*\*\n     \* Delete the stored entry for `id`.*?     \*/\n    remove',
    '    /**\n     * Irreversibly deletes the stored entry for `id` if the `confirm` challenge succeeds.\n     */\n    remove',
    content,
    flags=re.DOTALL
)

# Replace projectRepo factory doc
content = re.sub(
    r'/\*\*\n \* Build a repo over the store.*? \*/\nexport function projectRepo',
    '/**\n * Instantiates a `ProjectRepo` over the provided generic `RecordStoreFactory`.\n * Encapsulates the `OpenISDProjectJson` type so callers do not need to name it.\n */\nexport function projectRepo',
    content,
    flags=re.DOTALL
)

with open('packages/design/domain/openisdRepo.ts', 'w') as f:
    f.write(content)

with open('packages/design/domain/openisdRepo.ts', 'r') as f:
    content = f.read()

content = re.sub(
    r'    /\*\* The STORE KEY — pass it back.*?second entry\. \*/',
    '    /** The store key (UUID) used for `load()` and `remove()`. */',
    content,
    flags=re.DOTALL
)

with open('packages/design/domain/openisdRepo.ts', 'w') as f:
    f.write(content)
