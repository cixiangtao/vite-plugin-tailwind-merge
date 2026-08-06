import { MagicString } from "magic-string";
import type { ParserOptions } from "oxc-parser";
import { parseSync } from "oxc-parser";
import { twMerge } from "tailwind-merge";

import { walkAst, type AstNode } from "./ast";
import type { TransformTailwindClassesOptions, TransformTailwindClassesResult } from "./types";

const DEFAULT_ATTRIBUTES = ["className"] as const;
const DEFAULT_FUNCTIONS = ["clsx", "classnames", "cn"] as const;
const DEFAULT_MERGE_FUNCTIONS = ["twMerge"] as const;
const RUNTIME_MODULE = "tailwind-merge";
const RUNTIME_IMPORT_NAME = "twMerge";
const HELPER_NAME = "__viteTailwindMerge";

interface ResolvedTransformOptions {
  attributes: ReadonlySet<string>;
  dynamic: "skip" | "wrap";
  functions: ReadonlySet<string>;
  merge: (...classLists: string[]) => string;
  mergeFunctions: ReadonlySet<string>;
}

interface ImportBinding {
  imported: string;
  local: string;
  source: string;
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

const getCalleeName = (node: AstNode): string | undefined => {
  if (node.type !== "CallExpression" || typeof node.callee !== "object" || !node.callee) {
    return undefined;
  }

  const callee = node.callee as AstNode;
  if (callee.type === "Identifier") return getNodeName(callee);

  if (
    callee.type === "MemberExpression" &&
    typeof callee.property === "object" &&
    callee.property !== null
  ) {
    return getNodeName(callee.property);
  }

  return undefined;
};

const isDynamicComposition = (node: AstNode, options: ResolvedTransformOptions) => {
  if (
    node.type === "TemplateLiteral" ||
    node.type === "BinaryExpression" ||
    node.type === "LogicalExpression" ||
    node.type === "ConditionalExpression" ||
    node.type === "ArrayExpression"
  ) {
    return true;
  }

  if (node.type !== "CallExpression") return false;
  const calleeName = getCalleeName(node);
  return calleeName !== undefined && options.functions.has(calleeName);
};

const collectImportBindings = (program: AstNode) => {
  const bindings: ImportBinding[] = [];
  const body = Array.isArray(program.body) ? program.body : [];

  for (const statement of body) {
    if (!statement || typeof statement !== "object" || statement.type !== "ImportDeclaration") {
      continue;
    }

    const source = getNodeName(statement.source);
    if (!source || !Array.isArray(statement.specifiers)) continue;

    for (const specifier of statement.specifiers) {
      if (!specifier || typeof specifier !== "object") continue;
      const local = getNodeName(specifier.local);
      if (!local) continue;

      if (specifier.type === "ImportNamespaceSpecifier") {
        bindings.push({ imported: "*", local, source });
        continue;
      }

      const imported = getNodeName(specifier.imported);
      if (imported) bindings.push({ imported, local, source });
    }
  }

  return bindings;
};

const getImportInsertionPoint = (program: AstNode) => {
  const body = Array.isArray(program.body) ? program.body : [];
  let insertionPoint = 0;

  for (const statement of body) {
    if (!statement || typeof statement !== "object") continue;
    if (statement.type === "ImportDeclaration" || typeof statement.directive === "string") {
      insertionPoint = Math.max(insertionPoint, statement.end ?? 0);
    }
  }

  return insertionPoint;
};

const getLanguage = (id: string): ParserOptions["lang"] => {
  const cleanId = id.split("?", 1)[0] ?? id;
  if (/\.tsx$/i.test(cleanId)) return "tsx";
  if (/\.(?:ts|mts|cts)$/i.test(cleanId)) return "ts";
  return "jsx";
};

const createUniqueHelperName = (source: string) => {
  let suffix = 0;
  let candidate = HELPER_NAME;

  while (new RegExp(`\\b${candidate}\\b`, "u").test(source)) {
    suffix += 1;
    candidate = `${HELPER_NAME}${suffix}`;
  }

  return candidate;
};

const resolveOptions = (options: TransformTailwindClassesOptions): ResolvedTransformOptions => ({
  attributes: new Set(options.attributes ?? DEFAULT_ATTRIBUTES),
  dynamic: options.dynamic ?? "wrap",
  functions: new Set(options.functions ?? DEFAULT_FUNCTIONS),
  merge: options.merge ?? twMerge,
  mergeFunctions: new Set(options.mergeFunctions ?? DEFAULT_MERGE_FUNCTIONS),
});

/**
 * Merges static Tailwind classes and wraps supported dynamic class compositions.
 *
 * Static class strings are folded at build time. Dynamic expressions are only wrapped when they
 * are clearly composing multiple class sources, leaving CSS Modules and simple identifiers alone.
 */
export const transformTailwindClasses = (
  source: string,
  id: string,
  userOptions: TransformTailwindClassesOptions = {},
): TransformTailwindClassesResult | undefined => {
  const options = resolveOptions(userOptions);
  if (![...options.attributes].some((attribute) => source.includes(attribute))) return undefined;

  const parsed = parseSync(id, source, {
    lang: getLanguage(id),
    range: true,
    sourceType: "module",
  });

  if (parsed.errors.length > 0) {
    throw new Error(`Unable to parse ${id} with OXC: ${JSON.stringify(parsed.errors[0])}`);
  }

  const program = parsed.program as unknown as AstNode;
  const imports = collectImportBindings(program);
  const importedMergeBinding = imports.find(
    ({ imported, source: importSource }) =>
      importSource === RUNTIME_MODULE && imported === RUNTIME_IMPORT_NAME,
  );
  const mergeFunctionNames = new Set(options.mergeFunctions);
  if (importedMergeBinding) mergeFunctionNames.add(importedMergeBinding.local);

  const magicString = new MagicString(source);
  const helperName = importedMergeBinding?.local ?? createUniqueHelperName(source);
  let changed = false;
  let needsRuntimeImport = false;

  walkAst(program, (node) => {
    if (node.type !== "JSXAttribute") return;
    if (typeof node.name !== "object" || node.name === null) return;
    const attributeName = getNodeName(node.name);
    if (!attributeName || !options.attributes.has(attributeName)) return;
    if (typeof node.value !== "object" || node.value === null) return;

    const container = node.value as AstNode;
    const expression =
      container.type === "JSXExpressionContainer" &&
      typeof container.expression === "object" &&
      container.expression !== null
        ? (container.expression as AstNode)
        : container;

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

    if (options.dynamic === "skip" || container.type !== "JSXExpressionContainer") return;
    const calleeName = getCalleeName(expression);
    if (calleeName && mergeFunctionNames.has(calleeName)) return;
    if (!isDynamicComposition(expression, options)) return;

    const originalExpression = source.slice(expression.start, expression.end);
    magicString.overwrite(expression.start, expression.end, `${helperName}(${originalExpression})`);
    changed = true;
    needsRuntimeImport = importedMergeBinding === undefined;
  });

  if (!changed) return undefined;

  if (needsRuntimeImport) {
    const insertionPoint = getImportInsertionPoint(program);
    const prefix = insertionPoint === 0 ? "" : "\n";
    magicString.appendLeft(
      insertionPoint,
      `${prefix}import { twMerge as ${helperName} } from ${JSON.stringify(RUNTIME_MODULE)};\n`,
    );
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
