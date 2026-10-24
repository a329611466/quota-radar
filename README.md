# Watermark · 额度水位

独立追踪 OpenAI Codex 使用额度重置（usage limit reset）的工具站。

视觉提供**四套可切换主题**，默认「毛毡手作」。所有样式由 CSS 变量驱动，换主题不改一行组件代码。预览见 [`docs/theme-preview.html`](docs/theme-preview.html)。

| 主题 | 特征 |
| --- | --- |
| **毛毡手作**（默认） | 燕麦色纸、缝线虚线边、陶土 / 鼠尾草 / 雾蓝低饱和、Quicksand 圆体 |
| **墨线糖果** | 奶油纸 + 2px 纯墨线 + 零模糊硬阴影 + 波点纹理、薄荷 / 紫罗兰 / 蜜桃配色、Baloo 2 粗圆体 |
| **孟菲斯玩具** | 白卡 + 3px 藏蓝粗边 + 撞色阴影（粉 / 青）、热粉 / 明黄 / 薄荷高饱和几何块、Fredoka |
| **夜光票根** | 深靛底 + 霓虹描边与发光、荧光青 / 品红 / 柠檬黄、Chakra Petch 科技体 |

功能参照 [codex-resets.com](https://codex-resets.com/)，实现完全独立：静态数据快照 + 纯前端渲染，无后端、无数据库、无账号体系。

## 部署

站内资源全部使用相对路径，**部署到任意平台都无需改动代码**（域名根目录或子路径均可）。

### Cloudflare Workers

```bash
npm install
npx wrangler login      # 首次需浏览器授权
npm run build
npx wrangler deploy
```

产物地址形如 `https://quota-watermark.<你的子域>.workers.dev`。首次部署会要求注册 `workers.dev` 子域名。

也可用 npm script：`npm run deploy:workers`（= build + `wrangler deploy`）。

### 自动部署（GitHub Actions）

`.github/workflows/deploy.yml` 会在 push 到 `main` 时自动构建并部署。需要在 GitHub 仓库 **Settings → Secrets and variables → Actions** 里加两个 secret：

| Secret | 值 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare 后台 My Profile → API Tokens 创建，权限选 **Workers Scripts: Edit** + **Account: Read** |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 后台 Workers & Pages → Overview → Account ID |

公开仓库的 Actions 用标准 runner 无限免费。

### 部署配置文件

| 文件 | 作用 |
| --- | --- |
| `wrangler.toml` | Workers 静态资源配置（目录、404 处理、尾斜杠策略） |
| `public/_headers` | 响应头规则：带 hash 的 assets 长缓存；`data/resets.json` 与 `sw.js` 不缓存；`.ics` / RSS 的 MIME 与缓存；数据接口开 CORS |
| `public/_redirects` | 重定向规则。**将来绑定自有域名时在这里加 301，务必保留旧地址** |
| `public/404.html` | 404 页，`not_found_handling = "404-page"` 需要它 |

> Workers Static Assets 原生支持 `_headers` / `_redirects`，无需额外插件。

## 快速开始

```bash
npm install
npm run dev            # 开发服务器 http://127.0.0.1:5173
npm run build          # 类型检查 + 构建 + 产物整理 + 生成订阅源 → dist/
npm run preview        # 预览生产构建
npm run refresh-data   # 重新抓取数据快照
```

部署时用 `SITE_ORIGIN` 指定站点地址（用于 RSS 的 channel link）：

```bash
SITE_ORIGIN=https://your-domain.example npm run build
```

## 功能

| 模块 | 说明 |
| --- | --- |
| **下次重置预测** | 结论先行（"大概率 1–2 天内重置"）+ 未来 7 天的累计概率柱状图，带 80% 参考线 |
| **重置节奏** | 间隔分布直方图、星期分布气泡图、近期与全历史节奏对比 |
| **状态读数** | 最近一次重置、相对/绝对时间、类型标签、Tibo 时区 ↔ 本地时区切换、「+1 感谢」、通知开关 |
| **仪表读数** | 重置次数、平均重置间隔、最长等待 |
| **重置日历** | **最近五个月**逐日展示，常规 / 备用 / 无重置三态。打开即定位到最新一侧；可点「最新」跳回 |
| **重置公告** | 台账式行记录，左列时间右列正文，默认折叠 5 条，可展开全部 |
| **命令面板** | `Cmd/Ctrl + K` 搜索全部重置记录，`↑↓` 选择，`Enter` 打开原文 |
| **导出与订阅** | CSV / JSON 下载、`.ics` 日历订阅、RSS |
| **系统通知** | 每 2 分钟轮询本地快照，发现新重置时弹系统通知 |
| **运行日志** | 启动、轮询、感谢、异常都留痕，按快照去重后持久化在本机 |
| **双主题** | ~~明暗切换~~ → 四主题可切换（毛毡手作 / 墨线糖果 / 孟菲斯玩具 / 夜光票根），选择记在本机 |
| **多语言** | English / 简体中文 / 繁體中文 / 日本語 / 한국어 |

## 预测是怎么做的

不是拍脑袋给一个日期，而是从历史间隔分布里推：

1. 取相邻两次重置的间隔，得到 65 个样本
2. **近期加权**——指数衰减权重，越近的间隔权重越高（`λ = 0.09`，约 10 步前权重减半）。这一步很关键：全历史平均间隔是 6.18 天，但最近 20 次的中位只有 2.5 天，节奏明显变快了，用全历史均值会严重低估
3. 已知已等待 `t` 天，用**条件生存概率**估计 `P(未来 X 天内重置 | 已等 t 天)`：只统计「间隔 > t」的样本
4. 找出让条件概率首次达到 80% / 95% 的天数，即置信窗口
5. 最可能区间取条件分布的 25%~75% 分位

页面上先给一句结论（"大概率 1–2 天内重置"），再用柱状图展示未来 7 天的累计概率（22% → 57% → 80% → 93% → …），并画出 80% 参考线——柱子穿过参考线的位置就是"80% 置信窗口"落在第几天。

**回测结果**（53 个历史点，每次重置后 12 小时起算）：

| 指标 | 命中率 |
| --- | --- |
| 80% 置信窗口 | **91%**（48/53） |
| 95% 置信窗口 | **98%**（52/53） |
| 固定「7 天内」窗口（对照） | 85%（45/53） |

也就是比"固定 7 天"这种朴素做法准 6 个百分点。

界面上明确标注了这是**统计推断，不是官方时间表，也不预测故障**。`.ics` 里只放已确认的重置，不混入预测事件，避免被当成确定的时间。

## 架构

```
src/
├─ data/        types.ts（共享类型）· useResets.ts（拉取 + 派生统计）
├─ lib/         forecast.ts（预测）· rhythm.ts（节奏分析）· stats.ts
│               calendar.ts · time.ts · export.ts · base.ts   ← 纯函数，不依赖 React
├─ i18n/        en.ts（类型源）· zh-CN / zh-TW / ja / ko
├─ hooks/       useTheme · useLog · useNotify
├─ components/  Header · StatusPanel · StatsBar · ForecastCard · RhythmChart
│               ResetCalendar · AnnouncementFeed · CommandPalette
│               TerminalLog · Section · LangSwitcher · ThemeSwitcher
└─ styles/      tokens.css（设计 token + 四套主题）· global.css
```

要点：

- **主题靠 CSS 变量驱动**。四套主题各自定义一组 token（`--bg / --ink / --bw / --bc / --shadow-card / --r-lg / --figure-* / --cell-*` …），组件样式只引用变量，所以换主题不需要任何条件样式。切主题就是改 `<html data-theme>`。
- **主题在首屏绘制前决定**。每个语言入口的 `<head>` 里有内联脚本读 `localStorage` 写入 `data-theme`，避免闪烁。
- **无前端路由**。每种语言构建成独立 HTML 入口，产物为 `dist/<locale>/index.html`，语言切换即跳转。任意静态托管都能直接跑，不需要 rewrite 规则。
- **资源路径用 `base: './'` + 运行时 `BASE_URL` 解析**（`src/lib/base.ts`），域名根目录与子路径部署都能正确加载数据与 Service Worker。
- **多语言完整性由编译期保证**：`en.ts` 是类型源，其余语言声明为 `Record<keyof typeof en, string>`，漏译一个键 `tsc` 直接报错。
- **日历按月分块渲染**：每月是一个 7 列宽的独立网格，块宽 `7 × 列宽 + 6 × 间距` 正好等于 7 列节奏，跨月不会串行错位；星期表头放在月块内部，横向滚动后依然对齐；日期键统一按 UTC 切分（用本地时区会把 UTC 傍晚的重置归错到隔天）。

## 数据更新

数据快照在 `public/data/resets.json`，是运行时唯一的数据来源。

```bash
npm run refresh-data
# 或指定其他来源
node scripts/refresh-data.mjs --source <url>
```

脚本会拉取上游接口、归一化字段、按 id 去重、按时间倒序写回，并打印新增/变更/删除摘要。两道保护：上游事件数比现有文件少 20% 以上时**拒绝写入**；上游返回 0 条时直接报错退出。

## 已知限制

- **数据来源依赖上游公开接口。** 当前快照取自 `codex-resets.com/api/resets`，上游条款要求使用时标注来源，页脚已保留署名。要完全独立需接入 X 官方 API 并自建抓取任务。
- **系统通知需要用户授权且页面处于打开状态。** 基于本地轮询，没有服务端推送；浏览器权限被拒时开关会禁用。
- **「在线人数」「点赞数」不做伪造。** 纯静态站点没有后端共享计数，因此用真实的本地状态代替：轮询次数、已感谢记录、运行日志。
- **预测是统计推断。** 样本只有 65 个间隔，长尾区间（67.7 天那种空窗）的概率估计很不稳；节奏若再次变化，模型需要重新校准。

## 致谢与免责

数据来自 [@thsottiaux](https://x.com/thsottiaux) 发布的推文，由 [codex-resets.com](https://codex-resets.com/) 提供（署名后自由使用）。本站为独立项目，与 OpenAI 无关联；「Codex」是 OpenAI 的商标。
