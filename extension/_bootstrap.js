/* ============================================================================
 * Visual Novel (liquid glass) — SillyTavern 扩展引导
 * 由 build-extension.js 与 patched app.js 合并为 extension/index.js。
 *
 * 不依赖 <content> 正则。提供入口（扩展菜单项 + 保底悬浮按钮），
 * 点击后从 SillyTavern 上下文读取最近一条 AI 消息原文：
 *   有 <content> 取其中内容，否则取整条消息文本，交给阅读器渲染。
 * ========================================================================== */
(function () {
  'use strict';
  var ENTRY_ID = 'vnm-ext-entry';
  var FAB_ID = 'vnm-ext-fab';
  var LOG = '[VNM-Ext]';
  console.info(LOG, 'bootstrap loaded');

  function getCtx() {
    try { return (window.SillyTavern && SillyTavern.getContext) ? SillyTavern.getContext() : null; }
    catch (e) { return null; }
  }

  function pickLatestAiText() {
    var ctx = getCtx();
    var chat = ctx && ctx.chat;
    if (!chat || !chat.length) return null;
    for (var i = chat.length - 1; i >= 0; i--) {
      var m = chat[i];
      if (!m || m.is_user || m.is_system) continue;
      var txt = (m.mes != null ? String(m.mes) : '');
      if (txt.trim()) return txt;
    }
    for (var j = chat.length - 1; j >= 0; j--) {
      var mm = chat[j];
      if (mm && mm.mes && String(mm.mes).trim()) return String(mm.mes);
    }
    return null;
  }

  function extractSource(text) {
    if (!text) return '';
    var re = /<content[^>]*>([\s\S]*?)<\/content>/gi;
    var parts = [], m;
    while ((m = re.exec(text)) !== null) parts.push(m[1]);
    return parts.length ? parts.join('\n\n') : text;
  }

  function openVN() {
    var text = pickLatestAiText();
    if (!text) { toast('没有可渲染的消息（先让 AI 回一条）'); return; }
    window.__VNM_SOURCE__ = extractSource(text);
    var mode = 'fullscreen';
    try { var saved = localStorage.getItem('vnm-display-mode'); if (saved) mode = saved; } catch (e) {}
    if (typeof window.__VNM_openViewer === 'function') {
      try { window.__VNM_openViewer(mode); }
      catch (e) { console.error(LOG, 'openViewer 失败', e); toast('打开阅读器失败：' + (e && e.message || e)); }
    } else {
      console.error(LOG, 'app 未就绪：window.__VNM_openViewer 不存在');
      toast('Visual Novel 运行时未就绪，请刷新页面重试');
    }
  }

  function toast(msg) {
    try { if (window.toastr) { window.toastr.info(msg, 'Visual Novel'); return; } } catch (e) {}
    console.info(LOG, msg);
  }

  // --- 入口 1: 扩展菜单项 ---
  function ensureMenuEntry() {
    var menu = document.getElementById('extensionsMenu') ||
               document.querySelector('#extensions_menu') ||
               document.querySelector('.extensions_block .list-group') ||
               document.querySelector('#rightSendForm #extensionsMenu') ||
               document.querySelector('.options-content');
    if (!menu) return false;
    if (menu.querySelector('#' + ENTRY_ID)) return true;
    var a = document.createElement('div');
    a.id = ENTRY_ID;
    a.className = 'list-group-item flex-container flexGap5 interactable';
    a.tabIndex = 0;
    a.title = '打开最近一条消息的视觉小说阅读器';
    a.innerHTML = '<div class="fa-solid fa-book-open extensionsMenuExtensionButton"></div><span>Visual Novel</span>';
    a.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openVN(); });
    menu.appendChild(a);
    console.info(LOG, '扩展菜单入口已注入 ->', menu.id || menu.className);
    return true;
  }

  // --- 入口 2: 保底悬浮按钮（永远可用，可拖动）---
  function ensureFab() {
    if (document.getElementById(FAB_ID)) return;
    var b = document.createElement('button');
    b.id = FAB_ID;
    b.type = 'button';
    b.title = 'Visual Novel（点击打开，可拖动）';
    b.innerHTML = '🎴';
    b.style.cssText = [
      'position:fixed', 'right:14px', 'bottom:120px', 'z-index:99999',
      'width:44px', 'height:44px', 'border-radius:50%', 'border:none',
      'font-size:20px', 'cursor:pointer',
      'background:rgba(30,30,40,0.72)', 'color:#fff',
      'box-shadow:0 4px 16px rgba(0,0,0,0.4)',
      'backdrop-filter:blur(10px)', '-webkit-backdrop-filter:blur(10px)',
      'display:flex', 'align-items:center', 'justify-content:center'
    ].join(';');
    // 拖动支持
    var dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
    b.addEventListener('mousedown', function (e) {
      dragging = true; moved = false; sx = e.clientX; sy = e.clientY;
      var r = b.getBoundingClientRect(); ox = r.left; oy = r.top; e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
      b.style.left = (ox + dx) + 'px'; b.style.top = (oy + dy) + 'px';
      b.style.right = 'auto'; b.style.bottom = 'auto';
    });
    document.addEventListener('mouseup', function () { dragging = false; });
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (moved) { moved = false; return; }
      openVN();
    });
    document.body.appendChild(b);
    console.info(LOG, '保底悬浮按钮已添加');
  }

  function boot() {
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      ensureMenuEntry();
      if (tries > 60) clearInterval(t);
    }, 500);
    ensureMenuEntry();
    ensureFab();
    window.VNM_Extension = { open: openVN, ensureMenuEntry: ensureMenuEntry, ensureFab: ensureFab };
    console.info(LOG, '就绪。控制台可用 VNM_Extension.open() 手动打开。');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
