# Personal Quant Dashboard

A local research dashboard for scanning broad market directories, watching quotes, charting technical signals, and reading market headlines.

## Run

```powershell
cd C:\stocks
py -3.12 app.py
```

Open:

```text
http://127.0.0.1:8787
```

## Data Sources

- US equity/ETF universe: Nasdaq Trader symbol directories.
- India equity universe: NSE official equity list.
- Other global dashboard directories: curated Yahoo-symbol focus lists until official exchange-directory adapters are added.
- Quotes and daily history: Yahoo Finance chart endpoint.
- News: Google News RSS search.

The app is built for personal research and education. It does not place trades and does not provide financial advice.

## What The First Version Does

- Loads the current US stock/ETF symbol universe and the current NSE equity universe for India.
- Fetches watchlist quotes through the local Python proxy.
- Scans a configurable slice of the market and ranks symbols by a simple liquidity, day-move, and intraday-range score.
- Charts close price with 20-day and 50-day moving averages.
- Calculates trend, 1-month momentum, RSI, volatility, drawdown, and volume pulse.
- Pulls market or symbol-specific Google News headlines and applies lightweight headline-tone scoring.
