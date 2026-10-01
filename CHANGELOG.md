# 更新日志

## 0.1.0 — 2026-10-01

首次发布。

### 功能

- **会话行菜单新增「删除会话」**：先归档（官方持久隐藏机制）→ 删除该会话的日志目录 → 广播 `api-session/removed`，那一行**立即**从侧边栏消失，无需重启。
- **幂等**：日志目录已不存在时跳过，重复删除不报错。
- **运行中保护**：正在跑回合的会话被拒绝，提示先停止。
- **垃圾桶图标**：官方 `IconTrashOutlineRegular` 的 artwork 逐条内联，与内置条目像素一致；危险色标注。
- **`Delete` 快捷键**：作用于当前选中的会话，走与鼠标点击**完全相同**的流程（运行中拒绝 → 确认框 → 删除）。焦点在输入框/可编辑区域时、按下带修饰键的 Delete 时、或没有选中会话时不触发。
- 文案跟随 GUI 语言（中文 / English）。

### 实现要点

- **只用官方扩展点**：插槽 `sidebar.workspaces.session.menu.item`、`workspaceRegistry.archiveSession`、`api-session/removed` 中继，以及会话列表计算运行状态点的同一信号 `agents.get(id).status === 'running'`。**不做 DOM 注入**，因此不随官方 UI 改版失效。
- **"运行中"只拦真正在跑的**：打开过但已空闲的会话依然可以删除（DOM 注入式实现常把"本次启动中活动过"一律拒绝）。
- **client 端零新增依赖**：整份 client bundle 只 `require("react")`——图标是内联 SVG，快捷键是原生 `keydown` 监听。
- **删除不经 shell**：走 `node:fs`；目标目录用持久化后端自己的 `projectKey` / `encodeSegment` 规则定位，并遵循 `DSH_HOME`（自定义 home 目录同样正确）。

### 实现中的两个坑（供后续维护参考）

- **不要把组件库写进 `dsh.client.inject` / `external`**：`dsh-client-ui-primitives` 只是组件库——它没有 `dsh.client` 声明、也没有 `./client` 导出。把它列进这两处会让整个 client entry **无法激活**（浏览器报 `web boot: 1 entry did not activate`），且服务端不打印任何错误。
- **不要给快捷键注册 `Delete`**：官方 `ShortcutRegistry` 的保留键列表包含 `Delete`（与 `Escape`/`Tab`/`Backspace`/方向键同列）。在 `desktop:linux` 上注册会抛 `Reserved shortcut default`，中断 `apply()` 并导致整个 entry 不激活。本插件因此改用原生 `keydown`，不去动官方注册表。
