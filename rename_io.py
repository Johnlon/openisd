import os
import re

files_to_check = []
for root, _, files in os.walk('.'):
    if 'node_modules' in root or '.git' in root or 'dist' in root or 'build' in root:
        continue
    for f in files:
        if f.endswith('.ts') or f.endswith('.vue') or f.endswith('.md'):
            files_to_check.append(os.path.join(root, f))

for filepath in files_to_check:
    try:
        with open(filepath, 'r') as f:
            content = f.read()
            
        orig = content
        
        # Replace occurrences of useDesignIO
        content = content.replace('useDesignIO', 'useApplicationIO')
        content = content.replace('createDesignIO', 'createApplicationIO')
        
        if orig != content:
            with open(filepath, 'w') as f:
                f.write(content)
    except Exception as e:
        pass

