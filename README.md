# Messenger project entrance

首页现在运行 [Messenger](https://messenger.abeto.co/) 原站已发布的前端脚本和本地资源，保留原版人物、骨骼动画、20 个 NPC、地形、天空、阴影、描边、对话和控制方式。它不再使用之前手工重写的 Three.js 简化场景。

本地副本使用原引擎的 **单人模式**，不连接原作的多人服务器。进入场景后，靠近小屋旁会出现博客入口，点击后在新标签页打开 **https://blog.zhihaojiang.com**。主广场带卫星天线的书店旁另有一个个人分身入口，靠近后显示「访问个人分身 ↗」，点击后在新标签页打开 **https://second-me.zhihaojiang.com/**。

## 运行

```sh
pnpm install
pnpm dev
```

访问终端显示的本地地址，点击原版 **BEGIN**，完成开场对话后即可行走。开场和对话按钮绘制在 3D 画布中。

```sh
pnpm check
pnpm build
pnpm preview
```

`dev` 和 `build` 会自动运行 `scripts/prepare-original.mjs`，从 `reference/messenger.abeto.co/assets` 生成 `static/original`。生成目录已加入 `.gitignore`，不要直接编辑其中的文件。现有版本所需资源已保存在仓库，生成和浏览不需要从原站拉取资源。

## 配置博客入口

修改 `src/lib/original/portals.json`，然后重启开发服务器或重新构建：

```json
{
  "id": "blog",
  "title": "博客",
  "location": "小屋旁",
  "url": "https://blog.zhihaojiang.com",
  "direction": [-0.40617493, -0.2838886, 0.86857883],
  "radius": 2.5,
  "openInNewTab": true
}
```

- `direction`：从原版星球中心指向入口的方向。运行时使用原版碰撞网格找到地面。访问 `/?debug`，可查看角色当前方向。
- `radius`：原版世界单位下的三维触发距离；与旧简化场景的缩放坐标不同。
- `openInNewTab`：`false` 表示在整个页面中跳转，`true` 表示新标签页。
- 可以追加多个入口；重叠区域优先显示最近的一个。对话和换装期间隐藏入口。

`src/lib/original/portal.ts` 和 `portal.css` 是独立的入口覆盖层。原版引擎运行在**同源本地 iframe** 中，不是远程嵌入原网站。首页不会再调用旧的占位人物、简化着色器或自制移动控制器。

## 修改中文对话

直接编辑 [`src/lib/original/dialogues.json`](./src/lib/original/dialogues.json)：`intro` 是开场，`npcs` 是人物名称和闲聊，`quests` 是分步骤的任务对白。当前已提供中文文案，英文对照保存在 [`docs/dialogues.original.json`](./docs/dialogues.original.json)。

开发时保存后运行 `pnpm original:prepare` 并刷新，或重启 `pnpm dev`；预览模式需要重新构建。详细示例、NPC ID 对照和存档说明见 [自定义中文对话](./docs/dialogues.md)。原版菜单、任务提示和地图文字尚未汉化。

## 原版集成范围

固定版本入口为 `webgl-C4v7tvuW.js`，引擎为 `App3D-BLRWK1h9.js`。准备脚本只进行有数量校验的局部替换：

1. 把资源和 Worker 地址改成本地 `/original/`，修正开场粒子资源路径中的重复斜杠。
2. 设置原引擎资源根路径，开启内置单人模式，并修复单人模式下两处联机调用缺少空值判断的问题。
3. 暴露用于读取场景和角色位置的集成接口。
4. 独立命名本地存档，加载项目入口覆盖层。
5. 从 `dialogues.json` 应用中文对白，使用支持中文的 DOM 对话框和头顶气泡，保留原版对话事件与任务状态机。

没有重写场景的材质、动画、物理或镜头；对白文字显示层已替换以支持中文。`static/original/source-manifest.json` 记录准备时的源资源及 SHA-256；升级原站脚本时，补丁匹配失败会中止构建，避免静默破坏入口。

这恢复的是当前保存版本的单人前端体验。多人联机需要另外部署兼容服务器；不包含原作者未公开的工程源码，也不承诺与原网站未来更新自动同步。

旧版本仅供比较：`/prototype` 是之前的简化博客入口，`/preview` 是学习性场景预览，说明见 `docs/prototype.md`。

## 部署到 Cloudflare Pages

```sh
pnpm deploy
```

也可运行 `npm run deploy`。命令会先构建（包括准备和检查手机资源），再使用 `wrangler.jsonc` 中的 Pages 项目名与输出目录上传。首次使用时按 Wrangler 提示登录 Cloudflare；登录账户需要有对应项目的部署权限。

## 验证

构建并启动预览后运行：

```sh
PLAYWRIGHT_CHANNEL=chrome node scripts/verify-original.mjs http://127.0.0.1:4173
```

也可不设 `PLAYWRIGHT_CHANNEL`，使用 Playwright 安装的 Chromium。验证包含原版进入场景、人物行走、NPC 和骨骼加载、桌面/手机入口、区域进出及顶层跳转。测试拦截所有外部请求，不访问博客或多人服务；截图保存在 `artifacts/`。

iPhone Safari 还需要单独验证 WebKit 及其资源分支：

```sh
pnpm exec playwright install webkit
node scripts/verify-safari.mjs http://127.0.0.1:4173
```

此检查使用 iPhone 13 的 UA、屏幕参数和触摸操作，确认进入游戏并显示开场对白，同时检查低内存模型和 MP3 音频确实被请求。桌面浏览器仅缩小视口不会触发这些分支。`prepare-original.mjs` 会检查 36 个手机专用 Draco 模型及 OGG 对应的 Safari MP3 文件；缺失时中止构建。这些资源随 `reference/messenger.abeto.co/assets` 一同保存和部署，无需运行时访问原站。WebKit 模拟不能替代真机最终验收。

## 来源与许可

原版脚本、艺术、模型、音频和设计来自 **abeto / Messenger**，保留原作者标注；它们不因本仓库的 MIT LICENSE 而变成 MIT 授权资源。原有项目的来源说明见 [ATTRIBUTION.md](./ATTRIBUTION.md)。本仓库自己的集成代码遵循 [LICENSE](./LICENSE)。
