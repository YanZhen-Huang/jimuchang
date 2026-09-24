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

积木剧场正在运行（API 自动开启于 127.0.0.1:17800，令牌在 ~/.config/jimuchang/api.json）。
