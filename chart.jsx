// chart.jsx — main price chart with technical indicators
// Renders OHLC candles + volume + RSI + MACD subplots
// (window.PriceChart)

(function () {
  function PriceChart({ ticker, theme, range, showMA20, showMA50, showMA200, showBB }) {
    const data = ticker.history;
    const longHistory = ticker.longHistory || ticker.historyByRange?.['1Y'] || data;
    const dataRange = String(ticker.historyRange || '').toUpperCase();
    const slice = dataRange === range ? data : (() => {
      const n = data.length;
      switch (range) {
        case '1D':  return data.slice(n - Math.min(n, 78));
        case '5D':  return data.slice(n - Math.min(n, 65));
        case '1M':  return data.slice(n - 22);
        case '3M':  return data.slice(n - 63);
        case '6M':  return data.slice(n - 126);
        case '1Y':  return data;
        case 'YTD': return data.slice(n - 110);
        default:    return data.slice(n - 63);
      }
    })();
    // If only daily data is available, synthesize a 1D intraday tape from the last candle.
    let bars = slice;
    if (range === '1D' && dataRange !== '1D' && data.length > 1) {
      const last = data[data.length - 1];
      const prev = data[data.length - 2];
      bars = [];
      const open = prev.c;
      const close = last.c;
      const high = last.h;
      const low = last.l;
      const N = 78;
      for (let i = 0; i < N; i++) {
        const f = i / (N - 1);
        const oscill = Math.sin(i * 0.7) * (high - low) * 0.15;
        const drift = open + (close - open) * f;
        const o = i === 0 ? open : bars[i - 1].c;
        const c = drift + oscill;
        const h = Math.max(o, c) + Math.abs(oscill) * 0.6;
        const l = Math.min(o, c) - Math.abs(oscill) * 0.6;
        bars.push({ o, h, l, c, v: last.v / N * (0.6 + Math.abs(oscill)) });
      }
    }
    if (!bars.length) bars = data.slice(-1);

    const W = 1080, H = 460;
    const padL = 8, padR = 118, padT = 22, padB = 18;
    const chartH = Math.round(H * 0.62);
    const volH   = Math.round(H * 0.13);
    const rsiH   = Math.round(H * 0.11);
    const macdH  = H - padT - padB - chartH - volH - rsiH - 14;

    // Range
    let hi = -Infinity, lo = Infinity;
    for (const b of bars) { if (b.h > hi) hi = b.h; if (b.l < lo) lo = b.l; }
    if (!Number.isFinite(hi) || !Number.isFinite(lo)) {
      hi = 1;
      lo = 0;
    }
    if (hi === lo) {
      hi += Math.max(1, hi * 0.01);
      lo -= Math.max(1, lo * 0.01);
    }
    // Add MA padding
    const ma = (n) => {
      const out = new Array(bars.length).fill(null);
      let sum = 0;
      for (let i = 0; i < bars.length; i++) {
        sum += bars[i].c;
        if (i >= n) sum -= bars[i - n].c;
        if (i >= n - 1) out[i] = sum / n;
      }
      return out;
    };
    const maFromLongHistory = (n) => {
      if (!longHistory || longHistory.length < n || !bars.length) return null;
      const out = new Array(bars.length).fill(null);
      const longCloses = longHistory.map(row => row.c);
      const longKeys = longHistory.map(row => row.datetime || row.date || '');
      const firstKey = longKeys.find(Boolean);
      if (!firstKey || !(bars[0].datetime || bars[0].date)) return null;
      for (let i = 0; i < bars.length; i++) {
        const target = bars[i].datetime || bars[i].date || '';
        let idx = longKeys.findIndex(key => key && key.slice(0, 10) >= target.slice(0, 10));
        if (idx < 0) idx = longHistory.length - 1;
        if (idx >= n - 1) {
          let sum = 0;
          for (let j = idx - n + 1; j <= idx; j++) sum += longCloses[j];
          out[i] = sum / n;
        }
      }
      return out.some(v => v != null) ? out : null;
    };
    const ma20 = ma(20), ma50 = ma(50), ma200 = maFromLongHistory(200) || ma(200);
    // Bollinger
    const bb = (() => {
      const period = 20, k = 2;
      const upper = new Array(bars.length).fill(null);
      const lower = new Array(bars.length).fill(null);
      for (let i = period - 1; i < bars.length; i++) {
        let mean = 0;
        for (let j = i - period + 1; j <= i; j++) mean += bars[j].c;
        mean /= period;
        let v = 0;
        for (let j = i - period + 1; j <= i; j++) v += (bars[j].c - mean) ** 2;
        const sd = Math.sqrt(v / period);
        upper[i] = mean + k * sd;
        lower[i] = mean - k * sd;
      }
      return { upper, lower };
    })();

    if (showBB) {
      for (const v of bb.upper) if (v != null && v > hi) hi = v;
      for (const v of bb.lower) if (v != null && v < lo) lo = v;
    }
    if (showMA20) for (const v of ma20) if (v != null) { if (v > hi) hi = v; if (v < lo) lo = v; }
    if (showMA50) for (const v of ma50) if (v != null) { if (v > hi) hi = v; if (v < lo) lo = v; }
    if (showMA200) for (const v of ma200) if (v != null) { if (v > hi) hi = v; if (v < lo) lo = v; }

    const pad = Math.max((hi - lo) * 0.04, Math.abs(hi) * 0.001, 0.01);
    hi += pad; lo -= pad;

    const innerW = W - padL - padR;
    const x = (i) => padL + (i / Math.max(bars.length - 1, 1)) * innerW;
    const y = (price) => padT + (1 - (price - lo) / (hi - lo)) * chartH;
    const candleW = Math.max(1, (innerW / bars.length) * 0.7);

    // Volume scale
    let maxV = 0; for (const b of bars) if (b.v > maxV) maxV = b.v;
    if (!Number.isFinite(maxV) || maxV <= 0) maxV = 1;
    const volTop = padT + chartH + 6;
    const vy = (v) => volTop + (1 - v / maxV) * volH;

    // RSI
    const rsiArr = (() => {
      const out = new Array(bars.length).fill(null);
      const period = 14;
      let gains = 0, losses = 0;
      for (let i = 1; i < bars.length; i++) {
        const ch = bars[i].c - bars[i - 1].c;
        if (i <= period) {
          if (ch >= 0) gains += ch; else losses -= ch;
          if (i === period) {
            const rs = gains / Math.max(losses, 1e-9);
            out[i] = 100 - 100 / (1 + rs);
            gains /= period; losses /= period;
          }
        } else {
          const g = ch > 0 ? ch : 0;
          const l = ch < 0 ? -ch : 0;
          gains = (gains * (period - 1) + g) / period;
          losses = (losses * (period - 1) + l) / period;
          const rs = gains / Math.max(losses, 1e-9);
          out[i] = 100 - 100 / (1 + rs);
        }
      }
      return out;
    })();
    const rsiTop = volTop + volH + 8;
    const ry = (v) => rsiTop + (1 - v / 100) * rsiH;

    // MACD
    const ema = (n) => {
      const out = new Array(bars.length).fill(null);
      const k = 2 / (n + 1);
      let prev = null;
      for (let i = 0; i < bars.length; i++) {
        if (prev == null) { out[i] = bars[i].c; prev = bars[i].c; }
        else { out[i] = bars[i].c * k + prev * (1 - k); prev = out[i]; }
      }
      return out;
    };
    const e12 = ema(12), e26 = ema(26);
    const macdLine = bars.map((_, i) => e12[i] - e26[i]);
    const sig = (() => {
      const out = []; const k = 2 / 10;
      let prev = null;
      for (let i = 0; i < macdLine.length; i++) {
        if (prev == null) { out.push(macdLine[i]); prev = macdLine[i]; }
        else { const v = macdLine[i] * k + prev * (1 - k); out.push(v); prev = v; }
      }
      return out;
    })();
    const macdHist = macdLine.map((v, i) => v - sig[i]);
    let mMax = 0;
    for (const v of macdLine) if (Math.abs(v) > mMax) mMax = Math.abs(v);
    for (const v of macdHist) if (Math.abs(v) > mMax) mMax = Math.abs(v);
    if (!Number.isFinite(mMax) || mMax <= 0) mMax = 1;
    const macdTop = rsiTop + rsiH + 8;
    const my = (v) => macdTop + macdH/2 - (v / mMax) * (macdH / 2);

    // Y-axis gridlines
    const axisText = theme.textBright || '#e9fff3';
    const gridLines = [];
    const tickStep = (hi - lo) / 5;
    for (let i = 0; i <= 5; i++) {
      const p = lo + tickStep * i;
      gridLines.push({ y: y(p), label: p < 10 ? p.toFixed(2) : p.toFixed(1) });
    }

    // Path generator for lines
    const linePath = (vals, scale) => {
      let d = ''; let started = false;
      for (let i = 0; i < vals.length; i++) {
        const v = vals[i]; if (v == null) continue;
        d += (started ? 'L' : 'M') + x(i) + ',' + scale(v) + ' ';
        started = true;
      }
      return d;
    };

    // Current price line
    const lastClose = bars[bars.length - 1].c;
    const lastBar = bars[bars.length - 1];

    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', background: theme.panel, overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
           style={{ width: '100%', height: '100%', display: 'block' }}>
        {/* Gridlines main */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={g.y} y2={g.y} stroke={theme.grid} strokeWidth={0.5} />
          </g>
        ))}
        {/* X gridlines (every 1/6) */}
        {[1,2,3,4,5].map(i => (
          <line key={i} x1={padL + innerW * i/6} x2={padL + innerW * i/6}
                y1={padT} y2={padT + chartH} stroke={theme.grid} strokeWidth={0.5} />
        ))}

        {/* Bollinger bands */}
        {showBB && (
          <>
            <path d={linePath(bb.upper, y)} fill="none" stroke={theme.accent2} strokeOpacity={0.45} strokeWidth={0.7} strokeDasharray="2 2" />
            <path d={linePath(bb.lower, y)} fill="none" stroke={theme.accent2} strokeOpacity={0.45} strokeWidth={0.7} strokeDasharray="2 2" />
          </>
        )}

        {/* Candles */}
        {bars.map((b, i) => {
          const up = b.c >= b.o;
          const cx = x(i);
          const c = up ? theme.up : theme.down;
          return (
            <g key={i}>
              <line x1={cx} x2={cx} y1={y(b.h)} y2={y(b.l)} stroke={c} strokeWidth={0.8} />
              <rect x={cx - candleW/2} y={y(Math.max(b.o, b.c))}
                    width={candleW} height={Math.max(0.6, Math.abs(y(b.o) - y(b.c)))}
                    fill={c} opacity={up ? 0.85 : 1} />
            </g>
          );
        })}

        {/* MAs */}
        {showMA20  && <path d={linePath(ma20, y)}  fill="none" stroke={theme.warn}   strokeWidth={1.0} />}
        {showMA50  && <path d={linePath(ma50, y)}  fill="none" stroke={theme.accent} strokeWidth={1.0} />}
        {showMA200 && <path d={linePath(ma200, y)} fill="none" stroke={theme.accent2} strokeWidth={1.4} strokeDasharray={ma200.filter(v => v != null).length < bars.length ? "3 2" : ""} />}

        {/* Current price line */}
        <line x1={padL} x2={W - padR} y1={y(lastClose)} y2={y(lastClose)} stroke={theme.textBright} strokeWidth={0.6} strokeDasharray="3 3" opacity={0.6} />

        {/* Volume panel */}
        <line x1={padL} x2={W - padR} y1={volTop} y2={volTop} stroke={theme.border} strokeWidth={0.5} />
        <text x={padL + 4} y={volTop + 10} fill={theme.dim} fontFamily={theme.fontMono} fontSize={9}>VOL  {(maxV/1e6).toFixed(1)}M</text>
        {bars.map((b, i) => {
          const up = b.c >= b.o;
          return <rect key={i} x={x(i) - candleW/2} y={vy(b.v)}
                       width={candleW} height={volTop + volH - vy(b.v)}
                       fill={up ? theme.up : theme.down} opacity={0.55} />;
        })}

        {/* RSI panel */}
        <line x1={padL} x2={W - padR} y1={rsiTop} y2={rsiTop} stroke={theme.border} strokeWidth={0.5} />
        <text x={padL + 4} y={rsiTop + 10} fill={theme.dim} fontFamily={theme.fontMono} fontSize={9}>RSI(14)</text>
        <line x1={padL} x2={W - padR} y1={ry(70)} y2={ry(70)} stroke={theme.down} strokeWidth={0.4} strokeDasharray="2 2" opacity={0.55} />
        <line x1={padL} x2={W - padR} y1={ry(30)} y2={ry(30)} stroke={theme.up}   strokeWidth={0.4} strokeDasharray="2 2" opacity={0.55} />
        <line x1={padL} x2={W - padR} y1={ry(50)} y2={ry(50)} stroke={theme.dim}  strokeWidth={0.3} strokeDasharray="1 3" opacity={0.4} />
        <path d={linePath(rsiArr, ry)} fill="none" stroke={theme.accent} strokeWidth={1.0} />
        <text x={W - padR + 4} y={ry(rsiArr[rsiArr.length-1]||50) + 3} fill={theme.accent} fontFamily={theme.fontMono} fontSize={9}>{(rsiArr[rsiArr.length-1]||50).toFixed(1)}</text>

        {/* MACD panel */}
        <line x1={padL} x2={W - padR} y1={macdTop} y2={macdTop} stroke={theme.border} strokeWidth={0.5} />
        <text x={padL + 4} y={macdTop + 10} fill={theme.dim} fontFamily={theme.fontMono} fontSize={9}>MACD(12,26,9)</text>
        <line x1={padL} x2={W - padR} y1={macdTop + macdH/2} y2={macdTop + macdH/2} stroke={theme.dim} strokeWidth={0.3} strokeDasharray="1 3" opacity={0.4} />
        {macdHist.map((v, i) => {
          const h0 = macdTop + macdH/2;
          const h1 = my(v);
          return <rect key={i} x={x(i) - candleW/2} y={Math.min(h0, h1)}
                       width={candleW} height={Math.abs(h1 - h0)}
                       fill={v >= 0 ? theme.up : theme.down} opacity={0.65} />;
        })}
        <path d={linePath(macdLine, my)} fill="none" stroke={theme.accent}  strokeWidth={1.0} />
        <path d={linePath(sig, my)}      fill="none" stroke={theme.warn}    strokeWidth={1.0} />
      </svg>
      <div style={{
        position: 'absolute', top: 7, left: 10, display: 'flex', gap: 10,
        alignItems: 'center', padding: '2px 6px',
        background: 'rgba(10,8,5,0.84)', border: `1px solid ${theme.border}`,
        fontFamily: theme.fontMono, fontSize: 11, fontWeight: 800,
        lineHeight: '14px', pointerEvents: 'none', whiteSpace: 'nowrap',
      }}>
        <span style={{ color: axisText }}>O <span>{lastBar.o.toFixed(2)}</span></span>
        <span style={{ color: theme.up }}>H <span>{lastBar.h.toFixed(2)}</span></span>
        <span style={{ color: theme.down }}>L <span>{lastBar.l.toFixed(2)}</span></span>
        <span style={{ color: axisText }}>C <span>{lastBar.c.toFixed(2)}</span></span>
      </div>
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 64,
        background: `linear-gradient(90deg, rgba(10,8,5,0), ${theme.panel} 24%, ${theme.panel})`,
        borderLeft: `1px solid ${theme.border}`, pointerEvents: 'none',
      }} />
      {gridLines.map((g, i) => (
        <div key={i} style={{
          position: 'absolute', right: 6, top: `${(g.y / H) * 100}%`,
          transform: 'translateY(-50%)', color: axisText,
          background: 'rgba(10,8,5,0.82)', border: `1px solid ${theme.border}`,
          padding: '1px 4px', minWidth: 46, textAlign: 'right',
          fontFamily: theme.fontMono, fontSize: 11, fontWeight: 800,
          lineHeight: '13px', pointerEvents: 'none',
        }}>{g.label}</div>
      ))}
      <div style={{
        position: 'absolute', right: 6, top: `${(y(lastClose) / H) * 100}%`,
        transform: 'translateY(-50%)',
        color: theme.bg, background: ticker.pctChg >= 0 ? theme.up : theme.down,
        border: `1px solid ${theme.textBright}`, padding: '1px 4px',
        minWidth: 56, textAlign: 'right',
        fontFamily: theme.fontMono, fontSize: 11, fontWeight: 900,
        lineHeight: '13px', pointerEvents: 'none', zIndex: 2,
      }}>{lastClose.toFixed(2)}</div>
      </div>
    );
  }

  window.PriceChart = PriceChart;
})();
