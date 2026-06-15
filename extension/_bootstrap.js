/* ============================================================================
 * Visual Novel (liquid glass) — SillyTavern 扩展引导（iframe 注入式）
 *
 * 不在全局跑 app.js，而是把你原始正则的整段 HTML（window.__VNM_APP_HTML__）
 * 作为 srcdoc 注入到目标消息的一个 <iframe> 里运行——等价于正则把卡片渲染进
 * 那条消息。这样 app 回到它原本的运行环境：图片作用域、状态栏、自动打开等
 * 与正则版完全一致。
 *
 * 不依赖 <content>：消息里有 <content> 用其中内容，否则用整条消息文本。
 * ========================================================================== */
(function () {
  'use strict';
  var ENTRY_ID = 'vnm-ext-entry';
  var FAB_ID = 'vnm-ext-fab';
  var HOST_CLASS = 'vnm-ext-host';
  var LOG = '[VNM-Ext]';
  console.info(LOG, 'bootstrap loaded');

  function getCtx() {
    try { return (window.SillyTavern && SillyTavern.getContext) ? SillyTavern.getContext() : null; }
    catch (e) { return null; }
  }

  // 找到最新一条 AI 消息的 .mes 元素（DOM 优先，回退 context）
  function findLatestAiMes() {
    var chat = document.getElementById('chat');
    if (chat) {
      var all = chat.querySelectorAll('.mes');
      for (var i = all.length - 1; i >= 0; i--) {
        var mes = all[i];
        if (mes.getAttribute('is_user') === 'true') continue;
        if (mes.getAttribute('is_system') === 'true') continue;
        var t = mes.querySelector('.mes_text');
        if (t && t.textContent && t.textContent.trim()) return mes;
      }
      if (all.length) return all[all.length - 1];
    }
    return null;
  }

  // 取该消息的源文本：有 <content> 取其中，否则取整段
  function sourceFromMes(mes) {
    var ctx = getCtx();
    var raw = '';
    // 优先用 context 里的 mes 原文（更干净）
    try {
      var chat = ctx && ctx.chat;
      var mid = mes && mes.getAttribute('mesid');
      if (chat && mid != null && chat[+mid]) raw = String(chat[+mid].mes || '');
    } catch (e) {}
    if (!raw) {
      var el = mes && mes.querySelector('.mes_text');
      raw = el ? (el.textContent || '') : '';
    }
    var re = /<content[^>]*>([\s\S]*?)<\/content>/gi, parts = [], m;
    while ((m = re.exec(raw)) !== null) parts.push(m[1]);
    return parts.length ? parts.join('\n\n') : raw;
  }

  // 把 app HTML 注入成该消息内的 iframe（复刻正则环境）
  function injectInto(mes) {
    var tmpl = window.__VNM_APP_HTML__;
    if (!tmpl) { toast('运行时模板缺失，请刷新重试'); return false; }
    var mesText = mes.querySelector('.mes_text') || mes;
    // 移除本扩展先前注入的 iframe，避免重复
    var old = mesText.querySelector('iframe.' + HOST_CLASS);
    if (old) old.remove();

    var source = sourceFromMes(mes);
    var safe = String(source).replace(/<\/script/gi, '<\\/script');
    var html = tmpl.replace('%%VNM_SOURCE%%', safe);

    var iframe = document.createElement('iframe');
    iframe.className = HOST_CLASS;
    iframe.setAttribute('srcdoc', html);
    iframe.style.cssText = 'width:100%;border:none;display:block;background:transparent;min-height:140px;';
    mesText.appendChild(iframe);
    console.info(LOG, '已把阅读器注入到 mesid=' + (mes.getAttribute('mesid') || '?'));
    return true;
  }

  function openVN() {
    var mes = findLatestAiMes();
    if (!mes) { toast('没有可渲染的消息（先让 AI 回一条）'); return; }
    injectInto(mes);
  }

  function toast(msg) {
    try { if (window.toastr) { window.toastr.info(msg, 'Visual Novel'); return; } } catch (e) {}
    console.info(LOG, msg);
  }

  // ---- 入口 1: 魔法棒/扩展菜单项 ----
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
    a.title = '把最近一条消息渲染成视觉小说';
    a.innerHTML = '<div class="fa-solid fa-book-open extensionsMenuExtensionButton"></div><span>Visual Novel</span>';
    a.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openVN(); });
    menu.appendChild(a);
    console.info(LOG, '菜单入口已注入 ->', menu.id || menu.className);
    return true;
  }

  // ---- 入口 2: 扩展程序设置抽屉 ----
  function ensureSettingsPanel() {
    var host = document.getElementById('extensions_settings') ||
               document.getElementById('extensions_settings2');
    if (!host) return false;
    if (document.getElementById('vnm-ext-drawer')) return true;
    var wrap = document.createElement('div');
    wrap.id = 'vnm-ext-drawer';
    wrap.innerHTML =
      '<div class="inline-drawer">' +
        '<div class="inline-drawer-toggle inline-drawer-header">' +
          '<b><span class="fa-solid fa-book-open" style="margin-right:6px"></span>Visual Novel</b>' +
          '<div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>' +
        '</div>' +
        '<div class="inline-drawer-content">' +
          '<small style="opacity:.75">把最近一条 AI 消息渲染成视觉小说（无需 &lt;content&gt; 也可用）。</small>' +
          '<div class="menu_button menu_button_icon interactable" id="vnm-ext-open" style="width:100%;justify-content:center;margin-top:8px">' +
            '<span class="fa-solid fa-play"></span><span>打开阅读器</span>' +
          '</div>' +
          '<label class="checkbox_label" style="margin-top:8px">' +
            '<input type="checkbox" id="vnm-ext-fab-toggle"><span>显示右下角悬浮按钮</span>' +
          '</label>' +
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
    wrap.querySelector('#vnm-ext-open').addEventListener('click', openVN);
    var fabChk = wrap.querySelector('#vnm-ext-fab-toggle');
    var fabPref = true;
    try { fabPref = localStorage.getItem('vnm-ext-fab') !== '0'; } catch (e) {}
    fabChk.checked = fabPref; applyFabPref(fabPref);
    fabChk.addEventListener('change', function () {
      try { localStorage.setItem('vnm-ext-fab', fabChk.checked ? '1' : '0'); } catch (e) {}
      applyFabPref(fabChk.checked);
    });
    console.info(LOG, '设置抽屉已注入');
    return true;
  }

  // ---- 入口 3: 保底悬浮按钮 ----
  function ensureFab() {
    if (document.getElementById(FAB_ID)) return;
    var b = document.createElement('button');
    b.id = FAB_ID; b.type = 'button'; b.title = 'Visual Novel'; b.innerHTML = '🎴';
    b.style.cssText = ['position:fixed','right:14px','bottom:120px','z-index:99999','width:44px','height:44px','border-radius:50%','border:none','font-size:20px','cursor:pointer','background:rgba(30,30,40,0.72)','color:#fff','box-shadow:0 4px 16px rgba(0,0,0,0.4)','display:flex','align-items:center','justify-content:center'].join(';');
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openVN(); });
    document.body.appendChild(b);
  }
  function applyFabPref(show) {
    if (show) ensureFab();
    else { var f = document.getElementById(FAB_ID); if (f) f.remove(); }
  }


  // ---- 默认预装功能 app: 把打包的 VNM 插件种进 VN 存储(localStorage['vnm-statusbar-v2'].vnmApps) ----
  function seedApps() {
    var apps = window.__VNM_APPS__ || [];
    if (!apps.length) return;
    var KEY = 'vnm-statusbar-v2';
    var sbS = {};
    try { sbS = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { sbS = {}; }
    if (!Array.isArray(sbS.vnmApps)) sbS.vnmApps = [];
    var changed = false;
    apps.forEach(function (p) {
      if (!p || !p.id || !p.name) return;
      var has = sbS.vnmApps.some(function (a) { return a && a.id === p.id; });
      if (has) return; // 已存在则不动, 保留用户设置
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
      try {
        localStorage.setItem(KEY, JSON.stringify(sbS));
        console.info(LOG, '已预装功能 app:', sbS.vnmApps.map(function (a) { return a.name; }).join('、'));
      } catch (e) { console.error(LOG, '预装写入失败(可能超出存储配额):', e); }
    }
  }

  function boot() {
    try { seedApps(); } catch (e) { console.error(LOG, 'seedApps 失败', e); }
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      ensureMenuEntry(); ensureSettingsPanel();
      if (tries > 60) clearInterval(t);
    }, 500);
    ensureMenuEntry(); ensureSettingsPanel();
    var fabPref = true;
    try { fabPref = localStorage.getItem('vnm-ext-fab') !== '0'; } catch (e) {}
    if (fabPref) ensureFab();
    window.VNM_Extension = { open: openVN, seedApps: seedApps, ensureMenuEntry: ensureMenuEntry, ensureSettingsPanel: ensureSettingsPanel };
    console.info(LOG, '就绪。控制台可用 VNM_Extension.open() 手动打开。');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
