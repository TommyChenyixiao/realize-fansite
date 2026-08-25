#!/bin/bash
# 一条命令发布:提交所有改动并推送到 GitHub。
# 用法:./tools/publish.sh [提交说明]   (不写说明就用默认的"更新数据")
set -e
cd "$(dirname "$0")/.."

if git diff --quiet && git diff --cached --quiet && [ -z "$(git status --porcelain)" ]; then
  echo "没有改动,无需发布。"
  exit 0
fi

msg="${1:-更新数据 $(date +%Y-%m-%d)}"
git add -A
git commit -m "$msg"
git push
echo "✓ 已推送到 GitHub"
