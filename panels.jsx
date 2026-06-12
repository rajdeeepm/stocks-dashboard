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

  // ─── News feed ───────────────────────────────────────────────
  function NewsFeed({ theme, news, ticker }) {
    const [tab, setTab] = React.useState('SYM');
    const topicFeed = window.MarketData.newsForTopic
      ? window.MarketData.newsForTopic(ticker.sym, tab)
      : (tab === 'SYM' ? news : news.slice(news.length - 8));
    const items = (topicFeed && topicFeed.length ? topicFeed : news).slice(0, 18);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: theme.fontMono }}>
        <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
          {['SYM', 'MKT', 'EARN', 'M&A'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '1px 8px', fontSize: 9, letterSpacing: '0.06em',
              background: tab === t ? theme.accent : theme.panelHi,
              color: tab === t ? theme.bg : theme.dim,
              border: `1px solid ${tab === t ? theme.accent : theme.border}`,
              cursor: 'pointer', fontFamily: theme.fontMono, fontWeight: 700,
            }}>{t}</button>
          ))}
          <div style={{ flex: 1 }} />
          <span style={{ color: theme.dim, fontSize: 9 }}>VIA GOOGLE NEWS</span>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {items.map((n, i) => (
            <div key={i} style={{
              padding: '3px 0', borderBottom: `1px dotted ${theme.border}`,
              display: 'grid', gridTemplateColumns: '32px 1fr 38px', gap: 6,
              alignItems: 'start', fontSize: 10,
            }}>
              <span style={{ color: theme.dim, fontSize: 9, paddingTop: 1 }}>{window.MarketData.fmtMinsAgo(n.minsAgo)}</span>
              <div style={{ minWidth: 0 }}>
                <a
                  href={n.link || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  onDoubleClick={(event) => {
                    if (!n.link) return;
                    event.preventDefault();
                    window.open(n.link, '_blank', 'noopener,noreferrer');
                  }}
                  style={{
                    color: theme.text,
                    lineHeight: 1.25,
                    fontWeight: 500,
                    textDecoration: 'none',
                    display: 'block',
                  }}
                >{n.head}</a>
                <div style={{ color: theme.dim, fontSize: 8, marginTop: 1 }}>{n.src.toUpperCase()}</div>
              </div>
              <span style={{ color: i < 3 ? theme.warn : theme.dim, fontSize: 8, textAlign: 'right', fontWeight: i < 3 ? 700 : 400 }}>
                {i < 3 ? '● HOT' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Insider Transactions ────────────────────────────────────
  function InsiderTx({ theme, list }) {
    return (
      <div style={{ fontSize: 10, fontFamily: theme.fontMono, height: '100%', overflow: 'auto' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 48px 36px 56px 56px 38px',
          gap: 4, padding: '0 4px 2px', color: theme.dim, fontSize: 8, letterSpacing: '0.05em',
          borderBottom: `1px solid ${theme.border}`,
        }}>
          <span>INSIDER</span><span>ROLE</span><span>ACT</span><span style={{ textAlign: 'right' }}>SHARES</span><span style={{ textAlign: 'right' }}>PRICE</span><span>DATE</span>
        </div>
        {list.map((row, i) => {
          const [name, role, act, sh, pr, dt] = row;
          return (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1fr 48px 36px 56px 56px 38px',
              gap: 4, padding: '1px 4px', borderBottom: `1px dotted ${theme.border}`,
              fontSize: 10, fontVariantNumeric: 'tabular-nums',
            }}>
              <span style={{ color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
              <span style={{ color: theme.dim, fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{role}</span>
              <span style={{ color: act === 'BUY' ? theme.up : theme.down, fontWeight: 700 }}>{act}</span>
              <span style={{ color: theme.text, textAlign: 'right' }}>{fmt.num(sh)}</span>
              <span style={{ color: theme.dim, textAlign: 'right' }}>{pr.toFixed(2)}</span>
              <span style={{ color: theme.dim, fontSize: 9 }}>{dt}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // ─── Short Interest ─────────────────────────────────────────
  function ShortInterest({ theme, t }) {
    const gauge = (val, max, color) => (
      <div style={{ height: 5, background: theme.bg2, border: `1px solid ${theme.border}`, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, width: Math.min(100, (val/max)*100) + '%', background: color, opacity: 0.8 }} />
      </div>
    );
    return (
      <div style={{ fontSize: 10, fontFamily: theme.fontMono, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ color: theme.dim }}>SHORT INT %</span>
            <span style={{ color: t.shortPct > 7 ? theme.down : theme.text, fontWeight: 700 }}>{t.shortPct}%</span>
          </div>
          {gauge(t.shortPct, 15, t.shortPct > 7 ? theme.down : theme.warn)}
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ color: theme.dim }}>DAYS TO COVER</span>
            <span style={{ color: t.dtc > 3 ? theme.down : theme.text, fontWeight: 700 }}>{t.dtc}d</span>
          </div>
          {gauge(t.dtc, 6, t.dtc > 3 ? theme.down : theme.warn)}
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ color: theme.dim }}>UTILIZATION</span>
            <span style={{ color: theme.text, fontWeight: 700 }}>{Math.min(99, (t.shortPct * 8) | 0)}%</span>
          </div>
          {gauge(t.shortPct * 8, 100, theme.accent)}
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ color: theme.dim }}>BORROW FEE</span>
            <span style={{ color: theme.text, fontWeight: 700 }}>{(t.shortPct * 0.18 + 0.25).toFixed(2)}%</span>
          </div>
          {gauge(t.shortPct * 0.18 + 0.25, 4, theme.warn)}
        </div>
        <div style={{ marginTop: 4, padding: '4px 6px', background: theme.bg2, border: `1px solid ${theme.border}`, fontSize: 9 }}>
          <div style={{ color: theme.dim, marginBottom: 1 }}>SQUEEZE RISK</div>
          <div style={{ color: t.shortPct * t.dtc > 30 ? theme.warn : theme.text, fontWeight: 700, fontSize: 11 }}>
            {t.shortPct * t.dtc > 30 ? 'ELEVATED' : t.shortPct * t.dtc > 15 ? 'MODERATE' : 'LOW'}
          </div>
          <div style={{ color: theme.dim, marginTop: 2, fontSize: 8 }}>SI × DTC = {(t.shortPct * t.dtc).toFixed(1)}</div>
        </div>
      </div>
    );
  }

  // ─── Sector Heatmap ──────────────────────────────────────────
  function SectorHeatmap({ theme, sectors }) {
    return (
      <div style={{
        display: 'grid', gap: 3,
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gridTemplateRows: 'repeat(3, minmax(0, 1fr))',
        height: '100%', fontFamily: theme.fontMono, overflow: 'hidden',
      }}>
        {sectors.map(([name, weight, perf], i) => {
          const intensity = Math.min(1, Math.abs(perf) / 1.5);
          const moveColor = perf >= 0 ? theme.up : theme.down;
          const bg = `color-mix(in srgb, ${moveColor} ${18 + intensity * 30}%, ${theme.bg2})`;
          return (
            <div key={name} style={{
              background: bg,
              padding: '5px 6px', position: 'relative', overflow: 'hidden',
              border: `1px solid ${theme.border}`, minWidth: 0, minHeight: 0,
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            }}>
              <div style={{
                color: theme.textBright, fontWeight: 800, fontSize: 9,
                letterSpacing: 0, textTransform: 'uppercase', lineHeight: 1.12,
                textShadow: `0 1px 2px ${theme.bg}`,
                overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              }}>
                {name}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 4, marginTop: 2 }}>
                <span style={{ color: moveColor, fontSize: 13, fontWeight: 900, fontVariantNumeric: 'tabular-nums', textShadow: `0 1px 2px ${theme.bg}` }}>
                  {fmt.pct(perf)}
                </span>
                <span style={{ color: theme.dim, fontSize: 8, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{weight.toFixed(1)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ─── Watchlist ───────────────────────────────────────────────
  function Watchlist({ theme, tickers, currentSym, onPick }) {
    const [sort, setSort] = React.useState({ key: 'composite', dir: -1 });
    const sorted = [...tickers].sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
    const Hdr = ({ k, children }) => (
      <button onClick={() => setSort(s => ({ key: k, dir: s.key === k ? -s.dir : -1 }))}
        style={{ background: 'none', border: 'none', color: theme.dim, fontFamily: theme.fontMono, fontSize: 8, letterSpacing: '0.06em', cursor: 'pointer', padding: 0, textAlign: 'inherit' }}>
        {children}{sort.key === k ? (sort.dir < 0 ? ' ▼' : ' ▲') : ''}
      </button>
    );
    return (
      <div style={{ fontSize: 10, fontFamily: theme.fontMono, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '52px 48px 44px 38px 36px 36px 32px',
          gap: 4, padding: '0 4px 2px',
          borderBottom: `1px solid ${theme.border}`,
        }}>
          <Hdr k="sym">SYM</Hdr>
          <Hdr k="price">LAST</Hdr>
          <Hdr k="pctChg">CHG%</Hdr>
          <Hdr k="volume">VOL</Hdr>
          <Hdr k="composite">QSCORE</Hdr>
          <Hdr k="pe">P/E</Hdr>
          <Hdr k="beta">β</Hdr>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {sorted.map(t => (
            <button key={t.sym} onClick={() => onPick(t.sym)} style={{
              display: 'grid', gridTemplateColumns: '52px 48px 44px 38px 36px 36px 32px',
              gap: 4, padding: '1px 4px', width: '100%',
              background: t.sym === currentSym ? theme.panelHi : 'transparent',
              borderBottom: `1px dotted ${theme.border}`, border: 'none',
              fontFamily: theme.fontMono, fontSize: 10,
              textAlign: 'left', cursor: 'pointer', fontVariantNumeric: 'tabular-nums',
            }}>
              <span style={{ color: t.sym === currentSym ? theme.warn : theme.accent, fontWeight: 700 }}>{t.sym}</span>
              <span style={{ color: theme.text, textAlign: 'right' }}>{fmt.money(t.price)}</span>
              <span style={{ color: t.pctChg >= 0 ? theme.up : theme.down, textAlign: 'right', fontWeight: 700 }}>{fmt.pct(t.pctChg)}</span>
              <span style={{ color: theme.dim, textAlign: 'right' }}>{fmt.big(t.volume)}</span>
              <span style={{ color: t.composite >= 70 ? theme.up : t.composite >= 50 ? theme.warn : theme.down, textAlign: 'right', fontWeight: 700 }}>{t.composite}</span>
              <span style={{ color: theme.dim, textAlign: 'right' }}>{t.pe.toFixed(1)}</span>
              <span style={{ color: theme.dim, textAlign: 'right' }}>{t.beta.toFixed(2)}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── Top Movers ─────────────────────────────────────────────
  function TopMovers({ theme, tickers, onPick }) {
    const [tab, setTab] = React.useState('GAIN');
    const sorted = [...tickers].sort((a, b) => {
      if (tab === 'GAIN') return b.pctChg - a.pctChg;
      if (tab === 'LOSE') return a.pctChg - b.pctChg;
      return b.volume - a.volume;
    }).slice(0, 32);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: theme.fontMono }}>
        <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
          {[['GAIN', 'GAINERS'], ['LOSE', 'LOSERS'], ['ACTV', 'ACTIVE']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              padding: '1px 8px', fontSize: 9, letterSpacing: '0.06em',
              background: tab === k ? theme.accent : theme.panelHi,
              color: tab === k ? theme.bg : theme.dim,
              border: `1px solid ${tab === k ? theme.accent : theme.border}`,
              cursor: 'pointer', fontFamily: theme.fontMono, fontWeight: 700,
            }}>{l}</button>
          ))}
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {sorted.map((t, i) => (
            <button key={t.sym} onClick={() => onPick(t.sym)} style={{
              display: 'grid', gridTemplateColumns: '14px 50px 1fr 48px 50px',
              gap: 4, padding: '1px 4px', width: '100%',
              background: 'transparent', borderBottom: `1px dotted ${theme.border}`, border: 'none',
              fontFamily: theme.fontMono, fontSize: 10, textAlign: 'left', cursor: 'pointer',
              fontVariantNumeric: 'tabular-nums',
            }}>
              <span style={{ color: theme.dim, fontSize: 9 }}>{i+1}</span>
              <span style={{ color: theme.accent, fontWeight: 700 }}>{t.sym}</span>
              <span style={{ color: theme.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 9 }}>{t.name}</span>
              <span style={{ color: theme.text, textAlign: 'right' }}>{fmt.money(t.price)}</span>
              <span style={{ color: t.pctChg >= 0 ? theme.up : theme.down, textAlign: 'right', fontWeight: 700 }}>{fmt.pct(t.pctChg)}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── Earnings Calendar ──────────────────────────────────────
  function EarningsCal({ theme, list, currentSym, onPick }) {
    return (
      <div style={{ fontSize: 10, fontFamily: theme.fontMono, height: '100%', overflow: 'auto' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '42px 50px 1fr 32px 36px',
          gap: 4, padding: '0 4px 2px',
          borderBottom: `1px solid ${theme.border}`, color: theme.dim, fontSize: 8, letterSpacing: '0.05em',
        }}>
          <span>DATE</span><span>SYM</span><span>COMPANY</span><span>TIME</span><span style={{ textAlign: 'right' }}>EPS E</span>
        </div>
        {list.map((row, i) => {
          const [date, sym, name, time, eps, note] = row;
          const isCur = sym === currentSym;
          return (
            <button key={i} onClick={() => onPick(sym)} style={{
              display: 'grid', gridTemplateColumns: '42px 50px 1fr 32px 36px',
              gap: 4, padding: '1px 4px', width: '100%',
              background: isCur ? theme.panelHi : 'transparent',
              borderBottom: `1px dotted ${theme.border}`, border: 'none',
              fontFamily: theme.fontMono, fontSize: 10, textAlign: 'left', cursor: 'pointer',
              fontVariantNumeric: 'tabular-nums',
            }}>
              <span style={{ color: theme.dim }}>{date}</span>
              <span style={{ color: isCur ? theme.warn : theme.accent, fontWeight: 700 }}>{sym}</span>
              <span style={{ color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
              <span style={{ color: time === 'AMC' ? theme.accent2 : theme.warn, fontWeight: 600 }}>{time}</span>
              <span style={{ color: theme.text, textAlign: 'right' }}>{eps.toFixed(2)}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // ─── Economic Calendar ──────────────────────────────────────
  function EconCal({ theme, list }) {
    return (
      <div style={{ fontSize: 10, fontFamily: theme.fontMono, height: '100%', overflow: 'auto' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '42px 38px 1fr 42px 42px 32px',
          gap: 4, padding: '0 4px 2px',
          borderBottom: `1px solid ${theme.border}`, color: theme.dim, fontSize: 8, letterSpacing: '0.05em',
        }}>
          <span>DATE</span><span>TIME</span><span>EVENT</span><span style={{ textAlign: 'right' }}>EST</span><span style={{ textAlign: 'right' }}>PRIOR</span><span>IMP</span>
        </div>
        {list.map((row, i) => {
          const [date, time, ctry, ev, est, prior, imp] = row;
          const impColor = imp === 'HIGH' ? theme.down : imp === 'MED' ? theme.warn : theme.dim;
          return (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '42px 38px 1fr 42px 42px 32px',
              gap: 4, padding: '1px 4px',
              borderBottom: `1px dotted ${theme.border}`,
              fontFamily: theme.fontMono, fontSize: 10,
              fontVariantNumeric: 'tabular-nums',
            }}>
              <span style={{ color: theme.dim }}>{date}</span>
              <span style={{ color: theme.dim }}>{time}</span>
              <span style={{ color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ color: theme.accent }}>{ctry} · </span>{ev}
              </span>
              <span style={{ color: theme.text, textAlign: 'right' }}>{est}</span>
              <span style={{ color: theme.dim, textAlign: 'right' }}>{prior}</span>
              <span style={{ color: impColor, fontWeight: 700, fontSize: 8 }}>● {imp}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // ─── Trade Ideas ─────────────────────────────────────────────
  function TradeIdeas({ theme, ideas, onPick, currentSym }) {
    return (
      <div style={{ fontSize: 10, fontFamily: theme.fontMono, height: '100%', overflow: 'auto' }}>
        {ideas.map((it, i) => {
          const isLong = it.side === 'LONG';
          const isCur = it.sym === currentSym;
          return (
            <button key={i} onClick={() => onPick(it.sym)} style={{
              display: 'grid', gridTemplateColumns: '36px 48px 1fr 28px',
              gap: 4, padding: '3px 4px', width: '100%',
              background: isCur ? theme.panelHi : 'transparent',
              borderBottom: `1px dotted ${theme.border}`, border: 'none',
              fontFamily: theme.fontMono, fontSize: 10, textAlign: 'left', cursor: 'pointer',
            }}>
              <span style={{
                color: isLong ? theme.up : theme.down,
                fontWeight: 700, fontSize: 9, alignSelf: 'start',
                padding: '1px 3px', background: theme.bg2, border: `1px solid ${isLong ? theme.up : theme.down}`,
                textAlign: 'center',
              }}>{it.side}</span>
              <span style={{ color: theme.accent, fontWeight: 700 }}>{it.sym}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 9 }}>{it.thesis}</div>
                <div style={{ color: theme.dim, fontSize: 8, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
                  TP {it.tp} · SL {it.sl} · R:R {it.rr.toFixed(1)}
                </div>
              </div>
              <span style={{
                color: it.conf >= 85 ? theme.up : it.conf >= 70 ? theme.warn : theme.dim,
                fontWeight: 800, fontSize: 12, alignSelf: 'center', textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
              }}>{it.conf}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // ─── Correlation Matrix ─────────────────────────────────────
  function CorrMatrix({ theme, symbols, matrix }) {
    return (
      <div style={{ fontSize: 9, fontFamily: theme.fontMono, height: '100%', overflow: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ padding: 2, color: theme.dim, fontWeight: 400, fontSize: 8 }}></th>
              {symbols.map(s => (
                <th key={s} style={{ padding: '1px 2px', color: theme.accent, fontWeight: 700, fontSize: 9, textAlign: 'center' }}>{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {symbols.map(r => (
              <tr key={r}>
                <td style={{ padding: '1px 4px', color: theme.accent, fontWeight: 700, fontSize: 9 }}>{r}</td>
                {symbols.map(c => {
                  const v = matrix[r][c];
                  const intensity = Math.min(1, Math.abs(v));
                  const color = v >= 0 ? theme.up : theme.down;
                  return (
                    <td key={c} style={{
                      padding: '1px 2px', textAlign: 'center', fontSize: 8,
                      background: r === c ? theme.bg2 : color,
                      color: r === c ? theme.dim : theme.bg,
                      opacity: r === c ? 1 : 0.25 + intensity * 0.75,
                      fontWeight: Math.abs(v) > 0.6 ? 700 : 400,
                      border: `1px solid ${theme.bg}`,
                    }}>{r === c ? '—' : v.toFixed(2)}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ─── Portfolio P&L ──────────────────────────────────────────
  function PortfolioPnL({ theme, positions, onPick, currentSym }) {
    const totalMV = positions.reduce((s, p) => s + Math.abs(p.mv), 0);
    const totalPnL = positions.reduce((s, p) => s + p.pnl, 0);
    const dayPnL   = positions.reduce((s, p) => s + p.pnl * 0.018, 0);
    const long  = positions.filter(p => p.side === 'LONG').reduce((s, p) => s + p.mv, 0);
    const short = positions.filter(p => p.side === 'SHORT').reduce((s, p) => s + Math.abs(p.mv), 0);
    return (
      <div style={{ fontSize: 10, fontFamily: theme.fontMono, height: '100%', display: 'grid', gridTemplateColumns: '320px 1fr', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            <div style={{ padding: 6, background: theme.bg2, border: `1px solid ${theme.border}` }}>
              <div style={{ color: theme.dim, fontSize: 8, letterSpacing: '0.06em' }}>NAV (GROSS)</div>
              <div style={{ color: theme.textBright, fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>${(totalMV/1000).toFixed(1)}K</div>
            </div>
            <div style={{ padding: 6, background: theme.bg2, border: `1px solid ${theme.border}` }}>
              <div style={{ color: theme.dim, fontSize: 8, letterSpacing: '0.06em' }}>OPEN P&L</div>
              <div style={{ color: totalPnL >= 0 ? theme.up : theme.down, fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {totalPnL >= 0 ? '+' : ''}${(totalPnL/1000).toFixed(1)}K
              </div>
            </div>
            <div style={{ padding: 6, background: theme.bg2, border: `1px solid ${theme.border}` }}>
              <div style={{ color: theme.dim, fontSize: 8, letterSpacing: '0.06em' }}>DAY P&L</div>
              <div style={{ color: dayPnL >= 0 ? theme.up : theme.down, fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {dayPnL >= 0 ? '+' : ''}${(dayPnL/1000).toFixed(2)}K
              </div>
            </div>
            <div style={{ padding: 6, background: theme.bg2, border: `1px solid ${theme.border}` }}>
              <div style={{ color: theme.dim, fontSize: 8, letterSpacing: '0.06em' }}>EXPOSURE</div>
              <div style={{ color: theme.text, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ color: theme.up }}>+{(long/1000).toFixed(0)}K</span> / <span style={{ color: theme.down }}>-{(short/1000).toFixed(0)}K</span>
              </div>
              <div style={{ color: theme.dim, fontSize: 8 }}>NET ${((long-short)/1000).toFixed(0)}K · GROSS ${((long+short)/1000).toFixed(0)}K</div>
            </div>
          </div>
        </div>
        <div style={{ overflow: 'auto' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '46px 46px 50px 50px 50px 60px 60px 44px',
            gap: 4, padding: '0 4px 2px', color: theme.dim, fontSize: 8, letterSpacing: '0.05em',
            borderBottom: `1px solid ${theme.border}`,
          }}>
            <span>SYM</span><span>SIDE</span><span style={{ textAlign: 'right' }}>QTY</span><span style={{ textAlign: 'right' }}>AVG</span>
            <span style={{ textAlign: 'right' }}>LAST</span><span style={{ textAlign: 'right' }}>MV</span>
            <span style={{ textAlign: 'right' }}>P&L $</span><span style={{ textAlign: 'right' }}>P&L %</span>
          </div>
          {positions.map(p => (
            <button key={p.sym} onClick={() => onPick(p.sym)} style={{
              display: 'grid', gridTemplateColumns: '46px 46px 50px 50px 50px 60px 60px 44px',
              gap: 4, padding: '1px 4px', width: '100%',
              background: p.sym === currentSym ? theme.panelHi : 'transparent',
              borderBottom: `1px dotted ${theme.border}`, border: 'none',
              fontFamily: theme.fontMono, fontSize: 10, textAlign: 'left', cursor: 'pointer',
              fontVariantNumeric: 'tabular-nums',
            }}>
              <span style={{ color: theme.accent, fontWeight: 700 }}>{p.sym}</span>
              <span style={{ color: p.side === 'LONG' ? theme.up : theme.down, fontWeight: 700 }}>{p.side}</span>
              <span style={{ color: theme.text, textAlign: 'right' }}>{fmt.num(p.qty)}</span>
              <span style={{ color: theme.dim, textAlign: 'right' }}>{p.avg.toFixed(2)}</span>
              <span style={{ color: theme.text, textAlign: 'right' }}>{p.last.toFixed(2)}</span>
              <span style={{ color: theme.text, textAlign: 'right' }}>${(p.mv/1000).toFixed(1)}K</span>
              <span style={{ color: p.pnl >= 0 ? theme.up : theme.down, textAlign: 'right', fontWeight: 700 }}>
                {p.pnl >= 0 ? '+' : ''}${(p.pnl/1000).toFixed(2)}K
              </span>
              <span style={{ color: p.pct >= 0 ? theme.up : theme.down, textAlign: 'right', fontWeight: 700 }}>{fmt.pct(p.pct)}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── Risk Metrics ───────────────────────────────────────────
  function RiskMetrics({ theme, t, positions }) {
    const totalMV = positions.reduce((s, p) => s + Math.abs(p.mv), 0);
    const varDay = totalMV * 0.0218;
    const stress = totalMV * 0.082;
    const sharpe = 1.48;
    const sortino = 2.12;
    const maxDD  = -8.4;
    const items = [
      ['VaR 95% 1D',     '$' + fmt.big(varDay),   theme.warn],
      ['VaR 99% 1D',     '$' + fmt.big(varDay*1.41), theme.down],
      ['STRESS (-10%)',  '$' + fmt.big(stress),   theme.down],
      ['SHARPE (TTM)',   sharpe.toFixed(2),       theme.up],
      ['SORTINO',        sortino.toFixed(2),      theme.up],
      ['CALMAR',         '1.92',                  theme.up],
      ['MAX DD',         fmt.pct(maxDD),          theme.down],
      ['BETA (PORT)',    '0.87',                  theme.text],
      ['VOL 30D',        '14.2%',                 theme.text],
      ['CORREL SPX',     '0.68',                  theme.text],
      ['NET EXPOSURE',   '36%',                   theme.text],
      ['GROSS EXP',      '142%',                  theme.warn],
    ];
    return (
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 2, fontSize: 10, fontFamily: theme.fontMono,
        height: '100%', overflow: 'auto', alignContent: 'start', paddingRight: 2,
      }}>
        {items.map(([k, v, c]) => (
          <div key={k} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '3px 6px',
            background: theme.bg2, border: `1px solid ${theme.border}`,
          }}>
            <span style={{ color: theme.dim, fontSize: 9 }}>{k}</span>
            <span style={{ color: c, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
          </div>
        ))}
      </div>
    );
  }

  function SignalTrust({ theme, signals, currentSym, onPick }) {
    const items = (signals || []).map((s) => {
      const trust = s.trust || s;
      const symbol = s.symbol || s.sym || trust.symbol || trust.sym;
      const action = s.action || trust.action || (s.side === 'SHORT' ? 'SHORT_CANDIDATE' : 'LONG_CANDIDATE');
      return {
        ...s,
        symbol,
        action,
        score: Number(s.score ?? trust.score ?? s.conf ?? trust.confidence ?? 0),
        confidence: Number(s.confidence ?? trust.confidence ?? s.conf ?? 0),
      };
    }).filter((s) => s.symbol).slice(0, 28);
    return (
      <div style={{ fontSize: 10, fontFamily: theme.fontMono, height: '100%', overflow: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '46px 42px 42px 1fr', gap: 4, color: theme.dim, fontSize: 8, borderBottom: `1px solid ${theme.border}`, paddingBottom: 2 }}>
          <span>SYM</span><span>SCORE</span><span>CONF</span><span>STANCE</span>
        </div>
        {items.map(s => {
          const hot = s.action === 'LONG_CANDIDATE';
          const color = hot ? theme.up : s.action === 'AVOID' || s.action === 'RISK_OFF' ? theme.down : theme.warn;
          return (
            <button key={s.symbol} onClick={() => onPick(s.symbol)} style={{
              display: 'grid', gridTemplateColumns: '46px 42px 42px 1fr', gap: 4, width: '100%',
              padding: '2px 0', background: s.symbol === currentSym ? theme.panelHi : 'transparent',
              border: 'none', borderBottom: `1px dotted ${theme.border}`,
              color: theme.text, fontFamily: theme.fontMono, fontSize: 10, textAlign: 'left', cursor: 'pointer',
            }}>
              <span style={{ color: theme.accent, fontWeight: 800 }}>{s.symbol}</span>
              <span style={{ color: theme.textBright, fontVariantNumeric: 'tabular-nums' }}>{Number(s.score || 0).toFixed(1)}</span>
              <span style={{ color: theme.dim, fontVariantNumeric: 'tabular-nums' }}>{Number(s.confidence || 0).toFixed(0)}</span>
              <span style={{ color, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.action}</span>
            </button>
          );
        })}
        {!items.length && <div style={{ color: theme.dim, padding: 6 }}>WAITING FOR WEEKLY SIGNAL RUN</div>}
      </div>
    );
  }

  function ProviderHealth({ theme, providers }) {
    const rows = providers || [];
    return (
      <div style={{ fontSize: 9, fontFamily: theme.fontMono, height: '100%', overflow: 'auto' }}>
        {rows.map(p => {
          const ok = p.status === 'OK' || p.status === 'BOOT';
          return (
            <div key={p.name} style={{ padding: '3px 0', borderBottom: `1px dotted ${theme.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                <span style={{ color: theme.accent, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span style={{ color: ok ? theme.up : theme.down, fontWeight: 800 }}>{p.status}</span>
              </div>
              <div style={{ color: theme.dim, fontSize: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>{p.provider_type}</span>
                <span>{p.latency_ms == null ? '--' : p.latency_ms + 'ms'}</span>
              </div>
            </div>
          );
        })}
        {!rows.length && <div style={{ color: theme.dim, padding: 6 }}>PROVIDER HEARTBEAT PENDING</div>}
      </div>
    );
  }

  function ResearchMemo({ theme, summary }) {
    const memo = summary && summary.memo;
    const signal = summary && summary.signal;
    const reasons = memo ? memo.whyNow || [] : [];
    const risks = memo ? memo.riskFlags || [] : [];
    return (
      <div style={{ fontSize: 10, fontFamily: theme.fontMono, height: '100%', overflow: 'auto' }}>
        {!memo ? (
          <div style={{ color: theme.dim, padding: 6 }}>BUILDING RESEARCH MEMO FROM LIVE DATA</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 54px 54px', gap: 6, marginBottom: 4 }}>
              <div style={{ color: theme.textBright, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{memo.stance}</div>
              <div style={{ color: theme.accent, textAlign: 'right' }}>{Number(signal.score || 0).toFixed(1)}</div>
              <div style={{ color: theme.warn, textAlign: 'right' }}>{Number(signal.confidence || 0).toFixed(0)}%</div>
            </div>
            <div style={{ color: theme.dim, fontSize: 9, lineHeight: 1.25, marginBottom: 4 }}>{memo.summary}</div>
            {reasons.slice(0, 3).map((r, i) => (
              <div key={'r' + i} style={{ color: theme.text, borderTop: `1px dotted ${theme.border}`, padding: '2px 0' }}>+ {r}</div>
            ))}
            {risks.slice(0, 2).map((r, i) => (
              <div key={'k' + i} style={{ color: theme.warn, borderTop: `1px dotted ${theme.border}`, padding: '2px 0' }}>! {r}</div>
            ))}
          </>
        )}
      </div>
    );
  }

  function BacktestPanel({ theme, backtest }) {
    const rows = backtest ? backtest.items || [] : [];
    const summary = backtest ? backtest.summary || {} : {};
    return (
      <div style={{ fontSize: 10, fontFamily: theme.fontMono, height: '100%', overflow: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
          <div style={{ background: theme.bg2, border: `1px solid ${theme.border}`, padding: 4 }}>
            <div style={{ color: theme.dim, fontSize: 8 }}>AVG RET</div>
            <div style={{ color: (summary.avgReturnPct || 0) >= 0 ? theme.up : theme.down, fontWeight: 800 }}>{fmt.pct(summary.avgReturnPct || 0)}</div>
          </div>
          <div style={{ background: theme.bg2, border: `1px solid ${theme.border}`, padding: 4 }}>
            <div style={{ color: theme.dim, fontSize: 8 }}>WIN RATE</div>
            <div style={{ color: theme.textBright, fontWeight: 800 }}>{(summary.winRatePct || 0).toFixed(1)}%</div>
          </div>
        </div>
        {rows.slice(0, 5).map(row => (
          <div key={row.symbol} style={{ display: 'grid', gridTemplateColumns: '44px 1fr 54px', gap: 4, padding: '2px 0', borderBottom: `1px dotted ${theme.border}` }}>
            <span style={{ color: theme.accent, fontWeight: 700 }}>{row.symbol}</span>
            <span style={{ color: theme.dim }}>{row.start} -> {row.end}</span>
            <span style={{ color: row.returnPct >= 0 ? theme.up : theme.down, textAlign: 'right', fontWeight: 700 }}>{fmt.pct(row.returnPct)}</span>
          </div>
        ))}
        {!backtest && <div style={{ color: theme.dim, padding: 6 }}>BACKTEST RUN PENDING</div>}
      </div>
    );
  }

  function PaperTrading({ theme, positions, paper, onPick, currentSym }) {
    const [msg, setMsg] = React.useState('');
    const journal = paper.paperJournal || [];
    const send = async (side) => {
      if (!paper.placePaperOrder) return;
      setMsg('SENDING PAPER ' + side + '...');
      try {
        const res = await paper.placePaperOrder(currentSym, side, 10);
        setMsg(`${res.status} ${res.side} ${res.qty} ${res.symbol} @ ${res.fillPrice || 'WORKING'}`);
      } catch (err) {
        setMsg(String(err.message || err));
      }
    };
    return (
      <div style={{ fontSize: 10, fontFamily: theme.fontMono, height: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <PortfolioPnL theme={theme} positions={positions} onPick={onPick} currentSym={currentSym} />
        <div style={{ overflow: 'auto', borderLeft: `1px solid ${theme.border}`, paddingLeft: 8 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <button onClick={() => send('BUY')} style={{ background: theme.up, color: theme.bg, border: 'none', padding: '3px 8px', fontFamily: theme.fontMono, fontWeight: 800, cursor: 'pointer' }}>BUY 10</button>
            <button onClick={() => send('SELL')} style={{ background: theme.down, color: theme.bg, border: 'none', padding: '3px 8px', fontFamily: theme.fontMono, fontWeight: 800, cursor: 'pointer' }}>SELL 10</button>
          </div>
          <div style={{ color: theme.warn, minHeight: 14, marginBottom: 4 }}>{msg || 'PAPER ONLY · DUPLICATES BLOCKED'}</div>
          {(paper.portfolio?.positions || []).slice(0, 5).map(pos => (
            <div key={pos.symbol} style={{ display: 'grid', gridTemplateColumns: '44px 48px 1fr', gap: 4, borderBottom: `1px dotted ${theme.border}`, padding: '2px 0' }}>
              <span style={{ color: theme.accent, fontWeight: 700 }}>{pos.symbol}</span>
              <span style={{ color: theme.text, textAlign: 'right' }}>{pos.qty}</span>
              <span style={{ color: theme.dim, textAlign: 'right' }}>${(pos.marketValue || 0).toFixed(0)}</span>
            </div>
          ))}
        </div>
        <div style={{ overflow: 'auto', borderLeft: `1px solid ${theme.border}`, paddingLeft: 8 }}>
          <div style={{ color: theme.dim, fontSize: 8, borderBottom: `1px solid ${theme.border}`, paddingBottom: 2 }}>PAPER JOURNAL</div>
          {journal.slice(0, 8).map(o => (
            <div key={o.order_id} style={{ display: 'grid', gridTemplateColumns: '50px 36px 42px 1fr', gap: 4, borderBottom: `1px dotted ${theme.border}`, padding: '2px 0' }}>
              <span style={{ color: theme.accent, fontWeight: 700 }}>{o.symbol}</span>
              <span style={{ color: o.side === 'BUY' ? theme.up : theme.down }}>{o.side}</span>
              <span style={{ color: theme.text, textAlign: 'right' }}>{o.qty}</span>
              <span style={{ color: o.status === 'FILLED' ? theme.up : theme.warn, textAlign: 'right' }}>{o.status}</span>
            </div>
          ))}
          {!journal.length && <div style={{ color: theme.dim, padding: 6 }}>NO PAPER ORDERS YET</div>}
        </div>
      </div>
    );
  }

  function TickerResearchModal({ theme, symbol, ticker, market, allTickers = [], research = {}, onPick, onClose }) {
    const [payload, setPayload] = React.useState({ loading: true, summary: research.summary, history: [], backtest: null, portfolio: null, journal: [], error: '' });
    const sym = String(symbol || '').toUpperCase();
    React.useEffect(() => {
      let live = true;
      setPayload(p => ({ ...p, loading: true, error: '' }));
      const getJson = async (url, options) => {
        const res = await fetch(url, options || { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.detail || data.error || url);
        return data;
      };
      Promise.allSettled([
        getJson(`/api/research/summary?symbol=${encodeURIComponent(sym)}`),
        getJson(`/api/signals/history?symbol=${encodeURIComponent(sym)}&limit=12`),
        getJson('/api/backtest/run', {
          method: 'POST',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: [sym], lookbackDays: 90 }),
        }),
        getJson('/api/portfolio'),
        getJson('/api/paper/journal?limit=20'),
      ]).then(([summary, history, backtest, portfolio, journal]) => {
        if (!live) return;
        setPayload({
          loading: false,
          summary: summary.status === 'fulfilled' ? summary.value : research.summary,
          history: history.status === 'fulfilled' ? history.value.items || [] : [],
          backtest: backtest.status === 'fulfilled' ? backtest.value : null,
          portfolio: portfolio.status === 'fulfilled' ? portfolio.value : null,
          journal: journal.status === 'fulfilled' ? journal.value.items || [] : [],
          error: [summary, history, backtest, portfolio, journal].filter(x => x.status === 'rejected').map(x => x.reason.message).join(' | '),
        });
      });
      return () => { live = false; };
    }, [sym]);

    const summary = payload.summary || research.summary || {};
    const signal = summary.signal || (research.signals || []).find(s => s.symbol === sym) || {};
    const memo = summary.memo || {};
    const quote = summary.quote || {};
    const factors = signal.factors || {};
    const news = summary.news || [];
    const localPeers = React.useMemo(() => {
      const sector = ticker?.sector;
      const marketName = ticker?.market || market;
      return (allTickers || [])
        .filter(t => t.sym !== sym && (t.sector === sector || t.market === marketName))
        .slice(0, 12);
    }, [allTickers, sym, ticker, market]);
    const fundamentals = summary.fundamentals || {};
    const valuation = summary.valuation || {};
    const peers = (summary.peers && summary.peers.length ? summary.peers : localPeers);
    const signalDelta = summary.signalDelta || {};
    const regime = summary.regime || {};
    const strategies = summary.strategies || [];
    const earnings = summary.earnings?.items || [];
    const score = Number(signal.score || ticker?.composite || 0);
    const confidence = Number(signal.confidence || 0);
    const fairValue = valuation.fairValue || (ticker?.price ? ticker.price * (1 + (score - 50) / 140) : 0);
    const upside = ticker?.price ? ((fairValue - ticker.price) / ticker.price) * 100 : 0;
    const metricRows = [
      ['LAST', fmt.money(ticker?.price || quote.close || 0)],
      ['CHG%', fmt.pct(ticker?.pctChg || quote.changePct || 0)],
      ['MCAP', '$' + fmt.big(ticker?.mcap || 0)],
      ['P/E', Number(ticker?.pe || 0).toFixed(1)],
      ['FWD P/E', Number(ticker?.fwdPe || 0).toFixed(1)],
      ['BETA', Number(ticker?.beta || 0).toFixed(2)],
      ['52W H', fmt.money(ticker?.yHigh || 0)],
      ['52W L', fmt.money(ticker?.yLow || 0)],
    ];

    return (
      <div style={{
        position: 'absolute', inset: 8, zIndex: 70,
        background: 'rgba(5,4,2,0.94)', border: `1px solid ${theme.borderHi}`,
        boxShadow: '0 18px 60px rgba(0,0,0,0.72)', color: theme.text,
        fontFamily: theme.fontMono, display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          height: 34, display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 10px', background: theme.bg2, borderBottom: `1px solid ${theme.borderHi}`,
          fontSize: 11, letterSpacing: '0.06em',
        }}>
          <span style={{ color: theme.accent, fontWeight: 900 }}>DESK</span>
          <span style={{ color: theme.textBright, fontWeight: 800 }}>{sym}</span>
          <span style={{ color: theme.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticker?.name || sym}</span>
          <span style={{ color: payload.loading ? theme.warn : theme.up, marginLeft: 'auto' }}>{payload.loading ? 'LOADING' : 'READY'}</span>
          <button onClick={onClose} style={{
            background: theme.panelHi, border: `1px solid ${theme.border}`,
            color: theme.textBright, fontFamily: theme.fontMono, fontWeight: 900,
            cursor: 'pointer', padding: '2px 8px',
          }}>CLOSE</button>
        </div>

        <div style={{
          flex: 1, minHeight: 0, padding: 6, display: 'grid', gap: 6,
          gridTemplateColumns: '1.25fr 1fr 1fr 1fr',
          gridTemplateRows: '150px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)',
        }}>
          <Panel theme={theme} code="CHRT" title={`${sym} - price context`} style={{ gridColumn: 'span 2' }} bodyStyle={{ padding: 0 }}>
            <window.PriceChart ticker={ticker} theme={theme} range="3M" showMA20={true} showMA50={true} showMA200={false} showBB={false} />
          </Panel>

          <Panel theme={theme} code="SNAP" title={`${sym} · research snapshot`} style={{ gridColumn: 'span 1' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, height: '100%', fontSize: 10 }}>
              {metricRows.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', background: theme.bg2, border: `1px solid ${theme.border}`, padding: '2px 5px' }}>
                  <span style={{ color: theme.dim }}>{k}</span>
                  <span style={{ color: theme.textBright, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel theme={theme} code="THESIS" title="signal trust · current stance" style={{ gridColumn: 'span 1' }}>
            <div style={{ fontSize: 10, height: '100%', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                <div style={{ background: theme.bg2, border: `1px solid ${theme.border}`, padding: 5 }}>
                  <div style={{ color: theme.dim, fontSize: 8 }}>STANCE</div>
                  <div style={{ color: signal.action === 'LONG_CANDIDATE' ? theme.up : signal.action === 'AVOID' ? theme.down : theme.warn, fontWeight: 900 }}>{signal.action || 'N/A'}</div>
                </div>
                <div style={{ background: theme.bg2, border: `1px solid ${theme.border}`, padding: 5 }}>
                  <div style={{ color: theme.dim, fontSize: 8 }}>SCORE</div>
                  <div style={{ color: theme.textBright, fontWeight: 900 }}>{score.toFixed(1)}</div>
                </div>
                <div style={{ background: theme.bg2, border: `1px solid ${theme.border}`, padding: 5 }}>
                  <div style={{ color: theme.dim, fontSize: 8 }}>CONF</div>
                  <div style={{ color: confidence >= 75 ? theme.up : confidence >= 55 ? theme.warn : theme.down, fontWeight: 900 }}>{confidence.toFixed(0)}%</div>
                </div>
              </div>
              <div style={{ color: theme.text, lineHeight: 1.35, padding: '4px 2px' }}>{memo.summary || `${sym} research memo is being built from live quote, signal, and news data.`}</div>
              {signalDelta.summary && <div style={{ color: theme.accent2, borderBottom: `1px dotted ${theme.border}`, paddingBottom: 2 }}>DELTA {signalDelta.summary}</div>}
              {(memo.whyNow || signal.reasons || []).slice(0, 3).map((r, i) => <div key={i} style={{ color: theme.up, borderBottom: `1px dotted ${theme.border}`, paddingBottom: 2 }}>+ {r}</div>)}
              {(memo.riskFlags || signal.risks || []).slice(0, 2).map((r, i) => <div key={'r'+i} style={{ color: theme.warn }}>! {r}</div>)}
            </div>
          </Panel>

          <Panel theme={theme} code="VALUE" title="valuation · dcf-lite" style={{ gridColumn: 'span 1' }}>
            <ValuationMini theme={theme} valuation={{ ...valuation, fairValue, upsidePct: valuation.upsidePct ?? upside }} />
          </Panel>

          <Panel theme={theme} code="FUND" title="fundamentals - provider-ready" style={{ gridColumn: 'span 1' }}>
            <FundamentalsMini theme={theme} fundamentals={fundamentals} />
          </Panel>

          <Panel theme={theme} code="STRAT" title="strategy presets - fit" style={{ gridColumn: 'span 1' }}>
            <StrategyMini theme={theme} strategies={strategies} />
          </Panel>

          <Panel theme={theme} code="REGM" title="market regime - filter" style={{ gridColumn: 'span 1' }}>
            <RegimeMini theme={theme} regime={regime} />
          </Panel>

          <Panel theme={theme} code="FACTOR" title="factor attribution" style={{ gridColumn: 'span 1' }}>
            <FactorBars theme={theme} factors={factors} />
          </Panel>

          <Panel theme={theme} code="NEWS" title={`${sym} · latest news`} style={{ gridColumn: 'span 1' }}>
            <div style={{ height: '100%', overflow: 'auto', fontSize: 10 }}>
              {news.slice(0, 8).map((n, i) => (
                <div key={i} style={{ padding: '4px 0', borderBottom: `1px dotted ${theme.border}` }}>
                  <a href={n.link || '#'} target="_blank" rel="noopener noreferrer" style={{ color: theme.text, lineHeight: 1.25, textDecoration: 'none', display: 'block' }}>{n.title || n.head}</a>
                  <div style={{ color: theme.dim, fontSize: 8, marginTop: 2 }}>{(n.source || n.src || 'NEWS').toUpperCase()} · {n.published || `${n.minsAgo || 0}m ago`}</div>
                </div>
              ))}
              {!news.length && <div style={{ color: theme.dim, padding: 8 }}>No news loaded yet.</div>}
            </div>
          </Panel>

          <Panel theme={theme} code="BT" title="single-name backtest context" style={{ gridColumn: 'span 1' }}>
            <BacktestMini theme={theme} backtest={payload.backtest} />
          </Panel>

          <Panel theme={theme} code="HIST" title="signal history · audit trail" style={{ gridColumn: 'span 1' }}>
            <SignalHistoryMini theme={theme} rows={payload.history} />
          </Panel>

          <Panel theme={theme} code="PEER" title="peer / market comparison" style={{ gridColumn: 'span 1' }}>
            <PeerMini theme={theme} peers={peers} onPick={onPick} />
          </Panel>

          <Panel theme={theme} code="EARN" title="events - earnings/revisions" style={{ gridColumn: 'span 1' }}>
            <EarningsMini theme={theme} rows={earnings} />
          </Panel>

          <Panel theme={theme} code="FRESH" title="data freshness · labels" style={{ gridColumn: 'span 1' }}>
            <FreshnessMini theme={theme} freshness={signal.freshness || memo.freshness || {}} error={payload.error} />
          </Panel>

          <Panel theme={theme} code="PAPR" title="paper order ticket" style={{ gridColumn: 'span 1' }}>
            <PaperTicketMini theme={theme} symbol={sym} price={ticker?.price || quote.close || 0} />
          </Panel>
        </div>
      </div>
    );
  }

  function ValuationMini({ theme, valuation = {} }) {
    const upside = Number(valuation.upsidePct || 0);
    const assumptions = valuation.assumptions || {};
    const rows = [
      ['FAIR', fmt.money(valuation.fairValue || 0)],
      ['UPSIDE', fmt.pct(upside)],
      ['BULL', fmt.money(valuation.bullValue || 0)],
      ['BEAR', fmt.money(valuation.bearValue || 0)],
      ['GROWTH', fmt.pct(assumptions.growth5yPct || 0)],
      ['DISCOUNT', fmt.pct(assumptions.discountRatePct || 0)],
    ];
    return (
      <div style={{ height: '100%', overflow: 'auto', fontSize: 10 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 2px', borderBottom: `1px dotted ${theme.border}` }}>
            <span style={{ color: theme.dim }}>{k}</span>
            <span style={{ color: k === 'UPSIDE' ? (upside >= 0 ? theme.up : theme.down) : theme.textBright, fontWeight: 800 }}>{v}</span>
          </div>
        ))}
        <div style={{ marginTop: 5, color: theme.warn, lineHeight: 1.3 }}>MODELED DCF-LITE · provider-ready</div>
      </div>
    );
  }

  function FundamentalsMini({ theme, fundamentals = {} }) {
    const multiples = fundamentals.multiples || {};
    const rows = [
      ['REV TTM', `$${Number(fundamentals.revenueTtmB || 0).toFixed(1)}B`],
      ['REV GR', fmt.pct(fundamentals.revenueGrowthPct || 0)],
      ['EPS TTM', Number(fundamentals.epsTtm || 0).toFixed(2)],
      ['EPS GR', fmt.pct(fundamentals.epsGrowthPct || 0)],
      ['OP MGN', fmt.pct(fundamentals.operatingMarginPct || 0)],
      ['ROE', fmt.pct(fundamentals.roePct || 0)],
      ['D/E', Number(fundamentals.debtToEquity || 0).toFixed(2)],
      ['P/E', Number(multiples.pe || 0).toFixed(1)],
      ['EV/EBITDA', Number(multiples.evEbitda || 0).toFixed(1)],
      ['PEG', Number(multiples.peg || 0).toFixed(2)],
    ];
    return (
      <div style={{ height: '100%', overflow: 'auto', fontSize: 10 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 6, padding: '2px 0', borderBottom: `1px dotted ${theme.border}` }}>
            <span style={{ color: theme.dim }}>{k}</span>
            <span style={{ color: theme.textBright, textAlign: 'right', fontWeight: 700 }}>{v}</span>
          </div>
        ))}
        {fundamentals.modeled && <div style={{ color: theme.warn, marginTop: 5 }}>MODELED UNTIL FUNDAMENTALS FEED CONNECTED</div>}
      </div>
    );
  }

  function RegimeMini({ theme, regime = {} }) {
    const state = regime.state || 'PENDING';
    const color = state === 'RISK_ON' ? theme.up : state === 'RISK_OFF' ? theme.down : theme.warn;
    const rows = [
      ['STATE', state],
      ['VOL', fmt.pct(regime.volatilityPct || 0)],
      ['BREADTH', fmt.pct(regime.breadthProxyPct || 0)],
      ['VS 50D', fmt.pct(regime.priceVs50dPct || 0)],
    ];
    return (
      <div style={{ height: '100%', overflow: 'auto', fontSize: 10 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 2px', borderBottom: `1px dotted ${theme.border}` }}>
            <span style={{ color: theme.dim }}>{k}</span>
            <span style={{ color: k === 'STATE' ? color : theme.text, fontWeight: 800 }}>{v}</span>
          </div>
        ))}
        {(regime.notes || []).slice(0, 2).map((note, i) => <div key={i} style={{ color: theme.dim, marginTop: 4 }}>{note}</div>)}
      </div>
    );
  }

  function StrategyMini({ theme, strategies = [] }) {
    return (
      <div style={{ height: '100%', overflow: 'auto', fontSize: 10 }}>
        {strategies.map((row) => (
          <div key={row.name} style={{ display: 'grid', gridTemplateColumns: '72px 1fr 34px', gap: 5, alignItems: 'center', padding: '3px 0', borderBottom: `1px dotted ${theme.border}` }}>
            <span style={{ color: theme.accent, fontWeight: 800 }}>{row.name}</span>
            <span style={{ color: theme.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.logic}</span>
            <span style={{ color: row.score >= 65 ? theme.up : row.score >= 45 ? theme.warn : theme.down, textAlign: 'right', fontWeight: 800 }}>{Number(row.score || 0).toFixed(0)}</span>
          </div>
        ))}
        {!strategies.length && <div style={{ color: theme.dim, padding: 8 }}>Strategy fit pending.</div>}
      </div>
    );
  }

  function EarningsMini({ theme, rows = [] }) {
    return (
      <div style={{ height: '100%', overflow: 'auto', fontSize: 10 }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '76px 1fr 34px', gap: 4, padding: '3px 0', borderBottom: `1px dotted ${theme.border}` }}>
            <span style={{ color: theme.dim }}>{String(row.date || '').slice(5) || '--'}</span>
            <span style={{ color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.event || row.symbol}</span>
            <span style={{ color: row.time === 'AMC' ? theme.accent2 : theme.warn, textAlign: 'right' }}>{row.time || '--'}</span>
          </div>
        ))}
        {!rows.length && <div style={{ color: theme.dim, padding: 8 }}>No event window loaded.</div>}
      </div>
    );
  }

  function PaperTicketMini({ theme, symbol, price }) {
    const [side, setSide] = React.useState('BUY');
    const [qty, setQty] = React.useState(10);
    const [orderType, setOrderType] = React.useState('MARKET');
    const [limitPrice, setLimitPrice] = React.useState('');
    const [status, setStatus] = React.useState('');
    const notional = Number(qty || 0) * Number(limitPrice || price || 0);
    const submit = async () => {
      setStatus('SENDING');
      try {
        const res = await fetch('/api/paper/order', {
          method: 'POST',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol, side, qty: Number(qty), orderType, limitPrice }),
        });
        const data = await res.json();
        setStatus(data.error ? data.detail || data.error : `${data.status} ${data.orderId}`);
      } catch (err) {
        setStatus(err.message || 'ORDER ERROR');
      }
    };
    const inputStyle = { background: theme.bg2, color: theme.text, border: `1px solid ${theme.border}`, fontFamily: theme.fontMono, fontSize: 10, padding: 3, minWidth: 0 };
    return (
      <div style={{ height: '100%', display: 'grid', gridTemplateRows: 'auto auto auto 1fr', gap: 5, fontSize: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {['BUY', 'SELL'].map(s => <button key={s} onClick={() => setSide(s)} style={{ background: side === s ? (s === 'BUY' ? theme.up : theme.down) : theme.panelHi, color: side === s ? theme.bg : theme.text, border: `1px solid ${theme.border}`, fontFamily: theme.fontMono, fontWeight: 900, cursor: 'pointer' }}>{s}</button>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          <select value={orderType} onChange={e => setOrderType(e.target.value)} style={inputStyle}>
            <option>MARKET</option>
            <option>LIMIT</option>
          </select>
          <input value={qty} onChange={e => setQty(e.target.value)} type="number" min="1" style={inputStyle} />
        </div>
        <input value={limitPrice} onChange={e => setLimitPrice(e.target.value)} placeholder={orderType === 'LIMIT' ? 'limit price' : `last ${fmt.money(price || 0)}`} style={inputStyle} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0 }}>
          <div style={{ color: theme.dim }}>NOTIONAL <span style={{ color: theme.textBright, float: 'right' }}>{fmt.money(notional || 0)}</span></div>
          <button onClick={submit} style={{ marginTop: 'auto', background: theme.accent, color: theme.bg, border: 'none', fontFamily: theme.fontMono, fontWeight: 900, padding: 4, cursor: 'pointer' }}>SEND PAPER</button>
          <div style={{ color: status.includes('ERROR') || status.includes('blocked') ? theme.down : theme.warn, minHeight: 24 }}>{status || 'Paper only · duplicate guard active'}</div>
        </div>
      </div>
    );
  }

  function FactorBars({ theme, factors = {} }) {
    const rows = Object.entries(factors);
    return (
      <div style={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '72px 1fr 34px', gap: 6, alignItems: 'center' }}>
            <span style={{ color: theme.dim, textTransform: 'uppercase' }}>{k}</span>
            <div style={{ height: 9, border: `1px solid ${theme.border}`, background: theme.bg2, position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, width: `${Math.max(0, Math.min(100, Number(v) || 0))}%`, background: Number(v) >= 70 ? theme.up : Number(v) >= 45 ? theme.warn : theme.down }} />
            </div>
            <span style={{ color: theme.text, textAlign: 'right', fontWeight: 700 }}>{Number(v || 0).toFixed(0)}</span>
          </div>
        ))}
        {!rows.length && <div style={{ color: theme.dim, padding: 8 }}>No factor payload yet.</div>}
      </div>
    );
  }

  function BacktestMini({ theme, backtest }) {
    const item = backtest?.items?.[0];
    const summary = backtest?.summary || {};
    const curve = backtest?.equityCurve || [];
    const points = curve.slice(-80);
    const values = points.map(p => Number(p.equity || 1));
    const min = Math.min(...values, 0.95);
    const max = Math.max(...values, 1.05);
    const poly = values.map((v, i) => {
      const x = values.length <= 1 ? 0 : (i / (values.length - 1)) * 100;
      const y = 34 - ((v - min) / Math.max(0.0001, max - min)) * 30;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return (
      <div style={{ fontSize: 10, height: '100%', overflow: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 5 }}>
          <div style={{ background: theme.bg2, border: `1px solid ${theme.border}`, padding: 6 }}>
            <div style={{ color: theme.dim, fontSize: 8 }}>90D RETURN</div>
            <div style={{ color: item?.returnPct >= 0 ? theme.up : theme.down, fontSize: 18, fontWeight: 900 }}>{item ? fmt.pct(item.returnPct) : '--'}</div>
          </div>
          <div style={{ background: theme.bg2, border: `1px solid ${theme.border}`, padding: 6 }}>
            <div style={{ color: theme.dim, fontSize: 8 }}>MAX DD / WIN</div>
            <div style={{ color: theme.text, fontWeight: 900 }}>{fmt.pct(summary.maxDrawdownPct || item?.maxDrawdownPct || 0)} / {Number(summary.winRatePct || 0).toFixed(0)}%</div>
          </div>
        </div>
        {!!values.length && (
          <svg viewBox="0 0 100 36" preserveAspectRatio="none" style={{ width: '100%', height: 42, border: `1px solid ${theme.border}`, background: theme.bg2, marginBottom: 5 }}>
            <polyline points={poly} fill="none" stroke={values[values.length - 1] >= values[0] ? theme.up : theme.down} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
          </svg>
        )}
        <div style={{ color: theme.dim, lineHeight: 1.35 }}>{backtest?.method || 'Backtest pending.'}</div>
        {(backtest?.guardrails || []).map((g, i) => <div key={i} style={{ color: theme.warn, marginTop: 3 }}>! {g}</div>)}
      </div>
    );
  }

  function SignalHistoryMini({ theme, rows = [] }) {
    return (
      <div style={{ height: '100%', overflow: 'auto', fontSize: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '68px 42px 42px 1fr', gap: 4, color: theme.dim, fontSize: 8, borderBottom: `1px solid ${theme.border}`, paddingBottom: 2 }}>
          <span>DATE</span><span>SCORE</span><span>CONF</span><span>STANCE</span>
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '68px 42px 42px 1fr', gap: 4, padding: '3px 0', borderBottom: `1px dotted ${theme.border}` }}>
            <span style={{ color: theme.dim }}>{String(r.createdAt || '').slice(5, 10)}</span>
            <span style={{ color: theme.text, textAlign: 'right' }}>{Number(r.score || 0).toFixed(1)}</span>
            <span style={{ color: theme.text, textAlign: 'right' }}>{Number(r.confidence || 0).toFixed(0)}</span>
            <span style={{ color: r.action === 'LONG_CANDIDATE' ? theme.up : r.action === 'AVOID' ? theme.down : theme.warn }}>{r.action}</span>
          </div>
        ))}
        {!rows.length && <div style={{ color: theme.dim, padding: 8 }}>No stored signal history yet.</div>}
      </div>
    );
  }

  function PeerMini({ theme, peers, onPick }) {
    return (
      <div style={{ height: '100%', overflow: 'auto', fontSize: 10 }}>
        {peers.slice(0, 10).map(p => {
          const sym = p.sym || p.symbol;
          const pct = p.pctChg ?? p.changePct ?? 0;
          const score = p.composite ?? p.score;
          return (
          <button key={sym} onClick={() => onPick(sym)} style={{
            display: 'grid', gridTemplateColumns: '54px 1fr 48px 34px', gap: 4,
            width: '100%', padding: '3px 2px', background: 'transparent',
            border: 'none', borderBottom: `1px dotted ${theme.border}`,
            fontFamily: theme.fontMono, fontSize: 10, cursor: 'pointer', textAlign: 'left',
          }}>
            <span style={{ color: theme.accent, fontWeight: 800 }}>{sym}</span>
            <span style={{ color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            <span style={{ color: pct >= 0 ? theme.up : theme.down, textAlign: 'right' }}>{fmt.pct(pct || 0)}</span>
            <span style={{ color: theme.warn, textAlign: 'right' }}>{score ? Number(score).toFixed(0) : '--'}</span>
          </button>
        );})}
        {!peers.length && <div style={{ color: theme.dim, padding: 8 }}>No peer set loaded yet.</div>}
      </div>
    );
  }

  function FreshnessMini({ theme, freshness = {}, error }) {
    const rows = [
      ['QUOTE', `${freshness.quoteDate || '--'} ${freshness.quoteTime || ''}`],
      ['HISTORY', freshness.historyThrough || '--'],
      ['NEWS', freshness.newsSource || 'google-news-rss'],
      ['SOURCE', freshness.quoteSource || 'yahoo-chart'],
    ];
    return (
      <div style={{ fontSize: 10, height: '100%', overflow: 'auto' }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 2px', borderBottom: `1px dotted ${theme.border}` }}>
            <span style={{ color: theme.dim }}>{k}</span>
            <span style={{ color: theme.text, textAlign: 'right' }}>{v}</span>
          </div>
        ))}
        <div style={{ marginTop: 8, padding: 6, border: `1px solid ${theme.border}`, background: theme.bg2, color: theme.warn, lineHeight: 1.35 }}>
          All modeled fields are labeled. This cockpit is free-data first until paid fundamentals/options feeds are connected.
        </div>
        {error && <div style={{ marginTop: 6, color: theme.down }}>{error}</div>}
      </div>
    );
  }

  function ResearchOSOverlay({ theme, symbol, ticker, market, allTickers = [], research = {}, onPick, onClose }) {
    const [tab, setTab] = React.useState('TICKER');
    const tabs = [['TICKER','Ticker Page'], ['AUDIT','Signal Audit'], ['LAB','Strategy Lab'], ['WATCH','Watchlist'], ['ALERTS','Alert Rules'], ['CAL','Calendar']];
    return (
      <div style={{ position: 'absolute', inset: 6, zIndex: 75, background: 'rgba(5,4,2,0.96)', border: `1px solid ${theme.borderHi}`, boxShadow: '0 20px 70px rgba(0,0,0,0.75)', color: theme.text, fontFamily: theme.fontMono, display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 36, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', borderBottom: `1px solid ${theme.borderHi}`, background: theme.bg2 }}>
          <span style={{ color: theme.accent, fontWeight: 900, letterSpacing: '0.08em' }}>RESEARCH OS</span>
          <span style={{ color: theme.dim }}>{symbol}</span>
          <div style={{ display: 'flex', gap: 3, marginLeft: 12 }}>
            {tabs.map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)} style={{ background: tab === key ? theme.accent : theme.panelHi, color: tab === key ? theme.bg : theme.text, border: `1px solid ${tab === key ? theme.accent : theme.border}`, fontFamily: theme.fontMono, fontSize: 10, fontWeight: 800, padding: '3px 8px', cursor: 'pointer' }}>{label}</button>
            ))}
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: theme.panelHi, color: theme.textBright, border: `1px solid ${theme.border}`, fontFamily: theme.fontMono, fontWeight: 900, padding: '3px 9px', cursor: 'pointer' }}>CLOSE</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, padding: 6 }}>
          {tab === 'TICKER' && <FullTickerPage theme={theme} symbol={symbol} ticker={ticker} market={market} research={research} onPick={onPick} />}
          {tab === 'AUDIT' && <SignalAuditScreen theme={theme} onPick={onPick} />}
          {tab === 'LAB' && <StrategyLabScreen theme={theme} onPick={onPick} />}
          {tab === 'WATCH' && <WatchCommandCenter theme={theme} tickers={allTickers} currentSym={symbol} onPick={onPick} />}
          {tab === 'ALERTS' && <AlertRulesScreen theme={theme} symbol={symbol} />}
          {tab === 'CAL' && <CalendarActionsScreen theme={theme} symbol={symbol} market={market} />}
        </div>
      </div>
    );
  }

  Object.assign(window, {
    Panel, HeaderBar, IndexRibbon, QuoteHeader, FactorScores, OrderBook, OptionsFlow,
    NewsFeed, InsiderTx, ShortInterest, SectorHeatmap, Watchlist, TopMovers,
    EarningsCal, EconCal, TradeIdeas, CorrMatrix, PortfolioPnL, RiskMetrics,
    SignalTrust, ProviderHealth, ResearchMemo, BacktestPanel, PaperTrading, TickerResearchModal, ResearchOSOverlay,
  });
})();
