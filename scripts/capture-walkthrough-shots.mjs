// Screenshots of the real app for the landing page "Walk the desk" section.
//
// Run against a local server in public demo mode (seeded demo data):
//   npm run db:local   (one terminal)
//   npm run dev        (another)
//   node scripts/capture-walkthrough-shots.mjs [baseUrl]
//
// Each shot is cropped to the card that step talks about, in light and dark,
// and written to src/assets/walkthrough/<step>-<theme>.png. next/image serves
// them as AVIF/WebP at the size the page needs.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const OUT = join(process.cwd(), "src", "assets", "walkthrough");
const PAD = 16;

/** Nearest ancestor that looks like a card, so the crop has its own border. */
function card(locator) {
  return locator.locator(
    "xpath=ancestor-or-self::*[contains(@class,'rounded-2xl') or contains(@class,'rounded-xl')][1]",
  );
}

const SHOTS = [
  {
    id: "knowledge",
    width: 880,
    async target(page) {
      await page.goto(`${BASE}/knowledge`);
      return card(page.getByRole("heading", { name: "Documents", exact: true }));
    },
  },
  {
    id: "widget",
    width: 880,
    maxHeight: 440, // down to the cited source line
    async target(page) {
      await page.goto(`${BASE}/inbox`);
      await page.getByRole("link", { name: /How do I reset my password\?/ }).click();
      await page.waitForURL(/\/inbox\/.+/);
      return card(page.getByRole("heading", { name: "How do I reset my password?" }));
    },
  },
  {
    id: "escalate",
    width: 880,
    async target(page) {
      await page.goto(`${BASE}/inbox`);
      return page.locator("main ul").filter({ hasText: "Waiting for a human" }).first();
    },
  },
  {
    id: "logs",
    width: 880,
    async target(page) {
      await page.goto(`${BASE}/analytics`);
      return card(page.getByRole("heading", { name: "Knowledge gaps", exact: true }));
    },
  },
  {
    id: "hiring",
    width: 1120,
    maxHeight: 560,
    async target(page) {
      await page.goto(`${BASE}/hiring/compare?ids=maya-chen%2Cjordan-ellis`);
      return page.locator("#main-content > *").first();
    },
  },
];

async function settle(page) {
  await page.addStyleTag({
    content:
      "nextjs-portal{display:none!important}html{scrollbar-width:none}*{caret-color:transparent!important}",
  });
  await page.waitForLoadState("networkidle");
  await page
    .waitForFunction(() => !document.querySelector(".animate-shimmer"), null, { timeout: 15000 })
    .catch(() => {});
  await page.evaluate(() => document.fonts.ready);
}

mkdirSync(OUT, { recursive: true });
// Playwright's own Chromium if it is installed, else the local Chrome.
const browser = await chromium
  .launch()
  .catch(() => chromium.launch({ channel: "chrome" }));
try {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({
      colorScheme: theme,
      reducedMotion: "reduce",
      deviceScaleFactor: 2,
      viewport: { width: 1120, height: 900 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    for (const shot of SHOTS) {
      await page.setViewportSize({ width: shot.width, height: 900 });
      const target = await shot.target(page);
      await settle(page);
      // Page coordinates at scroll 0, so the sticky app header stays at the
      // top of the page and never lands over the card in the crop.
      await page.evaluate(() => window.scrollTo(0, 0));
      const box = await target.boundingBox();
      if (!box) throw new Error(`${shot.id}: target not visible`);
      const scrollY = 0;
      const height = Math.min(box.height, shot.maxHeight ?? box.height);
      const path = join(OUT, `${shot.id}-${theme}.png`);
      await page.screenshot({
        path,
        fullPage: true,
        clip: {
          x: Math.max(0, box.x - PAD),
          y: Math.max(0, box.y + scrollY - PAD),
          width: box.width + PAD * 2,
          height: height + PAD * 2,
        },
      });
      console.log(`${shot.id}-${theme}: ${Math.round(box.width)}x${Math.round(height)}`);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
