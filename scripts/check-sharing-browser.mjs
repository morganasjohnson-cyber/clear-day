import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
  args: ["--no-sandbox"],
});
let remote = null;
const errors = [];
let offline = false;
const uid = "00000000-0000-0000-0000-000000000001";
const user = {
  id: uid,
  aud: "authenticated",
  role: "authenticated",
  email: "test@example.test",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: new Date().toISOString(),
};
const token =
  Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url",
  ) +
  "." +
  Buffer.from(
    JSON.stringify({
      sub: uid,
      aud: "authenticated",
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url") +
  ".test";
async function context() {
  const c = await browser.newContext();
  await c.route("**/sync-config.json", (r) =>
    r.fulfill({
      json: {
        url: "https://test.supabase.co",
        publishableKey: "sb_publishable_test",
      },
    }),
  );
  await c.route("https://test.supabase.co/**", async (r) => {
    if (offline) return r.abort("failed");
    const req = r.request(),
      url = new URL(req.url());
    if (url.pathname.endsWith("/token"))
      return r.fulfill({
        json: {
          access_token: token,
          refresh_token: "mock-refresh",
          token_type: "bearer",
          expires_in: 3600,
          user,
        },
      });
    if (url.pathname.endsWith("/user")) return r.fulfill({ json: user });
    if (url.pathname.endsWith("/logout")) return r.fulfill({ json: {} });
    if (url.pathname.endsWith("/signup"))
      return r.fulfill({ json: { user, session: null } });
    if (url.pathname.includes("/rest/v1/clear_day_plans")) {
      if (req.method() === "GET")
        return r.fulfill({ json: remote ? [remote] : [] });
      const input = req.postDataJSON();
      const version = Number(url.searchParams.get("version")?.slice(3));
      let written = null;
      if (req.method() === "POST") {
        if (remote) return r.fulfill({ status: 409, json: { code: "23505" } });
        remote = { ...input };
        written = { version: remote.version };
      }
      if (req.method() === "PATCH" && remote?.version === version) {
        remote = { ...remote, ...input };
        written = { version: remote.version };
      }
      const singular = req.headers()["accept"]?.includes("vnd.pgrst.object");
      return r.fulfill({ json: singular ? written : written ? [written] : [] });
    }
    throw Error("Unexpected request: " + url.pathname);
  });
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  return { c, p };
}
async function login(p) {
  await p.locator("#sharing-open").click();
  await p.locator("[name=email]").fill("test@example.test");
  await p.locator("[name=password]").fill("fake-password-only-for-testing");
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p.waitForFunction(
    () =>
      document.querySelector("#sharing-status")?.textContent ===
      "Synced with your account",
  );
}
const { p: mac } = await context();
await mac.goto("http://localhost:5173");
await mac.locator("#dump").fill("Finish report, run 10 km");
await mac.locator("#organize").click();
await login(mac);
assert.equal(await mac.locator(".task").count(), 0);
await mac.locator("#sharing-open").click();
mac.once("dialog", (d) => d.accept());
const backup = mac.waitForEvent("download");
await mac.locator("#migrate").click();
await backup;
await mac.waitForFunction(
  () => document.querySelectorAll(".task").length === 2,
);
await mac.waitForFunction(
  () =>
    document.querySelector("#sharing-status").textContent ===
    "Synced with your account",
);
const { p: phone } = await context();
await phone.setViewportSize({ width: 390, height: 844 });
await phone.goto("http://localhost:5173");
await login(phone);
assert.equal(await phone.locator(".task").count(), 2);
await phone
  .getByRole("checkbox", { name: "Complete Finish report", exact: true })
  .click();
await phone.waitForFunction(
  () =>
    document.querySelector("#sharing-status").textContent ===
    "Synced with your account",
);
await mac.evaluate(() => window.dispatchEvent(new Event("focus")));
await mac.waitForFunction(
  () => document.querySelectorAll(".completed .task").length === 1,
);
// A remote change racing with a local draft must stop and offer recovery.
await mac.locator("#dump").fill("Mac unsynced draft");
await mac.locator("#dump").blur();
remote = {
  ...remote,
  version: remote.version + 1,
  data: { ...remote.data, days: { ...remote.data.days } },
};
const currentDay = Object.keys(remote.data.days)[0];
remote.data.days[currentDay] = {
  ...remote.data.days[currentDay],
  text: "Phone simultaneous draft",
};
await mac.evaluate(() => window.dispatchEvent(new Event("focus")));
await mac.waitForFunction(() =>
  document
    .querySelector("#sharing-status")
    .textContent.includes("Both devices changed"),
);
await mac.locator("#sharing-open").click();
const conflictBackup = mac.waitForEvent("download");
await mac.locator("#keep-remote").click();
await conflictBackup;
assert.equal(
  await mac.locator("#dump").inputValue(),
  "Phone simultaneous draft",
);
await phone.locator("#sharing-open").click();
await phone.locator("#signout").click();
await phone.waitForFunction(
  () =>
    document.querySelector("#sharing-status")?.textContent ===
    "Device-only plans",
);
assert.equal(await phone.locator(".task").count(), 0);
assert.equal(await phone.locator("#dump").inputValue(), "");
await mac.locator("#sharing-open").click();
await mac.locator("#signout").click();
await mac.waitForFunction(
  () =>
    document.querySelector("#sharing-status")?.textContent ===
    "Device-only plans",
);
assert.equal(await mac.locator(".task").count(), 2);
assert.equal(await mac.locator(".completed .task").count(), 0);
const local = await browser.newPage();
await local.route("**/sync-config.json", r => r.fulfill({json:{url:"",publishableKey:""}}));
await local.goto("http://localhost:5173");
await local.locator("#sharing-open").click();
assert.match(await local.locator("#modal").textContent(), /isn’t set up yet/);
await local.locator("[data-close]").click();
await local.locator("#dump").fill("Local planner still works");
await local.reload();
assert.equal(
  await local.locator("#dump").inputValue(),
  "Local planner still works",
);
assert.deepEqual(errors, []);
console.log(
  "Browser integration passed: sign-in, explicit device migration with backup, two independent browsers sharing plans and checkmarks, mobile, sign-out separation and original device plans preserved.",
);
await browser.close();
