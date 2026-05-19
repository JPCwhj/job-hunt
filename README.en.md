# job-hunt · Job Hunter - Resume Assistant Skill

[中文](README.md)

Author: [Douyin](https://www.douyin.com/user/MS4wLjABAAAAWo2xyaSERZ6A7j3Ln09ZOlLCaRV8r1dazBzzckknKbqcIXdARqfOV11SZAeJapEM) · [Xiaohongshu](https://www.xiaohongshu.com/user/profile/62a1d0dd000000001b029ddd)

**Sent out resumes but heard nothing back? The problem might not be you — it might be that your resume didn't speak to the JD.**

HR spends less than 10 seconds scanning a resume — **and how well your resume matches the JD is what actually determines whether you pass the first cut.**

**Send 5, 10, or 20 job postings at once — batch-process them all. AI runs the full pipeline (parse → match → tailor → opener) on every JD in parallel, then ranks them by match score in a single HTML, so you instantly see which roles to prioritize.**

> You decide who to apply to. AI gets every application ready.

---

## What It Does / Doesn't Do

**Does (3 steps, fully automated)**:

1. **Evaluate the resume**: diagnoses each section using industry-standard criteria (Situation + Action + Result), flags weak spots, suggests rewrites
2. **Parse + match**: converts job postings into structured JDs, then aligns them with your resume using STAR across 4 dimensions (hard skills / experience depth / domain fit / soft skills)
3. **Batch tailor + rank**: rewrites a tailored resume + opener + changelog for each JD, aggregates everything into one HTML ranked by match score

**Doesn't (ethical boundaries)**:

- ❌ No fabricated projects, skills, or work history
- ❌ No invented numbers (user counts, growth rates, revenue) — uses `[fill in: xxx]` placeholders instead
- ❌ No changes to employment dates, titles, or company names
- ✅ Every edit is logged in `changelog.md` for line-by-line review

---

## 🖼 Preview

After `/job-hunt` finishes, you get a single static HTML file. Opening it in any browser looks like this:

### 📄 Tailored Resume

Left sidebar lists all positions sorted by match score; right pane shows the resume tailored to the current JD.
**Red/yellow highlights** mark placeholders that need your input — the AI never fabricates data.
The "📄 Export PDF" button downloads an A4 PDF with embedded Chinese fonts for cross-platform consistency.

![Resume view](htmlImg/long01.png)

### 📋 Changelog

A full transparency report on what the AI changed: reordering / rewording / placeholders to fill in / de-emphasized items, each with the reason for the change. **The yellow-highlighted "needs user input" sections** are AI inferences that require your verification.

![Changelog](htmlImg/long02.png)

### 💬 Opener

A ready-to-send HR opening message tailored to the current position (kept within 200 characters). Click "📋 Copy" to use it directly.

![Opener](htmlImg/long03.png)

---

## Who It's For / Who It's Not For

**Best fit**

- Job seekers applying with a text-based resume: product, operations, marketing, engineering, management, etc.
- Anyone applying to multiple positions who needs to tailor their resume for each JD
- Anyone who wants a quick read on how well they match a specific role

**Limited benefit**

- Roles where portfolio, design work, or visual output is the primary signal (UI/UX, graphic design, photography, architecture, etc.) — the competitive edge is in the work itself, not the resume text

---

## Prerequisites

- [Claude Code](https://github.com/anthropics/claude-code) installed, or any agent that supports the Skill spec (e.g. Codex, OpenClaw)
- Resume prepared as a **`.md` file** or **plain text ready to paste** — for PDF/Word, extract the text first
- Job source — pick either:
  - **Screenshot mode**: screenshots from any major hiring platform; **requires your AI model to support vision (image recognition)**
  - **Chrome extension mode**: collect jobs and export `.jobs.json`; no vision capability required (currently supports four major hiring platforms)

---

## Quick Start (30-Second Setup)

```bash
# 1. Install the skill
npx skills add JPCwhj/job-hunt -g -y --all
```

```
# 2. Run inside Claude Code
/job-hunt

# 3. Follow the prompts: send resume → send jobs (screenshots or .jobs.json) → wait for results
```

You'll find the output HTML at `<current directory>/jobHuntSkillData/output/<run_id>/shortlist.html` — open it in a browser.

---

## Install / Update Skill (same command for both)

```bash
npx skills add JPCwhj/job-hunt -g -y --all
```

---

## Install Browser Extension (Optional)

If you'd rather skip screenshots, install the browser extension to bookmark jobs and batch-export them. **Currently supports four major hiring platforms.**

1. Clone the repo: `git clone https://github.com/JPCwhj/job-hunt.git`
2. Open Chrome → `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked", select the `chrome-extension/` folder in the repo
5. On any supported platform's job detail page, a "⭐ Add to list" floating button will appear (draggable to any position; the four platforms share the same saved position)

**Usage**:

- On any supported platform's detail page, click "⭐ Add to list" to collect jobs
- Click the extension icon, select the jobs you want, click "Export"
- The `.jobs.json` file downloads to your default Downloads folder (exported jobs are automatically cleared from the collection list)
- Start the `/job-hunt` flow, and only send the `.jobs.json` file when it reaches the "upload jobs" step (not at the very beginning)

**For platforms not yet supported**: continue using screenshots.

---

## Detailed Workflow

Run `/job-hunt` in any skill-compatible agent tool (Claude Code, Codex, OpenClaw, etc.):

1. Provide your resume (upload file, give a path, or paste text directly)
2. AI evaluates resume quality section by section — revise and re-upload, or continue as-is
3. Provide job postings (either way works):
   - **Screenshots**: upload screenshots from any major hiring platform (one screenshot = one job; use long screenshot for long postings; each screenshot must include at least the job title)
   - **Chrome extension**: batch-collect jobs, export `.jobs.json`, send the file to AI
4. Once jobs are imported, analysis and tailoring run automatically — no extra trigger needed
5. Review shortlist, fill in placeholders, apply manually

**Re-run with a new resume**: Run `/job-hunt` again and it will prompt you to send your updated resume. Send it directly to replace the cached version — no need to clean first. A new resume automatically triggers the quality assessment with section-by-section feedback.

### Subcommands

| Command | Description |
|---|---|
| `/job-hunt` | Full flow (import → analyze → tailor → shortlist) |
| `/job-hunt fetch` | Import jobs only (screenshots or extension JSON) |
| `/job-hunt analyze` | Run match analysis on existing jd-pool |
| `/job-hunt tailor` | Sort + generate tailored materials |
| `/job-hunt status` | Check current run progress |
| `/job-hunt clean` | Clear all cache and output |

---

## Output Structure

```
<current directory>/
└── jobHuntSkillData/
    ├── .work/
    │   ├── resume.md             ← your resume (auto-saved)
    │   └── jd-pool/              ← parsed JD cache
    └── output/
        └── 2026-05-02-1430/
            ├── shortlist.html    ← final view (open in browser)
            ├── state.json        ← checkpoint state
            └── tailored/
                └── <company-title>/
                    ├── resume.md     ← tailored resume
                    ├── opener.md     ← opening message
                    └── changelog.md  ← what AI changed (transparency log)
```

`shortlist.html` is a standalone static HTML file:

- Desktop + mobile responsive
- All jobs ranked by match score
- Resume can be edited inline; edits auto-saved to browser localStorage
- One-click PDF export per job (A4, embedded Source Han Sans for cross-platform consistency)
- Switch between resume / changelog / opener tabs per job

---

## Design Boundaries & Data Privacy

- **Supported platforms**: screenshot mode is platform-agnostic; the Chrome extension currently supports four major hiring platforms
- **No auto-apply**: eliminates account ban risk and respects the ethical boundary — you apply manually
- **Everything stays local**: resume, JDs, and tailored materials are written to your local `jobHuntSkillData/` directory — nothing is auto-uploaded or synced
- **Same data path as Claude**: the skill connects to no third-party servers; data flow is identical to using Claude directly
- **Source is inspectable**: pure-text instructions, no network request code — inspect anytime at `~/.claude/skills/`
