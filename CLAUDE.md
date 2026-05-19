# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目性质

这是一个 **Claude Code Skill Suite**（不是普通应用，不是 Web 服务，不是 CLI 工具）。最终产物是 4 个互相协作的 skill 文件，安装后用户在 Claude Code 里通过 `/job-hunt` 触发使用。

**核心约束**：**不做自动投递**——系统准备好定制简历和开场白，最后由用户人手投递（避免封号 + 守住伦理边界）。支持所有主流招聘平台，截图包含公司名、职位名、岗位 JD 即可。

## 阅读顺序

任何代码或细节实现之前，**必读** [docs/superpowers/specs/2026-05-02-screenshot-input-design.md](docs/superpowers/specs/2026-05-02-screenshot-input-design.md)。这份 spec 定义了：
- 4 个 skill 的职责边界（不要跨界）
- 完整数据流（截图输入 → JD 解析 → shortlist.html）
- 三处关键 schema：JD frontmatter / analysis frontmatter / shortlist 条目
- 缓存策略（JD pool / analysis 两层）
- 改写伦理红线（写进 analyzer/tailor 的 prompt）

> 历史参考：[docs/superpowers/specs/2026-04-29-job-hunt-skill-design.md](docs/superpowers/specs/2026-04-29-job-hunt-skill-design.md)（旧版 bb-browser 方案，已废弃）

## README 维护约定

**每次修改 `README.md` 后，必须同步更新 `README.en.md`**：
- 内容改动同步翻译到英文版
- 涉及国内招聘平台名称（Boss直聘、智联招聘等）的地方，英文版统一用 "major hiring platform" 代替，不直接翻译平台名
- 两个文件顶部的互链（`[English](README.en.md)` / `[中文](README.md)`）保持不变

## Skill 文件约定

- **文件名必须是 `SKILL.md`**（不是 index.md）
- **开发目录**：`skills/<name>/SKILL.md`
- **安装方式**：`bash scripts/install.sh` → 复制到 `~/.claude/skills/<name>/SKILL.md`
- **不需要 plugin 包装**：直接放 `~/.claude/skills/` 即可被 Claude Code 识别

## Skill 拆分（不要随意调整）

```
job-hunt              ← 主：编排 + 缓存管理 + 排序 + shortlist
├── job-hunt-fetcher  ← 截图解析，提取 JD 结构化数据，不做过滤/分析/改写
├── job-hunt-analyzer ← STAR 拆解 + 4 维匹配度，不直接改写简历（只生成"建议"）
└── job-hunt-tailor   ← 定制简历三件套 (resume/opener/changelog)，严守伦理边界
```

**硬过滤和排序故意放在主 skill** 而非独立子 skill —— 这两步不调 LLM，独立成 skill 是过度拆分。

**子 skill 不直接暴露给用户**，全部由主 skill 内部调用，避免用户跳过编排逻辑。

## 改写伦理红线（写进 prompt 的硬约束）

| 行为 | 是否允许 |
|---|---|
| 改写措辞、调整顺序、用 STAR 重写已有项目描述 | ✅ |
| 凭空增加项目/技能/经历 | ❌ |
| 编造具体数字（用户量、增长率、收入） | ❌ → 必须用 `[请填写：xxx]` 占位 |
| 修改工作时间/职级 | ❌ |

`changelog.md` 是**伦理保险**，必须如实列出 AI 改了什么、为什么——不允许偷偷改。

## 目录约定

- **work_dir = Claude 启动时的当前目录（`pwd`）**，无任何 fallback，不再使用 `~/.job-hunt/`
- 用户简历**只支持** `.md` 文件 或 **直接粘贴文本**——版式文件（PDF/Word）跨环境解析容易失真或失败，且依赖各种 Python/CLI 工具，不可靠；统一改为让用户贴文本，零依赖
- 定制简历输出**只 MD**，用户自己转 PDF 投递
- JD 缓存：`<work_dir>/.work/jd-pool/公司名-职位名-YYYYMMDDTHHmm.md`（无公司名时用 `screenshot-YYYYMMDDTHHmm.md`）
- 输出：`<work_dir>/output/<run_id>/`

## fetcher 截图解析约定

- 截图来源：用户提供的任意招聘平台**详情页**截图（Boss直聘、智联招聘、前程无忧、猎聘等均可，不限批量或流式）
- 分组：多张截图时先用视觉能力归组，确认后解析
- 完整性：流式单张时主动询问是否截完整
- 字段缺失：置 null，不中断写入
- 无 bb-browser 依赖，无防风控延迟

## 全流程自动化：关键约束

**这是这个项目里最容易踩的坑，务必理解清楚。**

Claude Code 的运行模型：
- **输出文字 = turn 结束 = 等用户回复**
- **调用工具（Bash/Skill/Read/Write）= turn 继续**，可以接着调用下一个工具

因此，任何写在步骤之间的文字提示（如"✅ 分析完成，开始定制简历…"）都会导致流程停住，哪怕指令后面写了"立即执行下一步"也无效——文字已经输出，turn 已经结束。

**正确的做法：Step 3 fetcher 返回后 → Step 7 之间，主 skill 不得输出任何文字，也不得回显/复述任何子 skill 的返回内容。** 每步结束后直接调用下一步的工具（Skill call），零文字过渡。

唯一可见的进度反馈来自子 skill 内部的进度行（如"✅ 字节跳动·产品经理 — 匹配度78分（1/2）"）——这些是工具执行的输出，不会结束 turn，是安全的。

修改主 skill 时：
- ❌ 绝不在 Step 3 fetcher 返回后到 Step 7 之间写任何文字，包括状态通知和子 skill 返回内容回显
- ✅ 每步直接以工具调用衔接下一步（Bash 更新 state.json → Skill call 下一步）

## Chrome 插件

插件源码在 `chrome-extension/` 目录，支持 Boss 直聘、前程无忧、智联招聘、猎聘四个平台。用户在岗位详情页点击悬浮按钮收藏，通过 Popup 导出 `.jobs.json`，主 skill Step 3 识别该文件后直接写入 jd-pool（跳过截图 OCR）。

**插件只读 DOM，不调平台 API，不模拟点击，不存 Cookie。**

维护、新增平台、DOM 选择器映射、Boss 反爬机制详见：[chrome-extension/DEVELOPMENT.md](chrome-extension/DEVELOPMENT.md)

## 依赖的外部 skill

- 无（简历只接收 .md 或粘贴文本，不依赖外部 skill）

## 当前状态

- ✅ 设计文档、实现计划已完成
- ✅ fetcher 改为截图解析，支持全平台，去掉 bb-browser 依赖
- ✅ 输入流程简化：截图 + 简历文本，无需配置文件
- ✅ 排序简化为 match score；输出**只产 shortlist.html**
- ✅ 全流程自动化：Step 3 fetcher 返回后到 Step 7 之间无文字输出，纯工具调用链
- ✅ 新增 Step 2.5：简历质量评估（STAR/PAR 法则，新上传简历时触发）
- ✅ Step 7 生成 shortlist.html（响应式，简历可编辑，一键导出 PDF）
- ✅ Chrome 插件支持四平台：Boss 直聘、前程无忧、智联招聘、猎聘
- ✅ FAB 按钮可拖拽，位置持久化，跨平台共享同一位置
