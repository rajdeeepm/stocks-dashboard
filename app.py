from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import re
import ssl
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
PORT = 8787
USER_AGENT = "PersonalQuantDashboard/0.1 (+local research tool)"
DB_PATH = ROOT / "research.db"

NASDAQ_LISTED = "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt"
OTHER_LISTED = "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt"
YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart/"
GOOGLE_NEWS_RSS = "https://news.google.com/rss/search"
NSE_EQUITY_LIST = "https://archives.nseindia.com/content/equities/EQUITY_L.csv"
JPX_LISTED = "https://www.jpx.co.jp/english/markets/statistics-equities/misc/tvdivq0000001vg2-att/data_e.xls"
ASX_LISTED = "https://www.asx.com.au/asx/research/ASXListedCompanies.csv"
HKEX_SECURITIES = "https://www.hkex.com.hk/eng/services/trading/securities/securitieslists/ListOfSecurities.xlsx"
LSE_AIM_INSTRUMENTS = "https://api.londonstockexchange.com/api/gw/lse/download/directories/aim-adviser/instruments"
XETRA_INSTRUMENTS = "https://www.xetra.com/resource/blob/1528/49690f1830851a8740278613ee8ce477/data/t7-xetr-allTradableInstruments.csv"
TSX_DIRECTORY = "https://www.tsx.com/json/company-directory/search/tsx/%5E"
TSXV_DIRECTORY = "https://www.tsx.com/json/company-directory/search/tsxv/%5E"

CACHE_TTL = {
    "universe": 6 * 60 * 60,
    "market_universe": 24 * 60 * 60,
    "quote": 25,
    "history": 20 * 60,
    "news": 10 * 60,
}


@dataclass
class CacheEntry:
    expires_at: float
    value: Any


cache: dict[str, CacheEntry] = {}
FALLBACK_UNIVERSE = [
    {"symbol": "AAPL", "name": "Apple Inc.", "exchange": "NASDAQ", "assetType": "Stock", "etf": False},
    {"symbol": "MSFT", "name": "Microsoft Corporation", "exchange": "NASDAQ", "assetType": "Stock", "etf": False},
    {"symbol": "NVDA", "name": "NVIDIA Corporation", "exchange": "NASDAQ", "assetType": "Stock", "etf": False},
    {"symbol": "AMZN", "name": "Amazon.com Inc.", "exchange": "NASDAQ", "assetType": "Stock", "etf": False},
    {"symbol": "META", "name": "Meta Platforms Inc.", "exchange": "NASDAQ", "assetType": "Stock", "etf": False},
    {"symbol": "GOOGL", "name": "Alphabet Inc. Class A", "exchange": "NASDAQ", "assetType": "Stock", "etf": False},
    {"symbol": "TSLA", "name": "Tesla Inc.", "exchange": "NASDAQ", "assetType": "Stock", "etf": False},
    {"symbol": "BRK.B", "name": "Berkshire Hathaway Inc. Class B", "exchange": "NYSE", "assetType": "Stock", "etf": False},
    {"symbol": "JPM", "name": "JPMorgan Chase & Co.", "exchange": "NYSE", "assetType": "Stock", "etf": False},
    {"symbol": "SPY", "name": "SPDR S&P 500 ETF Trust", "exchange": "NYSE Arca", "assetType": "ETF", "etf": True},
    {"symbol": "QQQ", "name": "Invesco QQQ Trust", "exchange": "NASDAQ", "assetType": "ETF", "etf": True},
]

def cached(key: str, loader, ttl: int):
    now = time.time()
    entry = cache.get(key)
    if entry and entry.expires_at > now:
        return entry.value
    value = loader()
    cache[key] = CacheEntry(now + ttl, value)
    return value


def fetch_text(url: str, timeout: int = 15) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as exc:
        if "CERTIFICATE_VERIFY_FAILED" not in str(exc):
            raise
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(req, timeout=timeout, context=context) as response:
            return response.read().decode("utf-8", errors="replace")


def parse_bool(value: str | None) -> bool:
    return str(value or "").strip().upper() in {"Y", "YES", "TRUE", "1"}


def clean_symbol(symbol: str) -> str:
    return symbol.strip().upper().replace("/", ".")


def clean_cell(value: Any) -> str:
    text = str(value or "").replace("\xa0", " ").strip()
    if text.endswith(".0") and text[:-2].isdigit():
        return text[:-2]
    return text


def parse_nasdaq_universe_items() -> list[dict[str, Any]]:
    payload = cached("universe", load_universe, CACHE_TTL["universe"])
    return [
        {
            "symbol": item["symbol"],
            "name": item.get("name") or item["symbol"],
            "exchange": item.get("exchange") or "US",
            "assetType": item.get("assetType") or ("ETF" if item.get("etf") else "Stock"),
            "etf": bool(item.get("etf")),
            "market": "US",
            "currency": "USD",
        }
        for item in payload.get("items", [])
    ]


def parse_pipe_table(text: str) -> list[dict[str, str]]:
    lines = [line for line in text.splitlines() if line and not line.startswith("File Creation Time")]
    reader = csv.DictReader(lines, delimiter="|")
    return [row for row in reader if row]


def load_universe() -> dict[str, Any]:
    started = time.perf_counter()
    try:
        nasdaq_rows = parse_pipe_table(fetch_text(NASDAQ_LISTED))
        other_rows = parse_pipe_table(fetch_text(OTHER_LISTED))
        rows: list[dict[str, Any]] = []

        for row in nasdaq_rows:
            symbol = clean_symbol(row.get("Symbol", ""))
            name = row.get("Security Name", "").strip()
            if not symbol or symbol == "Symbol" or parse_bool(row.get("Test Issue")):
                continue
            is_etf = parse_bool(row.get("ETF"))
            rows.append(
                {
                    "symbol": symbol,
                    "name": name,
                    "exchange": "NASDAQ",
                    "assetType": "ETF" if is_etf else "Stock",
                    "etf": is_etf,
                }
            )

        exchange_map = {"A": "NYSE American", "N": "NYSE", "P": "NYSE Arca", "Z": "BATS", "V": "IEXG"}
        for row in other_rows:
            symbol = clean_symbol(row.get("ACT Symbol", ""))
            name = row.get("Security Name", "").strip()
            if not symbol or parse_bool(row.get("Test Issue")):
                continue
            is_etf = parse_bool(row.get("ETF"))
            rows.append(
                {
                    "symbol": symbol,
                    "name": name,
                    "exchange": exchange_map.get(row.get("Exchange", "").strip(), row.get("Exchange", "").strip()),
                    "assetType": "ETF" if is_etf else "Stock",
                    "etf": is_etf,
                }
            )

        rows.sort(key=lambda item: (item["assetType"], item["symbol"]))
        record_provider("nasdaq-universe", "OK", int((time.perf_counter() - started) * 1000), f"{len(rows)} symbols")
        return {"source": "nasdaqtrader", "count": len(rows), "items": rows}
    except Exception as exc:
        record_provider("nasdaq-universe", "DEGRADED", int((time.perf_counter() - started) * 1000), str(exc))
        return {"source": "fallback", "error": str(exc), "count": len(FALLBACK_UNIVERSE), "items": FALLBACK_UNIVERSE}


def load_quotes(symbols: list[str]) -> dict[str, Any]:
    unique = []
    seen = set()
    for symbol in symbols:
        cleaned = clean_symbol(symbol)
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            unique.append(cleaned)

    if not unique:
        return {"source": "yahoo-chart", "items": []}

    items = []
    workers = min(12, len(unique))
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(load_quote, symbol): symbol for symbol in unique}
        for future in as_completed(futures):
            try:
                quote = future.result()
            except Exception:
                quote = None
            if quote:
                items.append(quote)
    items.sort(key=lambda item: unique.index(item["symbol"]) if item["symbol"] in unique else 9999)
    return {"source": "yahoo-chart", "items": items}


def load_quote(symbol: str) -> dict[str, Any] | None:
    started = time.perf_counter()
    params = urllib.parse.urlencode({"range": "5d", "interval": "1d"})
    payload = json.loads(fetch_text(f"{YAHOO_CHART}{urllib.parse.quote(yahoo_symbol(symbol))}?{params}"))
    result = (payload.get("chart", {}).get("result") or [None])[0]
    if not result:
        return None

    meta = result.get("meta", {})
    timestamps = result.get("timestamp") or []
    quote = ((result.get("indicators", {}).get("quote") or [{}])[0]) or {}
    opens = quote.get("open") or []
    highs = quote.get("high") or []
    lows = quote.get("low") or []
    closes = quote.get("close") or []
    volumes = quote.get("volume") or []
    last_index = latest_value_index(closes)
    close = to_float(str(meta.get("regularMarketPrice"))) or value_at(closes, last_index)
    open_price = value_at(opens, last_index)
    previous = to_float(str(meta.get("chartPreviousClose")))
    change = None
    change_pct = None
    if close is not None and previous not in (None, 0):
        change = close - previous
        change_pct = (change / previous) * 100

    row_date = None
    if timestamps and last_index is not None and last_index < len(timestamps):
        row_date = datetime.fromtimestamp(timestamps[last_index]).strftime("%Y-%m-%d")

    record_provider("yahoo-chart", "OK", int((time.perf_counter() - started) * 1000), f"quote {clean_symbol(symbol)}")
    return {
        "symbol": clean_symbol(symbol),
        "date": row_date,
        "time": datetime.fromtimestamp(meta.get("regularMarketTime", time.time())).strftime("%H:%M:%S"),
        "open": open_price,
        "high": value_at(highs, last_index) or to_float(str(meta.get("regularMarketDayHigh"))),
        "low": value_at(lows, last_index) or to_float(str(meta.get("regularMarketDayLow"))),
        "close": close,
        "volume": value_at(volumes, last_index) or to_float(str(meta.get("regularMarketVolume"))),
        "change": change,
        "changePct": change_pct,
    }


def latest_value_index(values: list[Any]) -> int | None:
    for index in range(len(values) - 1, -1, -1):
        if values[index] is not None:
            return index
    return None


def value_at(values: list[Any], index: int | None) -> float | None:
    if index is None or index >= len(values):
        return None
    value = values[index]
    if value is None:
        return None
    return to_float(str(value))


def to_float(value: str | None) -> float | None:
    if value is None:
        return None
    value = value.strip().replace(",", "")
    if not value or value.upper() == "N/D":
        return None
    try:
        numeric = float(value)
    except ValueError:
        return None
    if math.isnan(numeric) or math.isinf(numeric):
        return None
    return numeric


def none_if_nd(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return None if cleaned.upper() in {"", "N/D"} else cleaned


def parse_range(range_name: str) -> date:
    today = date.today()
    ranges = {
        "1d": today - timedelta(days=2),
        "5d": today - timedelta(days=8),
        "1m": today - timedelta(days=35),
        "3m": today - timedelta(days=100),
        "6m": today - timedelta(days=190),
        "ytd": date(today.year, 1, 1),
        "1y": today - timedelta(days=370),
        "3y": today - timedelta(days=365 * 3 + 10),
        "5y": today - timedelta(days=365 * 5 + 10),
    }
    return ranges.get(range_name, today - timedelta(days=370))


def load_history(symbol: str, range_name: str) -> dict[str, Any]:
    started = time.perf_counter()
    normalized_range = str(range_name or "1y").strip().lower()
    range_map = {
        "1d": ("1d", "5m"),
        "5d": ("5d", "30m"),
        "1m": ("1mo", "1d"),
        "3m": ("3mo", "1d"),
        "6m": ("6mo", "1d"),
        "ytd": ("ytd", "1d"),
        "1y": ("1y", "1d"),
        "3y": ("5y", "1wk"),
        "5y": ("5y", "1wk"),
    }
    yahoo_range, interval = range_map.get(normalized_range, ("1y", "1d"))
    params = urllib.parse.urlencode({"range": yahoo_range, "interval": interval})
    payload = json.loads(fetch_text(f"{YAHOO_CHART}{urllib.parse.quote(yahoo_symbol(symbol))}?{params}"))
    result = (payload.get("chart", {}).get("result") or [None])[0]
    if not result:
        return {"source": "yahoo-chart", "symbol": clean_symbol(symbol), "range": normalized_range, "interval": interval, "items": []}

    timestamps = result.get("timestamp") or []
    quote = ((result.get("indicators", {}).get("quote") or [{}])[0]) or {}
    opens = quote.get("open") or []
    highs = quote.get("high") or []
    lows = quote.get("low") or []
    closes = quote.get("close") or []
    volumes = quote.get("volume") or []
    start = parse_range(normalized_range)
    prices = []
    for index, timestamp in enumerate(timestamps):
        row_dt = datetime.fromtimestamp(timestamp)
        row_date = row_dt.date()
        if row_date < start:
            continue
        prices.append(
            {
                "date": row_date.isoformat(),
                "time": row_dt.time().replace(microsecond=0).isoformat(),
                "datetime": row_dt.replace(microsecond=0).isoformat(),
                "open": value_at(opens, index),
                "high": value_at(highs, index),
                "low": value_at(lows, index),
                "close": value_at(closes, index),
                "volume": value_at(volumes, index),
            }
        )
    record_provider("yahoo-chart", "OK", int((time.perf_counter() - started) * 1000), f"history {clean_symbol(symbol)} {normalized_range} {interval}")
    return {"source": "yahoo-chart", "symbol": clean_symbol(symbol), "range": normalized_range, "interval": interval, "items": prices}


def load_news(query: str, limit: int) -> dict[str, Any]:
    started = time.perf_counter()
    params = urllib.parse.urlencode({"q": query, "hl": "en-US", "gl": "US", "ceid": "US:en"})
    text = fetch_text(f"{GOOGLE_NEWS_RSS}?{params}")
    root = ET.fromstring(text)
    items = []
    for item in root.findall("./channel/item")[:limit]:
        title = item.findtext("title", default="").strip()
        published = item.findtext("pubDate", default="").strip()
        link = item.findtext("link", default="").strip()
        source = item.findtext("source", default="").strip()
        items.append(
            {
                "title": title,
                "published": published,
                "link": link,
                "source": source,
                "sentiment": score_headline(title),
            }
        )
    record_provider("google-news-rss", "OK", int((time.perf_counter() - started) * 1000), f"{len(items)} headlines for {query}")
    return {"source": "google-news-rss", "query": query, "items": items}


POSITIVE_WORDS = {
    "beats",
    "beat",
    "surge",
    "surges",
    "upgrade",
    "upgraded",
    "growth",
    "profit",
    "rally",
    "record",
    "strong",
    "bullish",
    "raises",
    "gain",
    "gains",
}

NEGATIVE_WORDS = {
    "miss",
    "misses",
    "cut",
    "cuts",
    "downgrade",
    "downgraded",
    "falls",
    "fall",
    "slump",
    "slumps",
    "weak",
    "lawsuit",
    "probe",
    "loss",
    "bearish",
    "warning",
    "risk",
}


def score_headline(title: str) -> int:
    words = {word.strip(".,:;!?()[]{}\"'").lower() for word in title.split()}
    return sum(1 for word in words if word in POSITIVE_WORDS) - sum(1 for word in words if word in NEGATIVE_WORDS)


class DashboardHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self.handle_api(parsed)
            return
        super().do_GET()

    def handle_api(self, parsed: urllib.parse.ParseResult):
        try:
            params = urllib.parse.parse_qs(parsed.query)
            if parsed.path == "/api/universe":
                data = cached("universe", load_universe, CACHE_TTL["universe"])
                self.write_json(data)
            elif parsed.path == "/api/quote":
                symbols = ",".join(params.get("symbols", [""])).split(",")
                clean_symbols = ",".join(sorted(clean_symbol(symbol) for symbol in symbols if clean_symbol(symbol)))
                key = f"quote:{clean_symbols}"
                data = cached(key, lambda: load_quotes(symbols), CACHE_TTL["quote"])
                self.write_json(data)
            elif parsed.path == "/api/history":
                symbol = params.get("symbol", ["SPY"])[0]
                range_name = params.get("range", ["1y"])[0]
                key = f"history:{clean_symbol(symbol)}:{range_name}"
                data = cached(key, lambda: load_history(symbol, range_name), CACHE_TTL["history"])
                self.write_json(data)
            elif parsed.path == "/api/news":
                query = params.get("query", ["market stocks"])[0]
                limit = max(1, min(40, int(params.get("limit", ["12"])[0])))
                key = f"news:{query}:{limit}"
                data = cached(key, lambda: load_news(query, limit), CACHE_TTL["news"])
                self.write_json(data)
            else:
                self.write_json({"error": "Unknown endpoint"}, status=404)
        except urllib.error.URLError as exc:
            record_provider("yahoo-chart", "DOWN", None, str(exc))
            self.write_json({"error": "Network request failed", "detail": str(exc)}, status=502)
        except Exception as exc:
            self.write_json({"error": "Request failed", "detail": str(exc)}, status=500)


    def write_json(self, payload: Any, status: int = 200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    init_research_db()
    server = ThreadingHTTPServer(("127.0.0.1", PORT), DashboardHandler)
    print(f"Personal Quant Dashboard running at http://127.0.0.1:{PORT}")
    print("Press Ctrl+C to stop.")
    server.serve_forever()


if __name__ == "__main__":
    main()
