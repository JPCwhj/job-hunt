#!/usr/bin/env python3
"""import_jobs.py
读取 .jobs.json 文件，把每条 job 写入 <data_dir>/.work/jd-pool/<filename>.md
frontmatter 与 job-hunt-fetcher 输出格式一致。

用法：python3 import_jobs.py <data_dir> <json_path>
输出（stdout 单行）：
    OK: 已导入 N 个岗位 -> <jd_pool_path>
    ERROR: <reason>
"""
import sys, json, re
from datetime import datetime
from pathlib import Path


def sanitize(name):
    if not name: return ""
    s = re.sub(r"[\\/:\*\?\"<>\|]", "_", str(name))
    s = re.sub(r"\s+", "", s)
    return s[:60]


def yaml_value(v):
    if v is None: return "null"
    if isinstance(v, bool): return "true" if v else "false"
    if isinstance(v, (int, float)): return str(v)
    s = str(v).replace('"', '\\"').replace("\n", " ")
    return f'"{s}"'


def yaml_list(arr):
    if not arr: return "[]"
    return "[" + ", ".join(yaml_value(x) for x in arr) + "]"


def file_name_for(job):
    ts = datetime.now().strftime("%Y%m%dT%H%M")
    title = sanitize(job.get("title")) or "未知职位"
    company = sanitize((job.get("company") or {}).get("name")) or "未知公司"
    return f"{company}-{title}-{ts}.md"


def build_md(job, run_id):
    now = datetime.now().isoformat(timespec="seconds")
    title = job.get("title") or "未知职位"
    company = job.get("company") or {}
    salary = job.get("salary") or {}
    location = job.get("location") or {}
    req = job.get("requirements") or {}
    hr = job.get("hr") or {}
    fname = file_name_for(job)
    id_ = fname[:-3] if fname.endswith(".md") else fname

    intro = job.get("company_intro")
    intro_section = f"\n\n## 公司介绍\n\n{intro}" if intro else ""

    md = f"""---
id: {id_}
fetched_at: {now}
run_id: {run_id}
source: extension

title: {yaml_value(title)}
company:
  name: {yaml_value(company.get("name"))}
  size: {yaml_value(company.get("size"))}
  industry: {yaml_value(company.get("industry"))}
  stage: {yaml_value(company.get("stage"))}
salary:
  range: {yaml_value(salary.get("range"))}
  monthly_count: {yaml_value(salary.get("monthly_count"))}
location:
  city: {yaml_value(location.get("city"))}
  district: {yaml_value(location.get("district"))}
requirements:
  experience: {yaml_value(req.get("experience"))}
  education: {yaml_value(req.get("education"))}

tags: {yaml_list(job.get("tags") or [])}
benefits: {yaml_list(job.get("benefits") or [])}
hr:
  name: {yaml_value(hr.get("name"))}
  title: {yaml_value(hr.get("title"))}
  active_status: {yaml_value(hr.get("active_status"))}
posted_at: {yaml_value(job.get("posted_at"))}

status:
  detail_fetched: true
  analyzed: false
---

## 岗位职责

{job.get("job_description") or ""}

## 任职要求

{job.get("job_requirements") or ""}{intro_section}
"""
    return md, fname


def main():
    if len(sys.argv) != 3:
        print("ERROR: 用法：python3 import_jobs.py <data_dir> <json_path>")
        sys.exit(2)
    data_dir = Path(sys.argv[1])
    json_path = Path(sys.argv[2])

    if not json_path.exists():
        print(f"ERROR: 文件不存在 {json_path}")
        sys.exit(2)
    try:
        payload = json.loads(json_path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"ERROR: JSON 解析失败 {e}")
        sys.exit(2)

    if payload.get("format") != "job-hunt-jobs":
        print(f"ERROR: 文件格式不匹配（期望 format=job-hunt-jobs，实际 {payload.get('format')}）")
        sys.exit(2)

    jobs = payload.get("jobs") or []
    if not jobs:
        print("ERROR: jobs 数组为空")
        sys.exit(2)

    jd_pool = data_dir / ".work" / "jd-pool"
    jd_pool.mkdir(parents=True, exist_ok=True)

    run_id = "extension-import"
    output_dir = data_dir / "output"
    if output_dir.exists():
        runs = sorted([p.name for p in output_dir.iterdir() if p.is_dir()], reverse=True)
        if runs: run_id = runs[0]

    written = 0
    for job in jobs:
        try:
            md, fname = build_md(job, run_id)
            target = jd_pool / fname
            i = 1
            while target.exists():
                stem = fname[:-3]
                target = jd_pool / f"{stem}-{i}.md"
                i += 1
            target.write_text(md, encoding="utf-8")
            written += 1
        except Exception as e:
            print(f"ERROR: 写入失败 {e}")
            sys.exit(2)

    print(f"OK: 已导入 {written} 个岗位 -> {jd_pool}")


if __name__ == "__main__":
    main()
