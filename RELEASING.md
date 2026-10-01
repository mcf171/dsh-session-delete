# 发布清单（RELEASING）

三步把本插件挂到 DSH 插件市场。`dshmarket` 里的列表来自索引仓库
[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)，插件本体则通过 npm（或 GitHub）分发。

## 0. 前置检查

- [x] `package.json` 声明了 `dsh.bundle`（索引会校验；只有 `dsh.client` 不算可安装）
- [x] 仓库已有 ≥10 个提交（见 `git log`）
- [ ] 仓库存在满 1 天（新仓库需等一天后才能提交索引）
- [ ] GitHub 仓库已建，并添加 `dsh-plugin` topic
- [ ] `package.json` 的 `repository` 与实际仓库一致（当前：`mcf171/dsh-session-delete`）

## 1. 推到 GitHub

```bash
git remote add origin https://github.com/mcf171/dsh-session-delete.git
git branch -M main
git push -u origin main
```

建完仓库到 **Settings → Topics** 加上 `dsh-plugin`。

## 2. 发布到 npm（推荐）

市场的一键安装走 npm；不发 npm 也可以，但用户得自己从 GitHub 安装。

```bash
npm login
npm publish --access public
```

- `dsh-session-delete` 若已被占用，改用 `@mcf171/dsh-session-delete`，并**同步修改两处**：
  `package.json` 的 `name`、`cordis.patch.yml` 里的 `name`。
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
| 仓库年龄 ≥1 天、提交 ≥10 次 | 见 `git log` |
| `dsh-plugin` topic | 推送后到仓库设置添加 |
| 索引文件位置 | `data/plugins/<owner>__<repo>.yml` |
