/* ============================================================================
 * Visual Novel (liquid glass) — SillyTavern 扩展引导
 * 由 build-extension.js 与 patched app.js 合并为 extension/index.js。
 *
 * 与正则版的区别：不再依赖 AI 输出里的 <content>…</content>。
 * 点击菜单入口时，直接从 SillyTavern 上下文读取最近一条 AI 消息原文：
 *   - 若消息里有 <content>…</content>，取其中内容；
 *   - 否则取整条消息文本。
 * 然后交给阅读器（patched app.js 的 openViewer）渲染成视觉小说。
 * ========================================================================== */
(function () {
  'use strict';
  var ENTRY_ID = 'vnm-ext-entry';
  var LOG = '[VNM-Ext]';

  function getCtx() {
    try { return (window.SillyTavern && SillyTavern.getContext) ? SillyTavern.getContext() : null; }
    catch (e) { return null; }
  }

  // 取最近一条可用的 AI 消息文本
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
    // 退路：没有 AI 消息就拿最后一条非空
    for (var j = chat.length - 1; j >= 0; j--) {
      var mm = chat[j];
      if (mm && mm.mes && String(mm.mes).trim()) return String(mm.mes);
    }
    return null;
  }

  // 抽取要渲染的源文本：优先 <content>，否则整段
  function extractSource(text) {
    if (!text) return '';
    var re = /<content[^>]*>([\s\S]*?)<\/content>/gi;
    var parts = [], m;
    while ((m = re.exec(text)) !== null) parts.push(m[1]);
    return parts.length ? parts.join('\n\n') : text;
  }

  function openVN() {
    var text = pickLatestAiText();
    if (!text) { toast('没有可渲染的消息'); return; }
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

  // 向扩展菜单注入入口
  function ensureEntry() {
    var menu = document.getElementById('extensionsMenu') ||
               document.querySelector('#extensions_menu') ||
               document.querySelector('.extensions_block .list-group');
    if (!menu) return false;
    if (menu.querySelector('#' + ENTRY_ID)) return true;
    var a = document.createElement('a');
    a.id = ENTRY_ID;
    a.className = 'list-group-item';
    a.href = 'javascript:void(0)';
    a.title = '打开最近一条消息的视觉小说阅读器';
    a.innerHTML = '<span class="fa-solid fa-book-open" style="margin-right:6px"></span> Visual Novel';
    a.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      openVN();
    });
    menu.appendChild(a);
    console.info(LOG, '菜单入口已注入');
    return true;
  }

  function boot() {
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      if (ensureEntry() || tries > 60) clearInterval(t);
    }, 500);
    ensureEntry();
    // 暴露给控制台调试
    window.VNM_Extension = { open: openVN, ensureEntry: ensureEntry };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
