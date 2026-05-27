// data.js — deterministic simulated market data
// Built around a small PRNG so every render is identical, but data looks alive.

(function () {
  const PRNG = (seed) => {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const hash = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  // Universe — diversified across sectors
  const UNIVERSE = [
    // Tech mega
    ['NVDA', 'NVIDIA Corp',            'Technology',      'Semiconductors',     950.42, 2.34e12],
    ['AAPL', 'Apple Inc',              'Technology',      'Consumer Hardware',  214.18, 3.28e12],
    ['MSFT', 'Microsoft Corp',         'Technology',      'Software',           432.07, 3.21e12],
    ['GOOGL','Alphabet Inc Cl A',      'Communication',   'Internet',           172.85, 2.14e12],
    ['AMZN', 'Amazon.com Inc',         'Consumer Disc',   'E-Commerce',         186.50, 1.94e12],
    ['META', 'Meta Platforms',         'Communication',   'Social Media',       506.32, 1.28e12],
    ['TSLA', 'Tesla Inc',              'Consumer Disc',   'Auto Mfg',           238.84, 759e9],
    ['AVGO', 'Broadcom Inc',           'Technology',      'Semiconductors',     1612.50,752e9],
    ['AMD',  'Adv Micro Devices',      'Technology',      'Semiconductors',     162.24, 262e9],
    ['ORCL', 'Oracle Corp',            'Technology',      'Software',           142.16, 391e9],
    ['CRM',  'Salesforce Inc',         'Technology',      'Software',           267.43, 259e9],
    ['ADBE', 'Adobe Inc',              'Technology',      'Software',           526.81, 234e9],
    ['NFLX', 'Netflix Inc',            'Communication',   'Media',              672.18, 290e9],
    // Financials
    ['JPM',  'JPMorgan Chase',         'Financials',      'Banks',              210.34, 604e9],
    ['BAC',  'Bank of America',        'Financials',      'Banks',              42.18,  327e9],
    ['GS',   'Goldman Sachs',          'Financials',      'Inv Banking',        494.07, 161e9],
    ['MS',   'Morgan Stanley',         'Financials',      'Inv Banking',        102.43, 167e9],
    ['BLK',  'BlackRock Inc',          'Financials',      'Asset Mgmt',         842.18, 125e9],
    ['V',    'Visa Inc',               'Financials',      'Payments',           281.27, 542e9],
    // Energy / Materials
    ['XOM',  'Exxon Mobil',            'Energy',          'Integrated Oil',     115.43, 510e9],
    ['CVX',  'Chevron Corp',           'Energy',          'Integrated Oil',     157.91, 290e9],
    // Healthcare
    ['LLY',  'Eli Lilly & Co',         'Healthcare',      'Pharma',             786.23, 745e9],
    ['JNJ',  'Johnson & Johnson',      'Healthcare',      'Pharma',             148.05, 357e9],
    ['UNH',  'UnitedHealth Group',     'Healthcare',      'Managed Care',       512.45, 472e9],
    // Consumer Staples
    ['PG',   'Procter & Gamble',       'Cons Staples',    'Household Prod',     169.84, 400e9],
    ['KO',   'Coca-Cola Co',           'Cons Staples',    'Beverages',          63.71,  274e9],
    ['WMT',  'Walmart Inc',            'Cons Staples',    'Retail',             68.42,  551e9],
    // Industrials / Misc
    ['CAT',  'Caterpillar Inc',        'Industrials',     'Machinery',          347.12, 169e9],
    ['BA',   'Boeing Co',              'Industrials',     'Aerospace',          185.34, 113e9],
    ['DIS',  'Walt Disney Co',         'Communication',   'Entertainment',      102.18, 186e9],
  ];

  // Index ribbon
  const INDICES = [
    ['SPX',   'S&P 500',          5478.32,  +0.34],
    ['NDX',   'Nasdaq 100',       19682.50, +0.62],
    ['DJI',   'Dow Jones',        39124.18, -0.12],
    ['RUT',   'Russell 2000',     2032.84,  -0.41],
    ['VIX',   'CBOE Volatility',  13.42,    -2.18],
    ['DXY',   'Dollar Index',     105.84,   +0.08],
    ['US10Y', 'US 10Y Yield',     4.265,    +0.024],
    ['GOLD',  'Gold Spot',        2338.20,  +0.42],
    ['WTI',   'WTI Crude',        81.74,    +1.07],
    ['BTC',   'Bitcoin',          64842,    -1.84],
  ];

  // Sectors with weights/perf
  const SECTORS = [
    ['Technology',     32.4, +0.84],
    ['Financials',     13.2, -0.14],
    ['Healthcare',     12.8, +0.31],
    ['Consumer Disc',  10.4, +0.42],
    ['Communication',  9.1,  +0.67],
    ['Industrials',    8.2,  -0.21],
    ['Cons Staples',   5.8,  +0.08],
    ['Energy',         4.2,  -1.32],
    ['Utilities',      2.4,  +0.18],
    ['Real Estate',    2.2,  -0.42],
    ['Materials',      2.3,  -0.84],
  ];

  window.MarketData = {
    INDICES, SECTORS, PRNG, hash,
  };
})();
