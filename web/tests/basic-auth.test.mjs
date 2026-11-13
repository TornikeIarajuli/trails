import { test } from "node:test";
import assert from "node:assert/strict";
import { checkBasicAuth } from "../src/lib/basic-auth.ts";

const basic = (text) => `Basic ${Buffer.from(text, "utf8").toString("base64")}`;
const check = (header, user = "admin", pass = "s3cret") => checkBasicAuth(header, user, pass);

test("accepts the configured credentials", async () => {
  assert.equal(await check(basic("admin:s3cret")), "ok");
});

test("rejects a wrong password or a wrong username", async () => {
  assert.equal(await check(basic("admin:wrong")), "unauthorized");
  assert.equal(await check(basic("root:s3cret")), "unauthorized");
  assert.equal(await check(basic("admin:")), "unauthorized");
  assert.equal(await check(basic(":s3cret")), "unauthorized");
});

test("rejects a missing header, another scheme, and credentials without a colon", async () => {
  assert.equal(await check(null), "unauthorized");
  assert.equal(await check(undefined), "unauthorized");
  assert.equal(await check(""), "unauthorized");
  assert.equal(await check("Bearer abc"), "unauthorized");
  assert.equal(await check("Basic"), "unauthorized");
  assert.equal(await check(basic("admins3cret")), "unauthorized");
});

test("splits on the first colon only, so a password may contain colons", async () => {
  assert.equal(await check(basic("admin:a:b:c"), "admin", "a:b:c"), "ok");
  assert.equal(await check(basic("admin:a:b"), "admin", "a:b:c"), "unauthorized");
  // The old check compared only the text between the first two colons.
  assert.equal(await check(basic("admin:a:b:c"), "admin", "a"), "unauthorized");
});

test("treats malformed base64 as unauthorized instead of throwing", async () => {
  assert.equal(await check("Basic %%%not-base64%%%"), "unauthorized");
  assert.equal(await check("Basic YWRtaW46czNjcmV0===="), "unauthorized");
});

test("fails closed when either variable is unset or empty", async () => {
  // An `undefined` argument falls back to the environment, so run without the variables
  // (CI sets them for the build step).
  const saved = { user: process.env.ADMIN_USERNAME, pass: process.env.ADMIN_PASSWORD };
  delete process.env.ADMIN_USERNAME;
  delete process.env.ADMIN_PASSWORD;
  try {
    for (const [user, pass] of [[undefined, undefined], ["admin", undefined], [undefined, "s3cret"], ["", ""], ["admin", ""]]) {
      assert.equal(await checkBasicAuth(basic("admin:s3cret"), user, pass), "not_configured");
      // The old check let these through: `undefined === undefined` for a header without a colon.
      assert.equal(await checkBasicAuth(basic("admin"), user, pass), "not_configured");
      assert.equal(await checkBasicAuth(basic("undefined:undefined"), user, pass), "not_configured");
      assert.equal(await checkBasicAuth(null, user, pass), "not_configured");
    }
  } finally {
    if (saved.user !== undefined) process.env.ADMIN_USERNAME = saved.user;
    if (saved.pass !== undefined) process.env.ADMIN_PASSWORD = saved.pass;
  }
});

test("reads ADMIN_USERNAME / ADMIN_PASSWORD from the environment by default", async () => {
  const saved = { user: process.env.ADMIN_USERNAME, pass: process.env.ADMIN_PASSWORD };
  try {
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
    assert.equal(await checkBasicAuth(basic("admin:s3cret")), "not_configured");

    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "s3cret";
    assert.equal(await checkBasicAuth(basic("admin:s3cret")), "ok");
    assert.equal(await checkBasicAuth(basic("admin:nope")), "unauthorized");
  } finally {
    for (const [name, value] of [["ADMIN_USERNAME", saved.user], ["ADMIN_PASSWORD", saved.pass]]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("accepts any capitalisation of the scheme and surrounding whitespace", async () => {
  const token = Buffer.from("admin:s3cret").toString("base64");
  assert.equal(await check(`basic ${token}`), "ok");
  assert.equal(await check(`BASIC   ${token}  `), "ok");
  assert.equal(await check(`Basic${token}`), "unauthorized");
});

test("accepts non-ASCII credentials sent as UTF-8 or as ISO-8859-1", async () => {
  assert.equal(await check(basic("admin:pässwörd"), "admin", "pässwörd"), "ok");
  const latin1 = `Basic ${Buffer.from("admin:pässwörd", "latin1").toString("base64")}`;
  assert.equal(await check(latin1, "admin", "pässwörd"), "ok");
  assert.equal(await check(basic("admin:passwörd"), "admin", "pässwörd"), "unauthorized");
  assert.equal(await check(basic("admin:პაროლი"), "admin", "პაროლი"), "ok");
});

test("does not accept a prefix or an extension of the password", async () => {
  assert.equal(await check(basic("admin:s3cre")), "unauthorized");
  assert.equal(await check(basic("admin:s3cret ")), "unauthorized");
  assert.equal(await check(basic("admin:s3cretX")), "unauthorized");
});
