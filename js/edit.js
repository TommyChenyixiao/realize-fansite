// 编辑页：加载公共 JSON → 页面内编辑 → 底部实时显示待保存改动 → 保存时 POST 给 serve.py 写回文件。
// 团体/成员/演出/大事纪都在这里改。成员或团体改名会级联更新演出缺席、大事纪关联里的名字。
(async function () {
  "use strict";

  const ED = window.editDiff;

  let orig = { site: null, shows: [], events: [] };
  let cur = { site: null, shows: [], events: [] };

  await reload();
  bindAddForms();
  document.getElementById("save").addEventListener("click", save);
  document.getElementById("discard").addEventListener("click", async () => {
    await reload();
    setStatus("已放弃改动");
  });

  async function reload() {
    const [site, shows, events] = await Promise.all([
      fetch("data/site.json").then((r) => r.json()),
      fetch("data/shows.json").then((r) => r.json()),
      fetch("data/events.json").then((r) => r.json()),
    ]);
    orig = { site, shows, events };
    cur = deepCopy(orig);
    renderAll();
  }

  function memberNames() {
    return cur.site.members.map((m) => m.name);
  }
  function whoOptions() {
    return [cur.site.group.name].concat(memberNames());
  }

  function renderAll() {
    renderGroupForm();
    renderMemberRows();
    renderShowRows();
    renderEventRows();
    renderChecks("show-add-absent", memberNames());
    renderChecks("event-add-who", whoOptions());
    updateDiff();
  }

  // ---------- 团体资料 ----------
  function renderGroupForm() {
    const g = cur.site.group;
    const box = document.getElementById("group-form");
    box.innerHTML = "";
    const row = el("div", "edit-row");
    row.appendChild(labeled("团名", input("text", g.name, (v) => {
      if (v && v !== g.name) cascadeRename(g.name, v);
      g.name = v;
      renderAll();
    }, "", 10)));
    row.appendChild(labeled("emoji", input("text", g.emoji, (v) => { g.emoji = v; updateDiff(); }, "", 4)));
    row.appendChild(labeled("一句介绍", input("text", g.tagline, (v) => { g.tagline = v; updateDiff(); }, "", 18)));
    row.appendChild(labeled("出道日", input("date", g.debutDate, (v) => { g.debutDate = v; updateDiff(); })));
    row.appendChild(labeled("经纪公司", input("text", g.agency, (v) => { g.agency = v; updateDiff(); }, "", 8)));
    row.appendChild(labeled("经纪人", input("text", g.manager, (v) => { g.manager = v; updateDiff(); }, "", 8)));
    row.appendChild(labeled("官方微博", input("text", g.weibo, (v) => { g.weibo = v; updateDiff(); }, "链接", 18)));
    row.appendChild(labeled("经纪人微博", input("text", g.managerWeibo, (v) => { g.managerWeibo = v; updateDiff(); }, "链接", 18)));
    row.appendChild(labeled("微博群", input("text", g.fanGroup, (v) => { g.fanGroup = v; updateDiff(); }, "链接", 18)));
    row.appendChild(labeled("经纪人头像", input("text", g.managerIcon, (v) => { g.managerIcon = v; updateDiff(); }, "图片路径", 14)));
    row.appendChild(labeled("介绍", input("text", g.intro, (v) => { g.intro = v; updateDiff(); }, "更长的介绍(可选)", 24)));
    box.appendChild(row);
  }

  // ---------- 成员 ----------
  function renderMemberRows() {
    const box = document.getElementById("member-rows");
    box.innerHTML = "";
    for (const m of cur.site.members) box.appendChild(memberRow(m));
  }

  function memberRow(m) {
    const row = el("div", "edit-row");
    row.appendChild(labeled("名字", input("text", m.name, (v) => {
      if (v && v !== m.name) cascadeRename(m.name, v);
      m.name = v;
      renderAll();
    }, "", 6)));
    row.appendChild(labeled("罗马音", input("text", m.roman, (v) => { m.roman = v; updateDiff(); }, "", 8)));
    row.appendChild(labeled("emoji", input("text", m.emoji, (v) => { m.emoji = v; updateDiff(); }, "", 3)));
    row.appendChild(labeled("应援心", input("text", m.heart, (v) => { m.heart = v; updateDiff(); }, "", 3)));
    row.appendChild(labeled("应援色", input("text", m.color, (v) => { m.color = v; updateDiff(); }, "#rrggbb", 8)));
    row.appendChild(labeled("生日", input("text", m.birthday, (v) => { m.birthday = v; updateDiff(); }, "月-日", 6)));
    row.appendChild(labeled("代表物", input("text", m.mascot, (v) => { m.mascot = v; updateDiff(); }, "", 8)));
    row.appendChild(labeled("出身/介绍", input("text", m.intro, (v) => { m.intro = v; updateDiff(); }, "介绍(可选)", 14)));
    row.appendChild(labeled("链接", input("text", (m.socials || []).join(", "), (v) => {
      m.socials = v.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      updateDiff();
    }, "逗号分隔(可选)", 18)));
    row.appendChild(delButton(() => {
      cur.site.members = cur.site.members.filter((x) => x !== m);
      stripName(m.name);
      renderAll();
    }, "删除成员(演出缺席/大事纪关联里的名字会一并移除)"));
    return row;
  }

  // 改名级联：演出缺席、大事纪关联里的旧名字一起改
  function cascadeRename(oldName, newName) {
    for (const s of cur.shows) s.absent = s.absent.map((n) => (n === oldName ? newName : n));
    for (const e of cur.events) e.who = e.who.map((n) => (n === oldName ? newName : n));
  }
  function stripName(name) {
    for (const s of cur.shows) s.absent = s.absent.filter((n) => n !== name);
    for (const e of cur.events) e.who = e.who.filter((n) => n !== name);
  }

  // ---------- 演出行 ----------
  function renderShowRows() {
    const box = document.getElementById("show-rows");
    box.innerHTML = "";
    sortShows(cur.shows);
    for (const s of cur.shows.slice().reverse()) box.appendChild(showRow(s));
  }

  function showRow(s) {
    const row = el("div", "edit-row");
    row.appendChild(input("date", s.date, (v) => { s.date = v; renderShowRows(); updateDiff(); }));
    row.appendChild(input("text", s.time, (v) => { s.time = v; updateDiff(); }, "时间", 6));
    row.appendChild(input("text", s.venue, (v) => { s.venue = v; updateDiff(); }, "场地", 9));
    row.appendChild(input("text", s.note, (v) => { s.note = v; updateDiff(); }, "备注", 14));
    row.appendChild(checkbox("特别场", s.special, (v) => { s.special = v; updateDiff(); }));
    const absentBox = el("span", "member-checks");
    absentBox.append("缺席:");
    for (const name of memberNames()) {
      absentBox.appendChild(checkbox(name, s.absent.includes(name), (v) => {
        s.absent = v ? s.absent.concat(name) : s.absent.filter((n) => n !== name);
        sortNames(s.absent, memberNames());
        updateDiff();
      }));
    }
    row.appendChild(absentBox);
    row.appendChild(delButton(() => {
      cur.shows = cur.shows.filter((x) => x !== s);
      renderShowRows();
      updateDiff();
    }));
    return row;
  }

  // ---------- 大事纪行 ----------
  function renderEventRows() {
    const box = document.getElementById("event-rows");
    box.innerHTML = "";
    sortByDate(cur.events);
    for (const e of cur.events.slice().reverse()) box.appendChild(eventRow(e));
  }

  function eventRow(e) {
    const row = el("div", "edit-row");
    row.appendChild(input("date", e.date, (v) => { e.date = v; renderEventRows(); updateDiff(); }));
    row.appendChild(input("text", e.title, (v) => { e.title = v; updateDiff(); }, "标题", 16));
    row.appendChild(input("text", e.note, (v) => { e.note = v; updateDiff(); }, "备注", 10));
    const whoBox = el("span", "member-checks");
    whoBox.append("关联:");
    for (const name of whoOptions()) {
      whoBox.appendChild(checkbox(name, e.who.includes(name), (v) => {
        e.who = v ? e.who.concat(name) : e.who.filter((n) => n !== name);
        sortNames(e.who, whoOptions());
        updateDiff();
      }));
    }
    row.appendChild(whoBox);
    row.appendChild(delButton(() => {
      cur.events = cur.events.filter((x) => x !== e);
      renderEventRows();
      updateDiff();
    }));
    return row;
  }

  // ---------- 添加表单 ----------
  function bindAddForms() {
    document.getElementById("member-add").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const f = ev.target;
      cur.site.members.push({
        id: nextId(cur.site.members.concat(orig.site.members)),
        name: f.name.value.trim(),
        roman: f.roman.value.trim(),
        emoji: f.emoji.value.trim(),
        heart: "", color: "", birthday: "", mascot: "", intro: "", socials: [],
      });
      f.reset();
      renderAll();
    });

    document.getElementById("show-add").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const f = ev.target;
      cur.shows.push({
        id: nextId(cur.shows.concat(orig.shows)),
        date: f.date.value,
        time: f.time.value.trim(),
        venue: f.venue.value.trim(),
        note: f.note.value.trim(),
        special: f.special.checked,
        absent: checkedNames(f),
      });
      f.reset();
      renderShowRows();
      updateDiff();
    });

    document.getElementById("event-add").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const f = ev.target;
      cur.events.push({
        id: nextId(cur.events.concat(orig.events)),
        date: f.date.value,
        title: f.title.value.trim(),
        note: f.note.value.trim(),
        who: checkedNames(f),
      });
      f.reset();
      renderEventRows();
      updateDiff();
    });
  }

  function renderChecks(id, names) {
    const box = document.getElementById(id);
    box.innerHTML = "";
    for (const name of names) {
      const label = el("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = name;
      cb.className = "name-check";
      label.append(cb, " " + name);
      box.appendChild(label);
    }
  }

  function checkedNames(form) {
    return Array.from(form.querySelectorAll(".name-check:checked")).map((c) => c.value);
  }

  // ---------- 待保存改动 ----------
  function computeChanges() {
    return {
      site: ED.diffObject(orig.site.group, cur.site.group, ED.GROUP_FIELDS, "团体资料")
        .concat(ED.diffList(orig.site.members, cur.site.members, ED.MEMBER_FIELDS,
          (m) => "成员「" + m.name + "」")),
      shows: ED.diffList(orig.shows, cur.shows, ED.SHOW_FIELDS,
        (s) => "演出 " + s.date + (s.note ? "「" + s.note + "」" : "")),
      events: ED.diffList(orig.events, cur.events, ED.EVENT_FIELDS,
        (e) => "大事纪 " + e.date + "「" + e.title + "」"),
    };
  }

  function updateDiff() {
    const c = computeChanges();
    const all = c.site.concat(c.shows, c.events);
    const box = document.getElementById("diff-list");
    document.getElementById("save").disabled = !all.length;
    document.getElementById("discard").disabled = !all.length;
    setStatus(all.length ? all.length + " 项改动" : "");
    if (!all.length) {
      box.textContent = "暂无改动";
      return;
    }
    box.innerHTML = "";
    const typeLabel = { add: "新增", mod: "修改", del: "删除" };
    for (const ch of all) {
      const item = el("div", "diff-item " + ch.type);
      const head = el("div", "diff-item-head");
      head.append(badge(typeLabel[ch.type], ch.type), " " + ch.label);
      item.appendChild(head);
      for (const d of ch.details) {
        const line = el("div", "diff-detail");
        line.textContent = d;
        item.appendChild(line);
      }
      box.appendChild(item);
    }
  }

  // ---------- 保存 ----------
  async function save() {
    const c = computeChanges();
    sortShows(cur.shows);
    sortByDate(cur.events);
    const jobs = [];
    if (c.site.length) jobs.push(post("site", cur.site));
    if (c.shows.length) jobs.push(post("shows", cur.shows));
    if (c.events.length) jobs.push(post("events", cur.events));
    try {
      await Promise.all(jobs);
      orig = deepCopy(cur);
      renderAll();
      setStatus("✓ 已保存");
    } catch (err) {
      setStatus("✗ 保存失败:" + err.message + "(线上不可保存,请在本地 serve.py 下编辑)");
    }
  }

  async function post(file, data) {
    const r = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file, data }),
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
  }

  // ---------- 小工具 ----------
  function sortShows(list) {
    list.sort((a, b) => (a.date + "#" + a.id < b.date + "#" + b.id ? -1 : 1));
  }
  function sortByDate(list) {
    list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
  }
  function sortNames(list, order) {
    list.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }
  function nextId(list) {
    return list.reduce((m, x) => Math.max(m, x.id), 0) + 1;
  }
  function deepCopy(x) {
    return JSON.parse(JSON.stringify(x));
  }
  function el(tag, cls) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    return node;
  }
  function labeled(text, node) {
    const wrap = el("label", "field");
    const span = el("span", "field-label");
    span.textContent = text;
    wrap.append(span, node);
    return wrap;
  }
  function input(type, value, onChange, placeholder, size) {
    const node = document.createElement("input");
    node.type = type;
    node.value = value == null ? "" : value;
    if (placeholder) node.placeholder = placeholder;
    if (size) node.size = size;
    node.addEventListener("change", () => onChange(node.value.trim()));
    return node;
  }
  function checkbox(label, checked, onChange) {
    const wrap = el("label", "check");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = checked;
    cb.addEventListener("change", () => onChange(cb.checked));
    wrap.append(cb, " " + label);
    return wrap;
  }
  function delButton(onClick, title) {
    const btn = el("button", "del");
    btn.type = "button";
    btn.textContent = "🗑";
    btn.title = title || "删除(保存前可在待保存改动里反悔)";
    btn.addEventListener("click", onClick);
    return btn;
  }
  function badge(text, type) {
    const b = el("span", "diff-badge " + type);
    b.textContent = text;
    return b;
  }
  function setStatus(text) {
    document.getElementById("diff-status").textContent = text;
  }
})();
