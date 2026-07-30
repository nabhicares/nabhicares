"""Vercel ASGI entrypoint.

A failure while importing the app raises before FastAPI exists, so Vercel can only
report FUNCTION_INVOCATION_FAILED with no cause. Falling back to a dependency-free
ASGI app turns that opaque 500 into a readable diagnosis. Only variable names,
value lengths and the exception type are exposed — never a secret value.
"""

import json
import os
import traceback

REQUIRED_SETTINGS = (
    "DATABASE_URL",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
    "CLOUDINARY_URL",
    "BOOTSTRAP_SECRET",
)

try:
    from app.main import app
except Exception as exc:  # noqa: BLE001 - must report any startup failure, not crash
    startup_error = {
        "success": False,
        "error": {
            "message": "API failed to start. This is a deployment configuration problem.",
            "exception_type": type(exc).__name__,
            "exception": str(exc)[:2000],
            "environment": {
                name: f"set (len={len(os.environ[name])})" if name in os.environ else "MISSING"
                for name in REQUIRED_SETTINGS
            },
            "traceback": traceback.format_exc()[-2000:],
        },
    }

    async def app(scope, receive, send):  # type: ignore[misc]
        """Minimal ASGI app — stdlib only, so it survives missing dependencies."""
        if scope["type"] != "http":
            return
        body = json.dumps(startup_error, indent=2).encode()
        await send(
            {
                "type": "http.response.start",
                "status": 500,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"access-control-allow-origin", b"*"),
                    (b"cache-control", b"no-store"),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})


__all__ = ["app"]
