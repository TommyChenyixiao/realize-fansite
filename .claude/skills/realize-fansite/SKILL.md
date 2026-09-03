---
name: realize-fansite
description: RealizE 粉丝应援站项目的工作约定——数据架构、视觉铁律、开发流程。在 realize-fansite 仓库里做任何开发前先读这个。
---

# RealizE 粉丝站 · 工作约定

RealizE 是上海地下偶像团体(七韵文化/七韵IdolProductions 旗下,经纪人小飞Tobi)。
本仓库是站长(用户)维护的非官方粉丝站,纯静态 HTML/CSS/vanilla JS,无构建、无第三方库。

## 铁律(违反过、被用户纠正过的)

1. **公共/个人数据严格隔离**:本仓库只存公共记录,是对外权威数据源。
   个人记录(初见/初切/チェキ/成员小记)只存在于用户本地的 star-tracker
   (~/Desktop/star-tracker,用户和其他粉丝各自使用),**永远不进本仓库**。
   部署后 star-tracker 反过来订阅本站的 JSON。
2. **所有数据必须能通过 edit.html 编辑**。新增一类内容 = 「新 JSON + app.js 渲染模块 +
   edit.html/edit.js 编辑支持 + serve.py 白名单」四件事一起做,缺一不可。
   编辑改动先进「待保存改动」预览面板,确认后才写文件。
3. **视觉**:结构参考日本地偶官网(miteititle.com、peel-the-apple.com 等),
   但永远保持 RealizE 官方梦幻淡紫色系。详见 docs/STYLE.md。
4. **字体**:中文一律干净的系统黑体,**绝不用**圆体/手写体等花哨中文字体;
   拉丁字母/数字/日期用 Comfortaa;手写体只用于 logo/标题。(docs/STYLE.md 有完整规范)
5. **微博图标用官方红色 logo**,不改色。B 站用小电视图标。
6. **时间一律北京时间**(UTC+8),用 derive.beijingToday(),不用本地时区。
7. **票务/价格信息不做**(用户明确说过先不做)。
8. **开发流程(2026-08-27 起收紧)**:**任何**改动——代码、数据、文案——一律
   开分支 → 本地验证 → 提 PR,由站长在 GitHub 上审批合并后自动上线。
   **AI 永远不做的事**:`git push` 到 master、`git push -f`、`gh pr merge`/approve、
   改仓库设置(可见性/Pages/权限)。一切上线动作只到"提 PR"为止,合并权只在站长手里。
   master 有 Ruleset 保护(必须走 PR + 禁 force push)。publish.sh 也已改为自动开分支提 PR。
   **每个 PR 描述必附双端预览链接**(raw.githack.com/TommyChenyixiao/realize-fansite/<分支>/index.html
   与 …/tools/mobile-preview.html),让站长合并前可直接点开看效果。
   **每一步 UI 改动必须双端校验后才 commit**:桌面(localhost:8123)+ 手机
   (tools/mobile-preview.html,390×844 iframe)都截图确认,再跑单测。缺一端不算完成。
9. 成员卡顺序:阿鱼 → 小圆 → 小噜 → 冰冰 → 芋圆(与团体公式照对位,别动)。
10. setlist 用日本地偶惯例 SE/M1/M2 编号(derive.setlistLabels);歌曲标「原唱」不是「原曲」。
11. **公演情报正文用统一字段模板**(站长要求格式不许不一),按序以「;」分隔,无则省略:
    `(主办:…;)出席:成员·间隔号;开场 xx:xx / 开演 xx:xx;(地点:…;)特典:…;(注意:…。)`
    标题格式「M/D 场地/活动名,亮点!」;演出预告 until 设演出当天;票价/票务永不写。
    里程碑/物贩等其他分类用叙述句,不套此模板。

## 关键事实

- GitHub:TommyChenyixiao/realize-fansite(目前 private,之后转 public + Pages)。
- 成员应援色:阿鱼 #dfe3ea 🤍 / 小圆 #a06ee1 💜 / 小噜 #6ec6e6 🩵 /
  冰冰 #ffd44d 💛 / 芋圆 #ff7ab8 💖。
- CSS 有全局 `[hidden]{display:none!important}`——因为多处用 display:flex/grid
  会覆盖 hidden 属性,新样式别再踩这个坑。
- 测试:`node --test test/*.test.js`,改 derive.js / edit-diff.js 必须跑。
- 本地开发:`python3 serve.py` → http://localhost:8123(编辑页 /edit.html)。
- 路线图在 docs/PLAN.md(2.0/3.0 明细),视觉规范在 docs/STYLE.md,项目说明在 README.md。
- 信息来源:官方微博 @RealizE_Project、五位成员微博置顶、chinaidols fandom wiki。
  更新成员资料时优先扫她们的微博置顶。

## 和用户协作的方式

- 用户是站长,内容(文案/图片/情报)由用户确认后才算数;拿不准的文案先给预览再定稿。
- 用户对视觉细节敏感(强迫症式检查):改完 UI 要自己在浏览器里逐区块截图自查
  (布局对齐、弹窗行数一致、图标颜色)再交付。
- 讨论型消息(“我们讨论一下”)先给方案不动手;指令型消息直接做。
