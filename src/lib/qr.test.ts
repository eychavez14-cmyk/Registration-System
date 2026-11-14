import { test } from "node:test";
import assert from "node:assert/strict";
import { extractCode, statusLink } from "./qr.ts";

test("pulls the registration number out of scans and typing", () => {
  assert.equal(extractCode(statusLink("https://x.vercel.app", "lm-2026", "REG-AB12CD")), "REG-AB12CD");
  assert.equal(extractCode("reg-ab12cd"), "REG-AB12CD");
  assert.equal(extractCode(" REG - AB12CD "), "REG-AB12CD");
  assert.equal(extractCode("hello world"), null);
  assert.equal(extractCode("REG-AB1"), null);
});
