import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("entrypoint removes stale Xvfb display 99 files before starting Xvfb", async () => {
  const entrypoint = await readFile(
    new URL("../docker-entrypoint.sh", import.meta.url),
    "utf8",
  );

  const cleanupIndex = entrypoint.indexOf(
    "rm -f /tmp/.X99-lock /tmp/.X11-unix/X99",
  );
  const xvfbIndex = entrypoint.indexOf("Xvfb :99");

  assert.notEqual(cleanupIndex, -1);
  assert.notEqual(xvfbIndex, -1);
  assert.ok(cleanupIndex < xvfbIndex);
});
