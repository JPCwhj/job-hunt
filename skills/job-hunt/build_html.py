#!/usr/bin/env python3
"""Build shortlist.html from analysis + tailored files.

Usage:
    python3 build_html.py <data_dir> <run_id>

例如：
    python3 ~/.claude/skills/job-hunt/build_html.py \
        /Users/me/project/jobHuntSkillData \
        2026-05-18-1836

输出（stdout 标记，供调用方解析）：
    OK: <path>           HTML 写入成功
    OPENED: ...          浏览器已自动打开
    OPEN_FAILED: ...     浏览器自动打开失败
    URL: file://...      HTML 的 file:// URL
    SKIP: ...            模板文件不存在（非致命，可跳过 HTML 输出）
    ERROR: ...           其他致命错误
"""

import sys
import json
import datetime
import re
import webbrowser
from pathlib import Path


# ============ 工具函数 ============

def parse_frontmatter(text):
    """解析 YAML frontmatter，返回 (dict, body_text)。
    支持顶层标量、二级嵌套对象。无 frontmatter 时返回 ({}, text)。"""
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---", 4)
    if end < 0:
        return {}, text
    fm_text = text[4:end]
    body = text[end + 4:].lstrip("\n")
    result = {}
    current_key = None
    for line in fm_text.split("\n"):
        if not line.strip() or line.strip().startswith("#"):
            continue
        stripped = line.lstrip()
        indent = len(line) - len(stripped)
        if indent == 0:
            if ":" not in stripped:
                continue
            key, _, val = stripped.partition(":")
            key = key.strip()
            val = val.strip()
            if val == "":
                result[key] = {}
                current_key = key
            else:
                result[key] = _coerce(val)
                current_key = None
        elif current_key is not None:
            # 二级嵌套
            if ":" not in stripped:
                continue
            k, _, v = stripped.partition(":")
            result[current_key][k.strip()] = _coerce(v.strip())
    return result, body


def _coerce(val):
    """把 YAML 标量字符串转为合适的 Python 类型。"""
    if val == "" or val.lower() in ("null", "~"):
        return None
    if val.lower() == "true":
        return True
    if val.lower() == "false":
        return False
    # 字符串去引号
    if (val.startswith('"') and val.endswith('"')) or \
       (val.startswith("'") and val.endswith("'")):
        return val[1:-1]
    # 数字
    try:
        if "." in val:
            return float(val)
        return int(val)
    except ValueError:
        return val


def extract_one_liner(analysis_body):
    """从 analysis.md 正文里提取「一句话评估」。"""
    # 匹配「## 一句话评估」「### 一句话评估」等任意层级标题后的第一段
    m = re.search(r"^#+\s*一句话评估\s*\n+([^\n#]+)", analysis_body, re.MULTILINE)
    if m:
        return m.group(1).strip()
    # 兜底：找含「一句话」的行
    m = re.search(r"一句话[评估总结评价]*[:：]\s*(.+)", analysis_body)
    if m:
        return m.group(1).strip()
    return ""


def safe_read(path):
    """文件不存在返回空字符串。"""
    try:
        return Path(path).read_text()
    except (FileNotFoundError, IsADirectoryError):
        return ""


# ============ 主流程 ============

def main():
    if len(sys.argv) != 3:
        print("Usage: build_html.py <data_dir> <run_id>", file=sys.stderr)
        print("Example: build_html.py /Users/me/project/jobHuntSkillData 2026-05-18-1836",
              file=sys.stderr)
        return 2

    data_dir = Path(sys.argv[1])
    run_id = sys.argv[2]

    jd_pool = data_dir / ".work/jd-pool"
    tailored_root = data_dir / f"output/{run_id}/tailored"
    template_path = Path.home() / ".claude/skills/job-hunt/template.html"

    # 模板不存在 → 跳过 HTML 输出（不算致命错误）
    if not template_path.exists():
        print(f"SKIP: template not found at {template_path}")
        return 0

    if not jd_pool.exists():
        print(f"ERROR: jd-pool not found at {jd_pool}", file=sys.stderr)
        return 1

    # 1. 收集所有 analysis 文件并构造 jobs[]
    jobs = []
    for analysis_file in jd_pool.glob("*.analysis.md"):
        jd_id = analysis_file.name.replace(".analysis.md", "")
        jd_file = jd_pool / f"{jd_id}.md"
        if not jd_file.exists():
            print(f"WARN: skip {jd_id} - JD file missing", file=sys.stderr)
            continue

        jd_fm, _ = parse_frontmatter(jd_file.read_text())
        ana_fm, ana_body = parse_frontmatter(analysis_file.read_text())

        tailored_dir = tailored_root / jd_id
        resume_md = safe_read(tailored_dir / "resume.md")
        opener_md = safe_read(tailored_dir / "opener.md")
        changelog_md = safe_read(tailored_dir / "changelog.md")

        scores = ana_fm.get("scores", {}) or {}
        company = jd_fm.get("company", {}) or {}
        salary = jd_fm.get("salary", {}) or {}
        location = jd_fm.get("location", {}) or {}

        jobs.append({
            "id": jd_id,
            "company": company.get("name", ""),
            "title": jd_fm.get("title", ""),
            "match_score": scores.get("total", 0),
            "salary_range": salary.get("range", ""),
            "monthly_count": salary.get("monthly_count"),
            "city": location.get("city", ""),
            "district": location.get("district", "") or "",
            "url": jd_fm.get("url") or "",
            "scores": {
                "hard_skills": scores.get("hard_skills", 0),
                "experience_depth": scores.get("experience_depth", 0),
                "domain_fit": scores.get("domain_fit", 0),
                "soft_fit": scores.get("soft_fit", 0),
            },
            "one_liner": extract_one_liner(ana_body),
            "resume_md": resume_md,
            "opener_md": opener_md,
            "changelog_md": changelog_md,
        })

    if not jobs:
        print(f"ERROR: no analyzed jobs found in {jd_pool}", file=sys.stderr)
        return 1

    # 2. 按 match_score 降序排序，赋 rank
    def score_key(j):
        s = j["match_score"]
        try:
            return -int(s)
        except (TypeError, ValueError):
            return 0

    jobs.sort(key=score_key)
    for i, j in enumerate(jobs, 1):
        j["rank"] = i

    print(f"INFO: aggregated {len(jobs)} jobs")
    for j in jobs:
        print(f"  - rank {j['rank']}: {j['company']} · {j['title']} "
              f"(resume={len(j['resume_md'])}b, opener={len(j['opener_md'])}b, "
              f"changelog={len(j['changelog_md'])}b)")

    # 3. 拼装最终 JSON
    data = {
        "run_id": run_id,
        "generated_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "jobs": jobs,
    }

    # 4. 注入模板
    template = template_path.read_text()
    json_str = json.dumps(data, ensure_ascii=False)
    json_str = json_str.replace("</script>", "<\\/script>")  # 防止 </script> 截断
    html = template.replace("__DATA_PLACEHOLDER__", json_str)

    out_path = data_dir / f"output/{run_id}/shortlist.html"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html)
    print(f"OK: {out_path} ({out_path.stat().st_size} bytes)")

    # 5. 自动打开默认浏览器
    file_url = out_path.absolute().as_uri()
    print(f"URL: {file_url}")
    try:
        webbrowser.open(file_url)
        print("OPENED: browser launched")
    except Exception as e:
        print(f"OPEN_FAILED: {e}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
