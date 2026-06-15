/* ============================================================================
 * Visual Novel by白桃 — SillyTavern 扩展引导
 *
 * 忠实复刻原始正则的行为：给 #chat 里【每一条】含 <content> 的 AI 消息注入启动器
 * iframe（等价于正则把卡片渲染进每条消息），因此原版的"上一段/下一段"跨楼层跳转、
 * 内容拉取、信息注入、四模式存储(localStorage)全部沿用，无需改动你的主程序。
 *
 * 额外提供：
 *  - 悬浮按钮 / 魔法棒入口：直接全屏打开最新一轮 VN
 *  - 扩展设置：隐藏/显示正文（隐藏后该消息只剩启动器界面）
 *  - 默认预装功能 app（浏览器/电话/中介所/壁纸）
 * ========================================================================== */
(function () {
  'use strict';
  var LOG = '[VNM-Ext]';
  var HOST_CLASS = 'vnm-ext-host';
  var FAB_ID = 'vnm-ext-fab';
  var ENTRY_ID = 'vnm-ext-entry';
  var STYLE_ID = 'vnm-ext-style';
  var HIDE_KEY = 'vnm-ext-hidebody';   // '1' 隐藏正文(默认) / '0' 显示
  var FAB_KEY = 'vnm-ext-fab';         // '1' 显示悬浮按钮(默认) / '0'
  console.info(LOG, 'bootstrap loaded');

  function getCtx() {
    try { return (window.SillyTavern && SillyTavern.getContext) ? SillyTavern.getContext() : null; }
    catch (e) { return null; }
  }
  function pref(key, def) {
    try { var v = localStorage.getItem(key); return v == null ? def : v; } catch (e) { return def; }
  }
  function setPref(key, v) { try { localStorage.setItem(key, v); } catch (e) {} }
  function hideBodyOn() { return pref(HIDE_KEY, '1') !== '0'; }

  /* ---------- 默认预装功能 app ---------- */
  function seedApps() {
    var apps = window.__VNM_APPS__ || [];
    if (!apps.length) return;
    var KEY = 'vnm-statusbar-v2', sbS = {};
    try { sbS = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { sbS = {}; }
    if (!Array.isArray(sbS.vnmApps)) sbS.vnmApps = [];
    var changed = false;
    apps.forEach(function (p) {
      if (!p || !p.id || !p.name) return;
      if (sbS.vnmApps.some(function (a) { return a && a.id === p.id; })) return;
      sbS.vnmApps.push({
        id: p.id, name: p.name, version: p.version || '1.0', description: p.description || '',
        icon: p.icon || '<circle cx="12" cy="12" r="5"/>', enabled: true,
        settingsTitle: p.settingsTitle || p.name, settingsFields: p.settingsFields || [],
        settingsValues: {}, pageCode: p.pageCode || '', injectCode: p.injectCode || '',
        injectEnabled: !!p.injectEnabled
      });
      changed = true;
    });
    if (changed) {
      try { localStorage.setItem(KEY, JSON.stringify(sbS)); console.info(LOG, '已预装功能 app:', sbS.vnmApps.map(function (a) { return a.name; }).join('、')); }
      catch (e) { console.error(LOG, '预装写入失败:', e); }
    }
  }

  /* ---------- 每条消息注入启动器 ---------- */
  function isAiMes(mes) {
    if (!mes) return false;
    if (mes.getAttribute('is_user') === 'true') return false;
    if (mes.getAttribute('is_system') === 'true') return false;
    return true;
  }
  function mesRawText(mes) {
    var ctx = getCtx();
    try {
      var chat = ctx && ctx.chat, mid = mes && mes.getAttribute('mesid');
      if (chat && mid != null && chat[+mid]) return String(chat[+mid].mes || '');
    } catch (e) {}
    var el = mes && mes.querySelector('.mes_text');
    return el ? (el.textContent || '') : '';
  }
  function extractSource(text) {
    var re = /<content[^>]*>([\s\S]*?)<\/content>/gi, parts = [], m;
    while ((m = re.exec(text)) !== null) parts.push(m[1]);
    return parts.length ? parts.join('\n\n') : '';
  }
  function buildIframe(source) {
    var tmpl = window.__VNM_APP_HTML__;
    if (!tmpl) return null;
    var safe = String(source).replace(/<\/script/gi, '<\\/script');
    var iframe = document.createElement('iframe');
    iframe.className = HOST_CLASS;
    iframe.setAttribute('srcdoc', tmpl.replace('%%VNM_SOURCE%%', safe));
    iframe.style.cssText = 'width:100%;border:none;display:block;background:transparent;min-height:120px;';
    return iframe;
  }
  function ensureLauncherIn(mes) {
    if (!isAiMes(mes)) return false;
    if (mes.querySelector('iframe.' + HOST_CLASS)) { mes.classList.add('vnm-has-vn'); return true; }
    var raw = mesRawText(mes);
    if (raw.indexOf('<content') === -1) return false;   // 忠实复刻: 只处理含 <content> 的消息
    var source = extractSource(raw) || raw;
    var iframe = buildIframe(source);
    if (!iframe) return false;
    mes.appendChild(iframe);            // 挂到 .mes 下(非 .mes_text), 便于隐藏正文时保留启动器
    mes.classList.add('vnm-has-vn');
    return true;
  }
  function injectAll() {
    var chat = document.getElementById('chat');
    if (!chat) return;
    var list = chat.querySelectorAll('.mes');
    for (var i = 0; i < list.length; i++) ensureLauncherIn(list[i]);
  }

  /* ---------- 全屏打开最新一轮 ---------- */
  function latestVnMes() {
    var chat = document.getElementById('chat');
    if (!chat) return null;
    var list = chat.querySelectorAll('.mes.vnm-has-vn, .mes');
    for (var i = list.length - 1; i >= 0; i--) {
      if (isAiMes(list[i]) && list[i].querySelector('iframe.' + HOST_CLASS)) return list[i];
    }
    return null;
  }
  function openLatestFullscreen() {
    injectAll();
    var mes = latestVnMes();
    if (!mes) {
      // 没有现成的 -> 尝试给最新 AI 消息建一个
      var chat = document.getElementById('chat');
      var all = chat ? chat.querySelectorAll('.mes') : [];
      for (var i = all.length - 1; i >= 0; i--) {
        if (isAiMes(all[i])) {
          var raw = mesRawText(all[i]);
          var iframe = buildIframe(extractSource(raw) || raw);
          if (iframe) { all[i].appendChild(iframe); all[i].classList.add('vnm-has-vn'); mes = all[i]; }
          break;
        }
      }
    }
    if (!mes) { toast('没有可渲染的消息（先让 AI 回一条）'); return; }
    var iframe = mes.querySelector('iframe.' + HOST_CLASS);
    clickFull(iframe, 0);
  }
  function clickFull(iframe, tries) {
    if (!iframe) return;
    try {
      var doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
      var btn = doc && (doc.getElementById('vnm-btn-full') || doc.getElementById('vnm-launch'));
      if (btn) { btn.click(); return; }
    } catch (e) {}
    if ((tries || 0) < 20) setTimeout(function () { clickFull(iframe, (tries || 0) + 1); }, 150);
    else toast('阅读器尚未就绪，请稍候再点');
  }

  function toast(msg) {
    try { if (window.toastr) { window.toastr.info(msg, 'Visual Novel'); return; } } catch (e) {}
    console.info(LOG, msg);
  }

  /* ---------- 样式（FAB + 隐藏正文） ---------- */
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent =
      '.' + FAB_ID + '{position:fixed;right:16px;bottom:118px;z-index:99999;width:52px;height:52px;padding:0;' +
        'border-radius:50%;border:.5px solid rgba(255,255,255,.30);cursor:pointer;' +
        'background:rgba(255,255,255,.08);backdrop-filter:blur(28px) saturate(180%) brightness(1.08);' +
        '-webkit-backdrop-filter:blur(28px) saturate(180%) brightness(1.08);' +
        'box-shadow:0 8px 32px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.40),inset 0 -2px 4px rgba(0,0,0,.18);' +
        'display:flex;align-items:center;justify-content:center;transition:transform .14s ease,box-shadow .2s ease;}' +
      '.' + FAB_ID + ':hover{transform:scale(1.07);box-shadow:0 10px 38px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.55),inset 0 -2px 4px rgba(0,0,0,.18);}' +
      '.' + FAB_ID + ':active{transform:scale(.93);}' +
      '.' + FAB_ID + ' svg{filter:drop-shadow(0 1px 2px rgba(0,0,0,.35));}' +
      'body.vnm-hidebody-on #chat .mes.vnm-has-vn .mes_text{display:none!important;}';
    (document.head || document.documentElement).appendChild(st);
  }
  function applyHideBody() {
    document.body.classList.toggle('vnm-hidebody-on', hideBodyOn());
  }

  /* 液态玻璃白桃 logo（顺色，圆形玻璃按钮内） */
  var PEACH_SVG =
    '<svg width="27" height="27" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="vnmpg" x1="4" y1="4" x2="19" y2="20" gradientUnits="userSpaceOnUse">' +
        '<stop stop-color="#ffe7d8"/><stop offset="1" stop-color="#ff9e86"/></linearGradient></defs>' +
      '<path d="M12 6.6c1.7-2.3 5.6-2.7 7 .2 1.4 2.7.2 6.7-2.2 9-1.7 1.6-3.3 2.3-4.8 2.3s-3.1-.7-4.8-2.3C4.8 13.5 3.6 9.5 5 6.8 6.4 3.9 10.3 4.3 12 6.6Z" fill="url(#vnmpg)"/>' +
      '<path d="M12 6.7c.35 1.3.35 2.8 0 4.5" stroke="rgba(165,64,46,.5)" stroke-width="1" stroke-linecap="round"/>' +
      '<path d="M12.5 5.7c.9-1.3 2.4-1.7 3.5-1.2-.2 1.2-1.1 2.2-2.4 2.5" fill="#8ccf86"/>' +
    '</svg>';

  function ensureFab() {
    if (!showFab()) { var ex = document.getElementById(FAB_ID); if (ex) ex.remove(); return; }
    if (document.getElementById(FAB_ID)) return;
    ensureStyle();
    var b = document.createElement('button');
    b.id = FAB_ID; b.className = FAB_ID; b.type = 'button';
    b.title = 'Visual Novel by白桃 — 全屏打开最新一轮';
    b.innerHTML = PEACH_SVG;
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openLatestFullscreen(); });
    document.body.appendChild(b);
  }
  function showFab() { return pref(FAB_KEY, '1') !== '0'; }

  /* ---------- 魔法棒菜单入口 ---------- */
  function ensureMenuEntry() {
    var menu = document.getElementById('extensionsMenu') ||
               document.querySelector('#extensions_menu') ||
               document.querySelector('.extensions_block .list-group') ||
               document.querySelector('.options-content');
    if (!menu) return false;
    if (menu.querySelector('#' + ENTRY_ID)) return true;
    var a = document.createElement('div');
    a.id = ENTRY_ID;
    a.className = 'list-group-item flex-container flexGap5 interactable';
    a.tabIndex = 0;
    a.title = '全屏打开最新一轮 Visual Novel';
    a.innerHTML = '<div class="fa-solid fa-book-open extensionsMenuExtensionButton"></div><span>Visual Novel</span>';
    a.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openLatestFullscreen(); });
    menu.appendChild(a);
    return true;
  }

  /* ---------- 扩展设置抽屉 ---------- */
  function ensureSettingsPanel() {
    var host = document.getElementById('extensions_settings') || document.getElementById('extensions_settings2');
    if (!host) return false;
    if (document.getElementById('vnm-ext-drawer')) return true;
    var wrap = document.createElement('div');
    wrap.id = 'vnm-ext-drawer';
    wrap.innerHTML =
      '<div class="inline-drawer">' +
        '<div class="inline-drawer-toggle inline-drawer-header">' +
          '<b><span class="fa-solid fa-book-open" style="margin-right:6px"></span>Visual Novel by白桃</b>' +
          '<div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>' +
        '</div>' +
        '<div class="inline-drawer-content">' +
          '<label class="checkbox_label"><input type="checkbox" id="vnm-cfg-hidebody"><span>隐藏正文（只显示启动器界面）</span></label>' +
          '<label class="checkbox_label" style="margin-top:6px"><input type="checkbox" id="vnm-cfg-fab"><span>显示悬浮按钮</span></label>' +
          '<div class="menu_button menu_button_icon interactable" id="vnm-cfg-open" style="width:100%;justify-content:center;margin-top:8px">' +
            '<span class="fa-solid fa-expand"></span><span>全屏打开最新一轮</span></div>' +
          '<small style="display:block;opacity:.7;margin-top:6px">每条含 &lt;content&gt; 的消息都会渲染启动器；上一段/下一段、内容拉取、信息注入与四模式设置沿用主程序。</small>' +
        '</div>' +
      '</div>';
    host.appendChild(wrap);
    var toggle = wrap.querySelector('.inline-drawer-toggle');
    var content = wrap.querySelector('.inline-drawer-content');
    var icon = wrap.querySelector('.inline-drawer-icon');
    content.style.display = 'none';
    toggle.addEventListener('click', function () {
      var open = content.style.display === 'none';
      content.style.display = open ? '' : 'none';
      if (icon) { icon.classList.toggle('down', !open); icon.classList.toggle('up', open); }
    });
    var hb = wrap.querySelector('#vnm-cfg-hidebody');
    hb.checked = hideBodyOn();
    hb.addEventListener('change', function () { setPref(HIDE_KEY, hb.checked ? '1' : '0'); applyHideBody(); });
    var fb = wrap.querySelector('#vnm-cfg-fab');
    fb.checked = showFab();
    fb.addEventListener('change', function () { setPref(FAB_KEY, fb.checked ? '1' : '0'); ensureFab(); });
    wrap.querySelector('#vnm-cfg-open').addEventListener('click', openLatestFullscreen);
    return true;
  }

  /* ---------- 监听新消息, 持续注入 ---------- */
  var debTimer = null;
  function scheduleInject() {
    clearTimeout(debTimer);
    debTimer = setTimeout(function () { injectAll(); applyHideBody(); }, 200);
  }
  function hookEvents() {
    var ctx = getCtx();
    try {
      if (ctx && ctx.eventSource && ctx.event_types) {
        var et = ctx.event_types;
        [et.CHARACTER_MESSAGE_RENDERED, et.USER_MESSAGE_RENDERED, et.MESSAGE_SWIPED,
         et.MESSAGE_UPDATED, et.MORE_MESSAGES_LOADED, et.CHAT_CHANGED].forEach(function (e) {
          if (e) ctx.eventSource.on(e, scheduleInject);
        });
      }
    } catch (e) {}
    var chat = document.getElementById('chat');
    if (chat && window.MutationObserver) {
      new MutationObserver(scheduleInject).observe(chat, { childList: true, subtree: false });
    }
  }

  function boot() {
    try { seedApps(); } catch (e) { console.error(LOG, 'seedApps 失败', e); }
    ensureStyle(); applyHideBody();
    injectAll();
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      ensureMenuEntry(); ensureSettingsPanel(); ensureFab(); injectAll(); applyHideBody();
      if (tries > 40) clearInterval(t);
    }, 500);
    ensureMenuEntry(); ensureSettingsPanel(); ensureFab();
    hookEvents();
    window.VNM_Extension = {
      open: openLatestFullscreen, injectAll: injectAll, seedApps: seedApps,
      setHideBody: function (v) { setPref(HIDE_KEY, v ? '1' : '0'); applyHideBody(); }
    };
    console.info(LOG, '就绪。VNM_Extension.open() 可手动全屏打开。');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
