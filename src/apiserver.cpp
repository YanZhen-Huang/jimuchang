#include "apiserver.h"

#include <QBuffer>
#include <QCoreApplication>
#include <QDateTime>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QJsonDocument>
#include <QJsonObject>
#include <QPointer>
#include <QPromise>
#include <QRandomGenerator>
#include <QStandardPaths>
#include <QTimer>
#include <QUuid>
#include <QDebug>

ApiServer::ApiServer(QWebEngineView *view, QObject *parent)
    : QObject(parent), m_view(view) {
    setupRoutes();
}

QString apiConfigPath() {
    // 固定路径（不依赖 QStandardPaths，避免组织名影响路径规则）
    const QString dir = QDir::homePath() + QStringLiteral("/.config/jimuchang");
    QDir().mkpath(dir);
    return dir + QStringLiteral("/api.json");
}

bool ApiServer::start(quint16 port) {
    // 令牌：读配置或新建（写入 ~/.config/jimuchang/api.json 供 MCP 客户端读取）
    QFile cf(apiConfigPath());
    if (cf.open(QIODevice::ReadOnly)) {
        const QJsonObject o = QJsonDocument::fromJson(cf.readAll()).object();
        m_token = o.value(QStringLiteral("token")).toString();
    }
    cf.close();
    if (m_token.isEmpty()) {
        m_token = QUuid::createUuid().toString(QUuid::WithoutBraces).left(24);
    }

    m_tcp = new QTcpServer(this);
    if (!m_tcp->listen(QHostAddress::LocalHost, port)) {
        qWarning() << "[API] 端口监听失败:" << port;
        return false;
    }
    if (!m_server.bind(m_tcp)) {
        qWarning() << "[API] HTTP 服务绑定失败";
        return false;
    }
    m_port = m_tcp->serverPort();

    QJsonObject cfg{
        {QStringLiteral("port"), static_cast<int>(m_port)},
        {QStringLiteral("token"), m_token},
        {QStringLiteral("pid"), static_cast<int>(QCoreApplication::applicationPid())},
        {QStringLiteral("started"), QDateTime::currentDateTime().toString(Qt::ISODate)}
    };
    if (cf.open(QIODevice::WriteOnly | QIODevice::Truncate)) {
        cf.write(QJsonDocument(cfg).toJson(QJsonDocument::Indented));
        cf.close();
    }
    qInfo() << "[API] 已启动 http://127.0.0.1:" << m_port << "令牌已写入" << apiConfigPath();
    return true;
}

void ApiServer::stop() {
    m_server.route("/api/", QHttpServerRequest::Method::AnyKnown,
                   [](const QHttpServerRequest &) {
                       return QHttpServerResponse(QHttpServerResponse::StatusCode::ServiceUnavailable);
                   });
}

void ApiServer::setupRoutes() {
    const auto handler1 = [this](const QString &a, const QHttpServerRequest &req) {
        return dispatch(req, QStringList{a});
    };
    const auto handler2 = [this](const QString &a, const QString &b, const QHttpServerRequest &req) {
        return dispatch(req, QStringList{a, b});
    };
    const auto handler3 = [this](const QString &a, const QString &b, const QString &c, const QHttpServerRequest &req) {
        return dispatch(req, QStringList{a, b, c});
    };
    m_server.route(QStringLiteral("/api/<arg>"), handler1);
    m_server.route(QStringLiteral("/api/<arg>/<arg>"), handler2);
    m_server.route(QStringLiteral("/api/<arg>/<arg>/<arg>"), handler3);
}

QHttpServerResponse ApiServer::jsonResponse(int status, const QJsonObject &obj) {
    return QHttpServerResponse(QByteArray("application/json; charset=utf-8"),
                               QJsonDocument(obj).toJson(QJsonDocument::Compact),
                               static_cast<QHttpServerResponse::StatusCode>(status));
}

void ApiServer::onResult(const QString &id, const QString &json) {
    auto promise = m_pending.take(id);
    if (!promise) return;
    const QJsonObject res = QJsonDocument::fromJson(json.toUtf8()).object();
    const int st = res.value(QStringLiteral("status")).toInt(200);
    QJsonObject body = res.value(QStringLiteral("body")).toObject();
    if (body.isEmpty()) body = res;
    promise->addResult(QHttpServerResponse(
        QByteArray("application/json; charset=utf-8"),
        QJsonDocument(body).toJson(QJsonDocument::Compact),
        static_cast<QHttpServerResponse::StatusCode>(st)));
    promise->finish();
}

QFuture<QHttpServerResponse> ApiServer::dispatch(const QHttpServerRequest &req, const QStringList &parts) {
    const QString auth = QString::fromLatin1(req.headers().value("Authorization"));

    // 鉴权
    if (auth != QLatin1String("Bearer ") + m_token) {
        QPromise<QHttpServerResponse> p;
        p.addResult(jsonResponse(401, QJsonObject{
            {QStringLiteral("ok"), false},
            {QStringLiteral("error"), QStringLiteral("未授权：请在请求头带 Authorization: Bearer <token>（见 ~/.config/jimuchang/api.json）")}
        }));
        p.finish();
        return p.future();
    }

    // 截图直接由 C++ 处理：先提到前台 + 等重绘（避免被遮挡导致黑帧）
    if (parts.size() >= 1 && parts.at(0) == QLatin1String("screenshot")) {
        if (QWidget *w = m_view->window()) {
            w->raise();
        }
        auto promise = std::make_shared<QPromise<QHttpServerResponse>>();
        auto future = promise->future();
        QPointer<QWebEngineView> v = m_view;
        QTimer::singleShot(180, this, [this, v, promise]() {
            if (!v) {
                promise->addResult(QHttpServerResponse(QHttpServerResponse::StatusCode::ServiceUnavailable));
                promise->finish();
                return;
            }
            QPixmap pm = v->grab();
            QByteArray ba;
            QBuffer buf(&ba);
            buf.open(QIODevice::WriteOnly);
            pm.save(&buf, "PNG");
            // 全黑检测（稀疏采样）
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
            QJsonObject data{
                {QStringLiteral("png"), QString::fromLatin1(ba.toBase64())},
                {QStringLiteral("width"), pm.width()},
                {QStringLiteral("height"), pm.height()}
            };
            if (black) {
                data.insert(QStringLiteral("warning"),
                            QStringLiteral("画面疑似全黑：请确认积木剧场窗口未被最小化或遮挡"));
            }
            promise->addResult(jsonResponse(200, QJsonObject{
                {QStringLiteral("ok"), true},
                {QStringLiteral("data"), data}
            }));
            promise->finish();
        });
        return future;
    }

    QJsonObject body;
    if (!req.body().isEmpty()) {
        body = QJsonDocument::fromJson(req.body()).object();
    }
    QString method;
    switch (req.method()) {
    case QHttpServerRequest::Method::Get: method = QStringLiteral("GET"); break;
    case QHttpServerRequest::Method::Post: method = QStringLiteral("POST"); break;
    case QHttpServerRequest::Method::Put: method = QStringLiteral("PUT"); break;
    case QHttpServerRequest::Method::Patch: method = QStringLiteral("PATCH"); break;
    case QHttpServerRequest::Method::Delete: method = QStringLiteral("DELETE"); break;
    default: method = QStringLiteral("GET"); break;
    }

    const QJsonObject jsReq{
        {QStringLiteral("method"), method},
        {QStringLiteral("path"), QStringLiteral("/api/") + parts.join(QLatin1Char('/'))},
        {QStringLiteral("body"), body}
    };
    const QString reqId = QUuid::createUuid().toString(QUuid::WithoutBraces);
    auto promise = std::make_shared<QPromise<QHttpServerResponse>>();
    auto future = promise->future();
    m_pending.insert(reqId, promise);
    const QString json = QString::fromUtf8(QJsonDocument(jsReq).toJson(QJsonDocument::Compact));
    const QString code = QStringLiteral(
        "try{if(window.ApiBridge){ApiBridge.handle(%1, \"%2\");}"
        "else{window.__apiFallback=%3;}}catch(e){window.__apiFallback=%3;}")
        .arg(json, reqId, QStringLiteral("{\"status\":500,\"body\":{\"ok\":false,\"error\":\"ApiBridge 未加载\"}}"));
    m_view->page()->runJavaScript(code);
    // 看门狗：JS 未在 15 秒内回传则超时
    QTimer::singleShot(15000, this, [this, reqId]() {
        auto p = m_pending.take(reqId);
        if (!p) return;
        p->addResult(jsonResponse(504, QJsonObject{
            {QStringLiteral("ok"), false},
            {QStringLiteral("error"), QStringLiteral("处理超时（JS 桥未响应）")}
        }));
        p->finish();
    });
    return future;
}
