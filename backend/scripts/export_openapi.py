"""Write the OpenAPI schema to web/openapi.json (no network, no database).

The web app generates its API types from this file (`npm run api:types`); CI fails when either
file is out of date.

Run: uv run python -m scripts.export_openapi
"""

from __future__ import annotations

import json
from pathlib import Path

from app.main import create_app

OUT = Path(__file__).resolve().parents[2] / "web" / "openapi.json"


def main() -> None:
    schema = create_app().openapi()
    text = json.dumps(schema, indent=2, sort_keys=True) + "\n"
    OUT.write_text(text, encoding="utf-8", newline="\n")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
