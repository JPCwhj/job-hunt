// chrome-extension/src/content/boss.js

function txt(selector, root) {
  const el = (root || document).querySelector(selector);
  return el ? el.textContent.trim() : null;
}

// innerText 版：过滤 Boss 注入的 CSS 噪声（tiny hidden spans + <style> blocks）
function innerTxt(selector, root) {
  const el = (root || document).querySelector(selector);
  if (!el) return null;
  const t = (el.innerText || el.textContent || "").trim();
  return t || null;
}

function txtAll(selector, root) {
  return Array.from((root || document).querySelectorAll(selector))
    .map(el => el.textContent.trim())
    .filter(Boolean);
}

// 找右侧详情面板（分栏模式）
function jhFindRightPanel() {
  const selectors = [
    '.job-detail-box', '.detail-box', '.job-detail-card',
    '.recommend-detail', '.search-job-result .job-detail',
    '[class*="jobDetail"]', '[class*="job-detail"]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  // 兜底：找到含 .job-sec-text 的容器（只在右侧面板出现）
  const descEl = document.querySelector('.job-sec-text, .job-detail-section .text');
  if (descEl) return descEl.closest('section, article, [class*="detail"]') || descEl.parentElement;
  return null;
}

function jhExtractExternalId() {
  // 单独详情页：从 URL 提取
  const m = location.pathname.match(/\/job_detail\/([^.\/\?#]+)/);
  if (m) return m[1];

  // 分栏模式：从右侧面板的 job_detail 链接提取
  const panel = jhFindRightPanel();
  if (panel) {
    const link = panel.querySelector('a[href*="/job_detail/"]');
    if (link) {
      const lm = (link.getAttribute('href') || '').match(/\/job_detail\/([^.\/\?#]+)/);
      if (lm) return lm[1];
    }
  }
  // 兜底：左侧列表中当前 active 条目的链接
  const activeLink = document.querySelector(
    '.job-card-wrapper.active a[href*="/job_detail/"], ' +
    '[class*="active"] a[href*="/job_detail/"]'
  );
  if (activeLink) {
    const lm = (activeLink.getAttribute('href') || '').match(/\/job_detail\/([^.\/\?#]+)/);
    if (lm) return lm[1];
  }
  return null;
}

async function jhParseBossDetailPage() {
  const job = jhEmptyJob();
  job.platform = "boss";
  job.saved_at = new Date().toISOString();
  job.external_id = jhExtractExternalId();

  // 分栏模式下把解析范围限制在右侧面板，避免抓到左侧列表的同名元素
  const root = jhFindRightPanel() || document;

  // job URL：优先用面板里的 job_detail 链接（分栏模式），否则用当前页 URL
  const detailLink = root.querySelector('a[href*="/job_detail/"]');
  job.url = (detailLink && detailLink.href) || location.href;

  // ── 标题 & 薪资 ─────────────────────────────────────────────────────────
  // Boss 薪资用 kanzhun-mix 字体做 PUA 字符混淆，需 Canvas 解码
  job.title = innerTxt(".job-name", root);
  const salaryRaw = innerTxt(".job-salary", root);
  const salaryText = salaryRaw ? await jhDecodeSalary(salaryRaw) : null;
  job.salary.range = salaryText;
  if (salaryText) {
    const mc = salaryText.match(/(\d+)薪/);
    if (mc) job.salary.monthly_count = parseInt(mc[1]);
  }

  // ── 城市 / 经验 / 学历：从 tag-list li 逐项识别 ─────────────────────────
  const tagItems = txtAll(".tag-list li", root);
  tagItems.forEach(t => {
    if (/\d+年|应届/.test(t) && !job.requirements.experience) job.requirements.experience = t;
    if (/本科|硕士|博士|大专|学历|不限/.test(t) && !job.requirements.education) job.requirements.education = t;
  });
  // 城市：第一个不匹配经验/学历模式的 tag 项
  const cityTag = tagItems.find(
    t => !/\d+年|应届|本科|硕士|博士|大专|学历|不限/.test(t)
  );
  if (cityTag) job.location.city = cityTag;

  // 区：从详细地址中提取（如"杭州滨江区中威大厦1313室" → "滨江区"）
  // 先去掉城市名前缀，避免贪心匹配多吃（"杭州滨江区" → "滨江区"）
  const addrDesc = txt(".job-address-desc", root);
  if (addrDesc) {
    const cityName = job.location.city || "";
    const strippedAddr = (cityName && addrDesc.startsWith(cityName))
      ? addrDesc.slice(cityName.length)
      : addrDesc;
    const dm = strippedAddr.match(/^[一-龥]{2,4}(区|县)/);
    if (dm) job.location.district = dm[0];
  }

  // ── 福利标签 & 岗位标签 ──────────────────────────────────────────────────
  job.benefits = txtAll(".job-label-list li", root);
  job.tags = tagItems;

  // ── 岗位描述：用 innerText 过滤 Boss 注入的 CSS 噪声 ────────────────────
  // Boss 在 p.desc 里嵌入 <style>/.tiny-span{} 来干扰文字提取，innerText 可过滤
  const descEl = root.querySelector("p.desc");
  if (descEl) {
    const raw = (descEl.innerText || "").trim();
    if (raw.length > 20) {
      const splitRe = /(任职要求|岗位要求|任职资格|要求[:：])/;
      const m = raw.split(splitRe);
      if (m.length >= 3) {
        job.job_description = m[0].trim();
        job.job_requirements = m.slice(2).join("").replace(/^[：:\s]+/, "").trim();
      } else {
        job.job_description = raw;
      }
    }
  }

  // ── 公司名 + HR 职位：boss-info-attr 格式为「公司名 · HR职位」 ────────────
  const bossAttr = txt(".boss-info-attr", root);
  if (bossAttr) {
    const parts = bossAttr.split(/\s*[·・]\s*/);
    job.company.name = parts[0] ? parts[0].trim() : null;
    job.hr.title = parts[1] ? parts[1].trim() : null;
  }

  // ── HR 姓名：h2.name 含「姓名 活跃状态」，去掉后半段 ───────────────────
  const hrActiveText = txt(".boss-active-time", root);
  const hrNameEl = root.querySelector(".job-boss-info h2.name");
  if (hrNameEl) {
    let name = (hrNameEl.innerText || hrNameEl.textContent).trim();
    if (hrActiveText) name = name.replace(hrActiveText, "").trim();
    job.hr.name = name || null;
  }
  job.hr.active_status = hrActiveText;

  return job;
}

// ── kanzhun 字体 PUA 字符解码（薪资反爬绕过）────────────────────────────────
// Boss 直聘用 kanzhun-mix 自定义字体把私有区字符（U+E000-U+F8FF）渲染成数字。
// 解码策略：
//   ① 解析字体 cmap 表，通过 glyph ID 精确关联 PUA → ASCII 数字（100% 准确）
//   ② 字体为 WOFF2 或解析失败时，Canvas 像素比对兜底

let _jhFontMap = null; // null=未初始化, Map=就绪, false=不可用

// ── ① 字体 cmap 解析 ─────────────────────────────────────────────────────

function jhSendDiag(data) {
  try { chrome.runtime.sendMessage({ type: "jh-diag", data }); } catch(e) {}
}

async function jhBuildFontMap() {
  try {
    // 1. 从 CSS @font-face 找 kanzhun-mix 字体 URL
    let fontUrl = null;
    const allFonts = [];
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (!(rule instanceof CSSFontFaceRule)) continue;
          const fam = rule.style.fontFamily.replace(/['"]/g, '').trim();
          allFonts.push(fam);
          if (!/kanzhun/i.test(fam)) continue;
          const src = rule.style.getPropertyValue('src');
          const m = src.match(/url\(["']?([^"')]+)["']?\)/);
          if (m) { fontUrl = new URL(m[1], location.href).href; break; }
        }
      } catch (e) { /* 跨域 sheet 跳过 */ }
      if (fontUrl) break;
    }
    jhSendDiag({ step: "font-search", fontUrl, allFonts: allFonts.slice(0, 20) });
    if (!fontUrl) return false;

    // 2. 读取字体二进制（通常命中浏览器缓存，无额外网络请求）
    const buf = await fetch(fontUrl).then(r => r.arrayBuffer());
    const magic = new DataView(buf).getUint32(0);
    const magicHex = magic.toString(16).padStart(8, '0');
    jhSendDiag({ step: "font-magic", magicHex, bufLen: buf.byteLength });

    let cmapBuf;
    if (magic === 0x00010000 || magic === 0x4F54544F) {
      cmapBuf = jhGetTTFTable(buf, 'cmap');          // TTF / OTF
    } else if (magic === 0x774F4646) {
      cmapBuf = await jhGetWOFF1Table(buf, 'cmap');  // WOFF1 (zlib)
    } else {
      jhSendDiag({ step: "font-format", result: "WOFF2-or-unknown, fallback-to-canvas" });
      return false; // WOFF2 需 Brotli，当前不支持，走 Canvas 兜底
    }
    jhSendDiag({ step: "cmap-buf", found: !!cmapBuf, cmapLen: cmapBuf ? cmapBuf.byteLength : 0 });
    if (!cmapBuf) return false;

    const result = jhExtractPUADigitMap(cmapBuf);
    if (result) {
      const entries = [];
      result.forEach((v, k) => entries.push(`U+${k.toString(16).toUpperCase()}=${v}`));
      jhSendDiag({ step: "pua-map", count: result.size, entries: entries.slice(0, 30) });
    } else {
      jhSendDiag({ step: "pua-map", count: 0, result: "empty" });
    }
    return result;
  } catch (e) {
    jhSendDiag({ step: "error", msg: String(e) });
    return false;
  }
}

function jhGetTTFTable(buf, tag) {
  const dv = new DataView(buf);
  const n = dv.getUint16(4);
  const t = [tag.charCodeAt(0), tag.charCodeAt(1), tag.charCodeAt(2), tag.charCodeAt(3)];
  for (let i = 0; i < n; i++) {
    const b = 12 + i * 16;
    if (dv.getUint8(b)===t[0] && dv.getUint8(b+1)===t[1] &&
        dv.getUint8(b+2)===t[2] && dv.getUint8(b+3)===t[3]) {
      return buf.slice(dv.getUint32(b+8), dv.getUint32(b+8) + dv.getUint32(b+12));
    }
  }
  return null;
}

async function jhGetWOFF1Table(buf, tag) {
  const dv = new DataView(buf);
  const n = dv.getUint16(12);
  const t = [tag.charCodeAt(0), tag.charCodeAt(1), tag.charCodeAt(2), tag.charCodeAt(3)];
  for (let i = 0; i < n; i++) {
    const b = 44 + i * 20;
    if (dv.getUint8(b)===t[0] && dv.getUint8(b+1)===t[1] &&
        dv.getUint8(b+2)===t[2] && dv.getUint8(b+3)===t[3]) {
      const off = dv.getUint32(b+4), cl = dv.getUint32(b+8), ol = dv.getUint32(b+12);
      const comp = buf.slice(off, off + cl);
      if (cl === ol) return comp; // 未压缩
      // zlib deflate 解压
      const ds = new DecompressionStream('deflate');
      const w = ds.writable.getWriter(), r = ds.readable.getReader();
      w.write(new Uint8Array(comp)); w.close();
      const chunks = [];
      for (;;) { const {done, value} = await r.read(); if (done) break; chunks.push(value); }
      const out = new Uint8Array(ol); let p = 0;
      for (const c of chunks) { out.set(c, p); p += c.length; }
      return out.buffer;
    }
  }
  return null;
}

function jhExtractPUADigitMap(cmapBuf) {
  const dv = new DataView(cmapBuf);
  const charToGlyph = new Map();
  const numTables = dv.getUint16(2);
  for (let i = 0; i < numTables; i++) {
    const subOff = dv.getUint32(4 + i * 8 + 4);
    const fmt = dv.getUint16(subOff);
    if (fmt === 4)       jhCmap4(dv, subOff, charToGlyph);
    else if (fmt === 12) jhCmap12(dv, subOff, charToGlyph);
  }

  // ASCII 数字 '0'-'9' → glyph ID
  const glyphToDigit = new Map();
  for (let d = 0; d <= 9; d++) {
    const g = charToGlyph.get(0x30 + d);
    if (g) glyphToDigit.set(g, String(d));
  }

  // PUA 字符通过共享 glyph ID 映射到数字
  const puaMap = new Map();
  for (const [cp, gid] of charToGlyph) {
    if (cp >= 0xE000 && cp <= 0xF8FF) {
      const d = glyphToDigit.get(gid);
      if (d !== undefined) puaMap.set(cp, d);
    }
  }
  return puaMap.size > 0 ? puaMap : false;
}

// OpenType cmap format 4（BMP 段映射）
function jhCmap4(dv, base, out) {
  const seg = dv.getUint16(base + 6) >> 1;
  const eb = base + 14, sb = eb + 2 + seg*2, db = sb + seg*2, rb = db + seg*2;
  for (let i = 0; i < seg; i++) {
    const end = dv.getUint16(eb + i*2), start = dv.getUint16(sb + i*2);
    const delta = dv.getInt16(db + i*2), ro = dv.getUint16(rb + i*2);
    if (start === 0xFFFF) break;
    for (let c = start; c <= end; c++) {
      let gid;
      if (ro === 0) {
        gid = (c + delta) & 0xFFFF;
      } else {
        const raw = dv.getUint16(rb + i*2 + ro + (c - start) * 2);
        gid = raw !== 0 ? (raw + delta) & 0xFFFF : 0;
      }
      if (gid !== 0) out.set(c, gid);
    }
  }
}

// OpenType cmap format 12（全 Unicode 映射）
function jhCmap12(dv, base, out) {
  const ng = dv.getUint32(base + 12);
  for (let i = 0; i < ng; i++) {
    const g = base + 16 + i * 12;
    const sc = dv.getUint32(g), ec = dv.getUint32(g+4), sg = dv.getUint32(g+8);
    for (let c = sc; c <= ec; c++) out.set(c, sg + (c - sc));
  }
}

// ── ② Canvas 像素比对（cmap 解析不可用时兜底）────────────────────────────

const _jhCanvasCache = {};

async function jhCanvasDecodeChar(ch) {
  const code = ch.charCodeAt(0);
  if (_jhCanvasCache[code] !== undefined) return _jhCanvasCache[code];
  try {
    await document.fonts.ready;
    const W = 32, H = 40;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'); ctx.textBaseline = 'alphabetic';
    const refFont = `20px "kanzhun-mix", Arial, sans-serif`;
    const refs = {};
    for (let d = 0; d <= 9; d++) {
      ctx.clearRect(0,0,W,H); ctx.font = refFont; ctx.fillStyle = '#000';
      ctx.fillText(String(d), 4, 24);
      refs[d] = new Uint8ClampedArray(ctx.getImageData(0,0,W,H).data);
    }
    ctx.clearRect(0,0,W,H); ctx.font = `20px "kanzhun-mix"`; ctx.fillStyle = '#000';
    ctx.fillText(ch, 4, 24);
    const pix = ctx.getImageData(0,0,W,H).data;
    let best = '?', score = Infinity;
    for (let d = 0; d <= 9; d++) {
      let s = 0; const ref = refs[d];
      for (let i = 3; i < pix.length; i += 4) s += Math.abs(pix[i] - ref[i]);
      if (s < score) { score = s; best = String(d); }
    }
    _jhCanvasCache[code] = best;
    return best;
  } catch(e) { return '?'; }
}

// ── 主解码入口 ────────────────────────────────────────────────────────────

async function jhDecodeSalary(rawText) {
  const chars = Array.from(rawText);
  const puaChars = chars.filter(c => { const n = c.charCodeAt(0); return n >= 0xE000 && n <= 0xF8FF; });
  const hasPUA = puaChars.length > 0;
  jhSendDiag({
    step: "decode-salary",
    rawText,
    charCodes: chars.map(c => c.charCodeAt(0).toString(16)),
    hasPUA,
    puaCount: puaChars.length
  });
  if (!hasPUA) return rawText;

  if (_jhFontMap === null) _jhFontMap = await jhBuildFontMap();

  let result = '';
  const charLog = [];
  for (const ch of chars) {
    const code = ch.charCodeAt(0);
    if (code < 0xE000 || code > 0xF8FF) { result += ch; charLog.push({cp: code.toString(16), via: 'pass'}); continue; }
    if (_jhFontMap && _jhFontMap.has(code)) {
      const d = _jhFontMap.get(code);
      result += d;
      charLog.push({cp: code.toString(16), via: 'cmap', digit: d});
      continue;
    }
    const d = await jhCanvasDecodeChar(ch);
    result += d;
    charLog.push({cp: code.toString(16), via: 'canvas', digit: d});
  }
  jhSendDiag({ step: "decode-result", result, charLog });
  return result;
}


// ── 所有 DOM 用 createElement + textContent，禁用 innerHTML ──────────────

function jhShowToast(msg) {
  let t = document.getElementById("jh-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "jh-toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("jh-show");
  setTimeout(() => t.classList.remove("jh-show"), 1800);
}

function jhSetFabContent(btn, icon, label, saved) {
  // 清空再填，避免 innerHTML
  while (btn.firstChild) btn.removeChild(btn.firstChild);
  const iconSpan = document.createElement("span");
  iconSpan.textContent = icon;
  btn.appendChild(iconSpan);
  btn.appendChild(document.createTextNode(label));
  btn.classList.toggle("jh-saved", !!saved);
}

async function jhRefreshFabState(btn) {
  const id = jhExtractExternalId();
  if (!id) return;
  const saved = await jhHasJob(id);
  if (saved) jhSetFabContent(btn, "✅", "已收藏（点击取消）", true);
  else jhSetFabContent(btn, "⭐", "加入清单", false);
}

async function jhOnFabClick(btn) {
  const id = jhExtractExternalId();
  if (!id) { jhShowToast("未能识别岗位 ID"); return; }
  const saved = await jhHasJob(id);
  if (saved) {
    await jhRemoveJob(id);
    jhShowToast("已从清单移除");
  } else {
    const job = await jhParseBossDetailPage();
    if (!job.title) { jhShowToast("岗位标题未抓到，请刷新页面后重试"); return; }
    const count = await jhUpsertJob(job);
    jhShowToast(`已收藏（共 ${count} 个）`);
  }
  await jhRefreshFabState(btn);
}

function jhMountFab() {
  if (document.getElementById("jh-fab")) return;
  const btn = document.createElement("button");
  btn.id = "jh-fab";
  jhSetFabContent(btn, "⭐", "加入清单", false);
  btn.addEventListener("click", () => jhOnFabClick(btn));
  document.body.appendChild(btn);
  jhRefreshFabState(btn);
}

jhMountFab();

// 监听 SPA 路由变化 + 分栏模式下的面板内容切换
let __jhLastUrl = location.href;
let __jhLastJobId = jhExtractExternalId();
let __jhObsTimer = null;

new MutationObserver(() => {
  // 节流：300ms 内只触发一次检查
  if (__jhObsTimer) return;
  __jhObsTimer = setTimeout(() => {
    __jhObsTimer = null;

    const currentUrl = location.href;
    if (currentUrl !== __jhLastUrl) {
      __jhLastUrl = currentUrl;
      // SPA 跳转到单独详情页
      if (/job_detail\//.test(location.pathname)) {
        const existing = document.getElementById("jh-fab");
        if (existing) jhRefreshFabState(existing);
        else jhMountFab();
        __jhLastJobId = jhExtractExternalId();
        return;
      }
    }

    // 分栏模式：右侧面板切换了新岗位时刷新 FAB 状态
    const currentId = jhExtractExternalId();
    if (currentId && currentId !== __jhLastJobId) {
      __jhLastJobId = currentId;
      const existing = document.getElementById("jh-fab");
      if (existing) jhRefreshFabState(existing);
      else jhMountFab();
    }
  }, 300);
}).observe(document.body, { childList: true, subtree: true });
