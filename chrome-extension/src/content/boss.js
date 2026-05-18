// chrome-extension/src/content/boss.js

function txt(selector, root) {
  const el = (root || document).querySelector(selector);
  return el ? el.textContent.trim() : null;
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

function jhParseBossDetailPage() {
  const job = jhEmptyJob();
  job.platform = "boss";
  job.saved_at = new Date().toISOString();
  job.external_id = jhExtractExternalId();

  // 分栏模式下把解析范围限制在右侧面板，避免抓到左侧列表的同名元素
  const root = jhFindRightPanel() || document;

  // job URL：优先用面板里的 job_detail 链接（分栏模式），否则用当前页 URL
  const detailLink = root.querySelector('a[href*="/job_detail/"]');
  job.url = (detailLink && detailLink.href) || location.href;

  job.title = txt(".job-name", root) || txt(".name h1", root) || txt("h1", root);
  job.salary.range = txt(".job-salary", root) || txt(".salary", root);

  const primary = root.querySelector(".job-primary, .info-primary");
  if (primary) {
    const tags = txtAll("p, span", primary);
    tags.forEach(t => {
      if (/经验|应届|年/.test(t) && !job.requirements.experience) job.requirements.experience = t;
      if (/本科|硕士|博士|大专|学历|不限/.test(t) && !job.requirements.education) job.requirements.education = t;
    });
  }

  const locText = txt(".location-address", root) || txt(".job-location", root);
  if (locText) {
    const parts = locText.split(/[·\s\-]+/).filter(Boolean);
    job.location.city = parts[0] || null;
    job.location.district = parts[1] || null;
  }

  job.benefits = txtAll(".job-tags span, .tag-list span", root);
  job.tags = txtAll(".job-keyword-list li, .job-detail-section .tag", root);

  const detailText = txt(".job-sec-text", root) || txt(".job-detail-section .text", root) || txt(".job-detail", root);
  if (detailText) {
    const splitRe = /(任职要求|岗位要求|任职资格|要求[:：])/;
    const m = detailText.split(splitRe);
    if (m.length >= 3) {
      job.job_description = m[0].trim();
      job.job_requirements = m.slice(2).join("").trim();
    } else {
      job.job_description = detailText;
    }
  }

  job.company.name = txt(".company-info .name", root) || txt(".sider-company .name", root) || txt(".job-company-info h3", root);
  const sizeText = txt(".company-info .size", root) || txt(".sider-company .size", root);
  job.company.size = jhCompanySizeCode(sizeText);
  job.company.industry = txt(".company-info .industry", root) || txt(".sider-company .industry", root);
  job.company.stage = txt(".company-info .stage", root) || txt(".sider-company .stage", root);
  job.company_intro = txt(".job-sec-company .text", root) || txt(".company-intro", root);

  job.hr.name = txt(".job-author .name", root) || txt(".boss-info .name", root);
  job.hr.title = txt(".job-author .position", root) || txt(".boss-info .position", root);
  job.hr.active_status = txt(".job-author .active-time", root) || txt(".boss-info .active-status", root);

  job.posted_at = txt(".job-author .time", root) || txt(".job-detail-section .time", root);

  return job;
}

globalThis.jhParseBossDetailPage = jhParseBossDetailPage;
globalThis.jhExtractExternalId = jhExtractExternalId;
globalThis.jhFindRightPanel = jhFindRightPanel;

// 追加到 boss.js 末尾。所有 DOM 用 createElement + textContent，禁用 innerHTML

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
    const job = jhParseBossDetailPage();
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
