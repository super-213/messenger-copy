# Messenger project entrance

首页现在运行 [Messenger](https://messenger.abeto.co/) 原站已发布的前端脚本和本地资源，保留原版人物、骨骼动画、20 个 NPC、地形、天空、阴影、描边、对话和控制方式。它不再使用之前手工重写的 Three.js 简化场景。

本地副本使用原引擎的 **单人模式**，不连接原作的多人服务器。进入场景后，靠近小屋旁会出现博客入口，点击后访问 **https://blog.zhihaojiang.com**。主广场带卫星天线的书店旁另有一个个人分身入口，靠近后显示「访问个人分身 ↗」，点击后访问 **https://second-me.zhihaojiang.com/**。普通浏览器中会打开新标签页；安装的 PWA 中通过顶层页面导航访问外部网站，由系统决定显示浏览器还是应用内浏览窗口。

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

## PWA 安装与离线使用

生产构建支持 PWA：在 HTTPS 网站（本地可用 `localhost` / `127.0.0.1`）打开首页后，Chrome / Edge 可从浏览器菜单安装应用；iPhone / iPad Safari 可用「分享 → 添加到主屏幕」。安装后以独立窗口打开。

首次联网访问会缓存首页、应用脚本、原版游戏 iframe 及全部桌面和手机游戏资源，约 36 MB，包含模型、音频和 Web Worker。缓存完成后，可以断网重新打开首页、进入场景和游玩；不需要先玩遍各个场景。首次下载尚未完成时无法保证离线加载。外部博客和个人分身链接仍需网络；旧的 `/preview`、`/prototype` 比较页面不在离线支持范围内。

每次构建使用独立缓存。新版本下载完成后会等待旧页面和应用窗口全部关闭，再在下次打开时接管；更新不会中断当前游戏，激活时只清理本应用的旧缓存。游戏存档仍保存在原有的 `localStorage` 中。缓存下载失败时不会激活不完整的版本，下次联网访问会重试。

首页通过 `pwa-register.js` 注册 Service Worker，无需下载 Svelte 客户端运行时；注册仅在生产构建中启用，开发服务器不会安装。先执行 `pnpm build`，在另一个终端启动 `pnpm preview`，随后运行浏览器检查：

```sh
pnpm build
PLAYWRIGHT_CHANNEL=chrome pnpm test:pwa
```

也可省略 `PLAYWRIGHT_CHANNEL`，使用已安装的 Playwright Chromium。测试检查浏览器安装条件、图标尺寸、全部游戏资源的预缓存、旧缓存清理，并在桌面和 iPhone 配置下断网新开页面、进入游戏及显示开场对白。可在 Chrome DevTools → Application → Service Workers 查看激活状态，在 Cache Storage 查看 `messenger-pwa-*` 缓存。

图标源文件为 `src/lib/assets/favicon.svg`，修改后运行 `PLAYWRIGHT_CHANNEL=chrome pnpm pwa:icons` 重新生成 `static/icons/` 中的 PNG，并提交这些文件。普通构建直接使用已生成的图标，无需运行浏览器。根目录 `_headers` 为 Cloudflare Pages 配置 Service Worker 和 Manifest 的重新验证策略。

## 首页与 BEGIN 启动性能

首页在构建时预渲染，直接输出 `/original/` iframe；不再等待 Svelte 客户端初始化，也不经过 Cloudflare 对 `/original/index.html` 的重定向。首页的 PWA 注册由独立小脚本完成；`/?debug` 仍显示游戏内方向坐标。

开场场景就绪后，`startup.ts` 根据引擎的低内存设备标志，提前获取主场景模型、纹理和 Worker 文件，每次最多两个请求。只下载压缩文件，不创建第二套场景，不提前解压或上传显存。页面隐藏时暂停新请求，省流量模式下跳过；已有完整 PWA 缓存时也会跳过。点击 BEGIN 后停止新增预取请求，已经在途的请求允许完成；预取失败不会阻止原引擎按需加载。

BEGIN 的退场遮罩缩短到约 0.3 秒，主场景揭幕约 0.5 秒，首次镜头入场约 0.65 秒，镜头后的对白停顿约 0.15 秒。低内存设备原有的 0.35 秒场景释放等待保留，系统「减少动态效果」开启时使用极短过渡。这些是动画时长，实际加载仍取决于网络和设备处理模型的速度。

构建并启动预览后，可运行专项验证：

```sh
PLAYWRIGHT_CHANNEL=chrome pnpm test:startup
```

此检查确认初始 HTML 已包含 iframe、预取发生在 BEGIN 前且只获取对应设备的地形、不提前创建主场景、预取失败仍可进入游戏，并验证对白和键盘行走。终端会打印本机的启动分段耗时；这些数据不能当作真机或线上网络的性能承诺。

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
- `openInNewTab`：普通浏览器中，`false` 表示在整个页面中跳转，`true` 表示新标签页。PWA 独立窗口（包括 iOS 主屏幕应用）统一通过顶层页面导航访问，避免依赖 iframe 创建新窗口。
- 可以追加多个入口；重叠区域优先显示最近的一个。对话和换装期间隐藏入口。

`src/lib/original/portal.ts` 和 `portal.css` 是独立的入口覆盖层。原版引擎运行在**同源本地 iframe** 中，不是远程嵌入原网站。首页不会再调用旧的占位人物、简化着色器或自制移动控制器。

## 建筑入口详情与面板动效

靠近小屋、书店或咖啡店后，底部入口保留直接访问链接；点击「了解更多」展开建筑详情，显示简介、标签和目标域名。点击关闭、按 Esc、点击浮层外或离开触发范围可收起详情；进入 NPC 对话、页面隐藏和页面离开时也会收起。Esc / 关闭按钮会把焦点交还给「了解更多」。

在 `src/lib/original/portals.json` 中为入口设置可选的 `description`（简介）和 `tags`（字符串数组）。未提供时使用默认简介并隐藏标签。保存后运行 `pnpm original:prepare` 并刷新，生产环境需要重新构建。

支持的浏览器使用原生 Popover 与桌面 CSS 锚点定位；其他浏览器使用固定定位浮层。展开 / 收起使用短淡入与位移动画，打开详情期间切换到另一建筑时，支持的浏览器使用 View Transitions 过渡文字区域，不给 3D 画布设置快照名称。系统「减少动态效果」开启时禁用这些动画。

## 本地卡顿测量

首页加 `?perf` 可查看本地性能面板（`?debug` 同时显示坐标与性能）。面板展示 ≥50ms 的长帧次数、最长时长，并提供「重新测量」和 JSON 导出。普通访问不显示面板，仍在内存中保留最近最多 120 条样本与 120 条交互标记；刷新即清空，不自动上传或写入存档。

支持 Long Animation Frames API 时记录长帧、主线程阻塞时长及浏览器提供的脚本归因；否则基于现有动画循环记录帧间隔，标为「帧间隔估算」，不伪装成主线程阻塞数据。隐藏 / 恢复页面会重置帧间隔基准，恢复时不会重新读取旧的 LoAF 缓冲。LoAF 不是 GPU 分析器，50ms 阈值也不能覆盖所有 60/120Hz 掉帧。

在开发者工具选择 `/original/` iframe 的执行上下文后，可运行：

```js
window.__messengerPerformance.snapshot() // 当前汇总、样本与入口交互标记
window.__messengerPerformance.reset()
window.__messengerPerformance.download()
```

构建并启动 `pnpm preview` 后运行：

```sh
PLAYWRIGHT_CHANNEL=chrome pnpm test:portal-links
PORTAL_LINK_ENGINE=webkit pnpm test:portal-links
PLAYWRIGHT_CHANNEL=chrome pnpm test:performance
```

入口检查覆盖桌面 / 手机布局、全部入口详情与导航、Esc 焦点恢复、离开范围、页面恢复和无 Popover / View Transitions 的回退。性能检查通过真实主线程阻塞验证 LoAF 与帧间隔回退、导出、清零及样本上限。

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
6. 通过 `startup.ts` 预取主场景文件，并用有源代码指纹校验的启动补丁缩短过场镜头与等待时长。

场景材质、物理和角色骨骼动画来自原版，启动补丁只调整过场镜头与等待时长；对白文字显示层已替换以支持中文。`static/original/source-manifest.json` 记录准备时的源资源及 SHA-256；升级原站脚本时，补丁匹配或过场代码指纹校验失败会中止构建，避免静默破坏入口。

这恢复的是当前保存版本的单人前端体验。多人联机需要另外部署兼容服务器；不包含原作者未公开的工程源码，也不承诺与原网站未来更新自动同步。

旧版本仅供比较：`/prototype` 是之前的简化博客入口，`/preview` 是学习性场景预览，说明见 `docs/prototype.md`。

## 部署到 Cloudflare Pages

通过 Git 集成部署：提交修改后运行 `git push`，由 Cloudflare Pages 自动构建和发布。构建会准备并检查手机资源。

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

项目入口的触摸点击和 PWA 导航另有专项检查：

```sh
PLAYWRIGHT_CHANNEL=chrome pnpm test:portal-links
PORTAL_LINK_ENGINE=webkit pnpm test:portal-links
```

它会进入真实游戏，触摸点击全部项目入口，并分别模拟顶层窗口的 `display-mode: standalone` 和 iOS `navigator.standalone` 信号，确认独立窗口使用顶层导航。目标网站由本地测试响应代替，不访问外部服务。此测试不能替代 iPhone 主屏幕应用的系统浏览窗口真机验收。

## 来源与许可

原版脚本、艺术、模型、音频和设计来自 **abeto / Messenger**，保留原作者标注；它们不因本仓库的 MIT LICENSE 而变成 MIT 授权资源。原有项目的来源说明见 [ATTRIBUTION.md](./ATTRIBUTION.md)。本仓库自己的集成代码遵循 [LICENSE](./LICENSE)。
