// shows.ics 与 data/shows.json 的同步校验:
// 仓库里提交的 shows.ics 必须等于用当前数据重新生成的结果。
// 改了 shows/venues 数据后跑 `node tools/build-ics.js` 重新生成即可通过。
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { build } = require("../tools/build-ics.js");

const ROOT = path.join(__dirname, "..");

test("shows.ics 与 shows.json 同步(过期就重跑 node tools/build-ics.js)", () => {
  const committed = fs.readFileSync(path.join(ROOT, "shows.ics"), "utf8");
  assert.strictEqual(committed, build());
});

test("shows.ics 结构:事件数与演出数一致,必填字段齐全", () => {
  const shows = JSON.parse(fs.readFileSync(path.join(ROOT, "data/shows.json"), "utf8"));
  const ics = build();
  assert.strictEqual((ics.match(/BEGIN:VEVENT/g) || []).length, shows.length);
  assert.strictEqual((ics.match(/END:VEVENT/g) || []).length, shows.length);
  assert.ok(ics.startsWith("BEGIN:VCALENDAR"));
  assert.ok(ics.trimEnd().endsWith("END:VCALENDAR"));
  // 每个事件的 UID 唯一
  const uids = ics.match(/UID:[^\r\n]+/g) || [];
  assert.strictEqual(new Set(uids).size, shows.length);
  // RFC5545:行(含折行前)不超过 75 字节
  for (const line of ics.split("\r\n")) {
    assert.ok(Buffer.from(line, "utf8").length <= 75, "行超长: " + line);
  }
});
