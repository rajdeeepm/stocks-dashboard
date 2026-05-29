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

  Object.assign(window, {
    Panel,
  });
})();
