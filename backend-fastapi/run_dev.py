"""Local dev server entry point.

psycopg's async mode cannot run on Windows' default ProactorEventLoop. Setting the
policy inside the app package is too late: the `uvicorn` CLI builds its loop before
importing the app. Driving `Server.serve()` through our own `asyncio.run` keeps the
selector loop that psycopg requires. Linux and Vercel are unaffected.
"""

import asyncio
import sys

import uvicorn

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


def main() -> None:
    config = uvicorn.Config(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        loop="asyncio",
        log_level="info",
    )
    asyncio.run(uvicorn.Server(config).serve())


if __name__ == "__main__":
    main()
