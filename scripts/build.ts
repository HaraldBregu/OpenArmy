import esbuild from "esbuild";
import fs from "fs";
import path from "path";

const isWatch = process.argv.includes("--watch");

const config: esbuild.BuildOptions = {
  entryPoints: ["src/index.ts"],
  outfile: "dist/oa.js",
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
};

async function build() {
  try {
    if (isWatch) {
      const ctx = await esbuild.context(config);
      await ctx.watch();
      console.log("Building in watch mode...");
    } else {
      await esbuild.build(config);
      console.log("Build successful!");

      // Make dist/oa.js executable
      try {
        fs.chmodSync("dist/oa.js", 0o755);
      } catch {
        // Windows doesn't support chmod, ignore
      }
    }
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

build();
