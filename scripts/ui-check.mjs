#!/usr/bin/env node
// Fallback for the Playwright MCP in the workflow's UI verification step.
// Usage: node scripts/ui-check.mjs --path /route [--path ...] [--email x]
// Credentials: UI_CHECK_EMAIL / UI_CHECK_PASSWORD from the environment or .env.local (a throwaway dev account).

import { chromium } from "playwright";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// Next.js 16 dev mode breaks the login form's navigation on 127.0.0.1.
const WEB_URL = process.env.UI_CHECK_WEB_URL ?? "http://localhost:3000";
const SCREENSHOT_DIR = path.join(ROOT, ".playwright-mcp");

function parseArgs(argv) {
  const args = { paths: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = argv[i + 1];
    if (!["--path", "--email"].includes(arg)) {
      throw new Error(`Unknown argument: ${arg}`);
    }
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${arg} needs a value`);
    }
    i++;
    if (arg === "--path") args.paths.push(value);
    else args.email = value;
  }
  if (args.paths.length === 0) throw new Error("at least one --path is required");
  return args;
}

function readEnvFile(envPath) {
  const vars = {};
  if (!existsSync(envPath)) return vars;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = /^(?:export\s+)?([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (match) vars[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return vars;
}

function resolveCredentials(emailOverride) {
  const env = { ...readEnvFile(path.join(ROOT, ".env.local")), ...process.env };
  return {
    email: emailOverride ?? env.UI_CHECK_EMAIL,
    password: env.UI_CHECK_PASSWORD,
  };
}

async function login(page, credentials) {
  if (!credentials.email || !credentials.password) {
    throw new Error(
      "Missing credentials — set UI_CHECK_EMAIL and UI_CHECK_PASSWORD in .env.local, or pass --email.",
    );
  }

  await page.goto(`${WEB_URL}/login`);
  await page.fill("#email", credentials.email);
  await page.fill("#password", credentials.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 10_000,
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const credentials = resolveCredentials(args.email);

  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(`[console] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(`[pageerror] ${err.message}`);
  });

  const screenshots = [];

  try {
    await login(page, credentials);

    for (const routePath of args.paths) {
      await page.goto(`${WEB_URL}${routePath}`);
      // networkidle is discouraged for tests, but here it's what makes the
      // screenshot show loaded data rather than a loading state.
      await page.waitForLoadState("networkidle");

      const slug = routePath.replace(/^\/+/, "").replace(/\//g, "-") || "root";
      const screenshotPath = path.join(
        SCREENSHOT_DIR,
        `ui-check-${slug}.png`,
      );
      await page.screenshot({ path: screenshotPath, fullPage: true });
      screenshots.push(screenshotPath);
    }
  } finally {
    await browser.close();
  }

  console.log("Screenshots:");
  for (const s of screenshots) console.log(`  ${path.relative(ROOT, s)}`);

  if (consoleErrors.length > 0) {
    console.log(`\nConsole errors: ${consoleErrors.length}`);
    for (const e of consoleErrors) console.log(`  ${e}`);
    process.exit(1);
  }

  console.log("\nConsole errors: none");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
