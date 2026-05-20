// chrome-extension/src/lib/storage.js

// 用 platform:external_id 作为唯一键，防止不同平台的纯数字 ID 碰撞
// 兼容旧数据：job 对象里已有 platform 字段，自动生成正确的键
function jhJobKey(j) {
  return (j.platform && j.external_id)
    ? `${j.platform}:${j.external_id}`
    : (j.external_id || j.url);
}

async function jhLoadJobs() {
  const data = await chrome.storage.local.get(JH_SCHEMA.STORAGE_KEY);
  return data[JH_SCHEMA.STORAGE_KEY] || [];
}

async function jhSaveJobs(jobs) {
  await chrome.storage.local.set({ [JH_SCHEMA.STORAGE_KEY]: jobs });
}

async function jhUpsertJob(job) {
  const key = jhJobKey(job);
  if (!key) throw new Error("job 没有 external_id 或 url，无法保存");
  const jobs = await jhLoadJobs();
  const idx = jobs.findIndex(j => jhJobKey(j) === key);
  if (idx >= 0) jobs[idx] = job;
  else jobs.push(job);
  await jhSaveJobs(jobs);
  return jobs.length;
}

async function jhRemoveJob(key) {
  const jobs = await jhLoadJobs();
  const filtered = jobs.filter(j => jhJobKey(j) !== key);
  await jhSaveJobs(filtered);
  return filtered.length;
}

async function jhHasJob(key) {
  const jobs = await jhLoadJobs();
  return jobs.some(j => jhJobKey(j) === key);
}

async function jhClearJobs() {
  await chrome.storage.local.remove(JH_SCHEMA.STORAGE_KEY);
}

function jhOnStorageChange(callback) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && JH_SCHEMA.STORAGE_KEY in changes) callback();
  });
}

globalThis.jhLoadJobs = jhLoadJobs;
globalThis.jhSaveJobs = jhSaveJobs;
globalThis.jhUpsertJob = jhUpsertJob;
globalThis.jhRemoveJob = jhRemoveJob;
globalThis.jhHasJob = jhHasJob;
globalThis.jhClearJobs = jhClearJobs;
globalThis.jhOnStorageChange = jhOnStorageChange;
