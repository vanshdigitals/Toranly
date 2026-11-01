"""Serving the built web app from the same origin (what the Docker image does)."""

from __future__ import annotations

from pathlib import Path

from tests.conftest import build_client, make_settings


def _dist(tmp_path: Path) -> Path:
    dist = tmp_path / "static"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><title>Toranly</title>", encoding="utf-8")
    (dist / "assets" / "app-abc123.js").write_text("console.log(1)", encoding="utf-8")
    (dist / "favicon.svg").write_text("<svg/>", encoding="utf-8")
    (tmp_path / "secret.txt").write_text("do not serve", encoding="utf-8")
    return dist


def test_spa_routes_assets_and_headers(tmp_path: Path) -> None:
    settings = make_settings(
        app_env="production",
        session_secret="x" * 64,
        ip_hash_salt="y" * 40,
        static_dir=str(_dist(tmp_path)),
    )
    with build_client(settings) as c:
        index = c.get("/")
        assert index.status_code == 200 and "Toranly" in index.text
        assert index.headers["cache-control"] == "no-cache"
        assert "frame-ancestors 'none'" in index.headers["content-security-policy"]

        deep = c.get("/events/plan-1/budget")
        assert deep.status_code == 200 and "Toranly" in deep.text

        asset = c.get("/assets/app-abc123.js")
        assert asset.headers["cache-control"] == "public, max-age=31536000, immutable"

        assert c.get("/favicon.svg").headers["cache-control"] == "public, max-age=3600"
        for path in ("/docs", "/openapi.json", "/api/v1/unknown"):
            assert c.get(path).status_code == 404
        for path in ("/../secret.txt", "/%2e%2e/secret.txt", "/assets/../../secret.txt"):
            r = c.get(path)
            assert "do not serve" not in r.text


def test_no_static_dir_means_api_only() -> None:
    with build_client(make_settings(static_dir="")) as c:
        assert c.get("/").status_code == 404
