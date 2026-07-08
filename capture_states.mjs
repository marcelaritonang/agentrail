// Zero-dep screenshot capture of the 3 key ApplyMate states via CDP.
// Chrome must already run with --remote-debugging-port=9222.
import { writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:8000/";
const DBG = "http://127.0.0.1:9222";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pageTarget() {
  for (let i = 0; i < 20; i++) {
    try {
      const list = await (await fetch(`${DBG}/json`)).json();
      const t = list.find((x) => x.type === "page" && x.webSocketDebuggerUrl);
      if (t) return t;
    } catch {}
    await sleep(300);
  }
  throw new Error("no page target");
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  });
  const ready = new Promise((res) => ws.addEventListener("open", () => res()));
  function send(method, params = {}) {
    return new Promise((res) => { const myId = ++id; pending.set(myId, res); ws.send(JSON.stringify({ id: myId, method, params })); });
  }
  async function evaluate(expr) {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result?.result?.value;
  }
  async function shot(path, w, h) {
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile: false });
    await sleep(400);
    const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    writeFileSync(path, Buffer.from(r.result.data, "base64"));
    console.log("saved", path);
  }
  return { ready, send, evaluate, shot, close: () => ws.close() };
}

async function main() {
  const t = await pageTarget();
  const cdp = connect(t.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  // 1 — Landing (desktop)
  await cdp.send("Page.navigate", { url: BASE });
  for (let i = 0; i < 40; i++) {
    if ((await cdp.evaluate("document.readyState")) === "complete" &&
        (await cdp.evaluate("!!document.getElementById('landing')"))) break;
    await sleep(200);
  }
  await sleep(500);
  await cdp.shot("state_1_landing.png", 1440, 1024);

  // 2 — Workspace / generate (click a card, fill nothing — capture empty workspace)
  await cdp.evaluate("document.querySelector('[data-enter=\"cover_letter\"]').click()");
  await sleep(500);
  await cdp.shot("state_2_workspace.png", 1440, 1024);

  // 3 — Tracker
  await cdp.evaluate("document.querySelector('.nav-item[data-view=\"tracker\"]').click()");
  await sleep(500);
  await cdp.shot("state_3_tracker.png", 1440, 1024);

  // 4 — Landing on mobile (375)
  await cdp.send("Page.navigate", { url: BASE });
  await sleep(800);
  await cdp.shot("state_4_landing_mobile.png", 390, 844);

  cdp.close();
  process.exit(0);
}
main().catch((e) => { console.error("CAPTURE ERROR:", e.message); process.exit(2); });
