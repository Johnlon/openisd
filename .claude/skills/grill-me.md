# Skill: grill-me

Before starting any significant or ambiguous task, run a structured interrogation to surface every assumption and ambiguity before writing a single line of code or making any change.

## When to use

Invoke this skill when:
- A task description is vague, large, or multi-step
- You are uncertain about scope, constraints, or success criteria
- The user has asked for something that could be interpreted multiple ways
- You are about to make a hard-to-reverse change (schema change, architecture decision, data migration)

Do NOT invoke for: clearly-scoped single-file fixes, typo corrections, or tasks where all six questions below have obvious answers from context.

---

## The interrogation

Ask ALL of the following in a single message — never spread them across turns:

**1. Goal**
What is the exact outcome we are trying to produce? State it in one sentence. If you cannot, the task is not well-defined.

**2. Scope — in**
What files, components, collections, or systems are explicitly in scope?

**3. Scope — out**
What is explicitly NOT changing? Name things that might seem related but must stay untouched.

**4. Success criteria**
How will we verify this is done? What test, check, or observable output confirms success?

**5. Constraints**
Are there hard rules that constrain the approach? (Schema discipline, no-normalisation rule, AI-locked files, calculation stability, protected collections, port assignments, branch model, etc.)

**6. Risks / unknowns**
What could go wrong? What do we not know yet that could block or derail this?

---

## After the answers

Once the user answers, synthesise a one-paragraph implementation plan and confirm it before proceeding. Only start work after explicit approval.

If any answer reveals a blocker (e.g. a constraint that makes the task impossible as stated), surface it immediately and stop — do not attempt a workaround without explicit human direction.
