// panels.jsx — all dashboard panels
// Renders the 16 modules; each is a tight, dense terminal cell.
// Globals: Panel, QuoteHeader, FactorScores, OrderBook, OptionsFlow,
//          NewsFeed, InsiderTx, ShortInterest, SectorHeatmap, Watchlist,
//          TopMovers, EarningsCal, EconCal, TradeIdeas, CorrMatrix,
//          PortfolioPnL, RiskMetrics, IndexRibbon, HeaderBar

(function () {
  const fmt = {
    money: (n, d = 2) => (n < 0 ? '-' : '') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }),
    pct: (n, d = 2) => (n >= 0 ? '+' : '') + n.toFixed(d) + '%',
    sign: (n, d = 2) => (n >= 0 ? '+' : '') + n.toFixed(d),
    big: (n) => n >= 1e12 ? (n/1e12).toFixed(2)+'T' : n >= 1e9 ? (n/1e9).toFixed(2)+'B' : n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : n.toFixed(0),
    num: (n) => n.toLocaleString('en-US'),
  };

  // ─── Panel chrome ────────────────────────────────────────────
  function Panel({ theme, title, code, right, children, dense = true, scroll = false, style = {}, bodyStyle = {} }) {
    return (
      <div style={{
        background: theme.panel,
        border: `1px solid ${theme.border}`,
        display: 'flex', flexDirection: 'column',
        fontFamily: theme.fontMono,
        color: theme.text,
        overflow: 'hidden',
        minHeight: 0, minWidth: 0,
        ...style,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '3px 6px',
          borderBottom: `1px solid ${theme.border}`,
          background: theme.bg2,
          fontSize: 10,
          letterSpacing: '0.08em',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ color: theme.accent, fontWeight: 700 }}>{code}</span>
            <span style={{ color: theme.text, fontWeight: 600, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: theme.dim }}>{right}</div>
        </div>
        <div style={{
          flex: 1, minHeight: 0, position: 'relative',
          overflow: scroll ? 'auto' : 'hidden',
          padding: dense ? '4px 6px' : '8px 10px',
          ...bodyStyle,
        }}>{children}</div>
      </div>
    );
  }

  // ─── HeaderBar + IndexRibbon ─────────────────────────────────
  function HeaderBar({ theme, ticker, onPickTicker, allTickers, markets = [], currentMarket = 'US', onPickMarket, marketMeta, alerts = [], now }) {
    const [open, setOpen] = React.useState(false);
    const [marketOpen, setMarketOpen] = React.useState(false);
    const [alertsOpen, setAlertsOpen] = React.useState(false);
    const [alertSeverity, setAlertSeverity] = React.useState('ALL');
    const [dismissedAlerts, setDismissedAlerts] = React.useState(() => {
      try { return new Set(JSON.parse(localStorage.getItem('phosphor.dismissedAlerts') || '[]')); }
      catch (_) { return new Set(); }
    });
    const [q, setQ] = React.useState('');
    const suffixByMarket = { INDIA: '.NS', JAPAN: '.T', UK: '.L', HONGKONG: '.HK', CANADA: '.TO', AUSTRALIA: '.AX' };
    const query = q.trim().toUpperCase();
    const suffix = suffixByMarket[currentMarket] || '';
    const customSym = query && !query.includes('.') && suffix ? `${query}${suffix}` : query;
    const matches = query ? allTickers.filter(t => t.sym.includes(query) || t.name.toUpperCase().includes(query)) : allTickers;
    const renderLimit = query ? 250 : 500;
    const list = matches.slice(0, renderLimit);
    const showCustom = query && customSym.length <= 18 && !allTickers.some(t => t.sym === customSym);
    const activeMarket = markets.find(m => m.id === currentMarket) || marketMeta || { id: currentMarket, name: currentMarket, currency: '' };
    const marketClock = (() => {
      const meta = {
        US: ['NYSE', 'America/New_York', 'ET', 9, 30, 16, 0],
        INDIA: ['NSE', 'Asia/Kolkata', 'IST', 9, 15, 15, 30],
        JAPAN: ['JPX', 'Asia/Tokyo', 'JST', 9, 0, 15, 30],
        UK: ['LSE', 'Europe/London', 'UK', 8, 0, 16, 30],
        EUROPE: ['XETRA', 'Europe/Berlin', 'CET', 9, 0, 17, 30],
        HONGKONG: ['HKEX', 'Asia/Hong_Kong', 'HKT', 9, 30, 16, 0],
        CANADA: ['TSX', 'America/Toronto', 'ET', 9, 30, 16, 0],
        AUSTRALIA: ['ASX', 'Australia/Sydney', 'AET', 10, 0, 16, 0],
      }[currentMarket] || ['MKT', 'UTC', 'UTC', 0, 0, 23, 59];
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
        timeZone: meta[1], weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
      }).formatToParts(now).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
      const mins = Number(parts.hour) * 60 + Number(parts.minute);
      const openMins = meta[3] * 60 + meta[4];
      const closeMins = meta[5] * 60 + meta[6];
      const isOpen = !['Sat', 'Sun'].includes(parts.weekday) && mins >= openMins && mins < closeMins;
      return { venue: meta[0], zone: meta[2], time: `${parts.hour}:${parts.minute}:${parts.second}`, isOpen };
    })();
    const alertKey = (alert, index) => `${alert.symbol || 'MKT'}:${alert.createdAt || index}:${alert.message || ''}`;
    const activeAlerts = (alerts || []).filter((alert, index) => !dismissedAlerts.has(alertKey(alert, index)));
    const visibleAlerts = activeAlerts.filter(alert => alertSeverity === 'ALL' || String(alert.severity || 'INFO').toUpperCase() === alertSeverity);
    const dismissAlert = (key) => {
      setDismissedAlerts(prev => {
        const next = new Set(prev);
        next.add(key);
        localStorage.setItem('phosphor.dismissedAlerts', JSON.stringify([...next]));
        return next;
      });
    };
    return (
      <div style={{
        height: 36, background: theme.bg2,
        borderBottom: `1px solid ${theme.border}`,
        display: 'flex', alignItems: 'stretch', fontFamily: theme.fontMono, fontSize: 11,
        color: theme.text, position: 'relative', zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', borderRight: `1px solid ${theme.border}`, gap: 8 }}>
          <div style={{
            width: 14, height: 14, background: theme.accent,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: theme.bg, fontWeight: 900, fontSize: 10,
          }}>{theme.name[0]}</div>
          <span style={{ color: theme.textBright, fontWeight: 700, letterSpacing: '0.12em' }}>{theme.name}</span>
          <span style={{ color: theme.dim, fontSize: 9 }}>{theme.tagline}</span>
        </div>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '0 10px', borderRight: `1px solid ${theme.border}`, gap: 8, minWidth: 220 }}>
          <span style={{ color: theme.dim, fontSize: 9 }}>MKT</span>
          <button onClick={() => setMarketOpen(o => !o)} style={{
            background: theme.panelHi, border: `1px solid ${theme.border}`,
            color: theme.textBright, fontFamily: theme.fontMono, fontSize: 12, fontWeight: 700,
            padding: '2px 10px', cursor: 'pointer', letterSpacing: '0.04em',
          }}>{activeMarket.id || currentMarket} ▾</button>
          <span style={{ color: theme.dim, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 92 }}>{activeMarket.name}</span>
          {marketOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 46, width: 300,
              background: theme.panel, border: `1px solid ${theme.borderHi}`,
              boxShadow: `0 8px 24px rgba(0,0,0,0.5)`, padding: 4, zIndex: 35,
            }}>
              {(markets || []).map(m => (
                <button key={m.id} onClick={() => { if (onPickMarket) onPickMarket(m.id); setMarketOpen(false); setOpen(false); }}
                  style={{
                    display: 'grid', gridTemplateColumns: '76px 1fr 54px', gap: 6, alignItems: 'center',
                    width: '100%', padding: '3px 6px',
                    background: m.id === currentMarket ? theme.panelHi : 'transparent',
                    border: 'none', borderBottom: `1px solid ${theme.border}`,
                    color: theme.text, fontFamily: theme.fontMono, fontSize: 10, textAlign: 'left', cursor: 'pointer',
                  }}>
                  <span style={{ color: theme.accent, fontWeight: 800 }}>{m.id}</span>
                  <span style={{ color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                  <span style={{ color: theme.dim, textAlign: 'right' }}>{m.currency}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '0 10px', borderRight: `1px solid ${theme.border}`, gap: 8, minWidth: 280 }}>
          <span style={{ color: theme.dim, fontSize: 9 }}>SYM</span>
          <button onClick={() => setOpen(o => !o)} style={{
            background: theme.panelHi, border: `1px solid ${theme.border}`,
            color: theme.textBright, fontFamily: theme.fontMono, fontSize: 13, fontWeight: 700,
            padding: '2px 10px', cursor: 'pointer', letterSpacing: '0.04em',
          }}>{ticker.sym} ▾</button>
          <span style={{ color: theme.dim, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{ticker.name}</span>
          {open && (
            <div style={{
              position: 'absolute', top: '100%', left: 60, width: 320,
              background: theme.panel, border: `1px solid ${theme.borderHi}`,
              boxShadow: `0 8px 24px rgba(0,0,0,0.5)`, padding: 4, zIndex: 30,
            }}>
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="search sym/name..."
                onKeyDown={e => {
                  if (e.key === 'Enter' && customSym) {
                    onPickTicker(customSym);
                    setOpen(false);
                    setQ('');
                  }
                }}
                style={{
                  background: theme.bg, border: `1px solid ${theme.border}`,
                  color: theme.text, fontFamily: theme.fontMono, fontSize: 11,
                  width: '100%', padding: '4px 6px', outline: 'none', marginBottom: 4,
                }} />
              <div style={{ maxHeight: 360, overflow: 'auto' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', gap: 8,
                  padding: '2px 6px 5px', color: theme.dim, fontSize: 9,
                  borderBottom: `1px solid ${theme.border}`,
                }}>
                  <span>{matches.length.toLocaleString('en-US')} MATCHES</span>
                  <span>{list.length < matches.length ? `SHOWING ${list.length.toLocaleString('en-US')}` : 'FULL LIST'}</span>
                </div>
                {showCustom && (
                  <button onClick={() => { onPickTicker(customSym); setOpen(false); setQ(''); }}
                    style={{
                      display: 'grid', gridTemplateColumns: '60px 1fr 70px 60px',
                      gap: 6, alignItems: 'center', width: '100%', padding: '3px 6px',
                      background: theme.panelHi,
                      border: 'none', borderBottom: `1px solid ${theme.border}`,
                      color: theme.text, fontFamily: theme.fontMono, fontSize: 10,
                      textAlign: 'left', cursor: 'pointer',
                    }}>
                    <span style={{ color: theme.warn, fontWeight: 700 }}>{customSym}</span>
                    <span style={{ color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Use typed Yahoo symbol</span>
                    <span style={{ color: theme.dim, textAlign: 'right' }}>--</span>
                    <span style={{ color: theme.dim, textAlign: 'right' }}>LIVE</span>
                  </button>
                )}
                {list.map(t => (
                  <button key={t.sym} onClick={() => { onPickTicker(t.sym); setOpen(false); setQ(''); }}
                    style={{
                      display: 'grid', gridTemplateColumns: '60px 1fr 70px 60px',
                      gap: 6, alignItems: 'center', width: '100%', padding: '3px 6px',
                      background: t.sym === ticker.sym ? theme.panelHi : 'transparent',
                      border: 'none', borderBottom: `1px solid ${theme.border}`,
                      color: theme.text, fontFamily: theme.fontMono, fontSize: 10,
                      textAlign: 'left', cursor: 'pointer',
                    }}>
                    <span style={{ color: theme.accent, fontWeight: 700 }}>{t.sym}</span>
                    <span style={{ color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                    <span style={{ color: theme.dim, textAlign: 'right' }}>{fmt.money(t.price)}</span>
                    <span style={{ color: t.pctChg >= 0 ? theme.up : theme.down, textAlign: 'right' }}>{fmt.pct(t.pctChg)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', padding: '0 10px', gap: 14, color: theme.dim, fontSize: 10 }}>
          <span><span style={{ color: theme.dim }}>SESSION </span><span style={{ color: marketClock.isOpen ? theme.up : theme.warn, fontWeight: 700 }}>{marketClock.isOpen ? '● OPEN' : '● CLOSED'}</span></span>
          <span><span style={{ color: theme.dim }}>{marketClock.venue} </span><span style={{ color: theme.text }}>{marketClock.time} {marketClock.zone}</span></span>
          <span><span style={{ color: theme.dim }}>TAPE </span><span style={{ color: theme.text }}>A · NMS</span></span>
          <span><span style={{ color: theme.dim }}>ADV/DEC </span><span style={{ color: theme.up }}>1828</span>/<span style={{ color: theme.down }}>1142</span></span>
          <span><span style={{ color: theme.dim }}>NEW HI/LO </span><span style={{ color: theme.up }}>84</span>/<span style={{ color: theme.down }}>22</span></span>
          <span><span style={{ color: theme.dim }}>BREADTH </span><span style={{ color: theme.up }}>+1.62</span></span>
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '0 12px', borderLeft: `1px solid ${theme.border}`, gap: 12 }}>
          <span style={{ color: theme.dim }}>USER</span><span style={{ color: theme.text }}>quant@local</span>
          <button onClick={() => setAlertsOpen(o => !o)} style={{
            background: alertsOpen ? theme.panelHi : 'transparent',
            border: `1px solid ${alertsOpen ? theme.borderHi : 'transparent'}`,
            color: activeAlerts.length ? theme.warn : theme.dim,
            fontFamily: theme.fontMono, fontSize: 10, fontWeight: 800,
            cursor: 'pointer', padding: '3px 6px',
          }}>● {visibleAlerts.length} ALERTS</button>
          {alertsOpen && (
            <div style={{
              position: 'absolute', top: '100%', right: 6, width: 360, maxHeight: 300,
              overflow: 'auto', background: theme.panel, border: `1px solid ${theme.borderHi}`,
              boxShadow: '0 10px 28px rgba(0,0,0,0.55)', padding: 6, zIndex: 40,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: theme.dim, fontSize: 9, borderBottom: `1px solid ${theme.border}`, paddingBottom: 4, marginBottom: 4 }}>
                <span>NOTIFICATIONS</span><span>{activeAlerts.length} ACTIVE</span>
              </div>
              <div style={{ display: 'flex', gap: 3, marginBottom: 5 }}>
                {['ALL', 'WARN', 'INFO'].map(level => (
                  <button key={level} onClick={() => setAlertSeverity(level)} style={{
                    background: alertSeverity === level ? theme.accent : theme.bg2,
                    color: alertSeverity === level ? theme.bg : theme.dim,
                    border: `1px solid ${alertSeverity === level ? theme.accent : theme.border}`,
                    fontFamily: theme.fontMono, fontSize: 9, fontWeight: 800,
                    cursor: 'pointer', padding: '2px 7px',
                  }}>{level}</button>
                ))}
              </div>
              {!visibleAlerts.length && <div style={{ color: theme.dim, padding: '8px 4px', fontSize: 10 }}>No active alerts.</div>}
              {visibleAlerts.map((alert, index) => {
                const key = alertKey(alert, index);
                return (
                  <div key={key} style={{
                    display: 'grid', gridTemplateColumns: '46px 1fr 18px', gap: 6,
                    padding: '5px 2px', borderBottom: `1px dotted ${theme.border}`, alignItems: 'start',
                  }}>
                    <span style={{ color: theme.warn, fontWeight: 800 }}>{alert.symbol || 'MKT'}</span>
                    <span style={{ color: theme.text, lineHeight: 1.25 }}>{alert.message || alert.severity || 'Alert'}</span>
                    <button onClick={() => dismissAlert(key)} aria-label="Dismiss alert" style={{
                      background: theme.bg2, border: `1px solid ${theme.border}`,
                      color: theme.dim, cursor: 'pointer', width: 16, height: 16, lineHeight: '12px',
                      padding: 0, fontFamily: theme.fontMono, fontSize: 10,
                    }}>x</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  function IndexRibbon({ theme, indices }) {
    return (
      <div style={{
        height: 26, background: theme.bg, borderBottom: `1px solid ${theme.border}`,
        display: 'flex', alignItems: 'stretch', overflow: 'hidden',
        fontFamily: theme.fontMono, fontSize: 11,
      }}>
        {indices.map((idx, i) => {
          const [sym, name, val, ch] = idx;
          const isPct = sym !== 'US10Y';
          return (
            <div key={sym} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 10px', borderRight: i < indices.length - 1 ? `1px solid ${theme.border}` : 'none',
              minWidth: 0, gap: 6,
            }}>
              <span style={{ color: theme.dim, fontWeight: 700, letterSpacing: '0.06em' }}>{sym}</span>
              <span style={{ color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{typeof val === 'number' ? val.toLocaleString('en-US') : val}</span>
              <span style={{ color: ch >= 0 ? theme.up : theme.down, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {ch >= 0 ? '▲' : '▼'}{Math.abs(ch).toFixed(isPct ? 2 : 3)}{isPct ? '%' : ''}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // ─── Quote header (above chart) ─────────────────────────────
  function QuoteHeader({ theme, t }) {
    const upDay = t.pctChg >= 0;
    return (
      <div style={{
        padding: '6px 10px',
        borderBottom: `1px solid ${theme.border}`,
        background: theme.bg2,
        fontFamily: theme.fontMono, fontSize: 11,
        display: 'grid',
        gridTemplateColumns: 'auto auto 1fr',
        gap: 16, alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: theme.textBright, lineHeight: 1, letterSpacing: '0.02em' }}>{t.sym}</div>
          <div style={{ color: theme.dim, fontSize: 9, marginTop: 2, letterSpacing: '0.05em' }}>{t.name.toUpperCase()} · {t.sector.toUpperCase()}</div>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: theme.textBright, letterSpacing: '0.01em', fontVariantNumeric: 'tabular-nums' }}>{fmt.money(t.price)}</span>
            <span style={{ color: upDay ? theme.up : theme.down, fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {fmt.sign(t.price - t.prevClose)} ({fmt.pct(t.pctChg)})
            </span>
          </div>
          <div style={{ color: theme.dim, fontSize: 9, marginTop: 2 }}>
            REG · LAST {fmt.money(t.price)} · BID {fmt.money(t.bids[0].p)} × {(t.bids[0].sz/100)|0} · ASK {fmt.money(t.asks[0].p)} × {(t.asks[0].sz/100)|0}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, fontSize: 10 }}>
          {[
            ['OPEN',   fmt.money(t.prevClose * (1 + (t.pctChg/100)*0.2))],
            ['HIGH',   fmt.money(t.dayHigh)],
            ['LOW',    fmt.money(t.dayLow)],
            ['VOL',    fmt.big(t.volume)],
            ['AVG',    fmt.big(t.avgVol)],
            ['52W H',  fmt.money(t.yHigh)],
            ['52W L',  fmt.money(t.yLow)],
            ['MCAP',   '$' + fmt.big(t.mcap)],
            ['P/E',    t.pe.toFixed(1)],
            ['FWD P/E',t.fwdPe.toFixed(1)],
            ['β',      t.beta.toFixed(2)],
            ['DIV',    t.div ? t.div.toFixed(2) + '%' : '—'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px dotted ${theme.border}`, padding: '1px 0' }}>
              <span style={{ color: theme.dim }}>{k}</span><span style={{ color: theme.text, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Factor scores ───────────────────────────────────────────
  function FactorScores({ theme, t }) {
    const factors = [
      ['VAL', t.factors.value],
      ['MOM', t.factors.momentum],
      ['QLT', t.factors.quality],
      ['LVL', t.factors.lowVol],
      ['GRW', t.factors.growth],
      ['SIZ', t.factors.size],
    ];
    const cx = 64, cy = 64, R = 42;
    const pts = factors.map((f, i) => {
      const a = -Math.PI/2 + (i / factors.length) * Math.PI * 2;
      const r = (f[1] / 100) * R;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    });
    const labelPts = factors.map((f, i) => {
      const a = -Math.PI/2 + (i / factors.length) * Math.PI * 2;
      return [cx + (R + 14) * Math.cos(a), cy + (R + 14) * Math.sin(a)];
    });
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '128px minmax(0, 1fr)', gap: 8, fontSize: 10, height: '100%' }}>
        <svg viewBox="0 0 128 128" style={{ width: 128, height: 128, maxWidth: '100%' }}>
          {[0.25, 0.5, 0.75, 1].map((r, i) => (
            <polygon key={i} points={factors.map((_, k) => {
              const a = -Math.PI/2 + (k / factors.length) * Math.PI * 2;
              return (cx + R * r * Math.cos(a)) + ',' + (cy + R * r * Math.sin(a));
            }).join(' ')} fill="none" stroke={i === 3 ? theme.dim : theme.borderHi} strokeOpacity={i === 3 ? 0.9 : 0.72} strokeWidth={i === 3 ? 1.1 : 0.8} />
          ))}
          {factors.map((_, i) => {
            const a = -Math.PI/2 + (i / factors.length) * Math.PI * 2;
            return <line key={i} x1={cx} y1={cy} x2={cx + R * Math.cos(a)} y2={cy + R * Math.sin(a)} stroke={theme.dim} strokeOpacity={0.82} strokeWidth={0.9} />;
          })}
          <polygon points={pts.map(p => p.join(',')).join(' ')} fill={theme.accent} fillOpacity={0.18} stroke={theme.accent} strokeWidth={1.2} />
          {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={1.6} fill={theme.accent} />)}
          {labelPts.map((p, i) => (
            <text key={i} x={p[0]} y={p[1]+3} fill={theme.textBright} stroke={theme.bg} strokeWidth={2.4} paintOrder="stroke" fontFamily={theme.fontMono} fontSize={9} fontWeight={700} textAnchor="middle">{factors[i][0]}</text>
          ))}
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontFamily: theme.fontMono }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${theme.border}`, paddingBottom: 2, marginBottom: 2 }}>
            <span style={{ color: theme.dim }}>COMPOSITE</span>
            <span style={{ color: theme.accent, fontWeight: 800, fontSize: 14 }}>{t.composite}</span>
          </div>
          {factors.map(([k, v]) => (
            <div key={k} style={{ display: 'grid', gridTemplateColumns: '30px 1fr 24px', gap: 4, alignItems: 'center', fontSize: 9 }}>
              <span style={{ color: theme.dim }}>{k}</span>
              <div style={{ height: 6, background: theme.bg2, position: 'relative', border: `1px solid ${theme.border}` }}>
                <div style={{ position: 'absolute', inset: 0, width: v + '%', background: v >= 70 ? theme.up : v >= 40 ? theme.warn : theme.down, opacity: 0.85 }} />
              </div>
              <span style={{ color: theme.text, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop: 2, color: theme.dim, fontSize: 8, lineHeight: 1.3 }}>
            DECILE RANK · UNIVERSE: {(window.MarketData.MARKET_META && window.MarketData.MARKET_META.id) || 'SP500'}
          </div>
        </div>
      </div>
    );
  }

  // ─── Order book L2 ───────────────────────────────────────────
  function OrderBook({ theme, t }) {
    const maxSize = Math.max(...t.bids.map(b => b.sz), ...t.asks.map(a => a.sz));
    const Row = ({ side, p, sz, isTop }) => {
      const pct = (sz / maxSize) * 100;
      const sideColor = side === 'B' ? theme.up : theme.down;
      return (
        <div style={{
          position: 'relative', display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr', fontSize: 10, padding: '1px 6px',
          fontFamily: theme.fontMono, borderBottom: `1px solid ${theme.border}`,
          background: isTop ? theme.panelHi : 'transparent',
        }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, [side === 'B' ? 'right' : 'left']: 0, width: pct + '%', background: sideColor, opacity: 0.15 }} />
          <span style={{ color: sideColor, fontWeight: 700, position: 'relative', zIndex: 1 }}>{side}</span>
          <span style={{ color: theme.text, textAlign: 'right', fontVariantNumeric: 'tabular-nums', position: 'relative', zIndex: 1 }}>{p.toFixed(2)}</span>
          <span style={{ color: theme.dim, textAlign: 'right', fontVariantNumeric: 'tabular-nums', position: 'relative', zIndex: 1 }}>{(sz/100)|0}</span>
        </div>
      );
    };
    const spread = t.asks[0].p - t.bids[0].p;
    const midPrice = (t.asks[0].p + t.bids[0].p) / 2;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontSize: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '0 6px 2px', color: theme.dim, fontSize: 8, letterSpacing: '0.05em' }}>
          <span>SIDE</span><span style={{ textAlign: 'right' }}>PRICE</span><span style={{ textAlign: 'right' }}>SZ(×100)</span>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column-reverse', overflow: 'hidden' }}>
            {t.asks.slice(0, 9).map((a, i) => <Row key={'a'+i} side="A" p={a.p} sz={a.sz} isTop={i===0} />)}
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', padding: '3px 6px',
            background: theme.bg2, borderTop: `1px solid ${theme.borderHi}`, borderBottom: `1px solid ${theme.borderHi}`,
            color: theme.accent, fontWeight: 700, fontSize: 10,
          }}>
            <span>MID {midPrice.toFixed(2)}</span>
            <span style={{ color: theme.dim }}>SPRD {spread.toFixed(2)}</span>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {t.bids.slice(0, 9).map((b, i) => <Row key={'b'+i} side="B" p={b.p} sz={b.sz} isTop={i===0} />)}
          </div>
        </div>
      </div>
    );
  }

  // ─── Options flow ────────────────────────────────────────────
  function OptionsFlow({ theme, flow }) {
    return (
      <div style={{ fontSize: 10, fontFamily: theme.fontMono, height: '100%', overflow: 'auto' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '24px 36px 38px 44px 50px 36px 36px',
          gap: 4, padding: '0 4px 2px', color: theme.dim, fontSize: 8, letterSpacing: '0.05em',
          borderBottom: `1px solid ${theme.border}`, position: 'sticky', top: 0, background: theme.panel,
        }}>
          <span>T</span><span>STK</span><span>EXP</span><span style={{ textAlign: 'right' }}>VOL</span><span style={{ textAlign: 'right' }}>V/OI</span><span style={{ textAlign: 'right' }}>PRM</span><span>SIDE</span>
        </div>
        {flow.map((o, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '24px 36px 38px 44px 50px 36px 36px',
            gap: 4, padding: '1px 4px', borderBottom: `1px dotted ${theme.border}`,
            fontSize: 10, fontVariantNumeric: 'tabular-nums',
          }}>
            <span style={{ color: o.type === 'C' ? theme.up : theme.down, fontWeight: 700 }}>{o.type}</span>
            <span style={{ color: theme.text }}>{o.strike}</span>
            <span style={{ color: theme.dim }}>{o.exp}</span>
            <span style={{ color: theme.text, textAlign: 'right' }}>{fmt.num(o.vol)}</span>
            <span style={{ color: o.ratio > 5 ? theme.warn : theme.text, textAlign: 'right', fontWeight: o.ratio > 5 ? 700 : 400 }}>{o.ratio}x</span>
            <span style={{ color: theme.dim, textAlign: 'right' }}>{o.prem.toFixed(2)}</span>
            <span style={{ color: o.side === 'ASK' ? theme.up : theme.down }}>{o.side}</span>
          </div>
        ))}
      </div>
    );
  }

  Object.assign(window, {
    Panel, HeaderBar, IndexRibbon, QuoteHeader, FactorScores, OrderBook, OptionsFlow,
  });
})();
