// chrome-extension/src/lib/storage.js
async function jhLoadJobs() {
  const data = await chrome.storage.local.get(JH_SCHEMA.STORAGE_KEY);
  return data[JH_SCHEMA.STORAGE_KEY] || [];
}

async function jhSaveJobs(jobs) {
  await chrome.storage.local.set({ [JH_SCHEMA.STORAGE_KEY]: jobs });
}

async function jhUpsertJob(job) {
  const key = job.external_id || job.url;
  if (!key) throw new Error("job 没有 external_id 或 url，无法保存");
  const jobs = await jhLoadJobs();
  const idx = jobs.findIndex(j => (j.external_id || j.url) === key);
  if (idx >= 0) jobs[idx] = job;
  else jobs.push(job);
  await jhSaveJobs(jobs);
  return jobs.length;
}

async function jhRemoveJob(key) {
  const jobs = await jhLoadJobs();
  const filtered = jobs.filter(j => (j.external_id || j.url) !== key);
  await jhSaveJobs(filtered);
  return filtered.length;
}

async function jhHasJob(key) {
  const jobs = await jhLoadJobs();
  return jobs.some(j => (j.external_id || j.url) === key);
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
