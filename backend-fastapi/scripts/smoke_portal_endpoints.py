"""Smoke-check the two endpoints the web portal needs for the FastAPI cutover."""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

from httpx import ASGITransport, AsyncClient


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
    # Settings are cached — clear so ALLOW_MOCK_AUTH takes effect.
    from app.config import get_settings

    get_settings.cache_clear()


async def main() -> None:
    load_env()
    from app.main import app

    transport = ASGITransport(app=app)
    headers = {
        "Authorization": "Bearer mock-hospital_admin",
        "X-Hospital-ID": "11111111-1111-1111-1111-111111111111",
    }
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        preflight = await client.options(
            "/api/v1/prescriptions",
            headers={
                "Origin": "https://cares.nabhilabs.com",
                "Access-Control-Request-Method": "GET",
            },
        )
        print("OPTIONS prescriptions", preflight.status_code, preflight.headers.get("access-control-allow-origin"))

        rx = await client.get("/api/v1/prescriptions?limit=10", headers=headers)
        print("GET prescriptions", rx.status_code, rx.text[:200])

        dash = await client.get("/api/v1/reports/dashboard", headers=headers)
        print("GET reports/dashboard", dash.status_code, dash.text[:300])

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
