"""Runs a generated driver model over a case file and writes each case's verdict.

    python3 -I validate.py <generated module .py> <cases.json> <results.json>

cases.json: a list of {"id": str, "input": <json value>}. results.json: a list of
{"id", "verdict": "accept"|"refuse", "result"?: parsed value, "problems"?: [path strings]}.
The problem paths are normalised to the Zod master's spelling: union tag segments dropped, a
dict-key error reported at the key, a missing or wrong discriminator reported at the
discriminator field (when the input was an object at all, as Zod does).

`-I` keeps the interpreter from loading code from the working directory; pydantic lives in the
user site, which is put back here on purpose.
"""
import importlib.util
import json
import site
import sys

sys.path.append(site.getusersitepackages())

from pydantic import ValidationError  # noqa: E402


def load_module(path):
    spec = importlib.util.spec_from_file_location('driver_model', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def problem_path(err, tags, discriminator_field, dispatch_tags):
    raw = list(err['loc'])
    loc = [str(s) for s in raw if s not in tags]
    # An unrecognised key: an extra key on a strict object, or a dict key outside its enum. Zod
    # reports both as `unrecognized_keys` at the object, with the key names beside the issue.
    key_error = err['type'] == 'extra_forbidden' or (len(loc) > 0 and loc[-1] == '[key]')
    if key_error and loc[-1] == '[key]':
        loc.pop()
    # Under a hand-dispatched sum the master re-raises each member issue at the member's path and
    # drops the key names, so an unrecognised key there is a problem at its object.
    if key_error and any(s in dispatch_tags for s in raw):
        loc.pop()
    if err['type'] in ('union_tag_not_found', 'union_tag_invalid') and isinstance(err.get('input'), dict):
        fn = err['ctx']['discriminator'].removesuffix('()')
        field = discriminator_field.get(fn)
        if field is not None:
            loc.append(field)
    return '.'.join(loc)


def verdict(model, case_input, tags, discriminator_field, dispatch_tags):
    try:
        parsed = model.model_validate(case_input)
    except ValidationError as e:
        paths = sorted({problem_path(err, tags, discriminator_field, dispatch_tags) for err in e.errors()})
        return {'verdict': 'refuse', 'problems': paths}
    return {'verdict': 'accept', 'result': parsed.model_dump(mode='json', by_alias=True, exclude_unset=True)}


def main(argv):
    module_path, cases_path, results_path = argv[1:4]
    module = load_module(module_path)
    with open(cases_path, encoding='utf-8') as f:
        cases = json.load(f)
    results = []
    for case in cases:
        out = verdict(module.ROOT, case['input'], module.TAGS, module.DISCRIMINATOR_FIELD, module.DISPATCH_TAGS)
        out['id'] = case['id']
        results.append(out)
    with open(results_path, 'w', encoding='utf-8') as f:
        json.dump(results, f)


if __name__ == '__main__':
    main(sys.argv)
