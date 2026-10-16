# 交接说明（HANDOFF）

> 给重启后接手的我，或任何新会话：读这份 + `CHANGELOG.md` 即可接上，无需重读聊天记录。

## 这是什么

`@mcf171/dsh-session-delete` —— 给 DSH 0.2.0 Web GUI 补上「永久删除会话」的插件。

## 当前状态（2026-10-16 更新）

| 项 | 状态 |
|---|---|
| 版本 | `0.1.0`，tag `v0.1.0`（已推送） |
| GitHub | https://github.com/mcf171/dsh-session-delete —— 本地与远端同步，分支 `main` |
| **市场收录** | ✅ **已发布**：PR #6397 于 2026-10-15 由维护者 `fkysly` 合并<br>页面 https://awesome-dsh-plugin.com/p/mcf171/dsh-session-delete/<br>安装 `dsh plugin --profile web add github:mcf171/dsh-session-delete` |
| 本地源码 | `D:\dsh-plugins\dsh-session-delete\`（独立 git 仓库，**不在 workspace 内**） |
| 安装形态 | **复制**到 `D:\dsh-020-home\profiles\web\node_modules\@mcf171\dsh-session-delete`（不是链接） |
| 运行实例 | 3080，npm 模式（生产）：`python D:\DeepSeekHarness\workspace\restart-web.py` |
| 索引仓库 | `D:\dsh-plugins\awesome-dsh-plugin`（本地 clone，可删；上游已收录本插件） |

## 改完代码怎么生效

1. 同步到安装副本（复制安装，源码改动不会自动生效）：
   ```powershell
   $dest = 'D:\dsh-020-home\profiles\web\node_modules\@mcf171\dsh-session-delete'
   Copy-Item 'D:\dsh-plugins\dsh-session-delete\lib\client.js' "$dest\lib\client.js" -Force
   ```
2. 重启：`python D:\DeepSeekHarness\workspace\restart-web.py restart`
3. client 端改动：重启后还要浏览器 **Ctrl+F5**。

离线自测（不用重启）：
```powershell
cd D:\dsh-plugins\dsh-session-delete
node test/format-check.mjs      # 路径算法 vs 本机真实会话目录
node test/client-check.mjs      # 客户端全流程（渲染/点击/运行中守卫/快捷键）
```

## 待办

- [x] ~~PR #6397 合并后市场列表自动出现~~ —— 已合并（2026-10-15），市场页面已上线
- [ ] 可选：发布 npm（`npm publish --access public`；npm 现在要求 2FA，需 OTP 或勾了 "Bypass 2FA" 的 granular token）。不发布也能装：市场给的就是 `github:` 安装命令
- [ ] 可选：把安装形态从复制改回链接（`D:\dsh-plugins\` 下建 junction 曾被系统拒绝，符号链接可以）
- [ ] 可选：仓库加 badge / 截图（`screenshots.json` 放在本仓库，改它不需要再提 PR）
- [ ] 若要发新版本：改 `package.json` 的 `version` → commit → `git tag -a vX.Y.Z` → `git push --follow-tags`；索引条目**无需**改动（市场按 URL 跟踪）

## 两个必须知道的坑

1. **`dsh.client.inject` / `external` 不要引用组件库**。`@deepseek-ai/dsh-client-ui-primitives` 既没有 `dsh.client` 声明，也没有 `./client` 导出；把它写进这两处会让**整个 client entry 不激活**，而**服务端不打印任何错误**（只有浏览器控制台能看到 `web boot: 1 entry did not activate`）。
2. **`Delete` 是官方保留键**。`ShortcutRegistry` 的保留列表含 `Delete`/`Escape`/`Tab`/`Backspace`/方向键；注册它会在 `desktop:linux` 抛 `Reserved shortcut default` 并中断 `apply()`。本插件因此用原生 `keydown` 自己处理，不碰官方注册表。

## 排查"改了没反应"的正确顺序

1. **先看 profile 的 patch 层有没有禁用插件**：`D:\dsh-020-home\profiles\web\cordis.patch.yml` 里若存在
   ```yaml
   - id: session-delete
     name: '@mcf171/dsh-session-delete'
     disabled: true
   ```
   插件就永远不会挂载——**这是本次耗费最久的坑**。
2. 用它看组合后的插件树与加载诊断：
   ```powershell
   node D:\dsh-020\node_modules\@deepseek-ai\dsh\lib\bin.js --profile web --dump-config
   ```
3. 服务端 `D:\dsh-020-home\web-*.err.log` 通常是**空的**；客户端插件坏只降级浏览器侧，必须看浏览器控制台。
4. 确认安装副本存在且是**真实目录**（不是断掉的链接）。

## 关键事实

- 会话数据：`<DSH_HOME>\sessions\<projectKey>\<sessionId>\session.v4.jsonl.zstd`（0.2.0 的格式；rc.5 是 `session.jsonl.zstd`）。
- 0.2.0 每次启动换 token，裸 `http://127.0.0.1:3080` 必然 401；地址在 `D:\DeepSeekHarness\workspace\3080-url.txt`。
- 插件仓库与 workspace 互不相关：**workspace 内禁止建 `.git`**（会截断 AGENTS.md 加载链）。
