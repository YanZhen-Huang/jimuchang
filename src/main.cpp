// 积木剧场 jimuchang - P0 技术验证版
// 验证：WebEngine 起窗、qrc 加载、Blockly、中文字体、QWebChannel、全屏、
//       键盘、mp4 视频、Three.js(ESM/WebGL)、ECharts
#include <QApplication>
#include <QCloseEvent>
#include <QDebug>
#include <QDir>
#include <QFile>
#include <QFileDialog>
#include <QFileInfo>
#include <QMainWindow>
#include <QMessageBox>
#include <QPushButton>
#include <QMimeDatabase>
#include <QScreen>
#include <QSettings>
#include <QStandardPaths>
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

public slots:
    QString ping() { return QStringLiteral("pong-from-cpp"); }

    QString info() {
        return QStringLiteral("jimuchang %1 | Qt %2")
            .arg(QCoreApplication::applicationVersion(), QString::fromLatin1(qVersion()));
    }

    void setFullscreen(bool on) {
        if (!m_win) return;
        if (on) m_win->showFullScreen();
        else m_win->showNormal();
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

    QString autosavePath() {
        const QString dir = QDir::homePath() + QStringLiteral("/.cache/jimuchang");
        QDir().mkpath(dir);
        return dir + QStringLiteral("/autosave.bdp");
    }

    void apiResult(const QString &id, const QString &json) {
        if (m_api) m_api->onResult(id, json);
    }

    void setDirty(bool d) { m_dirty = d; }

    void quitApp() { QCoreApplication::quit(); }

public:
    void setApiServer(ApiServer *api) { m_api = api; }

public:
    bool isDirty() const { return m_dirty; }

private:
    QWidget *m_win = nullptr;
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
    QGuiApplication::setHighDpiScaleFactorRoundingPolicy(
        Qt::HighDpiScaleFactorRoundingPolicy::PassThrough);
    QApplication app(argc, argv);
    QCoreApplication::setApplicationName(QStringLiteral("jimuchang"));
    QCoreApplication::setOrganizationName(QStringLiteral("jimuchang"));
    QCoreApplication::setApplicationVersion(QStringLiteral("0.1.0"));

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
        if (args.contains(QStringLiteral("--test-home"))) {
            q.addQueryItem(QStringLiteral("testhome"), QStringLiteral("1"));
            hasQuery = true;
        }
        if (args.contains(QStringLiteral("--test-theme-light"))) {
            q.addQueryItem(QStringLiteral("testtheme"), QStringLiteral("light"));
            hasQuery = true;
        }
        if (hasQuery) {
            url.setQuery(q);
            view->load(url);
        }
    }
    win.show();

    // 本地 AI 接口（127.0.0.1 + Bearer 令牌，配置见 ~/.config/jimuchang/api.json）
    const bool noApi = args.contains(QStringLiteral("--no-api"));
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
