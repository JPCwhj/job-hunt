// chrome-extension/src/popup/popup.js
const state = { jobs: [], selected: new Set() };

function jobKey(j) { return j.external_id || j.url; }

function formatMeta(j) {
  const parts = [];
  if (j.company && j.company.name) parts.push(j.company.name);
  if (j.salary && j.salary.range) parts.push(j.salary.range);
  if (j.location && j.location.city) parts.push(j.location.city);
  return parts.join(" · ");
}

function clearChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function buildEmptyView() {
  const empty = document.createElement("div");
  empty.className = "jh-empty";
  empty.appendChild(document.createTextNode("还没有收藏岗位。"));
  empty.appendChild(document.createElement("br"));
  empty.appendChild(document.createTextNode('到 Boss 详情页右下角点"⭐ 加入清单"。'));
  return empty;
}

function buildItem(job) {
  const key = jobKey(job);
  const item = document.createElement("div");
  item.className = "jh-item";

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.dataset.key = key;
  cb.checked = state.selected.has(key);
  cb.addEventListener("change", () => {
    if (cb.checked) state.selected.add(key);
    else state.selected.delete(key);
    updateExportButton();
  });
  item.appendChild(cb);

  const main = document.createElement("div");
  main.className = "jh-item-main";
  const title = document.createElement("div");
  title.className = "jh-item-title";
  title.textContent = job.title || "(未识别岗位)";
  main.appendChild(title);
  const meta = document.createElement("div");
  meta.className = "jh-item-meta";
  meta.textContent = formatMeta(job);
  main.appendChild(meta);
  item.appendChild(main);

  const rm = document.createElement("button");
  rm.className = "jh-item-remove";
  rm.title = "移除";
  rm.textContent = "×";
  rm.addEventListener("click", async (e) => {
    e.stopPropagation();
    await jhRemoveJob(key);
    state.selected.delete(key);
    state.jobs = await jhLoadJobs();
    render();
  });
  item.appendChild(rm);

  return item;
}

function render() {
  const list = document.getElementById("jh-list");
  document.getElementById("jh-count").textContent = state.jobs.length;
  clearChildren(list);

  if (state.jobs.length === 0) {
    list.appendChild(buildEmptyView());
    updateExportButton();
    return;
  }
  for (const job of state.jobs) {
    list.appendChild(buildItem(job));
  }
  updateExportButton();
}

function updateExportButton() {
  const btn = document.getElementById("jh-export");
  btn.textContent = `📥 导出选中的 ${state.selected.size} 个`;
  btn.disabled = state.selected.size === 0;
}

function buildExportPayload() {
  const jobs = state.jobs.filter(j => state.selected.has(jobKey(j)));
  return {
    format: JH_SCHEMA.FORMAT,
    version: JH_SCHEMA.VERSION,
    source: JH_SCHEMA.SOURCE,
    exported_at: new Date().toISOString(),
    jobs: jobs
  };
}

function buildFilename(n) {
  const d = new Date();
  const pad = x => String(x).padStart(2, "0");
  const ts = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `boss-jobs-${ts}-${n}条.jobs.json`;
}

function onExportClick() {
  if (state.selected.size === 0) return;
  const payload = buildExportPayload();
  const jsonText = JSON.stringify(payload, null, 2);
  const filename = buildFilename(payload.jobs.length);

  chrome.runtime.sendMessage(
    { type: "jh-export", filename, jsonText },
    (resp) => {
      const lastErr = chrome.runtime.lastError;
      const btn = document.getElementById("jh-export");
      if (resp && resp.ok) {
        btn.textContent = `✅ 已导出 ${payload.jobs.length} 个，查看 Downloads`;
        setTimeout(updateExportButton, 2500);
      } else {
        const errMsg = (resp && resp.error) || (lastErr && lastErr.message) || "未知错误";
        btn.textContent = `❌ 导出失败：${errMsg}`;
        setTimeout(updateExportButton, 3500);
      }
    }
  );
}

async function onSelectAllClick() {
  if (state.selected.size === state.jobs.length) state.selected.clear();
  else state.selected = new Set(state.jobs.map(jobKey));
  render();
}

async function onClearClick() {
  if (state.jobs.length === 0) return;
  if (!confirm(`确认清空全部 ${state.jobs.length} 个收藏？此操作不可撤销。`)) return;
  await jhClearJobs();
  state.jobs = [];
  state.selected.clear();
  render();
}

async function init() {
  state.jobs = await jhLoadJobs();
  state.selected = new Set(state.jobs.map(jobKey));
  render();
  document.getElementById("jh-export").addEventListener("click", onExportClick);
  document.getElementById("jh-select-all").addEventListener("click", onSelectAllClick);
  document.getElementById("jh-clear").addEventListener("click", onClearClick);
}

init();
