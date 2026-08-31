// 纯数据推导，不碰 DOM。浏览器里挂到 window.derive，Node 测试里走 module.exports。
(function (global) {
  "use strict";

  function sortByDate(items) {
    return items
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  // 给全部演出按日期顺序编号（含未来场次）——"第N场"
  function withNumbers(shows) {
    return sortByDate(shows).map((s, i) => Object.assign({}, s, { n: i + 1 }));
  }

  // 已演 = 日期在今天之前；今天及以后算"接下来"
  function splitByToday(numbered, today) {
    return {
      past: numbered.filter((s) => s.date < today),
      upcoming: numbered.filter((s) => s.date >= today),
    };
  }

  function attended(show, name) {
    return !(show.absent || []).includes(name);
  }

  // 成员出席统计：只数已演场次
  function memberStats(name, past) {
    const shows = past.filter((s) => attended(s, name));
    return {
      count: shows.length,
      total: past.length,
      firstDate: shows.length ? shows[0].date : null,
    };
  }

  // 下一个场次里程碑；已排期的话带上具体日期
  function nextMilestone(pastCount, milestones, numbered) {
    const target = milestones.find((m) => m > pastCount);
    if (!target) return null;
    const scheduled = numbered.find((s) => s.n === target);
    return {
      target,
      remaining: target - pastCount,
      date: scheduled ? scheduled.date : null,
    };
  }

  // 大事纪 + 有备注/特别场的演出，合并成一条时间线(新事在前,倒序)
  function buildTimeline(events, numbered) {
    const items = events
      .map((e) => ({ date: e.date, title: e.title, note: e.note, type: "event" }))
      .concat(
        numbered
          .filter((s) => s.note || s.special)
          .map((s) => ({
            date: s.date,
            title: s.note || "特别公演",
            note: "第" + s.n + "场" + (s.special ? " · 特别场" : ""),
            type: "show",
          }))
      );
    return sortByDate(items).reverse();
  }

  // 月历网格：返回补齐首尾周的扁平格子数组（周日开头），每格 {ymd, day, inMonth}
  function monthGrid(year, month) {
    const pad = (n) => String(n).padStart(2, "0");
    const startDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const total = Math.ceil((startDow + daysInMonth) / 7) * 7;
    const cells = [];
    for (let i = 0; i < total; i++) {
      const d = new Date(Date.UTC(year, month - 1, i - startDow + 1));
      cells.push({
        ymd: d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()),
        day: d.getUTCDate(),
        inMonth: i - startDow + 1 >= 1 && i - startDow + 1 <= daysInMonth,
      });
    }
    return cells;
  }

  // 每首歌的披露统计：次数 + 最近披露日期（只数已演场次）
  function songStats(songId, pastShows) {
    const dates = pastShows
      .filter((s) => (s.setlist || []).includes(songId))
      .map((s) => s.date)
      .sort();
    return { count: dates.length, lastDate: dates.length ? dates[dates.length - 1] : null };
  }

  // setlist 编号：SE 曲标 "SE"，其余按出场顺序 M1、M2……（日系惯例）
  function setlistLabels(setlist, songsById) {
    let m = 0;
    return setlist.map((id) => {
      const song = songsById.get(id);
      const isSE = song && /SE/.test(song.title);
      return { id, label: isSE ? "SE" : "M" + ++m, song };
    });
  }

  // "今天"固定按北京时间（UTC+8，无夏令时）计算，与访问者所在时区无关
  function beijingToday(nowMs) {
    const d = new Date((nowMs == null ? Date.now() : nowMs) + 8 * 3600 * 1000);
    const pad = (n) => String(n).padStart(2, "0");
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
  }

  function daysBetween(from, to) {
    const ms = Date.UTC(...splitYmd(to)) - Date.UTC(...splitYmd(from));
    return Math.round(ms / 86400000);
  }

  function splitYmd(ymd) {
    const [y, m, d] = ymd.split("-").map(Number);
    return [y, m - 1, d];
  }

  // ymd 是 anchor 的几周年?同月同日且年份更晚返回年数,否则 0
  function yearsSince(anchor, ymd) {
    if (ymd.slice(5) !== anchor.slice(5)) return 0;
    const y = Number(ymd.slice(0, 4)) - Number(anchor.slice(0, 4));
    return y > 0 ? y : 0;
  }

  // 出道里程碑(日历角标用):出道当天算第 1 天。
  // 周年(同月同日、年份晚于出道年)优先,其次整百天(第 100/200/300… 天);其余返回 null
  function debutMilestone(debutDate, ymd) {
    const y = yearsSince(debutDate, ymd);
    if (y) return "出道" + y + "周年";
    const n = daysBetween(debutDate, ymd) + 1;
    if (n > 0 && n % 100 === 0) return "出道" + n + "天";
    return null;
  }

  const derive = {
    sortByDate,
    withNumbers,
    splitByToday,
    attended,
    memberStats,
    nextMilestone,
    buildTimeline,
    daysBetween,
    yearsSince,
    debutMilestone,
    beijingToday,
    songStats,
    setlistLabels,
    monthGrid,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = derive;
  else global.derive = derive;
})(this);
