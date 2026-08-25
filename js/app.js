// 入口：读取数据、推导、渲染四个区块。纯展示，没有写入。
// 公共数据（演出/大事纪）从 data/*.json 加载——这两个文件同时也是对外的订阅源。
(async function () {
  "use strict";

  const D = window.derive;
  const [site, shows, events, venues] = await Promise.all([
    fetch("data/site.json").then((r) => r.json()),
    fetch("data/shows.json").then((r) => r.json()),
    fetch("data/events.json").then((r) => r.json()),
    fetch("data/venues.json").then((r) => r.json()),
  ]);
  const venueByName = new Map(venues.map((v) => [v.name, v]));

  const today = D.beijingToday();
  const numbered = D.withNumbers(shows);
  const { past, upcoming } = D.splitByToday(numbered, today);

  renderHero();
  renderMembers();
  renderShows(null);
  bindFilters();
  renderTimeline();

  // ---------- Hero ----------
  function renderHero() {
    const g = site.group;
    document.title = g.name + " " + g.emoji;
    setText("group-name", g.emoji + " " + g.name + " " + g.emoji);
    setText("group-tagline", g.tagline);
    setText("group-intro", g.intro || "");
    const meta = [
      fmtDate(g.debutDate) + " 出道",
      "出道第 " + (D.daysBetween(g.debutDate, today) + 1) + " 天",
      "已演出 " + past.length + " 场",
    ];
    if (g.agency) meta.push("运营:" + g.agency);
    if (g.manager) meta.push("经纪人:" + g.manager);
    setText("group-sub", meta.join(" · "));
    const groupLinks = [];
    if (g.weibo) groupLinks.push('<a href="' + esc(g.weibo) + '" target="_blank" rel="noopener">📱 官方微博</a>');
    if (g.managerWeibo) {
      const icon = g.managerIcon
        ? '<img class="link-avatar" src="' + esc(g.managerIcon) + '" alt=""> '
        : "👤 ";
      groupLinks.push('<a href="' + esc(g.managerWeibo) + '" target="_blank" rel="noopener">' +
        icon + esc(g.manager || "经纪人") + " 微博</a>");
    }
    if (g.fanGroup) {
      groupLinks.push('<a href="' + esc(g.fanGroup) + '" target="_blank" rel="noopener">💬 微博群</a>');
    }
    document.getElementById("group-links").innerHTML = groupLinks.join(" · ");

    const next = upcoming[0];
    const nextBox = document.getElementById("next-show");
    if (!next) {
      nextBox.innerHTML = '<div class="next-label">暂无已排期的演出</div>';
    } else {
      const days = D.daysBetween(today, next.date);
      const when = days === 0 ? "就是今天！" : "还有 " + days + " 天";
      const v = next.venue ? venueByName.get(next.venue) : null;
      nextBox.innerHTML =
        '<div class="next-label">下一场演出</div>' +
        '<div class="next-date">' + fmtDate(next.date) + " " + weekday(next.date) + "</div>" +
        '<div class="next-count">' + when + "</div>" +
        (next.venue
          ? '<div class="next-venue">📍 ' + esc(next.venue) +
            (v && v.address ? '<span class="next-address">' + esc(v.address) + "</span>" : "") +
            "</div>"
          : "") +
        (next.note ? '<div class="next-note">' + esc(next.note) + "</div>" : "");
    }

    const mile = D.nextMilestone(past.length, site.milestones, numbered);
    const stats = [
      ["已演出", past.length + " 场"],
      ["接下来", upcoming.length + " 场已排期"],
    ];
    if (mile) {
      stats.push([
        "第 " + mile.target + " 场",
        "还差 " + mile.remaining + " 场" + (mile.date ? " · " + fmtDate(mile.date) : ""),
      ]);
    }
    document.getElementById("stats").innerHTML = stats
      .map(
        ([label, value]) =>
          '<div class="stat"><div class="stat-value">' + esc(value) +
          '</div><div class="stat-label">' + esc(label) + "</div></div>"
      )
      .join("");
  }

  // ---------- 成员 ----------
  function renderMembers() {
    document.getElementById("members").innerHTML = site.members
      .map((m) => {
        const s = D.memberStats(m.name, past);
        const rows = [];
        if (m.birthday) rows.push(["生日", m.birthday.replace("-", ".")]);
        if (m.mascot) rows.push(["代表物", m.mascot]);
        rows.push(["初舞台", s.firstDate ? fmtDate(s.firstDate) : "待定"]);
        rows.push(["出席", s.count + " / " + s.total + " 场"]);
        const links = (m.socials || [])
          .map((url) =>
            '<a href="' + esc(url) + '" target="_blank" rel="noopener">' +
            (url.includes("weibo") ? "微博" : esc(url.replace(/^https?:\/\//, "").split("/")[0])) +
            "</a>")
          .join(" ");
        return (
          '<div class="member-card"' +
          (m.color ? ' style="border-top: 3px solid ' + esc(m.color) + '"' : "") + ">" +
          '<div class="member-emoji"' +
          (m.color ? ' style="background:' + esc(m.color) + '2e"' : "") + ">" + m.emoji + "</div>" +
          '<div class="member-name">' + esc(m.name) + (m.heart ? " " + m.heart : "") + "</div>" +
          (m.roman ? '<div class="member-roman">' + esc(m.roman) + "</div>" : "") +
          (m.intro ? '<div class="member-intro">' + esc(m.intro) + "</div>" : "") +
          '<div class="member-meta">' +
          rows
            .map(
              ([label, value]) =>
                '<div class="mrow"><span class="ml">' + esc(label) +
                '</span><span class="mv">' + esc(value) + "</span></div>"
            )
            .join("") +
          "</div>" +
          (links ? '<div class="member-links">' + links + "</div>" : "") +
          "</div>"
        );
      })
      .join("");
  }

  // ---------- 演出档案 ----------
  function renderShows(filterName) {
    const list = numbered
      .slice()
      .reverse()
      .filter((s) => !filterName || D.attended(s, filterName));
    document.getElementById("show-count").textContent =
      filterName ? filterName + " 出席 " + list.filter((s) => s.date < today).length + " 场"
                 : "共 " + numbered.length + " 场";
    document.getElementById("shows").innerHTML = list
      .map((s) => {
        const future = s.date >= today;
        const lineup = site.members
          .map((m) => {
            const here = D.attended(s, m.name);
            return '<span class="dot' + (here ? "" : " absent") + '" title="' +
              esc(m.name + (here ? "" : "（缺席）")) + '">' + m.emoji + "</span>";
          })
          .join("");
        return (
          '<div class="show-row' + (future ? " future" : "") + (s.special ? " special" : "") + '">' +
          '<div class="show-n">' + (future ? "待演" : "第" + s.n + "场") + "</div>" +
          '<div class="show-date">' + fmtDate(s.date) + " " + weekday(s.date) +
          (s.time ? " " + esc(s.time) : "") + "</div>" +
          '<div class="show-note">' +
          (s.special ? '<span class="tag">特别场</span>' : "") +
          (s.venue ? '<span class="show-venue">📍' + esc(s.venue) + "</span>" : "") +
          esc(s.note || "") +
          "</div>" +
          '<div class="show-lineup">' + lineup + "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  function bindFilters() {
    const box = document.getElementById("filters");
    const chips = [{ name: null, label: "全部", color: "" }].concat(
      site.members.map((m) => ({ name: m.name, label: m.emoji + " " + m.name, color: m.color }))
    );
    box.innerHTML = chips
      .map(
        (c, i) =>
          '<button class="chip' + (i === 0 ? " on" : "") + '" data-name="' +
          (c.name || "") + '">' +
          (c.color ? '<span class="chip-dot" style="background:' + esc(c.color) + '"></span>' : "") +
          esc(c.label) + "</button>"
      )
      .join("");
    box.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      box.querySelectorAll(".chip").forEach((b) => b.classList.toggle("on", b === btn));
      renderShows(btn.dataset.name || null);
    });
  }

  // ---------- 时间线 ----------
  function renderTimeline() {
    const items = D.buildTimeline(events, numbered);
    document.getElementById("timeline").innerHTML = items
      .map(
        (it) =>
          '<div class="tl-item ' + it.type + '">' +
          '<div class="tl-date">' + fmtDate(it.date) + "</div>" +
          '<div class="tl-body"><div class="tl-title">' + esc(it.title) + "</div>" +
          (it.note ? '<div class="tl-note">' + esc(it.note) + "</div>" : "") +
          "</div></div>"
      )
      .join("");
  }

  // ---------- 小工具 ----------
  function fmtDate(ymd) {
    const [y, m, d] = ymd.split("-");
    return y + "." + m + "." + d;
  }
  function weekday(ymd) {
    const [y, m, d] = ymd.split("-").map(Number);
    return "周" + "日一二三四五六"[new Date(y, m - 1, d).getDay()];
  }
  function setText(id, text) {
    document.getElementById(id).textContent = text;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
    );
  }
})();
