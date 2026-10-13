// ─────────────────────────────────────────────────────────────
// FEATURE (v0.4.0): DevTools Graph Viewer — منطق نمایشگر
// ─────────────────────────────────────────────────────────────
(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var canvas = document.getElementById('canvas');
  var gViewport = document.getElementById('g-viewport');
  var gEdges = document.getElementById('g-edges');
  var gNodes = document.getElementById('g-nodes');
  var stage = document.getElementById('stage');
  var panel = document.getElementById('panel');
  var emptyEl = document.getElementById('empty');
  var toastEl = document.getElementById('toast');

  // اعداد فارسی برای شمارش‌ها.
  var faDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  function toFa(n) {
    return String(n).replace(/[0-9]/g, function (d) {
      return faDigits[+d];
    });
  }

  // ── XSS Sanitization (BUG-DEV-07: جلوگیری از تزریق HTML از طریق label ها) ──
  function sanitize(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── نمونه‌ی دمو (وقتی DevTools نصب نیست) ──
  var SAMPLE = {
    generatedAt: Date.now(),
    counts: { signals: 4, effects: 4, directives: 4, dom: 4, edges: 12 },
    nodes: [
      { id: 'sig:count', type: 'signal', label: 'count', value: 3, createdAt: 0 },
      { id: 'sig:name', type: 'signal', label: 'name', value: 'Zen', createdAt: 0 },
      { id: 'sig:items', type: 'signal', label: 'items', value: 5, createdAt: 0 },
      { id: 'sig:visible', type: 'signal', label: 'visible', value: true, createdAt: 0 },
      {
        id: 'eff:text1',
        type: 'effect',
        label: 'eff:text1',
        deps: ['sig:count'],
        createdAt: 0,
      },
      {
        id: 'eff:text2',
        type: 'effect',
        label: 'eff:text2',
        deps: ['sig:name'],
        createdAt: 0,
      },
      {
        id: 'eff:bind1',
        type: 'effect',
        label: 'eff:bind1',
        deps: ['sig:items'],
        createdAt: 0,
      },
      {
        id: 'eff:show1',
        type: 'effect',
        label: 'eff:show1',
        deps: ['sig:visible'],
        createdAt: 0,
      },
      {
        id: 'dir:text:1',
        type: 'directive',
        label: 'zen-text',
        directiveType: 'text',
        elementSelector: 'span#c',
        expression: '$count',
        createdAt: 0,
      },
      {
        id: 'dir:text:2',
        type: 'directive',
        label: 'zen-text',
        directiveType: 'text',
        elementSelector: 'h1#t',
        expression: '$name',
        createdAt: 0,
      },
      {
        id: 'dir:bind:1',
        type: 'directive',
        label: 'zen-bind',
        directiveType: 'bind',
        elementSelector: 'ul#list',
        expression: '$items',
        createdAt: 0,
      },
      {
        id: 'dir:show:1',
        type: 'directive',
        label: 'zen-show',
        directiveType: 'show',
        elementSelector: 'div#box',
        expression: '$visible',
        createdAt: 0,
      },
      { id: 'dom:1', type: 'dom', label: '<span>', domTag: 'span', createdAt: 0 },
      { id: 'dom:2', type: 'dom', label: '<h1>', domTag: 'h1', createdAt: 0 },
      { id: 'dom:3', type: 'dom', label: '<ul>', domTag: 'ul', createdAt: 0 },
      { id: 'dom:4', type: 'dom', label: '<div>', domTag: 'div', createdAt: 0 },
    ],
    edges: [
      { from: 'sig:count', to: 'eff:text1', type: 'read-by' },
      { from: 'sig:name', to: 'eff:text2', type: 'read-by' },
      { from: 'sig:items', to: 'eff:bind1', type: 'read-by' },
      { from: 'sig:visible', to: 'eff:show1', type: 'read-by' },
      { from: 'eff:text1', to: 'dir:text:1', type: 'drives' },
      { from: 'eff:text2', to: 'dir:text:2', type: 'drives' },
      { from: 'eff:bind1', to: 'dir:bind:1', type: 'drives' },
      { from: 'eff:show1', to: 'dir:show:1', type: 'drives' },
      { from: 'dir:text:1', to: 'dom:1', type: 'updates' },
      { from: 'dir:text:2', to: 'dom:2', type: 'updates' },
      { from: 'dir:bind:1', to: 'dom:3', type: 'updates' },
      { from: 'dir:show:1', to: 'dom:4', type: 'updates' },
    ],
  };

  var COLORS = { signal: '#3b82f6', effect: '#f59e0b', directive: '#a855f7', dom: '#22c55e' };
  var TYPE_FA = { signal: 'سیگنال', effect: 'افکت', directive: 'دایرکتیو', dom: 'DOM' };

  var state = {
    snapshot: null,
    nodes: [],
    edges: [],
    selected: null,
    sim: null,
    // zoom & pan (BUG-DEV-04: زوم و پیمایش برای گراف‌های بزرگ)
    zoom: 1,
    panX: 0,
    panY: 0,
    panDragging: false,
    panStart: null,
  };

  // ── Zoom / Pan ──
  function applyTransform() {
    gViewport.setAttribute(
      'transform',
      'translate(' + state.panX + ',' + state.panY + ') scale(' + state.zoom + ')',
    );
  }

  function zoomAt(wheelDelta, mx, my) {
    var oldZoom = state.zoom;
    var step = wheelDelta > 0 ? 1.12 : 1 / 1.12;
    var newZoom = Math.max(0.15, Math.min(6, state.zoom * step));
    state.zoom = newZoom;
    // anchor zoom to cursor position
    var rect = canvas.getBoundingClientRect();
    var px = mx - rect.left,
      py = my - rect.top;
    state.panX = px - (px - state.panX) * (newZoom / oldZoom);
    state.panY = py - (py - state.panY) * (newZoom / oldZoom);
    applyTransform();
  }

  function resetZoom() {
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
    applyTransform();
    toast('زوم به حالت اولیه بازگشت.');
  }

  // ── بارگذاری داده ──
  function loadSnapshot() {
    // 1) حالت زنده از DevTools hook
    try {
      if (
        typeof window !== 'undefined' &&
        window.__ZENITH__ &&
        typeof window.__ZENITH__.getDependencyGraph === 'function'
      ) {
        var live = window.__ZENITH__.getDependencyGraph();
        if (live && live.nodes && live.nodes.length) {
          setData(live);
          return;
        }
      }
    } catch (e) {
      toast('خطا در دریافت از DevTools: ' + e.message);
    }
    // 2) داده‌ی inline از صفحه‌ی میزبان
    try {
      if (typeof window !== 'undefined' && window.__ZENITH_GRAPH_DATA__) {
        setData(window.__ZENITH_GRAPH_DATA__);
        return;
      }
    } catch (e) {
      toast('خطا در دریافت از __ZENITH_GRAPH_DATA__: ' + e.message);
    }
    // 3) query string
    try {
      var qs = new URLSearchParams(window.location.search).get('data');
      if (qs) {
        var json = JSON.parse(atob(qs));
        setData(json);
        return;
      }
    } catch (e) {
      toast('خطا در decode query string: ' + e.message);
    }
    // 4) خالی
    setData(null);
  }

  function setData(snap) {
    state.snapshot = snap;
    resetZoom();
    if (!snap || !snap.nodes)
      snap = {
        nodes: [],
        edges: [],
        counts: { signals: 0, effects: 0, directives: 0, dom: 0, edges: 0 },
      };
    var byId = {};
    state.nodes = snap.nodes.map(function (n) {
      var v = {
        id: n.id,
        type: n.type,
        label: n.label || n.id,
        raw: n,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        fx: null,
        fy: null,
      };
      byId[n.id] = v;
      return v;
    });
    state.edges = (snap.edges || [])
      .map(function (e) {
        return { from: byId[e.from], to: byId[e.to], type: e.type, raw: e };
      })
      .filter(function (e) {
        return e.from && e.to;
      });
    state.selected = null;
    updateCounts(snap.counts || countOf(state.nodes));
    if (!state.nodes.length) {
      emptyEl.style.display = 'flex';
      clearSvg();
      renderPanel(null);
      return;
    }
    emptyEl.style.display = 'none';
    layoutInit();
    startSim();
    render();
    renderPanel(null);
  }

  function countOf(nodes) {
    var c = { signals: 0, effects: 0, directives: 0, dom: 0, edges: state.edges.length };
    nodes.forEach(function (n) {
      if (n.type === 'signal') c.signals++;
      else if (n.type === 'effect') c.effects++;
      else if (n.type === 'directive') c.directives++;
      else if (n.type === 'dom') c.dom++;
    });
    return c;
  }

  function updateCounts(c) {
    document.getElementById('c-s').textContent = toFa(c.signals || 0);
    document.getElementById('c-e').textContent = toFa(c.effects || 0);
    document.getElementById('c-d').textContent = toFa(c.directives || 0);
    document.getElementById('c-m').textContent = toFa(c.dom || 0);
  }

  // ── چیدمان اولیه: دایره‌ای بر اساس نوع ──
  function layoutInit() {
    var w = stage.clientWidth,
      h = stage.clientHeight;
    var cx = w / 2,
      cy = h / 2;
    var groups = { signal: [], effect: [], directive: [], dom: [] };
    state.nodes.forEach(function (n) {
      (groups[n.type] || (groups[n.type] = [])).push(n);
    });
    var order = ['signal', 'effect', 'directive', 'dom'];
    var ringR = Math.min(w, h) * 0.34;
    order.forEach(function (type, gi) {
      var arr = groups[type] || [];
      var base = (gi / 4) * Math.PI * 2 - Math.PI / 2;
      arr.forEach(function (n, i) {
        var a = arr.length === 1 ? base : base + (i / arr.length) * ((Math.PI * 2) / 4);
        n.x = cx + Math.cos(a) * ringR;
        n.y = cy + Math.sin(a) * ringR;
        n.vx = 0;
        n.vy = 0;
      });
    });
  }

  // ── شبیه‌سازی Force-Directed (ساده، بدون dependency) ──
  function startSim() {
    if (state.sim) cancelAnimationFrame(state.sim);
    var w = stage.clientWidth,
      h = stage.clientHeight;
    var cx = w / 2,
      cy = h / 2;
    var REP = 4200; // ضریب دافعه
    var SPRING = 0.04; // ضریب جاذبه‌ی یال‌ها
    var LEN = 90; // طول مطلوب یال
    var CENTER = 0.012; // جذب به مرکز
    var DAMP = 0.82; // میرایی
    var alpha = 1;
    var ticks = 0;

    function step() {
      var ns = state.nodes;
      // دافعه‌ی زوج‌ها
      for (var i = 0; i < ns.length; i++) {
        for (var j = i + 1; j < ns.length; j++) {
          var a = ns[i],
            b = ns[j];
          var dx = b.x - a.x,
            dy = b.y - a.y;
          var d2 = dx * dx + dy * dy + 0.01;
          var d = Math.sqrt(d2);
          var f = (REP / d2) * alpha;
          var fx = (dx / d) * f,
            fy = (dy / d) * f;
          if (a.fx === null) {
            a.vx -= fx;
            a.vy -= fy;
          }
          if (b.fx === null) {
            b.vx += fx;
            b.vy += fy;
          }
        }
      }
      // جاذبه‌ی یال‌ها (فنر)
      for (var e = 0; e < state.edges.length; e++) {
        var ed = state.edges[e];
        var dx = ed.to.x - ed.from.x,
          dy = ed.to.y - ed.from.y;
        var d = Math.sqrt(dx * dx + dy * dy) + 0.01;
        var f = (d - LEN) * SPRING * alpha;
        var fx = (dx / d) * f,
          fy = (dy / d) * f;
        if (ed.from.fx === null) {
          ed.from.vx += fx;
          ed.from.vy += fy;
        }
        if (ed.to.fx === null) {
          ed.to.vx -= fx;
          ed.to.vy -= fy;
        }
      }
      // جذب به مرکز + اعمال سرعت
      for (var k = 0; k < ns.length; k++) {
        var n = ns[k];
        if (n.fx !== null) {
          n.x = n.fx;
          n.y = n.fy;
          continue;
        }
        n.vx += (cx - n.x) * CENTER * alpha;
        n.vy += (cy - n.y) * CENTER * alpha;
        n.vx *= DAMP;
        n.vy *= DAMP;
        n.x += n.vx;
        n.y += n.vy;
        // مرز
        var pad = 40;
        if (n.x < pad) n.x = pad;
        if (n.x > w - pad) n.x = w - pad;
        if (n.y < pad) n.y = pad;
        if (n.y > h - pad) n.y = h - pad;
      }
      alpha *= 0.985;
      ticks++;
      renderPositions();
      if (alpha > 0.02 && ticks < 600) {
        state.sim = requestAnimationFrame(step);
      } else {
        state.sim = null;
      }
    }
    state.sim = requestAnimationFrame(step);
  }

  function clearSvg() {
    while (gEdges.firstChild) gEdges.removeChild(gEdges.firstChild);
    while (gNodes.firstChild) gNodes.removeChild(gNodes.firstChild);
  }

  // ── رندر اولیه (ساخت عناصر SVG) ──
  function render() {
    clearSvg();
    // یال‌ها
    state.edges.forEach(function (e, i) {
      var path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('class', 'edge');
      path.setAttribute('marker-end', 'url(#arrow)');
      path.dataset.idx = String(i);
      gEdges.appendChild(path);
      e.el = path;
    });
    // نودها
    state.nodes.forEach(function (n, i) {
      var g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'node');
      g.dataset.idx = String(i);
      var shape = makeShape(n);
      g.appendChild(shape);
      var lbl = document.createElementNS(SVG_NS, 'text');
      lbl.setAttribute('y', nodeRadius(n) + 14);
      lbl.textContent = n.label;
      g.appendChild(lbl);
      var sub = document.createElementNS(SVG_NS, 'text');
      sub.setAttribute('class', 'sub');
      sub.setAttribute('y', nodeRadius(n) + 27);
      sub.textContent = sanitize(TYPE_FA[n.type] || n.type);
      g.appendChild(sub);
      g.addEventListener('click', function (ev) {
        ev.stopPropagation();
        selectNode(n);
      });
      // drag
      enableDrag(g, n);
      gNodes.appendChild(g);
      n.el = g;
      n.shape = shape;
    });
    renderPositions();
    applyTransform();
    canvas.addEventListener('click', onCanvasClick);
    window.addEventListener('resize', onResize);
  }

  function nodeRadius(n) {
    if (n.type === 'signal') return 18;
    if (n.type === 'effect') return 18; // نصف قطر لوزی
    if (n.type === 'directive') return 16; // نصف عرض مستطیل
    return 14; // dom square
  }

  function makeShape(n) {
    var c = COLORS[n.type] || '#888';
    if (n.type === 'signal') {
      var circ = document.createElementNS(SVG_NS, 'circle');
      circ.setAttribute('r', '18');
      circ.setAttribute('fill', c);
      circ.setAttribute('fill-opacity', '.22');
      circ.setAttribute('stroke', c);
      circ.setAttribute('stroke-width', '2');
      return circ;
    }
    if (n.type === 'effect') {
      var poly = document.createElementNS(SVG_NS, 'polygon');
      poly.setAttribute('points', '0,-18 18,0 0,18 -18,0');
      poly.setAttribute('fill', c);
      poly.setAttribute('fill-opacity', '.22');
      poly.setAttribute('stroke', c);
      poly.setAttribute('stroke-width', '2');
      return poly;
    }
    if (n.type === 'directive') {
      var rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', '-22');
      rect.setAttribute('y', '-14');
      rect.setAttribute('width', '44');
      rect.setAttribute('height', '28');
      rect.setAttribute('rx', '4');
      rect.setAttribute('fill', c);
      rect.setAttribute('fill-opacity', '.22');
      rect.setAttribute('stroke', c);
      rect.setAttribute('stroke-width', '2');
      return rect;
    }
    // dom: square
    var sq = document.createElementNS(SVG_NS, 'rect');
    sq.setAttribute('x', '-13');
    sq.setAttribute('y', '-13');
    sq.setAttribute('width', '26');
    sq.setAttribute('height', '26');
    sq.setAttribute('fill', c);
    sq.setAttribute('fill-opacity', '.22');
    sq.setAttribute('stroke', c);
    sq.setAttribute('stroke-width', '2');
    return sq;
  }

  // ── به‌روزرسانی موقعیت عناصر ──
  function renderPositions() {
    state.nodes.forEach(function (n) {
      if (n.el) n.el.setAttribute('transform', 'translate(' + n.x + ',' + n.y + ')');
    });
    state.edges.forEach(function (e) {
      if (!e.el) return;
      // منحنی轻微 برای خوانایی بهتر
      var x1 = e.from.x,
        y1 = e.from.y,
        x2 = e.to.x,
        y2 = e.to.y;
      var dx = x2 - x1,
        dy = y2 - y1;
      var d = Math.sqrt(dx * dx + dy * dy) + 0.01;
      // کوتاه کردن انتهاها برای اینکه زیر شکل نروند
      var r1 = nodeRadius(e.from) + 2,
        r2 = nodeRadius(e.to) + 6;
      var sx = x1 + (dx / d) * r1,
        sy = y1 + (dy / d) * r1;
      var ex = x2 - (dx / d) * r2,
        ey = y2 - (dy / d) * r2;
      e.el.setAttribute('d', 'M' + sx + ',' + sy + ' L' + ex + ',' + ey);
    });
  }

  // ── انتخاب و هایلایت ──
  function selectNode(n) {
    state.selected = n;
    var inIds = {},
      outIds = {};
    state.edges.forEach(function (e) {
      if (e.to.id === n.id) inIds[e.from.id] = true;
      if (e.from.id === n.id) outIds[e.to.id] = true;
    });
    state.nodes.forEach(function (nn) {
      if (!nn.el) return;
      var dim = nn.id !== n.id && !inIds[nn.id] && !outIds[nn.id];
      nn.el.classList.toggle('selected', nn.id === n.id);
      nn.el.classList.toggle('dim', dim);
    });
    state.edges.forEach(function (e) {
      if (!e.el) return;
      var hi = e.to.id === n.id || e.from.id === n.id;
      e.el.classList.toggle('hi', hi);
      e.el.classList.toggle('dim', !hi);
      e.el.setAttribute('marker-end', hi ? 'url(#arrow-hi)' : 'url(#arrow)');
    });
    renderPanel(n);
  }

  function clearSelection() {
    state.selected = null;
    state.nodes.forEach(function (nn) {
      if (nn.el) {
        nn.el.classList.remove('selected');
        nn.el.classList.remove('dim');
      }
    });
    state.edges.forEach(function (e) {
      if (e.el) {
        e.el.classList.remove('hi');
        e.el.classList.remove('dim');
        e.el.setAttribute('marker-end', 'url(#arrow)');
      }
    });
    renderPanel(null);
  }

  // BUG-DEVTEXT-06: فقط روی خود canvas کلیک رو قبول کن (نه نودها)
  function onCanvasClick(ev) {
    if (ev.target !== canvas) return;
    clearSelection();
  }

  function renderPanel(n) {
    if (!n) {
      panel.innerHTML =
        '<h2>جزئیات نود</h2><div class="hint">یک نود را در گراف انتخاب کنید تا اطلاعات آن اینجا نمایش داده شود.<br><br>روی نود کلیک کنید تا یال‌های ورودی/خروجی آن هایلایت شوند. کلیک روی فضای خالی، انتخاب را لغو می‌کند.<br><br><span class="badge">Signal → Effect</span> خوانده‌شدن، <span class="badge">Effect → Directive</span> هدایت، <span class="badge">Directive → DOM</span> به‌روزرسانی.</div>';
      return;
    }
    var r = n.raw || {};
    var inEdges = state.edges.filter(function (e) {
      return e.to.id === n.id;
    });
    var outEdges = state.edges.filter(function (e) {
      return e.from.id === n.id;
    });
    var html = '<h2>' + sanitize(TYPE_FA[n.type] || n.type) + '</h2>';
    html += field('شناسه', sanitize(n.id));
    html += field('برچسب', sanitize(n.label));
    if (r.value !== undefined) html += field('مقدار', sanitize(fmtVal(r.value)));
    if (r.deps) html += field('وابستگی‌ها', sanitize(r.deps.length ? r.deps.join('، ') : '—'));
    if (r.directiveType) html += field('نوع دایرکتیو', sanitize('zen-' + r.directiveType));
    if (r.elementSelector) html += field('عنصر هدف', sanitize(r.elementSelector));
    if (r.expression) html += field('عبارت', sanitize(r.expression));
    if (r.domTag) html += field('تگ DOM', '&lt;' + sanitize(r.domTag) + '&gt;');
    html += field('یال‌های ورودی', String(inEdges.length));
    html += field('یال‌های خروجی', String(outEdges.length));
    if (inEdges.length) {
      html +=
        '<div class="field"><div class="k">ورودی از:</div><div class="v">' +
        inEdges
          .map(function (e) {
            return '<span class="badge">' + sanitize(e.from.label) + '</span>';
          })
          .join(' ') +
        '</div></div>';
    }
    if (outEdges.length) {
      html +=
        '<div class="field"><div class="k">خروجی به:</div><div class="v">' +
        outEdges
          .map(function (e) {
            return '<span class="badge">' + sanitize(e.to.label) + '</span>';
          })
          .join(' ') +
        '</div></div>';
    }
    panel.innerHTML = html;
  }

  function field(k, v) {
    return '<div class="field"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>';
  }
  function fmtVal(v) {
    try {
      if (typeof v === 'string') return '"' + v + '"';
      if (typeof v === 'function') return 'ƒ()';
      return JSON.stringify(v);
    } catch (e) {
      return String(v);
    }
  }

  // ── drag نودها ──
  function enableDrag(g, n) {
    var dragging = false,
      offX = 0,
      offY = 0;
    g.addEventListener('mousedown', function (ev) {
      dragging = true;
      var pt = svgPoint(ev);
      offX = pt.x - n.x;
      offY = pt.y - n.y;
      n.fx = n.x;
      n.fy = n.y;
      canvas.classList.add('dragging');
      ev.preventDefault();
      ev.stopPropagation();
    });
    window.addEventListener('mousemove', function (ev) {
      if (!dragging) return;
      var pt = svgPoint(ev);
      n.fx = (pt.x - state.panX) / state.zoom;
      n.fy = (pt.y - state.panY) / state.zoom;
      n.x = n.fx;
      n.y = n.fy;
      renderPositions();
    });
    window.addEventListener('mouseup', function () {
      if (!dragging) return;
      dragging = false;
      n.fx = null;
      n.fy = null;
      canvas.classList.remove('dragging');
      // ری‌استارت آرام شبیه‌سازی
      if (!state.sim) startSim();
    });
  }
  function svgPoint(ev) {
    var rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }

  // ── Zoom با چرخ ماوس ──
  // BUG-DEV-04: cursor-anchored zoom با preventDefault برای جلوگیری از scroll صفحه
  canvas.addEventListener(
    'wheel',
    function (ev) {
      ev.preventDefault();
      zoomAt(ev.deltaY < 0 ? 1 : -1, ev.clientX, ev.clientY);
    },
    { passive: false },
  );

  // ── Pan با درگ پس‌زمینه ──
  canvas.addEventListener('mousedown', function (ev) {
    // فقط روی خود canvas (نه نودها)
    if (ev.target !== canvas) return;
    state.panDragging = true;
    state.panStart = { x: ev.clientX - state.panX, y: ev.clientY - state.panY };
    canvas.classList.add('panning');
    ev.preventDefault();
  });
  window.addEventListener('mousemove', function (ev) {
    if (!state.panDragging) return;
    state.panX = ev.clientX - state.panStart.x;
    state.panY = ev.clientY - state.panStart.y;
    applyTransform();
  });
  window.addEventListener('mouseup', function () {
    if (!state.panDragging) return;
    state.panDragging = false;
    state.panStart = null;
    canvas.classList.remove('panning');
  });

  // BUG-DEVTEXT-06: وقتی visibility تغییر می‌کنه (تب عوض میشه، اسکرول صفحه،
  // یا کاربر از Alt+Tab برمی‌گرده)، ماوس‌ایونت‌ها رو reset می‌کنیم تا
  // نودها در حالت نیمه‌درگ باقی نمونه.
  document.addEventListener('visibilitychange', function () {
    // ریست drag نودها — هر نودی که fx/fy ست شده رو آزاد می‌کنیم چون
    // ممکنه mouseup رو از دست داده باشیم.
    state.nodes.forEach(function (n) {
      n.fx = null;
      n.fy = null;
    });
    state.panDragging = false;
    state.panStart = null;
    canvas.classList.remove('dragging');
    canvas.classList.remove('panning');
  });

  function onResize() {
    if (state.nodes.length) {
      layoutInit();
      if (!state.sim) startSim();
    }
  }

  // ── toast ──
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(function () {
      toastEl.classList.remove('show');
    }, 1800);
  }

  // ── دکمه‌ها ──
  document.getElementById('btn-refresh').addEventListener('click', function () {
    loadSnapshot();
    toast('گراف از DevTools بازخوانی شد.');
  });
  document.getElementById('btn-sample').addEventListener('click', function () {
    setData(JSON.parse(JSON.stringify(SAMPLE)));
    toast('نمونه‌ی دمو بارگذاری شد.');
  });
  document.getElementById('btn-export').addEventListener('click', function () {
    var snap = state.snapshot || {
      nodes: [],
      edges: [],
      counts: { signals: 0, effects: 0, directives: 0, dom: 0, edges: 0 },
    };
    var blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'zenith-dependency-graph.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('خروجی JSON ذخیره شد.');
  });
  document.getElementById('btn-reset-zoom').addEventListener('click', function () {
    resetZoom();
  });

  // ── شروع ──
  loadSnapshot();
})();
