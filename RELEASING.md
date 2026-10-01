# 发布清单（RELEASING）

把本插件挂到 DSH 插件市场。`dshmarket` 里的列表来自索引仓库
[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)，插件本体**通过 GitHub 分发**——
`dshmarket` 原生支持 `github:` 源，因此**不必发布 npm**。

## 0. 前置检查

- [x] `package.json` 声明了 `dsh.bundle`（索引会校验；只有 `dsh.client` 不算可安装）
- [x] 仓库已有 ≥10 个提交（见 `git log`）
- [x] GitHub 仓库已建（`mcf171/dsh-session-delete`），并添加了 `dsh-plugin` topic
- [x] `package.json` 的 `repository` 与实际仓库一致
- [ ] 仓库存在满 1 天：创建于 **2026-10-01 18:52（北京时间）**，因此 **2026-10-02 18:52 之后**才能提交索引

## 1. 推到 GitHub

```bash
git remote add origin https://github.com/mcf171/dsh-session-delete.git
git branch -M main
git push -u origin main
```

建完仓库到仓库主页右侧的 **About → 齿轮 ⚙ → Topics** 里加上 `dsh-plugin`（新版 GitHub 不在 Settings 页面）。

## 2. 发布到 npm（可选，本插件未采用）

只用 GitHub 也完全可以安装：`dshmarket` 会以 `github:mcf171/dsh-session-delete` 拉取整个仓库。
npm 的好处只是安装更快、能挑语义化版本。

若要发布（npm 现在要求 2FA，需要 OTP 或勾了 "Bypass 2FA" 的 granular token）：

```bash
npm login
npm publish --access public
```

- 包名是 scoped 的 `@mcf171/dsh-session-delete`，**必须带 `--access public`**，否则会发成私有包。
- 无 scope 的 `dsh-session-delete` 已被他人占用，不要改回该名字。
- 以后每次发版：改 `package.json` 的 `version` → `npm publish`。

## 3. 提交到市场索引

1. Fork [awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
2. 新建 `data/plugins/mcf171__dsh-session-delete.yml`（内容与本仓库 `data/plugins/` 下的草稿一致）：

   ```yaml
   url: https://github.com/mcf171/dsh-session-delete
   name: mcf171/dsh-session-delete
   category: ui
   description:
     en: Delete a session permanently from the DeepSeek Harness sidebar, with a confirmation and a running-turn guard.
     zh: 在 DeepSeek Harness 侧边栏永久删除会话，带二次确认与运行中守卫。
   ```

3. 在索引仓库里运行 `node scripts/generate-readme.mjs`，把生成的 README 改动一并提交
4. 提 PR（一个插件一个文件，PR 之间不会冲突）

## 索引的自动校验项

| 项 | 本仓库状态 |
|---|---|
| `dsh.bundle` manifest | 有（`cordis.patch.yml`） |
| 仓库年龄 ≥1 天、提交 ≥10 次 | 13 个提交；仓库创建于 2026-10-01 18:52 |
| `dsh-plugin` topic | 已添加 |
| 索引文件位置 | `data/plugins/<owner>__<repo>.yml` |

## 4. PR 文案（可直接粘贴）

**标题**

```
Add mcf171/dsh-session-delete
```

**正文**

```markdown
Adds the session-delete plugin to the index.

- Repo: https://github.com/mcf171/dsh-session-delete
- Category: `ui`
- Declares `dsh.bundle.patch` in `package.json`
- Carries the `dsh-plugin` topic
- 13 commits; repository created 2026-10-01

### What it adds

A "Delete session" entry in the session row menu that permanently removes a
session: it archives the id (the shipped durable hide), removes the session's
JSONL log directory, and relays `api-session/removed` so the row leaves the
sidebar immediately — no restart needed. Deleting the same session twice is
idempotent, and a session whose agent is mid-turn is refused with a notice.

### Note on the name

`dsh-session-delete` on npm belongs to another author. This plugin lives under
the `@mcf171` scope and installs from this repository
(`github:mcf171/dsh-session-delete`).
```
