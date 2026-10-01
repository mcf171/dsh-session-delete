# @mcf171/dsh-session-delete

给 DeepSeek Harness（`dsh`）Web GUI 补上**永久删除会话**的动作。

官方 0.2.x 的会话行菜单只有 rename / fork / pin / archive，没有删除；这个插件加一项「删除会话」：确认后归档该会话、移除它的日志目录，并让那一行立刻从侧边栏消失。

零编译：`lib/` 里是手写 JavaScript（host 端是 Cordis 插件，client 端是 `__ModuleLoader__` 客户端包），改完文件重启 DSH 即生效。

## 结构

| 文件 | 作用 |
|---|---|
| `lib/index.js` | host 端插件：注册同源路由 `POST /_dsh/dsh-session-delete/delete`，依次执行「归档 → 删日志目录 → 广播 `api-session/removed`」 |
| `lib/client.js` | client 端包：注册 `sidebar.workspaces.session.menu.item` 菜单项「删除会话」+ 运行中守卫 + 确认框 |
| `cordis.patch.yml` | bundle patch：声明 host 插件行（由 profile 的 `dsh.profile.bundles` 自动应用） |
| `test/format-check.mjs` | 自测：路径算法是否与本机真实会话目录吻合 |
| `test/client-check.mjs` | 自测：client 端的加载、注册、渲染、点击（取消/确认/运行中）全流程 |

## 行为

一次删除按固定顺序做三件事，顺序不能换：

1. **先归档**（`workspaceRegistry.archiveSession(id)`）——这是官方**持久化**的隐藏机制：主列表不再显示该会话，**后续任何列表刷新都不会把它带回来**。它同时自带活动检查，正在跑回合的会话会被拒绝（提示「该会话正在运行，请先停止后再删除」）。
   必须先归档：`archiveSession` 会检查会话是否仍然"已知"，日志删掉之后再归档会抛 `WorkspaceUnknownSessionError`。
2. **再删日志目录**（`<DSH_HOME>/sessions/<projectKey(cwd)>/<sessionId>/`）；目录已不存在时跳过，因此**重复删除是幂等的**，不会报错。
3. **广播 `api-session/removed`**——复用官方 `session/disposed → api-session/removed` 那条中继，client 收到后立刻把该行从 UI 移除。

- **内存残留**：`SessionStore`（`ctx.sessions`）只有 create/prepare/enter/announce/flush/get/list/fork，**没有移除**；`enter()` 虽然返回"含 store removal 的 detach disposer"，但只接受尚未入册的会话。所以打开过的会话对象会常驻到进程重启。这不影响使用——行已移除（归档 + 广播双重生效），也没有写入会去碰已删的日志。
- **不要调 `sessions.refresh()`**：列表 = 持久化扫描 + **内存中的活会话**，删除后立刻刷新会把刚移除的行重新加回来。清理靠归档与广播，不靠刷新。

## 安装（挂到某个 profile）

以 profile `web`（`<DSH_HOME>\profiles\web`）为例：

1. **把包放进 profile 的 node_modules**（scoped 包位于 `@<scope>\` 子目录下）。复制最稳妥：

   ```powershell
   $dest = '<DSH_HOME>\profiles\web\node_modules\@mcf171\dsh-session-delete'
   New-Item -ItemType Directory -Path (Split-Path $dest) -Force | Out-Null
   Copy-Item '<本目录>' $dest -Recurse -Force
   Remove-Item "$dest\.git" -Recurse -Force -ErrorAction SilentlyContinue
   ```

   也可以用目录链接（改源码即时生效、不用重复复制）：

   ```powershell
   New-Item -ItemType Junction -Path $dest -Target '<本目录>'
   ```

   但**部分 Windows 环境会拒绝在该位置创建链接**（`Access denied`，`mklink /J` 同样失败）——遇到就退回复制，代价是改完代码要重新复制一次再重启。

2. **登记依赖 + bundle**（`<DSH_HOME>\profiles\web\package.json`）：

   ```jsonc
   {
     "dependencies": {
       "@mcf171/dsh-session-delete": "link:<本目录的绝对路径>"
     },
     "dsh": {
       "profile": {
         "bundles": [
           // …已有项…
           "@mcf171/dsh-session-delete"
         ]
       }
     }
   }
   ```

   bundle-patch 型插件**只登记 `bundles`**，不要再在 profile 的 `cordis.patch.yml` 里写同名 `insert` 行（重复挂载会导致插件重复注册、整个插件树加载失败）。

3. **重启 DSH**（host 插件代码只在启动时加载）。

## 卸载

从 profile 的 `dsh.profile.bundles` 移除 `@mcf171/dsh-session-delete`，再删除 `node_modules\@mcf171\dsh-session-delete` 即可。

## 维护提示

- **`pnpm install` / 插件市场重装可能清掉 profile 里的这份拷贝**（它不在 lockfile 的解析结果里）。若重启后菜单项消失，按上面的「安装」重做第 1、2 步即可。
- **升级 DSH 后先确认插件仍在**：重启后菜单里有没有「删除会话」；没有就重新挂载。
- 删除目标目录的算法必须与 `@deepseek-ai/dsh-session-persistence-jsonl` 的 `format.ts`（`projectKey` / `encodeSegment`）保持一致。升级后如怀疑路径规则变了，先跑自测：

  ```powershell
  node test/format-check.mjs      # 路径算法 vs 本机真实目录
  node test/client-check.mjs      # 客户端全流程
  ```

- 插件只删**日志目录**；workspace 归属里可能留下已删会话的死 id，这是无害的垃圾数据（会话列表的成员来自持久化扫描 + 内存会话，不读它）。

## 相关

- 重启脚本：`<DSH 工作区>\restart-dsh-020.ps1`（等待全部会话空闲后停服重建启动，启动失败自动回滚 profile）。
- DSH web 的授权栅栏：根路径无 token 返回 401，启动日志里会打印 `?token=…`；验证插件请用带 token 的请求。
