// chrome-extension/src/content/51job.js
// 前程无忧岗位详情页解析 + 收藏按钮

// ============ 工具函数 ============

function jh51ExtractExternalId() {
  // pathname: /hangzhou-scq/172135092.html
  const m = location.pathname.match(/\/(\d+)\.html/);
  return m ? m[1] : null;
}

function jh51InnerTxt(selector, root) {
  const el = (root || document).querySelector(selector);
  return el ? (el.innerText || el.textContent || "").trim() : null;
}

// ============ 页面解析 ============

async function jh51ParsePage() {
  const job = jhEmptyJob();
  job.platform = "51job";
  job.saved_at = new Date().toISOString();
  job.external_id = jh51ExtractExternalId();
  job.url = location.href;

  // 职位名
  job.title = jh51InnerTxt("h1");

  // 薪资：从 .cn 第二行提取，格式如 "1.5-3万·13薪" 或 "1-1.5万"
  const cnEl = document.querySelector(".cn");
  if (cnEl) {
    const lines = (cnEl.innerText || "").split("\n").map(l => l.trim()).filter(l => l);
    // lines[0] = 职位名（同 h1），lines[1] = 薪资行
    const salaryLine = lines[1] || "";
    const dotIdx = salaryLine.indexOf("·");
    if (dotIdx > -1) {
      job.salary.range = salaryLine.slice(0, dotIdx).trim();
      const mc = salaryLine.match(/(\d+)薪/);
      if (mc) job.salary.monthly_count = parseInt(mc[1]);
    } else if (salaryLine) {
      job.salary.range = salaryLine;
    }
  }

  // 城市 / 经验 / 学历：.msg.ltype = "杭州-上城区  |  5年及以上  |  本科"
  const ltypeEl = document.querySelector(".msg.ltype");
  if (ltypeEl) {
    const parts = (ltypeEl.innerText || "").split("|").map(p => p.trim()).filter(p => p);
    if (parts[0]) {
      const loc = parts[0].split("-");
      job.location.city     = loc[0]?.trim() || null;
      job.location.district = loc[1]?.trim() || null;
    }
    if (parts[1]) job.requirements.experience = parts[1];
    if (parts[2]) job.requirements.education  = parts[2];
  }

  // 公司名：.com_name（class 含 com_name 的首个元素）
  const comNameEl = document.querySelector("[class*='com_name']");
  if (comNameEl) job.company.name = (comNameEl.innerText || "").trim() || null;

  // 公司属性：.com_tag = "民营\n\n150-500人\n\n家居/家具/家电"
  const comTagEl = document.querySelector(".com_tag");
  if (comTagEl) {
    const lines = (comTagEl.innerText || "").split("\n").map(l => l.trim()).filter(l => l);
    for (const l of lines) {
      if (/民营|国企|外资|合资|上市公司|独资|事业单位|政府机构/.test(l)) {
        job.company.stage = l;
      } else if (/\d+-\d+人|人以上|\d+人$/.test(l)) {
        job.company.size = l;
      } else if (!job.company.industry) {
        job.company.industry = l;
      }
    }
  }

  // HR 姓名：.iname
  const inameEl = document.querySelector(".iname");
  if (inameEl) job.hr.name = (inameEl.innerText || "").trim() || null;

  // HR 职称：.itag 中 "·" 之前部分去掉公司名关键词，通常是 "XX公司HR"，取 title = "HR"
  const itagEl = document.querySelector(".itag");
  if (itagEl) {
    const raw = (itagEl.innerText || "").trim();
    const dotIdx = raw.indexOf("·");
    if (dotIdx > -1) {
      job.hr.title       = raw.slice(0, dotIdx).trim() || null;
      job.hr.active_status = raw.slice(dotIdx + 1).trim() || null;
    } else {
      job.hr.active_status = raw || null;
    }
  }

  // 岗位描述：.bmsg.job_msg（首个），按任职要求关键词分割
  const descEl = document.querySelector(".bmsg.job_msg");
  if (descEl) {
    const fullText = (descEl.innerText || "").trim();
    const splitRe = /(任职要求|任职资格|岗位要求|职位要求|要求[:：])/;
    const parts = fullText.split(splitRe);
    if (parts.length >= 3) {
      job.job_description  = parts[0].replace(/^岗位职责\s*[：:]\s*/i, "").trim();
      // 截断末尾的「职能类别」「上班地址」等页面附加标签
      job.job_requirements = parts.slice(2).join("")
        .replace(/^[：:\s]+/, "")
        .replace(/\n+职能类别[：:][\s\S]*$/i, "")
        .replace(/\n+上班地址[：:][\s\S]*$/i, "")
        .trim();
    } else {
      job.job_description = fullText
        .replace(/^岗位职责\s*[：:]\s*/i, "")
        .replace(/\n+职能类别[：:][\s\S]*$/i, "")
        .replace(/\n+上班地址[：:][\s\S]*$/i, "")
        .trim();
    }
  }

  // 福利标签：.jtag（可能为空）
  const jtagEl = document.querySelector(".jtag");
  if (jtagEl) {
    const text = (jtagEl.innerText || "").trim();
    if (text) {
      job.benefits = text.split(/[\n,，、]/).map(t => t.trim()).filter(t => t);
    }
  }

  return job;
}

// ============ FAB 按钮 ============

function jh51ShowToast(msg) {
  let toast = document.getElementById("jh51-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "jh51-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add("jh51-show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("jh51-show"), 2200);
}

function jh51SetFabContent(btn, icon, label, saved) {
  btn.textContent = "";
  const span = document.createElement("span");
  span.textContent = icon + " " + label;
  btn.appendChild(span);
  if (saved) btn.classList.add("jh51-saved");
  else btn.classList.remove("jh51-saved");
}

async function jh51RefreshFabState(btn) {
  const id = jh51ExtractExternalId();
  if (!id) return;
  const saved = await jhHasJob(id);
  if (saved) jh51SetFabContent(btn, "✅", "已收藏（点击取消）", true);
  else jh51SetFabContent(btn, "⭐", "加入清单", false);
}

async function jh51OnFabClick(btn) {
  const id = jh51ExtractExternalId();
  if (!id) { jh51ShowToast("未能识别岗位 ID"); return; }
  const saved = await jhHasJob(id);
  if (saved) {
    await jhRemoveJob(id);
    jh51ShowToast("已从清单移除");
  } else {
    const job = await jh51ParsePage();
    if (!job.title) { jh51ShowToast("岗位标题未抓到，请刷新后重试"); return; }
    const count = await jhUpsertJob(job);
    jh51ShowToast(`已收藏（共 ${count} 个）`);
  }
  await jh51RefreshFabState(btn);
}

function jh51MountFab() {
  if (document.getElementById("jh51-fab")) return;
  const btn = document.createElement("button");
  btn.id = "jh51-fab";
  jh51SetFabContent(btn, "⭐", "加入清单", false);
  btn.addEventListener("click", () => jh51OnFabClick(btn));
  document.body.appendChild(btn);
  jh51RefreshFabState(btn);
}

// ============ 初始化 ============

// 51job 详情页是完整页面跳转，无 SPA，直接挂载
jh51MountFab();
