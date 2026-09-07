# 自定义中文对话

日常只需要编辑 [`src/lib/original/dialogues.json`](../src/lib/original/dialogues.json)。文件中的内容已经翻译成中文：开场、20 个 NPC 的名字与闲聊、5 条任务线的全部对白。英文原文对照保存在 [`dialogues.original.json`](./dialogues.original.json)。

## 开场

文件最上面的 `intro` 对应进入游戏时信使说的话。例如：

```json
"intro": {
  "name": "Zhihao",
  "texts": [
    "欢迎来到我的小小星球！",
    "这里是我的项目入口。走到小屋旁，可以找到我的博客。",
    "准备好了就四处逛逛吧。"
  ]
}
```

`name` 是对话框左上角的名字。`texts` 每个字符串是一页，可以增加或删减，至少保留一页。点击「继续」或按 E、空格、Enter 翻页，手机直接点按钮。使用 `\n` 可以在一页内换行。

## NPC 闲聊

`npcs` 中每个键是原版 NPC 的固定 ID。例如：

```json
"chef": {
  "name": "小店老板",
  "texts": [
    "欢迎来到我的小店。",
    "想看博客的话，去小屋旁转转吧。"
  ]
}
```

修改 `name` 和 `texts` 即可；不要更改 `chef` 等 ID。闲聊会按原版的距离、时间和任务状态自动出现。某个 NPC 正在参与任务时，会优先使用任务对白。

| NPC ID | 当前名字 |
| --- | --- |
| office-worker | 上班族（行走中的男子） |
| office-worker-2 | 公司职员 |
| chef | 店主 |
| caveman | 洞穴里的男人 |
| boss | 老板 |
| flower-lady | 卖花姑娘 |
| scout | 小女孩 |
| threekid | 黑客女孩 |
| factory-worker-a | 工厂员工 |
| factory-worker-b | 腾戈 |
| female-scientist | 弗蕾比博士 |
| factory-worker-c | 格塔夫 |
| alien | 苍白的男人 |
| male-scientist | 弗里布博士 |
| diver | 史蒂夫船长 |
| mountainman | 山中隐士 |
| oldwoman | 老奶奶 |
| musician | 音乐家戴夫 |
| fox | 狐狸 |
| owl | 猫头鹰 |

空字符串是原版中没有说话的角色。`texts: []` 也可关闭该 NPC 的普通闲聊，不会移除其任务对白。

## 任务对白

`quests` 按任务 ID 分组，每个 `steps` 元素对应一个原版任务步骤：

```json
"quest-employee": {
  "label": "职场晋升奇遇",
  "steps": [
    { "npcId": "office-worker-2", "texts": ["这是任务第一步要说的话。"] },
    { "npcId": "boss", "texts": ["这是第二步要说的话。"] },
    { "npcId": "office-worker-2", "texts": ["这是任务结束时要说的话。"] }
  ]
}
```

可以修改 `texts`、增删每一步里的句子，但每步至少保留一页。不要增删/重排 `steps` 或更改 `npcId`；这些字段对应任务触发器、物品交接和存档。构建时会检查 ID 和步骤结构。`label` 只是方便编辑时识别的备注。

五条任务线分别是 `quest-employee`、`quest-caveman`、`quest-scientists`、`quest-temple` 和 `quest-musician`。

## 使修改生效

开发时，保存 JSON 后，在项目目录运行：

```sh
pnpm original:prepare
```

然后刷新页面。也可以重启 `pnpm dev`，它会自动生成最新文案。

使用构建预览时，停止旧预览并重新运行：

```sh
pnpm build
pnpm preview
```

开场是否播放、NPC 说哪一段话受游戏存档影响。测试使用浏览器无痕窗口最方便。如果要重置当前浏览器的游戏存档，可以在控制台执行以下命令；它会清除这个本地站点的游戏进度和外观存档：

```js
localStorage.removeItem('Messenger_local_data');
location.reload();
```

## 实现与范围

原文在 `reference/messenger.abeto.co/assets/App3D-BLRWK1h9.js` 的 `introData`、`introTexts`、NPC 配置和 `questData` 中。不要直接改这个压缩脚本，也不要编辑自动生成的 `static/original`。

`scripts/localize-dialogues.mjs` 用 TypeScript 语法树定位文案，只替换对应的数据字段；`prepare-original.mjs` 在开发/构建前应用配置。原版英文字体是预生成的专用字形，不能直接显示任意汉字，因此 `src/lib/original/dialogue-ui.ts` / `dialogue-ui.css` 使用系统中文字体显示对话框和头顶气泡，并接入原版对话事件。正文按整页显示，继续按钮仍驱动原版任务状态机；NPC 动画、物品和进度由原引擎处理。文案以纯文本显示，不执行 HTML。

此次汉化范围是**人物姓名、开场、普通闲聊和任务对白**。地图上的模型文字、菜单、任务清单、任务完成提示等原版 UI 仍为英文。

验证命令：

```sh
node --test scripts/localize-dialogues.test.mjs
pnpm check
pnpm build
# 启动预览后，测试中文开场、闲聊、真实 NPC 点击及完整任务推进
PLAYWRIGHT_CHANNEL=chrome node scripts/verify-original.mjs http://127.0.0.1:4173
```
