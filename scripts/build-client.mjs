import { build, context } from "esbuild";
import { readFile } from "node:fs/promises";
import process from "node:process";

const options = {
  entryPoints: ["src/client/index.js"],
  outfile: "lib/client.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  legalComments: "none",
  charset: "utf8",
  sourcemap: false,
};

if (process.argv.includes("--watch")) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("watching src/client -> lib/client.js");
} else {
  await build(options);
  const output = await readFile(options.outfile, "utf8");
  if (!output.includes('id: "dsh-skins"') || !output.includes("window.__ModuleLoader__.load")) {
    throw new Error("generated client bundle is missing the DSH module wrapper");
  }
  console.log(`built ${options.outfile} (${Buffer.byteLength(output)} bytes)`);
}
