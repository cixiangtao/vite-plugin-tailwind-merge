import { createRequire } from "node:module";

import tailwindMergeEsm, { transformTailwindClasses as transformEsm } from "../dist/index.js";

const require = createRequire(import.meta.url);
const {
  default: tailwindMergeCjs,
  transformTailwindClasses: transformCjs,
} = require("../dist/index.cjs");

for (const createPlugin of [tailwindMergeEsm, tailwindMergeCjs]) {
  if (createPlugin().name !== "vite-plugin-tailwind-merge") {
    throw new Error("Distribution does not expose the Vite plugin as its default export");
  }
}

const cases = [
  [transformEsm, 'className="grid px-4"'],
  [transformCjs, 'className="flex"'],
];

const sources = [
  'export const App = () => <div className="flex grid px-2 px-4" />;',
  'export const App = () => <div className="block flex" />;',
];

for (const [index, [transform, expected]] of cases.entries()) {
  const result = transform(sources[index], `dist-smoke-${index}.tsx`);
  if (!result?.code.includes(expected)) {
    throw new Error(`Distribution smoke test failed for case ${index}`);
  }
}
