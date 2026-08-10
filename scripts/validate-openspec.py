#!/usr/bin/env python3
import os
import re
import sys
import json

# Define capability to test files mapping for auto-fixing
MAPPING = {
    "core-engine": [
        "packages/engine/test/added-mass.test.ts",
        "packages/engine/test/advanced-options.test.ts",
        "packages/engine/test/alignments.test.ts",
        "packages/engine/test/architecture.test.ts",
        "packages/engine/test/circuit.test.ts",
        "packages/engine/test/complex.test.ts",
        "packages/engine/test/consistency.test.ts",
        "packages/engine/test/driver.test.ts",
        "packages/engine/test/engine.test.ts",
        "packages/engine/test/filter-chain-charts.test.ts",
        "packages/engine/test/formulas.test.ts",
        "packages/engine/test/golden.test.ts",
        "packages/engine/test/hardening.test.ts",
        "packages/engine/test/power-compression.test.ts",
        "packages/engine/test/sweep.test.ts",
        "packages/ui/test/logic/micka-crosscheck.browser.spec.ts",
    ],
    "ui-presentation": [
        "packages/ui/test/ui/chart-types.test.ts",
        "packages/ui/test/ui/chart-zoom.browser.spec.ts",
        "packages/ui/test/ui/skins.test.ts",
        "packages/ui/test/ui/visual.browser.spec.ts",
        "packages/ui/test/ui/original-narrow.browser.spec.ts",
        "packages/ui/test/ui/original-layout.browser.spec.ts",
        "packages/ui/test/ui/record-animation.browser.spec.ts",
        "packages/ui/test/ui/classic-skin.browser.spec.ts",
        "packages/ui/test/ui/original-skin.browser.spec.ts",
        "packages/ui/test/logic/toneGenerator.test.ts",
    ],
    "driver-database": [
        "packages/winisd/test/driver-class.test.ts",
        "packages/winisd/test/driver-derive.test.ts",
        "packages/winisd/test/driver-hardening.test.ts",
        "packages/winisd/test/driver-json.test.ts",
        "packages/winisd/test/driver-projection.test.ts",
        "packages/winisd/test/driver-roundtrip.test.ts",
        "packages/winisd/test/native/openisdDerive.test.ts",
        "packages/winisd/test/native/openisdRecord.test.ts",
        "packages/winisd/test/native/openisdYaml.test.ts",
        "packages/winisd/test/roundtrip.test.ts",
        "packages/winisd/test/classic/wdr.test.ts",
        "packages/winisd/test/classic/wpr.test.ts",
        "packages/ui/test/db/driver-search-name.test.ts",
        "packages/ui/test/db/driver-search-interactive.browser.spec.ts",
        "packages/ui/test/db/driver-favorites.browser.spec.ts",
        "packages/ui/test/db/driver-count.browser.spec.ts",
        "packages/ui/test/db/drivers-bundle.test.ts",
        "packages/ui/test/db/driver-scope-chip.browser.spec.ts",
        "packages/ui/test/db/driver-summary-winisd.browser.spec.ts",
    ],
    "driver-editor": [
        "packages/ui/test/logic/driver-editor-solver.browser.spec.ts",
        "packages/ui/test/logic/driver-editor-provenance.browser.spec.ts",
        "packages/ui/test/logic/driver-editor-mandatory.browser.spec.ts",
        "packages/ui/test/logic/consistency-dq.browser.spec.ts",
        "packages/ui/test/logic/driver-invalid.browser.spec.ts",
        "packages/ui/test/logic/provenance.test.ts",
        "packages/ui/test/logic/driver-provenance-inspector.browser.spec.ts",
        "packages/ui/test/ui/driver-type-chips.browser.spec.ts",
        "packages/ui/test/ui/driver-type-chips.test.ts",
    ],
    "project-management": [
        "packages/ui/test/logic/openisd-project.test.ts",
        "packages/ui/test/db/original-projects.browser.spec.ts",
        "packages/ui/test/logic/persist.test.ts",
        "packages/ui/test/logic/persistence.browser.spec.ts",
        "packages/ui/test/logic/store-filters-reactivity.test.ts",
        "packages/ui/test/logic/store-issue-channel.test.ts",
        "packages/ui/test/db/driver-selection.browser.spec.ts",
        "packages/ui/test/db/my-drivers.browser.spec.ts",
        "packages/ui/test/db/my-drivers-filtering.browser.spec.ts",
        "packages/ui/test/logic/whatif-panel-fields.browser.spec.ts",
        "packages/ui/test/logic/whatif-panel-shots.browser.spec.ts",
    ],
    "app-shell": [
        "packages/ui/test/ui/app.browser.spec.ts",
        "packages/ui/test/ui/modal-escape.browser.spec.ts",
        "packages/ui/test/logic/cursor-lock.test.ts",
        "packages/ui/test/ui/config.test.ts",
        "packages/ui/test/ui/architecture.test.ts",
        "packages/ui/test/logic/vent-group.test.ts",
        "packages/ui/test/db/driver-browser-winisd-controls.browser.spec.ts",
    ]
}

def load_config():
    config_path = "openspec.json"
    if not os.path.exists(config_path):
        return {
            "validation": {
                "requireTraceability": True,
                "rules": {
                    "feature-has-test-reference": "error",
                    "test-has-feature-reference": "error"
                }
            }
        }
    with open(config_path, "r") as f:
        return json.load(f)

def run_fix():
    print("Auto-fixing spec references in test files...")
    for cap, files in MAPPING.items():
        spec_url = f"http://localhost:8000/winisd/openisd/openspec/specs/{cap}/spec.md?html"
        comment = f"/**\n * Specification: {spec_url}\n */\n"
        for filepath in files:
            if not os.path.exists(filepath):
                continue
            with open(filepath, "r") as f:
                content = f.read()
            
            # Check if any reference to this capability's spec exists
            ref_pattern = rf"openspec/specs/{cap}/spec\.md"
            if not re.search(ref_pattern, content):
                # Prepend the comment to the file
                with open(filepath, "w") as f:
                    f.write(comment + content)
                print(f"  Fixed: {filepath}")
    print("Auto-fix complete.")

def validate():
    config = load_config()
    val_config = config.get("validation", {})
    if not val_config.get("requireTraceability", True):
        print("Traceability validation is disabled.")
        return True

    rules = val_config.get("rules", {})
    feat_rule = rules.get("feature-has-test-reference", "error")
    test_rule = rules.get("test-has-feature-reference", "error")

    errors = []
    warnings = []

    specs_dir = "openspec/specs"
    if not os.path.exists(specs_dir):
        print(f"Error: {specs_dir} directory not found.")
        sys.exit(1)

    # 1. Parse all specification files
    spec_files = []
    for root, _, files in os.walk(specs_dir):
        for file in files:
            if file.endswith(".md"):
                spec_files.append(os.path.join(root, file))

    all_referenced_tests = set()
    spec_requirements = {}

    for spec_path in spec_files:
        with open(spec_path, "r") as f:
            content = f.read()
        
        # Parse requirement sections
        # Match "### Requirement: <name>" or similar
        reqs = re.finditer(r"^###\s+Requirement:\s*(.+)$", content, re.MULTILINE)
        req_positions = [m.start() for m in reqs]
        
        if not req_positions:
            continue
        
        # Split content by requirement sections
        for i in range(len(req_positions)):
            start = req_positions[i]
            end = req_positions[i+1] if i+1 < len(req_positions) else len(content)
            req_text = content[start:end]
            
            req_title_match = re.match(r"^###\s+Requirement:\s*(.+)$", req_text)
            if not req_title_match:
                continue
            req_title = req_title_match.group(1).strip()
            
            # Find test file references within this requirement block
            # Match "packages/...test.ts" or "packages/...spec.ts"
            test_refs = re.findall(r"packages/[a-zA-Z0-9_\-\/]+\.(?:test|spec)\.ts", req_text)
            
            for ref in test_refs:
                all_referenced_tests.add(ref)
            
            if not test_refs:
                msg = f"Requirement '{req_title}' in {spec_path} has no verifying tests."
                if feat_rule == "error":
                    errors.append(msg)
                elif feat_rule == "warn":
                    warnings.append(msg)

    # 2. Check all test files in packages/ directory
    test_files = []
    for root, _, files in os.walk("packages"):
        # Skip node_modules or dist if present
        if "node_modules" in root or "dist" in root:
            continue
        for file in files:
            if file.endswith(".test.ts") or file.endswith(".spec.ts"):
                full_path = os.path.join(root, file)
                # Normalize path separators to forward slash
                norm_path = full_path.replace(os.path.sep, "/")
                test_files.append(norm_path)

    for test_path in test_files:
        # Check if the test file itself or any of its parent structure has a spec link
        with open(test_path, "r") as f:
            content = f.read()
        
        # Look for openspec/specs/<capability>/spec.md or similar
        has_spec_ref = re.search(r"openspec/specs/[a-zA-Z0-9_\-]+/spec\.md", content)
        
        if not has_spec_ref:
            msg = f"Test file {test_path} has no reference to a specification file in openspec/specs/."
            if test_rule == "error":
                errors.append(msg)
            elif test_rule == "warn":
                warnings.append(msg)

    # Print results
    if warnings:
        print("\n=== OpenSpec Traceability Warnings ===")
        for w in warnings:
            print(f"  WARN: {w}")
            
    if errors:
        print("\n=== OpenSpec Traceability Errors ===")
        for e in errors:
            print(f"  ERROR: {e}")
        print(f"\nValidation failed with {len(errors)} error(s) and {len(warnings)} warning(s).")
        return False
    else:
        print("\nOpenSpec Traceability validation: all checks passed successfully.")
        return True

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--fix":
        run_fix()
    
    success = validate()
    sys.exit(0 if success else 1)
