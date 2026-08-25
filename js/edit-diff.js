// 编辑页的"待保存改动"计算——纯函数，不碰 DOM。
(function (global) {
  "use strict";

  const SHOW_FIELDS = [
    ["date", "日期"], ["time", "时间"], ["venue", "场地"], ["note", "备注"],
    ["special", "特别场"], ["absent", "缺席"],
  ];
  const EVENT_FIELDS = [
    ["date", "日期"], ["title", "标题"], ["note", "备注"], ["who", "关联"],
  ];
  const GROUP_FIELDS = [
    ["name", "团名"], ["emoji", "emoji"], ["tagline", "一句介绍"],
    ["debutDate", "出道日"], ["agency", "经纪公司"], ["manager", "经纪人"],
    ["weibo", "官方微博"], ["managerWeibo", "经纪人微博"], ["managerIcon", "经纪人头像"],
    ["fanGroup", "微博群"], ["intro", "介绍"],
  ];
  const MEMBER_FIELDS = [
    ["name", "名字"], ["roman", "罗马音"], ["emoji", "emoji"], ["heart", "应援心"],
    ["color", "应援色"], ["birthday", "生日"], ["mascot", "代表物"],
    ["intro", "出身/介绍"], ["socials", "链接"],
  ];

  function fmt(v) {
    if (Array.isArray(v)) return v.length ? v.join("、") : "（无）";
    if (typeof v === "boolean") return v ? "是" : "否";
    return v === "" || v == null ? "（空）" : String(v);
  }

  function isEmpty(v) {
    return v === "" || v === false || v == null || (Array.isArray(v) && !v.length);
  }

  // 按 id 对比原始数据和当前数据，产出 新增/修改/删除 三类改动。
  // 新增条目的 details 列出它的非空字段，修改条目列出"旧 → 新"。
  function diffList(original, current, fields, describe) {
    const origById = new Map(original.map((o) => [o.id, o]));
    const curById = new Map(current.map((c) => [c.id, c]));
    const changes = [];

    for (const c of current) {
      const o = origById.get(c.id);
      if (!o) {
        const details = fields
          .filter(([key]) => !isEmpty(c[key]) && key !== "date")
          .map(([key, label]) => label + "：" + fmt(c[key]));
        changes.push({ type: "add", label: describe(c), details });
        continue;
      }
      const details = fields
        .filter(([key]) => JSON.stringify(o[key]) !== JSON.stringify(c[key]))
        .map(([key, label]) => label + "：" + fmt(o[key]) + " → " + fmt(c[key]));
      if (details.length) changes.push({ type: "mod", label: describe(c), details });
    }
    for (const o of original) {
      if (!curById.has(o.id)) changes.push({ type: "del", label: describe(o), details: [] });
    }
    return changes;
  }

  // 单个对象（团体资料）的字段级对比
  function diffObject(original, current, fields, label) {
    const details = fields
      .filter(([key]) => JSON.stringify(original[key]) !== JSON.stringify(current[key]))
      .map(([key, l]) => l + "：" + fmt(original[key]) + " → " + fmt(current[key]));
    return details.length ? [{ type: "mod", label, details }] : [];
  }

  const api = {
    diffList, diffObject, fmt,
    SHOW_FIELDS, EVENT_FIELDS, GROUP_FIELDS, MEMBER_FIELDS,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.editDiff = api;
})(this);
