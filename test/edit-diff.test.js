const test = require("node:test");
const assert = require("node:assert");
const ED = require("../js/edit-diff.js");

const label = (s) => "演出 " + s.date;

test("无改动时 diff 为空", () => {
  const a = [{ id: 1, date: "2026-06-07", time: "", note: "", special: false, absent: [] }];
  assert.deepStrictEqual(ED.diffList(a, structuredClone(a), ED.SHOW_FIELDS, label), []);
});

test("新增：列出非空字段", () => {
  const cur = [{ id: 2, date: "2026-09-05", time: "", note: "生日SP", special: true, absent: ["阿鱼"] }];
  const d = ED.diffList([], cur, ED.SHOW_FIELDS, label);
  assert.strictEqual(d.length, 1);
  assert.strictEqual(d[0].type, "add");
  assert.deepStrictEqual(d[0].details, ["备注：生日SP", "特别场：是", "缺席：阿鱼"]);
});

test("修改：逐字段 旧 → 新", () => {
  const orig = [{ id: 1, date: "2026-06-07", time: "", note: "", special: false, absent: [] }];
  const cur = [{ id: 1, date: "2026-06-08", time: "", note: "出道日", special: false, absent: ["冰冰"] }];
  const d = ED.diffList(orig, cur, ED.SHOW_FIELDS, label);
  assert.strictEqual(d[0].type, "mod");
  assert.deepStrictEqual(d[0].details, [
    "日期：2026-06-07 → 2026-06-08",
    "备注：（空） → 出道日",
    "缺席：（无） → 冰冰",
  ]);
});

test("删除", () => {
  const orig = [{ id: 1, date: "2026-06-07", time: "", note: "", special: false, absent: [] }];
  const d = ED.diffList(orig, [], ED.SHOW_FIELDS, label);
  assert.deepStrictEqual(d, [{ type: "del", label: "演出 2026-06-07", details: [], ref: 1 }]);
});

test("diffObject：对象字段级对比", () => {
  const orig = { name: "RealizE", emoji: "✨", tagline: "上海地下偶像团体", debutDate: "2026-06-07", intro: "" };
  const cur = { ...orig, tagline: "新介绍" };
  const d = ED.diffObject(orig, cur, ED.GROUP_FIELDS, "团体资料");
  assert.deepStrictEqual(d, [{ type: "mod", label: "团体资料",
    details: ["一句介绍：上海地下偶像团体 → 新介绍"] }]);
  assert.deepStrictEqual(ED.diffObject(orig, { ...orig }, ED.GROUP_FIELDS, "团体资料"), []);
});

test("validateAll:合法数据无错误,非法字段逐条报错", () => {
  const base = {
    site: {
      group: { name: "RealizE", weibo: "https://weibo.com/n/x", managerWeibo: "", fanGroup: "" },
      members: [{ name: "小圆", birthday: "04-25", color: "#a06ee1", socials: ["https://weibo.com/n/y"] }],
    },
    shows: [{ date: "2026-06-07" }],
    events: [{ date: "2026-06-01", title: "披露" }],
    venues: [{ name: "育音堂音乐公园" }],
  };
  assert.deepStrictEqual(ED.validateAll(base), []);

  const bad = structuredClone(base);
  bad.site.group.weibo = "weibo.com/x";
  bad.site.members[0].birthday = "4-25";
  bad.site.members[0].color = "purple";
  bad.events[0].title = "";
  bad.venues[0].name = "";
  const errs = ED.validateAll(bad);
  assert.strictEqual(errs.length, 5);
  assert.ok(errs.some((e) => e.includes("生日")));
  assert.ok(errs.some((e) => e.includes("应援色")));
});
