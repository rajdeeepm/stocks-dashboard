// dashboard.jsx — composes panels into the 1920×1400 terminal
// window.Dashboard

(function () {
  function Dashboard({ theme, initialTicker = 'NVDA' }) {
    const [sym, setSym] = React.useState(initialTicker);
    const [range, setRange] = React.useState('3M');
    const [showMA20, setShowMA20] = React.useState(true);
    const [showMA50, setShowMA50] = React.useState(true);
    const [showMA200, setShowMA200] = React.useState(false);
    const [showBB, setShowBB] = React.useState(false);
    const [now, setNow] = React.useState(() => new Date());
    const [liveVersion, setLiveVersion] = React.useState(0);
    const [market, setMarket] = React.useState('US');
    const [researchOpen, setResearchOpen] = React.useState(false);
    const [osOpen, setOsOpen] = React.useState(false);

    React.useEffect(() => {
      const t = setInterval(() => setNow(new Date()), 1000);
      return () => clearInterval(t);
    }, []);

    const M = window.MarketData;
    React.useEffect(() => {
      if (!M.liveInit) return undefined;
      return M.liveInit({
        initialSym: sym,
        initialMarket: market,
        onUpdate: () => setLiveVersion(v => v + 1),
      });
    }, []);

    React.useEffect(() => {
      if (M.refreshSymbolRange) M.refreshSymbolRange(sym, range);
      else if (M.refreshSymbol) M.refreshSymbol(sym);
      if (M.RESEARCH && M.RESEARCH.refresh) M.RESEARCH.refresh(sym);
    }, [sym, range]);

    const pickTicker = React.useCallback((nextSym) => {
      if (M.ensureTicker) M.ensureTicker(nextSym);
      setSym(nextSym);
    }, []);

    const pickMarket = React.useCallback((nextMarket) => {
      if (M.switchMarket) {
        M.switchMarket(nextMarket).then((firstSym) => {
          setMarket(nextMarket);
          if (firstSym) setSym(firstSym);
        }).catch(() => {
          setMarket(nextMarket);
        });
      } else {
        setMarket(nextMarket);
      }
    }, []);

    const t = M.BY_SYM[sym] || (M.ensureTicker ? M.ensureTicker(sym) : M.TICKERS[0]);
    const news = React.useMemo(() => M.newsFor(sym), [sym, liveVersion]);
    const insiders = React.useMemo(() => M.insidersFor(sym), [sym, liveVersion]);
    const flow = React.useMemo(() => M.optionsFlowFor(sym), [sym, liveVersion]);
    const research = React.useMemo(() => M.RESEARCH || {}, [liveVersion]);
    const marketTickers = React.useMemo(() => M.MARKET_TICKERS || M.TICKERS, [liveVersion, market]);
    const corrSyms = React.useMemo(() => marketTickers.slice(0, 12).map(t => t.sym), [marketTickers, liveVersion]);
    const corr = React.useMemo(() => M.buildCorrelation(corrSyms), [liveVersion, corrSyms.join('|')]);
    const trustCandidates = React.useMemo(() => {
      const merged = [...(research.signals || []), ...(M.TRADE_IDEAS || [])];
      const seen = new Set();
      return merged.filter((item) => {
        const symbol = item.symbol || item.sym || (item.trust && item.trust.symbol);
        if (!symbol || seen.has(symbol)) return false;
        seen.add(symbol);
        return true;
      });
    }, [research, liveVersion]);
    const earningsRows = React.useMemo(() => {
      const base = M.EARNINGS || [];
      const seen = new Set(base.map(row => row[1]));
      const extra = marketTickers
        .filter(ticker => ticker && ticker.sym && !seen.has(ticker.sym))
        .slice(0, 42)
        .map((ticker, i) => {
          const day = String(2 + (i % 24)).padStart(2, '0');
          const month = i < 24 ? '08' : '09';
          const eps = Math.max(0.05, Math.abs((ticker.price || 10) * 0.012));
          return [`${month}/${day}`, ticker.sym, ticker.name || ticker.sym, i % 2 ? 'AMC' : 'BMO', eps, 'Modeled calendar slot'];
        });
      return [...base, ...extra];
    }, [marketTickers, liveVersion]);

    const ranges = ['1D','5D','1M','3M','6M','YTD','1Y'];

    const C = window;

    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        background: theme.bg, color: theme.text,
        fontFamily: theme.fontMono, fontSize: 11,
        overflow: 'hidden',
        position: 'relative',
      }}>
        {theme.scanlines && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: `repeating-linear-gradient(0deg, transparent 0 2px, rgba(0,0,0,0.18) 2px 3px)`,
            zIndex: 100, mixBlendMode: 'multiply',
          }} />
        )}

        <C.HeaderBar theme={theme} ticker={t} onPickTicker={pickTicker} allTickers={M.SEARCH_TICKERS || marketTickers}
          markets={M.MARKETS || []} currentMarket={market} onPickMarket={pickMarket} marketMeta={M.MARKET_META}
          alerts={research.alerts || []} now={now} />
        <C.IndexRibbon theme={theme} indices={M.INDICES} />

        {/* Main grid */}
        <div style={{
          flex: 1, minHeight: 0, padding: 4,
          display: 'grid',
          gap: 4,
          gridTemplateColumns: 'repeat(12, 1fr)',
          gridTemplateRows: 'minmax(0, 36fr) minmax(0, 19fr) minmax(0, 19fr) minmax(0, 16fr) minmax(0, 10fr)',
        }}>
          {/* ─── HERO ROW ─────────────────────────────────────── */}
          <C.Panel theme={theme} code="CHRT" title={`${sym} · ${t.name}`}
            right={
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {ranges.map(r => (
                  <button key={r} onClick={() => setRange(r)} style={{
                    padding: '1px 6px', fontSize: 9, fontFamily: theme.fontMono,
                    background: range === r ? theme.accent : 'transparent',
                    color: range === r ? theme.bg : theme.dim,
                    border: `1px solid ${range === r ? theme.accent : theme.border}`,
                    cursor: 'pointer', fontWeight: 700, letterSpacing: '0.04em',
                  }}>{r}</button>
                ))}
                <button onClick={() => setResearchOpen(true)} style={{
                  padding: '1px 7px', fontSize: 9, fontFamily: theme.fontMono,
                  background: theme.panelHi, color: theme.textBright,
                  border: `1px solid ${theme.borderHi}`, cursor: 'pointer',
                  fontWeight: 800, letterSpacing: '0.04em',
                }}>DESK</button>
                <button onClick={() => setOsOpen(true)} style={{
                  padding: '1px 7px', fontSize: 9, fontFamily: theme.fontMono,
                  background: theme.panelHi, color: theme.textBright,
                  border: `1px solid ${theme.borderHi}`, cursor: 'pointer',
                  fontWeight: 800, letterSpacing: '0.04em',
                }}>OS</button>
                <span style={{ width: 1, height: 12, background: theme.border, margin: '0 2px' }} />
                {[['MA20', showMA20, setShowMA20], ['MA50', showMA50, setShowMA50], ['MA200', showMA200, setShowMA200], ['BB', showBB, setShowBB]].map(([l, on, set]) => (
                  <button key={l} onClick={() => set(!on)} style={{
                    padding: '1px 5px', fontSize: 9, fontFamily: theme.fontMono,
                    background: on ? theme.panelHi : 'transparent',
                    color: on ? theme.warn : theme.dim,
                    border: `1px solid ${on ? theme.warn : theme.border}`,
                    cursor: 'pointer', letterSpacing: '0.04em',
                  }}>{l}</button>
                ))}
              </div>
            }
            style={{ gridColumn: 'span 7' }} bodyStyle={{ padding: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <C.QuoteHeader theme={theme} t={t} />
              <div style={{ flex: 1, minHeight: 0 }}>
                <C.PriceChart ticker={t} theme={theme} range={range}
                  showMA20={showMA20} showMA50={showMA50} showMA200={showMA200} showBB={showBB} />
              </div>
            </div>
          </C.Panel>

          {/* Quote details + factor scores stack */}
          <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateRows: '170px 1fr', gap: 4, minHeight: 0 }}>
            <C.Panel theme={theme} code="QSCORE" title="Q-FACTOR · DECILE">
              <C.FactorScores theme={theme} t={t} />
            </C.Panel>
            <C.Panel theme={theme} code="RISK" title="RISK · BOOK">
              <C.RiskMetrics theme={theme} t={t} positions={M.PORTFOLIO} />
            </C.Panel>
          </div>

          {/* Order book + Options flow */}
          <div style={{ gridColumn: 'span 3', display: 'grid', gridTemplateRows: '1fr 1fr', gap: 4, minHeight: 0 }}>
            <C.Panel theme={theme} code="L2" title={`${sym} · ORDER BOOK`} right={<span>LIVE QUOTE · MOCK DEPTH</span>}>
              <C.OrderBook theme={theme} t={t} />
            </C.Panel>
            <C.Panel theme={theme} code="FLOW" title={`${sym} · OPTIONS FLOW`} right={<span>MODEL FLOW</span>}>
              <C.OptionsFlow theme={theme} flow={flow} />
            </C.Panel>
          </div>

          {/* ─── ROW 2 ────────────────────────────────────────── */}
          <C.Panel theme={theme} code="NEWS" title={`${sym} · WIRE`} right={<span>● LIVE</span>}
            style={{ gridColumn: 'span 4' }}>
            <C.NewsFeed theme={theme} news={news} ticker={t} />
          </C.Panel>

          <C.Panel theme={theme} code="TRUST" title="SIGNAL · TRUST STACK" right={<span>WEEKLY</span>}
            style={{ gridColumn: 'span 3' }}>
            <C.SignalTrust theme={theme} signals={trustCandidates} currentSym={sym} onPick={pickTicker} />
          </C.Panel>

          <C.Panel theme={theme} code="HLTH" title="PROVIDERS · HEALTH" right={<span>LIVE</span>}
            style={{ gridColumn: 'span 2' }}>
            <C.ProviderHealth theme={theme} providers={research.providers || []} />
          </C.Panel>

          <C.Panel theme={theme} code="MOVR" title="MARKET · MOVERS"
            style={{ gridColumn: 'span 3' }}>
            <C.TopMovers theme={theme} tickers={marketTickers} onPick={pickTicker} />
          </C.Panel>

          {/* ─── ROW 3 ────────────────────────────────────────── */}
          <C.Panel theme={theme} code="HEAT" title="SECTORS · S&P 500 WEIGHT · 1D"
            style={{ gridColumn: 'span 4' }} bodyStyle={{ padding: 2 }}>
            <C.SectorHeatmap theme={theme} sectors={M.SECTORS} />
          </C.Panel>

          <C.Panel theme={theme} code="WTCH" title="WATCHLIST · CUSTOM"
            right={<span>{marketTickers.length} SYM</span>}
            style={{ gridColumn: 'span 5' }}>
            <C.Watchlist theme={theme} tickers={marketTickers} currentSym={sym} onPick={pickTicker} />
          </C.Panel>

          <C.Panel theme={theme} code="EARN" title="EARNINGS · UPCOMING"
            style={{ gridColumn: 'span 3' }}>
            <C.EarningsCal theme={theme} list={earningsRows} currentSym={sym} onPick={pickTicker} />
          </C.Panel>

          {/* ─── ROW 4 ────────────────────────────────────────── */}
          <C.Panel theme={theme} code="MEMO" title={`${sym} · RESEARCH MEMO`}
            style={{ gridColumn: 'span 4' }}>
            <C.ResearchMemo theme={theme} summary={research.summary} />
          </C.Panel>

          <C.Panel theme={theme} code="IDEA" title="QUANT IDEAS · RANKED"
            right={<span>L/S · CONF</span>}
            style={{ gridColumn: 'span 4' }}>
            <C.TradeIdeas theme={theme} ideas={M.TRADE_IDEAS} onPick={pickTicker} currentSym={sym} />
          </C.Panel>

          <C.Panel theme={theme} code="CORR" title="CORRELATION · 90D"
            style={{ gridColumn: 'span 4' }}>
            <C.CorrMatrix theme={theme} symbols={corrSyms} matrix={corr} />
          </C.Panel>

          {/* ─── ROW 5 (full-width) ──────────────────────────── */}
          <C.Panel theme={theme} code="BOOK" title="PORTFOLIO · LIVE P&L"
            right={<span>10 POS · USD</span>}
            style={{ gridColumn: 'span 12' }}>
            <C.PortfolioPnL theme={theme} positions={M.PORTFOLIO} onPick={pickTicker} currentSym={sym} />
          </C.Panel>
        </div>
        {researchOpen && (
          <C.TickerResearchModal
            theme={theme}
            symbol={sym}
            ticker={t}
            market={market}
            allTickers={M.SEARCH_TICKERS || marketTickers}
            research={research}
            onPick={(nextSym) => { pickTicker(nextSym); }}
            onClose={() => setResearchOpen(false)}
          />
        )}
        {osOpen && (
          <C.ResearchOSOverlay
            theme={theme}
            symbol={sym}
            ticker={t}
            market={market}
            allTickers={M.SEARCH_TICKERS || marketTickers}
            research={research}
            onPick={(nextSym) => { pickTicker(nextSym); }}
            onClose={() => setOsOpen(false)}
          />
        )}
      </div>
    );
  }

  window.Dashboard = Dashboard;
})();
