# messenger-copy — 旧版原型（归档）

Unofficial learning workspace that mirrors assets, shaders, and scene structure from [**Messenger**](https://messenger.abeto.co/) by [abeto](https://abeto.co/).

> **Disclaimer:** This is not the real game. It is a local, AI-assisted rebuild for study only. All original art, audio, and design remain the property of their respective owners. See [ATTRIBUTION.md](../ATTRIBUTION.md).

本文描述的是 `/prototype` 下的旧版简化场景；当前首页和原版集成说明见 [README](../README.md)。

## What this is

- A SvelteKit + Three.js project entrance: walk to the cottage and click to open the blog
- The original **Intro**, **Gameplay**, and **NPC** previews remain at `/preview`
- Downloaded reference bundles under `reference/messenger.abeto.co/`
- Ported/simplified GLSL materials, Draco loaders, and post-processing experiments

## License

- **Repository code** (`src/`, scripts, config): [MIT](../LICENSE)
- **Reference assets** (`reference/`, `static/messenger`): belong to the original Messenger project — do not redistribute without permission

## Develop

```sh
pnpm install
pnpm dev
```

Open [http://localhost:5173/prototype](http://localhost:5173/prototype).

## 项目入口

旧版原型直接进入可操作的星球场景。角色出生在小屋附近，使用 **WASD / 方向键** 或点击附近地面移动；手机上长按方向按钮移动。靠近小屋旁的光圈后，点击「访问博客」会在当前标签页打开 **https://blog.zhihaojiang.com**，单纯走进区域不会跳转。

入口集中在 `src/lib/messenger/portalConfig.ts`：

```ts
{
  id: 'blog',
  title: '博客',
  description: '记录想法，分享日常。',
  url: 'https://blog.zhihaojiang.com',
  direction: [-0.40617493, -0.2838886, 0.86857883],
  radius: 0.55,
  openInNewTab: false
}
```

- `url`：完整的 HTTP(S) 网址；`openInNewTab: true` 表示新标签页打开。
- `direction`：从原始星球中心指向区域的方向，运行时会归一化并贴到地表。访问 `/prototype?debug`，走到目标地面后可复制右上角的「角色方向」。不要选屋顶、墙壁或陡坡。
- `radius`：允许点击入口的三维距离，使用缩放后的场景单位；光圈大小会随之调整。
- 添加入口时在数组中追加配置并使用不同的 `id`；重叠区域优先激活距离最近的入口。角色默认出生在第一个入口附近。

`createGameplayController.ts` 负责球面移动、地表检测、镜头跟随与接近判断；`PortalHud.svelte` 负责入口和触屏按钮；`createPlayer.ts` 是独立生成的小信使模型。移动使用轻量地表检测，限制陡坡和高度突变；点击地面会尝试直线行走，遇到障碍会停下，没有自动绕路。此版本没有复刻原游戏完整物理、人物动画及任务系统。

若 WebGL 或资源加载失败，页面会显示博客的普通链接作为备用入口。

### 验证

```sh
pnpm check
pnpm exec vitest run --project server
pnpm build

# 启动开发服务器后执行浏览器验证，需先安装 Playwright Chromium
pnpm exec playwright install chromium
node scripts/verify-portal.mjs http://localhost:5173/prototype
# 或使用本机已安装的 Chrome
PLAYWRIGHT_CHANNEL=chrome node scripts/verify-portal.mjs http://localhost:5173/prototype
```

浏览器验证覆盖移动、点击地面、进入/离开范围、重置、失焦停止、显式跳转、手机触控和 WebGL 失败回退，截图保存在 `artifacts/`。测试会拦截博客请求，不实际访问外部站点。

### Reference tooling

```sh
pnpm reference:discover   # find asset URLs from bundles
pnpm reference:download   # fetch missing reference files
pnpm reference:shaders    # extract GLSL from JS bundles
```

## Stack

- SvelteKit 2 / Svelte 5
- Three.js r184
- TypeScript, Tailwind CSS, Vitest
