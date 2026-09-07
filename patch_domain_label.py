import re

with open('packages/design/domain/openisdDomain.ts', 'r') as f:
    content = f.read()

content = content.replace(
    """    cloneSession(): OpenISDProjectSessionJson {
        return {
            saved: structuredClone(this.#saved),
            edited: this.#edited ? structuredClone(this.#edited) : null,
        };
    }""",
    """    cloneSession(): OpenISDProjectSessionJson {
        return {
            label: this.name.get(),
            saved: structuredClone(this.#saved),
            edited: this.#edited ? structuredClone(this.#edited) : null,
        };
    }"""
)

with open('packages/design/domain/openisdDomain.ts', 'w') as f:
    f.write(content)
