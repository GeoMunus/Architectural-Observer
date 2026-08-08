import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { build, context } from "esbuild";

const watch = process.argv.includes("--watch");
const dev = watch || process.argv.includes("--dev");
const outDir = "www";

const buildOptions = {
    entryPoints: ["src/js/main.js"],
    bundle: true,
    format: "esm",
    // Android System WebView is updated through the Play Store, but this target keeps
    // the bundle working on older, un-updated devices too.
    target: ["chrome87", "es2020"],
    minify: !dev,
    sourcemap: dev ? "inline" : false,
    outfile: `${outDir}/app.js`,
    logLevel: "info"
};

async function copyStaticAssets() {
    const html = await readFile("src/index.html", "utf8");
    await writeFile(`${outDir}/index.html`, html.replace("./js/main.js", "./app.js"));
    await cp("src/styles", `${outDir}/styles`, { recursive: true });
    await cp("src/assets", `${outDir}/assets`, { recursive: true });
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await copyStaticAssets();

if (watch) {
    const ctx = await context(buildOptions);
    await ctx.watch();
    console.log("esbuild watching src/js — rerun `npm run build` for HTML/CSS changes.");
} else {
    await build(buildOptions);
    console.log(`built ${outDir}/ (${dev ? "development" : "production"})`);
}
