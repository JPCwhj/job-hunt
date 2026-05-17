#!/bin/bash
# 一次性脚本：重新生成思源黑体 CN 字体子集 CSS。
# 前置：pip3 install 'fonttools[woff]' brotli
# 产物：skills/job-hunt/font-embedded.css

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
echo "工作目录：$WORK"

# 1. 下载字体
BASE="https://github.com/adobe-fonts/source-han-sans/raw/release/SubsetOTF/CN"
for weight in Regular Bold; do
  echo "下载 SourceHanSansCN-${weight}.otf ..."
  curl -fSL --retry 3 -o "$WORK/SourceHanSansCN-${weight}.otf" "${BASE}/SourceHanSansCN-${weight}.otf"
done

# 2. 生成 GB2312 unicode 文件
UNICODE_FILE="$WORK/gb2312-unicodes.txt"
python3 - <<'PY'
import os
output = ["U+0020-007E", "U+00A0-00FF", "U+2010-2027", "U+2030-205E",
          "U+3000-303F", "U+FF00-FFEF"]
gb2312_chars = set()
for hi in range(0xA1, 0xF8):
    for lo in range(0xA1, 0xFF):
        try:
            ch = bytes([hi, lo]).decode('gb2312')
            cp = ord(ch)
            if cp > 0x2E7F:
                gb2312_chars.add(cp)
        except (UnicodeDecodeError, ValueError):
            pass
for cp in sorted(gb2312_chars):
    output.append(f"U+{cp:04X}")
open(os.environ.get("UNICODE_FILE", "/tmp/gb2312-unicodes.txt"), "w").write("\n".join(output))
print(f"GB2312 汉字：{len(gb2312_chars)} 个")
PY

export UNICODE_FILE

# 3. 子集化
for weight in Regular Bold; do
  pyftsubset "$WORK/SourceHanSansCN-${weight}.otf" \
    --output-file="$WORK/SourceHanSansCN-${weight}-subset.woff2" \
    --flavor=woff2 --unicodes-file=$UNICODE_FILE \
    --layout-features='*' --no-hinting
  ls -lh "$WORK/SourceHanSansCN-${weight}-subset.woff2"
done

# 4. 生成 CSS
WORK_DIR="$WORK" SCRIPT_DIR="$SCRIPT_DIR" python3 - <<'PY'
import base64, os
from pathlib import Path
work = os.environ.get("WORK_DIR")
script_dir = os.environ.get("SCRIPT_DIR")
lines = ["/* 思源黑体 CN 子集（GB2312 + ASCII，woff2 base64 内嵌） */"]
for weight, num in [("Regular", 400), ("Bold", 700)]:
    b64 = base64.b64encode(Path(f"{work}/SourceHanSansCN-{weight}-subset.woff2").read_bytes()).decode()
    lines.append(f"@font-face {{\n  font-family: 'SourceHanSansCN';\n  font-style: normal;\n  font-weight: {num};\n  font-display: swap;\n  src: url(data:font/woff2;base64,{b64}) format('woff2');\n}}")
out = Path(f"{script_dir}/font-embedded.css")
out.write_text("\n".join(lines))
print(f"✅ {out} ({out.stat().st_size/1024/1024:.2f} MB)")
PY
echo "完成"
