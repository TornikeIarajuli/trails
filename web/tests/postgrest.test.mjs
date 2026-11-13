import { test } from "node:test";
import assert from "node:assert/strict";
import { ilikeAny } from "../src/lib/postgrest.ts";
import { httpUrl } from "../src/lib/url.ts";

test("ilikeAny builds one quoted ilike filter per column", () => {
  assert.equal(ilikeAny(["username", "full_name"], "nino"), 'username.ilike."%nino%",full_name.ilike."%nino%"');
});

test("ilikeAny matches LIKE wildcards literally", () => {
  assert.equal(ilikeAny(["username"], "user_1"), 'username.ilike."%user\\\\_1%"');
  assert.equal(ilikeAny(["username"], "100%"), 'username.ilike."%100\\\\%%"');
});

test("ilikeAny keeps filter syntax inside the quoted value", () => {
  // Without quoting, the comma and parenthesis would start a new condition.
  assert.equal(ilikeAny(["username"], "a,b).or(id.gt.0"), 'username.ilike."%a,b).or(id.gt.0%"');
  assert.equal(ilikeAny(["username"], 'say "hi"'), 'username.ilike."%say \\"hi\\"%"');
  assert.equal(ilikeAny(["username"], "back\\slash"), 'username.ilike."%back\\\\\\\\slash%"');
});

test("httpUrl only passes http(s) links", () => {
  assert.equal(httpUrl("https://example.com/a.jpg"), "https://example.com/a.jpg");
  assert.equal(httpUrl("HTTP://example.com"), "HTTP://example.com");
  assert.equal(httpUrl("javascript:alert(1)"), null);
  assert.equal(httpUrl("data:text/html,<script>alert(1)</script>"), null);
  assert.equal(httpUrl("//example.com"), null);
  assert.equal(httpUrl(""), null);
  assert.equal(httpUrl(null), null);
});
