import re

with open('packages/design/domain/openisdDomain.ts', 'r') as f:
    content = f.read()

# Add OpenISDProjectSessionJson to imports
content = content.replace(
    '    type OpenISDProjectJson,\n',
    '    type OpenISDProjectJson,\n    type OpenISDProjectSessionJson,\n'
)

# Add wrapSession
wrapSessionCode = """
    /** Wrap a stored session (saved and edited states) under an adopted identity. */
    static wrapSession(session: OpenISDProjectSessionJson, uuid: string, engine: Engine): OpenISDProject {
        const project = new OpenISDProject(session.saved, uuid, engine);
        if (session.edited) {
            project.#edited = session.edited;
        }
        return project;
    }
"""
content = content.replace(
    '    static wrapWithIdentity(json: OpenISDProjectJson, uuid: string, engine: Engine): OpenISDProject {\n        return new OpenISDProject(json, uuid, engine);\n    }',
    '    static wrapWithIdentity(json: OpenISDProjectJson, uuid: string, engine: Engine): OpenISDProject {\n        return new OpenISDProject(json, uuid, engine);\n    }\n' + wrapSessionCode
)

# Add cloneSession
cloneSessionCode = """
    /** Serialises both saved and edited states for persistence. */
    cloneSession(): OpenISDProjectSessionJson {
        return {
            saved: structuredClone(this.#saved),
            edited: this.#edited ? structuredClone(this.#edited) : null,
        };
    }
"""
content = content.replace(
    '    cloneSavedProject(): OpenISDProjectJson {\n        return structuredClone(this.#saved);\n    }',
    '    cloneSavedProject(): OpenISDProjectJson {\n        return structuredClone(this.#saved);\n    }\n' + cloneSessionCode
)

with open('packages/design/domain/openisdDomain.ts', 'w') as f:
    f.write(content)
