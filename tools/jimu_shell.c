// jimu_shell.c —— 积木剧场便携放映器（Windows）
// 结构：[外壳 exe 本体] + [HTML 数据] + [8字节 HTML 起始偏移(小端)]
// 双击：读文件尾 8 字节定位 HTML → 提取到临时目录 → 优先 Edge/Chrome 全屏(kiosk) → 否则默认浏览器
// 交叉编译：x86_64-w64-mingw32-gcc -O2 -s -mwindows jimu_shell.c -o jimu_shell.exe
// Linux 逻辑测试：gcc -DLINUX_TEST jimu_shell.c -o /tmp/shell_test && /tmp/shell_test <bundle>

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define CHUNK (256 * 1024)

#ifdef _WIN32
#include <windows.h>

int WINAPI WinMain(HINSTANCE hInst, HINSTANCE hPrev, LPSTR cmd, int show) {
    (void)hInst; (void)hPrev; (void)cmd; (void)show;

    wchar_t exePathW[32768];
    if (!GetModuleFileNameW(NULL, exePathW, 32768)) return 1;

    FILE *f = _wfopen(exePathW, L"rb");
    if (!f) return 1;
    _fseeki64(f, 0, SEEK_END);
    long long size = _ftelli64(f);
    if (size < 9) { fclose(f); return 1; }

    unsigned long long off = 0;
    _fseeki64(f, size - 8, SEEK_SET);
    if (fread(&off, 8, 1, f) != 1 || off < 1 || off >= (unsigned long long)(size - 8)) {
        fclose(f);
        MessageBoxW(NULL, L"放映数据缺失（文件不完整）", L"积木剧场", MB_ICONERROR);
        return 1;
    }

    wchar_t tmpDir[32768];
    if (!GetTempPathW(32768, tmpDir)) { fclose(f); return 1; }
    wcscat(tmpDir, L"jimuchang_player");
    CreateDirectoryW(tmpDir, NULL);

    wchar_t htmlPath[32768];
    swprintf(htmlPath, 32768, L"%ls\\player.html", tmpDir);

    FILE *out = _wfopen(htmlPath, L"wb");
    if (!out) { fclose(f); return 1; }
    long long remain = (long long)size - 8 - (long long)off;
    _fseeki64(f, (long long)off, SEEK_SET);
    char buf[CHUNK];
    while (remain > 0) {
        long long want = remain > CHUNK ? CHUNK : remain;
        size_t rd = fread(buf, 1, (size_t)want, f);
        if (rd == 0) break;
        fwrite(buf, 1, rd, out);
        remain -= (long long)rd;
    }
    fclose(out);
    fclose(f);

    // URL：file:///C:/Users/... （反斜杠转正斜杠）
    wchar_t url[65536];
    wcscpy(url, L"file:///");
    wcsncat(url, htmlPath, 65000);
    for (wchar_t *p = url; *p; p++) if (*p == L'\\') *p = L'/';

    wchar_t args[65536];
    swprintf(args, 65536, L"--kiosk --edge-kiosk-type=fullscreen --no-first-run \"%ls\"", url);
    HINSTANCE r1 = ShellExecuteW(NULL, L"open", L"msedge.exe", args, NULL, SW_SHOWNORMAL);
    if ((INT_PTR)r1 > 32) return 0;
    swprintf(args, 65536, L"--kiosk --no-first-run \"%ls\"", url);
    HINSTANCE r2 = ShellExecuteW(NULL, L"open", L"chrome.exe", args, NULL, SW_SHOWNORMAL);
    if ((INT_PTR)r2 > 32) return 0;
    ShellExecuteW(NULL, L"open", url, NULL, NULL, SW_SHOWNORMAL);
    return 0;
}

#else /* ------------------------- Linux 逻辑测试版 ------------------------- */

int main(int argc, char **argv) {
    const char *path = argc > 1 ? argv[1] : NULL;
    if (!path) { fprintf(stderr, "usage: shell_test <bundle>\n"); return 2; }
    FILE *f = fopen(path, "rb");
    if (!f) { perror("open"); return 1; }
    fseeko(f, 0, SEEK_END);
    off_t size = ftello(f);
    if (size < 9) { fprintf(stderr, "too small\n"); return 1; }
    unsigned long long off = 0;
    fseeko(f, size - 8, SEEK_SET);
    if (fread(&off, 8, 1, f) != 1 || off < 1 || off >= (unsigned long long)(size - 8)) {
        fprintf(stderr, "bad offset\n");
        fclose(f);
        return 1;
    }
    char outPath[1024];
    snprintf(outPath, sizeof(outPath), "/tmp/jimuchang_shell_extract.html");
    FILE *out = fopen(outPath, "wb");
    long long remain = (long long)size - 8 - (long long)off;
    fseeko(f, (long long)off, SEEK_SET);
    char buf[CHUNK];
    while (remain > 0) {
        long long want = remain > CHUNK ? CHUNK : remain;
        size_t rd = fread(buf, 1, (size_t)want, f);
        if (rd == 0) break;
        fwrite(buf, 1, rd, out);
        remain -= (long long)rd;
    }
    fclose(out);
    fclose(f);
    printf("EXTRACT_OK size=%lld off=%llu out=%s\n", (long long)size, off, outPath);
    return 0;
}
#endif
