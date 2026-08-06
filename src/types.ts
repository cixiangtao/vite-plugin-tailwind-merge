import type { FilterPattern } from "@rollup/pluginutils";
import type { SourceMap } from "magic-string";

export type DynamicClassHandling = "skip" | "wrap";

export interface RuntimeMergeImport {
  /** Module specifier that exports the runtime merge function. */
  module: string;
  /** Named export to import, or `default` for a default export. @defaultValue `twMerge` */
  exportName?: string;
}

export interface TransformTailwindClassesOptions {
  /** JSX attribute names to merge explicitly and inside JSX spreads. */
  attributes?: readonly string[];
  /** @deprecated Dynamic coverage no longer depends on function names. */
  functions?: readonly string[];
  /** Whether every non-static class value and JSX spread receives runtime coverage. */
  dynamic?: DynamicClassHandling;
  /** @deprecated Existing merge calls are safely covered again instead of guessed by name. */
  mergeFunctions?: readonly string[];
  /** Custom merge implementation, such as one created by `extendTailwindMerge`. */
  merge?: (...classLists: string[]) => string;
  /** Runtime import used for dynamic class values and JSX spreads. */
  runtimeMerge?: RuntimeMergeImport;
}

export interface ViteTailwindMergePluginOptions extends TransformTailwindClassesOptions {
  /** Files passed to the source transformer. */
  include?: FilterPattern;
  /** Files excluded from the source transformer. */
  exclude?: FilterPattern;
}

export interface TransformTailwindClassesResult {
  code: string;
  map: SourceMap;
}
