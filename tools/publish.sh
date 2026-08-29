#!/bin/bash
# 发布改动:开分支 → 提交 → 推送 → 自动创建 PR。
# master 受保护不可直推,一切上线变更都走 PR,由站长在 GitHub 点 Merge 后自动部署。
# 用法:./tools/publish.sh [提交说明]   (不写说明就用默认的"更新数据")
set -e
cd "$(dirname "$0")/.."

if git diff --quiet && git diff --cached --quiet && [ -z "$(git status --porcelain)" ]; then
  echo "没有改动,无需发布。"
  exit 0
fi

msg="${1:-更新数据 $(date +%Y-%m-%d)}"
branch="data/$(date +%Y%m%d-%H%M%S)"

# 演出数据变了就同步重建日历订阅文件(shows.ics),测试会校验两者一致
node tools/build-ics.js

git checkout -b "$branch"
git add -A
git commit -m "$msg"
git push -u origin "$branch"
url=$(gh pr create --base master --head "$branch" --title "$msg" \
  --body "数据更新(edit.html 产出)。合并后 GitHub Pages 自动上线。")
git checkout master
echo "✓ PR 已创建:$url"
echo "  去 GitHub 点 Merge 即上线(手机也可以操作)"
