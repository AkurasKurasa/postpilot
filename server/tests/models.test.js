// Mongoose schemas are only used with MongoDB, so the in-memory store can't catch schema bugs.
// validateSync() checks documents against the schemas without a database.
import { test } from "node:test";
import assert from "node:assert";
import { Run, Post } from "../src/models/index.js";

const brief = { name: "Mira's Milk Tea", type: "Milk tea shop", voice: "Friendly", goal: "Promote Ube Cheesecake", promo: "", prices: [{ item: "Ube Cheesecake", price: 99 }], count: 5 };

test("a run with a full brief passes schema validation", () => {
  assert.equal(new Run({ brief, status: "running", llmMode: "mock" }).validateSync(), undefined);
});

test("brief is a nested object, not a String (a nested `type` key must not be read as a type declaration)", () => {
  assert.equal(Run.schema.path("brief.type")?.instance, "String");
  const run = new Run({ brief });
  assert.equal(run.brief.type, "Milk tea shop");
  assert.equal(run.brief.prices[0].price, 99);
});

test("a post with a type passes schema validation", () => {
  const post = new Post({ run: "0123456789abcdef01234567", slotId: 1, type: "Reel", caption: "Hi", status: "READY_FOR_APPROVAL" });
  assert.equal(post.validateSync(), undefined);
  assert.equal(post.type, "Reel");
});
