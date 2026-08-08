import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

/**
 * Rasterizes the Observer AO mark into every density Android asks for.
 * Chromium is already available for the smoke test, so it doubles as the
 * rasterizer and the project needs no native image dependency.
 */

const BRAND = {
    dark: "#08120f",
    mid: "#0f2a22",
    deep: "#143229",
    accent: "#8df6a6",
    accent2: "#59dfd4",
    accent3: "#9fd0ff"
};

/** The observer's eye, drawn over the architectural graph it builds. */
function markSvg({ size, inset = 0.18, withBackground = true, rounded = false }) {
    const scale = 1 - (inset * 2);
    const offset = inset * 512;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="30%" cy="18%" r="90%">
      <stop offset="0%" stop-color="#1b4335"/>
      <stop offset="55%" stop-color="${BRAND.mid}"/>
      <stop offset="100%" stop-color="${BRAND.dark}"/>
    </radialGradient>
    <linearGradient id="iris" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BRAND.accent2}"/>
      <stop offset="100%" stop-color="${BRAND.accent}"/>
    </linearGradient>
  </defs>
  ${withBackground
        ? rounded
            ? `<circle cx="256" cy="256" r="256" fill="url(#bg)"/>`
            : `<rect width="512" height="512" rx="112" fill="url(#bg)"/>`
        : ""}
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <g fill="none" stroke="${BRAND.accent}" stroke-opacity="0.32" stroke-width="9" stroke-linecap="round">
      <path d="M108 150 L256 236 L404 150"/>
      <path d="M108 362 L256 276 L404 362"/>
      <path d="M108 150 L108 362M404 150 L404 362"/>
    </g>
    <g fill="${BRAND.accent2}" fill-opacity="0.9">
      <circle cx="108" cy="150" r="20"/>
      <circle cx="404" cy="150" r="20"/>
      <circle cx="108" cy="362" r="20"/>
      <circle cx="404" cy="362" r="20"/>
    </g>
    <path d="M52 256s78-116 204-116 204 116 204 116-78 116-204 116S52 256 52 256Z"
          fill="${BRAND.dark}" fill-opacity="0.72"
          stroke="${BRAND.accent}" stroke-width="18" stroke-linejoin="round"/>
    <circle cx="256" cy="256" r="72" fill="url(#iris)"/>
    <circle cx="256" cy="256" r="30" fill="${BRAND.dark}"/>
    <circle cx="286" cy="222" r="13" fill="${BRAND.accent3}" fill-opacity="0.95"/>
  </g>
</svg>`;
}

function splashSvg(size) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="sky" cx="50%" cy="38%" r="70%">
      <stop offset="0%" stop-color="#16362c"/>
      <stop offset="60%" stop-color="${BRAND.dark}"/>
      <stop offset="100%" stop-color="#050b09"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#sky)"/>
  <g opacity="0.16" stroke="${BRAND.accent}" stroke-width="1.5">
    ${Array.from({ length: 21 }, (_, i) => `<path d="M0 ${i * 51.2} H1024"/><path d="M${i * 51.2} 0 V1024"/>`).join("")}
  </g>
  <g transform="translate(256 236) scale(1)">
    ${markSvg({ size: 512, inset: 0.1, withBackground: false }).replace(/<svg[^>]*>|<\/svg>/g, "")}
  </g>
  <text x="512" y="836" text-anchor="middle" fill="${BRAND.accent}" font-family="monospace"
        font-size="46" letter-spacing="10">OBSERVER AO</text>
  <text x="512" y="890" text-anchor="middle" fill="#a9cdb9" font-family="sans-serif" font-size="30">
    Architectural Observer
  </text>
</svg>`;
}

const ANDROID_RES = "android/app/src/main/res";

// Launcher icon sizes per density, plus the 108dp adaptive foreground.
const DENSITIES = [
    { dir: "mdpi", legacy: 48, adaptive: 108 },
    { dir: "hdpi", legacy: 72, adaptive: 162 },
    { dir: "xhdpi", legacy: 96, adaptive: 216 },
    { dir: "xxhdpi", legacy: 144, adaptive: 324 },
    { dir: "xxxhdpi", legacy: 192, adaptive: 432 }
];

const SPLASH_SIZES = [
    { dir: "drawable", size: 480 },
    { dir: "drawable-land-mdpi", size: 480 },
    { dir: "drawable-land-hdpi", size: 800 },
    { dir: "drawable-land-xhdpi", size: 1280 },
    { dir: "drawable-land-xxhdpi", size: 1600 },
    { dir: "drawable-land-xxxhdpi", size: 1920 },
    { dir: "drawable-port-mdpi", size: 480 },
    { dir: "drawable-port-hdpi", size: 800 },
    { dir: "drawable-port-xhdpi", size: 1280 },
    { dir: "drawable-port-xxhdpi", size: 1600 },
    { dir: "drawable-port-xxxhdpi", size: 1920 }
];

const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium"
});
const page = await browser.newPage();

async function rasterize(svg, size, outPath) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
        `<style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style>${svg}`,
        { waitUntil: "load" }
    );
    await page.screenshot({ path: outPath, omitBackground: true });
    console.log(`  ${outPath} (${size}px)`);
}

console.log("Launcher icons:");
for (const density of DENSITIES) {
    const dir = `${ANDROID_RES}/mipmap-${density.dir}`;
    await mkdir(dir, { recursive: true });
    await rasterize(markSvg({ size: density.legacy }), density.legacy, `${dir}/ic_launcher.png`);
    await rasterize(markSvg({ size: density.legacy, rounded: true }), density.legacy, `${dir}/ic_launcher_round.png`);
    // The adaptive foreground keeps art inside the 66% safe zone the launcher may mask.
    await rasterize(
        markSvg({ size: density.adaptive, inset: 0.28, withBackground: false }),
        density.adaptive,
        `${dir}/ic_launcher_foreground.png`
    );
}

console.log("Splash screens:");
for (const splash of SPLASH_SIZES) {
    const dir = `${ANDROID_RES}/${splash.dir}`;
    await mkdir(dir, { recursive: true });
    await rasterize(splashSvg(splash.size), splash.size, `${dir}/splash.png`);
}

console.log("Web icons:");
await mkdir("src/assets/icons", { recursive: true });
for (const size of [180, 192, 512]) {
    await rasterize(markSvg({ size }), size, `src/assets/icons/icon-${size}.png`);
}
await writeFile("src/assets/icons/icon.svg", markSvg({ size: 512 }));
console.log("  src/assets/icons/icon.svg");

await browser.close();
console.log("icons generated");
