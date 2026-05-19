# Chrome Extension 开发与维护指南

这个 Chrome 扩展运行在招聘网站的岗位详情页，用户点击右下角悬浮按钮即可将当前岗位保存为结构化数据，最终通过 Popup 导出为 `.jobs.json` 文件供后续分析工具使用。

扩展**只读取已渲染的 DOM**，不调用任何平台 API，不模拟点击，不存取 Cookie。

---

## 目录

1. [支持平台](#1-支持平台)
2. [数据 Schema](#2-数据-schema)
3. [各平台 DOM 映射](#3-各平台-dom-映射)
   - [Boss 直聘](#boss-直聘)
   - [前程无忧 51job](#前程无忧-51job)
   - [智联招聘](#智联招聘)
   - [猎聘](#猎聘)
4. [Boss 直聘特殊机制](#4-boss-直聘特殊机制)
5. [DOM 坏了：诊断与修复流程](#5-dom-坏了诊断与修复流程)
6. [新增平台 Checklist](#6-新增平台-checklist)
7. [文件结构](#7-文件结构)

---

## 1. 支持平台

| 平台 | 匹配 URL | 内容脚本 |
|---|---|---|
| Boss 直聘 | `https://www.zhipin.com/job_detail/*` 和 `/web/geek/jobs*` | `src/content/boss.js` |
| 前程无忧 | `https://jobs.51job.com/*/*.html*` | `src/content/51job.js` |
| 智联招聘 | `https://www.zhaopin.com/jobdetail/*` | `src/content/zhaopin.js` |
| 猎聘 | `https://www.liepin.com/job/*.shtml*` | `src/content/liepin.js` |

URL 匹配规则在 `manifest.json` 的 `content_scripts[].matches` 中定义。若平台改了域名或路径，只需修改对应的 `matches` 字段。

---

## 2. 数据 Schema

每个岗位保存为一个 JSON 对象，结构由 `src/lib/schema.js` 的 `jhEmptyJob()` 定义。

| 字段 | 类型 | 说明 | 示例 |
|---|---|---|---|
| `platform` | string | 来源平台标识 | `"boss"` / `"51job"` / `"zhaopin"` / `"liepin"` |
| `external_id` | string \| null | 平台原始岗位 ID，用于去重 | `"1982439527"` |
| `url` | string \| null | 岗位详情页完整 URL | `"https://www.liepin.com/job/..."` |
| `title` | string \| null | 职位名称 | `"高级产品经理"` |
| `salary.range` | string \| null | 薪资范围（已解码，PUA 字符→数字） | `"18-30k"` / `"2.5-3万"` |
| `salary.monthly_count` | number \| null | 几薪，无则 null | `18` |
| `location.city` | string \| null | 城市 | `"上海"` |
| `location.district` | string \| null | 区县，无则 null | `"浦东新区"` |
| `requirements.experience` | string \| null | 经验要求 | `"5年以上"` |
| `requirements.education` | string \| null | 学历要求 | `"统招本科"` |
| `company.name` | string \| null | 公司名称 | `"字节跳动"` |
| `company.industry` | string \| null | 所属行业 | `"互联网"` |
| `company.size` | string \| null | 公司规模 | `"10000人以上"` |
| `company.stage` | string \| null | 融资阶段 | `"已上市"` / `"D轮"` / `"未融资"` |
| `hr.name` | string \| null | HR 姓名 | `"张女士"` |
| `hr.title` | string \| null | HR 职称 | `"招聘专员"` |
| `hr.active_status` | string \| null | HR 活跃状态 | `"今日活跃"` / `"3分钟前在线"` |
| `tags` | string[] | 岗位标签（职能类别等） | `["短视频运营", "抖音"]` |
| `benefits` | string[] | 福利待遇 | `["五险一金", "带薪年假"]` |
| `job_description` | string \| null | 岗位职责正文 | `"1. 负责..."` |
| `job_requirements` | string \| null | 任职要求正文 | `"1. 本科以上..."` |
| `company_intro` | string \| null | 公司简介（目前各平台均留 null） | `null` |
| `posted_at` | string \| null | 发布时间（目前各平台均留 null） | `null` |
| `saved_at` | string | 用户收藏时的 ISO 时间戳 | `"2026-05-19T08:30:00.000Z"` |

> **去重逻辑**：`external_id` 是去重 key。`jhUpsertJob()` 在 `src/lib/storage.js` 中实现，同一 `external_id` 的岗位会覆盖旧数据。

---

## 3. 各平台 DOM 映射

### Boss 直聘

Boss 直聘有两种页面布局，解析逻辑完全不同：

- **详情页**（`/job_detail/*.html`）：独立页面，所有信息在同一 DOM 树
- **分栏页**（`/web/geek/jobs*`）：左侧列表 + 右侧详情面板

> ⚠️ Boss 存在 DevTools 反检测和 PUA 字体混淆，详见[第 4 节](#4-boss-直聘特殊机制)。

#### 详情页布局（`/job_detail/*.html`）

| 字段 | 选择器 | 解析说明 |
|---|---|---|
| `title` | `.info-primary .name h1` | 直接取 innerText |
| `salary.range` | `.info-primary .name .salary` | 含 PUA 字符，需调 `jhDecodeSalary()` 解码；按 `·` 分割取前段 |
| `salary.monthly_count` | 同上 | 正则提取 `/(\d+)薪/` |
| `location.city` | `.info-primary p .text-city` | 直接取 innerText |
| `requirements.experience` | `.info-primary p .text-experiece` | **注意拼写错误**：Boss 源码中是 `experiece`（少一个 n） |
| `requirements.education` | `.info-primary p .text-degree` | 直接取 innerText |
| `benefits` | `.tag-container-new > .job-tags span` | 用 Set 去重（Boss JS 有时会重复注入） |
| `job_description` | `.job-sec-text`（可能多个，拼接） | 去掉 `"职位描述"` 前缀；按关键词行分割描述/要求 |
| `job_requirements` | 同上，分割后半段 | 关键词：`任职要求 / 岗位要求 / 任职资格 / 要求：` |
| `company.name` | `.sider-company` 第一行 | 多行解析 |
| `company.stage` | `.sider-company` 逐行 | 匹配 `已上市 / 天使轮 / X轮 / 不需要融资` |
| `company.size` | `.sider-company` 逐行 | 匹配 `X-Y人 / X人以上` |
| `company.industry` | `.sider-company` 逐行 | 不匹配上述两项的第一行 |
| `hr.name` | `.job-boss-info h2.name` | 去掉活跃状态文字（`.boss-active-time`）后的首段 |
| `hr.active_status` | `.boss-active-time` | 直接取；不存在时从 h2.name 第二行取 |
| `hr.title` | `.job-boss-info` | `"·"` 符号之后的文字 |

#### 分栏页布局（`/web/geek/jobs*`）

| 字段 | 选择器 | 解析说明 |
|---|---|---|
| `title` | `.job-name`（在右侧面板内） | 直接取 innerText |
| `salary.range` | `.job-salary`（面板内） | 同上，需 PUA 解码 |
| `location.city` | `.tag-list li`（面板内） | 逐项识别：不含年/学历关键词的项 = 城市 |
| `location.district` | `.job-address-desc`（面板内） | 去掉城市名前缀后，正则提取 `X区/X县` |
| `requirements.experience` | `.tag-list li` | 含 `\d+年 / 应届` 的项 |
| `requirements.education` | `.tag-list li` | 含 `本科 / 硕士 / 大专` 等的项 |
| `benefits` | `.job-label-list li` | 直接取所有 li 文字 |
| `job_description` | `p.desc`（面板内） | 使用 **innerText**（非 textContent），过滤 CSS 注入噪声；按关键词行分割 |
| `job_requirements` | 同上，分割后半段 | — |
| `company.name` | `.boss-info-attr` | 格式 `"公司名 · HR职位"`，`·` 前取公司名 |
| `hr.title` | `.boss-info-attr` | `·` 后取职位 |
| `hr.name` | `.job-boss-info h2.name` | 同详情页 |
| `hr.active_status` | `.boss-active-time` | 同详情页 |

---

### 前程无忧 51job

URL 格式：`https://jobs.51job.com/<city-code>/<id>.html`

`external_id`：从 pathname 末段数字提取，正则 `/\/(\d+)\.html/`

| 字段 | 选择器 | 解析说明 |
|---|---|---|
| `title` | `h1` | 直接取 innerText |
| `salary.range` | `.cn` 第二行 | `.cn` 第一行是职位名，第二行是薪资；按 `·` 分割取前段 |
| `salary.monthly_count` | 同上 | 正则 `/(\d+)薪/` |
| `location.city` | `.msg.ltype` | 格式 `"杭州-上城区 \| 5年及以上 \| 本科"`；按 `|` 分割后，第一段再按 `-` 分 city/district |
| `location.district` | 同上 | — |
| `requirements.experience` | `.msg.ltype` | `|` 分割后第二段 |
| `requirements.education` | `.msg.ltype` | `|` 分割后第三段 |
| `company.name` | `[class*='com_name']` | 直接取 innerText |
| `company.stage` | `.com_tag` 逐行 | 匹配 `民营 / 国企 / 外资 / 合资 / 上市公司` 等 |
| `company.size` | `.com_tag` 逐行 | 匹配 `X-Y人 / X人以上` |
| `company.industry` | `.com_tag` 逐行 | 不匹配上述两项的第一行 |
| `hr.name` | `.iname` | 直接取 innerText |
| `hr.title` | `.itag` | 格式 `"HR职称·活跃状态"`；`·` 前取职称 |
| `hr.active_status` | `.itag` | `·` 后取活跃状态 |
| `job_description` | `.bmsg.job_msg` | 去掉 `"岗位职责 / 职位描述"` 前缀；去掉末尾 `"职能类别："` 和 `"上班地址："` 噪声 |
| `job_requirements` | 同上，按关键词行分割后半段 | 关键词：`任职要求 / 任职资格 / 岗位要求 / 职位要求 / 要求：` |
| `tags` | `.jtag span` 或 `.job-label span` | 岗位标签 |

> **注意**：51job 不使用 PUA 字体混淆，无 DevTools 反检测，`textContent` 和 `innerText` 均可用。

---

### 智联招聘

URL 格式：`https://www.zhaopin.com/jobdetail/<id>.htm`

`external_id`：从 pathname 提取，正则 `/\/jobdetail\/([^.]+)\.htm/i`

| 字段 | 选择器 | 解析说明 |
|---|---|---|
| `title` | `h1` | 直接取 innerText |
| `salary.range` | `.summary-planes__bottom` 第一行 | 格式 `"7000-9000元"` 或 `"7000-9000元·13薪"`；`·` 前取范围 |
| `salary.monthly_count` | 同上 | 正则 `/(\d+)薪/` |
| `location.city` | `.summary-planes__bottom` 第二行 | 格式 `"杭州 钱塘区"`；空格分割取 city/district |
| `location.district` | 同上 | — |
| `requirements.experience` | `.summary-planes__bottom` 第三行 | 直接取 |
| `requirements.education` | `.summary-planes__bottom` 第四行 | 直接取 |
| `company.name` | `.company-info__meta` 第一行 | 多行解析 |
| `company.stage` | `.company-info__meta` 第二行 | 格式 `"未融资 · 100-299人 · 环保  已审核"`；按 `·` 分割，去掉 `"已审核"` 后匹配融资阶段关键词 |
| `company.size` | 同上 | 匹配 `X-Y人 / X人以上` |
| `company.industry` | 同上 | 不匹配上述两项的第一个非空段 |
| `hr.name` | `.publisher-seo` | 过滤 `"立即沟通"` 和 `"职位发布者"` 后，第一行 |
| `hr.active_status` | `.publisher-seo` | 过滤后第二行 |
| `hr.title` | `.publisher-seo` | 过滤后第三行 |
| `job_description` | `[class*='job-detail']` 或 `[class*='detail']` | 去掉 `"岗位职责 / 职位描述"` 前缀；按关键词行分割 |
| `job_requirements` | 同上，分割后半段 | — |
| `tags` | `[]`（留空） | 智联标签元素分散在整页（含推荐职位），无可靠容器，故置空 |

---

### 猎聘

URL 格式：`https://www.liepin.com/job/<id>.shtml`

`external_id`：从 pathname 提取，正则 `/\/job\/([^.]+)\.shtml/i`

| 字段 | 选择器 | 解析说明 |
|---|---|---|
| `title` | `.job-title.ellipsis-2` | 直接取 innerText |
| `salary.range` | `.salary` | 格式 `"18-30k·18薪"` 或 `"薪资面议"`；`·` 前取范围，`"薪资面议"` 置 null |
| `salary.monthly_count` | 同上 | 正则 `/(\d+)薪/` |
| `location.city` | `.job-apply-container` | 找含 `年以上 / 本科 / 大专` 等关键词的行；双空格分割后，第一段按 `-` 分 city/district |
| `location.district` | 同上 | — |
| `requirements.experience` | 同上 | 双空格分割后第二段 |
| `requirements.education` | 同上 | 双空格分割后第三段 |
| `company.name` | `.content` 第二行 | 格式 `"人力行政总监 · 诚泰租赁"`；`·` 后取公司名 |
| `company.industry` | `aside` 元素 | 正则匹配 `企业行业：(.+)` |
| `company.size` | `aside` 元素 | 正则匹配 `人数规模：(.+)` |
| `company.stage` | `aside` 元素 | 正则匹配 `融资情况：(.+)` 或 `融资阶段：(.+)`；部分公司无此字段则为 null |
| `hr.name` | `.content` 第一行 | 格式 `"常先生 3分钟前在线 已认证"`；第一个空格前取姓名 |
| `hr.active_status` | `.content` 第一行 | 正则匹配 `X分钟/小时/天前在线 / 当前在线 / 今日活跃` 等 |
| `hr.title` | `.content` 第二行 | `·` 前取职称 |
| `tags` | `.job-apply-container-desc span` | 福利标签；无 span 时按空格拆分整行文字 |
| `job_description` | `.job-intro-container` | 去掉 `"职位介绍"` 顶部标题；按行查找任职要求关键词分割；去掉末尾 `"其他信息 行业要求：…"` 噪声 |
| `job_requirements` | 同上，分割后半段 | 关键词：`任职要求 / 任职资格要求 / 岗位要求 / Requirements` |

---

## 4. Boss 直聘特殊机制

### DevTools 反检测

Boss 监听 DevTools 打开事件，一旦触发会立即关闭当前标签页。

**绝对不能**在 Boss 标签页按 F12 或右键→检查。

**正确调试方式**：在 content script 里通过 `chrome.runtime.sendMessage` 发日志到 background service worker，在 `chrome://extensions/` → 插件 → Service Worker → 检查视图 的独立 Console 查看。

```javascript
// content script 里发诊断数据
chrome.runtime.sendMessage({ type: "jh-diag", data: { key: value } });

// service-worker.js 里接收并打印（已内置）
// chrome.runtime.onMessage → 匹配 type === "jh-diag" → console.log
```

### PUA 字体薪资混淆

Boss 用自定义字体 `kanzhun-Regular` 将薪资数字替换为 Unicode 私有区字符（U+E000–U+F8FF），`textContent` / `innerText` 读到的是不可见的 PUA 字符而非数字。

**解码公式**（已由实测数据验证，编码于静态 TTF 文件，2022 年起未变动）：

```javascript
function jhDecodePUADigit(code) {
  // U+E031 → '0',  U+E032 → '1',  ...,  U+E03A → '9'
  if (code >= 0xE031 && code <= 0xE03A) return String(code - 0xE031);
  return null;
}
```

若未来薪资变为乱码，先打印字符 code point 确认 PUA 范围是否变化，再更新上方公式。

### CSS 注入噪声（p.desc）

Boss 在岗位描述元素 `p.desc` 内嵌入 `<style>` 标签和 `font-size:0` 的隐藏 span，干扰文字提取。

**必须用 `innerText`，禁用 `textContent`**：

```javascript
const raw = descEl.innerText.trim(); // ✅
// const raw = descEl.textContent;   // ❌ 含噪声
```

### 安全红线

| 操作 | 是否允许 |
|---|---|
| 读取已渲染的 DOM | ✅ |
| 本地算术计算（PUA 解码） | ✅ |
| 浏览器 Downloads API 导出文件 | ✅ |
| 调用 Boss 内部 API（`/wapi/zpgeek/` 等） | ❌ 有封号风险 |
| 模拟点击投递按钮 | ❌ |
| 读写 Cookie / localStorage 中的会话数据 | ❌ |

---

## 5. DOM 坏了：诊断与修复流程

当导出的 JSON 某个字段变成 `null`，或按钮点击后报错，按以下步骤排查：

### 第一步：确认是哪个字段

导出 JSON，找到值为 `null` 或内容明显不对的字段，对照[第 3 节](#3-各平台-dom-映射)的映射表，定位到对应选择器。

### 第二步：打开调试控制台

1. 打开 `chrome://extensions/`，找到 job-hunt 插件
2. 点击 **Service Worker → 检查视图**，打开独立的 DevTools 窗口
3. 切换到 **Console** 标签

> ⚠️ Boss 直聘必须用此方式，其他平台也推荐用此方式保持一致。

### 第三步：注入诊断脚本

在对应平台的 content script 顶部，临时插入一个自执行诊断函数，发送诊断数据到 background：

```javascript
// 通用诊断模板——在 content script 文件顶部临时添加
(function jhDiag() {
  function snap(selector) {
    const el = document.querySelector(selector);
    return el ? (el.innerText || el.textContent || "").trim().slice(0, 120) : null;
  }
  function snapAll(selector) {
    return Array.from(document.querySelectorAll(selector))
      .map(el => (el.innerText || el.textContent || "").trim().slice(0, 60))
      .filter(t => t);
  }

  chrome.runtime.sendMessage({ type: "jh-diag", data: {
    // 把你怀疑的选择器列在这里，例如：
    title:   snap("h1"),
    salary:  snap("[class*='salary']"),
    company: snap("[class*='company']"),
    // 叶节点 class + 文字（找规律用）
    leaves: Array.from(document.querySelectorAll("[class]"))
      .filter(el => el.children.length === 0 && (el.innerText||"").trim().length > 1)
      .slice(0, 60)
      .map(el => ({ cls: el.className.toString().slice(0,50), txt: (el.innerText||"").trim().slice(0,30) }))
  }});
})();
```

**重新加载插件（`chrome://extensions/` → 刷新按钮），关闭并重新打开目标页面**，Console 里会出现 `[diag] {...}` 的日志。

### 第四步：根据输出定位新选择器

- 查看 `leaves` 数组，找到包含目标内容的元素的 class 名
- 用 `snap()` 针对性验证候选选择器
- 必要时多轮诊断（每轮更新选择器后重新加载插件、重开页面）

### 第五步：更新代码

找到新选择器后，修改对应平台的 `src/content/xxx.js`，删除诊断代码，重新加载插件验证，导出 JSON 确认字段正确。

---

## 6. 新增平台 Checklist

以下步骤以添加"拉勾网"为例：

**① 确认 URL 格式**
打开一个岗位详情页，记录 URL 格式，例如 `https://www.lagou.com/jobs/123456.html`

**② 创建内容脚本文件**

`src/content/lagou.js` — 实现以下五个函数：

```javascript
function jhLgExtractExternalId() { /* 从 URL 提取 ID */ }
async function jhLgParsePage()   { /* 返回 jhEmptyJob() 填充后的对象 */ }
function jhLgShowToast(msg)      { /* 创建/显示 Toast */ }
function jhLgMountFab()          {
  // 创建按钮，addEventListener click，appendChild，调 jhMakeDraggable
  jhMakeDraggable(btn, "jh-fab-pos");  // key 与其他平台相同，位置共享
}
async function jhLgOnFabClick(btn) { /* 调 jhHasJob / jhUpsertJob / jhRemoveJob */ }

jhLgMountFab(); // 文件末尾初始化
```

`src/content/lagou.css` — 复制任意平台的 CSS，改 ID 前缀（如 `#jh-lg-fab`、`#jh-lg-toast`）。

**③ 注册到 manifest.json**

```json
{
  "matches": ["https://www.lagou.com/jobs/*.html*"],
  "js": ["src/lib/schema.js", "src/lib/storage.js", "src/lib/drag.js", "src/content/lagou.js"],
  "css": ["src/content/lagou.css"],
  "run_at": "document_idle"
}
```

同时在 `host_permissions` 数组中添加 `"https://www.lagou.com/*"`。

**④ 跑诊断找选择器**
按[第 5 节](#5-dom-坏了诊断与修复流程)的诊断流程，逐轮找到所有字段的选择器，填入 `jhLgParsePage()`。

**⑤ 验证**
收藏 2-3 个岗位，导出 JSON，对照 Schema 表逐字段检查，确认无乱码、无串字段。

---

## 7. 文件结构

```
chrome-extension/
├── manifest.json              # 插件配置：平台 URL 匹配、权限声明
├── DEVELOPMENT.md             # 本文件
├── icons/                     # 插件图标（16/48/128px）
├── src/
│   ├── lib/
│   │   ├── schema.js          # jhEmptyJob() 数据结构定义 + 工具函数
│   │   ├── storage.js         # jhUpsertJob / jhHasJob / jhRemoveJob（基于 chrome.storage）
│   │   └── drag.js            # jhMakeDraggable()：FAB 拖拽 + 位置持久化
│   ├── content/
│   │   ├── boss.js / boss.css
│   │   ├── 51job.js / 51job.css
│   │   ├── zhaopin.js / zhaopin.css
│   │   └── liepin.js / liepin.css
│   ├── popup/
│   │   ├── popup.html         # 插件图标点击后的弹窗
│   │   └── popup.js           # 列表展示 + 导出为 .jobs.json
│   └── background/
│       └── service-worker.js  # 处理文件下载 + 接收诊断日志
└── scripts/
    └── install.sh             # 将 skill 文件复制到 ~/.claude/skills/（与插件无关）
```
