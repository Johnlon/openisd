import sys

domain_file = 'packages/design/domain/openisdDomain.ts'
repo_file = 'packages/design/domain/openisdRepo.ts'
index_file = 'packages/design/domain/index.ts'

with open(domain_file, 'r') as f:
    lines = f.readlines()

# Find the start and end of the repo section
start_idx = -1
for i, line in enumerate(lines):
    if line.startswith('// ── THE REPOSITORY AND THE STORE'):
        start_idx = i
        break

end_idx = len(lines) - 2 # Assuming it goes to the end minus closing bracket of nothing?
# Actually let's look for the closing brace of projectRepo
for i in range(len(lines)-1, -1, -1):
    if lines[i].startswith('}'):
        end_idx = i + 1
        break

repo_lines = lines[start_idx:end_idx]
domain_lines = lines[:start_idx] + lines[end_idx:]

with open(domain_file, 'w') as f:
    f.writelines(domain_lines)

repo_content = """import { OpenISDProject } from './openisdDomain.js';
import { type OpenISDProjectJson, openISDProjectJsonSchema } from './openisdSchema.js';
import type { Engine } from '../engine/index.js';

""" + "".join(repo_lines)

with open(repo_file, 'w') as f:
    f.write(repo_content)

with open(index_file, 'r') as f:
    index_content = f.read()

index_content = index_content.replace(
    """  ProjectListing,
  RecordStore,
  RecordStoreFactory,
  DeleteChallenge,
  DeleteOutcome,
  ProjectRepo,""",
    ""
).replace(
    "export { projectRepo } from './openisdDomain.js';",
    "export { projectRepo, type ProjectListing, type RecordStore, type RecordStoreFactory, type DeleteChallenge, type DeleteOutcome, type ProjectRepo } from './openisdRepo.js';"
)

with open(index_file, 'w') as f:
    f.write(index_content)
