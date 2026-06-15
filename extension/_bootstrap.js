/* ============================================================================
 * Visual Novel by白桃 — SillyTavern 扩展引导
 * 复刻原始正则：给每条含 <content> 的消息(含 /hide 楼层)注入启动器 iframe，
 * 沿用主程序的翻轮/内容拉取/信息注入/四模式存储；额外提供可拖动的液态玻璃悬浮
 * 按钮(全屏打开 / 打开功能系统)与"隐藏正文"开关。
 * ========================================================================== */
(function () {
  'use strict';
  var LOG = '[VNM-Ext]';
  var HOST_CLASS = 'vnm-ext-host';
  var STYLE_ID = 'vnm-ext-style';
  var ENTRY_ID = 'vnm-ext-entry';
  var HIDE_KEY = 'vnm-ext-hidebody';
  var FABVN_KEY = 'vnm-ext-fab-vn';
  var FABSYS_KEY = 'vnm-ext-fab-sys';
  console.info(LOG, 'bootstrap loaded');

  function getCtx() { try { return (window.SillyTavern && SillyTavern.getContext) ? SillyTavern.getContext() : null; } catch (e) { return null; } }
  function pref(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function setPref(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function hideBodyOn() { return pref(HIDE_KEY, '1') !== '0'; }
  function showFabVN() { return pref(FABVN_KEY, '1') !== '0'; }
  function showFabSys() { return pref(FABSYS_KEY, '1') !== '0'; }
  function toast(m) { try { if (window.toastr) { window.toastr.info(m, 'Visual Novel'); return; } } catch (e) {} console.info(LOG, m); }

  /* ---------- 默认预装功能 app ---------- */
  function seedApps() {
    var apps = window.__VNM_APPS__ || [];
    if (!apps.length) return;
    var KEY = 'vnm-statusbar-v2', sbS = {};
    try { sbS = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { sbS = {}; }
    if (!Array.isArray(sbS.vnmApps)) sbS.vnmApps = [];
    var ch = false;
    apps.forEach(function (p) {
      if (!p || !p.id || !p.name) return;
      if (sbS.vnmApps.some(function (a) { return a && a.id === p.id; })) return;
      sbS.vnmApps.push({ id: p.id, name: p.name, version: p.version || '1.0', description: p.description || '',
        icon: p.icon || '<circle cx="12" cy="12" r="5"/>', enabled: true, settingsTitle: p.settingsTitle || p.name,
        settingsFields: p.settingsFields || [], settingsValues: {}, pageCode: p.pageCode || '',
        injectCode: p.injectCode || '', injectEnabled: !!p.injectEnabled });
      ch = true;
    });
    if (ch) { try { localStorage.setItem(KEY, JSON.stringify(sbS)); console.info(LOG, '已预装功能 app'); } catch (e) {} }
  }

  /* ---------- 注入启动器到每条消息(含 /hide 楼层) ---------- */
  function isCandidate(mes) {
    // 非用户消息即可(/hide 楼层会带 is_system, 仍要处理); 真系统消息没有 <content> 会被下面过滤
    return mes && mes.getAttribute('is_user') !== 'true';
  }
  function mesRawText(mes) {
    var ctx = getCtx();
    try { var chat = ctx && ctx.chat, mid = mes && mes.getAttribute('mesid'); if (chat && mid != null && chat[+mid]) return String(chat[+mid].mes || ''); } catch (e) {}
    var el = mes && mes.querySelector('.mes_text'); return el ? (el.textContent || '') : '';
  }
  function extractSource(t) { var re = /<content[^>]*>([\s\S]*?)<\/content>/gi, p = [], m; while ((m = re.exec(t)) !== null) p.push(m[1]); return p.length ? p.join('\n\n') : ''; }

  function autosize(iframe) {
    function fit() {
      try { var doc = iframe.contentDocument; if (!doc) return;
        var h = Math.max(doc.body ? doc.body.scrollHeight : 0, doc.documentElement ? doc.documentElement.scrollHeight : 0);
        if (h) iframe.style.height = h + 'px';
      } catch (e) {}
    }
    iframe.addEventListener('load', function () {
      fit();
      try { var w = iframe.contentWindow; if (w && w.ResizeObserver && iframe.contentDocument.body) new w.ResizeObserver(fit).observe(iframe.contentDocument.body); } catch (e) {}
      var n = 0, t = setInterval(function () { fit(); if (++n > 12) clearInterval(t); }, 250);
    });
  }
  function buildIframe(source) {
    var tmpl = window.__VNM_APP_HTML__; if (!tmpl) return null;
    var safe = String(source).replace(/<\/script/gi, '<\\/script');
    var ifr = document.createElement('iframe');
    ifr.className = HOST_CLASS;
    ifr.setAttribute('scrolling', 'no');
    ifr.setAttribute('srcdoc', tmpl.replace('%%VNM_SOURCE%%', safe));
    ifr.style.cssText = 'width:100%;border:none;display:block;background:transparent;overflow:hidden;';
    autosize(ifr);
    return ifr;
  }
  function ensureLauncherIn(mes) {
    if (!isCandidate(mes)) return false;
    var mesText = mes.querySelector('.mes_text'); if (!mesText) return false;
    if (mesText.querySelector('iframe.' + HOST_CLASS)) { mes.classList.add('vnm-has-vn'); return true; }
    var raw = mesRawText(mes);
    if (raw.indexOf('<content') === -1) return false;     // 忠实复刻: 仅含 <content> 的消息
    // 把原正文包进 .vnm-orig-body (供"隐藏正文"开关用), 启动器内联进气泡
    if (!mesText.querySelector('.vnm-orig-body')) {
      var wrap = document.createElement('div'); wrap.className = 'vnm-orig-body';
      while (mesText.firstChild) wrap.appendChild(mesText.firstChild);
      mesText.appendChild(wrap);
    }
    var ifr = buildIframe(extractSource(raw) || raw); if (!ifr) return false;
    mesText.appendChild(ifr);
    mes.classList.add('vnm-has-vn');
    return true;
  }
  function injectAll() { var chat = document.getElementById('chat'); if (!chat) return; var l = chat.querySelectorAll('.mes'); for (var i = 0; i < l.length; i++) ensureLauncherIn(l[i]); }

  /* ---------- 全屏打开最新一轮 ---------- */
  function latestVnMes() {
    var chat = document.getElementById('chat'); if (!chat) return null;
    var l = chat.querySelectorAll('.mes');
    for (var i = l.length - 1; i >= 0; i--) if (isCandidate(l[i]) && l[i].querySelector('iframe.' + HOST_CLASS)) return l[i];
    return null;
  }
  function openLatestFullscreen() {
    injectAll();
    var mes = latestVnMes();
    if (!mes) { toast('没有可渲染的消息（先让 AI 回一条带 <content> 的）'); return; }
    clickFull(mes.querySelector('iframe.' + HOST_CLASS), 0);
  }
  function clickFull(ifr, n) {
    if (!ifr) return;
    try { var doc = ifr.contentDocument; var b = doc && (doc.getElementById('vnm-btn-full') || doc.getElementById('vnm-launch')); if (b) { b.click(); return; } } catch (e) {}
    if ((n || 0) < 20) setTimeout(function () { clickFull(ifr, (n || 0) + 1); }, 150); else toast('阅读器尚未就绪');
  }

  /* ---------- 功能系统(状态栏): 在主页面显示 ---------- */
  function ensureRuntime() {
    // 确保页面上至少有一个 VN iframe 在跑, 这样 setupStatusBar 会建好 #vnm-statusbar
    if (document.getElementById('vnm-statusbar')) return true;
    injectAll();
    if (latestVnMes()) return true;
    // 没有可注入的消息 -> 建一个隐藏的运行时 iframe
    if (!document.getElementById('vnm-runtime-host')) {
      var ifr = buildIframe(' ');
      if (ifr) { ifr.id = 'vnm-runtime-host'; ifr.style.cssText += ';position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;'; document.body.appendChild(ifr); }
    }
    return false;
  }
  function showSb(sb) {
    sb.style.display = 'flex';
    try { var d = JSON.parse(localStorage.getItem('vnm-statusbar-v2') || '{}'); d.visible = true; localStorage.setItem('vnm-statusbar-v2', JSON.stringify(d)); } catch (e) {}
  }
  function openFunctionSystem() {
    var sb = document.getElementById('vnm-statusbar');
    if (sb) { showSb(sb); var ov0 = document.getElementById('vnm-overlay'); if (ov0) ov0.style.display = 'none'; return; }
    // 状态栏由阅读器渲染创建: 先打开最新阅读器, 状态栏出现后把故事层隐藏, 只留功能系统
    injectAll();
    var mes = latestVnMes();
    if (!mes) { toast('先让 AI 回一条带 <content> 的消息'); return; }
    clickFull(mes.querySelector('iframe.' + HOST_CLASS), 0);
    var n = 0, t = setInterval(function () {
      var s2 = document.getElementById('vnm-statusbar');
      if (s2) { showSb(s2); var ov = document.getElementById('vnm-overlay'); if (ov) ov.style.display = 'none'; clearInterval(t); }
      else if (++n > 30) { clearInterval(t); toast('功能系统尚未就绪，请稍候再点'); }
    }, 150);
  }

  /* ---------- 样式 ---------- */
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style'); st.id = STYLE_ID;
    st.textContent =
      '#vnm-ext-dock{position:fixed;right:16px;bottom:108px;z-index:99999;display:flex;flex-direction:column;gap:12px;}' +
      '.vnm-fab{position:relative;width:52px;height:52px;padding:0;border-radius:50%;cursor:pointer;overflow:hidden;' +
        'color:rgba(255,255,255,.92);border:1px solid rgba(255,255,255,.22);' +
        'background:linear-gradient(140deg,rgba(255,255,255,.16),rgba(255,255,255,.03));' +
        'backdrop-filter:blur(22px) saturate(185%) brightness(1.05);-webkit-backdrop-filter:blur(22px) saturate(185%) brightness(1.05);' +
        'box-shadow:0 8px 30px rgba(0,0,0,.40),inset 0 1px 1px rgba(255,255,255,.6),inset 0 -7px 13px rgba(0,0,0,.24),inset 0 0 0 .5px rgba(255,255,255,.10);' +
        'display:flex;align-items:center;justify-content:center;transition:transform .14s ease,box-shadow .22s ease;}' +
      '.vnm-fab::before{content:"";position:absolute;inset:0;border-radius:50%;pointer-events:none;' +
        'background:radial-gradient(125% 85% at 30% 16%,rgba(255,255,255,.55),rgba(255,255,255,0) 56%);}' +
      '.vnm-fab::after{content:"";position:absolute;left:16%;right:28%;top:9%;height:30%;border-radius:50%;pointer-events:none;' +
        'background:linear-gradient(180deg,rgba(255,255,255,.5),rgba(255,255,255,0));filter:blur(2px);}' +
      '.vnm-fab:hover{transform:translateY(-1px) scale(1.05);box-shadow:0 12px 36px rgba(0,0,0,.46),inset 0 1px 1px rgba(255,255,255,.7),inset 0 -7px 13px rgba(0,0,0,.24);}' +
      '.vnm-fab:active{transform:scale(.93);}' +
      '.vnm-fab svg{position:relative;z-index:1;pointer-events:none;filter:drop-shadow(0 1px 1px rgba(0,0,0,.35));}' +
      'body.vnm-hidebody-on #chat .mes.vnm-has-vn .vnm-orig-body{display:none!important;}';
    (document.head || document.documentElement).appendChild(st);
  }

  function applyHideBody() { document.body.classList.toggle('vnm-hidebody-on', hideBodyOn()); }

  /* 单色玻璃 logo（顺色，无彩色） */
  // Visual Novel logo: 对话框 + 爱心(乙游/galgame 感, 单色顺色)
  var ICON_VN =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4 3v-3H4A1.5 1.5 0 0 1 2.5 15V7A1.5 1.5 0 0 1 4 5.5Z"/>' +
      '<path d="M12 13.2c-1.5-1-2.7-1.9-2.7-3.05 0-.9.72-1.45 1.5-1.45.62 0 1.05.34 1.2.62.15-.28.58-.62 1.2-.62.78 0 1.5.55 1.5 1.45 0 1.15-1.2 2.05-2.7 3.05Z" fill="currentColor" stroke="none" opacity=".92"/></svg>';
  // 功能系统 logo: 小电脑(与状态栏 sb-toggle 同款, 单色)
  var ICON_SYS =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="2.5" y="4" width="19" height="13" rx="2"/><line x1="8" y1="20.5" x2="16" y2="20.5"/><line x1="12" y1="17" x2="12" y2="20.5"/></svg>';

  /* 可拖动 FAB */
  function makeFab(id, title, svg, onClick) {
    var b = document.createElement('button');
    b.id = id; b.className = 'vnm-fab'; b.type = 'button'; b.title = title; b.innerHTML = svg;
    var moved = false, dragging = false, sx = 0, sy = 0;
    b.addEventListener('pointerdown', function (e) {
      dragging = true; moved = false; sx = e.clientX; sy = e.clientY;
      try { b.setPointerCapture(e.pointerId); } catch (err) {}
    });
    b.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        moved = true;
        var dock = document.getElementById('vnm-ext-dock');
        var r = dock.getBoundingClientRect();
        dock.style.left = (r.left + dx) + 'px'; dock.style.top = (r.top + dy) + 'px';
        dock.style.right = 'auto'; dock.style.bottom = 'auto';
        sx = e.clientX; sy = e.clientY;
        try { localStorage.setItem('vnm-ext-dockpos', JSON.stringify({ left: dock.style.left, top: dock.style.top })); } catch (err) {}
      }
    });
    b.addEventListener('pointerup', function (e) { dragging = false; try { b.releasePointerCapture(e.pointerId); } catch (err) {} });
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (moved) { moved = false; return; } onClick(); });
    return b;
  }
  function ensureDock() {
    var vn = showFabVN(), sys = showFabSys();
    var ex = document.getElementById('vnm-ext-dock');
    if (!vn && !sys) { if (ex) ex.remove(); return; }
    ensureStyle();
    if (!ex) {
      ex = document.createElement('div'); ex.id = 'vnm-ext-dock';
      try { var p = JSON.parse(localStorage.getItem('vnm-ext-dockpos') || 'null'); if (p && p.left) { ex.style.left = p.left; ex.style.top = p.top; ex.style.right = 'auto'; ex.style.bottom = 'auto'; } } catch (e) {}
      document.body.appendChild(ex);
    }
    ex.innerHTML = '';
    if (vn) ex.appendChild(makeFab('vnm-fab-vn', 'Visual Novel — 全屏打开最新一轮(可拖动)', ICON_VN, openLatestFullscreen));
    if (sys) ex.appendChild(makeFab('vnm-fab-sys', '功能系统 — 在酒馆界面打开(可拖动)', ICON_SYS, openFunctionSystem));
  }

  /* ---------- 魔法棒入口 ---------- */
  function ensureMenuEntry() {
    var menu = document.getElementById('extensionsMenu') || document.querySelector('#extensions_menu') ||
               document.querySelector('.extensions_block .list-group') || document.querySelector('.options-content');
    if (!menu) return false;
    if (menu.querySelector('#' + ENTRY_ID)) return true;
    var a = document.createElement('div'); a.id = ENTRY_ID; a.className = 'list-group-item flex-container flexGap5 interactable'; a.tabIndex = 0;
    a.title = '全屏打开最新一轮 Visual Novel';
    a.innerHTML = '<div class="fa-solid fa-book-open extensionsMenuExtensionButton"></div><span>Visual Novel</span>';
    a.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openLatestFullscreen(); });
    menu.appendChild(a); return true;
  }

  /* ---------- 设置抽屉 ---------- */
  function ensureSettingsPanel() {
    var host = document.getElementById('extensions_settings') || document.getElementById('extensions_settings2');
    if (!host) return false; if (document.getElementById('vnm-ext-drawer')) return true;
    var wrap = document.createElement('div'); wrap.id = 'vnm-ext-drawer';
    wrap.innerHTML =
      '<div class="inline-drawer"><div class="inline-drawer-toggle inline-drawer-header">' +
        '<b><span class="fa-solid fa-book-open" style="margin-right:6px"></span>Visual Novel by白桃</b>' +
        '<div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>' +
        '<div class="inline-drawer-content">' +
          '<label class="checkbox_label"><input type="checkbox" id="vnm-cfg-hidebody"><span>隐藏正文（只显示启动器界面）</span></label>' +
          '<label class="checkbox_label" style="margin-top:6px"><input type="checkbox" id="vnm-cfg-fabvn"><span>显示 Visual Novel 悬浮按钮</span></label>' +
          '<label class="checkbox_label" style="margin-top:6px"><input type="checkbox" id="vnm-cfg-fabsys"><span>显示 功能系统 悬浮按钮</span></label>' +
          '<div class="menu_button menu_button_icon interactable" id="vnm-cfg-open" style="width:100%;justify-content:center;margin-top:8px"><span class="fa-solid fa-expand"></span><span>全屏打开最新一轮</span></div>' +
          '<div class="menu_button menu_button_icon interactable" id="vnm-cfg-sys" style="width:100%;justify-content:center;margin-top:6px"><span class="fa-solid fa-table-cells-large"></span><span>打开功能系统</span></div>' +
        '</div></div>';
    host.appendChild(wrap);
    var tg = wrap.querySelector('.inline-drawer-toggle'), ct = wrap.querySelector('.inline-drawer-content'), ic = wrap.querySelector('.inline-drawer-icon');
    ct.style.display = 'none';
    tg.addEventListener('click', function () { var o = ct.style.display === 'none'; ct.style.display = o ? '' : 'none'; if (ic) { ic.classList.toggle('down', !o); ic.classList.toggle('up', o); } });
    var hb = wrap.querySelector('#vnm-cfg-hidebody'); hb.checked = hideBodyOn(); hb.addEventListener('change', function () { setPref(HIDE_KEY, hb.checked ? '1' : '0'); applyHideBody(); });
    var fv = wrap.querySelector('#vnm-cfg-fabvn'); fv.checked = showFabVN(); fv.addEventListener('change', function () { setPref(FABVN_KEY, fv.checked ? '1' : '0'); ensureDock(); });
    var fs2 = wrap.querySelector('#vnm-cfg-fabsys'); fs2.checked = showFabSys(); fs2.addEventListener('change', function () { setPref(FABSYS_KEY, fs2.checked ? '1' : '0'); ensureDock(); });
    wrap.querySelector('#vnm-cfg-open').addEventListener('click', openLatestFullscreen);
    wrap.querySelector('#vnm-cfg-sys').addEventListener('click', openFunctionSystem);
    return true;
  }

  /* ---------- 持续注入 ---------- */
  var deb = null;
  function schedule() { clearTimeout(deb); deb = setTimeout(function () { injectAll(); applyHideBody(); }, 200); }
  function hookEvents() {
    var ctx = getCtx();
    try { if (ctx && ctx.eventSource && ctx.event_types) { var et = ctx.event_types;
      [et.CHARACTER_MESSAGE_RENDERED, et.USER_MESSAGE_RENDERED, et.MESSAGE_SWIPED, et.MESSAGE_UPDATED, et.MORE_MESSAGES_LOADED, et.CHAT_CHANGED].forEach(function (e) { if (e) ctx.eventSource.on(e, schedule); }); } } catch (e) {}
    var chat = document.getElementById('chat');
    if (chat && window.MutationObserver) new MutationObserver(schedule).observe(chat, { childList: true, subtree: false });
  }

  function boot() {
    try { seedApps(); } catch (e) {}
    ensureStyle(); applyHideBody(); injectAll();
    var n = 0, t = setInterval(function () { n++; ensureMenuEntry(); ensureSettingsPanel(); ensureDock(); injectAll(); applyHideBody(); if (n > 40) clearInterval(t); }, 500);
    ensureMenuEntry(); ensureSettingsPanel(); ensureDock(); hookEvents();
    window.VNM_Extension = { open: openLatestFullscreen, openSystem: openFunctionSystem, injectAll: injectAll };
    console.info(LOG, '就绪');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
