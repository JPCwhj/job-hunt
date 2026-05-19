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

function jhSendDiag(data) {
  try { chrome.runtime.sendMessage({ type: "jh-diag", data }); } catch(e) {}
}

async function jhParseBossDetailPage() {
  const job = jhEmptyJob();
  job.platform = "boss";
  job.saved_at = new Date().toISOString();
  job.external_id = jhExtractExternalId();

  // 分栏模式下把解析范围限制在右侧面板，避免抓到左侧列表的同名元素
  const panel = jhFindRightPanel();
  const root = panel || document;

  // 诊断：看详情页上能找到哪些关键元素
  jhSendDiag({
    url: location.href,
    panelFound: !!panel,
    panelClass: panel ? panel.className : null,
    jobNameEl: !!document.querySelector(".job-name"),
    jobNameInPanel: panel ? !!panel.querySelector(".job-name") : null,
    jobSalaryEl: !!document.querySelector(".job-salary"),
    primaryTitle: document.title,
    h1s: Array.from(document.querySelectorAll("h1")).map(e => e.textContent.trim()).slice(0,5),
    jobDetailMain: !!document.querySelector(".job-detail-main"),
    jobPrimaryBox: !!document.querySelector(".job-primary"),
    jobDetailSection: !!document.querySelector(".job-detail-section"),
  });

  // job URL：优先用面板里的 job_detail 链接（分栏模式），否则用当前页 URL
  const detailLink = root.querySelector('a[href*="/job_detail/"]');
  job.url = (detailLink && detailLink.href) || location.href;

  // ── 标题 & 薪资 ─────────────────────────────────────────────────────────
  // Boss 薪资用 kanzhun-mix 字体做 PUA 字符混淆，需 Canvas 解码
  job.title = innerTxt(".job-name", root);
  const salaryRaw = innerTxt(".job-salary", root);
  const salaryText = salaryRaw ? await jhDecodeSalary(salaryRaw) : null;
  job.salary.range = salaryText;
  if (salaryText) {
    const mc = salaryText.match(/(\d+)薪/);
    if (mc) job.salary.monthly_count = parseInt(mc[1]);
  }

  // ── 城市 / 经验 / 学历：从 tag-list li 逐项识别 ─────────────────────────
  const tagItems = txtAll(".tag-list li", root);
  tagItems.forEach(t => {
    if (/\d+年|应届/.test(t) && !job.requirements.experience) job.requirements.experience = t;
    if (/本科|硕士|博士|大专|学历|不限/.test(t) && !job.requirements.education) job.requirements.education = t;
  });
  // 城市：第一个不匹配经验/学历模式的 tag 项
  const cityTag = tagItems.find(
    t => !/\d+年|应届|本科|硕士|博士|大专|学历|不限/.test(t)
  );
  if (cityTag) job.location.city = cityTag;

  // 区：从详细地址中提取（如"杭州滨江区中威大厦1313室" → "滨江区"）
  // 先去掉城市名前缀，避免贪心匹配多吃（"杭州滨江区" → "滨江区"）
  const addrDesc = txt(".job-address-desc", root);
  if (addrDesc) {
    const cityName = job.location.city || "";
    const strippedAddr = (cityName && addrDesc.startsWith(cityName))
      ? addrDesc.slice(cityName.length)
      : addrDesc;
    const dm = strippedAddr.match(/^[一-龥]{2,4}(区|县)/);
    if (dm) job.location.district = dm[0];
  }

  // ── 福利标签 & 岗位标签 ──────────────────────────────────────────────────
  job.benefits = txtAll(".job-label-list li", root);
  job.tags = tagItems;

  // ── 岗位描述：用 innerText 过滤 Boss 注入的 CSS 噪声 ────────────────────
  // Boss 在 p.desc 里嵌入 <style>/.tiny-span{} 来干扰文字提取，innerText 可过滤
  const descEl = root.querySelector("p.desc");
  if (descEl) {
    const raw = (descEl.innerText || "").trim();
    if (raw.length > 20) {
      const splitRe = /(任职要求|岗位要求|任职资格|要求[:：])/;
      const m = raw.split(splitRe);
      if (m.length >= 3) {
        job.job_description = m[0].trim();
        job.job_requirements = m.slice(2).join("").replace(/^[：:\s]+/, "").trim();
      } else {
        job.job_description = raw;
      }
    }
  }

  // ── 公司名 + HR 职位：boss-info-attr 格式为「公司名 · HR职位」 ────────────
  const bossAttr = txt(".boss-info-attr", root);
  if (bossAttr) {
    const parts = bossAttr.split(/\s*[·・]\s*/);
    job.company.name = parts[0] ? parts[0].trim() : null;
    job.hr.title = parts[1] ? parts[1].trim() : null;
  }

  // ── HR 姓名：h2.name 含「姓名 活跃状态」，去掉后半段 ───────────────────
  const hrActiveText = txt(".boss-active-time", root);
  const hrNameEl = root.querySelector(".job-boss-info h2.name");
  if (hrNameEl) {
    let name = (hrNameEl.innerText || hrNameEl.textContent).trim();
    if (hrActiveText) name = name.replace(hrActiveText, "").trim();
    job.hr.name = name || null;
  }
  job.hr.active_status = hrActiveText;

  return job;
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
  t.textContent = msg;
  t.classList.add("jh-show");
  setTimeout(() => t.classList.remove("jh-show"), 1800);
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
  jhRefreshFabState(btn);
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
