// docker-stack-gate-round-trip.mjs - one gated app's estate gate end to end, in
// Chromium and Playwright WebKit (ADR 0093): a signed-out deep link meets the
// gate's real 302, signs in and picks at hub, and lands back on the same URL
// with its fragment byte for byte; `/shared` opens with no session and writes
// nothing to localStorage; assets, /api and /health are not gated.
//
//   docker compose up -d --build family hub boop
//   node scripts/docker-stack-gate-round-trip.mjs                       # boop
//   node scripts/docker-stack-gate-round-trip.mjs http://localhost:8091 # another app
//   FRAGMENT='#w=%7B%7D' node scripts/docker-stack-gate-round-trip.mjs ...
//   NO_SHARED=1 node scripts/docker-stack-gate-round-trip.mjs ...       # an app with no /shared
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

import { registerWithChild, STACK } from "./docker-stack-sign-in.mjs";

const require = createRequire(
  new URL("../apps/hub/package.json", import.meta.url),
);
const { chromium, webkit } = require("@playwright/test");

const TIMEOUT = 15_000;
// Percent escapes by default, since a router that decodes the address bar is what this guards against.
const DEFAULT_FRAGMENT = "#g=%7B%22a%22%3A1%7D";
const HAS_SHARED = !process.env.NO_SHARED;

function check(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`  ok - ${message}`);
}

async function roundTrip(browser, app, fragment) {
  const context = await browser.newContext();
  const arrivals = [];
  await context.exposeBinding("__recordArrival", (_source, href) =>
    arrivals.push(href),
  );
  // Every document's address before any of its scripts run, so before its router can rewrite it.
  await context.addInitScript(() => {
    if (window.location.protocol.startsWith("http"))
      window.__recordArrival(window.location.href);
  });
  const page = await context.newPage();

  const deep = `${app}/some/deep/path?x=1`;
  const landed = await page.goto(`${deep}${fragment}`);
  const gate = await landed.request().redirectedFrom()?.response();
  const expectedLocation = `${STACK.hub}/account?returnTo=${encodeURIComponent(deep)}`;
  check(gate?.status() === 302, `signed out, ${deep} answers 302`);
  check(
    gate.headers().location === expectedLocation,
    `the 302 goes to ${expectedLocation}`,
  );
  check(gate.headers()["cache-control"] === "no-store", "the 302 is no-store");
  check(
    arrivals[0] === `${expectedLocation}${fragment}`,
    "hub first loads with the fragment, byte for byte",
  );

  await registerWithChild(page);
  await page.getByRole("button", { name: "Robin", exact: true }).click();
  await page.waitForURL((url) => url.href.startsWith(app), {
    timeout: TIMEOUT,
  });
  check(
    arrivals.at(-1) === `${deep}${fragment}`,
    `after the pick the app first loads on ${deep}${fragment}, byte for byte`,
  );
  await context.close();
}

async function sharedView(browser, app, fragment) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const failed = [];
  page.on("response", (r) => {
    if (r.url().startsWith(app) && r.status() >= 400)
      failed.push(`${r.status()} ${r.url()}`);
  });
  const response = await page.goto(`${app}/shared${fragment}`);
  check(
    response.status() === 200 && response.request().redirectedFrom() === null,
    "/shared opens signed out, no redirect",
  );
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3_000);
  const storedNow = await page.evaluate(() => window.localStorage.length);
  await page.reload();
  const storedAfterReload = await page.evaluate(
    () => window.localStorage.length,
  );
  check(
    storedNow === 0 && storedAfterReload === 0,
    "/shared wrote nothing to localStorage, before or after a reload",
  );
  check(
    failed.length === 0,
    `every request /shared made succeeded${failed.length ? `: ${failed.join(", ")}` : ""}`,
  );
  await context.close();
}

async function ungated(browser, app) {
  const context = await browser.newContext();
  const get = (path) =>
    context.request.get(`${app}${path}`, { maxRedirects: 0 });
  check((await get("/")).status() === 302, "/ is gated");
  if (HAS_SHARED) {
    const shell = await (await get("/shared")).text();
    const asset = shell.match(/src="(\/assets\/[^"]+)"/)?.[1];
    const assetResponse = asset ? await get(asset) : null;
    check(
      assetResponse?.status() === 200 &&
        !assetResponse.headers()["content-type"].includes("html"),
      `the bundle ${asset} is served signed out`,
    );
  } else {
    // No public page to read the bundle's name from, so an asset-shaped path stands in.
    check(
      (await get("/shared")).status() === 302,
      "/shared is gated like any page",
    );
    check(
      (await get("/assets/missing.js")).status() !== 302,
      "an asset path is not gated",
    );
  }
  check((await get("/api/trpc/nothing")).status() !== 302, "/api is not gated");
  check((await get("/health")).status() === 200, "/health is not gated");
  await context.close();
}

async function main() {
  const app = process.argv[2] ?? STACK.boop;
  const fragment = process.env.FRAGMENT ?? DEFAULT_FRAGMENT;
  let failures = 0;
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch({ headless: !process.env.HEADED });
    console.log(
      `${engine.name()} ${browser.version()} against ${app}, fragment ${fragment}`,
    );
    for (const step of HAS_SHARED
      ? [roundTrip, sharedView, ungated]
      : [roundTrip, ungated]) {
      try {
        await step(browser, app, fragment);
      } catch (error) {
        failures++;
        console.error(`  FAILED (${step.name}): ${error.message}`);
      }
    }
    await browser.close();
  }
  console.log(
    failures === 0
      ? "gate round trip: OK"
      : `gate round trip: ${failures} FAILED`,
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
