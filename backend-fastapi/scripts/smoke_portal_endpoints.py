"""Smoke-check the deployed entrypoint and the endpoints the web portal needs.

Imports through api/index.py — the module named in [tool.vercel] entrypoint — so this
exercises the same object the deployment loads, not just app.main.
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

WEB_ORIGIN = "https://cares.nabhilabs.com"


def load_env() -> None:
    for line in Path(__file__).resolve().parent.parent.joinpath(".env").read_text(
        encoding="utf-8"
    ).splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    os.environ["ALLOW_MOCK_AUTH"] = "true"
    # Assert CORS against the real browser origin rather than whatever .env allows locally.
    os.environ["CORS_ORIGINS"] = f"{WEB_ORIGIN},http://localhost:3001"
    # Settings are cached — clear so the overrides above take effect.
    from app.config import get_settings

    get_settings.cache_clear()


async def main() -> None:
    load_env()
    from api.index import app

    if not isinstance(app, FastAPI):
        raise SystemExit(
            "entrypoint fell back to the startup diagnostic — app.main failed to import"
        )

    transport = ASGITransport(app=app)
    headers = {
        "Authorization": "Bearer mock-hospital_admin",
        "X-Hospital-ID": "11111111-1111-1111-1111-111111111111",
    }
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        preflight = await client.options(
            "/api/v1/prescriptions",
            headers={"Origin": WEB_ORIGIN, "Access-Control-Request-Method": "GET"},
        )
        acao = preflight.headers.get("access-control-allow-origin")
        print("OPTIONS prescriptions", preflight.status_code, acao)
        assert preflight.status_code == 200, preflight.text
        assert acao == WEB_ORIGIN, f"expected {WEB_ORIGIN}, got {acao}"

        rx = await client.get("/api/v1/prescriptions?limit=10", headers=headers)
        print("GET prescriptions", rx.status_code, rx.text[:200])

        dash = await client.get("/api/v1/reports/dashboard", headers=headers)
        print("GET reports/dashboard", dash.status_code, dash.text[:300])

        live = await client.get("/health/live")
        print("GET health/live", live.status_code, live.text[:80])
        assert live.status_code == 200, live.text

        assert rx.status_code == 200, rx.text
        assert dash.status_code == 200, dash.text
        body = dash.json()
        assert body["success"] is True
        for key in ("totalPatients", "todayAppointments", "totalRevenue"):
            assert key in body["data"], body
        print("ALL PASS")


if __name__ == "__main__":
    import sys

    if sys.platform.startswith("win"):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
