/* ============================================================================
 * Visual Novel — SillyTavern 扩展引导
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
  var ENABLED_KEY = 'vnm-ext-enabled';
  var HIDE_KEY = 'vnm-ext-hidebody';
  var FABVN_KEY = 'vnm-ext-fab-vn';
  var FABSYS_KEY = 'vnm-ext-fab-sys';
  console.info(LOG, 'bootstrap loaded');

  function getCtx() { try { return (window.SillyTavern && SillyTavern.getContext) ? SillyTavern.getContext() : null; } catch (e) { return null; } }
  function pref(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function setPref(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function hideBodyOn() { return pref(HIDE_KEY, '1') !== '0'; }
  function enabledVN() { return pref(ENABLED_KEY, '1') !== '0'; }
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
  function injectAll() { if (!enabledVN()) return; var chat = document.getElementById('chat'); if (!chat) return; var l = chat.querySelectorAll('.mes'); for (var i = 0; i < l.length; i++) ensureLauncherIn(l[i]); }

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

  /* ---------- 功能系统: 常驻单例运行时(独立于 VN 阅读器, 永不随开关重建) ---------- */
  var FS_HOST_ID = 'vnm-fs-host';

  // 确保 #vnm-statusbar 始终挂在 tavern body, 这样阅读器开/关/全屏都不会销毁它
  function fsAnchor() { return document.fullscreenElement || document.body; }
  function keepSbAnchored() {
    var sb = document.getElementById('vnm-statusbar');
    if (!sb) return;
    var target = fsAnchor();   // 浏览器全屏时挂进全屏元素, 否则挂 body, 保证全屏下也可见
    if (sb.parentNode !== target) { try { target.appendChild(sb); } catch (e) {} }
  }

  // 创建/获取常驻功能系统运行时(隐藏的 host iframe 以 pc 模式跑出功能系统, 再把面板移到 body 常驻)
  function ensureFsRuntime(cb) {
    var sb = document.getElementById('vnm-statusbar');
    if (sb) { keepSbAnchored(); if (cb) cb(sb); return; }
    var host = document.getElementById(FS_HOST_ID);
    if (!host) {
      host = buildIframe('功能系统。');                 // 需要至少一句正文, 阅读器才会渲染并建出功能系统
      if (!host) { if (cb) cb(null); return; }
      host.id = FS_HOST_ID;
      host.removeAttribute('scrolling');
      // 离屏常驻, 不可见、不挡操作; 但保持存活, 功能系统(电话等)逻辑就一直在这里跑
      host.style.cssText = 'position:fixed;left:-100000px;top:0;width:440px;height:760px;border:none;opacity:0;pointer-events:none;z-index:-1;';
      host.addEventListener('load', function () { bootFs(host, cb); });
      document.body.appendChild(host);
    } else { bootFs(host, cb); }
  }
  function bootFs(host, cb) {
    var opened = false;
    function tryOpen() {
      try {
        var doc = host.contentDocument;
        var btn = doc && doc.getElementById('vnm-btn-pc');   // pc 模式: 阅读器渲染在 host 内部(离屏), 不污染主页面
        if (btn && !opened) { opened = true; btn.click(); }
      } catch (e) {}
    }
    var n = 0, t = setInterval(function () {
      tryOpen();
      // 功能系统可能先建在 host 文档里, 找到后移到主 body 常驻
      var sb = document.getElementById('vnm-statusbar');
      if (!sb) { try { var hd = host.contentDocument; sb = hd && hd.getElementById('vnm-statusbar'); } catch (e) {} }
      if (sb) {
        try { document.body.appendChild(sb); } catch (e) {}
        sb.style.display = 'none';                 // 默认隐藏, 由 FAB/阅读器内按钮切换显示
        clearInterval(t);
        if (cb) cb(sb);
      } else if (++n > 60) { clearInterval(t); if (cb) cb(null); }
    }, 120);
  }

  function openFunctionSystem() {
    ensureFsRuntime(function (sb) {
      if (!sb) { toast('功能系统正在初始化，请稍候再点'); return; }
      keepSbAnchored();
      var vis = sb.style.display !== 'none';
      sb.style.display = vis ? 'none' : 'flex';   // FAB = 显示/隐藏 同一个常驻功能系统
      try { var d = JSON.parse(localStorage.getItem('vnm-statusbar-v2') || '{}'); d.visible = !vis; localStorage.setItem('vnm-statusbar-v2', JSON.stringify(d)); } catch (e) {}
    });
  }

  /* ---------- 样式 ---------- */
  function ensureLiquidFilter() {
    if (document.getElementById('vnm-fab-liquid-svg')) return;
    // 径向遮罩: 中心清晰区(95%)不扭曲, 边缘扭曲 —— 与你功能系统同款参数
    var mask = '<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52">' +
      '<defs><radialGradient id="g" cx="50%" cy="50%" r="72%">' +
      '<stop offset="0%" stop-color="black"/><stop offset="95%" stop-color="black"/>' +
      '<stop offset="100%" stop-color="white"/></radialGradient></defs>' +
      '<rect width="52" height="52" fill="url(#g)"/></svg>';
    var wrap = document.createElement('div');
    wrap.id = 'vnm-fab-liquid-svg';
    wrap.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
    wrap.innerHTML =
      '<svg width="0" height="0"><filter id="vnm-fab-liquid" x="-20%" y="-20%" width="140%" height="140%" primitiveUnits="userSpaceOnUse">' +
        '<feTurbulence type="fractalNoise" baseFrequency="0.012 0.012" numOctaves="2" seed="7" result="noise"/>' +
        '<feGaussianBlur in="noise" stdDeviation="2" result="soft"/>' +
        '<feImage x="0" y="0" width="52" height="52" result="mask" href="data:image/svg+xml,' + encodeURIComponent(mask) + '"/>' +
        '<feComposite in="soft" in2="mask" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="noiseMasked"/>' +
        '<feFlood flood-color="rgb(128,128,128)" result="gray"/>' +
        '<feComposite in="gray" in2="mask" operator="arithmetic" k1="-1" k2="1" k3="0" k4="0" result="grayMasked"/>' +
        '<feComposite in="noiseMasked" in2="grayMasked" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="dispMap"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="dispMap" scale="60" xChannelSelector="R" yChannelSelector="G"/>' +
        '<feGaussianBlur stdDeviation="1.5"/>' +
      '</filter></svg>';
    document.body.appendChild(wrap);
  }
  function ensureStyle() {
    ensureLiquidFilter();
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style'); st.id = STYLE_ID;
    st.textContent =
      '#vnm-ext-dock{position:fixed;right:16px;bottom:108px;z-index:99999;display:flex;flex-direction:column;gap:12px;}' +
      '.vnm-fab{position:relative;width:52px;height:52px;padding:0;border-radius:50%;cursor:grab;isolation:isolate;touch-action:none;' +
        'color:rgba(255,255,255,.92);border:none;background:rgba(255,255,255,.05);' +
        'backdrop-filter:blur(1.5px) saturate(160%) url(#vnm-fab-liquid);-webkit-backdrop-filter:blur(6px) saturate(160%);' +
        'box-shadow:0 6px 20px rgba(0,0,0,.40),inset 0 0 0 1px rgba(255,255,255,.16),inset 0 1px 1px rgba(255,255,255,.30);' +
        'display:flex;align-items:center;justify-content:center;transition:box-shadow .18s ease;}' +
      '.vnm-fab:hover{box-shadow:0 8px 26px rgba(0,0,0,.48),inset 0 0 0 1px rgba(255,255,255,.24),inset 0 1px 1px rgba(255,255,255,.4);}' +
      '.vnm-fab:active{cursor:grabbing;}' +
      '.vnm-fab svg{position:relative;z-index:1;pointer-events:none;}' +
      '#vnm-ext-dock.vnm-dragging .vnm-fab{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;transition:none!important;}' +
      'body.vnm-hidebody-on #chat .mes.vnm-has-vn .vnm-orig-body{display:none!important;}';
    (document.head || document.documentElement).appendChild(st);
  }

  function applyHideBody() { document.body.classList.toggle('vnm-hidebody-on', hideBodyOn()); }
  function removeLaunchers() {
    var l = document.querySelectorAll('iframe.' + HOST_CLASS);
    for (var i = 0; i < l.length; i++) { try { l[i].remove(); } catch (e) {} }
    var ms = document.querySelectorAll('.mes.vnm-has-vn');
    for (var j = 0; j < ms.length; j++) {
      ms[j].classList.remove('vnm-has-vn');
      var ob = ms[j].querySelector('.vnm-orig-body');
      if (ob) { while (ob.firstChild) ob.parentNode.insertBefore(ob.firstChild, ob); ob.remove(); } // 还原正文
    }
  }
  function applyEnabled() {
    if (enabledVN()) { injectAll(); ensureDock(); }
    else {
      removeLaunchers();
      var dk = document.getElementById('vnm-ext-dock'); if (dk) dk.remove();
      var sb = document.getElementById('vnm-statusbar'); if (sb) sb.style.display = 'none';
      var fh = document.getElementById('vnm-fs-host'); if (fh) fh.remove();
    }
  }

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
    var moved = false, dragging = false, sx = 0, sy = 0, baseL = 0, baseT = 0, raf = 0, pendL = 0, pendT = 0;
    b.addEventListener('pointerdown', function (e) {
      var dock = document.getElementById('vnm-ext-dock'); if (!dock) return;
      dragging = true; moved = false; sx = e.clientX; sy = e.clientY;
      var r = dock.getBoundingClientRect(); baseL = r.left; baseT = r.top;
      pendL = baseL; pendT = baseT;
      try { b.setPointerCapture(e.pointerId); } catch (err) {}
    });
    b.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        moved = true;
        var dk = document.getElementById('vnm-ext-dock');
        if (dk) { dk.classList.add('vnm-dragging'); dk.style.right = 'auto'; dk.style.bottom = 'auto'; }
      }
      if (!moved) return;
      pendL = baseL + dx; pendT = baseT + dy;
      if (!raf) raf = requestAnimationFrame(function () {
        raf = 0;
        var dk = document.getElementById('vnm-ext-dock');
        if (dk) { dk.style.left = pendL + 'px'; dk.style.top = pendT + 'px'; }
      });
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      var dk = document.getElementById('vnm-ext-dock');
      if (dk) {
        dk.classList.remove('vnm-dragging');
        if (moved) { dk.style.left = pendL + 'px'; dk.style.top = pendT + 'px';
          try { localStorage.setItem('vnm-ext-dockpos', JSON.stringify({ left: dk.style.left, top: dk.style.top })); } catch (err) {} }
      }
      try { b.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    b.addEventListener('pointerup', endDrag);
    b.addEventListener('pointercancel', endDrag);
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (moved) { moved = false; return; } onClick(); });
    return b;
  }
  function ensureDock() {
    if (!enabledVN()) { var ex0 = document.getElementById('vnm-ext-dock'); if (ex0) ex0.remove(); return; }
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
        '<b><span class="fa-solid fa-book-open" style="margin-right:6px"></span>Visual Novel</b>' +
        '<div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>' +
        '<div class="inline-drawer-content">' +
          '<label class="checkbox_label"><input type="checkbox" id="vnm-cfg-enabled"><span><b>启用 Visual Novel</b>（总开关）</span></label>' +
          '<label class="checkbox_label" style="margin-top:6px"><input type="checkbox" id="vnm-cfg-hidebody"><span>隐藏正文（只显示启动器界面）</span></label>' +
          '<label class="checkbox_label" style="margin-top:6px"><input type="checkbox" id="vnm-cfg-fabvn"><span>显示 Visual Novel 悬浮按钮</span></label>' +
          '<label class="checkbox_label" style="margin-top:6px"><input type="checkbox" id="vnm-cfg-fabsys"><span>显示 功能系统 悬浮按钮</span></label>' +
          '<div class="menu_button menu_button_icon interactable" id="vnm-cfg-open" style="width:100%;justify-content:center;margin-top:8px"><span class="fa-solid fa-expand"></span><span>全屏打开最新一轮</span></div>' +
          '<div class="menu_button menu_button_icon interactable" id="vnm-cfg-sys" style="width:100%;justify-content:center;margin-top:6px"><span class="fa-solid fa-table-cells-large"></span><span>打开功能系统</span></div>' +
        '</div></div>';
    host.appendChild(wrap);
    // 抽屉展开/收起交给 SillyTavern 原生 inline-drawer 处理(勿再自行绑定, 否则双重切换关不上)
    var en = wrap.querySelector('#vnm-cfg-enabled'); en.checked = enabledVN(); en.addEventListener('change', function () { setPref(ENABLED_KEY, en.checked ? '1' : '0'); applyEnabled(); });
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
    ensureStyle(); applyHideBody();
    // 全屏切换时把功能系统挂进/挂出全屏元素, 保证全屏下也能看到
    document.addEventListener('fullscreenchange', function () { setTimeout(keepSbAnchored, 50); });
    // 兜底: 功能系统右上角"隐藏"叉 -> 强制关闭面板(原处理引用了阅读器 overlay, 常驻化后可能失效)
    document.addEventListener('click', function (e) {
      var sb = document.getElementById('vnm-statusbar'); if (!sb) return;
      var btn = (e.target && e.target.closest) ? e.target.closest('button') : null;
      if (btn && sb.contains(btn) && (btn.title === '隐藏' || btn.getAttribute('title') === '隐藏')) {
        sb.style.display = 'none';
        try { var d = JSON.parse(localStorage.getItem('vnm-statusbar-v2') || '{}'); d.visible = false; localStorage.setItem('vnm-statusbar-v2', JSON.stringify(d)); } catch (err) {}
      }
    }, true);
    if (enabledVN()) injectAll();
    var n = 0, t = setInterval(function () { n++; ensureMenuEntry(); ensureSettingsPanel(); ensureDock(); injectAll(); applyHideBody(); if (n > 40) clearInterval(t); }, 500);
    ensureMenuEntry(); ensureSettingsPanel(); ensureDock(); hookEvents();
    window.VNM_Extension = { open: openLatestFullscreen, openSystem: openFunctionSystem, injectAll: injectAll };
    console.info(LOG, '就绪');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
