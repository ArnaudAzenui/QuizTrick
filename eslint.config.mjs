// ESLint flat config (ESLint 9). `next lint` is deprecated in Next 15.5 and
// removed in 16, so `npm run lint` calls the ESLint CLI directly.
// eslint-config-next 15.x still ships legacy (eslintrc) presets; FlatCompat
// adapts them. When upgrading to Next 16 / eslint-config-next 16, replace the
// compat block with its native flat exports:
//   import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
//   import nextTypescript from "eslint-config-next/typescript";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  { ignores: [".next/**", "out/**", "coverage/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default config;
