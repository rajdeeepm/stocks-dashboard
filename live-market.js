// live-market.js - live data bridge for the restored Phosphor design.
// Keeps the prototype's object shape, but refreshes it from the local API.
(function () {
  const M = window.MarketData;
  if (!M) return;

  const CORE_SYMBOLS = [
    "NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "AVGO", "AMD", "ORCL",
    "CRM", "ADBE", "NFLX", "JPM", "BAC", "GS", "MS", "BLK", "V", "XOM",
    "CVX", "LLY", "JNJ", "UNH", "PG", "KO", "WMT", "CAT", "BA", "DIS",
  ];
  const MARKET_CONFIG = {
    US: { name: "United States", currency: "USD", symbols: CORE_SYMBOLS, defaultSymbol: "NVDA", indices: [["SPX", "SPY"], ["NDX", "QQQ"], ["DJI", "DIA"], ["RUT", "IWM"]] },
    INDIA: { name: "India", currency: "INR", symbols: ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS", "BHARTIARTL.NS", "SBIN.NS", "LT.NS", "ITC.NS", "MARUTI.NS", "NESTLEIND.NS", "TITAN.NS"], defaultSymbol: "RELIANCE.NS", indices: [["NIFTY", "^NSEI"], ["SENSEX", "^BSESN"]] },
    JAPAN: { name: "Japan", currency: "JPY", symbols: ["7203.T", "6758.T", "9984.T", "8306.T", "6861.T", "8035.T", "6098.T", "9432.T", "6501.T", "8058.T"], defaultSymbol: "7203.T", indices: [["N225", "^N225"], ["TOPX", "1306.T"]] },
    UK: { name: "United Kingdom", currency: "GBP", symbols: ["AZN.L", "SHEL.L", "HSBA.L", "ULVR.L", "BP.L", "GSK.L", "RIO.L", "DGE.L", "LSEG.L", "BARC.L"], defaultSymbol: "AZN.L", indices: [["FTSE", "^FTSE"], ["UKX", "ISF.L"]] },
    EUROPE: { name: "Europe", currency: "EUR/CHF", symbols: ["ASML.AS", "MC.PA", "SAP.DE", "SIE.DE", "AIR.PA", "OR.PA", "SAN.PA", "NESN.SW", "NOVN.SW", "ROG.SW"], defaultSymbol: "ASML.AS", indices: [["STOXX", "^STOXX50E"], ["DAX", "^GDAXI"], ["CAC", "^FCHI"]] },
    HONGKONG: { name: "Hong Kong / China", currency: "HKD/CNY", symbols: ["0700.HK", "9988.HK", "3690.HK", "0939.HK", "1299.HK", "1810.HK", "2318.HK", "9618.HK", "0005.HK", "0388.HK"], defaultSymbol: "0700.HK", indices: [["HSI", "^HSI"], ["HSCEI", "^HSCE"]] },
    CANADA: { name: "Canada", currency: "CAD", symbols: ["RY.TO", "TD.TO", "SHOP.TO", "ENB.TO", "CNR.TO", "BNS.TO", "BAM.TO", "CNQ.TO", "SU.TO", "TRI.TO"], defaultSymbol: "RY.TO", indices: [["TSX", "^GSPTSE"], ["XIU", "XIU.TO"]] },
    AUSTRALIA: { name: "Australia", currency: "AUD", symbols: ["BHP.AX", "CBA.AX", "CSL.AX", "NAB.AX", "WBC.AX", "ANZ.AX", "MQG.AX", "WES.AX", "WOW.AX", "RIO.AX"], defaultSymbol: "BHP.AX", indices: [["ASX", "^AXJO"], ["A200", "A200.AX"]] },
  };
  const INDEX_PROXY = {
    SPX: "SPY",
    NDX: "QQQ",
    DJI: "DIA",
    RUT: "IWM",
  };
  const SECTOR_MAP = {
    Technology: ["NVDA", "AAPL", "MSFT", "AVGO", "AMD", "ORCL", "CRM", "ADBE"],
    Financials: ["JPM", "BAC", "GS", "MS", "BLK", "V"],
    Healthcare: ["LLY", "JNJ", "UNH"],
    "Consumer Disc": ["AMZN", "TSLA"],
    Communication: ["GOOGL", "META", "NFLX", "DIS"],
    Industrials: ["CAT", "BA"],
    "Cons Staples": ["PG", "KO", "WMT"],
    Energy: ["XOM", "CVX"],
  };

  const state = {
    initialized: false,
    refreshing: false,
    market: "US",
    markets: Object.entries(MARKET_CONFIG).map(([id, cfg]) => ({ id, name: cfg.name, currency: cfg.currency, count: cfg.symbols.length })),
    marketUniverse: [],
    listeners: new Set(),
    universe: [],
    liveNews: {},
    providers: [],
    signals: [],
    researchSummary: null,
    backtest: null,
    portfolio: null,
    paperJournal: [],
    alerts: [],
    alertRules: [],
    portfolioRanking: [],
    sectorMap: [],
    liveVersion: 0,
    lastStatus: "BOOT",
  };

})();
