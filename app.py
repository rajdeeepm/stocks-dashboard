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
