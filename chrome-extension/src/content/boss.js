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

function jhExtractExternalId() {
  const m = location.pathname.match(/job_detail\/([^.\/]+)\.html/);
  return m ? m[1] : null;
}

function jhParseBossDetailPage() {
  const job = jhEmptyJob();
  job.platform = "boss";
  job.url = location.href;
  job.external_id = jhExtractExternalId();
  job.saved_at = new Date().toISOString();

  job.title = txt(".job-name") || txt(".name h1") || txt("h1");
  job.salary.range = txt(".job-salary") || txt(".salary");

  const primary = document.querySelector(".job-primary, .info-primary");
  if (primary) {
    const tags = txtAll("p, span", primary);
    tags.forEach(t => {
      if (/经验|应届|年/.test(t) && !job.requirements.experience) job.requirements.experience = t;
      if (/本科|硕士|博士|大专|学历|不限/.test(t) && !job.requirements.education) job.requirements.education = t;
    });
  }

  const locText = txt(".location-address") || txt(".job-location");
  if (locText) {
    const parts = locText.split(/[·\s\-]+/).filter(Boolean);
    job.location.city = parts[0] || null;
    job.location.district = parts[1] || null;
  }

  job.benefits = txtAll(".job-tags span, .tag-list span");
  job.tags = txtAll(".job-keyword-list li, .job-detail-section .tag");

  const detailText = txt(".job-sec-text") || txt(".job-detail-section .text") || txt(".job-detail");
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

  job.company.name = txt(".company-info .name") || txt(".sider-company .name") || txt(".job-company-info h3");
  const sizeText = txt(".company-info .size") || txt(".sider-company .size");
  job.company.size = jhCompanySizeCode(sizeText);
  job.company.industry = txt(".company-info .industry") || txt(".sider-company .industry");
  job.company.stage = txt(".company-info .stage") || txt(".sider-company .stage");
  job.company_intro = txt(".job-sec-company .text") || txt(".company-intro");

  job.hr.name = txt(".job-author .name") || txt(".boss-info .name");
  job.hr.title = txt(".job-author .position") || txt(".boss-info .position");
  job.hr.active_status = txt(".job-author .active-time") || txt(".boss-info .active-status");

  job.posted_at = txt(".job-author .time") || txt(".job-detail-section .time");

  return job;
}

globalThis.jhParseBossDetailPage = jhParseBossDetailPage;
globalThis.jhExtractExternalId = jhExtractExternalId;
