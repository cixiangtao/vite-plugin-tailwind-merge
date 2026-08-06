import { MagicString } from "magic-string";
import type { ParserOptions } from "oxc-parser";
import { parseSync } from "oxc-parser";
import { twMerge } from "tailwind-merge";

import { walkAst, type AstNode } from "./ast";
import type {
  RuntimeMergeImport,
  TransformTailwindClassesOptions,
  TransformTailwindClassesResult,
} from "./types";

const DEFAULT_ATTRIBUTES = ["className"] as const;
const DEFAULT_RUNTIME_MERGE = {
  module: "tailwind-merge",
  exportName: "twMerge",
} as const satisfies Required<RuntimeMergeImport>;
const MERGE_IDENTIFIER = "__viteTailwindMerge";
const MERGE_VALUE_IDENTIFIER = "__viteTailwindMergeValue";
const MERGE_CALLBACKS_IDENTIFIER = "__viteTailwindMergeCallbacks";
const MERGE_ATTRIBUTES_IDENTIFIER = "__viteTailwindMergeAttributes";
const MERGE_PROPS_IDENTIFIER = "__viteTailwindMergeProps";
const IMPORT_NAME_PATTERN = /^[$A-Z_a-z][$\w]*$/u;

interface ResolvedTransformOptions {
  attributes: readonly string[];
  attributeSet: ReadonlySet<string>;
  dynamic: "skip" | "wrap";
  merge: (...classLists: string[]) => string;
  runtimeMerge: Required<RuntimeMergeImport>;
}

interface SourceRange {
  end: number;
  start: number;
}

interface RuntimeIdentifiers {
  attributes: string;
  callbacks: string;
  merge: string;
  props: string;
  value: string;
}

const getNodeName = (node: unknown): string | undefined => {
  if (typeof node !== "object" || node === null) return undefined;
  if ("name" in node && typeof node.name === "string") return node.name;
  if ("value" in node && typeof node.value === "string") return node.value;
  return undefined;
};

const getStaticString = (node: AstNode): string | undefined => {
  if (node.type === "Literal") {
    return typeof node.value === "string" ? node.value : undefined;
  }

  if (node.type === "TemplateLiteral") {
    const expressions = Array.isArray(node.expressions) ? node.expressions : [];
    if (expressions.length > 0 || !Array.isArray(node.quasis)) return undefined;

    return node.quasis
      .map((quasi) => {
        if (typeof quasi !== "object" || quasi === null || !("value" in quasi)) return "";
        const value = quasi.value;
        if (typeof value !== "object" || value === null) return "";
        if ("cooked" in value && typeof value.cooked === "string") return value.cooked;
        return "raw" in value && typeof value.raw === "string" ? value.raw : "";
      })
      .join("");
  }

  if (
    node.type === "BinaryExpression" &&
    node.operator === "+" &&
    typeof node.left === "object" &&
    node.left !== null &&
    typeof node.right === "object" &&
    node.right !== null
  ) {
    const left = getStaticString(node.left as AstNode);
    const right = getStaticString(node.right as AstNode);
    return left === undefined || right === undefined ? undefined : left + right;
  }

  return undefined;
};

const getLanguage = (id: string): ParserOptions["lang"] => {
  const cleanId = id.split("?", 1)[0] ?? id;
  if (/\.tsx$/i.test(cleanId)) return "tsx";
  if (/\.(?:ts|mts|cts)$/i.test(cleanId)) return "ts";
  return "jsx";
};

const createUniqueIdentifier = (source: string, usedIdentifiers: Set<string>, baseName: string) => {
  let suffix = 0;
  let candidate = baseName;

  while (usedIdentifiers.has(candidate) || new RegExp(`\\b${candidate}\\b`, "u").test(source)) {
    suffix += 1;
    candidate = `${baseName}${suffix}`;
  }

  usedIdentifiers.add(candidate);
  return candidate;
};

const createRuntimeIdentifiers = (
  source: string,
  usedIdentifiers: Set<string>,
): RuntimeIdentifiers => ({
  attributes: createUniqueIdentifier(source, usedIdentifiers, MERGE_ATTRIBUTES_IDENTIFIER),
  callbacks: createUniqueIdentifier(source, usedIdentifiers, MERGE_CALLBACKS_IDENTIFIER),
  merge: createUniqueIdentifier(source, usedIdentifiers, MERGE_IDENTIFIER),
  props: createUniqueIdentifier(source, usedIdentifiers, MERGE_PROPS_IDENTIFIER),
  value: createUniqueIdentifier(source, usedIdentifiers, MERGE_VALUE_IDENTIFIER),
});

const resolveOptions = (options: TransformTailwindClassesOptions): ResolvedTransformOptions => {
  const attributes = [...new Set(options.attributes ?? DEFAULT_ATTRIBUTES)];

  return {
    attributes,
    attributeSet: new Set(attributes),
    dynamic: options.dynamic ?? "wrap",
    merge: options.merge ?? twMerge,
    runtimeMerge: {
      module: options.runtimeMerge?.module ?? DEFAULT_RUNTIME_MERGE.module,
      exportName: options.runtimeMerge?.exportName ?? DEFAULT_RUNTIME_MERGE.exportName,
    },
  };
};

const getRuntimeInsertionPoint = (
  program: AstNode,
  comments: readonly SourceRange[],
  source: string,
) => {
  const body = Array.isArray(program.body) ? program.body : [];
  const hashbang =
    typeof program.hashbang === "object" && program.hashbang !== null
      ? (program.hashbang as SourceRange)
      : undefined;
  let insertionPoint = hashbang?.end ?? (source.charCodeAt(0) === 0xfeff ? 1 : 0);
  const firstStatementStart = body[0]?.start ?? source.length;

  for (const comment of comments) {
    if (comment.start >= firstStatementStart) break;
    if (source.slice(insertionPoint, comment.start).trim() !== "") break;
    insertionPoint = comment.end;
  }

  for (const statement of body) {
    if (!statement || typeof statement !== "object") break;
    if (statement.type !== "ImportDeclaration" && typeof statement.directive !== "string") break;
    insertionPoint = Math.max(insertionPoint, statement.end ?? insertionPoint);
  }

  return insertionPoint;
};

const createRuntimeImport = (
  runtimeMerge: Required<RuntimeMergeImport>,
  mergeIdentifier: string,
) => {
  if (runtimeMerge.module.trim() === "") {
    throw new Error("runtimeMerge.module must be a non-empty module specifier");
  }

  if (runtimeMerge.exportName === "default") {
    return `import ${mergeIdentifier} from ${JSON.stringify(runtimeMerge.module)};`;
  }

  if (!IMPORT_NAME_PATTERN.test(runtimeMerge.exportName)) {
    throw new Error(
      `runtimeMerge.exportName must be a JavaScript identifier or "default": ${JSON.stringify(runtimeMerge.exportName)}`,
    );
  }

  return `import { ${runtimeMerge.exportName} as ${mergeIdentifier} } from ${JSON.stringify(runtimeMerge.module)};`;
};

const createValueRuntime = ({
  callbacks,
  merge,
  value,
}: RuntimeIdentifiers) => `const ${callbacks} = new WeakMap();
const ${value} = (classValue) => {
  if (typeof classValue === "function") {
    const cached = ${callbacks}.get(classValue);
    if (cached) return cached;

    const wrapped = new Proxy(classValue, {
      apply(target, thisArgument, argumentsList) {
        return ${value}(Reflect.apply(target, thisArgument, argumentsList));
      },
    });
    ${callbacks}.set(classValue, wrapped);
    ${callbacks}.set(wrapped, wrapped);
    return wrapped;
  }

  if (typeof classValue === "string" || Array.isArray(classValue)) {
    return ${merge}(classValue);
  }

  return classValue;
};`;

const createPropsRuntime = (
  attributes: readonly string[],
  { attributes: attributesIdentifier, props, value }: RuntimeIdentifiers,
) => `const ${attributesIdentifier} = new Set(${JSON.stringify(attributes)});
const ${props} = (spreadValue) => {
  const valueType = typeof spreadValue;
  if (spreadValue === null || (valueType !== "object" && valueType !== "function")) {
    return spreadValue;
  }

  // Delay property reads until the downstream JSX transform enumerates the spread.
  return new Proxy({}, {
    ownKeys() {
      return Reflect.ownKeys(spreadValue);
    },
    getOwnPropertyDescriptor(_target, property) {
      const descriptor = Reflect.getOwnPropertyDescriptor(spreadValue, property);
      return descriptor ? { ...descriptor, configurable: true } : undefined;
    },
    get(_target, property) {
      const propertyValue = Reflect.get(spreadValue, property, spreadValue);
      return ${attributesIdentifier}.has(property) ? ${value}(propertyValue) : propertyValue;
    },
    has(_target, property) {
      return Reflect.has(spreadValue, property);
    },
  });
};`;

const wrapRange = (magicString: MagicString, range: SourceRange, helperName: string) => {
  magicString.appendLeft(range.start, `${helperName}(`);
  magicString.prependRight(range.end, ")");
};

/**
 * Merges every configured JSX class attribute and every JSX spread.
 *
 * Static strings are folded at transform time. In `wrap` mode, every other explicit value and
 * spread receives a runtime adapter, so expression syntax and function names never gate coverage.
 */
export const transformTailwindClasses = (
  source: string,
  id: string,
  userOptions: TransformTailwindClassesOptions = {},
): TransformTailwindClassesResult | undefined => {
  const options = resolveOptions(userOptions);
  if (options.attributes.length === 0) return undefined;

  const parsed = parseSync(id, source, {
    lang: getLanguage(id),
    range: true,
    sourceType: "module",
  });

  if (parsed.errors.length > 0) {
    throw new Error(`Unable to parse ${id} with OXC: ${JSON.stringify(parsed.errors[0])}`);
  }

  const program = parsed.program as unknown as AstNode;
  const magicString = new MagicString(source);
  const usedIdentifiers = new Set<string>();
  walkAst(program, (node) => {
    if (typeof node.name === "string") usedIdentifiers.add(node.name);
  });
  const runtimeIdentifiers = createRuntimeIdentifiers(source, usedIdentifiers);
  let changed = false;
  let needsPropsRuntime = false;
  let needsValueRuntime = false;

  walkAst(program, (node) => {
    if (node.type === "JSXSpreadAttribute") {
      if (options.dynamic === "skip") return;
      if (typeof node.argument !== "object" || node.argument === null) {
        throw new Error(`Unable to transform JSX spread in ${id}: missing spread expression`);
      }

      wrapRange(magicString, node.argument as AstNode, runtimeIdentifiers.props);
      changed = true;
      needsPropsRuntime = true;
      needsValueRuntime = true;
      return;
    }

    if (node.type !== "JSXAttribute") return;
    if (typeof node.name !== "object" || node.name === null) return;
    const attributeName = getNodeName(node.name);
    if (!attributeName || !options.attributeSet.has(attributeName)) return;
    if (typeof node.value !== "object" || node.value === null) {
      throw new Error(
        `Configured class attribute ${JSON.stringify(attributeName)} must have a value in ${id}`,
      );
    }

    const container = node.value as AstNode;
    const expression =
      container.type === "JSXExpressionContainer" &&
      typeof container.expression === "object" &&
      container.expression !== null
        ? (container.expression as AstNode)
        : container;

    if (expression.type === "JSXEmptyExpression") {
      throw new Error(
        `Configured class attribute ${JSON.stringify(attributeName)} must have a non-empty value in ${id}`,
      );
    }

    const staticClassName = getStaticString(expression);
    if (staticClassName !== undefined) {
      magicString.overwrite(
        container.start,
        container.end,
        JSON.stringify(options.merge(staticClassName)),
      );
      changed = true;
      return;
    }

    if (options.dynamic === "skip") return;
    if (container.type !== "JSXExpressionContainer") {
      throw new Error(
        `Configured class attribute ${JSON.stringify(attributeName)} has an unsupported JSX value in ${id}`,
      );
    }

    wrapRange(magicString, expression, runtimeIdentifiers.value);
    changed = true;
    needsValueRuntime = true;
  });

  if (!changed) return undefined;

  if (needsValueRuntime) {
    if (Boolean(userOptions.merge) !== Boolean(userOptions.runtimeMerge)) {
      throw new Error(
        "Custom build-time merge and runtimeMerge must be configured together when dynamic class values or JSX spreads are present",
      );
    }

    const comments = parsed.comments.filter(
      (comment): comment is (typeof parsed.comments)[number] & SourceRange =>
        typeof comment.start === "number" && typeof comment.end === "number",
    );
    const insertionPoint = getRuntimeInsertionPoint(program, comments, source);
    const runtimeParts = [
      createRuntimeImport(options.runtimeMerge, runtimeIdentifiers.merge),
      createValueRuntime(runtimeIdentifiers),
    ];

    if (needsPropsRuntime) {
      runtimeParts.push(createPropsRuntime(options.attributes, runtimeIdentifiers));
    }

    const prefix = insertionPoint === 0 ? "" : "\n";
    magicString.appendLeft(insertionPoint, `${prefix}${runtimeParts.join("\n\n")}\n`);
  }

  return {
    code: magicString.toString(),
    map: magicString.generateMap({
      hires: true,
      includeContent: true,
      source: id,
    }),
  };
};
