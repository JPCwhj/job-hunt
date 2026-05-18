# Chrome 浏览器插件 ↔ Skill 集成 Design

## 背景

job-hunt skill 当前通过截图 + OCR 解析岗位信息。痛点：
- 截图操作繁琐（每个岗位手动截图）
- 视觉 LLM 解析有错误率
- 长截图工具因平台而异

为高频用户提供更快的路：用 Chrome 插件直接读 DOM 导出结构化文件。

## 目标 / 非目标

**目标**：覆盖 Boss 直聘；作为截图入口的补充；不破坏现有自动化链路。

**非目标**：列表页批量抓取、多平台 adapter、自动投递、模拟点击、存 cookie、调 Boss API。

## 数据流

Boss 详情页 DOM → content script 解析 → chrome.storage.local → popup 勾选 → service worker → Downloads/boss-jobs-*.jobs.json → 用户拖给 Claude → /job-hunt Step 3 识别 → import_jobs.py → jd-pool 文件 → Step 4 分析、Step 6 定制不变。

## JSON Schema

文件名：`boss-jobs-YYYY-MM-DD-HHmm-<N>条.jobs.json`

字段：见实现 plan 同名章节。

## Skill 端识别逻辑

Step 3 提示文案改为三方式：截图 / 目录 / .jobs.json 文件。

判断顺序：
1. .jobs.json 文件或路径 → 调 import_jobs.py
2. 目录路径 → 扫目录的图片和 .jobs.json，混合处理
3. 图片 → 调 fetcher

## import_jobs.py 职责

输入 `<data_dir> <json_path>`；输出 stdout 单行：`OK: 已导入 N 个岗位 -> <path>` 或 `ERROR: <reason>`；写 `<data_dir>/.work/jd-pool/<file>.md`（frontmatter 同 fetcher，`source: extension`）；不调 LLM。

## 边界与风险

- external_id 去重防重复收藏
- DOM 改版导致字段抓不到 → 字段 null，整体仍可收藏
- 用户清浏览器存储 → 清单丢失，已下载 JSON 不受影响
- 未来 Boss 改版需要更新 boss.js 选择器
