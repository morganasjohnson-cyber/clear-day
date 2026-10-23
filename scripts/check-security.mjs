import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(
  `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated; insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');`,
);
const sql = await readFile(
  new URL("../supabase/setup.sql", import.meta.url),
  "utf8",
);
await db.exec(sql);
await db.exec(sql);
await db.exec(
  `set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'; insert into public.clear_day_plans (user_id,data) values ('00000000-0000-0000-0000-000000000001','{"days":{}}');`,
);
assert.equal(
  (await db.query("select * from public.clear_day_plans")).rows.length,
  1,
);
await db.exec(
  `set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';`,
);
assert.equal(
  (await db.query("select * from public.clear_day_plans")).rows.length,
  0,
);
assert.equal(
  (
    await db.query(
      `update public.clear_day_plans set version=2 where user_id='00000000-0000-0000-0000-000000000001' returning *`,
    )
  ).rows.length,
  0,
);
await assert.rejects(
  db.exec(
    `insert into public.clear_day_plans (user_id) values ('00000000-0000-0000-0000-000000000001')`,
  ),
  /row-level security/,
);
await db.exec("reset role;set role anon;");
await assert.rejects(
  db.query("select * from public.clear_day_plans"),
  /permission denied/,
);
console.log(
  "Postgres template checks passed: repeatable SQL, own-row access, other-user read/update/insert denied, anonymous access denied.",
);
await db.close();
