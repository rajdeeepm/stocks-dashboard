// data-signals.js — live signal engine, regime classifier, weekly cycle
// Adds: signals[], regime{}, weeklyCycle{}, rotation matrix

(function () {
  const M = window.MarketData;
  if (!M) return;
  const { PRNG, hash, BY_SYM, TICKERS } = M;

  // ─── REGIME CLASSIFIER ─────────────────────────────────────────
  // Four-axis market regime classification with the indicators feeding it
  const REGIME = {
    asOf: '2026-05-25T16:00:00Z',
    axes: {
      risk:   { value: 'RISK_ON',     score:  62, prev: 48, label: 'RISK · ON',     trend: '+14' },
      growth: { value: 'EXPANSION',   score:  58, prev: 54, label: 'GROWTH · EXP',  trend: '+4' },
      rates:  { value: 'FALLING',     score: -38, prev: -22, label: 'RATES · ↓',     trend: '-16' },
      vol:    { value: 'LOW',         score: -42, prev: -28, label: 'VOL · LOW',     trend: '-14' },
    },
    indicators: [
      ['VIX',                  13.42,  -2.18, 'LOW',         'risk-on confirms'],
      ['SPX vs 200DMA',        '+8.4%', 0.18, 'BULL TREND',  'long bias intact'],
      ['Advance/Decline',      '+1.62', 0.4,  'BREADTH OK',  'broad participation'],
      ['HY OAS (bps)',         312,    -8,    'TIGHTENING',  'credit confirming'],
      ['DXY',                  105.84,  0.08, 'STABLE',      'dollar neutral'],
      ['10Y - 2Y (bps)',       -36,    +4,    'INVERTED',    'still tight, easing'],
      ['Copper/Gold',          0.194,  +1.4,  'RISING',      'growth signal pos'],
      ['Put/Call',             0.82,   -3.2,  'COMPLACENT',  'sentiment frothy'],
      ['Fed Funds Path',       '4.25%',-25,   'CUT BIAS',    'easing priced in'],
      ['Earnings Revisions',   '+2.4%', 0.6,  'IMPROVING',   'fundamentals up'],
      ['HF Net Lev',           '187%', +4,    'STRETCHED',   'positioning long'],
      ['Volatility Carry',     '+8.2%',+1.2,  'POSITIVE',    'short-vol working'],
    ],
    // Sector rotation prescription given regime
    rotation: {
      overweight: ['Technology', 'Communication', 'Consumer Disc', 'Financials'],
      neutral:    ['Industrials', 'Healthcare'],
      underweight:['Cons Staples', 'Utilities', 'Real Estate', 'Energy', 'Materials'],
    },
    // Factor tilts
    factors: {
      momentum: 'OVERWEIGHT',
      quality:  'OVERWEIGHT',
      growth:   'NEUTRAL',
      value:    'UNDERWEIGHT',
      lowVol:   'UNDERWEIGHT',
      size:     'NEUTRAL',
    },
    // History — last 12 weeks of risk-on score (for sparkline)
    history: [22, 18, 24, 31, 28, 35, 42, 38, 44, 48, 56, 62],
    // Current playbook
    playbook: [
      'Tilt long mega-cap secular winners (NVDA, AVGO, MSFT, META)',
      'Underweight defensives and yield proxies',
      'Add cyclicals on dips (industrials, financials)',
      'Trim vol-targeting hedges; reduce SPX puts',
      'Watch for breadth divergence — risk of unwind at SPX > 5500',
    ],
    risks: [
      'PCE deflator print 6/28 above 2.8% reverses cut path',
      'Mag-7 concentration breaks (any of top-5 < 50DMA = de-risk)',
      'HY OAS through 350bps = full risk-off',
    ],
  };

  // ─── SIGNAL ENGINE ─────────────────────────────────────────────
  // Methodologies define what each signal "framework" looks for
  const METHODS = {
    MOM_BREAKOUT: {
      label: 'MOMENTUM · BREAKOUT',
      desc: '52-week high break with volume confirmation',
      regimeFit: ['RISK_ON', 'EXPANSION', 'LOW'],
      typicalHold: 30,
    },
    MOM_PULLBACK: {
      label: 'MOMENTUM · PULLBACK',
      desc: 'Uptrend reasserts after shallow retrace',
      regimeFit: ['RISK_ON', 'EXPANSION'],
      typicalHold: 18,
    },
    QLT_COMPOUND: {
      label: 'QUALITY · COMPOUNDER',
      desc: 'High ROIC, durable moat, reasonable price',
      regimeFit: ['ANY'],
      typicalHold: 180,
    },
    VAL_DEEP: {
      label: 'VALUE · DEEP',
      desc: 'P/E < sector median, FCF positive, low debt',
      regimeFit: ['RISK_OFF', 'CONTRACTION', 'STABLE'],
      typicalHold: 120,
    },
    EARN_DRIFT: {
      label: 'EARNINGS · PEAD',
      desc: 'Post-earnings drift after positive surprise',
      regimeFit: ['ANY'],
      typicalHold: 22,
    },
    MEAN_REV: {
      label: 'MEAN REVERSION · OVERSOLD',
      desc: 'RSI < 30 in uptrending stock',
      regimeFit: ['LOW', 'NORMAL'],
      typicalHold: 8,
    },
    SHORT_BUST: {
      label: 'SHORT · BREAKDOWN',
      desc: 'Failed breakout + deteriorating fundamentals',
      regimeFit: ['RISK_OFF', 'ELEVATED'],
      typicalHold: 30,
    },
    PAIRS: {
      label: 'PAIRS · RELATIVE VALUE',
      desc: 'Same-sector dispersion mean-revert',
      regimeFit: ['LOW', 'NORMAL'],
      typicalHold: 14,
    },
    EVENT_MA: {
      label: 'EVENT · M&A ARB',
      desc: 'Announced deal trading wide of fair spread',
      regimeFit: ['ANY'],
      typicalHold: 60,
    },
  };

  // Generate a deterministic set of "live" signals across the universe
  function generateSignals() {
    const out = [];
    const dates = ['05/22', '05/21', '05/19', '05/19', '05/16', '05/15', '05/15', '05/14', '05/12', '05/12', '05/09', '05/09', '05/08', '05/06', '05/05', '05/02', '05/01', '04/28', '04/24', '04/22', '04/19', '04/16'];
    const cfg = [
      ['NVDA',  'LONG',  'MOM_BREAKOUT',  92, 882,  'Blackwell ramp + Mag7 concentration tailwind'],
      ['AVGO',  'LONG',  'QLT_COMPOUND',  88, 1480, 'AI accelerator share + VMware accretion track-record'],
      ['META',  'LONG',  'MOM_PULLBACK',  84, 472,  'Reels mon. + capex ROI emerging; 20DMA retest'],
      ['LLY',   'LONG',  'QLT_COMPOUND',  86, 730,  'GLP-1 capacity expand; Q3 script accel via IQVIA'],
      ['MSFT',  'LONG',  'QLT_COMPOUND',  82, 398,  'Copilot ARR run-rate inflecting; ent seat saturation low'],
      ['GS',    'LONG',  'MOM_PULLBACK',  78, 462,  'IB rebound + trading franchise op leverage'],
      ['AMD',   'LONG',  'EARN_DRIFT',    72, 142,  'PEAD setup; MI325 traction; FY guide raise potential'],
      ['JPM',   'LONG',  'QLT_COMPOUND',  74, 192,  'NII raised; loan growth normalizing; PE rerate room'],
      ['NFLX',  'LONG',  'MOM_BREAKOUT',  76, 605,  'Ad tier monetization inflecting; live-sports flywheel'],
      ['ORCL',  'LONG',  'EARN_DRIFT',    70, 126,  'OCI growth re-accel; RPO bookings strong'],
      ['CRM',   'LONG',  'MEAN_REV',      66, 245,  'RSI 28 in uptrend; AgentForce catalyst pipeline'],
      ['V',     'LONG',  'QLT_COMPOUND',  72, 260,  'Cross-border travel volumes; secular comp'],
      ['TSLA',  'SHORT', 'SHORT_BUST',    81, 264,  'Demand pressure + robotaxi delay; consensus too high'],
      ['BA',    'SHORT', 'SHORT_BUST',    74, 198,  'FAA caps + ops; order weakness; FCF impaired'],
      ['KO',    'SHORT', 'SHORT_BUST',    68, 67,   'Defensives rolling on real-rate reset; bond proxy'],
      ['XOM',   'SHORT', 'MEAN_REV',      62, 124,  'Crude topping; demand softening; mean-revert'],
      ['INTC',  'SHORT', 'SHORT_BUST',    66, 32,   'Foundry losses; share donor to AMD/TSM'],
      ['DIS',   'SHORT', 'SHORT_BUST',    58, 112,  'DTC plateau + sports rights inflation'],
      ['AAPL',  'LONG',  'PAIRS',         54, 198,  'Long AAPL / Short DIS — Mag7 dispersion narrow'],
      ['CAT',   'LONG',  'MOM_PULLBACK',  68, 322,  'Cyclical reaccel; backlog inflecting'],
      ['CVX',   'SHORT', 'PAIRS',         60, 168,  'Short CVX / Long XOM-like — energy dispersion'],
      ['UNH',   'LONG',  'VAL_DEEP',      64, 482,  'Sentiment trough; MA growth resilient'],
    ];

    cfg.forEach(([sym, side, methodKey, conf, stopVal, thesis], i) => {
      const t = BY_SYM[sym];
      if (!t) return;
      const m = METHODS[methodKey];
      const rng = PRNG(hash(sym + methodKey));
      const dateGen = dates[i] || '05/01';
      const ageDays = 35 - i;
      const entryPrice = side === 'LONG'
        ? stopVal * (1.04 + rng() * 0.10)
        : stopVal * (0.86 + rng() * 0.10);
      const target = side === 'LONG'
        ? entryPrice * (1.08 + (conf/100) * 0.20)
        : entryPrice * (0.92 - (conf/100) * 0.18);
      const pnlPct = side === 'LONG'
        ? ((t.price - entryPrice) / entryPrice) * 100
        : ((entryPrice - t.price) / entryPrice) * 100;
      // Status logic
      let status = 'LIVE';
      if (side === 'LONG') {
        if (t.price >= target) status = 'HIT_TP';
        else if (t.price <= stopVal) status = 'HIT_SL';
      } else {
        if (t.price <= target) status = 'HIT_TP';
        else if (t.price >= stopVal) status = 'HIT_SL';
      }
      const halfLife = m.typicalHold;
      const decayFactor = Math.exp(-Math.log(2) * ageDays / halfLife);
      const currConf = Math.round(conf * decayFactor);
      if (ageDays > m.typicalHold * 2 && status === 'LIVE') status = 'EXPIRED';
      if (ageDays > halfLife && status === 'LIVE') status = 'DECAYING';
      // Evidence (the "show your work")
      const evidence = buildEvidence(t, methodKey, side, rng);
      // Regime fit score
      const regFit = m.regimeFit.includes('ANY') ? 100 :
        m.regimeFit.filter(r => Object.values(REGIME.axes).some(a => a.value === r)).length * 33;
      out.push({
        id: 'SIG-' + String(i + 1).padStart(3, '0'),
        sym, side, method: methodKey,
        methodLabel: m.label,
        dateGen, ageDays,
        entry: +entryPrice.toFixed(2),
        stop:  +stopVal.toFixed(2),
        target:+target.toFixed(2),
        last:  +t.price.toFixed(2),
        confInit: conf,
        confCurr: currConf,
        regimeFit: regFit,
        thesis,
        evidence,
        status,
        pnlPct: +pnlPct.toFixed(2),
        horizonDays: m.typicalHold,
        rr: +Math.abs((target - entryPrice) / (entryPrice - stopVal)).toFixed(2),
      });
    });
    return out;
  }

  function buildEvidence(t, method, side, rng) {
    const ev = [];
    const ok = (label, value, thresh, pass) => ev.push({ label, value, thresh, pass });
    switch (method) {
      case 'MOM_BREAKOUT':
        ok('52w high proximity', `${((t.price/t.yHigh)*100).toFixed(1)}%`, '>97%', (t.price/t.yHigh)>0.97);
        ok('Momentum factor',     t.factors.momentum, '>70', t.factors.momentum > 70);
        ok('Volume vs avg',       `${(t.volume/t.avgVol).toFixed(2)}×`, '>1.2×', t.volume/t.avgVol > 1.2);
        ok('Q-composite',         t.composite, '>65', t.composite > 65);
        ok('Regime: RISK_ON',     REGIME.axes.risk.value, '=RISK_ON', REGIME.axes.risk.value === 'RISK_ON');
        break;
      case 'MOM_PULLBACK':
        ok('In uptrend (200DMA)', 'YES', '=YES', true);
        ok('Pullback depth',      '5-8%', '<10%', true);
        ok('Momentum factor',     t.factors.momentum, '>60', t.factors.momentum > 60);
        ok('RSI(14)',             Math.round(40+rng()*15), '40-55', true);
        break;
      case 'QLT_COMPOUND':
        ok('Quality factor',      t.factors.quality, '>70', t.factors.quality > 70);
        ok('ROIC est',            `${Math.round(15+rng()*25)}%`, '>15%', true);
        ok('FCF margin',          `${Math.round(20+rng()*15)}%`, '>15%', true);
        ok('Net debt/EBITDA',     `${(rng()*1.2).toFixed(1)}×`, '<2×', true);
        ok('5Y rev CAGR',         `${Math.round(12+rng()*18)}%`, '>10%', true);
        break;
      case 'VAL_DEEP':
        ok('P/E vs sector',       `${t.pe.toFixed(1)}× / ${(t.pe*1.4).toFixed(1)}×`, '<sector', true);
        ok('FCF yield',           `${(rng()*4+3).toFixed(1)}%`, '>4%', true);
        ok('Net debt position',   'NET CASH', 'NET CASH', rng() > 0.4);
        ok('Insider buying',      rng() > 0.5 ? 'YES' : 'NO', 'YES', rng() > 0.5);
        break;
      case 'EARN_DRIFT':
        ok('Last EPS surprise',   `+${(8 + rng()*22).toFixed(1)}%`, '>5%', true);
        ok('Guide raise',         'YES',  'YES', true);
        ok('Days since report',   Math.round(3 + rng()*14), '<22', true);
        ok('Momentum factor',     t.factors.momentum, '>50', true);
        break;
      case 'MEAN_REV':
        ok('RSI(14)',             Math.round(22+rng()*8), '<30', true);
        ok('Above 200DMA',        'YES', 'YES', true);
        ok('Vol regime',          'LOW',  'LOW/NORMAL', true);
        ok('No earnings ≤30d',    'CLEAR', 'CLEAR', true);
        break;
      case 'SHORT_BUST':
        ok('Failed breakout',     'YES',  'YES', true);
        ok('Momentum factor',     t.factors.momentum, '<40', t.factors.momentum < 50);
        ok('Earnings revisions',  'NEG',  'NEG', true);
        ok('Short interest',      `${t.shortPct}%`, '<10%', t.shortPct < 10);
        ok('Borrow available',    'YES', 'YES', true);
        break;
      case 'PAIRS':
        ok('Z-score (60d)',       `${(side==='LONG'?-1:+1) * (1.8 + rng()*0.5)}σ`, '±2σ', true);
        ok('Cointegration p',     `${(rng()*0.04).toFixed(3)}`, '<0.05', true);
        ok('Same sector',         'YES', 'YES', true);
        break;
      case 'EVENT_MA':
        ok('Deal spread',         `${(2 + rng()*6).toFixed(1)}%`, 'wide', true);
        ok('Close prob',          `${Math.round(80+rng()*15)}%`, '>75%', true);
        ok('Days to close',       Math.round(40+rng()*120), 'manageable', true);
        break;
      default:
        ok('Q-composite', t.composite, '>50', t.composite > 50);
    }
    return ev;
  }

  const SIGNALS = generateSignals();

  // Aggregate stats
  function signalStats(signals) {
    const live    = signals.filter(s => s.status === 'LIVE');
    const decay   = signals.filter(s => s.status === 'DECAYING');
    const hitTp   = signals.filter(s => s.status === 'HIT_TP');
    const hitSl   = signals.filter(s => s.status === 'HIT_SL');
    const expired = signals.filter(s => s.status === 'EXPIRED');
    const closed  = [...hitTp, ...hitSl, ...expired];
    const winRate = closed.length ? (hitTp.length / closed.length) * 100 : 0;
    const avgPnL  = signals.length ? signals.reduce((s, x) => s + x.pnlPct, 0) / signals.length : 0;
    const grossPnL = signals.reduce((s, x) => s + x.pnlPct, 0);
    return { total: signals.length, live: live.length, decay: decay.length, hitTp: hitTp.length, hitSl: hitSl.length, expired: expired.length, winRate, avgPnL, grossPnL };
  }

  // ─── WEEKLY CYCLE ──────────────────────────────────────────────
  const WEEKLY = {
    weekOf: 'WEEK 21 · MAY 18-22, 2026',
    today: 'MON',  // Monday is screen day
    days: [
      {
        key: 'MON',
        label: 'SCREEN',
        title: 'Universe Scan',
        purpose: 'Run quant screens across full universe. Output: candidate longlist for Tuesday.',
        tasks: [
          { done: true,  text: 'Refresh prices, factors, fundamentals (auto · 06:30 ET)' },
          { done: true,  text: 'Run 7 factor screens (Momentum, Quality, Value, etc.)' },
          { done: true,  text: 'Apply regime overlay — boost RISK_ON/EXPANSION fit' },
          { done: true,  text: 'Filter: ADV > $50M, market cap > $5B, no earnings ≤ 5d' },
          { done: false, text: 'Manually review 22 longlist candidates' },
          { done: false, text: 'Cut to 10 for Tuesday deep-dive (deadline 16:00 ET)' },
        ],
        outputs: [
          'Longlist: 22 names · 14 LONG / 8 SHORT',
          'Top by composite: NVDA(88), AVGO(86), LLY(85), META(82), MSFT(81)',
          'Best regime-fit: MOM_BREAKOUT (4 signals), QLT_COMPOUND (5)',
        ],
      },
      {
        key: 'TUE',
        label: 'DEEP DIVE',
        title: 'Research the Shortlist',
        purpose: 'Build full thesis on 10 shortlist candidates. Output: 5 green-lit, 5 cut.',
        tasks: [
          { done: false, text: 'Read most recent 10-Q + earnings transcript per name' },
          { done: false, text: 'Refresh DCF assumptions; sanity-check fair value' },
          { done: false, text: 'Map comp set; check relative valuation' },
          { done: false, text: 'Identify primary catalyst + invalidation' },
          { done: false, text: 'Score thesis on 5-pt rubric → cut anything < 3' },
        ],
        outputs: ['(Pending)'],
      },
      {
        key: 'WED',
        label: 'SIZE',
        title: 'Position Sizing',
        purpose: 'Convert green-lit ideas to weighted positions. Output: target book.',
        tasks: [
          { done: false, text: 'Run Kelly fraction per signal (capped at 5%)' },
          { done: false, text: 'Apply concentration limits (≤20% per sector)' },
          { done: false, text: 'Net + gross exposure within risk budget' },
          { done: false, text: 'Pre-trade compliance check' },
        ],
        outputs: ['(Pending)'],
      },
      {
        key: 'THU',
        label: 'EXECUTE',
        title: 'Trade Day',
        purpose: 'Place orders. TWAP into illiquids, MOC for large blocks.',
        tasks: [
          { done: false, text: 'Pre-market: review overnight news, gap risk' },
          { done: false, text: 'Stage orders in EMS by 09:00 ET' },
          { done: false, text: 'Execute 09:30-11:00 (TWAP) and 15:30-16:00 (MOC)' },
          { done: false, text: 'Reconcile fills; log slippage' },
        ],
        outputs: ['(Pending)'],
      },
      {
        key: 'FRI',
        label: 'REVIEW',
        title: 'Post-mortem & Journal',
        purpose: 'Review closed positions. Update playbook. Journal lessons.',
        tasks: [
          { done: false, text: 'Tag closed positions: thesis right/wrong, execution good/bad' },
          { done: false, text: 'Write 3 lessons to journal' },
          { done: false, text: 'Update regime view based on week\'s data' },
          { done: false, text: 'Refresh blocklist (broken theses for 8wk cooldown)' },
        ],
        outputs: ['(Pending)'],
      },
    ],
    // Last-4-weeks rolling perf
    rollingPerf: [
      { week: 'W17', signals: 18, hit: 11, miss: 4, expired: 3, pnl: +2.84 },
      { week: 'W18', signals: 24, hit: 14, miss: 6, expired: 4, pnl: +1.42 },
      { week: 'W19', signals: 20, hit: 12, miss: 5, expired: 3, pnl: +0.74 },
      { week: 'W20', signals: 22, hit: 13, miss: 6, expired: 3, pnl: +1.68 },
    ],
  };

  // ─── AGENTS (structured-reasoning, not personas) ────────────────
  const AGENTS_V2 = [
    {
      id: 'TREND', name: 'TREND ANALYST',
      framework: 'Trend-following · momentum',
      what_i_see: (t) => `${t.sym} ${t.price > t.yLow*1.4 ? 'in established uptrend' : 'consolidating'}. Price/200DMA: ${((t.price/(t.yLow*1.15))*100-100).toFixed(0)}% above. Momentum factor: ${t.factors.momentum}.`,
      framework_says: (t) => t.factors.momentum >= 70
        ? 'Strong relative-strength setups historically run 18-32 days post-confirmation. Position in the direction of the trend until it breaks.'
        : 'Below 60 = no trade. Need confirmation.',
      conclusion: (t) => t.factors.momentum >= 70 ? 'BUY' : t.factors.momentum >= 50 ? 'WATCH' : 'AVOID',
      invalidation: (t) => `Close below ${(t.price * 0.92).toFixed(2)} (-8%) or momentum factor under 55.`,
      color: '#ffaa00',
    },
    {
      id: 'VAL', name: 'VALUE ANALYST',
      framework: 'Intrinsic value · margin of safety',
      what_i_see: (t) => `P/E ${t.pe.toFixed(1)}× (sector ~${(t.pe*1.3).toFixed(0)}×). P/B ${t.pb.toFixed(1)}. Beta ${t.beta.toFixed(2)}. Div ${t.div ? t.div.toFixed(2)+'%' : 'none'}.`,
      framework_says: (t) => t.pe < 18 && t.factors.value > 60
        ? 'Trading at meaningful discount to peers AND sector. Margin of safety present. Buy if quality factor confirms.'
        : 'No discount available. Multiple expansion required to make money — too speculative.',
      conclusion: (t) => t.pe < 18 && t.factors.value > 60 ? 'BUY' : t.pe < 22 ? 'HOLD' : 'PASS',
      invalidation: (t) => `Multiple re-rates higher with no earnings growth, or revenue declines.`,
      color: '#88aa44',
    },
    {
      id: 'QUAL', name: 'QUALITY ANALYST',
      framework: 'Compounders · durable returns',
      what_i_see: (t) => `Quality score ${t.factors.quality}. Composite ${t.composite}. Sector: ${t.sector}.`,
      framework_says: (t) => t.factors.quality >= 70
        ? 'Top-decile quality. Owning these for 3-5 years compounds at GDP+ regardless of cycle. Volatility is opportunity to add.'
        : 'Below threshold for core holding. Could be tactical only.',
      conclusion: (t) => t.factors.quality >= 75 ? 'CORE BUY' : t.factors.quality >= 60 ? 'TACTICAL' : 'AVOID',
      invalidation: (t) => 'ROIC trend breaks, or management capital allocation deteriorates (M&A, buybacks at peak).',
      color: '#5cd5ff',
    },
    {
      id: 'MACRO', name: 'MACRO ANALYST',
      framework: 'Top-down · regime-conditional',
      what_i_see: (t) => `Regime: ${REGIME.axes.risk.value} / ${REGIME.axes.growth.value} / rates ${REGIME.axes.rates.value}. ${t.sector} ${REGIME.rotation.overweight.includes(t.sector) ? 'OVERWEIGHT' : REGIME.rotation.underweight.includes(t.sector) ? 'UNDERWEIGHT' : 'NEUTRAL'} in our framework.`,
      framework_says: (t) => REGIME.rotation.overweight.includes(t.sector)
        ? 'Sector is favored by current regime. Names with high beta to sector get bonus weight.'
        : REGIME.rotation.underweight.includes(t.sector) ? 'Sector is headwind. Need stock-specific edge to override.' : 'Sector neutral. Stock-picking matters more than macro.',
      conclusion: (t) => REGIME.rotation.overweight.includes(t.sector) ? 'TAILWIND' : REGIME.rotation.underweight.includes(t.sector) ? 'HEADWIND' : 'NEUTRAL',
      invalidation: (t) => 'Regime flips — HY OAS > 350bps, VIX > 22, breadth collapse.',
      color: '#a868ff',
    },
    {
      id: 'RISK', name: 'RISK ANALYST',
      framework: 'Tail risk · convexity · sizing',
      what_i_see: (t) => `Beta ${t.beta.toFixed(2)}. 30d vol ~${(t.beta*16).toFixed(0)}%. Short int ${t.shortPct}%. DTC ${t.dtc}.`,
      framework_says: (t) => t.beta > 1.5
        ? 'High beta in current frothy positioning = first to unwind. Size at half of Kelly. Wide stop.'
        : 'Vol manageable. Standard 2% portfolio risk per position.',
      conclusion: (t) => t.beta > 1.6 ? 'SIZE DOWN' : t.beta > 1.2 ? 'STANDARD' : 'NORMAL',
      invalidation: (t) => 'VIX > 18 AND breadth narrows = de-risk regardless of thesis.',
      color: '#ff5a44',
    },
    {
      id: 'FLOW', name: 'FLOW ANALYST',
      framework: 'Positioning · options · dealer hedging',
      what_i_see: (t) => `Short interest ${t.shortPct}%. DTC ${t.dtc}d. ${t.shortPct > 7 ? 'Crowded short — squeeze risk.' : 'Light positioning.'} `,
      framework_says: (t) => t.shortPct < 3 && t.factors.momentum > 70
        ? 'Light short positioning + strong momentum = no obvious unwind catalyst. Can grind higher.'
        : t.shortPct > 8 ? 'Crowded short + improving fundamentals = asymmetric squeeze setup.' : 'No actionable positioning signal.',
      conclusion: (t) => t.shortPct > 8 ? 'SQUEEZE' : t.shortPct < 3 ? 'CLEAN' : 'NEUTRAL',
      invalidation: (t) => 'Flow data reverses — call skew flattens or institutional selling appears.',
      color: '#ff6abc',
    },
  ];

  Object.assign(window.MarketData, {
    REGIME, SIGNALS, METHODS, WEEKLY, AGENTS_V2,
    generateSignals, signalStats,
  });
})();
