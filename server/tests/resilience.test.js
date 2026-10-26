// A failing database call must return a 500 to that request, not crash the whole API.
process.env.DB_MODE = "memory";
process.env.LLM_MODE = "mock";
process.env.MOCK_STEP_DELAY_MS = "0";
process.env.CORS_ORIGINS = "https://akuraskurasa.github.io";

import { test, before, after } from "node:test";
import assert from "node:assert";

const { app } = await import("../src/app.js");
const { db } = await import("../src/db/index.js");

const ORIGIN = "https://akuraskurasa.github.io";
const BRIEF = { goal: "Promote our iced latte", count: 1, prices: [{ item: "Iced Latte", price: 120 }] };
let server, base;
const unhandled = [];
const onUnhandled = (err) => unhandled.push(err);

before(async () => {
  process.on("unhandledRejection", onUnhandled);
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  process.off("unhandledRejection", onUnhandled);
  server.close();
});

const post = (url, body) =>
  fetch(base + url, { method: "POST", signal: AbortSignal.timeout(3000), headers: { "Content-Type": "application/json", Origin: ORIGIN }, body: JSON.stringify(body) });
const tick = () => new Promise((r) => setTimeout(r, 50));

test("a database error on create returns 500 with CORS headers and the API stays up", async (t) => {
  t.mock.method(db, "createRun", async () => { throw new Error("not authorized on postpilot to execute command { insert }"); });
  const res = await post("/api/runs", BRIEF);
  assert.equal(res.status, 500);
  assert.equal(res.headers.get("access-control-allow-origin"), ORIGIN);
  assert.match((await res.json()).error, /went wrong/);

  const health = await fetch(base + "/api/health");
  assert.equal(health.status, 200);
  await tick();
  assert.deepEqual(unhandled, []);
});

test("a database error on a read returns 500 instead of crashing", async (t) => {
  t.mock.method(db, "listRuns", async () => { throw new Error("connection reset"); });
  const res = await fetch(base + "/api/runs", { signal: AbortSignal.timeout(3000) });
  assert.equal(res.status, 500);
  await tick();
  assert.deepEqual(unhandled, []);
});

test("a pipeline whose error handling also fails does not crash the process", async (t) => {
  // createRun works, but every later write fails, including the orchestrator's own failure bookkeeping
  t.mock.method(db, "updateRun", async () => { throw new Error("write failed"); });
  t.mock.method(db, "addEvent", async () => { throw new Error("write failed"); });
  const res = await post("/api/runs", BRIEF);
  assert.equal(res.status, 202);
  await new Promise((r) => setTimeout(r, 300));
  assert.deepEqual(unhandled, []);
  assert.equal((await fetch(base + "/api/health")).status, 200);
});
