// 编辑页：加载公共 JSON → 页面内编辑 → 底部实时显示待保存改动 → 保存时 POST 给 serve.py 写回文件。
// 团体/成员/演出/大事纪都在这里改。成员或团体改名会级联更新演出缺席、大事纪关联里的名字。
(async function () {
  "use strict";

  const ED = window.editDiff;

  let orig = { site: null, shows: [], events: [], venues: [], videos: [], songs: [], news: [] };
  let cur = { site: null, shows: [], events: [], venues: [], videos: [], songs: [], news: [] };
  const hashes = {}; // 文件名 -> 读取时的 sha256,保存时给 serve.py 做并发核对

  await reload();
  bindAddForms();
  document.getElementById("save").addEventListener("click", save);
  document.getElementById("discard").addEventListener("click", async () => {
    await reload();
    setStatus("已放弃改动");
  });

  async function loadJson(name) {
    const r = await fetch("data/" + name + ".json");
    if (!r.ok) throw new Error("data/" + name + ".json 加载失败(HTTP " + r.status + ")");
    const text = await r.text();
    hashes[name] = await sha256(text);
    return JSON.parse(text);
  }

  async function reload() {
    const [site, shows, events, venues, videos, songs, news] = await Promise.all([
      loadJson("site"), loadJson("shows"), loadJson("events"), loadJson("venues"),
      loadJson("videos"), loadJson("songs"), loadJson("news"),
    ]);
    orig = { site, shows, events, venues, videos, songs, news };
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
    renderVenueRows();
    renderNewsRows();
    renderSongRows();
    renderShowRows();
    renderEventRows();
    renderVideoRows();
    renderChecks("show-add-absent", memberNames());
    renderChecks("event-add-who", whoOptions());
    updateDiff();
  }

  // ---------- 场地 ----------
  function renderVenueRows() {
    const box = document.getElementById("venue-rows");
    box.innerHTML = "";
    for (const v of cur.venues) box.appendChild(venueRow(v));
  }

  function venueRow(v) {
    const row = el("div", "edit-row");
    row.appendChild(labeled("名称", input("text", v.name, (nv) => {
      if (nv && nv !== v.name) {
        for (const s of cur.shows) if (s.venue === v.name) s.venue = nv;
      }
      v.name = nv;
      renderAll();
    }, "", 10)));
    row.appendChild(labeled("地址", input("text", v.address, (nv) => { v.address = nv; updateDiff(); }, "", 28)));
    row.appendChild(labeled("交通", input("text", v.transit, (nv) => { v.transit = nv; updateDiff(); }, "地铁/公交(可选)", 14)));
    row.appendChild(labeled("备注", input("text", v.note, (nv) => { v.note = nv; updateDiff(); }, "", 12)));
    row.appendChild(delButton(() => {
      cur.venues = cur.venues.filter((x) => x !== v);
      renderAll();
    }, "删除场地(演出上的场地名不受影响)"));
    return row;
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
    row.appendChild(labeled("标语", input("text", g.catch, (v) => { g.catch = v; updateDiff(); }, "首页大标题", 18)));
    row.appendChild(labeled("出道日", input("date", g.debutDate, (v) => { g.debutDate = v; updateDiff(); })));
    row.appendChild(labeled("经纪公司", input("text", g.agency, (v) => { g.agency = v; updateDiff(); }, "", 8)));
    row.appendChild(labeled("经纪人", input("text", g.manager, (v) => { g.manager = v; updateDiff(); }, "", 8)));
    row.appendChild(labeled("官方微博", input("text", g.weibo, (v) => { g.weibo = v; updateDiff(); }, "链接", 18)));
    row.appendChild(labeled("官方小红书", input("text", g.xiaohongshu, (v) => { g.xiaohongshu = v; updateDiff(); }, "链接", 18)));
    row.appendChild(labeled("官方抖音", input("text", g.douyin, (v) => { g.douyin = v; updateDiff(); }, "链接", 18)));
    row.appendChild(labeled("经纪人微博", input("text", g.managerWeibo, (v) => { g.managerWeibo = v; updateDiff(); }, "链接", 18)));
    row.appendChild(labeled("微博群", input("text", g.fanGroup, (v) => { g.fanGroup = v; updateDiff(); }, "链接", 18)));
    row.appendChild(labeled("经纪公司微博", input("text", g.agencyWeibo, (v) => { g.agencyWeibo = v; updateDiff(); }, "链接", 18)));
    row.appendChild(labeled("经纪人头像", input("text", g.managerIcon, (v) => { g.managerIcon = v; updateDiff(); }, "图片路径", 14)));
    row.appendChild(labeled("介绍", input("text", g.intro, (v) => { g.intro = v; updateDiff(); }, "更长的介绍(可选)", 24)));
    // 小飞Tobi 彩蛋弹窗(点首页资料行的经纪人名字触发)
    const mp = g.managerProfile = g.managerProfile || {};
    row.appendChild(labeled("小飞显示名", input("text", mp.name, (v) => { mp.name = v; updateDiff(); }, "弹窗标题", 8)));
    row.appendChild(labeled("小飞罗马字", input("text", mp.roman, (v) => { mp.roman = v; updateDiff(); }, "", 8)));
    row.appendChild(labeled("小飞生日", input("text", mp.birthday, (v) => { mp.birthday = v; updateDiff(); }, "MM-DD", 6)));
    row.appendChild(labeled("小飞MBTI", input("text", mp.mbti, (v) => { mp.mbti = v; updateDiff(); }, "", 6)));
    row.appendChild(labeled("小飞初披露", input("text", mp.firstStage, (v) => { mp.firstStage = v; updateDiff(); }, "YYYY.MM.DD", 10)));
    row.appendChild(labeled("小飞口号", input("text", mp.catch, (v) => { mp.catch = v; updateDiff(); }, "", 10)));
    row.appendChild(labeled("小飞应援色", input("text", mp.color, (v) => { mp.color = v; updateDiff(); }, "#d43c3c", 8)));
    row.appendChild(labeled("小飞写真", input("text", mp.photo, (v) => { mp.photo = v; updateDiff(); }, "图片路径", 14)));
    row.appendChild(labeled("小飞链接", input("text", (mp.socials || []).join(", "), (v) => {
      mp.socials = v.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      updateDiff();
    }, "B站/小红书/抖音等,逗号分隔", 24)));
    row.appendChild(labeled("小飞简介", textarea(mp.bio, (v) => { mp.bio = v; updateDiff(); })));
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
    // 出道日=个人偶像生涯出道(可能在前团),留空则弹窗不显示相关两项
    row.appendChild(labeled("出道日", input("date", m.debutDate, (v) => { m.debutDate = v; updateDiff(); })));
    // 入团前场次:前团出演数,生涯出演=它+本团出席;0/留空则弹窗不显示生涯行
    row.appendChild(labeled("入团前场次", input("number", m.prevShows, (v) => {
      m.prevShows = Number(v) || 0;
      updateDiff();
    }, "", 5)));
    row.appendChild(labeled("生日", input("text", m.birthday, (v) => { m.birthday = v; updateDiff(); }, "月-日", 6)));
    row.appendChild(labeled("代表物", input("text", m.mascot, (v) => { m.mascot = v; updateDiff(); }, "", 8)));
    row.appendChild(labeled("MBTI", input("text", m.mbti, (v) => { m.mbti = v; updateDiff(); }, "", 5)));
    row.appendChild(labeled("出身/介绍", input("text", m.intro, (v) => { m.intro = v; updateDiff(); }, "介绍(可选)", 14)));
    row.appendChild(labeled("照片", input("text", m.photo, (v) => { m.photo = v; updateDiff(); }, "assets/xx.jpg", 14)));
    row.appendChild(labeled("粉丝群名", input("text", m.fanGroupName, (v) => { m.fanGroupName = v; updateDiff(); }, "", 10)));
    row.appendChild(labeled("粉丝群链接", input("text", m.fanGroup, (v) => { m.fanGroup = v; updateDiff(); }, "链接", 16)));
    row.appendChild(labeled("超话", input("text", m.chaohua, (v) => { m.chaohua = v; updateDiff(); }, "链接(可选)", 16)));
    row.appendChild(labeled("担当宣言", input("text", m.catch, (v) => { m.catch = v; updateDiff(); }, "如:浅紫色担当", 10)));
    row.appendChild(labeled("链接", input("text", (m.socials || []).join(", "), (v) => {
      m.socials = v.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      updateDiff();
    }, "逗号分隔(可选)", 18)));
    row.appendChild(labeled("详细介绍", textarea(m.bio, (v) => { m.bio = v; updateDiff(); })));
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
    row.appendChild(setlistEditor(s));
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

  // ---------- 情报 ----------
  function renderNewsRows() {
    const box = document.getElementById("news-rows");
    box.innerHTML = "";
    const sorted = cur.news.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    for (const n of sorted) box.appendChild(newsRow(n));
  }

  function newsRow(n) {
    const row = el("div", "edit-row");
    row.appendChild(input("date", n.date, (v) => { n.date = v; renderNewsRows(); updateDiff(); }));
    const sel = document.createElement("select");
    sel.className = "sl-select";
    for (const c of ["公演", "物贩", "生诞祭", "里程碑", "其他"]) {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      if (n.cat === c) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", () => { n.cat = sel.value; updateDiff(); });
    row.appendChild(labeled("分类", sel));
    row.appendChild(input("text", n.title, (v) => { n.title = v; updateDiff(); }, "标题", 20));
    row.appendChild(input("text", n.link, (v) => { n.link = v; updateDiff(); }, "链接(可选)", 16));
    // 生效/撤下日期(均含当天):未到生效日不展示、过撤下日不展示,留空=不限
    row.appendChild(labeled("生效日", input("date", n.from, (v) => { n.from = v; updateDiff(); })));
    row.appendChild(labeled("展示至", input("date", n.until, (v) => { n.until = v; updateDiff(); })));
    row.appendChild(checkbox("置顶", !!n.pinned, (v) => { n.pinned = v; updateDiff(); }));
    row.appendChild(labeled("正文", textarea(n.body, (v) => { n.body = v; updateDiff(); })));
    row.appendChild(delButton(() => {
      cur.news = cur.news.filter((x) => x !== n);
      renderNewsRows();
      updateDiff();
    }));
    return row;
  }

  // ---------- 歌曲 ----------
  function renderSongRows() {
    const box = document.getElementById("song-rows");
    box.innerHTML = "";
    for (const s of cur.songs) box.appendChild(songRow(s));
  }

  function songRow(s) {
    const row = el("div", "edit-row");
    row.appendChild(labeled("曲名", input("text", s.title, (v) => { s.title = v; renderAll(); }, "", 14)));
    row.appendChild(labeled("原唱", input("text", s.artist, (v) => { s.artist = v; updateDiff(); }, "原唱(可选)", 12)));
    row.appendChild(labeled("备注", input("text", s.note, (v) => { s.note = v; updateDiff(); }, "", 10)));
    row.appendChild(labeled("应援", textarea(s.call, (v) => { s.call = v; updateDiff(); })));
    row.appendChild(delButton(() => {
      cur.songs = cur.songs.filter((x) => x !== s);
      for (const sh of cur.shows) sh.setlist = (sh.setlist || []).filter((id) => id !== s.id);
      renderAll();
    }, "删除歌曲(会同时从所有歌单里移除)"));
    return row;
  }

  // 演出行里的歌单编辑器:已选曲目按顺序排,点 × 移除,下拉选曲添加
  function setlistEditor(show) {
    const wrap = el("span", "member-checks setlist-editor");
    wrap.append("歌单:");
    (show.setlist || []).forEach((id, idx) => {
      const song = cur.songs.find((x) => x.id === id);
      const chip = el("span", "sl-chip");
      chip.textContent = (idx + 1) + "." + (song ? song.title : "?");
      const x = el("button", "sl-remove");
      x.type = "button";
      x.textContent = "×";
      x.addEventListener("click", () => {
        show.setlist.splice(idx, 1);
        renderShowRows();
        updateDiff();
      });
      chip.appendChild(x);
      wrap.appendChild(chip);
    });
    const sel = document.createElement("select");
    sel.className = "sl-select";
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "+ 加一首…";
    sel.appendChild(ph);
    for (const song of cur.songs) {
      const opt = document.createElement("option");
      opt.value = song.id;
      opt.textContent = song.title;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", () => {
      if (!sel.value) return;
      let list = show.setlist || [];
      // 开场 SE 每场必有:歌单从空开始录第一首时自动补上(除非第一首就是 SE)
      if (!list.length) {
        const se = cur.songs.find((song) => /SE/.test(song.title));
        if (se && Number(sel.value) !== se.id) list = [se.id];
      }
      show.setlist = list.concat(Number(sel.value));
      renderShowRows();
      updateDiff();
    });
    wrap.appendChild(sel);
    return wrap;
  }

  // ---------- 影像 ----------
  function renderVideoRows() {
    const box = document.getElementById("video-rows");
    box.innerHTML = "";
    for (const v of cur.videos) box.appendChild(videoRow(v));
  }

  function videoRow(v) {
    const row = el("div", "edit-row");
    row.appendChild(input("date", v.date, (nv) => { v.date = nv; updateDiff(); }));
    row.appendChild(input("text", v.title, (nv) => { v.title = nv; updateDiff(); }, "标题", 24));
    row.appendChild(input("text", v.url, (nv) => { v.url = nv; updateDiff(); }, "链接", 28));
    row.appendChild(input("text", v.cover, (nv) => { v.cover = nv; updateDiff(); }, "封面路径(可选)", 16));
    row.appendChild(delButton(() => {
      cur.videos = cur.videos.filter((x) => x !== v);
      renderVideoRows();
      updateDiff();
    }));
    return row;
  }

  // ---------- 添加表单 ----------
  function bindAddForms() {
    document.getElementById("news-add").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const f = ev.target;
      cur.news.push({
        id: nextId(cur.news.concat(orig.news)),
        date: f.date.value,
        cat: f.cat.value,
        title: f.title.value.trim(),
        body: "", link: "", from: "", until: "", pinned: false,
      });
      f.reset();
      renderNewsRows();
      updateDiff();
    });

    document.getElementById("song-add").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const f = ev.target;
      cur.songs.push({
        id: nextId(cur.songs.concat(orig.songs)),
        title: f.title.value.trim(),
        artist: f.artist.value.trim(),
        note: "", call: "",
      });
      f.reset();
      renderAll();
    });

    document.getElementById("video-add").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const f = ev.target;
      cur.videos.unshift({
        id: nextId(cur.videos.concat(orig.videos)),
        date: f.date.value,
        title: f.title.value.trim(),
        url: f.url.value.trim(),
        cover: "",
      });
      f.reset();
      renderVideoRows();
      updateDiff();
    });

    document.getElementById("venue-add").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const f = ev.target;
      cur.venues.push({
        id: nextId(cur.venues.concat(orig.venues)),
        name: f.name.value.trim(),
        address: f.address.value.trim(),
        transit: "", note: "",
      });
      f.reset();
      renderVenueRows();
      updateDiff();
    });

    document.getElementById("member-add").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const f = ev.target;
      cur.site.members.push({
        id: nextId(cur.site.members.concat(orig.site.members)),
        name: f.name.value.trim(),
        roman: f.roman.value.trim(),
        emoji: f.emoji.value.trim(),
        heart: "", color: "", birthday: "", mascot: "", mbti: "", catch: "",
        intro: "", bio: "", photo: "", fanGroupName: "", fanGroup: "", socials: [],
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
    const tag = (list, coll) => list.map((c) => Object.assign({ coll }, c));
    return {
      group: tag(ED.diffObject(orig.site.group, cur.site.group, ED.GROUP_FIELDS, "团体资料"), "group"),
      members: tag(ED.diffList(orig.site.members, cur.site.members, ED.MEMBER_FIELDS,
        (m) => "成员「" + m.name + "」"), "members"),
      venues: tag(ED.diffList(orig.venues, cur.venues, ED.VENUE_FIELDS,
        (v) => "场地「" + v.name + "」"), "venues"),
      videos: tag(ED.diffList(orig.videos, cur.videos, ED.VIDEO_FIELDS,
        (v) => "影像「" + v.title + "」"), "videos"),
      songs: tag(ED.diffList(orig.songs, cur.songs, ED.SONG_FIELDS,
        (s) => "歌曲「" + s.title + "」"), "songs"),
      news: tag(ED.diffList(orig.news, cur.news, ED.NEWS_FIELDS,
        (n) => "情报「" + n.title + "」"), "news"),
      shows: tag(ED.diffList(orig.shows, cur.shows, ED.SHOW_FIELDS,
        (s) => "演出 " + s.date + (s.note ? "「" + s.note + "」" : "")), "shows"),
      events: tag(ED.diffList(orig.events, cur.events, ED.EVENT_FIELDS,
        (e) => "大事纪 " + e.date + "「" + e.title + "」"), "events"),
    };
  }

  // 撤销单条改动:恢复成文件里(orig)的样子
  function undoChange(ch) {
    if (ch.coll === "group") {
      cur.site.group = deepCopy(orig.site.group);
    } else {
      const lists = {
        members: [cur.site.members, orig.site.members],
        venues: [cur.venues, orig.venues],
        shows: [cur.shows, orig.shows],
        events: [cur.events, orig.events],
        videos: [cur.videos, orig.videos],
        songs: [cur.songs, orig.songs],
        news: [cur.news, orig.news],
      };
      const [curList, origList] = lists[ch.coll];
      const idx = curList.findIndex((x) => x.id === ch.ref);
      const origItem = origList.find((x) => x.id === ch.ref);
      if (ch.type === "add" && idx >= 0) curList.splice(idx, 1);
      else if (ch.type === "del" && origItem) curList.push(deepCopy(origItem));
      else if (ch.type === "mod" && idx >= 0 && origItem) curList[idx] = deepCopy(origItem);
      if (ch.coll === "members") cur.site.members = curList;
    }
    renderAll();
  }

  function updateDiff() {
    const c = computeChanges();
    const all = c.group.concat(c.members, c.venues, c.songs, c.shows, c.events, c.videos, c.news);
    const errors = ED.validateAll(cur);
    const box = document.getElementById("diff-list");
    document.getElementById("save").disabled = !all.length || errors.length > 0;
    document.getElementById("discard").disabled = !all.length;
    setStatus(
      errors.length ? "⚠️ " + errors.length + " 处格式错误,修正后才能保存"
        : all.length ? all.length + " 项改动" : ""
    );
    if (!all.length && !errors.length) {
      box.textContent = "暂无改动";
      return;
    }
    box.innerHTML = "";
    for (const err of errors) {
      const line = el("div", "diff-error");
      line.textContent = "⚠️ " + err;
      box.appendChild(line);
    }
    const typeLabel = { add: "新增", mod: "修改", del: "删除" };
    for (const ch of all) {
      const item = el("div", "diff-item " + ch.type);
      const head = el("div", "diff-item-head");
      head.append(badge(typeLabel[ch.type], ch.type), " " + ch.label);
      const undo = el("button", "diff-undo");
      undo.type = "button";
      undo.textContent = "撤销";
      undo.title = "只撤销这一条改动";
      undo.addEventListener("click", () => undoChange(ch));
      head.appendChild(undo);
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
    if (c.group.length || c.members.length) jobs.push(post("site", cur.site));
    if (c.venues.length) jobs.push(post("venues", cur.venues));
    if (c.shows.length) jobs.push(post("shows", cur.shows));
    if (c.events.length) jobs.push(post("events", cur.events));
    if (c.videos.length) jobs.push(post("videos", cur.videos));
    if (c.songs.length) jobs.push(post("songs", cur.songs));
    if (c.news.length) jobs.push(post("news", cur.news));
    try {
      await Promise.all(jobs);
      orig = deepCopy(cur);
      renderAll();
      setStatus("✓ 已保存");
    } catch (err) {
      if (err.conflict) {
        setStatus("✗ 保存被拒绝:数据已在别的标签页(或手工)被修改过。" +
          "请复制好你的改动内容,刷新本页后重做,以免覆盖别处的修改。");
      } else {
        setStatus("✗ 保存失败:" + err.message + "(线上不可保存,请在本地 serve.py 下编辑)");
      }
    }
  }

  async function post(file, data) {
    const r = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file, data, baseHash: hashes[file] }),
    });
    if (r.status === 409) {
      const e = new Error("conflict");
      e.conflict = true;
      throw e;
    }
    if (!r.ok) throw new Error("HTTP " + r.status);
    const resp = await r.json();
    if (resp.hash) hashes[file] = resp.hash;
  }

  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
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
  function textarea(value, onChange) {
    const node = document.createElement("textarea");
    node.value = value == null ? "" : value;
    node.rows = 2;
    node.placeholder = "多行介绍(可选),回车分段";
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
