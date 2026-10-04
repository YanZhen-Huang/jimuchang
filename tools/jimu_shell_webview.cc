// jimu_shell_webview.cc —— 积木剧场便携放映器（独立窗口版）
// 结构：[外壳 exe][HTML][8字节 HTML 起始偏移(小端)]
// 双击 → 读自身 payload → 写临时 HTML → WebView2 全屏独立窗口播放 → 退出清理
// 依赖：系统 Microsoft Edge WebView2 运行时（Windows 10/11 通常自带）
// 交叉编译：bash tools/build_shell.sh
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>

#ifdef _WIN32
#include "webview/webview.h"
#include <windows.h>

// 读取自身尾部内嵌的 HTML
static bool readSelfHtml(std::string &html) {
    char path[32768];
    if (!GetModuleFileNameA(NULL, path, sizeof(path))) return false;
    FILE *f = fopen(path, "rb");
    if (!f) return false;
    fseek(f, 0, SEEK_END);
    long long size = ftell(f);
    if (size < 9) { fclose(f); return false; }
    unsigned long long off = 0;
    fseek(f, (long)(size - 8), SEEK_SET);
    if (fread(&off, 8, 1, f) != 1 || off < 1 || off >= (unsigned long long)(size - 8)) {
        fclose(f);
        return false;
    }
    long long len = size - 8 - (long long)off;
    fseek(f, (long)off, SEEK_SET);
    html.resize((size_t)len);
    size_t rd = fread(&html[0], 1, (size_t)len, f);
    fclose(f);
    html.resize(rd);
    return rd > 0;
}

int WINAPI WinMain(HINSTANCE, HINSTANCE, LPSTR, int) {
    std::string html;
    if (!readSelfHtml(html)) {
        MessageBoxA(NULL, "放映数据缺失（文件不完整）", "积木剧场", MB_ICONERROR);
        return 1;
    }

    // 写临时 HTML（宽字符路径，兼容中文用户名）
    wchar_t tmpW[32768];
    if (!GetTempPathW(32768, tmpW)) return 1;
    std::wstring dirW = std::wstring(tmpW) + L"jimuchang_player";
    CreateDirectoryW(dirW.c_str(), NULL);
    std::wstring htmlW = dirW + L"\\player.html";
    FILE *o = _wfopen(htmlW.c_str(), L"wb");
    if (!o) {
        MessageBoxA(NULL, "无法写入临时文件", "积木剧场", MB_ICONERROR);
        return 1;
    }
    fwrite(html.data(), 1, html.size(), o);
    fclose(o);

    // file:/// URL（宽字符 → UTF-8 交给 webview）
    std::wstring urlW = L"file:///";
    for (wchar_t c : htmlW) urlW += (c == L'\\') ? L'/' : c;
    int n = WideCharToMultiByte(CP_UTF8, 0, urlW.c_str(), -1, NULL, 0, NULL, NULL);
    std::string url(n > 0 ? (size_t)(n - 1) : 0, '\0');
    if (n > 0) WideCharToMultiByte(CP_UTF8, 0, urlW.c_str(), -1, &url[0], n, NULL, NULL);

    int rc = 0;
    try {
        webview::webview w(false, nullptr);
        w.set_title("积木剧场");
        w.set_size(1280, 720, WEBVIEW_HINT_NONE);
        w.navigate(url);
        // 最大化（独立程序窗口；播放器内双击可进 HTML 真全屏）
        auto wres = w.widget();
        if (wres.ok()) {
            HWND hwnd = static_cast<HWND>(wres.value());
            if (hwnd) ShowWindow(hwnd, SW_SHOWMAXIMIZED);
        }
        w.run();
    } catch (const webview::exception &e) {
        std::string msg = std::string("无法启动播放窗口：") + e.what() +
            "\n\n提示：本程序需要系统组件「Microsoft Edge WebView2 运行时」\n"
            "（Windows 10/11 通常自带；如缺失可到微软官网免费安装）。";
        MessageBoxA(NULL, msg.c_str(), "积木剧场", MB_ICONERROR);
        rc = 1;
    }
    DeleteFileW(htmlW.c_str());
    return rc;
}

#else /* Linux 提取逻辑测试：JIMU_SELF=<bundle> ./shell_test */

int main(void) {
    const char *path = getenv("JIMU_SELF");
    if (!path) { fprintf(stderr, "set JIMU_SELF\n"); return 2; }
    FILE *f = fopen(path, "rb");
    if (!f) { perror("open"); return 1; }
    fseeko(f, 0, SEEK_END);
    off_t size = ftello(f);
    if (size < 9) return 1;
    unsigned long long off = 0;
    fseeko(f, size - 8, SEEK_SET);
    if (fread(&off, 8, 1, f) != 1 || off < 1 || off >= (unsigned long long)(size - 8)) {
        fprintf(stderr, "bad offset\n");
        return 1;
    }
    long long len = (long long)size - 8 - (long long)off;
    fseeko(f, (long long)off, SEEK_SET);
    std::string html((size_t)len, '\0');
    size_t rd = fread(&html[0], 1, (size_t)len, f);
    fclose(f);
    html.resize(rd);
    FILE *o = fopen("/tmp/jimu_shell_extract.html", "wb");
    fwrite(html.data(), 1, html.size(), o);
    fclose(o);
    printf("PAYLOAD_OK %zu bytes head=%.20s\n", html.size(), html.c_str());
    return 0;
}
#endif
