// Bundles the app into one self-contained HTML file.
//
// The modules have no circular dependencies, so concatenating them in
// dependency order and stripping the import/export keywords is enough — no
// bundler, and the source stays plain ES modules for development.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const MODULE_ORDER = ["rng", "lexicon", "worldgen", "beats", "generator", "store", "ai", "app"];

function stripModuleSyntax(source, name) {
    return source
        // Drop `import { a, b } from "./x.js";` and side-effect imports.
        .replace(/^\s*import\s+[^;]*?from\s+["'][^"']+["'];?\s*$/gm, "")
        .replace(/^\s*import\s+["'][^"']+["'];?\s*$/gm, "")
        // `export const x` -> `const x`, `export function f` -> `function f`.
        .replace(/^export\s+(?=(const|let|var|function|class|async)\b)/gm, "")
        .replace(/^export\s*\{[^}]*\};?\s*$/gm, "")
        .trim()
        .concat(`\n// ---- end ${name}.js ----\n`);
}

async function build() {
    const html = await readFile(join(root, "index.html"), "utf8");
    const css = await readFile(join(root, "style.css"), "utf8");

    const modules = [];
    for (const name of MODULE_ORDER) {
        const source = await readFile(join(root, "js", `${name}.js`), "utf8");
        modules.push(stripModuleSyntax(source, name));
    }

    const bundled = html
        .replace('<link rel="stylesheet" href="./style.css">', `<style>\n${css}\n</style>`)
        .replace(
            '<script type="module" src="./js/app.js"></script>',
            `<script type="module">\n${modules.join("\n\n")}\n</script>`
        );

    await mkdir(join(root, "dist"), { recursive: true });
    const out = join(root, "dist", "chronicler.html");
    await writeFile(out, bundled, "utf8");
    console.log(`built ${out} (${(bundled.length / 1024).toFixed(1)} KB)`);
}

build().catch((err) => {
    console.error(err);
    process.exit(1);
});
