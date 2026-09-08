import os
import re

files_to_check = []
for root, _, files in os.walk('.'):
    if 'node_modules' in root or '.git' in root or 'dist' in root or 'build' in root:
        continue
    for f in files:
        if f.endswith('.json') or f.endswith('.ts') or f.endswith('.vue') or f.endswith('.mts') or f.endswith('.mjs'):
            files_to_check.append(os.path.join(root, f))

for filepath in files_to_check:
    try:
        with open(filepath, 'r') as f:
            content = f.read()
            
        orig = content
        
        if filepath.endswith('.json'):
            content = re.sub(r'\s*"@openisd/model": "\*",?', '', content)
            
            if 'tsconfig' in filepath:
                # Remove {"path": "../model"}
                content = re.sub(r'\s*\{\s*"path"\s*:\s*"\.\./model"\s*\}(,?)', '', content)
                content = re.sub(r',\s*\]', '\n  ]', content) # cleanup trailing commas
                
        if orig != content:
            with open(filepath, 'w') as f:
                f.write(content)
    except Exception:
        pass
