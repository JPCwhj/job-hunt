// chrome-extension/src/lib/drag.js
// 让 FAB 按钮可拖拽，位置持久化到 localStorage

// Toast 定位到按钮正上方（供各平台 showToast 调用）
function jhPositionToast(toast, btn) {
  const rect = btn.getBoundingClientRect();
  toast.style.right  = "auto";
  toast.style.bottom = "auto";
  // 水平居中对齐按钮，垂直贴在按钮上方 8px
  const toastW = toast.offsetWidth || 160;
  let left = rect.left + (rect.width - toastW) / 2;
  left = Math.max(8, Math.min(window.innerWidth - toastW - 8, left));
  toast.style.left = left + "px";
  toast.style.top  = (rect.top - toast.offsetHeight - 8) + "px";
}

function jhMakeDraggable(btn, storageKey) {
  // 恢复上次保存的位置
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const { right, bottom } = JSON.parse(saved);
      btn.style.right  = right  + "px";
      btn.style.bottom = bottom + "px";
    }
  } catch (e) {}

  let startX, startY, startRight, startBottom;
  let isDragging = false;
  let didMove    = false;

  btn.addEventListener("mousedown", e => {
    if (e.button !== 0) return;   // 只响应左键
    e.preventDefault();

    isDragging = true;
    didMove    = false;
    startX = e.clientX;
    startY = e.clientY;

    const rect = btn.getBoundingClientRect();
    startRight  = window.innerWidth  - rect.right;
    startBottom = window.innerHeight - rect.bottom;

    btn.style.transition = "none";
    btn.style.cursor     = "grabbing";
  });

  document.addEventListener("mousemove", e => {
    if (!isDragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didMove = true;
    if (!didMove) return;

    // right 增大 = 按钮向左移；bottom 增大 = 按钮向上移
    let newRight  = startRight  - dx;
    let newBottom = startBottom - dy;

    // 限制在视口内（留 8px 边距）
    const w = btn.offsetWidth;
    const h = btn.offsetHeight;
    newRight  = Math.max(8, Math.min(window.innerWidth  - w - 8, newRight));
    newBottom = Math.max(8, Math.min(window.innerHeight - h - 8, newBottom));

    btn.style.right  = newRight  + "px";
    btn.style.bottom = newBottom + "px";
  });

  document.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
    btn.style.cursor = "";

    if (didMove) {
      // 保存位置
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          right:  parseFloat(btn.style.right),
          bottom: parseFloat(btn.style.bottom)
        }));
      } catch (e) {}
    }
  });

  // 拖拽结束后屏蔽本次 click，避免误触发收藏
  btn.addEventListener("click", e => {
    if (didMove) {
      e.stopImmediatePropagation();
      didMove = false;
    }
  }, true);
}
