import { test } from "node:test";
import assert from "node:assert/strict";
import { PlanSync } from "./sync.js";
function fixture() {
  const values = new Map();
  let remote = null,
    offline = false;
  const storage = {
    getItem: (k) => values.get(k) || null,
    setItem: (k, v) => values.set(k, v),
  };
  const store = {
    read: async () => {
      if (offline) throw Error("offline");
      return structuredClone(remote);
    },
    write: async (state, version) => {
      if (offline) throw Error("offline");
      if ((remote?.version ?? null) !== version) return null;
      remote = { state, version: (version ?? 0) + 1 };
      return { version: remote.version };
    },
  };
  const make = (userId = "a", canRefresh = () => true) => {
    const statuses = [],
      states = [];
    const sync = new PlanSync({
      store,
      storage,
      userId,
      canRefresh,
      onState: (s) => states.push(s),
      onStatus: (s) => statuses.push(s),
    });
    return { sync, statuses, states };
  };
  return {
    make,
    store,
    storage,
    get remote() {
      return remote;
    },
    set offline(v) {
      offline = v;
    },
  };
}
const plan = (title) => ({
  days: {
    "2026-10-23": {
      text: title,
      tasks: [{ id: "task", title, done: false }],
      dumps: [],
    },
  },
});
test("a Mac change syncs to a phone and a phone checkmark returns to the Mac", async () => {
  const f = fixture(),
    mac = f.make(),
    phone = f.make();
  await mac.sync.tick();
  mac.sync.changed(plan("Plan the day"));
  await mac.sync.tick();
  await phone.sync.tick();
  assert.equal(
    phone.states.at(-1).days["2026-10-23"].tasks[0].title,
    "Plan the day",
  );
  const checked = structuredClone(phone.sync.cache.state);
  checked.days["2026-10-23"].tasks[0].done = true;
  phone.sync.changed(checked);
  await phone.sync.tick();
  await mac.sync.tick();
  assert.equal(mac.states.at(-1).days["2026-10-23"].tasks[0].done, true);
});
test("offline changes survive reload and retry", async () => {
  const f = fixture();
  let a = f.make();
  await a.sync.tick();
  f.offline = true;
  a.sync.changed(plan("Offline idea"));
  await a.sync.tick();
  assert.equal(a.statuses.at(-1), "error");
  a = f.make();
  assert.equal(a.sync.cache.dirty, true);
  f.offline = false;
  await a.sync.tick();
  assert.equal(f.remote.state.days["2026-10-23"].text, "Offline idea");
  assert.equal(a.sync.cache.dirty, false);
});
test("concurrent changes pause without overwriting either version", async () => {
  const f = fixture(),
    a = f.make(),
    b = f.make();
  a.sync.changed(plan("Original"));
  await a.sync.tick();
  await b.sync.tick();
  a.sync.changed(plan("Mac edit"));
  b.sync.changed(plan("Phone edit"));
  await a.sync.tick();
  await b.sync.tick();
  assert.equal(b.statuses.at(-1), "conflict");
  assert.equal(f.remote.state.days["2026-10-23"].text, "Mac edit");
  assert.equal(b.sync.cache.state.days["2026-10-23"].text, "Phone edit");
  b.sync.resolve("remote");
  assert.equal(b.sync.cache.state.days["2026-10-23"].text, "Mac edit");
  assert.equal(b.sync.cache.dirty, false);
});
test("choosing a device copy checks the new remote version again", async () => {
  const f = fixture(),
    a = f.make(),
    b = f.make();
  a.sync.changed(plan("A"));
  await a.sync.tick();
  await b.sync.tick();
  a.sync.changed(plan("A2"));
  await a.sync.tick();
  b.sync.changed(plan("B"));
  await b.sync.tick();
  b.sync.resolve("local");
  await b.sync.tick();
  assert.equal(f.remote.state.days["2026-10-23"].text, "B");
});
test("typing and dialogs defer incoming remote refresh", async () => {
  const f = fixture(),
    a = f.make(),
    b = f.make("a", () => false);
  a.sync.changed(plan("Remote"));
  await a.sync.tick();
  await b.sync.tick();
  assert.equal(b.states.length, 0);
  b.sync.canRefresh = () => true;
  await b.sync.tick();
  assert.equal(b.states.length, 1);
});
test("edits made during an upload remain pending", async () => {
  const f = fixture(),
    a = f.make();
  const original = f.store.write;
  f.store.write = async (...args) => {
    a.sync.changed(plan("Newer edit"));
    return original(...args);
  };
  a.sync.changed(plan("First edit"));
  await a.sync.tick();
  assert.equal(a.sync.cache.dirty, true);
  assert.equal(f.remote.state.days["2026-10-23"].text, "First edit");
  f.store.write = original;
  await a.sync.tick();
  assert.equal(f.remote.state.days["2026-10-23"].text, "Newer edit");
});
test("local caches are isolated by account and stopping prevents updates", async () => {
  const f = fixture(),
    a = f.make("a");
  a.sync.changed(plan("Private"));
  const b = f.make("b");
  assert.deepEqual(b.sync.cache.state, { days: {} });
  a.sync.stop();
  await a.sync.tick();
  assert.equal(f.remote, null);
});

test('sharing failures explain network, permissions, session, and storage problems safely', async()=>{
 const {sharingProblem}=await import('./sync.js');
 assert.match(sharingProblem({message:'Load failed'}),/internet connection/);
 assert.match(sharingProblem({code:'42501',message:'denied'}),/permissions/);
 assert.match(sharingProblem({message:'JWT expired'}),/sign-in session/);
 assert.match(sharingProblem({name:'QuotaExceededError'}),/browser could not save/);
 assert.match(sharingProblem({code:'PGRST205'}),/storage table/);
 assert.ok(!sharingProblem({message:'raw secret payload'}).includes('raw secret payload'));
});
