import type { Node } from "@oxc-project/types";

type AstNode = Node & Record<string, unknown>;

export const isAstNode = (value: unknown): value is AstNode =>
  typeof value === "object" &&
  value !== null &&
  "type" in value &&
  typeof value.type === "string" &&
  "start" in value &&
  typeof value.start === "number" &&
  "end" in value &&
  typeof value.end === "number";

/** Walks an OXC AST without depending on a framework-specific visitor package. */
export const walkAst = (root: unknown, visit: (node: AstNode) => void) => {
  const visited = new WeakSet<object>();

  const walk = (value: unknown) => {
    if (typeof value !== "object" || value === null || visited.has(value)) return;
    visited.add(value);

    if (isAstNode(value)) visit(value);

    if (Array.isArray(value)) {
      for (const child of value) walk(child);
      return;
    }

    for (const child of Object.values(value)) walk(child);
  };

  walk(root);
};

export type { AstNode };
