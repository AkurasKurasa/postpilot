// The CORS allowlist decides which browser origins (e.g. GitHub Pages) can call the API.
import { test } from "node:test";
import assert from "node:assert";
import { parseOrigins, isAllowedOrigin, corsOptions } from "../src/cors.js";

const allow = parseOrigins("https://akuraskurasa.github.io, http://localhost:5173/");

test("parses a comma list, trimming spaces and trailing slashes", () =>
  assert.deepEqual(allow, ["https://akuraskurasa.github.io", "http://localhost:5173"]));
test("empty or missing value gives an empty list", () => {
  assert.deepEqual(parseOrigins(""), []);
  assert.deepEqual(parseOrigins(undefined), []);
  assert.deepEqual(parseOrigins(" , "), []);
});
test("listed origins are allowed", () => {
  assert.ok(isAllowedOrigin("https://akuraskurasa.github.io", allow));
  assert.ok(isAllowedOrigin("http://localhost:5173", allow));
});
test("unlisted and look-alike origins are denied", () => {
  assert.ok(!isAllowedOrigin("https://evil.example", allow));
  assert.ok(!isAllowedOrigin("https://akuraskurasa.github.io.evil.example", allow));
  assert.ok(!isAllowedOrigin("http://akuraskurasa.github.io", allow));
});
test("requests without an Origin header pass (same-origin, health checks)", () =>
  assert.ok(isAllowedOrigin(undefined, allow)));
test("corsOptions reports the decision to the cors middleware", () => {
  const { origin } = corsOptions(allow);
  origin("https://evil.example", (err, ok) => assert.equal(ok, false));
  origin("https://akuraskurasa.github.io", (err, ok) => assert.equal(ok, true));
});
