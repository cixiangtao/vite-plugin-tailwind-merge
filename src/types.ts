import type { FilterPattern } from "@rollup/pluginutils";
import type { SourceMap } from "magic-string";

export type DynamicClassHandling = "skip" | "wrap";

export interface TransformTailwindClassesOptions {
  /** JSX attribute names to inspect. */
  attributes?: readonly string[];
  /** Function calls whose dynamic results should be merged. */
  functions?: readonly string[];
  /** How to handle class expressions that cannot be evaluated at build time. */
  dynamic?: DynamicClassHandling;
  /** Additional function names that already perform Tailwind conflict resolution. */
  mergeFunctions?: readonly string[];
  /** Custom merge implementation, such as one created by `extendTailwindMerge`. */
  merge?: (...classLists: string[]) => string;
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
