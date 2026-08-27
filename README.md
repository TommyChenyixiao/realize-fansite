# realize-fansite

RealizE(上海地下偶像团体,七韵文化旗下)的非官方粉丝应援站。
纯静态 HTML/CSS/vanilla JS,无构建步骤、无第三方库。

> 给 AI/新会话的工作约定见 `.claude/skills/realize-fansite/SKILL.md`,
> 视觉规范见 `STYLE.md`,路线图见 `PLAN.md`。

## 打开方法

页面通过 fetch 加载数据 JSON,需要通过 http 打开(不能直接双击 index.html):

```bash
cd realize-fansite
python3 serve.py
```

然后打开 <http://localhost:8123>。serve.py 除了静态托管还提供编辑页的保存接口;
只看不编辑的话 `python3 -m http.server 8123` 也行。

## 页面内容

- **全屏 Hero**:公式照打底 + 官方 logo + 下滑提示,滚下去是团介绍、
  下一场演出倒计时(含场地地址)、统计、官方/经纪人/微博群链接
- **情报 NEWS**:分类彩色标签(公演/物贩/生诞祭/其他),支持置顶
- **成员**:五张成员卡(顺序:阿鱼→小圆→小噜→冰冰→芋圆,与公式照对位),
  点开弹窗有担当宣言、生日/MBTI/代表物/初舞台/出席、微博置顶简介、社交链接,
  弹窗左右可切换上一位/下一位
- **演出档案**:日历视图(默认,含演出与成员生日 chip)/ 列表视图(分页,
  自动编号"第N场",特别场高亮,可按成员筛选,出席成员 emoji 显示)
- **歌曲**:歌单(标原唱)+ setlist 按 SE/M1/M2 惯例编号 + 披露回数
- **影像**:封面卡片(播放浮层),点击跳外链
- **大事纪**:events + 有备注/特别场的演出合并成时间线
- **维护兜底**:任一数据加载失败整页显示维护提示;URL 加 `?maintenance` 可预览
- "今天"统一按**北京时间**(UTC+8)计算

## 数据:公共 / 个人 严格隔离

本仓库只存**公共记录**,是对外的权威数据源;个人记录(初见/初切/チェキ/成员小记)
只存在于各自的 star-tracker 本地,永远不进这个仓库。部署后 star-tracker
可 fetch 本站 JSON 并按 id 合并(订阅方向:网站 → star-tracker)。

| 文件 | 内容 |
|---|---|
| `data/site.json` | 团体资料 + 成员资料(应援色/生日/担当宣言/简介/社交链接) |
| `data/shows.json` | 演出记录(日期/时间/场地/备注/特别场/缺席/setlist) |
| `data/news.json` | 情报(日期/分类/标题/正文/链接/置顶) |
| `data/songs.json` | 歌曲库(曲名/原唱/备注/call) |
| `data/videos.json` | 影像(标题/日期/链接/封面) |
| `data/venues.json` | 场地库(名称/地址),演出按场地名关联 |
| `data/events.json` | 大事纪(日期/标题/备注/关联成员) |

## 编辑数据(edit.html)

<http://localhost:8123/edit.html>(首页页脚也有入口)。所有数据都在这里改,
不手改文件:

- 表格直接改字段,顶部表单添加,行尾 🗑 删除
- **所有改动先进「待保存改动」面板**,逐条列出、精确到字段,确认后才写文件;
  可整体放弃,也可单条撤销
- **输入校验**:生日(月-日)、颜色(#rrggbb)、链接(http 开头)格式不对红字拦截
- **并发保护**:保存时核对文件哈希,被别处改过则拒绝覆盖(409)
- **改名级联**:成员/团体/场地改名自动同步所有引用
- 保存走 serve.py 的 `POST /api/save`(只监听本机 + 文件白名单);
  线上没有这个接口,编辑页在线上天然只读

## 开发约定

- **功能改动**:开新 branch → 本地测好 → 提 PR;**纯数据更新**(master):
  `./tools/publish.sh "说明"` 一键提交推送
- 新增一类内容 = 新 JSON + app.js 渲染模块 + edit 页支持 + serve.py 白名单,四件套
- 测试:`node --test test/*.test.js`(derive.js 与 edit-diff.js 的纯函数)
- 仓库:TommyChenyixiao/realize-fansite(私有,之后转 public + GitHub Pages)
