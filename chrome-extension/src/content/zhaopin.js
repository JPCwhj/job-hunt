// chrome-extension/src/content/zhaopin.js
// 智联招聘岗位详情页解析 + 收藏按钮

// ============ 工具函数 ============

function jhZpExtractExternalId() {
  // pathname: /jobdetail/CC438710630J40774284306.htm
  const m = location.pathname.match(/\/jobdetail\/([^.]+)\.htm/i);
  return m ? m[1] : null;
}

function jhZpInnerTxt(selector, root) {
  const el = (root || document).querySelector(selector);
  return el ? (el.innerText || el.textContent || "").trim() : null;
}

// ============ 页面解析 ============

async function jhZpParsePage() {
  const job = jhEmptyJob();
  job.platform = "zhaopin";
  job.saved_at = new Date().toISOString();
  job.external_id = jhZpExtractExternalId();
  job.url = location.href;

  // 职位名
  job.title = jhZpInnerTxt("h1");

  // 薪资 / 城市 / 经验 / 学历：从 .summary-planes__bottom 按行解析
  // 格式："7000-9000元\n杭州 钱塘区\n3-5年\n本科\n全职\n招1人\n..."
  const bottomEl = document.querySelector(".summary-planes__bottom");
  if (bottomEl) {
    const lines = (bottomEl.innerText || "").split("\n").map(l => l.trim()).filter(l => l);
    // line[0] = 薪资，可能含 "·13薪"
    const salaryLine = lines[0] || "";
    const dotIdx = salaryLine.indexOf("·");
    if (dotIdx > -1) {
      job.salary.range = salaryLine.slice(0, dotIdx).trim();
      const mc = salaryLine.match(/(\d+)薪/);
      if (mc) job.salary.monthly_count = parseInt(mc[1]);
    } else if (salaryLine) {
      job.salary.range = salaryLine;
    }

    // line[1] = "杭州 钱塘区" → city + district（空格分隔）
    if (lines[1]) {
      const parts = lines[1].split(/\s+/);
      job.location.city     = parts[0] || null;
      job.location.district = parts[1] || null;
    }
    // line[2] = 经验，line[3] = 学历
    if (lines[2]) job.requirements.experience = lines[2];
    if (lines[3]) job.requirements.education  = lines[3];
  }

  // 公司信息：.company-info__meta
  // 格式："杭州微控节能科技有限公司\n\n未融资 · 100-299人 · 环保  已审核"
  const compMetaEl = document.querySelector(".company-info__meta");
  if (compMetaEl) {
    const raw = (compMetaEl.innerText || "").trim();
    const metaLines = raw.split("\n").map(l => l.trim()).filter(l => l);
    job.company.name = metaLines[0] || null;
    // 第二行："未融资 · 100-299人 · 环保  已审核"
    if (metaLines[1]) {
      const attrs = metaLines[1].split("·").map(s => s.replace(/已审核/g, "").trim()).filter(s => s);
      for (const a of attrs) {
        if (/未融资|天使轮|Pre-[AB]|[A-Z]轮|上市公司|国企|外资|合资|不需要融资/.test(a)) {
          job.company.stage = a;
        } else if (/\d+-\d+人|人以上|\d+人$/.test(a)) {
          job.company.size = a;
        } else if (!job.company.industry) {
          job.company.industry = a;
        }
      }
    }
  }

  // HR 信息：.publisher-seo
  // 格式："焦龙\n今日活跃\n招聘专员\n立即沟通"
  const publisherEl = document.querySelector(".publisher-seo");
  if (publisherEl) {
    const lines = (publisherEl.innerText || "").split("\n")
      .map(l => l.trim())
      .filter(l => l && l !== "立即沟通" && l !== "职位发布者");
    job.hr.name          = lines[0] || null;
    job.hr.active_status = lines[1] || null;
    job.hr.title         = lines[2] || null;
  }

  // 岗位描述：[class*="detail"] 首个含岗位内容的元素
  const detailEl = document.querySelector("[class*='job-detail']") ||
                   document.querySelector("[class*='detail']");
  if (detailEl) {
    const fullText = (detailEl.innerText || "").trim();
    const splitRe = /(任职要求|任职资格|岗位要求|职位要求|要求[:：])/;
    const parts = fullText.split(splitRe);

    function cleanDesc(text) {
      return text
        .replace(/^(岗位职责|职位描述)\s*[：:\s]*/i, "")
        .replace(/\s*【\s*$/, "")
        .trim();
    }
    function cleanReqs(text) {
      return text
        .replace(/^[】\s：:]+/, "")
        .trim();
    }

    if (parts.length >= 3) {
      job.job_description  = cleanDesc(parts[0]);
      job.job_requirements = cleanReqs(parts.slice(2).join(""));
    } else {
      job.job_description = cleanDesc(fullText);
    }
  }

  // 职位标签：智联页面上 .jobs-deliver__tag 元素分散在当前岗位和推荐列表中，
  // 暂无可靠方式区分，留空；analyzer 不依赖此字段
  job.tags = [];

  return job;
}

// ============ FAB 按钮 ============

function jhZpShowToast(msg) {
  let toast = document.getElementById("jh-zp-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "jh-zp-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add("jh-zp-show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("jh-zp-show"), 2200);
}

function jhZpSetFabContent(btn, icon, label, saved) {
  btn.textContent = "";
  const span = document.createElement("span");
  span.textContent = icon + " " + label;
  btn.appendChild(span);
  if (saved) btn.classList.add("jh-zp-saved");
  else btn.classList.remove("jh-zp-saved");
}

async function jhZpRefreshFabState(btn) {
  const id = jhZpExtractExternalId();
  if (!id) return;
  const saved = await jhHasJob(id);
  if (saved) jhZpSetFabContent(btn, "✅", "已收藏（点击取消）", true);
  else jhZpSetFabContent(btn, "⭐", "加入清单", false);
}

async function jhZpOnFabClick(btn) {
  const id = jhZpExtractExternalId();
  if (!id) { jhZpShowToast("未能识别岗位 ID"); return; }
  const saved = await jhHasJob(id);
  if (saved) {
    await jhRemoveJob(id);
    jhZpShowToast("已从清单移除");
  } else {
    const job = await jhZpParsePage();
    if (!job.title) { jhZpShowToast("岗位标题未抓到，请刷新后重试"); return; }
    const count = await jhUpsertJob(job);
    jhZpShowToast(`已收藏（共 ${count} 个）`);
  }
  await jhZpRefreshFabState(btn);
}

function jhZpMountFab() {
  if (document.getElementById("jh-zp-fab")) return;
  const btn = document.createElement("button");
  btn.id = "jh-zp-fab";
  jhZpSetFabContent(btn, "⭐", "加入清单", false);
  btn.addEventListener("click", () => jhZpOnFabClick(btn));
  document.body.appendChild(btn);
  jhMakeDraggable(btn, "jh-fab-pos-zhaopin");
  jhZpRefreshFabState(btn);
}

// ============ 初始化 ============

jhZpMountFab();
