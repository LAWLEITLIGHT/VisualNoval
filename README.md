# Visual Novel by白桃

由酒馆正则 `vn_visual_novel-by白桃.json`（脚本名 **Visual Novel v9.25-by白桃**）重构而来的**酒馆助手脚本工程**，采用"导入一次、之后从 GitHub 自动更新"的形态。

## 它是什么

原版是一条 SillyTavern 正则：匹配 AI 输出里的 `<content>…</content>`，替换成一个自包含的"视觉小说阅读器 + 手机 UI"前端应用（液态玻璃风格 launcher 卡片 + ~263KB 应用脚本，通过 `SillyTavern.getContext()` 读取聊天 / 角色卡 / 世界书）。

本仓库把这条正则拆成可维护的模块化源码，并提供一个小巧的**酒馆助手自动更新 loader**：用户在酒馆里导入一次 loader 脚本，之后每次启动会从本仓库拉取最新正则并装入全局正则，作者更新代码 push 后用户端自动更新。

## 目录结构

```text
.
├── app/
│   ├── src/                                源码（可维护单元）
│   │   ├── launcher.html                   launcher 卡片 DOM
│   │   ├── launcher.css                    launcher 卡片样式
│   │   ├── app.js                          视觉小说主应用逻辑（147 个函数）
│   │   ├── _assembly.json                  拼装边界元数据（保证字节一致）
│   │   └── _regex-meta.json                正则元数据（id/name/placement 等）
│   ├── scripts/
│   │   ├── build.js                        拼回 replaceString → dist 正则 JSON
│   │   ├── build-loader.js                 包装 loader → 可导入酒馆助手脚本 JSON
│   │   └── verify.js                       校验拼回结果与原版字节一致
│   ├── fixtures/original.json              原始正则（本地校验用，git 忽略）
│   ├── dist/                               构建产物
│   │   ├── vn_visual_novel-by白桃.json  组装好的正则（loader 拉取目标）
│   │   └── manifest.json
│   └── package.json
├── loader/
│   ├── vn-loader.js                        自动更新 loader 源码
│   ├── vn-loader.json                      固定名导入件
│   └── 酒馆助手脚本-Visual Novel by白桃（自动更新）.json
└── README.md
```

## 构建

```bash
cd app
npm run build          # src → dist 正则 JSON（与原版字节一致）
npm run build:loader   # 生成可导入酒馆的 loader 脚本 JSON
npm run verify         # 校验 round-trip 字节一致
npm run gate           # build + build:loader + verify 一条龙
```

> `build-loader` 的仓库名取自环境变量 `VNLG_REPO` 或 `app/package.json` 的 `repository` 字段。
> 改仓库后用 `VNLG_REPO=owner/repo npm run build:loader` 重新生成 loader。

## 安装（用户侧）

本仓库提供**三种**安装形态，按需选其一：

### 形态 C — SillyTavern 扩展（脱离正则，可用 Git URL 一键安装）⭐ 新

不依赖 AI 输出里的 `<content>…</content>`。安装后扩展菜单出现 **Visual Novel** 入口，点击即把最近一条 AI 消息渲染成视觉小说：消息里有 `<content>` 就取其中内容，没有就取整条消息文本。

安装：SillyTavern → 扩展(Extensions) → **Install extension** → 输入 Git URL：

```
https://github.com/LAWLEITLIGHT/VisualNoval
```

分支留空(默认 main)即可，选「只给我安装」或「给所有人安装」。仓库根的 `manifest.json` 会被识别为第三方扩展。

> 说明：扩展版复用了正则版的阅读器主逻辑；图片绑定(st-chatu8 / chami 等逐图位功能)依赖每条消息的 iframe 环境，扩展全局模式下可能降级，但**正文→视觉小说**的核心转换不受影响。

### 形态 A — 酒馆助手脚本（自动更新）

在酒馆助手「脚本」里导入 `loader/酒馆助手脚本-Visual Novel by白桃（自动更新）.json`，启用后会自动拉取并安装最新正则。

### 形态 B — 手动正则

直接把 `app/dist/vn_visual_novel-by白桃.json` 作为普通正则导入 SillyTavern（无自动更新）。

## 修改流程

1. 只改 `app/src/` 下的源码（`app.js` / `launcher.css` / `launcher.html`）。
2. `cd app && npm run gate` 确认 round-trip 通过。
3. 提交并 push；用户端 loader 下次启动自动更新。

## 来源

- 原始正则：`vn_visual_novel-by白桃.json`（Visual Novel v9.25-by白桃）
- 自动更新架构参考：[xiagaogaozi/Visual-Novel](https://github.com/xiagaogaozi/Visual-Novel) 的 loader 形态
- 酒馆助手接口：[JS-Slash-Runner](https://github.com/n0vi028/JS-Slash-Runner) `@types`

## License

MIT
