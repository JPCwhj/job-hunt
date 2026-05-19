// chrome-extension/src/content/liepin.js
// 猎聘岗位详情页解析 + 收藏按钮

// ============ 工具函数 ============

function jhLpExtractExternalId() {
  // pathname: /job/1982439527.shtml
  const m = location.pathname.match(/\/job\/([^.]+)\.shtml/i);
  return m ? m[1] : null;
}

function jhLpInnerTxt(selector, root) {
  const el = (root || document).querySelector(selector);
  return el ? (el.innerText || el.textContent || "").trim() : null;
}

// ============ 页面解析 ============

async function jhLpParsePage() {
  const job = jhEmptyJob();
  job.platform = "liepin";
  job.saved_at = new Date().toISOString();
  job.external_id = jhLpExtractExternalId();
  job.url = location.href;

  // 职位名
  job.title = jhLpInnerTxt(".job-title.ellipsis-2");

  // 薪资：.salary → "18-30k·18薪"
  const salaryEl = document.querySelector(".salary");
  if (salaryEl) {
    const salaryLine = (salaryEl.innerText || "").trim();
    const dotIdx = salaryLine.indexOf("·");
    if (dotIdx > -1) {
      job.salary.range = salaryLine.slice(0, dotIdx).trim();
      const mc = salaryLine.match(/(\d+)薪/);
      if (mc) job.salary.monthly_count = parseInt(mc[1]);
    } else if (salaryLine && salaryLine !== "薪资面议") {
      job.salary.range = salaryLine;
    }
  }

  // 城市/经验/学历：.job-apply-container 第三行
  // 格式："高级人力资源经理\n18-30k·18薪\n上海-浦东新区  5年以上  统招本科  招1人  5月11日更新\n..."
  const applyEl = document.querySelector(".job-apply-container");
  if (applyEl) {
    const lines = (applyEl.innerText || "").split("\n").map(l => l.trim()).filter(l => l);
    // 找包含城市/经验/学历的行（含 "年" 或 "本科/大专/硕士"）
    const metaLine = lines.find(l =>
      /年以上|年经验|应届/.test(l) || /本科|大专|硕士|博士|不限/.test(l)
    );
    if (metaLine) {
      const parts = metaLine.split(/\s{2,}|\t/).map(p => p.trim()).filter(p => p);
      // parts[0] = "上海-浦东新区"，parts[1] = "5年以上"，parts[2] = "统招本科"
      if (parts[0]) {
        const cityParts = parts[0].split("-");
        job.location.city     = cityParts[0] || null;
        job.location.district = cityParts[1] || null;
      }
      if (parts[1]) job.requirements.experience = parts[1];
      if (parts[2]) job.requirements.education  = parts[2];
    }
  }

  // HR + 公司信息：.content
  // 格式："常先生 3分钟前在线 已认证\n人力行政总监 · 诚泰租赁"
  const contentEl = document.querySelector(".content");
  if (contentEl) {
    const lines = (contentEl.innerText || "").split("\n").map(l => l.trim()).filter(l => l);
    if (lines[0]) {
      // 姓名 = 第一个空格前的词
      const spaceIdx = lines[0].indexOf(" ");
      job.hr.name = spaceIdx > -1 ? lines[0].slice(0, spaceIdx) : lines[0];
      // 活跃状态：处理"分钟/小时/天"等多字单位
      const activeMatch = lines[0].match(/([\d]+(?:分钟|小时|天|月)前在线|当前在线|刚刚在线|今日活跃|[\d]+天内活跃)/);
      if (activeMatch) job.hr.active_status = activeMatch[1];
    }
    if (lines[1]) {
      // "人力行政总监 · 诚泰租赁" → HR职称取"·"前，公司名取"·"后
      const dotParts = lines[1].split("·").map(s => s.trim());
      job.hr.title    = dotParts[0] || null;
      job.company.name = dotParts[1] || null;
    }
  }

  // 福利/标签：.job-apply-container-desc span
  const descSection = document.querySelector(".job-apply-container-desc");
  if (descSection) {
    job.tags = Array.from(descSection.querySelectorAll("span"))
      .map(el => (el.innerText || el.textContent || "").trim())
      .filter(t => t);
    // 若 span 为空则直接拆文字
    if (!job.tags.length) {
      job.tags = (descSection.innerText || "").trim().split(/\s+/).filter(t => t);
    }
  }

  // 岗位描述：.job-intro-container
  // 格式："职位介绍\n职责描述：\n...\n任职要求：\n..."
  const introEl = document.querySelector(".job-intro-container");
  if (introEl) {
    const fullText = (introEl.innerText || "").trim()
      .replace(/^职位介绍\s*/i, "");  // 去掉顶部标题

    function stripTrailingNoise(text) {
      // 去掉末尾的"其他信息 行业要求：..."等猎聘页脚噪声
      return text.replace(/\n*其他信息[\s\S]*$/i, "").trim();
    }
    function cleanDesc(text) {
      return stripTrailingNoise(
        text
          .replace(/^(职责描述|岗位职责|职位描述|工作职责)\s*[：:\s]*/i, "")
          .replace(/\s*【\s*$/, "")
          .trim()
      );
    }
    function cleanReqs(text) {
      return stripTrailingNoise(
        text
          .replace(/^(任职要求|任职资格要求?|岗位要求|职位要求|Requirements)\s*[：:.]?\s*/i, "")
          .replace(/^[】\s：:]+/, "")
          .trim()
      );
    }

    // 按行找第一个以中文/英文要求关键词开头的行（避免匹配正文中间）
    const lines = fullText.split("\n");
    const splitIdx = lines.findIndex(l =>
      /^(任职要求|任职资格|岗位要求|职位要求|Requirements)\s*[：:.]?/i.test(l.trim())
    );

    if (splitIdx > -1) {
      job.job_description  = cleanDesc(lines.slice(0, splitIdx).join("\n"));
      job.job_requirements = cleanReqs(lines.slice(splitIdx).join("\n"));
    } else {
      job.job_description = stripTrailingNoise(cleanDesc(fullText));
    }
  }

  // 公司属性（industry/size/stage）：页面右侧 ASIDE 面板
  // 格式："企业行业： 基金/证券/期货\n人数规模： 500-999人\n融资情况： 已上市\n..."
  const asideEl = document.querySelector("aside");
  if (asideEl) {
    const asideTxt = (asideEl.innerText || "");
    const matchLabel = (label) => {
      const m = asideTxt.match(new RegExp(label + "\\s*[：:]\\s*([^\\n]+)"));
      return m ? m[1].trim() : null;
    };
    job.company.industry = matchLabel("企业行业");
    job.company.size     = matchLabel("人数规模");
    job.company.stage    = matchLabel("融资情况") || matchLabel("融资阶段");
  }

  return job;
}

// ============ FAB 按钮 ============

function jhLpShowToast(msg) {
  let toast = document.getElementById("jh-lp-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "jh-lp-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add("jh-lp-show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("jh-lp-show"), 2200);
}

function jhLpSetFabContent(btn, icon, label, saved) {
  btn.textContent = "";
  const span = document.createElement("span");
  span.textContent = icon + " " + label;
  btn.appendChild(span);
  if (saved) btn.classList.add("jh-lp-saved");
  else btn.classList.remove("jh-lp-saved");
}

async function jhLpRefreshFabState(btn) {
  const id = jhLpExtractExternalId();
  if (!id) return;
  const saved = await jhHasJob(id);
  if (saved) jhLpSetFabContent(btn, "✅", "已收藏（点击取消）", true);
  else jhLpSetFabContent(btn, "⭐", "加入清单", false);
}

async function jhLpOnFabClick(btn) {
  const id = jhLpExtractExternalId();
  if (!id) { jhLpShowToast("未能识别岗位 ID"); return; }
  const saved = await jhHasJob(id);
  if (saved) {
    await jhRemoveJob(id);
    jhLpShowToast("已从清单移除");
  } else {
    const job = await jhLpParsePage();
    if (!job.title) { jhLpShowToast("岗位标题未抓到，请刷新后重试"); return; }
    const count = await jhUpsertJob(job);
    jhLpShowToast(`已收藏（共 ${count} 个）`);
  }
  await jhLpRefreshFabState(btn);
}

function jhLpMountFab() {
  if (document.getElementById("jh-lp-fab")) return;
  const btn = document.createElement("button");
  btn.id = "jh-lp-fab";
  jhLpSetFabContent(btn, "⭐", "加入清单", false);
  btn.addEventListener("click", () => jhLpOnFabClick(btn));
  document.body.appendChild(btn);
  jhLpRefreshFabState(btn);
}

// ============ 初始化 ============

jhLpMountFab();
