// 积木剧场 jimuchang - P0 技术验证版
// 验证：WebEngine 起窗、qrc 加载、Blockly、中文字体、QWebChannel、全屏、
//       键盘、mp4 视频、Three.js(ESM/WebGL)、ECharts
#include <QApplication>
#include <QBuffer>
#include <QCloseEvent>
#include <QDebug>
#include <QDir>
#include <QElapsedTimer>
#include <QFile>
#include <QFileDialog>
#include <QFileInfo>
#include <QMainWindow>
#include <QMessageBox>
#include <QPushButton>
#include <QMimeDatabase>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QProcess>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QScreen>
#include <QSettings>
#include <QStandardPaths>
#include <QTextStream>
#include <QTimer>
#include <QUrlQuery>
#include <QVariantMap>
#include <QWebChannel>
#include <QWebEnginePage>
#include <QWebEngineProfile>
#include <QWebEngineSettings>
#include <QWebEngineView>
#include <cstdio>
#include "apiserver.h"

class ConsolePage : public QWebEnginePage {
    Q_OBJECT
public:
    explicit ConsolePage(QWebEngineProfile *profile, QObject *parent = nullptr)
        : QWebEnginePage(profile, parent) {}

protected:
    void javaScriptConsoleMessage(JavaScriptConsoleMessageLevel level,
                                  const QString &message, int lineNumber,
                                  const QString &sourceID) override {
        const char *tag = "LOG";
        if (level == WarningMessageLevel) tag = "WARN";
        else if (level == ErrorMessageLevel) tag = "ERR";
        std::fprintf(stdout, "[JS %s] %s:%d %s\n", tag,
                     sourceID.section('/', -1).toUtf8().constData(),
                     lineNumber, message.toUtf8().constData());
        std::fflush(stdout);
    }
};

class HostBridge : public QObject {
    Q_OBJECT
public:
    explicit HostBridge(QObject *parent = nullptr) : QObject(parent) {}
    void setWindow(QWidget *w) { m_win = w; }
    QNetworkAccessManager *m_nam = nullptr;

signals:
    // AI 请求异步结果（JS 侧 host.aiResult.connect(...) 接收）
    void aiResult(const QString &id, bool ok, const QString &content);

public slots:
    QString ping() { return QStringLiteral("pong-from-cpp"); }

    // AI 助手：代理 DeepSeek Chat Completions（免 CORS；key 存 QSettings.aiKey）
    void aiChat(const QString &id, const QString &messagesJson) {
        QSettings st;
        const QString key = st.value(QStringLiteral("aiKey")).toString().trimmed();
        if (key.isEmpty()) { emit aiResult(id, false, QStringLiteral("未配置 API Key（设置 → AI 助手）")); return; }
        if (!m_nam) m_nam = new QNetworkAccessManager(this);
        QNetworkRequest req(QUrl(QStringLiteral("https://api.deepseek.com/chat/completions")));
        req.setHeader(QNetworkRequest::ContentTypeHeader, QStringLiteral("application/json"));
        req.setRawHeader("Authorization", ("Bearer " + key).toUtf8());
        QJsonObject body;
        const QJsonDocument inDoc = QJsonDocument::fromJson(messagesJson.toUtf8());
        const QJsonObject inObj = inDoc.object();
        body.insert(QStringLiteral("model"), inObj.value(QStringLiteral("model")).toString(QStringLiteral("deepseek-chat")));
        body.insert(QStringLiteral("temperature"), 0.7);
        body.insert(QStringLiteral("messages"), inObj.value(QStringLiteral("messages")).toArray());
        QNetworkReply *reply = m_nam->post(req, QJsonDocument(body).toJson(QJsonDocument::Compact));
        connect(reply, &QNetworkReply::finished, this, [this, reply, id]() {
            reply->deleteLater();
            if (reply->error() != QNetworkReply::NoError) {
                emit aiResult(id, false, QStringLiteral("网络错误：") + reply->errorString());
                return;
            }
            const QJsonDocument doc = QJsonDocument::fromJson(reply->readAll());
            const QJsonArray choices = doc.object().value(QStringLiteral("choices")).toArray();
            const QString content = choices.isEmpty() ? QString()
                : choices.at(0).toObject().value(QStringLiteral("message")).toObject()
                    .value(QStringLiteral("content")).toString();
            if (content.isEmpty()) { emit aiResult(id, false, QStringLiteral("响应为空（检查 Key 与额度）")); return; }
            emit aiResult(id, true, content);
        });
    }

    QString info() {
        return QStringLiteral("jimuchang %1 | Qt %2")
            .arg(QCoreApplication::applicationVersion(), QString::fromLatin1(qVersion()));
    }

    void setFullscreen(bool on) {
        if (!m_win) return;
        if (on) m_win->showFullScreen();
        else m_win->showNormal();
    }

    // 界面缩放（网页缩放因子；设置 → 编辑器 → 界面缩放）
    void setZoom(double factor) {
        if (m_view) m_view->setZoomFactor(qBound(0.5, factor, 2.0));
    }

    void setTitle(const QString &t) {
        if (m_win) m_win->setWindowTitle(t.isEmpty() ? QStringLiteral("积木剧场") : t);
    }

    QString saveProject(const QString &base64, const QString &suggestedName) {
        if (!m_win) return QString();
        const QString path = QFileDialog::getSaveFileName(
            m_win, QStringLiteral("保存项目"),
            QDir::homePath() + QLatin1Char('/') + (suggestedName.isEmpty() ? QStringLiteral("未命名演示.bdp") : suggestedName),
            QStringLiteral("积木剧场项目 (*.bdp)"));
        if (path.isEmpty()) return QString();
        return saveProjectDirect(path, base64) ? path : QString();
    }

    bool saveProjectDirect(const QString &path, const QString &base64) {
        QFile f(path);
        if (!f.open(QIODevice::WriteOnly)) return false;
        f.write(QByteArray::fromBase64(base64.toLatin1()));
        f.close();
        return true;
    }

    QString readFileBase64(const QString &path) {
        QFile f(path);
        if (!f.open(QIODevice::ReadOnly)) return QString();
        return QString::fromLatin1(f.readAll().toBase64());
    }

    QVariantMap openProject() {
        QVariantMap r;
        if (!m_win) return r;
        const QString path = QFileDialog::getOpenFileName(
            m_win, QStringLiteral("打开项目"), QDir::homePath(),
            QStringLiteral("积木剧场项目 (*.bdp)"));
        if (path.isEmpty()) return r;
        return readProjectFile(path);
    }

    QVariantMap readProjectFile(const QString &path) {
        QVariantMap r;
        QFile f(path);
        if (!f.open(QIODevice::ReadOnly)) return r;
        r.insert(QStringLiteral("path"), path);
        r.insert(QStringLiteral("base64"), QString::fromLatin1(f.readAll().toBase64()));
        return r;
    }

    QVariantMap importResource(const QString &kind) {
        QVariantMap r;
        if (!m_win) return r;
        QString filter;
        if (kind == QLatin1String("image"))
            filter = QStringLiteral("图片 (*.png *.jpg *.jpeg *.gif *.webp *.svg *.bmp)");
        else if (kind == QLatin1String("audio"))
            filter = QStringLiteral("音频 (*.mp3 *.wav *.ogg)");
        else if (kind == QLatin1String("video"))
            filter = QStringLiteral("视频 (*.mp4 *.webm)");
        else if (kind == QLatin1String("model"))
            filter = QStringLiteral("3D 模型 (*.glb *.gltf)");
        else if (kind == QLatin1String("webapp"))
            filter = QStringLiteral("网页 (*.html *.htm)");
        else
            filter = QStringLiteral("所有文件 (*)");
        const QString path = QFileDialog::getOpenFileName(
            m_win, QStringLiteral("导入素材"), QDir::homePath(), filter);
        if (path.isEmpty()) return r;
        QFile f(path);
        if (!f.open(QIODevice::ReadOnly)) return r;
        const QByteArray data = f.readAll();
        QMimeDatabase db;
        r.insert(QStringLiteral("name"), QFileInfo(path).fileName());
        r.insert(QStringLiteral("mime"), db.mimeTypeForFileNameAndData(path, data).name());
        r.insert(QStringLiteral("base64"), QString::fromLatin1(data.toBase64()));
        return r;
    }

    QVariantList importResourceMulti(const QString &kind) {
        QVariantList out;
        if (!m_win) return out;
        QString filter;
        if (kind == QLatin1String("image"))
            filter = QStringLiteral("图片 (*.png *.jpg *.jpeg *.gif *.webp *.bmp)");
        else
            filter = QStringLiteral("所有文件 (*)");
        const QStringList paths = QFileDialog::getOpenFileNames(
            m_win, QStringLiteral("选择文件（可多选）"), QDir::homePath(), filter);
        QMimeDatabase db;
        for (const QString &path : paths) {
            QFile f(path);
            if (!f.open(QIODevice::ReadOnly)) continue;
            const QByteArray data = f.readAll();
            QVariantMap r;
            r.insert(QStringLiteral("name"), QFileInfo(path).fileName());
            r.insert(QStringLiteral("mime"), db.mimeTypeForFileNameAndData(path, data).name());
            r.insert(QStringLiteral("base64"), QString::fromLatin1(data.toBase64()));
            out.append(r);
        }
        return out;
    }

    QString exportHtml(const QString &base64, const QString &suggestedName) {
        if (!m_win) return QString();
        const QString path = QFileDialog::getSaveFileName(
            m_win, QStringLiteral("导出放映包（HTML）"),
            QDir::homePath() + QLatin1Char('/') + (suggestedName.isEmpty() ? QStringLiteral("放映机.html") : suggestedName),
            QStringLiteral("网页 (*.html)"));
        if (path.isEmpty()) return QString();
        QFile f(path);
        if (!f.open(QIODevice::WriteOnly)) return QString();
        f.write(QByteArray::fromBase64(base64.toLatin1()));
        f.close();
        return path;
    }

    QVariantList recentFiles() {
        QSettings s;
        return s.value(QStringLiteral("recentFiles")).toList();
    }

    void addRecentFile(const QString &path) {
        if (path.isEmpty()) return;
        QSettings s;
        QStringList list = s.value(QStringLiteral("recentFiles")).toStringList();
        list.removeAll(path);
        list.prepend(path);
        while (list.size() > 8) list.removeLast();
        s.setValue(QStringLiteral("recentFiles"), list);
    }

    // 全局偏好读写（设置面板用；部分项重启生效）
    void setPref(const QString &key, const QString &val) {
        QSettings s;
        s.setValue(key, val);
    }

    QString getPref(const QString &key) {
        QSettings s;
        return s.value(key).toString();
    }

    // 导出 Windows 单文件程序：[外壳 exe] + [HTML] + [8字节偏移]
    bool writeExeBundle(const QString &path, const QString &htmlBase64) {
        QFile shell(QStringLiteral(":/assets/jimu_shell.exe"));
        if (!shell.open(QIODevice::ReadOnly)) return false;
        const QByteArray shellData = shell.readAll();
        const QByteArray html = QByteArray::fromBase64(htmlBase64.toLatin1());
        QFile out(path);
        if (!out.open(QIODevice::WriteOnly)) return false;
        out.write(shellData);
        out.write(html);
        QByteArray tail(8, 0);
        const quint64 off = (quint64)shellData.size();
        for (int i = 0; i < 8; i++) tail[i] = char((off >> (8 * i)) & 0xFF);
        out.write(tail);
        out.close();
        return true;
    }

    QString exportExe(const QString &htmlBase64, const QString &suggestedName) {
        if (!m_win) return QString();
        const QString path = QFileDialog::getSaveFileName(
            m_win, QStringLiteral("导出 Windows 程序"),
            QDir::homePath() + QLatin1Char('/') + suggestedName,
            QStringLiteral("Windows 程序 (*.exe)"));
        if (path.isEmpty()) return QString();
        return writeExeBundle(path, htmlBase64) ? path : QString();
    }

    QString exportExeTo(const QString &path, const QString &htmlBase64) {
        return writeExeBundle(path, htmlBase64) ? path : QString();
    }

    QString exportPptx(const QString &base64, const QString &suggestedName) {
        if (!m_win) return QString();
        const QString path = QFileDialog::getSaveFileName(
            m_win, QStringLiteral("导出为 PPT"),
            QDir::homePath() + QLatin1Char('/') + (suggestedName.isEmpty() ? QStringLiteral("演示.pptx") : suggestedName),
            QStringLiteral("PPT 演示文稿 (*.pptx)"));
        if (path.isEmpty()) return QString();
        QFile f(path);
        if (!f.open(QIODevice::WriteOnly)) return QString();
        f.write(QByteArray::fromBase64(base64.toLatin1()));
        f.close();
        return path;
    }

    QString autosavePath() {
        const QString dir = QDir::homePath() + QStringLiteral("/.cache/jimuchang");
        QDir().mkpath(dir);
        return dir + QStringLiteral("/autosave.bdp");
    }

    void apiResult(const QString &id, const QString &json) {
        if (m_api) m_api->onResult(id, json);
    }

    void setDirty(bool d) { m_dirty = d; }

    void raiseWindow() {
        if (m_win) { m_win->raise(); m_win->activateWindow(); }
    }

    QString captureWindow() {
        if (!m_view) return QString();
        QPixmap pm = m_view->grab();
        // 黑帧检测（窗口被遮挡/未渲染时返回空，由页面重试）
        bool black = true;
        const QImage img = pm.toImage().convertToFormat(QImage::Format_Grayscale8);
        if (!img.isNull()) {
            for (int y = 0; y < img.height() && black; y += 17) {
                const uchar *line = img.constScanLine(y);
                for (int x = 0; x < img.width(); x += 23) {
                    if (line[x] > 24) { black = false; break; }
                }
            }
        }
        if (black) return QString();
        QByteArray ba;
        QBuffer buf(&ba);
        buf.open(QIODevice::WriteOnly);
        pm.save(&buf, "PNG");
        return QString::fromLatin1(ba.toBase64());
    }

    void quitApp() { QCoreApplication::quit(); }

    // ---------- 视频录制：逐帧抓取舞台 → ffmpeg 合成 MP4 ----------
    bool recordStart(int fps, int width, int height, int cropX, int cropY, int cropW, int cropH) {
        if (!m_view || m_recTimer) return false;
        m_recDir = QDir::homePath() + QStringLiteral("/.cache/jimuchang/rec");
        QDir(m_recDir).removeRecursively();
        if (!QDir().mkpath(m_recDir)) return false;
        m_recFrames.clear();
        m_recFps = qBound(1, fps, 60);
        m_recW = qBound(160, width, 3840);
        m_recH = qBound(90, height, 2160);
        m_recCrop = QRect(cropX, cropY, qMax(1, cropW), qMax(1, cropH));
        m_recClock.start();
        if (!m_recTimer) {
            m_recTimer = new QTimer(this);
            connect(m_recTimer, &QTimer::timeout, this, [this] { recordTick(); });
        }
        m_recTimer->start(qMax(5, 1000 / m_recFps));
        std::fprintf(stdout, "[REC] start fps=%d %dx%d crop=(%d,%d %dx%d)\n",
                     m_recFps, m_recW, m_recH, cropX, cropY, cropW, cropH);
        std::fflush(stdout);
        return true;
    }

    int recordStop() {
        if (m_recTimer) m_recTimer->stop();
        const int n = int(m_recFrames.size());
        std::fprintf(stdout, "[REC] stop frames=%d\n", n);
        std::fflush(stdout);
        return n;
    }

    QString recordSaveDialog(const QString &suggestedName) {
        if (!m_win) return QString();
        return QFileDialog::getSaveFileName(
            m_win, QStringLiteral("导出视频"),
            QDir::homePath() + QLatin1Char('/') + (suggestedName.isEmpty() ? QStringLiteral("演示.mp4") : suggestedName),
            QStringLiteral("MP4 视频 (*.mp4)"));
    }

    // 用 ffmpeg concat 合成（每帧带真实时间戳，抓帧变慢也不会变速）
    QString recordFinish(const QString &outPath) {
        if (m_recFrames.size() < 2 || outPath.isEmpty() || m_recDir.isEmpty()) return QString();
        QFile list(m_recDir + QStringLiteral("/frames.txt"));
        if (!list.open(QIODevice::WriteOnly | QIODevice::Text)) return QString();
        {
            QTextStream ts(&list);
            for (int i = 0; i < m_recFrames.size(); ++i) {
                const QString name = QStringLiteral("frame_%1.jpg").arg(i + 1, 5, 10, QLatin1Char('0'));
                const double dur = (i + 1 < m_recFrames.size())
                    ? double(m_recFrames[i + 1] - m_recFrames[i]) / 1000.0
                    : qMax(0.02, 1.0 / m_recFps);
                ts << "file '" << name << "'\nduration " << QString::number(dur, 'f', 4) << "\n";
            }
            // concat demuxer 需要末帧重复一次才能保证最后一帧的时长生效
            ts << "file '" << QStringLiteral("frame_%1.jpg").arg(m_recFrames.size(), 5, 10, QLatin1Char('0')) << "'\n";
        }
        list.close();
        QProcess ff;
        ff.setWorkingDirectory(m_recDir);
        const QStringList args{QStringLiteral("-y"), QStringLiteral("-f"), QStringLiteral("concat"),
                               QStringLiteral("-safe"), QStringLiteral("0"), QStringLiteral("-i"), QStringLiteral("frames.txt"),
                               QStringLiteral("-vsync"), QStringLiteral("vfr"),
                               QStringLiteral("-c:v"), QStringLiteral("libx264"), QStringLiteral("-preset"), QStringLiteral("medium"),
                               QStringLiteral("-crf"), QStringLiteral("20"), QStringLiteral("-pix_fmt"), QStringLiteral("yuv420p"),
                               QStringLiteral("-movflags"), QStringLiteral("+faststart"), outPath};
        ff.start(QStringLiteral("ffmpeg"), args);
        if (!ff.waitForStarted(5000)) return QString();
        if (!ff.waitForFinished(15 * 60 * 1000)) { ff.kill(); ff.waitForFinished(3000); return QString(); }
        QFileInfo fi(outPath);
        const bool ok = ff.exitStatus() == QProcess::NormalExit && ff.exitCode() == 0
            && fi.exists() && fi.size() > 1024;
        std::fprintf(stdout, "[REC] finish ok=%d size=%lld path=%s\n", ok ? 1 : 0,
                     static_cast<long long>(fi.size()), outPath.toUtf8().constData());
        std::fflush(stdout);
        if (ok) QDir(m_recDir).removeRecursively();   // 成功即清理逐帧临时文件；失败保留供排查
        return ok ? outPath : QString();
    }

public:
    void setApiServer(ApiServer *api) { m_api = api; }
    void setView(QWebEngineView *v) { m_view = v; }

public:
    bool isDirty() const { return m_dirty; }

private:
    // 抓一帧：裁剪舞台区域 → 缩放到输出分辨率 → JPEG 落盘（时间戳相对录制开始）
    void recordTick() {
        if (!m_view || m_recDir.isEmpty()) return;
        const QPixmap pm = m_view->grab();
        if (pm.isNull()) return;
        const QImage img = pm.toImage();
        const double dpr = double(img.width()) / qMax(1, m_view->width());   // 逻辑 → 物理像素
        QRect crop(qRound(m_recCrop.x() * dpr), qRound(m_recCrop.y() * dpr),
                   qRound(m_recCrop.width() * dpr), qRound(m_recCrop.height() * dpr));
        crop = crop.intersected(img.rect());
        if (crop.width() < 8 || crop.height() < 8) return;
        const QImage stage = img.copy(crop).scaled(m_recW, m_recH, Qt::IgnoreAspectRatio, Qt::SmoothTransformation);
        // 全黑帧（窗口被遮挡/最小化时的 grab 结果）跳过，避免黑屏混入视频；首帧放行
        if (!m_recFrames.isEmpty()) {
            bool black = true;
            const QImage g = stage.convertToFormat(QImage::Format_Grayscale8);
            for (int y = 0; y < g.height() && black; y += 23) {
                const uchar *line = g.constScanLine(y);
                for (int x = 0; x < g.width(); x += 31) {
                    if (line[x] > 10) { black = false; break; }
                }
            }
            if (black) return;
        }
        const QString path = m_recDir + QStringLiteral("/frame_%1.jpg").arg(m_recFrames.size() + 1, 5, 10, QLatin1Char('0'));
        if (!stage.save(path, "JPG", 90)) return;
        m_recFrames.append(m_recClock.elapsed());
    }

    QTimer *m_recTimer = nullptr;
    QString m_recDir;
    QVector<qint64> m_recFrames;   // 每帧时间戳（相对录制开始，ms）
    QElapsedTimer m_recClock;
    QRect m_recCrop;
    int m_recFps = 24;
    int m_recW = 1280;
    int m_recH = 720;

    QWidget *m_win = nullptr;
    QWebEngineView *m_view = nullptr;
    ApiServer *m_api = nullptr;
    bool m_dirty = false;
};

// 退出加固：先隐藏窗口并停止页面渲染，规避 WebEngine/DConfig 退出竞态
class MainWindow : public QMainWindow {
public:
    using QMainWindow::QMainWindow;
    void setBridge(HostBridge *b) { m_bridge = b; }
protected:
    void closeEvent(QCloseEvent *e) override {
        if (m_bridge && m_bridge->isDirty()) {
            QMessageBox box(this);
            box.setWindowTitle(QStringLiteral("退出积木剧场"));
            box.setText(QStringLiteral("有未保存的修改，仍要退出吗？"));
            box.setIcon(QMessageBox::Question);
            QPushButton *quitBtn = box.addButton(QStringLiteral("退出"), QMessageBox::AcceptRole);
            box.addButton(QStringLiteral("取消"), QMessageBox::RejectRole);
            box.exec();
            if (box.clickedButton() != quitBtn) {
                e->ignore();
                return;
            }
        }
        const auto views = findChildren<QWebEngineView *>();
        for (auto *v : views) {
            v->hide();
            v->stop();
        }
        hide();
        QMainWindow::closeEvent(e);
    }

private:
    HostBridge *m_bridge = nullptr;
};

int main(int argc, char *argv[]) {
    // Deepin 会导出 QT_SCALE_FACTOR_ROUNDING_POLICY=PassThrough：与下方显式设置重复，
    // 且会让 Qt 在 QApplication 构造后二次应用并打印警告——这里清除，策略由显式设置保证。
    qunsetenv("QT_SCALE_FACTOR_ROUNDING_POLICY");
    // 设置 → 渲染性能 → 禁用 GPU 加速（花屏自救；必须在 QApplication 创建前设置）
    {
        QSettings s;
        const QJsonObject pref = QJsonDocument::fromJson(
            s.value(QStringLiteral("settingsJson")).toString().toUtf8()).object();
        if (pref.value(QStringLiteral("disableGpu")).toBool()) {
            QByteArray flags = qgetenv("QTWEBENGINE_CHROMIUM_FLAGS");
            if (!flags.contains("--disable-gpu")) {
                if (!flags.isEmpty()) flags += ' ';
                flags += "--disable-gpu";
                qputenv("QTWEBENGINE_CHROMIUM_FLAGS", flags);
            }
        }
    }
    QGuiApplication::setHighDpiScaleFactorRoundingPolicy(
        Qt::HighDpiScaleFactorRoundingPolicy::PassThrough);
    QApplication app(argc, argv);
    QCoreApplication::setApplicationName(QStringLiteral("jimuchang"));
    QCoreApplication::setOrganizationName(QStringLiteral("jimuchang"));
    QCoreApplication::setApplicationVersion(QStringLiteral("2.0.6"));

    MainWindow win;
    win.resize(1440, 900);
    win.setWindowTitle(QStringLiteral("积木剧场 · P0 技术验证"));

    auto *view = new QWebEngineView(&win);
    auto *page = new ConsolePage(QWebEngineProfile::defaultProfile(), view);
    page->settings()->setAttribute(QWebEngineSettings::LocalContentCanAccessRemoteUrls, false);
    page->settings()->setAttribute(QWebEngineSettings::JavascriptCanOpenWindows, false);
    view->setPage(page);
    view->setContextMenuPolicy(Qt::NoContextMenu);  // 右键菜单由网页接管
    win.setCentralWidget(view);

    auto *bridge = new HostBridge(&win);
    bridge->setWindow(&win);
    bridge->setView(view);
    win.setBridge(bridge);
    auto *channel = new QWebChannel(page);
    channel->registerObject(QStringLiteral("host"), bridge);
    page->setWebChannel(channel);

    view->load(QUrl(QStringLiteral("qrc:///index.html")));
    // 自动化测试参数：--test-save / --test-open / --test-play / --test-kf / --test-url
    const QStringList args = QCoreApplication::arguments();
    QUrl url(QStringLiteral("qrc:///index.html"));
    QUrlQuery q;
    bool hasQuery = false;
    const int ui = args.indexOf(QStringLiteral("--test-url"));
    if (ui >= 0 && ui + 1 < args.size()) {
        // 直接加载指定地址（验证导出的放映包 / 外部页面）
        view->load(QUrl::fromUserInput(args.at(ui + 1)));
    } else {
        const int ti = args.indexOf(QStringLiteral("--test-save"));
        if (ti >= 0 && ti + 1 < args.size()) {
            q.addQueryItem(QStringLiteral("testsave"), args.at(ti + 1));
            hasQuery = true;
        }
        const int oi = args.indexOf(QStringLiteral("--test-open"));
        if (oi >= 0 && oi + 1 < args.size()) {
            q.addQueryItem(QStringLiteral("testopen"), args.at(oi + 1));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-play"))) {
            q.addQueryItem(QStringLiteral("testplay"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-kf"))) {
            q.addQueryItem(QStringLiteral("testkf"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-help"))) {
            q.addQueryItem(QStringLiteral("testhelp"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-guides"))) {
            q.addQueryItem(QStringLiteral("testguides"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-ppt"))) {
            q.addQueryItem(QStringLiteral("testppt"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-menu"))) {
            q.addQueryItem(QStringLiteral("testmenu"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-home"))) {
            q.addQueryItem(QStringLiteral("testhome"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-theme-light"))) {
            q.addQueryItem(QStringLiteral("testtheme"), QStringLiteral("light"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-theme-national"))) {
            q.addQueryItem(QStringLiteral("testtheme"), QStringLiteral("national"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-r2"))) {
            q.addQueryItem(QStringLiteral("testr2"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-reveal"))) {
            q.addQueryItem(QStringLiteral("testreveal"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-elblocks"))) {
            q.addQueryItem(QStringLiteral("testelblocks"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-settings"))) {
            q.addQueryItem(QStringLiteral("testsettings"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-blocks2"))) {
            q.addQueryItem(QStringLiteral("testblocks2"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-blocks3"))) {
            q.addQueryItem(QStringLiteral("testblocks3"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-broadcast"))) {
            q.addQueryItem(QStringLiteral("testbroadcast"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-func"))) {
            q.addQueryItem(QStringLiteral("testfunc"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-search"))) {
            q.addQueryItem(QStringLiteral("testsearch"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-pack"))) {
            q.addQueryItem(QStringLiteral("testpack"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-ai"))) {
            q.addQueryItem(QStringLiteral("testai"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-perf"))) {
            q.addQueryItem(QStringLiteral("testperf"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-exe"))) {
            q.addQueryItem(QStringLiteral("testexe"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-fx"))) {
            q.addQueryItem(QStringLiteral("testfx"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-save2"))) {
            q.addQueryItem(QStringLiteral("testsave2"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-templates"))) {
            q.addQueryItem(QStringLiteral("testtemplates"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-ctabs"))) {
            q.addQueryItem(QStringLiteral("testctabs"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-uiscale"))) {
            q.addQueryItem(QStringLiteral("testuiscale"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-canvaszoom"))) {
            q.addQueryItem(QStringLiteral("testcanvaszoom"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-playview"))) {
            q.addQueryItem(QStringLiteral("testplayview"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-layout"))) {
            q.addQueryItem(QStringLiteral("testlayout"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-elbar"))) {
            q.addQueryItem(QStringLiteral("testelbar"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-record"))) {
            q.addQueryItem(QStringLiteral("testrecord"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-hotkeys"))) {
            q.addQueryItem(QStringLiteral("testhotkeys"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (hasQuery) {
            url.setQuery(q);
            view->load(url);
        }
    }
    win.show();

    // 本地 AI 接口（127.0.0.1 + Bearer 令牌，配置见 ~/.config/jimuchang/api.json）
    const bool noApi = args.contains(QStringLiteral("--no-api"))
        || !QSettings().value(QStringLiteral("apiEnabled"), true).toBool();
    if (!noApi) {
        auto *api = new ApiServer(view, &app);
        bridge->setApiServer(api);
        quint16 apiPort = 17800;
        const int pi = args.indexOf(QStringLiteral("--port"));
        if (pi >= 0 && pi + 1 < args.size()) apiPort = static_cast<quint16>(args.at(pi + 1).toUInt());
        api->start(apiPort);
    }

    std::fprintf(stdout, "[P0] app started, loading qrc:///index.html ...\n");
    std::fflush(stdout);

    const QString shotPath = qEnvironmentVariable("P0_SHOT");
    if (!shotPath.isEmpty()) {
        QTimer::singleShot(8000, &app, [&]() {
            QPixmap pm = view->grab();
            bool ok1 = pm.save(shotPath);
            std::fprintf(stdout, "[P0] view->grab() -> %s (%dx%d)\n",
                         ok1 ? "saved" : "FAILED", pm.width(), pm.height());
            if (QScreen *screen = win.screen()) {
                QPixmap pm2 = screen->grabWindow(win.winId());
                const QString shot2 = shotPath + QStringLiteral(".screen.png");
                bool ok2 = pm2.save(shot2);
                std::fprintf(stdout, "[P0] screen grab -> %s (%dx%d)\n",
                             ok2 ? "saved" : "FAILED", pm2.width(), pm2.height());
            }
            std::fflush(stdout);
            app.quit();
        });
    }
    return app.exec();
}

#include "main.moc"
