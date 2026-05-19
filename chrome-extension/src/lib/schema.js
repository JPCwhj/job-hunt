// chrome-extension/src/lib/schema.js
const JH_SCHEMA = {
  FORMAT: "job-hunt-jobs",
  VERSION: "1",
  SOURCE_BOSS: "chrome-extension-boss",   // 保留兼容旧数据
  SOURCE: "chrome-extension",             // 多平台通用
  STORAGE_KEY: "jh_jobs_v1"
};

function jhEmptyJob() {
  return {
    platform: "boss",
    external_id: null,
    url: null,
    title: null,
    company: { name: null, size: null, industry: null, stage: null },
    salary: { range: null, monthly_count: null },
    location: { city: null, district: null },
    requirements: { experience: null, education: null },
    tags: [],
    benefits: [],
    hr: { name: null, title: null, active_status: null },
    posted_at: null,
    job_description: null,
    job_requirements: null,
    company_intro: null,
    saved_at: null
  };
}

function jhCompanySizeCode(text) {
  if (!text) return null;
  const s = String(text);
  if (s.includes("10000")) return "F";
  if (s.includes("1000")) return "E";
  if (s.includes("500")) return "D";
  if (s.includes("100")) return "C";
  if (s.includes("20")) return "B";
  return "A";
}

globalThis.JH_SCHEMA = JH_SCHEMA;
globalThis.jhEmptyJob = jhEmptyJob;
globalThis.jhCompanySizeCode = jhCompanySizeCode;
