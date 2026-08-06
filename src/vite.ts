import { createFilter } from "@rollup/pluginutils";
import type { Plugin } from "vite";

import { transformTailwindClasses } from "./transform";
import type { ViteTailwindMergePluginOptions } from "./types";

const DEFAULT_INCLUDE = /\.[cm]?[jt]sx?(?:\?.*)?$/u;
const DEFAULT_EXCLUDE = [/node_modules/u, /\.d\.ts(?:\?.*)?$/u];

/** Applies Tailwind class conflict resolution before Vite's framework transforms. */
const tailwindMerge = (options: ViteTailwindMergePluginOptions = {}): Plugin => {
  const filter = createFilter(
    options.include ?? DEFAULT_INCLUDE,
    options.exclude ?? DEFAULT_EXCLUDE,
  );

  return {
    name: "vite-plugin-tailwind-merge",
    enforce: "pre",
    transform(code, id) {
      if (!filter(id)) return undefined;
      return transformTailwindClasses(code, id, options);
    },
  };
};

export { tailwindMerge };
export default tailwindMerge;
