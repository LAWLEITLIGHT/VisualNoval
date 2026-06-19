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
  var TAG_KEY = 'vnm-ext-tag';
  var HIDETAGS_KEY = 'vnm-ext-hidetags';
  var FABVN_KEY = 'vnm-ext-fab-vn';
  var FABSYS_KEY = 'vnm-ext-fab-sys';
  console.info(LOG, 'bootstrap loaded · v' + (window.__VNM_VERSION__ || '?'));

  function getCtx() { try { return (window.SillyTavern && SillyTavern.getContext) ? SillyTavern.getContext() : null; } catch (e) { return null; } }
  function pref(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function setPref(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function hideBodyOn() { return pref(HIDE_KEY, '1') !== '0'; }
  function enabledVN() { return pref(ENABLED_KEY, '1') !== '0'; }
  function reEsc(x) { return String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function getTag() {
    try { var t = JSON.parse(localStorage.getItem(TAG_KEY) || 'null'); if (t && t.start && t.end) return t; } catch (e) {}
    return { start: '<content>', end: '</content>' };
  }
  function getHideTags() {
    try { var a = JSON.parse(localStorage.getItem(HIDETAGS_KEY) || 'null'); if (Array.isArray(a)) return a; } catch (e) {}
    return [];  // 默认不删任何tag: <image>等由主程序自身处理(图位绑定+正文占位), 删了会导致只剩一张图
  }
  function applyHideTags(src) {
    var list = getHideTags();
    for (var i = 0; i < list.length; i++) {
      var f = list[i] && list[i].from, t = list[i] && list[i].to;
      if (!f || !t) continue;
      try { src = src.replace(new RegExp(reEsc(f) + '[\\s\\S]*?' + reEsc(t), 'gi'), ''); } catch (e) {}
    }
    return src;
  }
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
      var ex = null; for (var k = 0; k < sbS.vnmApps.length; k++) { if (sbS.vnmApps[k] && sbS.vnmApps[k].id === p.id) { ex = sbS.vnmApps[k]; break; } }
      if (ex) {
        // 强制同步: 每次以打包(github)版本为准更新代码/声明, 但保留用户 settingsValues 与 enabled
        var sig = JSON.stringify([p.pageCode, p.injectCode, p.injectEnabled, p.settingsFields, p.version, p.icon, p.name]);
        var cur = JSON.stringify([ex.pageCode, ex.injectCode, ex.injectEnabled, ex.settingsFields, ex.version, ex.icon, ex.name]);
        if (sig !== cur) {
          ex.version = p.version || ex.version; ex.name = p.name; ex.description = p.description || '';
          ex.icon = p.icon || ex.icon; ex.settingsTitle = p.settingsTitle || p.name;
          ex.settingsFields = p.settingsFields || []; ex.pageCode = p.pageCode || '';
          ex.injectCode = p.injectCode || ''; ex.injectEnabled = !!p.injectEnabled; ch = true;
        }
        return;
      }
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
  function extractSource(text) {
    var tg = getTag();
    var startPat = reEsc(tg.start);
    if (tg.start.charAt(tg.start.length - 1) === '>') startPat = reEsc(tg.start.slice(0, -1)) + '[^>]*>';
    var re;
    try { re = new RegExp(startPat + '([\\s\\S]*?)' + reEsc(tg.end), 'gi'); } catch (e) { re = /<content[^>]*>([\s\S]*?)<\/content>/gi; }
    var p = [], m; while ((m = re.exec(text)) !== null) p.push(m[1]);
    return p.length ? applyHideTags(p.join('\n\n')) : '';
  }

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
    var html = tmpl.replace('%%VNM_SOURCE%%', safe);
    var ver = window.__VNM_VERSION__;
    if (ver) html = html.replace('白桃</b>&nbsp;&nbsp;v9.25', '白桃</b>&nbsp;&nbsp;v' + ver);
    ifr.setAttribute('srcdoc', html);
    ifr.style.cssText = 'width:100%;border:none;display:block;background:transparent;overflow:hidden;';
    autosize(ifr);
    return ifr;
  }
  function ensureLauncherIn(mes, force) {
    if (!isCandidate(mes)) return false;
    var mesText = mes.querySelector('.mes_text'); if (!mesText) return false;
    if (mesText.querySelector('iframe.' + HOST_CLASS)) { mes.classList.add('vnm-has-vn'); return true; }
    var raw = mesRawText(mes);
    var src = extractSource(raw);
    if (!src) { if (!force) return false; src = applyHideTags(raw) || ' '; }  // 自动注入仅限含正文tag; FAB 强制时抓不到也开
    if (!mesText.querySelector('.vnm-orig-body')) {
      var wrap = document.createElement('div'); wrap.className = 'vnm-orig-body';
      while (mesText.firstChild) wrap.appendChild(mesText.firstChild);
      mesText.appendChild(wrap);
    }
    var ifr = buildIframe(src); if (!ifr) return false;
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
    if (!mes) {
      // 没有正文tag也要能打开: 给最新一条 AI 消息强制建启动器(抓不到内容就空着)
      var chat = document.getElementById('chat'); var all = chat ? chat.querySelectorAll('.mes') : [];
      for (var i = all.length - 1; i >= 0; i--) { if (isCandidate(all[i])) { ensureLauncherIn(all[i], true); mes = all[i]; break; } }
    }
    if (!mes) { toast('没有可打开的消息'); return; }
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
    var prevMode = null; try { prevMode = localStorage.getItem('vnm-display-mode'); } catch (e) {}
    function restoreMode() {
      try { if (prevMode === null) localStorage.removeItem('vnm-display-mode'); else localStorage.setItem('vnm-display-mode', prevMode); } catch (e) {}
    }
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
        restoreMode();                             // 还原 vnm-display-mode, 避免污染聊天楼层自动展开
        clearInterval(t);
        if (cb) cb(sb);
      } else if (++n > 60) { clearInterval(t); restoreMode(); if (cb) cb(null); }
    }, 120);
  }

  function resetFunctionSystem() {
    // 假死时不用刷新整页: 拆掉常驻运行时与面板, 重新创建
    try { var sb = document.getElementById('vnm-statusbar'); if (sb) sb.remove(); } catch (e) {}
    try { var h = document.getElementById('vnm-fs-host'); if (h) h.remove(); } catch (e) {}
    ensureFsRuntime(function (s2) { if (s2) { keepSbAnchored(); s2.style.display = 'flex'; } else toast('功能系统重建中...'); });
    toast('功能系统已重置');
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
          '<div class="menu_button menu_button_icon interactable" id="vnm-cfg-reset" style="width:100%;justify-content:center;margin-top:6px" title="功能系统假死/点不动时, 不刷新整页就能恢复"><span class="fa-solid fa-rotate"></span><span>重置功能系统(假死时用)</span></div>' +
          '<hr style="margin:12px 0;opacity:.3">' +
          '<div style="font-weight:600;margin-bottom:4px">识别正文用 tag</div>' +
          '<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">正文从 <input id="vnm-tag-start" class="text_pole" style="width:120px" placeholder="<content>"> 到 <input id="vnm-tag-end" class="text_pole" style="width:120px" placeholder="</content>"></div>' +
          '<div style="font-weight:600;margin:12px 0 4px">不显示（VN 模式里隐藏这些 tag 之间的内容）</div>' +
          '<div id="vnm-hide-list"></div>' +
          '<div class="menu_button interactable" id="vnm-hide-add" style="margin-top:6px">+ 添加一条</div>' +
        '</div></div>';
    host.appendChild(wrap);
    // 抽屉展开/收起交给 SillyTavern 原生 inline-drawer 处理(勿再自行绑定, 否则双重切换关不上)
    var en = wrap.querySelector('#vnm-cfg-enabled'); en.checked = enabledVN(); en.addEventListener('change', function () { setPref(ENABLED_KEY, en.checked ? '1' : '0'); applyEnabled(); });
    var hb = wrap.querySelector('#vnm-cfg-hidebody'); hb.checked = hideBodyOn(); hb.addEventListener('change', function () { setPref(HIDE_KEY, hb.checked ? '1' : '0'); applyHideBody(); });
    var fv = wrap.querySelector('#vnm-cfg-fabvn'); fv.checked = showFabVN(); fv.addEventListener('change', function () { setPref(FABVN_KEY, fv.checked ? '1' : '0'); ensureDock(); });
    var fs2 = wrap.querySelector('#vnm-cfg-fabsys'); fs2.checked = showFabSys(); fs2.addEventListener('change', function () { setPref(FABSYS_KEY, fs2.checked ? '1' : '0'); ensureDock(); });
    wrap.querySelector('#vnm-cfg-open').addEventListener('click', openLatestFullscreen);
    wrap.querySelector('#vnm-cfg-sys').addEventListener('click', openFunctionSystem);
    wrap.querySelector('#vnm-cfg-reset').addEventListener('click', resetFunctionSystem);

    // 识别正文用 tag
    var tg = getTag();
    var ts = wrap.querySelector('#vnm-tag-start'), te = wrap.querySelector('#vnm-tag-end');
    ts.value = tg.start; te.value = tg.end;
    function saveTag() {
      var st = ts.value.trim() || '<content>', en2 = te.value.trim() || '</content>';
      setPref(TAG_KEY, JSON.stringify({ start: st, end: en2 }));
    }
    ts.addEventListener('change', saveTag); te.addEventListener('change', saveTag);

    // 不显示 tag 列表
    var listEl = wrap.querySelector('#vnm-hide-list');
    function renderHideList() {
      var arr = getHideTags(); listEl.innerHTML = '';
      arr.forEach(function (it, idx) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:5px;margin-bottom:5px;flex-wrap:wrap';
        row.innerHTML = '从 <input class="text_pole vnm-h-from" style="width:110px"> 到 <input class="text_pole vnm-h-to" style="width:110px"> <div class="menu_button interactable vnm-h-del" style="padding:2px 8px">删</div>';
        row.querySelector('.vnm-h-from').value = it.from || '';
        row.querySelector('.vnm-h-to').value = it.to || '';
        function save() {
          var a = getHideTags();
          a[idx] = { from: row.querySelector('.vnm-h-from').value, to: row.querySelector('.vnm-h-to').value };
          setPref(HIDETAGS_KEY, JSON.stringify(a));
        }
        row.querySelector('.vnm-h-from').addEventListener('change', save);
        row.querySelector('.vnm-h-to').addEventListener('change', save);
        row.querySelector('.vnm-h-del').addEventListener('click', function () {
          var a = getHideTags(); a.splice(idx, 1); setPref(HIDETAGS_KEY, JSON.stringify(a)); renderHideList();
        });
        listEl.appendChild(row);
      });
    }
    renderHideList();
    wrap.querySelector('#vnm-hide-add').addEventListener('click', function () {
      var a = getHideTags(); a.push({ from: '', to: '' }); setPref(HIDETAGS_KEY, JSON.stringify(a)); renderHideList();
    });
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

  /* ---------- 普通酒馆输入框发送时也注入(配合 __vnmInjectFn) ---------- */
  function computeInject() {
    var parts = [];
    var sbS = {};
    try { sbS = JSON.parse(localStorage.getItem('vnm-statusbar-v2') || '{}') || {}; } catch (e) {}
    try { (sbS.injectCharIds || []).forEach(function (id) { var h = sbS.history && sbS.history[id]; if (h && h.length && h[0].raw) parts.push(h[0].raw); }); } catch (e) {}
    (sbS.vnmApps || []).forEach(function (app) {
      if (!app || !app.enabled || !app.injectEnabled || !app.injectCode) return;
      try {
        var ctx = { sbS: sbS, settings: app.settingsValues || {}, save: function () {}, toast: function () {},
          fetch: window.fetch ? window.fetch.bind(window) : null, Audio: window.Audio, atob: window.atob };
        var fn = new Function('ctx', 'return(' + app.injectCode + ')(ctx);');
        var r = fn(ctx); console.info(LOG, '注入app', app.id, 'enabled=' + app.enabled, 'injectEnabled=' + app.injectEnabled, 'len=' + (r ? String(r).length : 0)); if (r) parts.push(String(r));
      } catch (e) { console.warn(LOG, '注入app失败', app.id, e); }
    });
    return parts.join('\n');
  }
  function getInjectText() {
    try { var t = computeInject(); if (t) return t; } catch (e) {}
    try { var f = window.__vnmInjectFn; return (typeof f === 'function') ? String(f() || '') : ''; } catch (e) { return ''; }
  }
  function prependInjectToTextarea() {
    var ta = document.getElementById('send_textarea'); if (!ta) return;
    var v = ta.value; if (!v || !v.trim()) return;
    if (v.indexOf('<VNInject>') !== -1) return;
    var a = getInjectText(); if (!a) return;
    ta.value = '<VNInject>' + a + '</VNInject>\n' + v;
  }
  function hookTavernSend() {
    document.addEventListener('keydown', function (e) {
      if (!enabledVN()) return;
      var t = e.target;
      if (t && t.id === 'send_textarea' && e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) prependInjectToTextarea();
    }, true);
    document.addEventListener('click', function (e) {
      if (!enabledVN()) return;
      var b = (e.target && e.target.closest) ? e.target.closest('#send_but, .send_but') : null;
      if (b) prependInjectToTextarea();
    }, true);
  }

  /* ---------- 注入折叠正则: <VNInject>A</VNInject> -> 液态玻璃折叠按钮 ---------- */
  function ensureFoldRegex() {
    try {
      var c = getCtx(); if (!c) return;
      var es = c.extensionSettings; if (!es) return;
      es.regex = es.regex || [];
      var changed = false;
      var FOLD_HTML = "<svg width=\"0\" height=\"0\" style=\"position:absolute\" aria-hidden=\"true\"><filter id=\"vnm-fold-lq\" x=\"-15%\" y=\"-15%\" width=\"130%\" height=\"130%\"><feTurbulence type=\"fractalNoise\" baseFrequency=\"0.012 0.012\" numOctaves=\"2\" seed=\"4\" result=\"n\"/><feGaussianBlur in=\"n\" stdDeviation=\"1.3\" result=\"nb\"/><feDisplacementMap in=\"SourceGraphic\" in2=\"nb\" scale=\"12\" xChannelSelector=\"R\" yChannelSelector=\"G\"/></filter></svg><details class=\"vnm-inject-fold\" style=\"margin:5px 0;\"><summary style=\"list-style:none;cursor:pointer;display:inline-flex;align-items:center;gap:7px;padding:6px 18px;border-radius:999px;border:.5px solid rgba(255,255,255,.26);background:rgba(255,255,255,.06);backdrop-filter:blur(12px) saturate(175%) brightness(1.05) url(#vnm-fold-lq);-webkit-backdrop-filter:blur(16px) saturate(175%) brightness(1.05);box-shadow:0 4px 16px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.32),inset 0 -1px 2px rgba(0,0,0,.18);font-size:12px;font-weight:600;letter-spacing:.6px;color:rgba(255,255,255,.9);\"><span style=\"opacity:.85;font-size:10px\">▸</span>Visual Novel<span style=\"opacity:.45;font-weight:400\"> · 注入内容</span></summary><div style=\"margin-top:7px;padding:11px 14px;border-radius:16px;background:rgba(255,255,255,.04);border:.5px solid rgba(255,255,255,.13);white-space:pre-wrap;font-size:12px;line-height:1.6;opacity:.9;\">$1</div></details>";
      var want = [
        { id: 'vnm-inject-fold-display', scriptName: 'VN注入折叠(显示)',
          findRegex: '/<VNInject>([\\s\\S]*?)<\\/VNInject>/g', replaceString: FOLD_HTML,
          markdownOnly: true, promptOnly: false },
        { id: 'vnm-inject-fold-prompt', scriptName: 'VN注入剥标签(提示词)',
          findRegex: '/<VNInject>([\\s\\S]*?)<\\/VNInject>/g', replaceString: '$1',
          markdownOnly: false, promptOnly: true }
      ];
      want.forEach(function (w) {
        for (var i = 0; i < es.regex.length; i++) {
          if (es.regex[i] && es.regex[i].id === w.id) { es.regex[i].replaceString = w.replaceString; return; }
        }
        es.regex.push({ id: w.id, scriptName: w.scriptName, findRegex: w.findRegex, replaceString: w.replaceString,
          trimStrings: [], placement: [1], disabled: false, markdownOnly: w.markdownOnly, promptOnly: w.promptOnly,
          runOnEdit: true, substituteRegex: 0, minDepth: null, maxDepth: null });
        changed = true;
      });
      if (changed && c.saveSettingsDebounced) c.saveSettingsDebounced();
    } catch (e) { console.warn(LOG, 'ensureFoldRegex 失败', e); }
  }

  function boot() {
    try { seedApps(); } catch (e) {}
    try { ensureFoldRegex(); } catch (e) {}
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
    ensureMenuEntry(); ensureSettingsPanel(); ensureDock(); hookEvents(); hookTavernSend();
    setTimeout(function(){ try{ ensureFsRuntime(function(){}); }catch(e){} }, 3000);
    window.VNM_Extension = { open: openLatestFullscreen, openSystem: openFunctionSystem, resetSystem: resetFunctionSystem, injectAll: injectAll };
    console.info(LOG, '就绪');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
