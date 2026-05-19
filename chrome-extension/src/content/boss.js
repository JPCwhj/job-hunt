// chrome-extension/src/content/boss.js

function txt(selector, root) {
  const el = (root || document).querySelector(selector);
  return el ? el.textContent.trim() : null;
}

// innerText 版：过滤 Boss 注入的 CSS 噪声（tiny hidden spans + <style> blocks）
function innerTxt(selector, root) {
  const el = (root || document).querySelector(selector);
  if (!el) return null;
  const t = (el.innerText || el.textContent || "").trim();
  return t || null;
}

function txtAll(selector, root) {
  return Array.from((root || document).querySelectorAll(selector))
    .map(el => el.textContent.trim())
    .filter(Boolean);
}

// 找右侧详情面板（分栏模式）
function jhFindRightPanel() {
  const selectors = [
    '.job-detail-box', '.detail-box', '.job-detail-card',
    '.recommend-detail', '.search-job-result .job-detail',
    '[class*="jobDetail"]', '[class*="job-detail"]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  // 兜底：找到含 .job-sec-text 的容器（只在右侧面板出现）
  const descEl = document.querySelector('.job-sec-text, .job-detail-section .text');
  if (descEl) return descEl.closest('section, article, [class*="detail"]') || descEl.parentElement;
  return null;
}

function jhExtractExternalId() {
  // 单独详情页：从 URL 提取
  const m = location.pathname.match(/\/job_detail\/([^.\/\?#]+)/);
  if (m) return m[1];

  // 分栏模式：从右侧面板的 job_detail 链接提取
  const panel = jhFindRightPanel();
  if (panel) {
    const link = panel.querySelector('a[href*="/job_detail/"]');
    if (link) {
      const lm = (link.getAttribute('href') || '').match(/\/job_detail\/([^.\/\?#]+)/);
      if (lm) return lm[1];
    }
  }
  // 兜底：左侧列表中当前 active 条目的链接
  const activeLink = document.querySelector(
    '.job-card-wrapper.active a[href*="/job_detail/"], ' +
    '[class*="active"] a[href*="/job_detail/"]'
  );
  if (activeLink) {
    const lm = (activeLink.getAttribute('href') || '').match(/\/job_detail\/([^.\/\?#]+)/);
    if (lm) return lm[1];
  }
  return null;
}

async function jhParseBossDetailPage() {
  const job = jhEmptyJob();
  job.platform = "boss";
  job.saved_at = new Date().toISOString();
  job.external_id = jhExtractExternalId();
  job.url = location.href;

  // Boss 有两种页面布局，选择器完全不同：
  //   详情页：/job_detail/*.html  → .info-primary / .job-sec-text / .sider-company
  //   分栏页：/web/geek/jobs 等  → .job-name / p.desc / .boss-info-attr
  const isDetailPage = /^\/job_detail\//.test(location.pathname);

  if (isDetailPage) {
    await jhParseDetailLayout(job);
  } else {
    await jhParseSplitPaneLayout(job);
  }

  return job;
}

// ── 详情页布局（/job_detail/*.html）─────────────────────────────────────────
async function jhParseDetailLayout(job) {
  // 标题 & 薪资
  job.title = innerTxt(".info-primary .name h1") || innerTxt("h1");
  const salaryRaw = innerTxt(".info-primary .name .salary");
  const salaryText = salaryRaw ? await jhDecodeSalary(salaryRaw) : null;
  job.salary.range = salaryText;
  if (salaryText) {
    const mc = salaryText.match(/(\d+)薪/);
    if (mc) job.salary.monthly_count = parseInt(mc[1]);
  }

  // 城市 / 经验 / 学历（.info-primary p 里三个独立 span/a）
  // 注意：Boss 源码里 "experience" 有拼写错误，class 是 text-experiece
  job.location.city = innerTxt(".info-primary p .text-city");
  job.requirements.experience = innerTxt(".info-primary p .text-experiece");
  job.requirements.education  = innerTxt(".info-primary p .text-degree");

  // 福利标签：.tag-container-new 直接子 .job-tags（排除 .tag-more 里的重复展开项）
  // Boss JS 有时会把展开层内容提升到 DOM 外层，用 Set 去重保险
  const _bSeen = new Set();
  job.benefits = Array.from(
    document.querySelectorAll(".tag-container-new > .job-tags span")
  ).map(e => e.textContent.trim()).filter(t => t && !_bSeen.has(t) && _bSeen.add(t));

  // 岗位描述（.job-sec-text 可能出现多次，拼接后再分段）
  const secTexts = Array.from(document.querySelectorAll(".job-sec-text"));
  const fullDesc = secTexts
    .map(e => (e.innerText || "").trim())
    .filter(t => t.length > 20)
    .map(t => t.replace(/^职位描述\s*/i, "").trim())
    .join("\n\n");
  if (fullDesc) {
    const splitRe = /(职位要求|任职要求|岗位要求|任职资格|要求[:：])/;
    const m = fullDesc.split(splitRe);
    if (m.length >= 3) {
      job.job_description = m[0].trim();
      job.job_requirements = m.slice(2).join("").replace(/^[：:\s]+/, "").trim();
    } else {
      job.job_description = fullDesc;
    }
  }

  // 公司信息：.sider-company 按行解析（公司名 / 融资阶段 / 规模 / 行业）
  const siderEl = document.querySelector(".sider-company");
  if (siderEl) {
    const lines = (siderEl.innerText || "").split("\n")
      .map(l => l.trim()).filter(l => l && l !== "公司基本信息" && l !== "查看全部职位");
    if (lines.length > 0) job.company.name = lines[0];
    for (const l of lines.slice(1)) {
      if (/已上市|未上市|天使轮|Pre-[AB]|[A-Z]轮|上市公司|不需要融资/.test(l)) job.company.stage = l;
      else if (/人以上|人$|\d+-\d+人/.test(l)) job.company.size = l;
      else if (!job.company.industry) job.company.industry = l;
    }
  }

  // HR 信息：.job-boss-info 按行解析（姓名 / 活跃状态 / 职位）
  const bossInfoEl = document.querySelector(".job-boss-info");
  if (bossInfoEl) {
    const raw = bossInfoEl.innerText || "";
    const lines = raw.split("\n").map(l => l.trim()).filter(l => l && l !== "·");
    job.hr.name = lines[0] || null;
    const activeIdx = lines.findIndex(l =>
      /活跃|刚刚|\d+分钟|\d+小时|今日|昨日|\d+天前|\d+周前|\d+月前|\d+年前/.test(l)
    );
    if (activeIdx > 0) job.hr.active_status = lines[activeIdx];
    // 职位在 "·" 符号之后
    const dotAt = raw.indexOf("·");
    if (dotAt > -1) {
      const afterDot = raw.slice(dotAt + 1).trim().split("\n")[0].trim();
      if (afterDot) job.hr.title = afterDot;
    }
  }
}

// ── 分栏布局（/web/geek/jobs 等）────────────────────────────────────────────
async function jhParseSplitPaneLayout(job) {
  const root = jhFindRightPanel() || document;

  // job URL：优先用面板里的 job_detail 链接
  const detailLink = root.querySelector('a[href*="/job_detail/"]');
  if (detailLink && detailLink.href) job.url = detailLink.href;

  // 标题 & 薪资
  job.title = innerTxt(".job-name", root);
  const salaryRaw = innerTxt(".job-salary", root);
  const salaryText = salaryRaw ? await jhDecodeSalary(salaryRaw) : null;
  job.salary.range = salaryText;
  if (salaryText) {
    const mc = salaryText.match(/(\d+)薪/);
    if (mc) job.salary.monthly_count = parseInt(mc[1]);
  }

  // 城市 / 经验 / 学历：从 tag-list li 逐项识别
  const tagItems = txtAll(".tag-list li", root);
  tagItems.forEach(t => {
    if (/\d+年|应届/.test(t) && !job.requirements.experience) job.requirements.experience = t;
    if (/本科|硕士|博士|大专|学历|不限/.test(t) && !job.requirements.education) job.requirements.education = t;
  });
  const cityTag = tagItems.find(t => !/\d+年|应届|本科|硕士|博士|大专|学历|不限/.test(t));
  if (cityTag) job.location.city = cityTag;

  // 区：从详细地址中提取
  const addrDesc = txt(".job-address-desc", root);
  if (addrDesc) {
    const cityName = job.location.city || "";
    const strippedAddr = (cityName && addrDesc.startsWith(cityName))
      ? addrDesc.slice(cityName.length) : addrDesc;
    const dm = strippedAddr.match(/^[一-龥]{2,4}(区|县)/);
    if (dm) job.location.district = dm[0];
  }

  // 福利标签 & 岗位标签
  job.benefits = txtAll(".job-label-list li", root);
  job.tags = tagItems;

  // 岗位描述：innerText 过滤 Boss 注入的 CSS 噪声（p.desc 里有隐藏 span）
  const descEl = root.querySelector("p.desc");
  if (descEl) {
    const raw = (descEl.innerText || "").trim();
    if (raw.length > 20) {
      const splitRe = /(职位要求|任职要求|岗位要求|任职资格|要求[:：])/;
      const m = raw.split(splitRe);
      if (m.length >= 3) {
        job.job_description = m[0].trim();
        job.job_requirements = m.slice(2).join("").replace(/^[：:\s]+/, "").trim();
      } else {
        job.job_description = raw;
      }
    }
  }

  // 公司名 + HR 职位：boss-info-attr 格式为「公司名 · HR职位」
  const bossAttr = txt(".boss-info-attr", root);
  if (bossAttr) {
    const parts = bossAttr.split(/\s*[·・]\s*/);
    job.company.name = parts[0] ? parts[0].trim() : null;
    job.hr.title    = parts[1] ? parts[1].trim() : null;
  }

  // HR 姓名：h2.name 含「姓名 活跃状态」，去掉后半段
  // .boss-active-time 可能不存在，用正则兜底去掉「在线/刚刚/N分钟前」等活跃文字
  const hrActiveText = txt(".boss-active-time", root);
  const hrNameEl = root.querySelector(".job-boss-info h2.name");
  if (hrNameEl) {
    let name = (hrNameEl.innerText || hrNameEl.textContent).trim();
    if (hrActiveText) {
      name = name.replace(hrActiveText, "").trim();
    } else {
      // 兜底：按换行切割，只取第一段（姓名行）
      name = name.split("\n")[0].trim();
    }
    job.hr.name = name || null;
    if (!hrActiveText) {
      // 从 name 元素的第二行提取活跃状态
      const lines = (hrNameEl.innerText || hrNameEl.textContent).trim().split("\n");
      if (lines.length > 1) job.hr.active_status = lines[1].trim() || null;
    }
  }
  if (!job.hr.active_status) job.hr.active_status = hrActiveText || null;
}

// ── kanzhun 字体 PUA 字符解码（薪资反爬绕过）────────────────────────────────
// Boss 直聘用 kanzhun-Regular 自定义字体把私有区字符（U+E031-U+E03A）渲染成数字。
// 字体 cmap 表中只有 PUA 字符条目，无 ASCII '0'-'9' 条目。
// 通过分析实测数据发现线性映射：digit = codepoint - 0xE031
//   U+E031 → '0', U+E032 → '1', ..., U+E03A → '9'
// 此映射编码于静态 TTF 文件（2022 年起未变动），直接算术解码，无需网络请求或 Canvas。

function jhDecodePUADigit(code) {
  // kanzhun-Regular 数字 PUA 区：U+E031-U+E03A → '0'-'9'
  if (code >= 0xE031 && code <= 0xE03A) return String(code - 0xE031);
  return null; // 未知 PUA 字符
}

async function jhDecodeSalary(rawText) {
  const chars = Array.from(rawText);
  const hasPUA = chars.some(c => { const n = c.charCodeAt(0); return n >= 0xE000 && n <= 0xF8FF; });
  if (!hasPUA) return rawText;

  let result = '';
  for (const ch of chars) {
    const code = ch.charCodeAt(0);
    if (code < 0xE000 || code > 0xF8FF) { result += ch; continue; }
    const d = jhDecodePUADigit(code);
    result += (d !== null) ? d : '?';
  }
  return result;
}


// ── 所有 DOM 用 createElement + textContent，禁用 innerHTML ──────────────

function jhShowToast(msg) {
  let t = document.getElementById("jh-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "jh-toast";
    document.body.appendChild(t);
  }
  const btn = document.getElementById("jh-fab");
  if (btn) jhPositionToast(t, btn);
  t.textContent = msg;
  t.classList.add("jh-show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("jh-show"), 1800);
}

function jhSetFabContent(btn, icon, label, saved) {
  // 清空再填，避免 innerHTML
  while (btn.firstChild) btn.removeChild(btn.firstChild);
  const iconSpan = document.createElement("span");
  iconSpan.textContent = icon;
  btn.appendChild(iconSpan);
  btn.appendChild(document.createTextNode(label));
  btn.classList.toggle("jh-saved", !!saved);
}

async function jhRefreshFabState(btn) {
  const id = jhExtractExternalId();
  if (!id) return;
  const saved = await jhHasJob(id);
  if (saved) jhSetFabContent(btn, "✅", "已收藏（点击取消）", true);
  else jhSetFabContent(btn, "⭐", "加入清单", false);
}

async function jhOnFabClick(btn) {
  const id = jhExtractExternalId();
  if (!id) { jhShowToast("未能识别岗位 ID"); return; }
  const saved = await jhHasJob(id);
  if (saved) {
    await jhRemoveJob(id);
    jhShowToast("已从清单移除");
  } else {
    const job = await jhParseBossDetailPage();
    if (!job.title) { jhShowToast("岗位标题未抓到，请刷新页面后重试"); return; }
    const count = await jhUpsertJob(job);
    jhShowToast(`已收藏（共 ${count} 个）`);
  }
  await jhRefreshFabState(btn);
}

function jhMountFab() {
  if (document.getElementById("jh-fab")) return;
  const btn = document.createElement("button");
  btn.id = "jh-fab";
  jhSetFabContent(btn, "⭐", "加入清单", false);
  btn.addEventListener("click", () => jhOnFabClick(btn));
  document.body.appendChild(btn);
  jhMakeDraggable(btn, "jh-fab-pos");
  jhRefreshFabState(btn);
  jhOnStorageChange(() => jhRefreshFabState(btn));
}

jhMountFab();

// 监听 SPA 路由变化 + 分栏模式下的面板内容切换
let __jhLastUrl = location.href;
let __jhLastJobId = jhExtractExternalId();
let __jhObsTimer = null;

new MutationObserver(() => {
  // 节流：300ms 内只触发一次检查
  if (__jhObsTimer) return;
  __jhObsTimer = setTimeout(() => {
    __jhObsTimer = null;

    const currentUrl = location.href;
    if (currentUrl !== __jhLastUrl) {
      __jhLastUrl = currentUrl;
      // SPA 跳转到单独详情页
      if (/job_detail\//.test(location.pathname)) {
        const existing = document.getElementById("jh-fab");
        if (existing) jhRefreshFabState(existing);
        else jhMountFab();
        __jhLastJobId = jhExtractExternalId();
        return;
      }
    }

    // 分栏模式：右侧面板切换了新岗位时刷新 FAB 状态
    const currentId = jhExtractExternalId();
    if (currentId && currentId !== __jhLastJobId) {
      __jhLastJobId = currentId;
      const existing = document.getElementById("jh-fab");
      if (existing) jhRefreshFabState(existing);
      else jhMountFab();
    }
  }, 300);
}).observe(document.body, { childList: true, subtree: true });
