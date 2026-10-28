(function () {
  'use strict';
  /* ---------- hulpfuncties ---------- */
  var $ = function (s, r) { return (r || document).querySelector(s) };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)) };
  var pad = function (n) { return String(n).padStart(2, '0') };
  var nfmt = {};
  function num(v, d) { d = d || 0; var k = d; nfmt[k] = nfmt[k] || new Intl.NumberFormat('nl-BE', { minimumFractionDigits: d, maximumFractionDigits: d }); return nfmt[k].format(v) }
  function deg(v) { return num(Math.round(v)) + '°' }
  function hm(d) { return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) }
  function dayName(d) { return new Intl.DateTimeFormat('nl-BE', { weekday: 'long', timeZone: 'UTC' }).format(d) }
  function dateShort(d) { return new Intl.DateTimeFormat('nl-BE', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(d) }
  function parseWall(s) { var m = s.match(/(\d+)-(\d+)-(\d+)T(\d+):(\d+)/); return new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5])) }
  function wallNow() { var n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate(), n.getHours(), n.getMinutes())) }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }
  function norm(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() }
  var WD = ['N', 'NO', 'O', 'ZO', 'Z', 'ZW', 'W', 'NW'];
  function windName(d) { return WD[Math.round(d / 45) % 8] }
  function arrow(d) { return '<svg class="wa" viewBox="0 0 16 16" style="transform:rotate(' + (d + 180) + 'deg)" aria-hidden="true"><path d="M8 1l5 12-5-3-5 3z" fill="currentColor"/></svg>' }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)) } catch (e) { return null } }

  /* ---------- weercodes ---------- */
  function wx(code, isDay) {
    switch (code) {
      case 0: return { l: 'Helder', i: isDay ? 'zon' : 'maan' };
      case 1: return { l: 'Overwegend helder', i: isDay ? 'zon' : 'maan' };
      case 2: return { l: 'Half bewolkt', i: isDay ? 'half' : 'half-nacht' };
      case 3: return { l: 'Bewolkt', i: 'wolk' };
      case 45: case 48: return { l: 'Mist', i: 'mist' };
      case 51: case 53: case 55: return { l: 'Motregen', i: 'motregen' };
      case 56: case 57: return { l: 'IJzel', i: 'motregen' };
      case 61: return { l: 'Lichte regen', i: 'regen' };
      case 63: return { l: 'Regen', i: 'regen' };
      case 65: return { l: 'Zware regen', i: 'zwaar' };
      case 66: case 67: return { l: 'IJzelregen', i: 'regen' };
      case 71: return { l: 'Lichte sneeuw', i: 'sneeuw' };
      case 73: case 75: case 77: case 85: case 86: return { l: 'Sneeuw', i: 'sneeuw' };
      case 80: return { l: 'Lichte regenbui', i: 'regen' };
      case 81: return { l: 'Regenbui', i: 'regen' };
      case 82: return { l: 'Zware regenbui', i: 'zwaar' };
      case 95: case 96: case 99: return { l: 'Onweer', i: 'onweer' };
      default: return { l: 'Bewolkt', i: 'wolk' };
    }
  }
  function icon(code, isDay, cls) { var w = wx(code, isDay); return '<svg class="ic ' + (cls || '') + '" role="img" aria-label="' + w.l + '"><use href="#i-' + w.i + '"/></svg>' }
  function rainWord(v) {
    if (v < 0.1) return 'droog';
    if (v < 1) return 'lichte neerslag';
    if (v < 2.5) return 'matige regen';
    if (v < 5) return 'stevige regen';
    if (v < 10) return 'zware regen';
    return 'zeer zware regen';
  }

  /* ---------- plaatsen ---------- */
  var PLACES = [['Zottegem', 'Richtpunt campus Zottegem', 50.8686, 3.8108], ['Ninove', 'Richtpunt campus Ninove', 50.827, 4.0227]].map(function (a) { return { name: a[0], region: a[1], lat: a[2], lon: a[3] } });
  var MAPCITIES = ['Zottegem', 'Ninove'];
  var PREVCITIES = ['Zottegem', 'Ninove'];
  var QUICK = ['Zottegem', 'Ninove'];
  function placeByName(n) { return PLACES.filter(function (p) { return p.name === n })[0] }

  /* ---------- toestand ---------- */
  var state = { view: 'overzicht', place: placeByName('Zottegem'), favs: [], hours48: false, rpos: 4, playing: false };
  (function () { var l = store('br.place'); if (l && ['Zottegem', 'Ninove'].indexOf(l.name) >= 0) state.place = placeByName(l.name); state.favs = [] })();

  /* ---------- voorbeeldgegevens (demo) ---------- */
  var FRONTS = [{ t0: 0, a: 6, lat: 50.95, sx: .55, sy: .33 }, { t0: -120, a: 2.4, lat: 51.35, sx: .3, sy: .2 }, { t0: 1300, a: 3.2, lat: 51.0, sx: .6, sy: .4 }, { t0: 2200, a: 1.4, lat: 50.9, sx: .5, sy: .4 }];
  function field(lon, lat, t) {
    var v = 0;
    for (var i = 0; i < FRONTS.length; i++) { var f = FRONTS[i]; var x = .9 + .02 * (t - f.t0 + 60); var y = f.lat + .05 * (x - 3); var dx = (lon - x) / f.sx, dy = (lat - y) / f.sy; v += f.a * Math.exp(-(dx * dx + dy * dy) / 2) }
    v *= .85 + .15 * Math.sin(lon * 13 + lat * 7 + t * .02);
    return v < .12 ? 0 : v;
  }
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 } }
  function demoWeather(p) {
    var now = wallNow(), r = rng(hashStr(p.name) + now.getUTCDate());
    var y0 = Date.UTC(now.getUTCFullYear(), 0, 0), doy = Math.floor((now - y0) / 864e5);
    var mean = 10.5 - 7 * Math.cos(2 * Math.PI * (doy - 15) / 365) + (51 - p.lat) * .5;
    var dayOff = []; for (var d = 0; d < 7; d++)dayOff.push((r() - .5) * 5);
    var midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    var hoursAll = [], H = 168, cloud = 2;
    for (var k = 0; k < H; k++) {
      var time = new Date(midnight + k * 36e5), h = time.getUTCHours(), dIdx = Math.floor(k / 24);
      var t = (time - now) / 6e4, pr = 0; for (var s = 0; s < 4; s++)pr += field(p.lon, p.lat, t + s * 15); pr /= 4;
      var temp = mean + dayOff[dIdx] + 3.6 * Math.sin(2 * Math.PI * (h - 9) / 24) - (pr > 0 ? 1 : 0);
      cloud = Math.max(1, Math.min(3, Math.round(cloud + (r() - .5) * 1.2)));
      var code = pr >= 5 ? 82 : pr >= 2 ? 63 : pr >= .6 ? 61 : pr >= .15 ? 51 : cloud;
      var isDay = h >= 8 && h < 19;
      hoursAll.push({ time: time, temp: temp, feels: temp - .08 * (14 + pr * 2) - (pr > 0 ? .4 : 0), precip: pr, prob: 0, code: code, wind: 13 + 8 * r() + pr * 2.2, dir: 200 + 40 * Math.sin(k / 9), isDay: isDay });
    }
    hoursAll.forEach(function (o, i) { var near = (hoursAll[i - 1] && hoursAll[i - 1].precip > 0) || (hoursAll[i + 1] && hoursAll[i + 1].precip > 0); o.prob = o.precip > 0 ? Math.min(98, Math.round(45 + o.precip * 18)) : near ? 25 : Math.round(5 + r() * 10) });
    var i0 = Math.floor((now - midnight) / 36e5);
    var hours = hoursAll.slice(i0, i0 + 48);
    var c = hoursAll[i0], c1 = hoursAll[i0 + 1], fr = now.getUTCMinutes() / 60;
    var precipNow = field(p.lon, p.lat, 0);
    var cur = { temp: c.temp + (c1.temp - c.temp) * fr, feels: c.feels + (c1.feels - c.feels) * fr, humidity: Math.round(72 + 10 * Math.sin(doy + p.lat) + (precipNow > 0 ? 12 : 0)), precip: precipNow, code: precipNow >= 5 ? 82 : precipNow >= 2 ? 63 : precipNow >= .6 ? 61 : precipNow >= .15 ? 51 : (c.code >= 51 ? 3 : c.code), wind: c.wind, dir: c.dir, isDay: c.isDay, time: now };
    hours[0].code = cur.code;
    var days = [];
    for (var d2 = 0; d2 < 7; d2++) {
      var hs = hoursAll.slice(d2 * 24, d2 * 24 + 24), temps = hs.map(function (x) { return x.temp }), sum = hs.reduce(function (a, x) { return a + x.precip }, 0);
      var cl = hs.slice(9, 19).reduce(function (a, x) { return a + (x.code <= 3 ? x.code : 2) }, 0) / 10;
      var code2 = sum >= 10 ? 65 : sum >= 4 ? 63 : sum >= 1 ? 61 : sum >= .2 ? 51 : Math.max(1, Math.min(3, Math.round(cl)));
      days.push({ date: hs[0].time, code: code2, tmax: Math.max.apply(null, temps), tmin: Math.min.apply(null, temps), precip: sum, prob: Math.max.apply(null, hs.map(function (x) { return x.prob })), wind: Math.max.apply(null, hs.map(function (x) { return x.wind })) });
    }
    var nc = []; for (var q = 0; q < 16; q++)nc.push({ t: new Date(now.getTime() + q * 9e5), v: field(p.lon, p.lat, q * 15) });
    return { now: cur, hours: hours, days: days, nowcast: nc };
  }
  function demoRadar() {
    var now = wallNow(); now = new Date(Math.floor(now.getTime() / 9e5) * 9e5);
    var pts = radarGrid().map(function (g) { var v = new Float32Array(21); for (var i = 0; i < 21; i++)v[i] = field(g[0], g[1], (i - 4) * 15); return { lon: g[0], lat: g[1], v: v } });
    var times = []; for (var i = 0; i < 21; i++)times.push(new Date(now.getTime() + (i - 4) * 9e5));
    return { pts: pts, times: times, nowIdx: 4 };
  }
  function radarGrid() { var LA = [49.55, 49.95, 50.35, 50.75, 51.15, 51.5], LO = [2.5, 3.15, 3.8, 4.45, 5.1, 5.75, 6.4], g = []; LA.forEach(function (a) { LO.forEach(function (o) { g.push([o, a]) }) }); return g }

  /* ---------- live gegevens (Open-Meteo) ---------- */
  function fetchJSON(url, ms) {
    var ac = new AbortController(), to = setTimeout(function () { ac.abort() }, ms || 6000);
    return fetch(url, { signal: ac.signal }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() }).finally(function () { clearTimeout(to) });
  }
  function liveUrl(p) {
    return 'https://api.open-meteo.com/v1/forecast?latitude=' + p.lat + '&longitude=' + p.lon +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day' +
      '&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max' +
      '&minutely_15=precipitation&forecast_minutely_15=16&timezone=Europe%2FBrussels&forecast_days=7&wind_speed_unit=kmh';
  }
  function parseLive(j) {
    var c = j.current, h = j.hourly, d = j.daily, nowT = parseWall(c.time), key = c.time.slice(0, 13) + ':00';
    var i0 = Math.max(0, h.time.indexOf(key)), hours = [];
    for (var i = i0; i < Math.min(h.time.length, i0 + 48); i++)hours.push({ time: parseWall(h.time[i]), temp: h.temperature_2m[i], feels: h.apparent_temperature[i], precip: h.precipitation[i] || 0, prob: h.precipitation_probability[i] || 0, code: h.weather_code[i], wind: h.wind_speed_10m[i], dir: h.wind_direction_10m[i], isDay: h.is_day[i] === 1 });
    var days = d.time.map(function (t, i) { return { date: parseWall(t + 'T00:00'), code: d.weather_code[i], tmax: d.temperature_2m_max[i], tmin: d.temperature_2m_min[i], precip: d.precipitation_sum[i] || 0, prob: d.precipitation_probability_max[i] || 0, wind: d.wind_speed_10m_max[i] } });
    var nc = [];
    if (j.minutely_15 && j.minutely_15.time) { nc = j.minutely_15.time.map(function (t, i) { return { t: parseWall(t), v: (j.minutely_15.precipitation[i] || 0) * 4 } }).filter(function (o) { return o.t >= nowT - 9e5 }).slice(0, 16) }
    if (!nc.length) nc = hours.slice(0, 4).map(function (o) { return { t: o.time, v: o.precip } });
    return { now: { temp: c.temperature_2m, feels: c.apparent_temperature, humidity: c.relative_humidity_2m, precip: nc[0].v, code: c.weather_code, wind: c.wind_speed_10m, dir: c.wind_direction_10m, isDay: c.is_day === 1, time: nowT }, hours: hours, days: days, nowcast: nc };
  }
  function fetchRadarLive() {
    var g = radarGrid(), url = 'https://api.open-meteo.com/v1/forecast?latitude=' + g.map(function (x) { return x[1] }).join(',') + '&longitude=' + g.map(function (x) { return x[0] }).join(',') +
      '&minutely_15=precipitation&past_minutely_15=4&forecast_minutely_15=16&timezone=Europe%2FBrussels';
    return fetchJSON(url, 10000).then(function (j) {
      var arr = Array.isArray(j) ? j : [j];
      var pts = arr.map(function (o, i) { return { lon: g[i][0], lat: g[i][1], v: Float32Array.from(o.minutely_15.precipitation.map(function (x) { return (x || 0) * 4 })) } });
      return { pts: pts, times: arr[0].minutely_15.time.map(parseWall), nowIdx: 4 };
    });
  }

  /* ---------- data-cache ---------- */
  var cache = {}; var radar = { data: demoRadar(), live: false, pending: true };
  function pkey(p) { return p.lat.toFixed(2) + ',' + p.lon.toFixed(2) }
  function entry(p) {
    var k = pkey(p), e = cache[k];
    if (!e) {
      e = cache[k] = { data: demoWeather(p), live: false, pending: true, failed: false, ts: Date.now() };
      fetchJSON(liveUrl(p)).then(function (j) { e.data = parseLive(j); e.live = true }).catch(function () { e.failed = true }).finally(function () { e.pending = false; e.ts = Date.now(); renderAll() })
    }
    else if (!e.pending && Date.now() - e.ts > 6e5) {
      e.pending = true; e.ts = Date.now();
      fetchJSON(liveUrl(p)).then(function (j) { e.data = parseLive(j); e.live = true; e.failed = false }).catch(function () { if (!e.live) { e.data = demoWeather(p); e.failed = true } }).finally(function () { e.pending = false; renderAll() })
    }
    return e;
  }
  fetchRadarLive().then(function (d) { radar.data = d; radar.live = true }).catch(function () { }).finally(function () { radar.pending = false; if (maps.full) maps.full.setData(radar.data); if (maps.pre) maps.pre.setData(radar.data); renderAll() });
  function statusOf(e) { return e.live ? 'live' : e.pending ? 'laden' : 'demo' }

  /* ---------- radar-kaart ---------- */
  var BE = [[2.55, 51.09], [2.75, 51.16], [2.92, 51.24], [3.13, 51.32], [3.37, 51.37], [3.52, 51.29], [3.78, 51.22], [3.95, 51.27], [4.14, 51.29], [4.25, 51.37], [4.42, 51.43], [4.47, 51.47], [4.76, 51.43], [4.93, 51.41], [5.1, 51.3], [5.25, 51.3], [5.46, 51.3], [5.55, 51.22], [5.68, 51.18], [5.84, 51.09], [5.77, 50.97], [5.7, 50.76], [5.89, 50.75], [6.02, 50.73], [6.12, 50.6], [6.28, 50.62], [6.31, 50.5], [6.4, 50.33], [6.14, 50.13], [5.98, 49.97], [5.82, 49.82], [5.83, 49.54], [5.55, 49.52], [5.4, 49.65], [5.2, 49.68], [5, 49.8], [4.86, 49.98], [4.6, 49.95], [4.3, 49.97], [4.15, 50.05], [4.18, 50.25], [4.1, 50.3], [3.9, 50.34], [3.7, 50.38], [3.65, 50.5], [3.3, 50.52], [3.28, 50.6], [3.12, 50.78], [2.9, 50.72], [2.62, 50.8], [2.62, 50.93]];
  var OV = [[3.42, 51.13], [3.57, 51.21], [3.8, 51.21], [3.96, 51.26], [4.14, 51.29], [4.26, 51.33], [4.35, 51.25], [4.33, 51.15], [4.21, 51.09], [4.15, 51.01], [4.15, 50.92], [4.1, 50.85], [4.05, 50.78], [3.88, 50.73], [3.62, 50.72], [3.47, 50.78], [3.38, 50.88], [3.36, 51], [3.42, 51.13]];
  var LUT = (function () {
    var st = [[0, [156, 207, 213, 0]], [.1, [156, 207, 213, 150]], [1, [58, 160, 173, 205]], [2.5, [14, 101, 119, 225]], [5, [0, 61, 77, 240]], [10, [200, 107, 2, 245]], [16, [160, 80, 2, 250]]];
    var out = new Uint8ClampedArray(256 * 4);
    for (var i = 0; i < 256; i++) {
      var v = Math.pow(i / 255, 2) * 16, a = st[0], b = st[st.length - 1];
      for (var s = 0; s < st.length - 1; s++) { if (v >= st[s][0] && v <= st[s + 1][0]) { a = st[s]; b = st[s + 1]; break } }
      var f = b[0] === a[0] ? 0 : (v - a[0]) / (b[0] - a[0]); if (f < 0) f = 0; if (f > 1) f = 1;
      for (var c = 0; c < 4; c++)out[i * 4 + c] = a[1][c] + (b[1][c] - a[1][c]) * f
    }
    return out
  })();
  function lutIdx(v) { return Math.min(255, Math.round(Math.sqrt(Math.min(v, 16) / 16) * 255)) }

  function RadarMap(canvas, b, cities) { this.cv = canvas; this.b = b; this.cities = cities; this.ctx = canvas.getContext('2d'); this.off = document.createElement('canvas'); this.data = null; this.pos = 4; this.w = 0 }
  RadarMap.prototype.px = function (lon, lat) { var b = this.b; return [(lon - b.lon0) / (b.lon1 - b.lon0) * this.w, (b.lat1 - lat) / (b.lat1 - b.lat0) * this.h] };
  RadarMap.prototype.setData = function (d) { this.data = d; this.weights = null; this.draw() };
  RadarMap.prototype.resize = function () {
    var r = this.cv.getBoundingClientRect(); if (!r.width) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    if (Math.abs(r.width - this.w) < 1 && this.dpr === dpr) return;
    this.w = r.width; this.h = r.width / (this.b.aspect); this.dpr = dpr;
    this.cv.width = Math.round(this.w * dpr); this.cv.height = Math.round(this.h * dpr);
    this.weights = null; this.draw();
  };
  RadarMap.prototype.buildWeights = function () {
    var b = this.b, GW = Math.max(24, Math.ceil(this.w / 6)), GH = Math.max(16, Math.ceil(this.h / 6)), P = this.data.pts, n = P.length, W = new Float32Array(GW * GH * n), cs = Math.cos(50.8 * Math.PI / 180), s2 = 2 * .3 * .3;
    for (var y = 0; y < GH; y++) {
      var lat = b.lat1 - (y + .5) / GH * (b.lat1 - b.lat0);
      for (var x = 0; x < GW; x++) {
        var lon = b.lon0 + (x + .5) / GW * (b.lon1 - b.lon0), o = (y * GW + x) * n, sum = 0;
        for (var i = 0; i < n; i++) { var dx = (lon - P[i].lon) * cs, dy = lat - P[i].lat, w = Math.exp(-(dx * dx + dy * dy) / s2); W[o + i] = w; sum += w }
        for (var j = 0; j < n; j++)W[o + j] /= sum
      }
    }
    this.weights = W; this.GW = GW; this.GH = GH; this.off.width = GW; this.off.height = GH;
  };
  RadarMap.prototype.frameVals = function () {
    var P = this.data.pts, F = P[0].v.length, pos = Math.max(0, Math.min(F - 1, this.pos)), i = Math.floor(pos), f = pos - i, j = Math.min(F - 1, i + 1), out = new Float32Array(P.length);
    for (var k = 0; k < P.length; k++)out[k] = P[k].v[i] * (1 - f) + P[k].v[j] * f; return out;
  };
  RadarMap.prototype.valueAt = function (lon, lat) {
    var P = this.data.pts, v = this.frameVals(), cs = Math.cos(50.8 * Math.PI / 180), s2 = 2 * .09, sum = 0, acc = 0;
    for (var i = 0; i < P.length; i++) { var dx = (lon - P[i].lon) * cs, dy = lat - P[i].lat, w = Math.exp(-(dx * dx + dy * dy) / s2); sum += w; acc += w * v[i] }
    return acc / sum;
  };
  RadarMap.prototype.poly = function (ctx, pts) { ctx.beginPath(); for (var i = 0; i < pts.length; i++) { var p = this.px(pts[i][0], pts[i][1]); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]) } ctx.closePath() };
  RadarMap.prototype.draw = function () {
    if (!this.data || !this.w) return;
    if (!this.weights) this.buildWeights();
    var cs = getComputedStyle(document.documentElement), g = function (n) { return cs.getPropertyValue(n).trim() }, ctx = this.ctx, w = this.w, h = this.h;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = g('--map-out'); ctx.fillRect(0, 0, w, h);
    this.poly(ctx, BE); ctx.fillStyle = g('--map-land'); ctx.fill();
    var vals = this.frameVals(), n = vals.length, GW = this.GW, GH = this.GH, img = this.off.getContext('2d').createImageData(GW, GH), W = this.weights;
    for (var c = 0; c < GW * GH; c++) { var s = 0, o = c * n; for (var i = 0; i < n; i++)s += W[o + i] * vals[i]; var li = lutIdx(s) * 4; img.data[c * 4] = LUT[li]; img.data[c * 4 + 1] = LUT[li + 1]; img.data[c * 4 + 2] = LUT[li + 2]; img.data[c * 4 + 3] = LUT[li + 3] }
    this.off.getContext('2d').putImageData(img, 0, 0);
    ctx.save(); this.poly(ctx, BE); ctx.clip(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(this.off, 0, 0, w, h); ctx.restore();
    this.poly(ctx, BE); ctx.strokeStyle = g('--map-line'); ctx.lineWidth = 1.5; ctx.stroke();
    this.poly(ctx, OV); ctx.setLineDash([6, 4]); ctx.strokeStyle = g('--orange'); ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
    var ink = g('--ink-strong'), halo = g('--map-land'), fs = Math.max(11, Math.min(14, w / 48));
    ctx.font = '500 ' + fs + 'px "Fira Sans",sans-serif'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    var self = this, boxes = [], pl = state.place, pp = this.px(pl.lon, pl.lat);
    function free(x, y, tw, th) { for (var i = 0; i < boxes.length; i++) { var b = boxes[i]; if (x < b[0] + b[2] && x + tw > b[0] && y < b[1] + b[3] && y + th > b[1]) return false } boxes.push([x, y, tw, th]); return true }
    free(pp[0] - 8, pp[1] - 8, 14, 14);
    ctx.font = '700 ' + (fs + 1) + 'px "Outfit",sans-serif'; var pw = ctx.measureText(pl.name).width; free(pp[0] + 12, pp[1] - 12 - fs, pw, fs * 2);
    ctx.font = '500 ' + fs + 'px "Fira Sans",sans-serif';
    this.cities.forEach(function (nm) {
      if (nm === pl.name) return; var p = placeByName(nm); if (!p) return; var q = self.px(p.lon, p.lat); if (q[0] < 6 || q[0] > w - 6 || q[1] < 6 || q[1] > h - 6) return;
      var tw = ctx.measureText(nm).width, left = LEFTLAB.indexOf(nm) >= 0, lx = left ? q[0] - 7 - tw : q[0] + 7;
      if (!free(q[0] - 4, q[1] - 4, 8, 8)) { return }
      if (lx < 3 || lx + tw > w - 3 || !free(lx - 2, q[1] - fs * .7, tw + 4, fs * 1.4)) return;
      ctx.fillStyle = ink; ctx.fillRect(q[0] - 2.5, q[1] - 2.5, 5, 5); ctx.lineWidth = 3; ctx.strokeStyle = halo; ctx.strokeText(nm, lx, q[1]); ctx.fillText(nm, lx, q[1])
    });
    if (pp[0] > 0 && pp[0] < w && pp[1] > 0 && pp[1] < h) {
      ctx.fillStyle = g('--orange'); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.fillRect(pp[0] - 7, pp[1] - 7, 14, 14); ctx.strokeRect(pp[0] - 7, pp[1] - 7, 14, 14);
      ctx.font = '700 ' + (fs + 1) + 'px "Outfit",sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = halo; ctx.strokeText(pl.name, pp[0] + 12, pp[1] - 12); ctx.fillStyle = ink; ctx.fillText(pl.name, pp[0] + 12, pp[1] - 12)
    }
  };
  var LEFTLAB = ['Oostende', 'Roeselare', 'Kortrijk'];
  var maps = { pre: null, full: null };
  var FULL = { lon0: 2.4, lon1: 6.5, lat0: 49.45, lat1: 51.55, aspect: 1.238 };
  var PRE = { lon0: 2.5, lon1: 5.1, lat0: 50.6, lat1: 51.5, aspect: 1.83 };

  /* ---------- weergave ---------- */
  function bandHTML(title, sub) { return '<div class="band"><div class="wrap band-in"><h1 class="band-title">' + title + '</h1><p class="band-sub">' + esc(sub) + '</p></div></div>' }
  function isFav(p) { return state.favs.some(function (f) { return pkey(f) === pkey(p) }) }
  function noteHTML(e) {
    var s = statusOf(e);
    if (s === 'live') return '';
    var t = s === 'laden' ? 'Live weerdata wordt geladen. Tot dan zie je voorbeeldgegevens.' : 'Dit zijn voorbeeldgegevens. De live weerdienst is in deze weergave niet bereikbaar.';
    return '<div class="note" role="note"><b>DEMO</b><span>' + t + '</span></div>';
  }
  function nowcastInfo(nc) {
    var raining = nc[0].v >= .1, idx = -1, i;
    if (raining) {
      for (i = 0; i < nc.length; i++) { if (nc[i].v < .1) { idx = i; break } }
      return idx < 0 ? { msg: 'Het regent nu en dat blijft de komende uren zo.', s: 'regent' } : { msg: 'Het regent nu. Over ongeveer ' + idx * 15 + ' minuten wordt het droog.', s: 'regent' }
    }
    for (i = 0; i < nc.length; i++) { if (nc[i].v >= .1) { idx = i; break } }
    if (idx < 0) return { msg: 'Het blijft de komende uren droog.', s: 'droog' };
    return { msg: 'Het is droog. Over ongeveer ' + idx * 15 + ' minuten begint het te regenen.', s: 'droog' };
  }
  function heavyInfo(nc) {
    var m = null; nc.forEach(function (o) { if (o.v >= 5 && (!m || o.v > m.v)) m = o }); return m;
  }
  function renderOverzicht() {
    var p = state.place, e = entry(p), d = e.data, c = d.now, w = wx(c.code, c.isDay), nc = d.nowcast, info = nowcastInfo(nc), hv = heavyInfo(nc);
    var bars = nc.slice(0, 12).map(function (o, i) { var hgt = o.v < .1 ? 3 : Math.max(6, Math.round(Math.sqrt(Math.min(o.v, 8) / 8) * 84)); return '<i class="' + (o.v < .1 ? 'dry' : '') + '" style="height:' + hgt + 'px" title="' + hm(o.t) + ': ' + num(o.v, 1) + ' mm/u"></i>' }).join('');
    var peak = nc.reduce(function (a, o) { return o.v > a ? o.v : a }, 0);
    var strip = d.hours.slice(0, 24).map(function (h, i) { return '<li><span class="t">' + (i === 0 ? 'nu' : hm(h.time)) + '</span><span class="i">' + icon(h.code, h.isDay) + '</span><span class="d">' + deg(h.temp) + '</span><span class="p">' + (h.prob >= 10 ? '<svg class="wa" aria-hidden="true"><use href="#i-druppel"/></svg>' + h.prob + '%' : '') + '</span></li>' }).join('');
    var h = '';
    h += '<div class="band hero"><div class="wrap band-in">' +
      '<p class="loc">' + esc(p.name) + '</p>' +
      '<div class="hero-grid"><div><div class="hero-row"><span class="temp" aria-label="' + deg(c.temp).replace('°', ' graden') + '">' + num(Math.round(c.temp)) + '<sup>°</sup></span><div class="tile">' + icon(c.code, c.isDay) + '</div></div>' +
      '<p class="cond">' + w.l + '</p></div>' + heroSide(d) + '</div></div></div>';
    h += '<div class="wrap stack">';
    h += '<div><dl class="stats">' +
      '<div class="stat"><dt>voelt aan als</dt><dd>' + deg(c.feels) + '</dd></div>' +
      '<div class="stat"><dt>wind</dt><dd>' + arrow(c.dir) + num(c.wind) + ' <small>km/u ' + windName(c.dir) + '</small></dd></div>' +
      '<div class="stat"><dt>luchtvochtigheid</dt><dd>' + num(c.humidity) + '<small> %</small></dd></div>' +
      '<div class="stat"><dt>neerslag nu</dt><dd>' + num(nc[0].v, 1) + ' <small>mm/u</small></dd></div></dl>' +
      '<div class="meta"><p>Bijgewerkt om ' + hm(c.time) + ' · ' + esc(p.region) + '</p></div></div>';
    h += noteHTML(e);
    if (hv) h += '<div class="alert" role="status"><svg class="ic" aria-hidden="true"><use href="#i-zwaar"/></svg><div><strong>Zware regen verwacht rond ' + hm(hv.t) + ' in ' + esc(p.name) + '</strong>Tot ' + num(hv.v, 1) + ' mm per uur. Neem een regenjas mee.</div></div>';
    h += '<div class="rain-wrap"><div class="rain"><span class="kicker">regenverwachting voor de komende 3 uur</span><p class="msg">' + info.msg + '</p><div><div class="bars" role="img" aria-label="Neerslag per kwartier. Maximaal ' + num(peak, 1) + ' millimeter per uur.">' + bars + '</div><div class="bar-lab" aria-hidden="true"><span>nu</span><span>+1 u</span><span>+2 u</span><span>+3 u</span></div></div><p class="cap">Hoogste verwachte intensiteit: ' + num(peak, 1) + ' mm/u (' + rainWord(peak) + ').</p></div></div>' +
      '<div class="hours-wrap"><div class="sec-head"><h2>Komende uren</h2><a href="#uur">alle uren</a></div><div class="strip"><ol>' + strip + '</ol></div></div>';
    h += '<div class="grid"><div class="c7"><div class="sec-head"><h2>Neerslagkaart</h2><a href="#radar">open de radar</a></div><div class="mapbox pre"><canvas id="cvPre" role="img" aria-label="Kaart van Vlaanderen met de neerslag op dit moment"></canvas></div><p class="mapcap">Situatie op dit moment. Hoe donkerder blauw, hoe harder het regent.</p></div>' +
      '<div class="c5"><div class="sec-head"><h2>Schoollocaties</h2></div><p>Bekijk de weersverwachting voor een van de twee campussen.</p><div class="chips city-chips"><button class="chip" type="button" data-city="Zottegem">Richtpunt Zottegem</button><button class="chip" type="button" data-city="Ninove">Richtpunt Ninove</button></div></div></div>';
    h += '</div>';
    $('#v-overzicht').innerHTML = h; syncCityButtons();
    var cv = $('#cvPre'); maps.pre = new RadarMap(cv, PRE, PREVCITIES); maps.pre.pos = radar.data.nowIdx; maps.pre.data = radar.data; maps.pre.resize();
  }
  function heroSide(d) {
    var t = d.days, tm = t[1] || t[0];
    return '<dl class="side"><div><dt>vandaag</dt><dd>' + deg(t[0].tmin) + ' / ' + deg(t[0].tmax) + '</dd></div><div><dt>morgen</dt><dd>' + deg(tm.tmin) + ' / ' + deg(tm.tmax) + '</dd></div><div><dt>neerslag vandaag</dt><dd>' + num(t[0].precip, 1) + ' mm</dd></div></dl>';
  }
  function renderUur() {
    var p = state.place, e = entry(p), hrs = e.data.hours.slice(0, state.hours48 ? 48 : 24), h = '';
    h += bandHTML('Weer per uur', p.name) + '<div class="wrap stack">' + noteHTML(e);
    h += '<div><div class="sec-head"><h2>Temperatuur en neerslag</h2><span class="hint">komende ' + hrs.length + ' uur</span></div><div class="chart" id="hchart"></div><div class="legend"><span>temperatuur (°C)</span><span class="b">neerslag (mm per uur)</span></div></div>';
    h += '<div><div class="sec-head"><h2>Uur voor uur</h2></div><div class="scroll"><table class="tbl hours"><thead><tr><th scope="col">tijd</th><th scope="col">weer</th><th scope="col">temp.</th><th scope="col">voelt als</th><th scope="col">neerslag</th><th scope="col">kans</th><th scope="col">wind</th></tr></thead><tbody>';
    var lastDay = -1, now = hrs[0].time;
    hrs.forEach(function (o, i) {
      var dk = o.time.getUTCDate();
      if (dk !== lastDay) {
        lastDay = dk; var diff = Math.round((Date.UTC(o.time.getUTCFullYear(), o.time.getUTCMonth(), dk) - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 864e5);
        h += '<tr class="dayrow"><th colspan="7" scope="colgroup">' + (diff === 0 ? 'vandaag' : diff === 1 ? 'morgen' : dayName(o.time)) + ' · ' + dateShort(o.time) + '</th></tr>'
      }
      var w = wx(o.code, o.isDay);
      h += '<tr><td class="t">' + (i === 0 ? 'nu' : hm(o.time)) + '</td><td><span class="wx"><span class="mini">' + icon(o.code, o.isDay) + '</span>' + w.l + '</span></td><td class="num">' + deg(o.temp) + '</td><td>' + deg(o.feels) + '</td><td>' + (o.precip >= .05 ? num(o.precip, 1) + ' mm' : '0 mm') + '</td><td>' + Math.round(o.prob) + ' %</td><td style="white-space:nowrap">' + arrow(o.dir) + num(o.wind) + ' km/u ' + windName(o.dir) + '</td></tr>';
    });
    h += '</tbody></table></div><div class="more"><button class="btn ghost" type="button" data-more>' + (state.hours48 ? 'Toon 24 uur' : 'Toon 48 uur') + '</button></div></div></div>';
    $('#v-uur').innerHTML = h;
    drawChart(hrs);
  }
  function drawChart(hrs) {
    var el = $('#hchart'); if (!el) return;
    var W = el.clientWidth - 16 || 600, H = Math.max(210, Math.min(280, W * .38)), m = { l: 38, r: 14, t: 16, b: 30 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    var tmin = Math.floor(Math.min.apply(null, hrs.map(function (o) { return o.temp })) - 1), tmax = Math.ceil(Math.max.apply(null, hrs.map(function (o) { return o.temp })) + 1); tmax = tmin + Math.ceil((tmax - tmin) / 4) * 4;
    var pmax = Math.max(2, Math.ceil(Math.max.apply(null, hrs.map(function (o) { return o.precip }))));
    var n = hrs.length, bw = pw / n, X = function (i) { return m.l + bw * (i + .5) }, Y = function (t) { return m.t + ph - (t - tmin) / (tmax - tmin) * ph };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Grafiek van temperatuur en neerslag per uur, van ' + deg(tmin) + ' tot ' + deg(tmax) + '">';
    var steps = 4;
    for (var i = 0; i <= steps; i++) { var tv = tmin + (tmax - tmin) * i / steps, y = Y(tv); s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y + '" y2="' + y + '" stroke="var(--grid)" stroke-width="1"/><text x="' + (m.l - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="12" fill="var(--ink)">' + Math.round(tv) + '°</text>' }
    hrs.forEach(function (o, i) {
      var bh = o.precip / pmax * (ph * .4); if (o.precip >= .05) s += '<rect x="' + (X(i) - bw * .36) + '" y="' + (m.t + ph - bh) + '" width="' + (bw * .72) + '" height="' + bh + '" fill="var(--accent-text)" opacity=".8"/>';
      var hh = o.time.getUTCHours();
      if (hh === 0) { s += '<line x1="' + (X(i) - bw / 2) + '" x2="' + (X(i) - bw / 2) + '" y1="' + m.t + '" y2="' + (m.t + ph) + '" stroke="var(--ink)" stroke-dasharray="3 3"/><text x="' + (X(i) - bw / 2 + 5) + '" y="' + (m.t + 12) + '" font-size="12" font-weight="600" fill="var(--ink-strong)">' + dayName(o.time) + '</text>' }
      var every = n > 30 ? 6 : 3;
      if (i % every === 0) s += '<text x="' + X(i) + '" y="' + (H - 9) + '" text-anchor="middle" font-size="12" fill="var(--ink)">' + (i === 0 ? 'nu' : pad(hh) + 'u') + '</text>';
    });
    s += '<polyline fill="none" stroke="var(--orange)" stroke-width="3" stroke-linejoin="round" points="' + hrs.map(function (o, i) { return X(i) + ',' + Y(o.temp) }).join(' ') + '"/>';
    s += '<rect x="' + (X(0) - 5) + '" y="' + (Y(hrs[0].temp) - 5) + '" width="10" height="10" fill="var(--orange)" stroke="var(--surface-2)" stroke-width="2"/>';
    var mx = 0; hrs.forEach(function (o, i) { if (o.temp > hrs[mx].temp) mx = i });
    s += '<text x="' + Math.min(W - m.r - 10, Math.max(m.l + 10, X(mx))) + '" y="' + (Y(hrs[mx].temp) - 10) + '" text-anchor="middle" font-size="13" font-weight="700" fill="var(--ink-strong)">' + deg(hrs[mx].temp) + '</text>';
    el.innerHTML = s + '</svg>';
  }
  function renderDagen() {
    var p = state.place, e = entry(p), days = e.data.days, h = '';
    var lo = Math.floor(Math.min.apply(null, days.map(function (d) { return d.tmin })) - 1), hi = Math.ceil(Math.max.apply(null, days.map(function (d) { return d.tmax })) + 1);
    h += bandHTML('Komende dagen', p.name) + '<div class="wrap stack">' + noteHTML(e);
    h += '<div><div class="sec-head"><h2>De komende ' + days.length + ' dagen</h2><span class="hint">laagste en hoogste temperatuur per dag</span></div><ol class="days">';
    days.forEach(function (d, i) {
      var w = wx(d.code, true), a = (d.tmin - lo) / (hi - lo) * 100, b = (d.tmax - lo) / (hi - lo) * 100;
      h += '<li><div class="dn">' + (i === 0 ? 'vandaag' : i === 1 ? 'morgen' : dayName(d.date)) + '<small>' + dateShort(d.date) + '</small></div><div class="ico">' + icon(d.code, true) + '</div><div class="cd">' + w.l + '</div>' +
        '<div class="rng"><div class="range"><b>' + deg(d.tmin) + '</b><div class="track" role="img" aria-label="Van ' + deg(d.tmin) + ' tot ' + deg(d.tmax) + '"><i style="left:' + a + '%;width:' + Math.max(2, b - a) + '%"></i></div><b>' + deg(d.tmax) + '</b></div></div>' +
        '<div class="pr"><strong>' + num(d.precip, 1) + ' mm</strong>' + Math.round(d.prob) + ' % kans</div><div class="wi">' + arrow(200) + num(d.wind) + ' km/u</div></li>';
    });
    h += '</ol></div></div>';
    $('#v-dagen').innerHTML = h.replace(/<div class="rng">/g, '<div class="rng">');
  }
  function whenLabel() {
    var d = radar.data, i = state.rpos, t = d.times[Math.min(d.times.length - 1, Math.round(i))], diff = Math.round(i - d.nowIdx) * 15;
    return { big: diff === 0 ? 'nu' : (diff > 0 ? '+' : '−') + Math.abs(diff) + ' min', small: 'om ' + hm(t) + (diff < 0 ? ' (terugblik)' : diff > 0 ? ' (verwachting)' : '') };
  }
  function renderRadar() {
    var p = state.place, h = '';
    h += bandHTML('Neerslagradar', p.name) + '<div class="wrap stack">';
    h += radar.live ? '' : '<div class="note" role="note"><b>DEMO</b><span>' + (radar.pending ? 'Live neerslagdata wordt geladen. Tot dan zie je een voorbeeld.' : 'Dit is een voorbeeld van een bewegende regenzone. De live weerdienst is in deze weergave niet bereikbaar.') + '</span></div>';
    h += '<div class="grid"><div class="c8"><div class="mapbox full"><canvas id="cvFull" role="img" aria-label="Kaart van België met de neerslag"></canvas></div></div>' +
      '<div class="c4 ctrl"><div class="when" aria-live="off"><span id="whenBig"></span><small id="whenSmall"></small></div>' +
      '<div class="playrow"><button class="btn" type="button" id="playBtn" aria-label="Afspelen">Afspelen</button><label class="sr" for="rs">Tijdstip op de radar</label><input id="rs" type="range" min="0" max="' + (radar.data.times.length - 1) + '" step="any" value="' + state.rpos + '"></div>' +
      '<div class="here"><span style="font-size:14px">in ' + esc(p.name) + '</span><strong id="hereVal"></strong></div>' +
      '<div><div class="sec-head" style="margin-bottom:10px"><h2 style="font-size:24px">legenda</h2></div><ul class="lg">' +
      '<li><i style="background:#9ccfd5"></i>lichte neerslag, tot 1 mm/u</li><li><i style="background:#3aa0ad"></i>matige regen, 1 tot 2,5 mm/u</li><li><i style="background:#0e6577"></i>stevige regen, 2,5 tot 5 mm/u</li><li><i style="background:#003D4D"></i>zware regen, 5 tot 10 mm/u</li><li><i style="background:#C86B02"></i>zeer zware regen, meer dan 10 mm/u</li><li><i class="pv"></i>provincie Oost-Vlaanderen</li></ul></div></div></div>';
    h += '</div>';
    $('#v-radar').innerHTML = h;
    var cv = $('#cvFull'); maps.full = new RadarMap(cv, FULL, MAPCITIES); maps.full.data = radar.data; maps.full.pos = state.rpos; maps.full.resize();
    updateRadarUI();
    $('#rs').addEventListener('input', function (ev) { state.playing = false; state.rpos = parseFloat(ev.target.value); syncPlay(); frame() });
    $('#playBtn').addEventListener('click', function () { state.playing = !state.playing; if (state.playing && state.rpos >= radar.data.times.length - 1) state.rpos = 0; syncPlay(); lastT = 0; loop() });
    syncPlay();
  }
  function syncPlay() { var b = $('#playBtn'); if (b) { b.textContent = state.playing ? 'Pauzeer' : 'Afspelen'; b.setAttribute('aria-label', state.playing ? 'Pauzeer de animatie' : 'Speel de animatie af') } }
  function updateRadarUI() {
    var wl = whenLabel(), a = $('#whenBig'), b = $('#whenSmall'), hv = $('#hereVal'), rs = $('#rs');
    if (!a || !maps.full) return; a.textContent = wl.big; b.textContent = wl.small;
    if (rs && document.activeElement !== rs) rs.value = state.rpos;
    var v = maps.full.valueAt(state.place.lon, state.place.lat); hv.textContent = v < .1 ? 'droog' : num(v, 1) + ' mm/u, ' + rainWord(v);
  }
  function frame() { if (maps.full) { maps.full.pos = state.rpos; maps.full.draw() } updateRadarUI() }
  var lastT = 0, raf = 0;
  function loop() {
    cancelAnimationFrame(raf);
    if (!state.playing || state.view !== 'radar') return;
    raf = requestAnimationFrame(function (ts) {
      var dt = lastT ? Math.min(100, ts - lastT) : 0; lastT = ts;
      state.rpos += dt / 1000 * 2.4;
      var max = radar.data.times.length - 1; if (state.rpos >= max) { state.rpos = max; state.playing = false; syncPlay() }
      frame(); loop();
    });
  }

  /* ---------- navigatie ---------- */
  var VIEWS = ['overzicht', 'uur', 'dagen', 'radar'];
  function route() {
    var v = (location.hash || '').replace('#', ''); if (VIEWS.indexOf(v) < 0) v = 'overzicht';
    state.view = v;
    $$('.view').forEach(function (s) { s.hidden = s.dataset.view !== v });
    $$('[data-nav]').forEach(function (a) { a.dataset.nav === v ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current') });
    if (v !== 'radar') { state.playing = false }
    else if (!state.radarSeen) { state.radarSeen = true; var rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; if (!rm) { state.rpos = 0; state.playing = true } }
    renderView(v);
    if (v === 'radar' && state.playing) { lastT = 0; loop() }
    window.scrollTo(0, 0);
  }
  function renderView(v) {
    v = v || state.view;
    if (v === 'overzicht') renderOverzicht(); else if (v === 'uur') renderUur(); else if (v === 'dagen') renderDagen(); else renderRadar();
    var e = entry(state.place);
    syncCityButtons();
    $('#source').textContent = statusOf(e) === 'live' ? 'Weergegevens: Open-Meteo.com (CC BY 4.0). Neerslagkaart is berekend uit de neerslagverwachting en is schematisch.' : 'Voorbeeldgegevens. Met live verbinding komen de gegevens van Open-Meteo.com (CC BY 4.0).';
  }
  var rt = 0;
  function renderAll() {
    if (document.activeElement && document.activeElement.id === 'rs') return;
    var keep = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset : null;
    renderView(state.view);
  }

  /* ---------- vaste schoollocaties ---------- */
  function choose(p) {
    if (typeof p === 'string') p = placeByName(p);
    if (!p || ['Zottegem', 'Ninove'].indexOf(p.name) < 0) return;
    state.place = p; store('br.place', p); $('#live').textContent = 'Weer voor Richtpunt ' + p.name + ' geladen';
    renderView(state.view); syncCityButtons(); window.scrollTo(0, 0);
  }
  function syncCityButtons() { $$('[data-city]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.city === state.place.name ? 'true' : 'false') }); }
  /* ---------- klikken ---------- */
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    var city = t.closest('[data-city]'); if (city) { choose(city.dataset.city); return }
    if (t.closest('[data-more]')) { state.hours48 = !state.hours48; renderUur(); return }
  });
  window.addEventListener('hashchange', route);
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (maps.pre && state.view === 'overzicht') maps.pre.resize(); if (maps.full && state.view === 'radar') maps.full.resize(); if (state.view === 'uur') { var hs = entry(state.place).data.hours.slice(0, state.hours48 ? 48 : 24); drawChart(hs) } }, 120) });

  /* Donkere modus staat vast aan. */
  document.documentElement.dataset.theme = 'dark';

  route();
})();
