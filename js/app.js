// 入口：读取数据、推导、渲染四个区块。纯展示，没有写入。
// 公共数据（演出/大事纪）从 data/*.json 加载——这两个文件同时也是对外的订阅源。
(async function () {
  "use strict";

  if (new URLSearchParams(location.search).has("maintenance")) {
    throw new Error("维护模式预览(URL 带 ?maintenance)");
  }

  const D = window.derive;
  const [site, shows, events, venues, videos, songs, news] = await Promise.all([
    fetch("data/site.json").then((r) => r.json()),
    fetch("data/shows.json").then((r) => r.json()),
    fetch("data/events.json").then((r) => r.json()),
    fetch("data/venues.json").then((r) => r.json()),
    fetch("data/videos.json").then((r) => r.json()),
    fetch("data/songs.json").then((r) => r.json()),
    fetch("data/news.json").then((r) => r.json()),
  ]);
  const venueByName = new Map(venues.map((v) => [v.name, v]));
  const songById = new Map(songs.map((s) => [s.id, s]));

  const today = D.beijingToday();
  const numbered = D.withNumbers(shows);
  const { past, upcoming } = D.splitByToday(numbered, today);

  const PER_PAGE = 10;
  let curFilter = null;
  let curPage = 1;
  let calView = "cal";
  const bjNow = today.split("-").map(Number);
  let calY = bjNow[0];
  let calM = bjNow[1];

  renderHero();
  renderMembers();
  bindMemberModal();
  // 预载成员写真,弹窗左右切换不闪白
  site.members.forEach((m) => {
    if (m.photo) new Image().src = m.photo;
  });
  renderNews();
  renderArchive();
  bindFilters();
  bindShowModal();
  bindViewToggle();
  bindIcsSubscribe();
  bindSetlistToggle();
  renderSongs();
  renderVideos();
  renderTimeline();
  initReveal();
  initNavAutoHide();
  // 编辑入口只在本地开发时显示(线上编辑页本来也没有保存接口)
  if (["localhost", "127.0.0.1"].includes(location.hostname)) {
    document.getElementById("edit-link").hidden = false;
  }

  // ---------- 顶栏:大图上透明白字,滚过 Hero 后变毛玻璃 ----------
  function initNavAutoHide() {
    const nav = document.querySelector(".topnav");
    const hero = document.querySelector(".hero-full");
    if (!nav || !hero) return;
    const update = () =>
      nav.classList.toggle("over-hero", window.scrollY < hero.offsetHeight - 66);
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
  }

  // ---------- 滚动渐入(区块整体 + 成员卡错峰) ----------
  function initReveal() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const targets = [];
    document.querySelectorAll("main section, footer .disclaimer").forEach((el) => targets.push(el));
    document.querySelectorAll(".member-card").forEach((el, i) => {
      el.style.setProperty("--d", (i * 0.09).toFixed(2) + "s");
      targets.push(el);
    });
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          el.classList.add("in");
          io.unobserve(el);
          // 渐入完成后清掉过渡类,避免影响 hover 等常规过渡
          setTimeout(() => {
            el.classList.remove("reveal", "in");
            el.style.removeProperty("--d");
          }, 1100);
        });
      },
      { threshold: 0.08 }
    );
    targets.forEach((el) => {
      el.classList.add("reveal");
      io.observe(el);
    });
  }

  // ---------- Hero ----------
  function renderHero() {
    const g = site.group;
    document.title = g.name + " " + g.emoji;
    // 大标题用 catchphrase(照片里已有 RealizE 手写字,避免名字连出现两次)
    // 标语以全角标点(!?。~)结尾时,标点字框右半是空的——
    // 右侧 emoji 前不再加空格,否则整行墨迹左偏、与上行光学不对中
    const catchText = g.catch || g.name;
    const tailGap = /[！？。～!?]$/.test(catchText) ? "" : " ";
    setText("group-name", g.emoji + " " + catchText + tailGap + g.emoji);
    // 副标:所属 + 定位 + 站点性质(表明是粉丝站,与免责声明呼应);
    // 每段 nowrap,窄屏只在「·」处换行,不把词组拦腰截断;
    // 分隔符做成元素,手机端隐藏末个分隔符并让末段独占一行,避免「·」孤悬行尾
    document.getElementById("group-tagline").innerHTML =
      [g.intro, g.tagline, "粉丝应援站"].filter(Boolean)
        .map((t) => '<span class="tg-seg">' + esc(t) + "</span>")
        .join('<span class="tg-sep"> · </span>');
    // PROFILE 式资料行:标签 + 值,竖线分隔
    const facts = [["出道", fmtDate(g.debutDate)]];
    if (g.agency) facts.push(["运营", g.agency]);
    if (g.manager) facts.push(["经纪人", g.manager]);
    // 「竖线+资料项」绑成整体,窄屏换行不会把竖线孤零零留在行尾
    document.getElementById("group-sub").innerHTML = facts
      .map(([k, v], i) =>
        '<span class="fact-unit">' + (i ? '<span class="f-sep"></span>' : "") +
        '<span class="fact"><span class="f-label">' + esc(k) +
        '</span><span class="f-value"' + (k === "经纪人" ? ' data-egg="tobi"' : "") + '>' +
        esc(v) + "</span></span></span>")
      .join("");
    // 隐藏彩蛋:点资料行里的经纪人名字弹出小飞Tobi 简介(无视觉提示,懂的都懂)
    const egg = document.querySelector('#group-sub .f-value[data-egg="tobi"]');
    if (egg && g.managerProfile) egg.addEventListener("click", openTobiModal);
    const groupLinks = [];
    if (g.weibo) groupLinks.push('<a href="' + esc(g.weibo) + '" target="_blank" rel="noopener">' +
      '<img class="wb-icon" src="assets/weibo.png" alt="">官方微博</a>');
    if (g.xiaohongshu) {
      groupLinks.push('<a href="' + esc(g.xiaohongshu) + '" target="_blank" rel="noopener">' +
        '<img class="wb-icon" src="assets/xhs.png" alt="">官方小红书</a>');
    }
    if (g.douyin) {
      groupLinks.push('<a href="' + esc(g.douyin) + '" target="_blank" rel="noopener">' +
        '<img class="wb-icon" src="assets/douyin.png" alt="">官方抖音</a>');
    }
    // 顺序:官方账号四连(微博/小红书/抖音/微博群)在前,小飞和七韵紧随其后
    if (g.fanGroup) {
      // 微博群也是微博平台入口,用微博图标与前排官方账号统一(不再混 emoji)
      groupLinks.push('<a href="' + esc(g.fanGroup) + '" target="_blank" rel="noopener">' +
        '<img class="wb-icon" src="assets/weibo.png" alt="">官方微博群</a>');
    }
    if (g.managerWeibo) {
      const icon = g.managerIcon
        ? '<img class="link-avatar" src="' + esc(g.managerIcon) + '" alt=""> '
        : '<span class="link-emoji">👤</span>';
      groupLinks.push('<a href="' + esc(g.managerWeibo) + '" target="_blank" rel="noopener">' +
        icon + esc(g.manager || "经纪人") + " 微博</a>");
    }
    if (g.agencyWeibo) {
      groupLinks.push('<a href="' + esc(g.agencyWeibo) + '" target="_blank" rel="noopener">' +
        '<img class="wb-icon" src="assets/weibo.png" alt="">七韵官博</a>');
    }
    document.getElementById("group-links").innerHTML = groupLinks.join("");

    const next = upcoming[0];
    const nextBox = document.getElementById("next-show");
    if (!next) {
      nextBox.innerHTML = '<div class="next-label">Next Live</div>' +
        '<div class="next-empty">暂无已排期的演出</div>';
    } else {
      const days = D.daysBetween(today, next.date);
      const when = days === 0 ? "就是今天！" : "还有 " + days + " 天";
      const v = next.venue ? venueByName.get(next.venue) : null;
      nextBox.innerHTML =
        '<div class="next-label">Next Live</div>' +
        '<div class="next-flex">' +
        '<div class="next-datebox">' +
        '<div class="next-date-num">' + next.date.slice(5).replace("-", ".") + "</div>" +
        '<div class="next-date-sub">' + next.date.slice(0, 4) + " · " + weekday(next.date) + "</div>" +
        '<div class="next-badge' + (days === 0 ? " today" : "") + '">' + when + "</div>" +
        "</div>" +
        '<div class="next-venuebox">' +
        (next.venue ? '<div class="next-venue">📍 ' + esc(next.venue) + "</div>" : "") +
        (v && v.address ? '<div class="next-address">' + glueTail(v.address) + "</div>" : "") +
        (next.note ? '<div class="next-note">' + esc(next.note) + "</div>" : "") +
        "</div>" +
        "</div>";
    }

    const mile = D.nextMilestone(past.length, site.milestones, numbered);
    // 数字大写统计:数值 Comfortaa 大号 + 单位 + 小标签,竖线分隔;
    // 里程碑并进第三格,避免和 NEXT LIVE/已排期重复
    const stats = [
      [String(D.daysBetween(g.debutDate, today) + 1), "天", "出道至今"],
      [String(past.length), "场", "已演出"],
      mile
        ? [String(mile.remaining), "场", "即满 " + mile.target + " 场"]
        : [String(upcoming.length), "场", "已排期"],
    ];
    document.getElementById("stats").innerHTML = stats
      .map(
        ([num, unit, label]) =>
          '<div class="stat"><div class="stat-value">' + esc(num) +
          '<span class="stat-unit">' + esc(unit) + "</span></div>" +
          '<div class="stat-label">' + esc(label) + "</div></div>"
      )
      .join("");
  }

  // ---------- 成员 ----------
  // 参考 peel-the-apple.com/profile:居中大图 + 照片下方名字/罗马音,干净无卡片框;详细资料在弹窗里
  function renderMembers() {
    document.getElementById("members").innerHTML = site.members
      .map((m, i) => {
        return (
          '<div class="member-card" data-index="' + i + '" title="点击查看详细介绍">' +
          (m.photo
            ? '<img class="member-photo" src="' + esc(m.photo) +
              '" alt="' + esc(m.name) + '" loading="lazy">'
            : '<div class="member-emoji"' +
              (m.color ? ' style="background:' + esc(m.color) + '2e"' : "") + ">" + m.emoji + "</div>") +
          '<div class="member-name">' + esc(m.name) + (m.heart ? " " + m.heart : "") + "</div>" +
          (m.roman ? '<div class="member-roman">' + esc(m.roman) + "</div>" : "") +
          (m.color ? '<div class="member-colorbar" style="background:' + esc(m.color) + '"></div>' : "") +
          "</div>"
        );
      })
      .join("");
  }

  // ---------- 成员详情弹窗 ----------
  let curMemberIndex = -1;
  // 弹窗当前显示的是不是小飞Tobi 彩蛋(是则关掉左右切换)
  let tobiMode = false;

  function bindMemberModal() {
    const mask = document.getElementById("member-modal");
    document.getElementById("members").addEventListener("click", (e) => {
      if (e.target.closest("a")) return; // 点微博链接不弹窗
      const card = e.target.closest(".member-card");
      if (!card) return;
      openMemberModal(Number(card.dataset.index));
    });
    document.getElementById("modal-close").addEventListener("click", closeModal);
    document.getElementById("modal-prev").addEventListener("click", () => navMember(-1));
    document.getElementById("modal-next").addEventListener("click", () => navMember(1));
    document.getElementById("modal-body").addEventListener("click", (e) => {
      const btn = e.target.closest(".tr-btn");
      if (!btn) return;
      const tr = btn.nextElementSibling;
      tr.hidden = !tr.hidden;
      btn.classList.toggle("on", !tr.hidden);
    });
    // 点弹窗左/右侧空白 = 上/下一位,点上下空白 = 关闭
    mask.addEventListener("click", (e) => {
      if (e.target !== mask) return;
      const rect = mask.querySelector(".modal").getBoundingClientRect();
      if (e.clientX > rect.right) navMember(1);
      else if (e.clientX < rect.left) navMember(-1);
      else closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (mask.hidden) return;
      if (e.key === "Escape") closeModal();
      else if (e.key === "ArrowRight") navMember(1);
      else if (e.key === "ArrowLeft") navMember(-1);
    });
    function closeModal() {
      mask.hidden = true;
      document.body.style.overflow = "";
    }
  }

  function navMember(delta) {
    if (tobiMode) return; // 彩蛋弹窗没有上/下一位
    const n = site.members.length;
    openMemberModal((curMemberIndex + delta + n) % n);
  }

  // 社交链接 → 带平台图标的按钮串(成员弹窗与小飞彩蛋共用)
  function socialLinks(list) {
    return (list || [])
      .map((url) => {
        const kind = url.includes("bilibili")
          ? ['<img class="wb-icon" src="assets/bilibili.png" alt="">', "B站"]
          : url.includes("douyin")
            ? ['<img class="wb-icon" src="assets/douyin.png" alt="">', "抖音"]
            : url.includes("xiaohongshu")
              ? ['<img class="wb-icon" src="assets/xhs.png" alt="">', "小红书"]
              : url.includes("weibo")
                ? ['<img class="wb-icon" src="assets/weibo.png" alt="">', "微博"]
                : ["", esc(url.replace(/^https?:\/\//, "").split("/")[0])];
        return '<a class="modal-weibo" href="' + esc(url) + '" target="_blank" rel="noopener">' +
          kind[0] + kind[1] + "</a>";
      })
      .join(" ");
  }

  // 行尾写 [译:xxx] 的句子会带一个「译」按钮,点击展开中文翻译
  function bioToHtml(bio) {
    if (!bio) return "<p class=\"bio-empty\">详细介绍整理中…</p>";
    return bio.split("\n").map((line) => {
      const match = line.match(/^(.*?)\s*\[译[:：](.+)\]\s*$/);
      if (!match) return "<p>" + esc(line) + "</p>";
      return "<p>" + esc(match[1]) +
        ' <button class="tr-btn" type="button">译</button>' +
        '<span class="tr-text" hidden>' + esc(match[2]) + "</span></p>";
    }).join("");
  }

  // 隐藏彩蛋:经纪人小飞Tobi 的简介弹窗,复用成员弹窗外壳
  function openTobiModal() {
    const g = site.group;
    const p = g.managerProfile;
    if (!p) return;
    tobiMode = true;
    document.getElementById("modal-prev").hidden = true;
    document.getElementById("modal-next").hidden = true;
    const color = p.color || "#d43c3c";
    const photo = p.photo
      ? '<img class="modal-photo" src="' + esc(p.photo) + '" alt="' + esc(g.manager) + '">'
      : '<div class="modal-photo modal-photo-placeholder" style="background:' + esc(color) + '2e">' +
        '<span class="ph-emoji">🎩</span><span class="ph-text">写真准备中</span></div>';
    const facts = [["职位", "经纪人"]];
    if (p.birthday) facts.push(["生日", p.birthday.replace("-", ".")]);
    if (p.mbti) facts.push(["MBTI", p.mbti]);
    // 微博(经纪人主链接)排最前,其余平台跟在后面
    const links = socialLinks([g.managerWeibo].filter(Boolean).concat(p.socials || []));
    document.querySelector("#member-modal .modal").style.borderTop = "4px solid " + color;
    document.getElementById("modal-body").innerHTML =
      photo +
      '<div class="modal-info">' +
      '<div class="modal-name">' + esc(p.name || g.manager) +
      ' <span class="modal-roman">' + esc(p.roman || "") + "</span>" +
      (p.catch
        ? ' <span class="catch-chip" style="background:' + esc(color) + '2e">' + esc(p.catch) + "</span>"
        : "") +
      "</div>" +
      '<div class="modal-facts">' +
      facts.map(([l, v]) =>
        '<span class="fact"><span class="fact-l">' + esc(l) + "</span>" + esc(v) + "</span>").join("") +
      "</div>" +
      '<div class="modal-bio">' + bioToHtml(p.bio) + "</div>" +
      links +
      "</div>";
    document.getElementById("member-modal").hidden = false;
    document.body.style.overflow = "hidden";
    const body = document.getElementById("modal-body");
    body.scrollTop = 0;
    const info = body.querySelector(".modal-info");
    if (info) info.scrollTop = 0;
  }

  function openMemberModal(index) {
    curMemberIndex = index;
    tobiMode = false;
    document.getElementById("modal-prev").hidden = false;
    document.getElementById("modal-next").hidden = false;
    const m = site.members[index];
    const s = D.memberStats(m.name, past);
    // 竖版(3:4)照片位:有照片放照片,没有就用应援色底 + emoji 占位
    const photo = m.photo
      ? '<img class="modal-photo" src="' + esc(m.photo) + '" alt="' + esc(m.name) + '">'
      : '<div class="modal-photo modal-photo-placeholder"' +
        (m.color ? ' style="background:' + esc(m.color) + '2e"' : "") + ">" +
        '<span class="ph-emoji">' + m.emoji + "</span>" +
        '<span class="ph-text">写真准备中</span></div>';
    const facts = [];
    if (m.birthday) facts.push(["生日", m.birthday.replace("-", ".")]);
    if (m.mbti) facts.push(["MBTI", m.mbti]);
    if (m.mascot) facts.push(["代表物", m.mascot + (m.emoji ? " " + m.emoji : "")]);
    facts.push(["初舞台", s.firstDate ? fmtDate(s.firstDate) : "待定"]);
    facts.push(["出席", s.count + " 场"]);
    const bioHtml = bioToHtml(m.bio);
    let links = socialLinks(m.socials);
    if (m.fanGroup) {
      links += ' <a class="modal-weibo" href="' + esc(m.fanGroup) + '" target="_blank" rel="noopener">' +
        '<span class="link-emoji">💬</span>微博群' +
        (m.fanGroupName ? ":" + esc(m.fanGroupName) : "") + "</a>";
    }
    if (m.chaohua) {
      links += ' <a class="modal-weibo" href="' + esc(m.chaohua) + '" target="_blank" rel="noopener">' +
        '<span class="link-emoji">⭐</span>超话</a>';
    }
    // 应援色沉浸:弹窗顶部色条 + 担当宣言
    const modalEl = document.querySelector("#member-modal .modal");
    modalEl.style.borderTop = "4px solid " + (m.color || "#a78bdb");
    document.getElementById("modal-body").innerHTML =
      photo +
      '<div class="modal-info">' +
      '<div class="modal-name">' + esc(m.name) + (m.heart ? " " + m.heart : "") +
      ' <span class="modal-roman">' + esc(m.roman || "") + "</span>" +
      (m.catch
        ? ' <span class="catch-chip" style="background:' + esc(m.color || "#a78bdb") + '2e">' +
          esc(m.catch) + "</span>"
        : "") +
      "</div>" +
      '<div class="modal-facts">' +
      facts.map(([l, v]) =>
        '<span class="fact"><span class="fact-l">' + esc(l) + "</span>" + esc(v) + "</span>").join("") +
      "</div>" +
      '<div class="modal-bio">' + bioHtml + "</div>" +
      links +
      "</div>";
    document.getElementById("member-modal").hidden = false;
    document.body.style.overflow = "hidden";
    // 左右切换成员后回到顶部(手机上 modal-body 滚动、桌面上 modal-info 滚动)
    const body = document.getElementById("modal-body");
    body.scrollTop = 0;
    const info = body.querySelector(".modal-info");
    if (info) info.scrollTop = 0;
  }

  // ---------- 情报 NEWS ----------
  function renderNews() {
    const box = document.getElementById("news");
    const list = news
      .slice()
      // 置顶优先 → 日期新在前 → 同日按 id 新在前(原先同日返回 -1 是矛盾比较,顺序随引擎而定)
      .sort((a, b) => (b.pinned - a.pinned) ||
        (a.date === b.date ? b.id - a.id : (a.date < b.date ? 1 : -1)));
    if (!list.length) {
      box.closest("section").hidden = true;
      return;
    }
    const catClass = { "公演": "cat-live", "物贩": "cat-goods", "生诞祭": "cat-bday", "其他": "cat-other" };
    box.innerHTML = list
      .map((n) => {
        const title = n.link
          ? '<a href="' + esc(n.link) + '" target="_blank" rel="noopener">' + esc(n.title) + "</a>"
          : esc(n.title);
        return (
          '<div class="news-row">' +
          '<span class="news-date">' + fmtDate(n.date) + "</span>" +
          '<span class="news-cat ' + (catClass[n.cat] || "cat-other") + '">' + esc(n.cat || "其他") + "</span>" +
          '<div class="news-main"><div class="news-title">' +
          (n.pinned ? '<span class="news-pin">置顶</span>' : "") + title + "</div>" +
          (n.body ? '<div class="news-body">' + esc(n.body) + "</div>" : "") +
          "</div></div>"
        );
      })
      .join("");
  }

  // ---------- 演出档案:日历 / 列表 双视图 ----------
  function renderArchive() {
    const isCal = calView === "cal";
    document.getElementById("calendar").hidden = !isCal;
    // 成员筛选只属于列表视图;日历始终显示全部,不受筛选影响
    document.getElementById("filters").hidden = isCal;
    document.getElementById("shows").hidden = isCal;
    document.getElementById("pager").hidden = isCal;
    if (isCal) renderCalendar();
    else renderShows();
  }

  function bindViewToggle() {
    const box = document.getElementById("view-toggle");
    box.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-view]");
      if (!btn) return;
      calView = btn.dataset.view;
      box.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === btn));
      renderArchive();
    });
  }

  // 列表视图的翻页/筛选依旧走 renderShows;日历不受影响

  function renderCalendar() {
    const box = document.getElementById("calendar");
    const cells = D.monthGrid(calY, calM);
    // 日历不参与成员筛选,始终显示全部场次
    document.getElementById("show-count").textContent = "共 " + numbered.length + " 场";
    const showsByDate = new Map();
    numbered.forEach((s) => {
      if (!showsByDate.has(s.date)) showsByDate.set(s.date, []);
      showsByDate.get(s.date).push(s);
    });
    const mmdd = (ymd) => ymd.slice(5);
    let html =
      '<div class="cal-head">' +
      '<button class="cal-nav" data-nav="-1">‹</button>' +
      '<span class="cal-title">' + calY + " 年 " + calM + " 月</span>" +
      '<button class="cal-nav" data-nav="1">›</button>' +
      '<button class="cal-today" data-nav="0">今天</button>' +
      "</div>" +
      '<div class="cal-grid">' +
      ["日", "一", "二", "三", "四", "五", "六"].map((d) => '<div class="cal-dow">' + d + "</div>").join("");
    for (const cell of cells) {
      const isToday = cell.ymd === today;
      let chips = "";
      for (const s of showsByDate.get(cell.ymd) || []) {
        const future = s.date >= today;
        // 格子里只写场地名(没有场地才退回场次号);场次号/备注/出席都在悬停提示里
        const label = s.venue || (future ? "待演" : "第" + s.n + "场");
        const full = (future ? "待演" : "第" + s.n + "场") + (s.venue ? " · " + s.venue : "");
        const lineup = site.members
          .filter((m) => D.attended(s, m.name))
          .map((m) => m.emoji + m.name)
          .join(" ");
        chips += '<span class="cal-chip' + (s.special ? " special" : "") + (future ? " future" : "") +
          '" data-show-id="' + s.id + '" title="' + esc(full + (s.note ? " · " + s.note : "")) +
          '">' + esc(label) + "</span>";
      }
      for (const m of site.members) {
        if (m.birthday && m.birthday === mmdd(cell.ymd)) {
          chips += '<span class="cal-chip bday" style="background:' + esc(m.color || "#ffd44d") + '33"' +
            ' title="' + esc(m.name + " 的生日") + '">🎂 ' + esc(m.name) + "</span>";
        }
      }
      html += '<div class="cal-cell' + (cell.inMonth ? "" : " other") + (isToday ? " today" : "") + '">' +
        '<span class="cal-day">' + cell.day + "</span>" + chips + "</div>";
    }
    html += "</div>";
    box.innerHTML = html;
    box.querySelectorAll("[data-nav]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const d = Number(btn.dataset.nav);
        if (d === 0) { calY = bjNow[0]; calM = bjNow[1]; }
        else {
          calM += d;
          if (calM < 1) { calM = 12; calY--; }
          if (calM > 12) { calM = 1; calY++; }
        }
        renderCalendar();
      })
    );
  }

  // ---------- 日历事件详情弹窗 ----------
  function bindShowModal() {
    const mask = document.getElementById("show-modal");
    document.getElementById("calendar").addEventListener("click", (e) => {
      const chip = e.target.closest(".cal-chip[data-show-id]");
      if (chip) openShowModal(Number(chip.dataset.showId));
    });
    document.getElementById("show-modal-close").addEventListener("click", closeShowModal);
    mask.addEventListener("click", (e) => { if (e.target === mask) closeShowModal(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !mask.hidden) closeShowModal();
    });
  }

  // 日程订阅弹窗:webcal 一键订阅(Apple)+ 复制链接(Google 等),复用日历详情弹窗外壳
  function bindIcsSubscribe() {
    const btn = document.getElementById("ics-btn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      // 相对当前页面解析,正式域名(根目录)和 githack 分支预览(子路径)都指向正确文件
      const httpsUrl = new URL("shows.ics", location.href).href;
      const webcalUrl = httpsUrl.replace(/^https?:/, "webcal:");
      document.getElementById("show-modal-body").innerHTML =
        '<div class="sd-badge">🔔 订阅演出日程</div>' +
        '<p class="ics-p">订阅一次,之后的新排期会自动同步进你的日历 App,不用再来站里翻。</p>' +
        '<a class="ics-main" href="' + webcalUrl + '">📲 一键订阅（iPhone / Mac 日历）</a>' +
        '<p class="ics-p">Google 日历或其他:复制链接,在日历里选「通过网址添加」粘贴:</p>' +
        '<div class="ics-linkrow"><code class="ics-link">' + esc(httpsUrl) + "</code>" +
        '<button type="button" id="ics-copy" class="ics-copy">复制</button></div>' +
        '<p class="ics-note">日程为全天事件,具体演出时间以官方微博为准。</p>';
      document.getElementById("ics-copy").addEventListener("click", async (e) => {
        try {
          await navigator.clipboard.writeText(httpsUrl);
          e.target.textContent = "已复制 ✓";
        } catch (err) {
          e.target.textContent = "请手动复制上面的链接";
        }
      });
      document.getElementById("show-modal").hidden = false;
      document.body.style.overflow = "hidden";
    });
  }

  function closeShowModal() {
    document.getElementById("show-modal").hidden = true;
    document.body.style.overflow = "";
  }

  function openShowModal(id) {
    const s = numbered.find((x) => x.id === id);
    if (!s) return;
    const future = s.date >= today;
    const v = s.venue ? venueByName.get(s.venue) : null;
    const lineup = site.members
      .map((m) => {
        const here = D.attended(s, m.name);
        return '<span class="dot' + (here ? "" : " absent") + '" title="' +
          esc(m.name + (here ? "" : "（缺席）")) + '">' + m.emoji + "</span>";
      })
      .join("");
    let setlistHtml = "";
    if ((s.setlist || []).length) {
      setlistHtml =
        '<div class="sd-label">Setlist</div><ol class="sd-setlist">' +
        D.setlistLabels(s.setlist, songById)
          .map((it) =>
            '<li><span class="sl-no">' + it.label + "</span>" +
            esc(it.song ? it.song.title : "?") + "</li>")
          .join("") +
        "</ol>";
    }
    document.getElementById("show-modal-body").innerHTML =
      '<div class="sd-badge' + (future ? " future" : "") + '">' +
      (future ? "待演" : "第" + s.n + "场") +
      (s.special ? ' <span class="tag">特别场</span>' : "") + "</div>" +
      '<div class="sd-date">' + fmtDate(s.date) + " " + weekday(s.date) +
      (s.time ? " · " + esc(s.time) : "") + "</div>" +
      (s.venue
        ? '<div class="sd-venue">📍 ' + esc(s.venue) +
          (v && v.address ? '<span class="sd-address">' + glueTail(v.address) + "</span>" : "") + "</div>"
        : "") +
      (s.note ? '<div class="sd-note">' + esc(s.note) + "</div>" : "") +
      '<div class="sd-label">出席</div><div class="sd-lineup">' + lineup + "</div>" +
      setlistHtml;
    document.getElementById("show-modal").hidden = false;
    document.body.style.overflow = "hidden";
  }

  // ---------- 演出档案 ----------
  function renderShows() {
    const list = numbered
      .slice()
      .reverse()
      .filter((s) => !curFilter || D.attended(s, curFilter));
    document.getElementById("show-count").textContent =
      curFilter ? curFilter + " 出席 " + list.filter((s) => s.date < today).length + " 场"
                : "共 " + numbered.length + " 场";
    const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    if (curPage > pages) curPage = pages;
    const slice = list.slice((curPage - 1) * PER_PAGE, curPage * PER_PAGE);
    renderPager(pages);
    document.getElementById("shows").innerHTML = slice
      .map((s) => {
        const future = s.date >= today;
        const hasSetlist = (s.setlist || []).length > 0;
        const lineup = site.members
          .map((m) => {
            const here = D.attended(s, m.name);
            return '<span class="dot' + (here ? "" : " absent") + '" title="' +
              esc(m.name + (here ? "" : "（缺席）")) + '">' + m.emoji + "</span>";
          })
          .join("");
        let html =
          '<div class="show-row' + (future ? " future" : "") + (s.special ? " special" : "") +
          (hasSetlist ? " has-setlist" : "") + '" data-id="' + s.id + '">' +
          '<div class="show-n">' + (future ? "待演" : "第" + s.n + "场") + "</div>" +
          '<div class="show-date">' + fmtDate(s.date) + " " + weekday(s.date) +
          (s.time ? " " + esc(s.time) : "") + "</div>" +
          '<div class="show-note"' + (s.note ? ' title="' + esc(s.note) + '"' : "") + ">" +
          (s.special ? '<span class="tag">特别场</span>' : "") +
          (s.venue ? '<span class="show-venue">📍' + esc(s.venue) + "</span>" : "") +
          esc(s.note || "") +
          "</div>" +
          (hasSetlist ? '<span class="setlist-badge">♪ 歌单</span>' : "") +
          '<div class="show-lineup">' + lineup + "</div>" +
          "</div>";
        if (hasSetlist && expandedShowId === s.id) {
          const items = D.setlistLabels(s.setlist, songById)
            .map((it) =>
              '<div class="sl-item"><span class="sl-label">' + it.label + "</span>" +
              '<span class="sl-title">' + esc(it.song ? it.song.title : "?") + "</span>" +
              (it.song && it.song.artist
                ? '<span class="sl-artist">' + esc(it.song.artist) + "</span>" : "") +
              "</div>")
            .join("");
          html += '<div class="setlist-panel">' + items + "</div>";
        }
        return html;
      })
      .join("");
  }

  let expandedShowId = null;
  function bindSetlistToggle() {
    document.getElementById("shows").addEventListener("click", (e) => {
      const row = e.target.closest(".show-row.has-setlist");
      if (!row) return;
      const id = Number(row.dataset.id);
      expandedShowId = expandedShowId === id ? null : id;
      renderShows();
    });
  }

  // ---------- 歌曲 ----------
  function renderSongs() {
    const box = document.getElementById("songs");
    document.getElementById("song-count").textContent = "共 " + songs.length + " 首";
    box.innerHTML = songs
      .map((song, i) => {
        const st = D.songStats(song.id, past);
        const right = st.count
          ? "披露 " + st.count + " 回 · 最近 " + fmtDate(st.lastDate)
          : esc(song.note || "");
        return (
          '<div class="song-row">' +
          '<span class="song-idx">' + String(i + 1).padStart(2, "0") + "</span>" +
          '<div class="song-main">' +
          '<div class="song-title">' + esc(song.title) + "</div>" +
          (song.artist ? '<div class="song-artist">原唱：' + esc(song.artist) + "</div>" : "") +
          "</div>" +
          '<div class="song-stats">' + right + "</div>" +
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
      curFilter = btn.dataset.name || null;
      curPage = 1;
      renderArchive();
    });
  }

  function renderPager(pages) {
    const box = document.getElementById("pager");
    if (pages <= 1) {
      box.innerHTML = "";
      return;
    }
    let html = '<button class="page-btn" data-page="' + (curPage - 1) + '"' +
      (curPage === 1 ? " disabled" : "") + ">‹</button>";
    for (let p = 1; p <= pages; p++) {
      html += '<button class="page-btn' + (p === curPage ? " on" : "") +
        '" data-page="' + p + '">' + p + "</button>";
    }
    html += '<button class="page-btn" data-page="' + (curPage + 1) + '"' +
      (curPage === pages ? " disabled" : "") + ">›</button>";
    box.innerHTML = html;
    box.querySelectorAll(".page-btn").forEach((b) =>
      b.addEventListener("click", () => {
        curPage = Number(b.dataset.page);
        renderShows();
        // 翻页后把列表顶部滚回视口,避免停在半空
        document.getElementById("filters").scrollIntoView({ behavior: "smooth", block: "start" });
      })
    );
  }

  // ---------- 影像(封面卡片) ----------
  function renderVideos() {
    const box = document.getElementById("videos");
    if (!videos.length) {
      box.closest("section").hidden = true;
      return;
    }
    box.innerHTML = videos
      .map(
        (v) =>
          '<a class="video-card" href="' + esc(v.url) + '" target="_blank" rel="noopener">' +
          '<span class="video-thumb">' +
          (v.cover
            ? '<img src="' + esc(v.cover) + '" alt="" loading="lazy">'
            : '<span class="video-thumb-ph">✨</span>') +
          '<span class="video-play"></span>' +
          "</span>" +
          '<span class="video-meta">' +
          '<span class="video-title">' + esc(v.title) + "</span>" +
          '<span class="video-sub">' +
          (v.date ? fmtDate(v.date) + " · " : "") +
          (v.url.includes("douyin")
            ? '<img class="wb-icon" src="assets/douyin.png" alt="">抖音'
            : '<img class="wb-icon" src="assets/weibo.png" alt="">微博') + "</span>" +
          "</span></a>"
      )
      .join("");
    initVideoNav(box);
  }

  // 影像超过一屏(3 张)时启用左右箭头,按一张卡的宽度滚动
  function initVideoNav(box) {
    const prev = document.getElementById("vid-prev");
    const next = document.getElementById("vid-next");
    if (!prev || !next) return;
    const many = videos.length > 3;
    prev.hidden = next.hidden = !many;
    if (!many) return;
    const step = () => (box.querySelector(".video-card").offsetWidth + 16);
    prev.addEventListener("click", () => box.scrollBy({ left: -step(), behavior: "smooth" }));
    next.addEventListener("click", () => box.scrollBy({ left: step(), behavior: "smooth" }));
    const sync = () => {
      prev.classList.toggle("off", box.scrollLeft <= 2);
      next.classList.toggle("off", box.scrollLeft >= box.scrollWidth - box.clientWidth - 2);
    };
    box.addEventListener("scroll", sync, { passive: true });
    sync();
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
  // 地址末尾的短尾巴(如「2F」)连同前一个词整体不换行,避免孤字/孤词独占一行。
  // 返回 HTML(内部已转义),调用处直接拼进 innerHTML
  function glueTail(s) {
    const tokens = String(s).split(" ");
    if (tokens.length > 1 && [...tokens[tokens.length - 1]].length <= 3) {
      const tail = tokens.splice(-2).join(" ");
      return tokens.map(esc).join(" ") + (tokens.length ? " " : "") +
        '<span class="nbk">' + esc(tail) + "</span>";
    }
    return esc(s);
  }
})();
