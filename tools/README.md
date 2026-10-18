# 积木剧场 MCP 服务器

把积木剧场的本地 API 包装成 MCP 工具，让支持 MCP 的 AI 客户端（opencode / Codex / Claude Desktop 等）直接操控它生成演示。

## 安装

```bash
cd tools
npm install
```

## 注册（以 opencode 为例，~/.config/opencode/opencode.jsonc）

```jsonc
"mcp": {
  "jimuchang": {
    "type": "local",
    "command": ["node", "/绝对路径/tools/jimuchang-mcp"],
    "enabled": true
  }
}
```

## 使用前提

积木剧场正在运行，并在「设置 → 高级」手动开启本地 AI 接口（`127.0.0.1:17800`，令牌在 `~/.config/jimuchang/api.json`）。

## 常用能力

- 项目/章节/元素读写，章节流程 `jc_set_chapter_flow`；
- 素材区查询、重命名、删除、单/批量上传；
- 用素材直接创建舞台元素 `jc_add_element_from_resource`；
- 播放、截图、导出 HTML。

API 返回 `ok:false` 或 HTTP 非 2xx 时，MCP 会返回工具错误，不再把失败包装成成功。
