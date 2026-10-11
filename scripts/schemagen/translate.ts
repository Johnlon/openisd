/**
 * The Zod master → pydantic v2, for OUR driver-record schema only.
 *
 * Reads `openISDDeviceJsonSchema` in `packages/design/domain/openisdSchema.ts` AS CODE (ts-morph
 * AST), refinement, transform and dispatch bodies included, and writes one Python module that
 * validates the same way. It knows exactly the constructs that schema uses; any other construct
 * stops it with the construct and its source line named (`Untranslated`). No general Zod coverage,
 * no package, no public API.
 */
import {Node, Project, SyntaxKind} from 'ts-morph';
import type {ArrowFunction, Expression, SourceFile} from 'ts-morph';

/** A construct this translator does not know. The message names it and its line. */
export class Untranslated extends Error {
    constructor(node: Node, what: string) {
        super(`${what}: ${node.getKindName()} \`${node.getText().split('\n')[0].slice(0, 80)}\``
            + ` at ${node.getSourceFile().getFilePath()}:${node.getStartLineNumber()}`);
    }
}

// ── The translated shape (IR) ─────────────────────────────────────────────────────────────────

/** One python-side check: a boolean expression over `param`, and the message when it is false. */
interface Check { readonly param: string; readonly expr: string; readonly selfExpr: string; readonly message: string }
interface PyField { readonly name: string; readonly type: PyType; readonly optional: boolean }
interface PyObject { readonly kind: 'object'; readonly hint: string; readonly fields: PyField[]; readonly checks: Check[] }
interface UnionMember { readonly type: PyType; readonly transform: {param: string; expr: string} | null }
export type PyType =
    | { readonly kind: 'str' }
    | { readonly kind: 'number'; readonly positive: boolean }
    | { readonly kind: 'bool' }
    | { readonly kind: 'unknown' }
    | { readonly kind: 'literal'; readonly value: string }
    | { readonly kind: 'enum'; readonly values: readonly string[] }
    | { readonly kind: 'nullable'; readonly inner: PyType }
    | { readonly kind: 'array'; readonly item: PyType; readonly min: number | null }
    | { readonly kind: 'record'; readonly key: PyType; readonly value: PyType }
    | { readonly kind: 'checked'; readonly inner: PyType; readonly check: Check }
    | PyObject
    | { readonly kind: 'tagged'; readonly hint: string; readonly discriminator: string; readonly members: readonly PyObject[] }
    | { readonly kind: 'piped'; readonly hint: string; readonly members: readonly UnionMember[]; readonly target: PyType }
    | { readonly kind: 'dispatch'; readonly hint: string; readonly message: string; readonly arms: readonly {key: string; member: PyType}[] };

/** The construct `z.strictObject(...).optional()` as a field's type: carried out of `translate`
 *  so the field can take it, refused anywhere else. */
interface Optional { readonly kind: 'optional'; readonly inner: PyType }

interface Binding { readonly expr: Expression; readonly env: Env }
type Env = ReadonlyMap<string, Binding>;

export class ZodTranslator {
    readonly #memo = new Map<Node, PyType>();

    /** The IR of the exported const `name` in `file`. */
    schemaOf(file: SourceFile, name: string): PyType {
        const decl = file.getVariableDeclarationOrThrow(name);
        return this.#plain(this.#translate(decl.getInitializerOrThrow(), new Map(), name));
    }

    #plain(t: PyType | Optional): PyType {
        if (t.kind === 'optional') throw new Error('optional outside a field');
        return t;
    }

    #translate(expr: Expression, env: Env, hint: string): PyType | Optional {
        if (Node.isParenthesizedExpression(expr) || Node.isAsExpression(expr)) return this.#translate(expr.getExpression(), env, hint);
        if (Node.isIdentifier(expr)) return this.#identifier(expr, env, hint);
        if (Node.isCallExpression(expr)) {
            const callee = expr.getExpression();
            const args = expr.getArguments().map(a => this.#argument(a));
            if (Node.isPropertyAccessExpression(callee)) {
                const receiver = callee.getExpression();
                const method = callee.getName();
                if (Node.isIdentifier(receiver) && receiver.getText() === 'z') return this.#zCall(expr, method, args, env, hint);
                return this.#chained(expr, this.#translate(receiver, env, hint), method, args, env);
            }
            if (Node.isIdentifier(callee)) return this.#factoryCall(callee, args, env, hint);
        }
        throw new Untranslated(expr, 'unknown schema expression');
    }

    #argument(node: Node): Expression {
        if (Node.isExpression(node)) return node;
        throw new Untranslated(node, 'argument is not an expression');
    }

    #identifier(id: Node, env: Env, hint: string): PyType | Optional {
        const bound = env.get(id.getText());
        if (bound !== undefined) return this.#translate(bound.expr, bound.env, hint);
        const decl = this.#declarationOf(id);
        const memo = this.#memo.get(decl);
        if (memo !== undefined) return memo;
        const translated = this.#plain(this.#translate(decl.getInitializerOrThrow(), new Map(), decl.getName()));
        const value: PyType = 'hint' in translated ? {...translated, hint: decl.getName()} : translated;
        this.#memo.set(decl, value);
        return value;
    }

    #declarationOf(id: Node) {
        if (!Node.isIdentifier(id)) throw new Untranslated(id, 'not an identifier');
        for (const d of id.getDefinitionNodes()) if (Node.isVariableDeclaration(d)) return d;
        throw new Untranslated(id, 'no variable declaration found for identifier');
    }

    #factoryCall(callee: Node, args: Expression[], env: Env, hint: string): PyType | Optional {
        const decl = this.#declarationOf(callee);
        const fn = decl.getInitializerOrThrow();
        if (!Node.isArrowFunction(fn)) throw new Untranslated(fn, 'factory is not an arrow function');
        const params = fn.getParameters();
        if (params.length !== args.length) throw new Untranslated(callee, 'factory argument count');
        const inner = new Map<string, Binding>();
        params.forEach((p, i) => inner.set(p.getName(), {expr: args[i], env}));
        const body = fn.getBody();
        if (!Node.isExpression(body)) throw new Untranslated(body, 'factory body is not an expression');
        return this.#translate(body, inner, hint);
    }

    #zCall(call: Node, method: string, args: Expression[], env: Env, hint: string): PyType {
        switch (method) {
            case 'string': return {kind: 'str'};
            case 'number': return {kind: 'number', positive: false};
            case 'boolean': return {kind: 'bool'};
            case 'unknown': return {kind: 'unknown'};
            case 'literal': return {kind: 'literal', value: this.#stringOf(args[0], env)};
            case 'enum': return {kind: 'enum', values: this.#stringsOf(args[0], env)};
            case 'strictObject': return this.#object(args[0], env);
            case 'record': return {kind: 'record', key: this.#plain(this.#translate(args[0], env, hint)), value: this.#plain(this.#translate(args[1], env, hint))};
            case 'partialRecord': return {kind: 'record', key: this.#plain(this.#translate(args[0], env, hint)), value: this.#plain(this.#translate(args[1], env, hint))};
            case 'array': return {kind: 'array', item: this.#plain(this.#translate(args[0], env, hint)), min: null};
            case 'discriminatedUnion': return this.#tagged(args[0], args[1], env, hint);
            case 'union': return this.#union(args[0], env, hint);
            default: throw new Untranslated(call, `z.${method}`);
        }
    }

    #chained(call: Node, receiver: PyType | Optional, method: string, args: Expression[], env: Env): PyType | Optional {
        if (method === 'optional') return {kind: 'optional', inner: this.#plain(receiver)};
        const r = this.#plain(receiver);
        switch (method) {
            case 'nullable': return {kind: 'nullable', inner: r};
            case 'array': return {kind: 'array', item: r, min: null};
            case 'min': {
                if (r.kind !== 'array') throw new Untranslated(call, '.min on a non-array');
                return {kind: 'array', item: r.item, min: this.#numberOf(args[0])};
            }
            case 'positive': {
                if (r.kind !== 'number') throw new Untranslated(call, '.positive on a non-number');
                return {kind: 'number', positive: true};
            }
            case 'partial': {
                if (r.kind !== 'object') throw new Untranslated(call, '.partial on a non-object');
                return {kind: 'object', hint: r.hint, checks: r.checks, fields: r.fields.map(f => ({...f, optional: true}))};
            }
            case 'refine': {
                const check = this.#check(args[0], args[1], env);
                if (r.kind === 'object') return {...r, checks: [...r.checks, check]};
                return {kind: 'checked', inner: r, check};
            }
            case 'pipe': {
                if (r.kind !== 'piped' || r.target.kind !== 'unknown') throw new Untranslated(call, '.pipe on something other than a bare union');
                return {...r, target: this.#plain(this.#translate(args[0], env, r.hint))};
            }
            case 'transform': return this.#transform(call, r, args[0], env);
            default: throw new Untranslated(call, `.${method}`);
        }
    }

    #object(arg: Expression, env: Env): PyObject {
        if (!Node.isObjectLiteralExpression(arg)) throw new Untranslated(arg, 'strictObject argument');
        const fields: PyField[] = [];
        for (const prop of arg.getProperties()) {
            if (Node.isPropertyAssignment(prop)) {
                const nameNode = prop.getNameNode();
                const name = Node.isStringLiteral(nameNode) ? nameNode.getLiteralText() : nameNode.getText();
                fields.push(this.#field(name, this.#translate(prop.getInitializerOrThrow(), env, name)));
            } else if (Node.isShorthandPropertyAssignment(prop)) {
                const name = prop.getName();
                fields.push(this.#field(name, this.#identifier(prop.getNameNode(), env, name)));
            } else throw new Untranslated(prop, 'object property');
        }
        return {kind: 'object', hint: '', fields, checks: []};
    }

    #field(name: string, type: PyType | Optional): PyField {
        return type.kind === 'optional' ? {name, type: type.inner, optional: true} : {name, type, optional: false};
    }

    #tagged(discriminator: Expression, members: Expression, env: Env, hint: string): PyType {
        if (!Node.isArrayLiteralExpression(members)) throw new Untranslated(members, 'discriminatedUnion members');
        const objects = members.getElements().map(m => {
            const t = this.#plain(this.#translate(m, env, hint));
            if (t.kind !== 'object') throw new Untranslated(m, 'discriminatedUnion member is not a strict object');
            return t;
        });
        return {kind: 'tagged', hint: '', discriminator: this.#stringOf(discriminator, env), members: objects};
    }

    #union(members: Expression, env: Env, hint: string): PyType {
        if (!Node.isArrayLiteralExpression(members)) throw new Untranslated(members, 'union members');
        const parts = members.getElements().map((m): UnionMember => {
            const t = this.#translate(m, env, hint);
            if (t.kind === 'piped' && t.target.kind === 'unknown' && t.members.length === 1) return t.members[0];
            return {type: this.#plain(t), transform: null};
        });
        return {kind: 'piped', hint: '', members: parts, target: {kind: 'unknown'}};
    }

    /** `.transform(fn)`: on a plain type it is one union member with a mapping; on `z.unknown()`
     *  it is the hand-dispatched sum (`specsJsonSchema`), read from its body. */
    #transform(call: Node, r: PyType, fn: Expression, env: Env): PyType {
        const arrow = this.#arrow(fn);
        const body = arrow.getBody();
        if (r.kind === 'unknown' && Node.isBlock(body)) return this.#dispatch(arrow, env);
        if (!Node.isExpression(body)) throw new Untranslated(body, 'transform body');
        const param = arrow.getParameters()[0].getName();
        return {kind: 'piped', hint: '', members: [{type: r, transform: {param, expr: this.#pyExpr(body, param, param)}}], target: {kind: 'unknown'}};
    }

    /**
     * The one block-bodied transform: `specsJsonSchema`. Its body, in order:
     *   const keyed = typeof value === 'object' && value !== null && !Array.isArray(value);
     *   const claimsA = keyed && 'keyA' in value;      (one per arm)
     *   if (claimsA === claimsB) { ctx.issues.push({..., message: MESSAGE, ...}); return z.NEVER; }
     *   const member = claimsA ? A.safeParse(value) : B.safeParse(value);
     *   if (!member.success) { re-raise each issue at its path }
     *   return member.data;
     * Read: the arm keys, the arm schemas, the message. Anything else stops.
     */
    #dispatch(arrow: ArrowFunction, env: Env): PyType {
        const body = arrow.getBody();
        if (!Node.isBlock(body)) throw new Untranslated(body, 'dispatch body');
        const statements = body.getStatements();
        if (statements.length !== 7) throw new Untranslated(body, 'dispatch body shape (expected 7 statements)');
        const claims = new Map<string, string>();
        for (const s of [statements[1], statements[2]]) {
            if (!Node.isVariableStatement(s)) throw new Untranslated(s, 'dispatch claim');
            const d = s.getDeclarations()[0];
            const init = d.getInitializerOrThrow();
            if (!Node.isBinaryExpression(init)) throw new Untranslated(init, 'dispatch claim');
            const inExpr = init.getRight();
            if (!Node.isBinaryExpression(inExpr) || inExpr.getOperatorToken().getKind() !== SyntaxKind.InKeyword) throw new Untranslated(inExpr, "dispatch claim 'key' in value");
            claims.set(d.getName(), this.#stringOf(inExpr.getLeft(), env));
        }
        const guard = statements[3];
        if (!Node.isIfStatement(guard)) throw new Untranslated(guard, 'dispatch guard');
        const message = this.#messageIn(guard, env);
        const pick = statements[4];
        if (!Node.isVariableStatement(pick)) throw new Untranslated(pick, 'dispatch member pick');
        const cond = pick.getDeclarations()[0].getInitializerOrThrow();
        if (!Node.isConditionalExpression(cond)) throw new Untranslated(cond, 'dispatch member pick');
        const claimName = cond.getCondition().getText();
        const whenTrue = claims.get(claimName);
        const otherKey = [...claims.entries()].find(([n]) => n !== claimName)?.[1];
        if (whenTrue === undefined || otherKey === undefined) throw new Untranslated(cond, 'dispatch condition names no claim');
        const arms = [
            {key: whenTrue, member: this.#safeParsedSchema(cond.getWhenTrue(), env)},
            {key: otherKey, member: this.#safeParsedSchema(cond.getWhenFalse(), env)},
        ];
        return {kind: 'dispatch', hint: 'specs', message, arms};
    }

    #messageIn(guard: Node, env: Env): string {
        const literals = Node.isObjectLiteralExpression(guard) ? [guard] : guard.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression);
        for (const o of literals) {
            const m = o.getProperty('message');
            if (m !== undefined && Node.isPropertyAssignment(m)) return this.#stringOf(m.getInitializerOrThrow(), env);
        }
        throw new Untranslated(guard, 'dispatch guard message');
    }

    #safeParsedSchema(expr: Expression, env: Env): PyType {
        if (!Node.isCallExpression(expr)) throw new Untranslated(expr, 'dispatch arm');
        const callee = expr.getExpression();
        if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== 'safeParse') throw new Untranslated(expr, 'dispatch arm is not X.safeParse(value)');
        return this.#plain(this.#translate(callee.getExpression(), env, ''));
    }

    #arrow(fn: Expression): ArrowFunction {
        if (!Node.isArrowFunction(fn)) throw new Untranslated(fn, 'expected an arrow function');
        return fn;
    }

    #check(fn: Expression, message: Expression | undefined, env: Env): Check {
        const arrow = this.#arrow(fn);
        const body = arrow.getBody();
        if (!Node.isExpression(body)) throw new Untranslated(body, 'refine body is not an expression');
        const param = arrow.getParameters()[0].getName();
        if (message === undefined) throw new Untranslated(fn, 'refine without a message');
        const text = Node.isObjectLiteralExpression(message)
            ? this.#messageIn(message, env)
            : this.#stringOf(message, env);
        return {param, expr: this.#pyExpr(body, param, param), selfExpr: this.#pyExpr(body, param, 'self'), message: text};
    }

    /** A refine/transform body as a python expression. `param` is the arrow's parameter; it reads
     *  as `pyParam` in the output. Only the operators and calls our bodies use. */
    #pyExpr(e: Expression, param: string, pyParam: string): string {
        const sub = (x: Expression) => this.#pyExpr(x, param, pyParam);
        if (Node.isParenthesizedExpression(e)) return `(${sub(e.getExpression())})`;
        if (Node.isNullLiteral(e)) return 'None';
        if (Node.isNumericLiteral(e)) return e.getText();
        if (Node.isStringLiteral(e)) return JSON.stringify(e.getLiteralText());
        if (Node.isIdentifier(e)) {
            if (e.getText() === param) return pyParam;
            throw new Untranslated(e, 'free identifier in a refine body');
        }
        if (Node.isArrayLiteralExpression(e)) return `[${e.getElements().map(sub).join(', ')}]`;
        if (Node.isPrefixUnaryExpression(e) && e.getOperatorToken() === SyntaxKind.ExclamationToken) return `(not ${sub(e.getOperand())})`;
        if (Node.isNewExpression(e) && e.getExpression().getText() === 'Set') return `set(${sub(this.#argument(e.getArguments()[0]))})`;
        if (Node.isCallExpression(e) && e.getExpression().getText() === 'Object.keys') return `list(${sub(this.#argument(e.getArguments()[0]))})`;
        if (Node.isPropertyAccessExpression(e)) {
            const name = e.getName();
            if (name === 'length' || name === 'size') return `len(${sub(e.getExpression())})`;
            return `${sub(e.getExpression())}.${name}`;
        }
        if (Node.isBinaryExpression(e)) {
            const l = sub(e.getLeft());
            const r = sub(e.getRight());
            const nullish = l === 'None' || r === 'None';
            switch (e.getOperatorToken().getKind()) {
                case SyntaxKind.EqualsEqualsEqualsToken: return nullish ? `(${l} is ${r})` : `(${l} == ${r})`;
                case SyntaxKind.ExclamationEqualsEqualsToken: return nullish ? `(${l} is not ${r})` : `(${l} != ${r})`;
                case SyntaxKind.BarBarToken: return `(${l} or ${r})`;
                case SyntaxKind.AmpersandAmpersandToken: return `(${l} and ${r})`;
                case SyntaxKind.GreaterThanToken: return `(${l} > ${r})`;
                case SyntaxKind.LessThanToken: return `(${l} < ${r})`;
                default: throw new Untranslated(e, 'operator in a refine body');
            }
        }
        throw new Untranslated(e, 'expression in a refine body');
    }

    #stringOf(e: Expression, env: Env): string {
        if (Node.isParenthesizedExpression(e)) return this.#stringOf(e.getExpression(), env);
        if (Node.isStringLiteral(e) || Node.isNoSubstitutionTemplateLiteral(e)) return e.getLiteralText();
        if (Node.isBinaryExpression(e) && e.getOperatorToken().getKind() === SyntaxKind.PlusToken) return this.#stringOf(e.getLeft(), env) + this.#stringOf(e.getRight(), env);
        if (Node.isIdentifier(e)) {
            const bound = env.get(e.getText());
            if (bound !== undefined) return this.#stringOf(bound.expr, bound.env);
            return this.#stringOf(this.#declarationOf(e).getInitializerOrThrow(), new Map());
        }
        throw new Untranslated(e, 'expected a string');
    }

    #stringsOf(e: Expression, env: Env): string[] {
        if (Node.isParenthesizedExpression(e) || Node.isAsExpression(e)) return this.#stringsOf(e.getExpression(), env);
        if (Node.isArrayLiteralExpression(e)) return e.getElements().map(x => this.#stringOf(x, env));
        if (Node.isIdentifier(e)) return this.#stringsOf(this.#declarationOf(e).getInitializerOrThrow(), new Map());
        throw new Untranslated(e, 'expected a string array');
    }

    #numberOf(e: Expression): number {
        if (Node.isNumericLiteral(e)) return e.getLiteralValue();
        throw new Untranslated(e, 'expected a number literal');
    }
}

// ── Python emission ───────────────────────────────────────────────────────────────────────────

const pascal = (s: string): string => s.replace(/(^|[^A-Za-z0-9]+)([a-z0-9])/g, (_m, _p, c: string) => c.toUpperCase()).replace(/[^A-Za-z0-9]/g, '');
const snake = (s: string): string => s.replace(/[^A-Za-z0-9]+/g, '_').replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
const py = (s: string): string => JSON.stringify(s);

/** Writes the module text for a root type. Declarations come out in dependency order. */
export class PythonEmitter {
    readonly #lines: string[] = [];
    readonly #names = new Set<string>();
    readonly #emitted = new Map<string, string>();
    readonly #tags = new Set<string>();
    readonly #dispatchTags = new Set<string>();
    readonly #discriminators = new Map<string, string | null>();
    #counter = 0;

    moduleFor(root: PyType, masterPath: string): string {
        const rootName = this.#annotation(root, 'Root');
        return [
            `# GENERATED by scripts/schemagen from ${masterPath} - do not edit; the Zod schema is the master.`,
            '# Every model is strict (extra keys refused, no type coercion) because the master is `z.strictObject`.',
            '# An optional key has the default None but its type does not admit None: pydantic does not validate',
            '# defaults, and `model_dump(exclude_unset=True)` leaves an absent key absent, as Zod does.',
            'from typing import Annotated, Literal, Union',
            'from pydantic import AfterValidator, BaseModel, BeforeValidator, ConfigDict, Discriminator, Field, Tag, TypeAdapter, model_validator',
            '',
            'Number = Annotated[float, Field(allow_inf_nan=False)]',
            '',
            'class Strict(BaseModel):',
            "    model_config = ConfigDict(extra='forbid', strict=True)",
            '',
            ...this.#lines,
            `ROOT = ${rootName}`,
            `TAGS = frozenset({${[...this.#tags].map(py).join(', ')}})`,
            `DISPATCH_TAGS = frozenset({${[...this.#dispatchTags].map(py).join(', ')}})`,
            `DISCRIMINATOR_FIELD = {${[...this.#discriminators].map(([f, k]) => `${py(f)}: ${k === null ? 'None' : py(k)}`).join(', ')}}`,
            '',
        ].join('\n');
    }

    #name(hint: string): string {
        let base = pascal(hint === '' ? 'Anon' : hint).replace(/JsonSchema$|Schema$/, '');
        if (base === '') base = 'Anon';
        let name = base;
        for (let i = 2; this.#names.has(name); i += 1) name = `${base}${i}`;
        this.#names.add(name);
        return name;
    }

    #fn(hint: string): string {
        this.#counter += 1;
        return `_${snake(hint === '' ? 'f' : hint)}_${this.#counter}`;
    }

    /** The same shape is emitted once, whatever name each use site would have given it. */
    #annotation(t: PyType, hint: string): string {
        const key = JSON.stringify(t, (k, v: unknown) => (k === 'hint' ? undefined : v));
        const known = this.#emitted.get(key);
        if (known !== undefined) return known;
        const named = t.kind === 'tagged' || t.kind === 'piped' || t.kind === 'dispatch' || t.kind === 'checked';
        const own = 'hint' in t && t.hint !== '' ? t.hint : hint;
        const ann = this.#annotate(t, own);
        let out = ann;
        if (named) {
            out = this.#name(own);
            this.#lines.push(`${out} = ${ann}`, '');
        }
        this.#emitted.set(key, out);
        return out;
    }

    #annotate(t: PyType, hint: string): string {
        switch (t.kind) {
            case 'str': return 'str';
            case 'number': return t.positive ? 'Annotated[Number, Field(gt=0)]' : 'Number';
            case 'bool': return 'bool';
            case 'unknown': return 'object';
            case 'literal': return `Literal[${py(t.value)}]`;
            case 'enum': return `Literal[${t.values.map(py).join(', ')}]`;
            case 'nullable': return `${this.#annotation(t.inner, hint)} | None`;
            case 'array': {
                const inner = `list[${this.#annotation(t.item, hint)}]`;
                return t.min === null ? inner : `Annotated[${inner}, Field(min_length=${t.min})]`;
            }
            case 'record': return `dict[${this.#annotation(t.key, hint)}, ${this.#annotation(t.value, hint)}]`;
            case 'checked': {
                const inner = this.#annotation(t.inner, hint);
                const fn = this.#fn(hint);
                this.#lines.push(`def ${fn}(${t.check.param}):`, `    if not ${t.check.expr}:`, `        raise ValueError(${py(t.check.message)})`, `    return ${t.check.param}`, '');
                return `Annotated[${inner}, AfterValidator(${fn})]`;
            }
            case 'object': return this.#classFor(t, hint);
            case 'tagged': return this.#tagged(t, hint);
            case 'piped': return this.#piped(t, hint);
            case 'dispatch': return this.#dispatch(t, hint);
        }
    }

    #classFor(t: PyObject, hint: string): string {
        const name = this.#name(t.hint !== '' ? t.hint : hint);
        const fields = t.fields.map(f => {
            const ann = this.#annotation(f.type, `${name}_${f.name}`);
            const pyName = /^[A-Za-z_][A-Za-z0-9_]*$/.test(f.name) ? f.name : null;
            if (pyName === null) {
                const safe = snake(f.name);
                return `    ${safe}: ${ann} = Field(${f.optional ? 'default=None, ' : ''}alias=${py(f.name)})`;
            }
            return `    ${f.name}: ${ann}${f.optional ? ' = None' : ''}`;
        });
        const body = [`class ${name}(Strict):`, ...(fields.length === 0 ? ['    pass'] : fields)];
        t.checks.forEach((c, i) => body.push('', `    @model_validator(mode='after')`, `    def _check_${i}(self):`, `        if not ${c.selfExpr}:`, `            raise ValueError(${py(c.message)})`, '        return self'));
        this.#lines.push(...body, '');
        return name;
    }

    #tagged(t: Extract<PyType, {kind: 'tagged'}>, hint: string): string {
        const members = t.members.map(m => {
            const field = m.fields.find(f => f.name === t.discriminator);
            if (field === undefined || field.type.kind !== 'literal') throw new Error(`discriminated union member has no literal '${t.discriminator}'`);
            const tag = `<${field.type.value}>`;
            this.#tags.add(tag);
            return {tag, value: field.type.value, cls: this.#classFor(m, `${hint}_${field.type.value}`)};
        });
        const fn = this.#fn(`tag_${t.discriminator}`);
        this.#discriminators.set(fn, t.discriminator);
        this.#lines.push(`def ${fn}(v):`,
            `    if isinstance(v, dict) and v.get(${py(t.discriminator)}) in (${members.map(m => py(m.value)).join(', ')}):`,
            `        return '<' + v[${py(t.discriminator)}] + '>'`,
            '    return None', '');
        return `Annotated[Union[${members.map(m => `Annotated[${m.cls}, Tag(${py(m.tag)})]`).join(', ')}], Discriminator(${fn})]`;
    }

    /** `z.union([...]).pipe(target)`: a BeforeValidator that tries each member in order, as Zod
     *  does, applies that member's transform, and refuses at the field when none fits. */
    #piped(t: Extract<PyType, {kind: 'piped'}>, hint: string): string {
        const fn = this.#fn(`union_${hint}`);
        const adapters = t.members.map((m, i) => {
            const name = `${fn}_member_${i}`;
            this.#lines.push(`${name} = TypeAdapter(${this.#annotation(m.type, hint)}, config=ConfigDict(strict=True))`);
            return name;
        });
        const lines = [`def ${fn}(v):`];
        t.members.forEach((m, i) => {
            lines.push('    try:', `        out = ${adapters[i]}.validate_python(v)`);
            if (m.transform !== null) lines.push(`        ${m.transform.param} = out`, `        return ${m.transform.expr}`);
            else lines.push('        return out');
            lines.push('    except ValueError:', '        pass');
        });
        lines.push(`    raise ValueError('Invalid input')`, '');
        this.#lines.push(...lines);
        return `Annotated[${this.#annotation(t.target, hint)}, BeforeValidator(${fn})]`;
    }

    #dispatch(t: Extract<PyType, {kind: 'dispatch'}>, hint: string): string {
        const arms = t.arms.map(a => {
            const tag = `<${a.key}>`;
            this.#tags.add(tag);
            this.#dispatchTags.add(tag);
            return {tag, key: a.key, ann: this.#annotation(a.member, `${hint}_${a.key}`)};
        });
        if (arms.length !== 2) throw new Error('dispatch with other than two arms');
        const fn = this.#fn(`dispatch_${hint}`);
        this.#discriminators.set(fn, null);
        this.#lines.push(`def ${fn}(v):`,
            '    keyed = isinstance(v, dict)',
            ...arms.map((a, i) => `    claims_${i} = keyed and ${py(a.key)} in v`),
            `    if claims_0 == claims_1:`,
            `        return None  # ${t.message}`,
            `    return ${py(arms[0].tag)} if claims_0 else ${py(arms[1].tag)}`, '');
        return `Annotated[Union[${arms.map(a => `Annotated[${a.ann}, Tag(${py(a.tag)})]`).join(', ')}], Discriminator(${fn})]`;
    }
}

/** The whole job for one master file: text of the python module for its exported `schemaName`. */
export function pythonModuleFor(tsConfigPath: string, masterPath: string, schemaName: string, masterLabel: string): string {
    const project = new Project({tsConfigFilePath: tsConfigPath, skipAddingFilesFromTsConfig: true});
    const file = project.addSourceFileAtPath(masterPath);
    const ir = new ZodTranslator().schemaOf(file, schemaName);
    return new PythonEmitter().moduleFor(ir, masterLabel);
}
