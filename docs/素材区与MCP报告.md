# 素材区与 MCP / AI 增强报告

日期：2026-10-18

## 1. 素材区

素材仍然保存在项目的 `resources` 数组中，随 `.bdp` 一起打包，不建立独立素材库。

新增能力：

- 工具栏「素材」打开右侧覆盖式抽屉，不改变舞台尺寸；
- 自动识别图片、音频、视频、3D 模型、HTML 网页；
- 搜索、类型筛选、名称、大小、缩略图；
- 多文件导入、改名、删除；
- 拖到舞台或双击直接创建元素；
- 删除前检查元素、舞台背景、章节背景、背景音乐的引用；
- 资源 zip 路径改为 `resources/<id><ext>`，不再直接拼接原文件名。

主要文件：

- `web/js/asset-hub.js`
- `web/js/project.js`
- `web/css/app.css`
- `web/index.html`

## 2. AI 能力

- AI 请求会附带当前素材清单：名称、id、类型、大小；
- AI DSL 新增：

```json
{"cmd":"asset","name":"Logo","resource":"logo.png","x":700,"y":300,"w":520,"h":320}
```

- AI 生成会重建章节和元素，但保留素材区；
- 文件不存在或类型不支持时跳过并给出警告，不编造素材路径；
- 结果显示章节数、元素数、复用素材数和被跳过的引用。

## 3. MCP 优化

### 3.1 错误处理

旧版即使 API 返回 `ok:false` 仍会显示为工具成功。现在：

- HTTP 非 2xx；
- 响应不是 JSON；
- JSON 中 `ok:false`；

都会转换成真正的 MCP 工具错误。

### 3.2 新工具

- `jc_list_chapters` / `jc_add_chapter` / `jc_update_chapter` / `jc_delete_chapter`
- `jc_set_chapter_flow`
- `jc_list_resources` / `jc_get_resource`
- `jc_rename_resource` / `jc_delete_resource`
- `jc_upload_resources`
- `jc_add_element_from_resource`

旧 `jc_*_scene` 工具保留为兼容别名。

当前 MCP 共发现 **35 个工具**。

## 4. 验证

- `node tools/check-mcp.js`：35 工具，8/8 必需工具发现通过；
- 真实 MCP 端到端：状态 → 素材列表 → 上传图片 → 从素材建元素 → 设置章节流程；
- `ASSETTEST`：渲染、插入、引用保护、删除、列表 API、筛选通过；
- `AI|PASS`：AI 生成复用素材；
- 全量 GUI 回归：21/21 通过；
- 积木自检：174/174；
- 章节流程自检：13/13。

## 5. 后续

- 素材拖拽排序与标签；
- 图片自动适配原始宽高比；
- 素材替换而非重复导入；
- MCP 批量事务接口，减少 AI 多次往返。
