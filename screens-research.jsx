// screens-research.jsx — Equity Research, Portfolio, AI Agents
// All screens take { theme, sym, setSym }
// window.{ResearchScreen, PortfolioScreen, AgentsScreen}

(function () {
  const { Panel, QuoteHeader } = window;
  const M = () => window.MarketData;

  const fmt = {
    money: (n, d = 2) => (n < 0 ? '-' : '') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }),
    big: (n) => n >= 1e12 ? '$' + (n/1e12).toFixed(2)+'T' : n >= 1e9 ? '$' + (n/1e9).toFixed(2)+'B' : n >= 1e6 ? '$' + (n/1e6).toFixed(1)+'M' : '$' + (n/1e3).toFixed(1)+'K',
    bigPlain: (n) => n >= 1e12 ? (n/1e12).toFixed(2)+'T' : n >= 1e9 ? (n/1e9).toFixed(2)+'B' : n >= 1e6 ? (n/1e6).toFixed(0)+'M' : (n/1e3).toFixed(0)+'K',
    pct: (n, d = 2) => (n >= 0 ? '+' : '') + n.toFixed(d) + '%',
  };

  // ═══════════════════════════════════════════════════════════
  // EQUITY RESEARCH SCREEN
  // ═══════════════════════════════════════════════════════════
  function ResearchScreen({ theme, sym, setSym }) {
    const t = M().BY_SYM[sym];
    const fin = React.useMemo(() => M().financialsFor(sym), [sym]);
    const dcf = React.useMemo(() => M().dcfFor(sym), [sym]);
    const peers = React.useMemo(() => M().peerCompsFor(sym), [sym]);
    const ratings = React.useMemo(() => M().ratingsFor(sym), [sym]);
    const earn = React.useMemo(() => M().earningsHistoryFor(sym), [sym]);
    const own = React.useMemo(() => M().ownershipFor(sym), [sym]);

    const [stmt, setStmt] = React.useState('INC');

    return (
      <div style={{
        height: '100%', display: 'grid', padding: 4, gap: 4,
        gridTemplateColumns: 'repeat(12, 1fr)',
        gridTemplateRows: '90px 1fr 1fr',
        background: theme.bg, color: theme.text, fontFamily: theme.fontMono,
      }}>
        {/* Top: Company header card */}
        <div style={{ gridColumn: 'span 12', gridRow: 'span 1', background: theme.panel, border: `1px solid ${theme.border}`, display: 'grid', gridTemplateColumns: '320px 1fr 280px 280px', gap: 1, fontSize: 10 }}>
          <div style={{ padding: 8, borderRight: `1px solid ${theme.border}` }}>
            <div style={{ color: theme.dim, fontSize: 9, letterSpacing: '0.08em' }}>EQUITY RESEARCH · DES</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: theme.textBright, letterSpacing: '0.02em', lineHeight: 1.1, marginTop: 2 }}>{t.sym}</div>
            <div style={{ color: theme.text, fontSize: 11, marginTop: 1 }}>{t.name}</div>
            <div style={{ color: theme.dim, fontSize: 9, marginTop: 4, letterSpacing: '0.05em' }}>
              {t.sector.toUpperCase()} · {t.industry.toUpperCase()}
            </div>
          </div>
          <div style={{ padding: 8, borderRight: `1px solid ${theme.border}` }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: theme.textBright, fontVariantNumeric: 'tabular-nums' }}>{fmt.money(t.price)}</span>
              <span style={{ color: t.pctChg >= 0 ? theme.up : theme.down, fontSize: 16, fontWeight: 700 }}>{fmt.pct(t.pctChg)}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginTop: 6, fontSize: 10 }}>
              {[['MKT CAP', fmt.big(t.mcap)], ['P/E TTM', t.pe.toFixed(1)], ['FWD P/E', t.fwdPe.toFixed(1)], ['EV/REV', (t.mcap/fin.income[4].rev).toFixed(1) + '×'],
                ['P/B', t.pb.toFixed(2)], ['DIV YLD', (t.div || 0).toFixed(2) + '%'], ['BETA', t.beta.toFixed(2)], ['52W', fmt.money(t.yLow) + '–' + fmt.money(t.yHigh)],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ color: theme.dim, fontSize: 8 }}>{k}</div>
                  <div style={{ color: theme.text, fontWeight: 700, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: 8, borderRight: `1px solid ${theme.border}` }}>
            <div style={{ color: theme.dim, fontSize: 9, letterSpacing: '0.08em', marginBottom: 4 }}>ANALYST CONSENSUS · {ratings.total} BANKS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ flex: 1, height: 22, background: theme.bg2, border: `1px solid ${theme.border}`, display: 'flex', overflow: 'hidden' }}>
                <div style={{ flex: ratings.buys, background: theme.up, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.bg, fontSize: 10, fontWeight: 800 }}>{ratings.buys}</div>
                <div style={{ flex: ratings.holds, background: theme.warn, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.bg, fontSize: 10, fontWeight: 800 }}>{ratings.holds}</div>
                <div style={{ flex: ratings.sells, background: theme.down, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.bg, fontSize: 10, fontWeight: 800 }}>{ratings.sells}</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <div>
                <div style={{ color: theme.dim, fontSize: 8 }}>AVG TARGET</div>
                <div style={{ color: theme.textBright, fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt.money(ratings.avgTarget)}</div>
              </div>
              <div>
                <div style={{ color: theme.dim, fontSize: 8 }}>IMPL UPSIDE</div>
                <div style={{ color: ratings.upside >= 0 ? theme.up : theme.down, fontSize: 16, fontWeight: 700 }}>{fmt.pct(ratings.upside)}</div>
              </div>
            </div>
          </div>
          <div style={{ padding: 8 }}>
            <div style={{ color: theme.dim, fontSize: 9, letterSpacing: '0.08em', marginBottom: 4 }}>DCF FAIR VALUE</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: theme.textBright, fontVariantNumeric: 'tabular-nums' }}>{fmt.money(dcf.fairValue)}</span>
              <span style={{ color: dcf.upside >= 0 ? theme.up : theme.down, fontSize: 13, fontWeight: 700 }}>{fmt.pct(dcf.upside)}</span>
            </div>
            <div style={{ color: theme.dim, fontSize: 9, marginTop: 4 }}>
              WACC {(dcf.assumptions.wacc*100).toFixed(1)}% · TERM g {(dcf.assumptions.terminalG*100).toFixed(1)}%
            </div>
            <div style={{ marginTop: 4, padding: '2px 4px', background: theme.bg2, border: `1px solid ${theme.border}`, fontSize: 9, color: dcf.upside > 15 ? theme.up : dcf.upside > -10 ? theme.warn : theme.down, fontWeight: 700 }}>
              VERDICT: {dcf.upside > 15 ? 'UNDERVALUED' : dcf.upside > -10 ? 'FAIRLY PRICED' : 'OVERVALUED'}
            </div>
          </div>
        </div>

        {/* Row 2: Financial statements (left), DCF detail (middle), Earnings surprises (right) */}
        <Panel theme={theme} code="STMT" title={`${sym} · FINANCIALS · USD M`}
          right={<div style={{ display: 'flex', gap: 2 }}>
            {[['INC','INCOME'], ['CF','CASH FLOW'], ['BS','BALANCE']].map(([k, l]) => (
              <button key={k} onClick={() => setStmt(k)} style={{
                padding: '0 6px', fontSize: 9, background: stmt === k ? theme.accent : 'transparent',
                color: stmt === k ? theme.bg : theme.dim, border: `1px solid ${stmt === k ? theme.accent : theme.border}`,
                cursor: 'pointer', fontFamily: theme.fontMono, fontWeight: 700,
              }}>{l}</button>
            ))}
          </div>}
          style={{ gridColumn: 'span 5', gridRow: 'span 1' }}>
          <FinTable theme={theme} fin={fin} stmt={stmt} />
        </Panel>

        <Panel theme={theme} code="DCF" title={`${sym} · DCF MODEL · 5Y EXPLICIT`}
          style={{ gridColumn: 'span 4', gridRow: 'span 1' }}>
          <DcfView theme={theme} dcf={dcf} t={t} />
        </Panel>

        <Panel theme={theme} code="EARN" title={`${sym} · EARNINGS · TTM-8Q`}
          style={{ gridColumn: 'span 3', gridRow: 'span 1' }}>
          <EarningsView theme={theme} earn={earn} />
        </Panel>

        {/* Row 3: Comps table, Analyst ratings, Ownership */}
        <Panel theme={theme} code="COMP" title={`${sym} · PEER COMPS`}
          style={{ gridColumn: 'span 5', gridRow: 'span 1' }}>
          <CompsTable theme={theme} t={t} peers={peers} onPick={setSym} />
        </Panel>

        <Panel theme={theme} code="RATE" title={`${sym} · ANALYST RATINGS`}
          right={<span>{ratings.total} ACTIVE</span>}
          style={{ gridColumn: 'span 4', gridRow: 'span 1' }}>
          <RatingsList theme={theme} ratings={ratings} t={t} />
        </Panel>

        <Panel theme={theme} code="HLDR" title={`${sym} · OWNERSHIP`}
          style={{ gridColumn: 'span 3', gridRow: 'span 1' }}>
          <OwnershipView theme={theme} own={own} t={t} />
        </Panel>
      </div>
    );
  }

  // Sub-panels
  function FinTable({ theme, fin, stmt }) {
    const rows = stmt === 'INC' ? [
      ['Revenue',          fin.income, 'rev'],
      ['COGS',             fin.income, 'cogs'],
      ['Gross Profit',     fin.income, 'gross'],
      ['Operating Exp',    fin.income, 'opex'],
      ['Operating Income', fin.income, 'opInc'],
      ['Interest Exp',     fin.income, 'intExp'],
      ['Tax',              fin.income, 'tax'],
      ['Net Income',       fin.income, 'netInc'],
      ['—',                null, null],
      ['Gross Margin %',   fin.income, 'grossM', 'pct'],
      ['Op Margin %',      fin.income, 'opM',    'pct'],
      ['Net Margin %',     fin.income, 'netM',   'pct'],
    ] : stmt === 'CF' ? [
      ['Operating CF',     fin.cash, 'opCF'],
      ['Investing CF',     fin.cash, 'invCF'],
      ['CapEx',            fin.cash, 'capex'],
      ['Financing CF',     fin.cash, 'finCF'],
      ['—',                null, null],
      ['Free Cash Flow',   fin.cash, 'fcf'],
    ] : [
      ['Cash',             fin.bs, 'cash'],
      ['Total Assets',     fin.bs, 'assets'],
      ['Total Debt',       fin.bs, 'debt'],
      ['Total Liabilities',fin.bs, 'liab'],
      ['Equity',           fin.bs, 'equity'],
      ['—',                null, null],
      ['Shares Out (M)',   fin.bs, 'shares'],
    ];
    return (
      <div style={{ fontSize: 10, fontFamily: theme.fontMono, height: '100%', overflow: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '140px repeat(5, 1fr)', gap: 2, padding: '0 4px 2px', color: theme.dim, fontSize: 8, letterSpacing: '0.05em', borderBottom: `1px solid ${theme.border}`, position: 'sticky', top: 0, background: theme.panel }}>
          <span>METRIC</span>
          {fin.income.map(y => <span key={y.year} style={{ textAlign: 'right' }}>{y.year}</span>)}
        </div>
        {rows.map((r, i) => {
          if (!r[1]) return <div key={i} style={{ borderTop: `1px dotted ${theme.border}`, margin: '3px 0' }} />;
          const [label, arr, key, type] = r;
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '140px repeat(5, 1fr)', gap: 2, padding: '2px 4px', borderBottom: `1px dotted ${theme.border}`, fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ color: theme.text }}>{label}</span>
              {arr.map((y, idx) => {
                const v = y[key];
                const prev = idx > 0 ? arr[idx-1][key] : null;
                const yoy = prev ? ((v - prev) / Math.abs(prev)) * 100 : 0;
                const display = type === 'pct' ? (v * 100).toFixed(1) + '%' : key === 'shares' ? (v/1e6).toFixed(0) : (v/1e6).toFixed(0);
                return (
                  <div key={idx} style={{ textAlign: 'right' }}>
                    <span style={{ color: theme.text }}>{display}</span>
                    {idx > 0 && Math.abs(yoy) > 0.5 && (
                      <div style={{ fontSize: 8, color: yoy >= 0 ? theme.up : theme.down }}>{fmt.pct(yoy, 1)}</div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  function DcfView({ theme, dcf, t }) {
    return (
      <div style={{ fontSize: 10, fontFamily: theme.fontMono, height: '100%', overflow: 'auto' }}>
        <div style={{ color: theme.dim, fontSize: 9, letterSpacing: '0.06em', marginBottom: 3 }}>ASSUMPTIONS</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, fontSize: 10, fontVariantNumeric: 'tabular-nums', marginBottom: 6 }}>
          {[
            ['Rev growth (5Y CAGR)', (dcf.assumptions.revGrowth5y.reduce((s,r)=>s+r,0)/5*100).toFixed(1) + '%'],
            ['Terminal growth',      (dcf.assumptions.terminalG*100).toFixed(1) + '%'],
            ['WACC',                 (dcf.assumptions.wacc*100).toFixed(1) + '%'],
            ['Operating margin',     (dcf.assumptions.opMargin*100).toFixed(1) + '%'],
            ['Tax rate',             (dcf.assumptions.taxRate*100).toFixed(1) + '%'],
            ['Shares out (M)',       (dcf.assumptions.shareCount/1e6).toFixed(0)],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 4px', background: theme.bg2, border: `1px solid ${theme.border}` }}>
              <span style={{ color: theme.dim, fontSize: 9 }}>{k}</span>
              <span style={{ color: theme.text, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ color: theme.dim, fontSize: 9, letterSpacing: '0.06em', marginBottom: 3 }}>PROJECTED FCF · USD M</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2, fontSize: 10, fontVariantNumeric: 'tabular-nums', marginBottom: 6 }}>
          {dcf.proj.map((p, i) => (
            <div key={i} style={{ padding: '3px 4px', background: theme.bg2, border: `1px solid ${theme.border}`, textAlign: 'center' }}>
              <div style={{ color: theme.dim, fontSize: 8 }}>Y{i+1}</div>
              <div style={{ color: theme.text, fontWeight: 700 }}>{(p/1e6).toFixed(0)}</div>
            </div>
          ))}
        </div>
        <div style={{ color: theme.dim, fontSize: 9, letterSpacing: '0.06em', marginBottom: 3 }}>VALUATION</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>
          {[
            ['PV of explicit FCF',   '$' + (dcf.pvProj/1e9).toFixed(2) + 'B'],
            ['Terminal value',       '$' + (dcf.tv/1e9).toFixed(2) + 'B'],
            ['PV of terminal',       '$' + (dcf.pvTv/1e9).toFixed(2) + 'B'],
            ['Enterprise value',     '$' + (dcf.ev/1e9).toFixed(2) + 'B'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 6px', borderBottom: `1px dotted ${theme.border}` }}>
              <span style={{ color: theme.dim }}>{k}</span>
              <span style={{ color: theme.text, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', background: theme.bg2, border: `1px solid ${theme.borderHi}`, marginTop: 4 }}>
            <span style={{ color: theme.warn, fontWeight: 700 }}>FAIR VALUE / SHARE</span>
            <span style={{ color: theme.textBright, fontWeight: 800, fontSize: 14 }}>${dcf.fairValue.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 6px' }}>
            <span style={{ color: theme.dim }}>vs Market</span>
            <span style={{ color: dcf.upside >= 0 ? theme.up : theme.down, fontWeight: 700 }}>{fmt.pct(dcf.upside)}</span>
          </div>
        </div>
      </div>
    );
  }

  function EarningsView({ theme, earn }) {
    const W = 240, H = 70;
    const maxAbs = Math.max(...earn.map(e => Math.abs(e.surprise)));
    return (
      <div style={{ fontSize: 10, fontFamily: theme.fontMono, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 70 }}>
          <line x1={0} x2={W} y1={H/2} y2={H/2} stroke={theme.border} strokeWidth={0.5} />
          {earn.map((e, i) => {
            const x = (i + 0.5) * (W / earn.length);
            const h = (Math.abs(e.surprise) / maxAbs) * (H/2 - 5);
            return (
              <g key={i}>
                <rect x={x - 8} y={e.surprise >= 0 ? H/2 - h : H/2}
                      width={16} height={h} fill={e.surprise >= 0 ? theme.up : theme.down} opacity={0.8} />
                <text x={x} y={H - 2} fill={theme.dim} fontSize={7} textAnchor="middle">{e.q}</text>
              </g>
            );
          })}
        </svg>
        <div style={{
          display: 'grid', gridTemplateColumns: '46px 38px 38px 44px', gap: 2,
          padding: '0 4px 2px', color: theme.dim, fontSize: 8, borderBottom: `1px solid ${theme.border}`,
        }}>
          <span>QTR</span><span style={{ textAlign: 'right' }}>EST</span><span style={{ textAlign: 'right' }}>ACT</span><span style={{ textAlign: 'right' }}>SURP</span>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {earn.map((e, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '46px 38px 38px 44px', gap: 2,
              padding: '2px 4px', borderBottom: `1px dotted ${theme.border}`,
              fontSize: 10, fontVariantNumeric: 'tabular-nums',
            }}>
              <span style={{ color: theme.text }}>{e.q}</span>
              <span style={{ color: theme.dim, textAlign: 'right' }}>{e.est.toFixed(2)}</span>
              <span style={{ color: theme.text, textAlign: 'right' }}>{e.actual.toFixed(2)}</span>
              <span style={{ color: e.surprise >= 0 ? theme.up : theme.down, textAlign: 'right', fontWeight: 700 }}>{fmt.pct(e.surprise, 1)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function CompsTable({ theme, t, peers, onPick }) {
    return (
      <div style={{ fontSize: 10, fontFamily: theme.fontMono, height: '100%', overflow: 'auto' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '48px 1fr 60px 40px 40px 40px 40px 32px 38px',
          gap: 4, padding: '0 4px 2px', color: theme.dim, fontSize: 8, letterSpacing: '0.05em',
          borderBottom: `1px solid ${theme.border}`,
        }}>
          <span>SYM</span><span>NAME</span><span style={{textAlign:'right'}}>MCAP</span>
          <span style={{textAlign:'right'}}>P/E</span><span style={{textAlign:'right'}}>FWD</span>
          <span style={{textAlign:'right'}}>P/B</span><span style={{textAlign:'right'}}>β</span>
          <span style={{textAlign:'right'}}>Q</span><span style={{textAlign:'right'}}>CHG%</span>
        </div>
        {peers.map((p, i) => (
          <button key={p.sym} onClick={() => onPick(p.sym)} style={{
            display: 'grid', gridTemplateColumns: '48px 1fr 60px 40px 40px 40px 40px 32px 38px',
            gap: 4, padding: '2px 4px', width: '100%',
            background: p.sym === t.sym ? theme.panelHi : 'transparent',
            borderBottom: `1px dotted ${theme.border}`, border: 'none',
            fontFamily: theme.fontMono, fontSize: 10, textAlign: 'left', cursor: 'pointer',
            fontVariantNumeric: 'tabular-nums',
          }}>
            <span style={{ color: p.sym === t.sym ? theme.warn : theme.accent, fontWeight: 700 }}>{p.sym}</span>
            <span style={{ color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 9 }}>{p.name}</span>
            <span style={{ color: theme.text, textAlign: 'right' }}>{fmt.bigPlain(p.mcap)}</span>
            <span style={{ color: theme.text, textAlign: 'right' }}>{p.pe.toFixed(1)}</span>
            <span style={{ color: theme.dim, textAlign: 'right' }}>{p.fwdPe.toFixed(1)}</span>
            <span style={{ color: theme.dim, textAlign: 'right' }}>{p.pb.toFixed(1)}</span>
            <span style={{ color: theme.dim, textAlign: 'right' }}>{p.beta.toFixed(2)}</span>
            <span style={{ color: p.composite >= 70 ? theme.up : p.composite >= 50 ? theme.warn : theme.down, textAlign: 'right', fontWeight: 700 }}>{p.composite}</span>
            <span style={{ color: p.pctChg >= 0 ? theme.up : theme.down, textAlign: 'right', fontWeight: 700 }}>{fmt.pct(p.pctChg)}</span>
          </button>
        ))}
      </div>
    );
  }

  function RatingsList({ theme, ratings, t }) {
    return (
      <div style={{ fontSize: 10, fontFamily: theme.fontMono, height: '100%', overflow: 'auto' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 70px 56px 42px 42px',
          gap: 4, padding: '0 4px 2px', color: theme.dim, fontSize: 8, letterSpacing: '0.05em',
          borderBottom: `1px solid ${theme.border}`,
        }}>
          <span>BANK</span><span>REC</span><span style={{textAlign:'right'}}>TARGET</span><span style={{textAlign:'right'}}>UPSIDE</span><span>DATE</span>
        </div>
        {ratings.list.map((r, i) => {
          const isBuy = /BUY|OUTPERFORM|OVERWEIGHT/.test(r.rec);
          const isSell = /SELL|UNDERPERFORM|UNDERWEIGHT/.test(r.rec);
          const c = isBuy ? theme.up : isSell ? theme.down : theme.warn;
          const upside = (r.target / t.price - 1) * 100;
          return (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1fr 70px 56px 42px 42px',
              gap: 4, padding: '2px 4px', borderBottom: `1px dotted ${theme.border}`,
              fontSize: 10, fontVariantNumeric: 'tabular-nums',
            }}>
              <span style={{ color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.bank}</span>
              <span style={{ color: c, fontWeight: 700, fontSize: 9 }}>{r.rec}</span>
              <span style={{ color: theme.text, textAlign: 'right' }}>{fmt.money(r.target)}</span>
              <span style={{ color: upside >= 0 ? theme.up : theme.down, textAlign: 'right', fontWeight: 700 }}>{fmt.pct(upside, 0)}</span>
              <span style={{ color: theme.dim }}>{r.date}</span>
            </div>
          );
        })}
      </div>
    );
  }

  function OwnershipView({ theme, own, t }) {
    return (
      <div style={{ fontSize: 10, fontFamily: theme.fontMono, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 16, display: 'flex', marginBottom: 6, border: `1px solid ${theme.border}` }}>
          <div style={{ width: (own.inst * 100) + '%', background: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: theme.bg, fontWeight: 800 }}>INST {(own.inst*100).toFixed(0)}%</div>
          <div style={{ width: (own.retail * 100) + '%', background: theme.warn, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: theme.bg, fontWeight: 800 }}>RTL {(own.retail*100).toFixed(0)}%</div>
          <div style={{ width: (own.insider * 100) + '%', background: theme.down, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: theme.bg, fontWeight: 800 }}>INS</div>
        </div>
        <div style={{ color: theme.dim, fontSize: 9, marginBottom: 3, letterSpacing: '0.06em' }}>TOP HOLDERS</div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {own.topHolders.map(([h, w], i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1fr 40px', gap: 4,
              padding: '2px 4px', borderBottom: `1px dotted ${theme.border}`,
              fontSize: 10,
            }}>
              <span style={{ color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h}</span>
              <span style={{ color: theme.dim, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(w * 100).toFixed(2)}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  Object.assign(window, { ResearchScreen, FinTable, DcfView, CompsTable, RatingsList, OwnershipView, EarningsView });
})();
