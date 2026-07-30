import json

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from .config import get_settings
from .db import engine
from .routers import billing, clinical, inventory, platform, purchases, reports, sales

settings = get_settings()


class ResponseEnvelopeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        if not request.url.path.startswith("/api/v1") or response.status_code == 204:
            return response
        if "application/json" not in response.headers.get("content-type", ""):
            return response

        raw = b"".join([chunk async for chunk in response.body_iterator])
        payload = json.loads(raw or b"null")
        if 200 <= response.status_code < 300:
            if isinstance(payload, dict) and "items" in payload and "meta" in payload:
                wrapped = {
                    "success": True,
                    "data": payload["items"],
                    "meta": payload["meta"],
                }
            else:
                wrapped = {"success": True, "data": payload}
        else:
            detail = payload.get("detail", payload) if isinstance(payload, dict) else payload
            wrapped = {
                "success": False,
                "error": {
                    "message": detail if isinstance(detail, str) else "Request failed",
                    "details": detail if not isinstance(detail, str) else None,
                },
            }
        headers = {
            key: value for key, value in response.headers.items() if key.lower() != "content-length"
        }
        return JSONResponse(wrapped, status_code=response.status_code, headers=headers)


app = FastAPI(
    title="Nabhi Care API",
    version="0.1.0",
    docs_url="/docs" if settings.app_env != "production" else None,
    redoc_url=None,
)
app.add_middleware(ResponseEnvelopeMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Hospital-ID", "X-Bootstrap-Secret"],
)

for api_router in (
    platform.router,
    clinical.router,
    inventory.router,
    purchases.router,
    sales.router,
    billing.router,
    reports.router,
):
    app.include_router(api_router, prefix="/api/v1")


@app.get("/health/live")
async def liveness():
    return {"status": "ok"}


@app.get("/health/ready")
async def readiness():
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))
    return {"status": "ready"}
