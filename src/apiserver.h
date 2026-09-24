// 本地 HTTP API 服务器：AI 接口（127.0.0.1 + Bearer 令牌）
#pragma once

#include <QHttpServer>
#include <QJsonObject>
#include <QMap>
#include <QPromise>
#include <QTcpServer>
#include <memory>
#include <QObject>
#include <QWebEnginePage>
#include <QWebEngineView>
#include <functional>

class ApiServer : public QObject {
    Q_OBJECT
public:
    ApiServer(QWebEngineView *view, QObject *parent = nullptr);
    bool start(quint16 port = 17800);
    void stop();
    void onResult(const QString &id, const QString &json);
    quint16 port() const { return m_port; }
    QString token() const { return m_token; }

private:
    QFuture<QHttpServerResponse> dispatch(const QHttpServerRequest &req, const QStringList &parts);
    QHttpServerResponse jsonResponse(int status, const QJsonObject &obj);
    void setupRoutes();

    QWebEngineView *m_view = nullptr;
    QHttpServer m_server;
    QTcpServer *m_tcp = nullptr;
    QMap<QString, std::shared_ptr<QPromise<QHttpServerResponse>>> m_pending;
    quint16 m_port = 0;
    QString m_token;
};
