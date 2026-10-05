#!/bin/bash
# 积木剧场回归测试批跑：逐个运行内置测试钩子并汇总结果
# 用法：tools/test-regress.sh [测试名...]（默认跑常用回归集；日志与截图在 /tmp/jimuchang-regress/）
# 可用测试名见下方 TESTS 表；新增测试钩子时同步登记。
set -u
cd "$(dirname "$0")/.." || exit 1
BIN=./build/jimuchang
OUT=/tmp/jimuchang-regress
mkdir -p "$OUT" /tmp/opencode

declare -A TESTS=(
  [canvaszoom]="--test-canvaszoom"
  [playview]="--test-playview"
  [layout]="--test-layout"
  [elbar]="--test-elbar"
  [record]="--test-record"
  [hotkeys]="--test-hotkeys"
  [play]="--test-play"
  [save2]="--test-save2"
  [fx]="--test-fx"
  [uiscale]="--test-uiscale"
  [ctabs]="--test-ctabs"
  [templates]="--test-templates"
  [ppt]="--test-ppt"
  [pack]="--test-pack"
)
ORDER=(canvaszoom playview layout elbar record hotkeys play save2 fx uiscale ctabs templates)
if [ "$#" -gt 0 ]; then ORDER=("$@"); fi

fail=0
for name in "${ORDER[@]}"; do
  arg="${TESTS[$name]:-}"
  if [ -z "$arg" ]; then echo "[$name] 未知测试（可选：${!TESTS[*]}）"; fail=1; continue; fi
  logfile="$OUT/$name.log"
  P0_SHOT="$OUT/$name.png" timeout 45 "$BIN" "$arg" --no-api >"$logfile" 2>&1
  code=$?
  passes=$(grep -c '|PASS' "$logfile")
  fails=$(grep -c '|FAIL' "$logfile")
  errs=$(grep -c '|error|' "$logfile")
  echo "[$name] exit=$code PASS=$passes FAIL=$fails error=$errs  ($logfile)"
  if [ "$fails" -gt 0 ] || [ "$errs" -gt 0 ]; then
    grep -E '\|FAIL|\|error' "$logfile" | sed 's/^/    /'
    fail=1
  fi
done
if [ "$fail" -eq 0 ]; then echo "ALL PASS"; else echo "SOME FAILED"; fi
exit $fail
