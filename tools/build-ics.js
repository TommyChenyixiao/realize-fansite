// 从 data/shows.json + venues.json 生成 shows.ics(日历订阅源)。
// 输出是确定性的(无时间戳随机量),test/ics.test.js 靠这一点校验
// 仓库里提交的 shows.ics 是否和数据同步;publish.sh 在每次发布前自动重跑本脚本。
// 用法:node tools/build-ics.js
"use strict";

const fs = require("fs");
const path = require("path");
const derive = require("../js/derive.js");

const ROOT = path.join(__dirname, "..");
const SITE_URL = "https://realizefansite.com";

// RFC5545 文本转义:反斜杠、分号、逗号、换行
function icsEscape(s) {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// RFC5545 行折叠:超过 74 字节的行折行,续行以空格开头(按字节数,避免拆散 UTF-8 多字节字符)
function foldLine(line) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 74) return line;
  const out = [];
  let start = 0;
  while (start < bytes.length) {
    let end = Math.min(start + 74, bytes.length);
    // 不要在 UTF-8 多字节字符中间断开(续字节形如 10xxxxxx)
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    out.push(bytes.slice(start, end).toString("utf8"));
    start = end;
  }
  return out.join("\r\n ");
}

function nextDay(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return t.toISOString().slice(0, 10);
}

function buildIcs(shows, venues) {
  const venueByName = new Map(venues.map((v) => [v.name, v]));
  const numbered = derive.withNumbers(shows);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//realize-fansite//shows//CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:RealizE 演出日程",
    "X-WR-CALDESC:RealizE 粉丝应援站整理的演出日程,以官方微博为准。" + SITE_URL,
    "X-WR-TIMEZONE:Asia/Shanghai",
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "X-PUBLISHED-TTL:PT12H",
  ];
  for (const s of numbered) {
    const v = s.venue ? venueByName.get(s.venue) : null;
    const date = s.date.replace(/-/g, "");
    const summary = "RealizE @ " + (s.venue || "待定") + (s.special ? " ★" : "");
    const descParts = ["第" + s.n + "场"];
    if (s.note) descParts.push(s.note);
    if (s.absent && s.absent.length) descParts.push("缺席:" + s.absent.join("·"));
    descParts.push("演出时间以官方微博为准 " + SITE_URL);
    lines.push(
      "BEGIN:VEVENT",
      "UID:show-" + s.id + "@realizefansite.com",
      // DTSTAMP 必填;取演出日零点(UTC),保证输出可复现
      "DTSTAMP:" + date + "T000000Z",
      "DTSTART;VALUE=DATE:" + date,
      "DTEND;VALUE=DATE:" + nextDay(s.date).replace(/-/g, ""),
      "SUMMARY:" + icsEscape(summary),
      "LOCATION:" + icsEscape((s.venue || "") + (v && v.address ? " " + v.address : "")),
      "DESCRIPTION:" + icsEscape(descParts.join("\n")),
      "URL:" + SITE_URL,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

function build() {
  const shows = JSON.parse(fs.readFileSync(path.join(ROOT, "data/shows.json"), "utf8"));
  const venues = JSON.parse(fs.readFileSync(path.join(ROOT, "data/venues.json"), "utf8"));
  return buildIcs(shows, venues);
}

if (require.main === module) {
  const ics = build();
  fs.writeFileSync(path.join(ROOT, "shows.ics"), ics);
  console.log("shows.ics 已生成(" + (ics.split("BEGIN:VEVENT").length - 1) + " 场)");
}

module.exports = { buildIcs, build };
