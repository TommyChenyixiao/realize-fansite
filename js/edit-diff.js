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
  const VENUE_FIELDS = [
    ["name", "名称"], ["address", "地址"], ["transit", "交通"], ["note", "备注"],
  ];
  const MEMBER_FIELDS = [
    ["name", "名字"], ["roman", "罗马音"], ["emoji", "emoji"], ["heart", "应援心"],
    ["color", "应援色"], ["birthday", "生日"], ["mascot", "代表物"], ["mbti", "MBTI"],
    ["intro", "出身/介绍"], ["bio", "详细介绍"], ["photo", "照片"],
    ["fanGroupName", "粉丝群名"], ["fanGroup", "粉丝群链接"], ["socials", "链接"],
  ];

  function fmt(v) {
    if (Array.isArray(v)) return v.length ? v.join("、") : "（无）";
    if (typeof v === "boolean") return v ? "是" : "否";
    if (v === "" || v == null) return "（空）";
    const s = String(v).replace(/\n/g, " ");
    return s.length > 60 ? s.slice(0, 60) + "…" : s;
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
        changes.push({ type: "add", label: describe(c), details, ref: c.id });
        continue;
      }
      const details = fields
        .filter(([key]) => JSON.stringify(o[key]) !== JSON.stringify(c[key]))
        .map(([key, label]) => label + "：" + fmt(o[key]) + " → " + fmt(c[key]));
      if (details.length) changes.push({ type: "mod", label: describe(c), details, ref: c.id });
    }
    for (const o of original) {
      if (!curById.has(o.id)) changes.push({ type: "del", label: describe(o), details: [], ref: o.id });
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

  // 全量数据校验——返回错误信息列表,非空则不允许保存。
  function validateAll(cur) {
    const errs = [];
    const okUrl = (v) => !v || /^https?:\/\//.test(v);
    const g = cur.site.group;
    if (!g.name) errs.push("团名不能为空");
    for (const [key, label] of [["weibo", "官方微博"], ["managerWeibo", "经纪人微博"], ["fanGroup", "微博群"]]) {
      if (!okUrl(g[key])) errs.push("团体·" + label + " 链接需以 http(s):// 开头");
    }
    for (const m of cur.site.members) {
      if (!m.name) errs.push("有成员的名字为空");
      if (m.birthday && !/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(m.birthday)) {
        errs.push("成员「" + m.name + "」生日格式应为 月-日,如 02-16");
      }
      if (m.color && !/^#[0-9a-fA-F]{6}$/.test(m.color)) {
        errs.push("成员「" + m.name + "」应援色应为 #rrggbb 格式");
      }
      for (const u of m.socials || []) {
        if (!okUrl(u)) errs.push("成员「" + m.name + "」链接需以 http(s):// 开头");
      }
    }
    for (const s of cur.shows) if (!s.date) errs.push("有演出的日期为空");
    for (const e of cur.events) {
      if (!e.date) errs.push("有大事纪的日期为空");
      if (!e.title) errs.push("大事纪 " + (e.date || "?") + " 的标题为空");
    }
    for (const v of cur.venues || []) if (!v.name) errs.push("有场地的名称为空");
    return errs;
  }

  const api = {
    diffList, diffObject, validateAll, fmt,
    SHOW_FIELDS, EVENT_FIELDS, GROUP_FIELDS, MEMBER_FIELDS, VENUE_FIELDS,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.editDiff = api;
})(this);
