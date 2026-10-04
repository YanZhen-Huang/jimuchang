#!/usr/bin/env bash
# 交叉编译积木剧场便携放映器（Windows 独立窗口版）
# 依赖：g++-mingw-w64-x86-64-posix + libwebview.a（见下方准备步骤）
set -e
cd "$(dirname "$0")/.."

WVS="${WEBVIEW_SRC:-/tmp/webview-src}"
WVB="${WEBVIEW_BUILD:-/tmp/wv-build}"

if [ ! -f "$WVB/core/libwebview.a" ]; then
  echo "准备 webview 静态库…"
  [ -d "$WVS" ] || git clone --depth 1 https://ghfast.top/https://github.com/webview/webview "$WVS"
  cmake -B "$WVB" -S "$WVS" \
    -D CMAKE_TOOLCHAIN_FILE="$WVS/cmake/toolchains/x86_64-w64-mingw32.cmake" \
    -D WEBVIEW_TOOLCHAIN_EXECUTABLE_SUFFIX=-posix \
    -D WEBVIEW_BUILD_EXAMPLES=OFF -D WEBVIEW_BUILD_TESTS=OFF \
    -D CMAKE_BUILD_TYPE=Release
  cmake --build "$WVB" -j4
fi

WV2INC=$(find "$WVB/_deps" -name "WebView2.h" -printf '%h\n' | head -1)
[ -n "$WV2INC" ] || { echo "缺少 WebView2 SDK 头"; exit 1; }

x86_64-w64-mingw32-g++-posix -std=c++17 -O2 -s -mwindows \
  -I"$WVS/core/include" -I"$WV2INC" \
  tools/jimu_shell_webview.cc \
  "$WVB/core/libwebview.a" \
  -ladvapi32 -lole32 -loleaut32 -luuid -lshell32 -lshlwapi -luser32 -lversion -lcomctl32 -lgdi32 -lwinhttp -lws2_32 \
  -static-libgcc -static-libstdc++ -static \
  -o web/assets/jimu_shell.exe

ls -la web/assets/jimu_shell.exe | awk '{print "OK:", $5, "bytes"}'

# Linux 提取逻辑测试
g++ -std=c++17 -O2 tools/jimu_shell_webview.cc -o /tmp/jimu_shell_test
echo "Linux 测试版: /tmp/jimu_shell_test（JIMU_SELF=<bundle> 运行）"
