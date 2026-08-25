const test = require("node:test");
const assert = require("node:assert");
const D = require("../js/derive.js");

const shows = [
  { date: "2026-06-10", note: "生日SP", special: true, absent: ["冰冰"] },
  { date: "2026-06-07", note: "出道日", special: false, absent: ["冰冰"] },
  { date: "2026-07-18", note: "", special: false, absent: [] },
  { date: "2026-08-29", note: "", special: false, absent: ["阿鱼"] },
];

test("withNumbers 按日期升序编号", () => {
  const n = D.withNumbers(shows);
  assert.deepStrictEqual(n.map((s) => [s.n, s.date]), [
    [1, "2026-06-07"], [2, "2026-06-10"], [3, "2026-07-18"], [4, "2026-08-29"],
  ]);
});

test("splitByToday：今天及以后算 upcoming", () => {
  const { past, upcoming } = D.splitByToday(D.withNumbers(shows), "2026-07-18");
  assert.deepStrictEqual(past.map((s) => s.date), ["2026-06-07", "2026-06-10"]);
  assert.deepStrictEqual(upcoming.map((s) => s.date), ["2026-07-18", "2026-08-29"]);
});

test("memberStats 只数出席的已演场次，firstDate 是初舞台", () => {
  const { past } = D.splitByToday(D.withNumbers(shows), "2026-08-01");
  const s = D.memberStats("冰冰", past);
  assert.strictEqual(s.count, 1);
  assert.strictEqual(s.total, 3);
  assert.strictEqual(s.firstDate, "2026-07-18");
});

test("nextMilestone：还差几场 + 已排期的带日期", () => {
  const numbered = D.withNumbers(shows);
  const m = D.nextMilestone(3, [1, 4, 10], numbered);
  assert.deepStrictEqual(m, { target: 4, remaining: 1, date: "2026-08-29" });
  const far = D.nextMilestone(3, [1, 10], numbered);
  assert.deepStrictEqual(far, { target: 10, remaining: 7, date: null });
  assert.strictEqual(D.nextMilestone(10, [1, 10], numbered), null);
});

test("buildTimeline 合并大事纪与有备注/特别场的演出，按日期排序", () => {
  const events = [{ date: "2026-06-01", title: "团名初披露", note: "" }];
  const tl = D.buildTimeline(events, D.withNumbers(shows));
  assert.deepStrictEqual(tl.map((t) => [t.date, t.type]), [
    ["2026-06-01", "event"], ["2026-06-07", "show"], ["2026-06-10", "show"],
  ]);
  assert.strictEqual(tl[2].note, "第2场 · 特别场");
});

test("daysBetween", () => {
  assert.strictEqual(D.daysBetween("2026-08-24", "2026-08-26"), 2);
  assert.strictEqual(D.daysBetween("2026-08-24", "2026-08-24"), 0);
});

test("beijingToday：按 UTC+8 判定日期", () => {
  // 2026-08-24 23:00 UTC = 北京时间 2026-08-25 07:00
  assert.strictEqual(D.beijingToday(Date.UTC(2026, 7, 24, 23, 0)), "2026-08-25");
  // 2026-08-24 15:59 UTC = 北京时间 2026-08-24 23:59
  assert.strictEqual(D.beijingToday(Date.UTC(2026, 7, 24, 15, 59)), "2026-08-24");
  // 2026-08-24 16:00 UTC = 北京时间 2026-08-25 00:00（跨日边界）
  assert.strictEqual(D.beijingToday(Date.UTC(2026, 7, 24, 16, 0)), "2026-08-25");
});
