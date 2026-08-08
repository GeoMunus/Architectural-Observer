import { chromium } from "playwright";

const shots = process.argv[2] || "/tmp/claude-0/-home-user-Architectural-Observer/d337d76b-128a-50c7-a3d5-27cdb7dc8b48/scratchpad/shots";
// The fake device lets the camera-vision path run end to end without real hardware.
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium",
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"]
});
const page = await browser.newPage({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36"
});

const errors = [];
page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
page.on("console", (msg) => { if (msg.type() === "error") errors.push(`console: ${msg.text()}`); });

await page.goto("http://127.0.0.1:5173/index.html", { waitUntil: "networkidle" });
await page.waitForTimeout(600);

const readState = () => page.evaluate(() => ({
  cycle: window.observerWorld?.cycle,
  objects: window.observerWorld?.objects.length,
  concepts: window.observerWorld?.concepts.length,
  goals: window.observerWorld?.goals.length,
  memories: window.observerWorld?.memories.length,
  mode: window.observerWorld?.context.mode,
  graphNodes: document.querySelectorAll("#graphSvg circle").length,
  actions: document.querySelectorAll("#actionsList li").length
}));

console.log("after boot:", JSON.stringify(await readState()));
await page.screenshot({ path: `${shots}/01-observe.png` });

// Run a cycle
await page.click("#runCycleBtn");
await page.waitForTimeout(300);
console.log("after cycle:", JSON.stringify(await readState()));

// Graph tab
await page.click('[data-tab="graph"]');
await page.waitForTimeout(400);
await page.screenshot({ path: `${shots}/02-graph.png` });
const graphNodes = await page.locator("#graphSvg circle").count();
console.log("graph circles:", graphNodes);

// Tap a node via touch on its centre
const box = await page.locator("#graphSvg").boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.10);
await page.waitForTimeout(200);
console.log("inspector:", await page.locator("#selectedNodeLabel").textContent(), "|", (await page.locator("#selectedNodeDetail").textContent()).slice(0, 60));

// Streams tab + segment switching
await page.click('[data-tab="streams"]');
await page.waitForTimeout(300);
await page.screenshot({ path: `${shots}/03-streams.png` });
await page.click('[data-stream="memories"]');
await page.waitForTimeout(200);
console.log("memories rows:", await page.locator("#memoriesList li").count());
await page.click('[data-stream="concepts"]');
await page.waitForTimeout(200);
console.log("concepts rows:", await page.locator("#conceptsList li").count());

// Chat tab
await page.click('[data-tab="chat"]');
await page.waitForTimeout(300);
await page.fill("#chatInput", "What do you see?");
await page.click("#sendChatBtn");
await page.waitForTimeout(300);
await page.click('[data-prompt="What are the risks?"]');
await page.waitForTimeout(300);
await page.screenshot({ path: `${shots}/04-chat.png` });
console.log("chat messages:", await page.locator(".chat-msg").count());
console.log("last reply:", (await page.locator(".chat-msg-body").last().textContent()).slice(0, 90));

// Auto cycle
await page.click('[data-tab="observe"]');
await page.click("#autoCycleBtn");
await page.waitForTimeout(5600);
await page.click("#autoCycleBtn");
const auto = await readState();
console.log("after auto:", JSON.stringify(auto));

// Persistence across reload
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(700);
const reloaded = await readState();
console.log("after reload:", JSON.stringify(reloaded));
console.log("chat restored:", await page.locator(".chat-msg").count());

// Horizontal overflow check on every tab
for (const tab of ["observe", "graph", "streams", "chat"]) {
  await page.click(`[data-tab="${tab}"]`);
  await page.waitForTimeout(250);
  const overflow = await page.evaluate(() => ({
    docScroll: document.documentElement.scrollWidth,
    inner: window.innerWidth,
    bodyScroll: document.body.scrollWidth
  }));
  console.log(`overflow[${tab}]:`, JSON.stringify(overflow));
}

// Camera vision against Chromium's fake capture device
await page.click('[data-tab="observe"]');
await page.click("#toggleCameraBtn");
await page.waitForTimeout(1500);
await page.click("#runCycleBtn");
await page.waitForTimeout(400);
const camera = await page.evaluate(() => {
  const w = window.observerWorld;
  return {
    mode: w.context.mode,
    zones: w.objects.filter((o) => o.type === "Zone").length,
    frames: w.objects.filter((o) => o.type === "Frame").length,
    events: w.events.map((e) => e.type),
    motion: w.telemetry.motionScore,
    litCells: [...document.querySelectorAll("#cameraGrid i")]
      .filter((c) => c.style.backgroundColor && c.style.backgroundColor !== "transparent").length,
    stageActive: document.getElementById("cameraStage").dataset.active
  };
});
console.log("camera vision:", JSON.stringify(camera));
await page.screenshot({ path: `${shots}/06-camera.png` });
await page.click("#toggleCameraBtn");
await page.waitForTimeout(400);
console.log("after camera stop, mode:", await page.evaluate(() => window.observerWorld.context.mode));

// Landscape
await page.setViewportSize({ width: 852, height: 393 });
await page.click('[data-tab="observe"]');
await page.waitForTimeout(300);
await page.screenshot({ path: `${shots}/05-landscape.png` });

console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no page errors");
await browser.close();
