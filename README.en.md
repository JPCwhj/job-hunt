# job-hunt · Job Hunter - Resume Assistant Skill

[中文](README.md)

Author: [Douyin](https://www.douyin.com/user/MS4wLjABAAAAWo2xyaSERZ6A7j3Ln09ZOlLCaRV8r1dazBzzckknKbqcIXdARqfOV11SZAeJapEM) · [Xiaohongshu](https://www.xiaohongshu.com/user/profile/62a1d0dd000000001b029ddd)

**Sent out resumes but heard nothing back? The problem might not be you — it might be that your resume didn't speak to the JD.**

HR spends less than 10 seconds scanning a resume — **and how well your resume matches the JD is what actually determines whether you pass the first cut.**

**Send 5, 10, or 20 job postings at once — batch-process them all. AI runs the full pipeline (parse → match → tailor → opener) on every JD in parallel, then ranks them by match score in a single HTML, so you instantly see which roles to prioritize.**

> You decide who to apply to. AI gets every application ready.

---

## What It Does

1. **Resume quality check**: Upload your resume and AI diagnoses each section using industry-standard criteria (Situation + Action + Result), highlights weak spots, and suggests improvements. You can revise and re-upload, or skip and continue.
2. **JD parsing**: Upload screenshots of job listing pages from any major hiring platform. AI extracts structured data — title, salary, requirements, company size, etc.
3. **Match analysis**: Aligns each JD with your resume using STAR framework, outputting scores across 4 dimensions: Hard Skills / Experience Depth / Domain Fit / Soft Skills.
4. **Tailored materials**: Re-focuses your resume for each JD — moves the most relevant experience to the top, sharpens match points, so the HR reading it can immediately see you fit the role. Comes with an opening message + change log.
5. **Shortlist output**: All positions ranked by match score in a single static HTML file. Open in browser to browse each job's tailored resume / changelog / opener; resume can be edited inline and exported to PDF with one click (Chinese fonts embedded for cross-platform consistency)

---

## ⚡ Batch Processing is the Core Capability

**This isn't "let AI write you a resume" — it's "let AI tailor N resumes simultaneously, one per job."**

| Scenario | Manual Approach | With job-hunt |
|---|---|---|
| Apply to 10 jobs | Research each JD, edit resume, write opener — **~1 day** | Send 10 screenshots, **all 10 tailored packages done in minutes** |
| Decide where to apply | Gut feeling | Ranked by match score — **data-driven** |
| Evaluation criteria | Subjective, fatigue-prone | AI applies the same STAR framework — **consistent** |

However many job screenshots you send, that's how many tailored resumes you get back — 5, 10, 20, whatever.

---

## What It Won't Do

- **No fabricated experience**: Won't add projects, skills, or jobs that aren't already in your resume
- **No made-up numbers**: Where quantified results are missing, inserts a `[fill in: xxx]` placeholder — never invents user counts, growth rates, or revenue figures
- **No changes to key facts**: Employment dates, job titles, and company names stay untouched
- **No hidden edits**: Every change is logged in `changelog.md` — what was changed and why, for your review

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

## Who It's For

**Best fit**
- Job seekers applying with a text-based resume: product, operations, marketing, engineering, management, etc.
- Anyone applying to multiple positions who needs to tailor their resume for each JD
- Anyone who wants a quick read on how well they match a specific role

**Limited benefit**
- Roles where portfolio, design work, or visual output is the primary signal (UI/UX, graphic design, photography, architecture, etc.) — the competitive edge is in the work itself, not the resume text

---

## Install or Update

```bash
npx skills add JPCwhj/job-hunt -g -y
```

---

## Browser Extension (Optional)

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
- Drag the `.jobs.json` file into Claude Code's `/job-hunt` flow

**For platforms not yet supported**: continue using screenshots.

---

## Usage

**Option 1**: Launch any skill-compatible agent tool and run the corresponding command:
- Claude Code: `/job-hunt`
- Codex: `$job-hunt`

**Option 2**: In the chat window of a local AI agent tool like OpenClaw, send:

```
/job-hunt
```

**Workflow**:
1. Provide your resume (upload file, give a path, or paste text directly)
2. AI evaluates resume quality section by section — revise and re-upload, or continue as-is
3. Upload job listing screenshots
   📌 One screenshot = one job (use long screenshot for long postings); each screenshot must include at least the job title (company name optional)
4. After confirming screenshots, analysis and tailoring run automatically — no extra trigger needed
5. Review shortlist, fill in placeholders, apply manually

**Re-run with a new resume**: Run `/job-hunt` again and it will prompt you to send your updated resume. Send it directly to replace the cached version — no need to clean first.

### Subcommands

| Command | Description |
|---|---|
| `/job-hunt` | Full flow (import → analyze → tailor → shortlist) |
| `/job-hunt fetch` | Import screenshots only (parse JDs into jd-pool) |
| `/job-hunt analyze` | Run match analysis on existing jd-pool |
| `/job-hunt tailor` | Sort + generate tailored materials |
| `/job-hunt status` | Check current run progress |
| `/job-hunt clean` | Clear all cache and output |

---

## Prerequisites

- **Your AI model must support vision (image recognition)** (for screenshot parsing)
- [Claude Code](https://github.com/anthropics/claude-code) installed, or any agent that supports the Skill spec (e.g. Codex, OpenClaw)
- Resume must be prepared as a **`.md` file** or **plain text ready to paste** — for PDF/Word resumes, open them in a reader, select-all and copy the content, or save as `.md` before sending
- Any major hiring platform — just screenshot the job detail page
- 📌 **Screenshot rule: one screenshot = one job**. Use long screenshot to capture the full posting in one image; each screenshot must contain at least the job title (company name optional)

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

### Output Format

`shortlist.html`: A standalone static HTML file. Copy the path into your browser to open:
- Desktop + mobile responsive
- All jobs ranked by match score
- Resume can be edited inline; edits auto-saved to browser localStorage
- One-click PDF export per job (A4, embedded Source Han Sans for cross-platform consistency)
- Switch between resume / changelog / opener tabs per job

---

## Design Boundaries

- **Works with all major hiring platforms**: any screenshot containing company name, job title, and JD is sufficient
- **No auto-apply**: eliminates account ban risk
- **No plugins or extensions required**: you screenshot, AI parses — no browser extensions or MCP tools needed

---

## Data & Privacy

- **All files stay on your machine**: resume, JDs, and tailored materials are written to your local `jobHuntSkillData/` directory — nothing is auto-uploaded or synced anywhere
- **Data only passes through the Claude you're already using**: the skill connects to no third-party servers; the data path is identical to using Claude directly
- **The skill itself is plain text**: no network request code — inspect the source anytime at `~/.claude/skills/`
