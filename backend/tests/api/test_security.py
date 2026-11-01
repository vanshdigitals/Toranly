from __future__ import annotations

import hashlib
import io
import json
import logging
import re
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from starlette.requests import Request

from app.core.config import ConfigError
from app.core.logging import JsonFormatter, redactor
from app.core.security import (
    _unb64,
    client_ip,
    sign_device_id,
    verify_device_cookie,
)
from tests.ai.sample import suggest_body
from tests.conftest import ORIGIN, TEST_XAI_KEY, build_client, device_cookie, make_settings
from tests.fakes import FakeProvider, MemoryUsageStore, ok, recorded

SUGGEST = "/api/v1/ai/suggest"
REPO = Path(__file__).resolve().parents[3]


# --- device cookie ----------------------------------------------------------------------------


def test_cookie_flags_development(client: TestClient) -> None:
    r = client.get("/api/v1/ai/status")
    header = r.headers["set-cookie"]
    assert header.startswith("tdv=")
    for flag in ("HttpOnly", "Path=/api", "SameSite=lax", "Max-Age=15552000"):
        assert flag.lower() in header.lower()
    assert "secure" not in header.lower()


def test_cookie_secure_in_production() -> None:
    settings = make_settings(
        app_env="production", session_secret="x" * 64, ip_hash_salt="y" * 40, cors_origins=""
    )
    with build_client(settings, FakeProvider()) as c:
        header = c.get("/api/v1/ai/status").headers["set-cookie"]
    assert "secure" in header.lower()


def test_cookie_signature_roundtrip_and_tamper() -> None:
    value = sign_device_id(b"\x01" * 32, "secret")
    assert verify_device_cookie(value, "secret") == b"\x01" * 32
    assert verify_device_cookie(value, "other-secret") is None
    raw, mac = value.split(".")
    flipped = ("A" if raw[0] != "A" else "B") + raw[1:]
    assert verify_device_cookie(f"{flipped}.{mac}", "secret") is None
    for junk in ("", "abc", "a.b.c", "!!!.???", "x" * 300):
        assert verify_device_cookie(junk, "secret") is None


def test_tampered_cookie_rejected(client: TestClient, fake_provider: FakeProvider) -> None:
    cookie = device_cookie(client)
    raw, mac = cookie.split(".")
    tampered = ("A" if raw[0] != "A" else "B") + raw[1:] + "." + mac
    client.cookies.clear()
    client.cookies.set("tdv", tampered, path="/api")
    r = client.post(SUGGEST, json=suggest_body())
    assert r.status_code == 401 and r.json()["code"] == "device_required"
    assert fake_provider.requests == []
    # Status replaces a tampered cookie with a fresh one.
    assert "tdv=" in client.get("/api/v1/ai/status").headers["set-cookie"]


def test_missing_cookie_rejected(client: TestClient) -> None:
    r = client.post(SUGGEST, json=suggest_body())
    assert r.status_code == 401


def test_only_device_hash_is_stored(
    client: TestClient, fake_provider: FakeProvider, memory_store: MemoryUsageStore
) -> None:
    cookie = device_cookie(client)
    fake_provider.steps = [ok(recorded("theme_suggest.valid.json"))]
    client.post(SUGGEST, json=suggest_body("theme.suggest"))
    device_id = _unb64(cookie.split(".")[0])
    stored = {k[0] for k in memory_store.device}
    assert stored == {hashlib.sha256(device_id).hexdigest()}
    ip_keys = {k[0] for k in memory_store.ip}
    assert all(re.fullmatch(r"[0-9a-f]{64}", k) for k in ip_keys)
    assert "testclient" not in str(memory_store.ip)


# --- origin, body size, headers ---------------------------------------------------------------


@pytest.mark.parametrize("origin", [None, "https://evil.example", "http://testserver.evil"])
def test_post_without_allowed_origin_is_403(client: TestClient, origin: str | None) -> None:
    headers = {"Origin": origin} if origin else {}
    if origin is None:
        client.headers.pop("Origin")
    r = client.post("/api/v1/plan/template", json={"type": "birthday"}, headers=headers)
    assert r.status_code == 403
    assert r.json()["code"] == "origin_not_allowed"
    assert r.headers["content-type"] == "application/problem+json"


def test_dev_origin_allowed_only_outside_production(client: TestClient) -> None:
    dev = {"Origin": "http://localhost:5173"}
    assert (
        client.post("/api/v1/plan/template", json={"type": "birthday"}, headers=dev).status_code
        == 200
    )
    settings = make_settings(
        app_env="production",
        session_secret="x" * 64,
        ip_hash_salt="y" * 40,
        app_origin="https://toranly.example",
    )
    with build_client(settings) as c:
        r = c.post("/api/v1/plan/template", json={"type": "birthday"}, headers=dev)
        assert r.status_code == 403
        r = c.post(
            "/api/v1/plan/template",
            json={"type": "birthday"},
            headers={"Origin": "https://toranly.example"},
        )
        assert r.status_code == 200


def test_body_too_large_is_413(client: TestClient) -> None:
    big = {"type": "birthday", "pad": "x" * 70_000}
    r = client.post("/api/v1/plan/template", json=big)
    assert r.status_code == 413 and r.json()["code"] == "payload_too_large"


def test_chunked_body_too_large_is_413(client: TestClient) -> None:
    def chunks() -> Any:
        for _ in range(20):
            yield b"x" * 5000

    r = client.post(
        "/api/v1/plan/template",
        content=chunks(),
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code == 413


def test_security_headers_on_every_response(client: TestClient) -> None:
    for r in (
        client.get("/api/v1/health"),
        client.get("/api/v1/nope"),
        client.post("/api/v1/plan/template", json={"type": "party"}),
        client.post("/api/v1/plan/template", json={"x": "y" * 70_000}),
    ):
        assert re.fullmatch(r"[0-9a-f]{32}", r.headers["x-request-id"])
        csp = r.headers["content-security-policy"]
        assert "frame-ancestors 'none'" in csp and "default-src 'self'" in csp
        assert r.headers["x-content-type-options"] == "nosniff"
        assert r.headers["referrer-policy"] == "same-origin"
        assert "strict-transport-security" not in r.headers
        assert r.headers["cache-control"] == "no-store"


def test_hsts_and_no_docs_in_production() -> None:
    settings = make_settings(app_env="production", session_secret="x" * 64, ip_hash_salt="y" * 40)
    with build_client(settings) as c:
        r = c.get("/api/v1/health")
        assert r.headers["strict-transport-security"].startswith("max-age=")
        for path in ("/docs", "/redoc", "/openapi.json"):
            assert c.get(path).status_code == 404


def test_docs_available_in_development(client: TestClient) -> None:
    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").status_code == 200


def test_500_has_no_internals_and_has_request_id(caplog: pytest.LogCaptureFixture) -> None:
    c = build_client(make_settings())

    def boom() -> None:
        raise RuntimeError(f"database password hunter2 and key {TEST_XAI_KEY}")

    router = c.app.router  # type: ignore[attr-defined]
    router.add_api_route("/api/v1/boom", boom)
    router.routes.insert(0, router.routes.pop())  # ahead of the SPA catch-all
    with c, caplog.at_level(logging.ERROR):
        r = c.get("/api/v1/boom")
    assert r.status_code == 500
    body = r.json()
    assert body["code"] == "internal_error"
    assert "hunter2" not in r.text and "RuntimeError" not in r.text and TEST_XAI_KEY not in r.text
    assert r.headers["x-request-id"]
    formatted = [JsonFormatter().format(rec) for rec in caplog.records]
    assert formatted and all(
        "hunter2" not in line and TEST_XAI_KEY not in line for line in formatted
    )


def test_validation_errors_do_not_echo_input(client: TestClient) -> None:
    r = client.post("/api/v1/plan/template", json={"type": "secret-value-123"})
    assert r.status_code == 422
    body = r.json()
    assert body["code"] == "validation_failed" and body["errors"][0]["field"] == "type"
    assert "secret-value-123" not in r.text


def test_malformed_json_is_400(client: TestClient) -> None:
    r = client.post(
        "/api/v1/plan/template", content=b"{nope", headers={"Content-Type": "application/json"}
    )
    assert r.status_code == 400 and r.json()["code"] == "bad_request"


def test_cors_allowlist_development(client: TestClient) -> None:
    pre = client.options(
        "/api/v1/ai/suggest",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"},
    )
    assert pre.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert pre.headers["access-control-allow-credentials"] == "true"
    bad = client.get("/api/v1/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in bad.headers


def test_no_cors_in_production() -> None:
    settings = make_settings(
        app_env="production",
        session_secret="x" * 64,
        ip_hash_salt="y" * 40,
        cors_origins="http://localhost:5173",
    )
    with build_client(settings) as c:
        r = c.get("/api/v1/health", headers={"Origin": "http://localhost:5173"})
    assert "access-control-allow-origin" not in r.headers


def test_api_rate_limit_per_ip() -> None:
    with build_client(make_settings(api_limit_per_ip_per_minute=3)) as c:
        codes = [
            c.post("/api/v1/plan/template", json={"type": "birthday"}).status_code for _ in range(4)
        ]
        r = c.post("/api/v1/plan/template", json={"type": "birthday"})
    assert codes == [200, 200, 200, 429]
    assert r.json()["code"] == "rate_limited" and int(r.headers["retry-after"]) >= 1


# --- IP handling ------------------------------------------------------------------------------


def _request(peer: str, xff: str | None) -> Request:
    headers = [(b"x-forwarded-for", xff.encode())] if xff else []
    return Request({"type": "http", "client": (peer, 1234), "headers": headers})


def test_x_forwarded_for_only_from_trusted_proxy() -> None:
    untrusted = make_settings()
    assert client_ip(_request("203.0.113.9", "1.2.3.4"), untrusted) == "203.0.113.9"
    trusted = make_settings(trusted_proxy_cidrs="10.0.0.0/8")
    assert client_ip(_request("10.1.2.3", "1.2.3.4"), trusted) == "1.2.3.4"
    # A client-supplied entry to the left of the real one is ignored.
    assert client_ip(_request("10.1.2.3", "6.6.6.6, 1.2.3.4"), trusted) == "1.2.3.4"
    assert client_ip(_request("10.1.2.3", "1.2.3.4, 10.9.9.9"), trusted) == "1.2.3.4"
    assert client_ip(_request("203.0.113.9", "1.2.3.4"), trusted) == "203.0.113.9"
    assert client_ip(_request("10.1.2.3", "not-an-ip"), trusted) == "10.1.2.3"


# --- configuration ----------------------------------------------------------------------------


@pytest.mark.parametrize(
    "overrides",
    [
        {"session_secret": ""},
        {"session_secret": "short"},
        {"ip_hash_salt": "x" * 31},
        {"cors_origins": "*"},
    ],
)
def test_production_refuses_unsafe_config(overrides: dict[str, Any]) -> None:
    values = {"app_env": "production", "session_secret": "x" * 64, "ip_hash_salt": "y" * 40}
    values.update(overrides)
    with pytest.raises((ConfigError, ValidationError)):
        make_settings(**values)


# --- secrets never leak -----------------------------------------------------------------------


def test_xai_key_never_in_responses_or_logs(
    fake_provider: FakeProvider, caplog: pytest.LogCaptureFixture
) -> None:
    redactor.register([TEST_XAI_KEY])
    fake_provider.steps = [
        ok(recorded("theme_suggest.valid.json")),
        Exception(f"provider exploded with {TEST_XAI_KEY}"),
    ]
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(JsonFormatter())
    logging.getLogger().addHandler(handler)
    try:
        with caplog.at_level(logging.DEBUG), build_client(make_settings(), fake_provider) as c:
            texts = [c.get("/api/v1/ai/status"), c.get("/api/v1/health"), c.get("/api/v1/x")]
            texts.append(c.post(SUGGEST, json=suggest_body("theme.suggest")))
            texts.append(c.post(SUGGEST, json=suggest_body("theme.suggest")))
            texts.append(c.post(SUGGEST, json={"contract": "nope"}))
            texts.append(c.get("/openapi.json"))
            logging.getLogger("toranly.test").warning("leak check %s", TEST_XAI_KEY)
    finally:
        logging.getLogger().removeHandler(handler)
    for r in texts:
        assert TEST_XAI_KEY not in r.text
        assert TEST_XAI_KEY not in json.dumps(dict(r.headers))
    output = stream.getvalue()
    assert output, "expected log lines"
    assert TEST_XAI_KEY not in output
    assert "[REDACTED]" in output


def test_web_build_contains_no_xai_secrets() -> None:
    dist = REPO / "web" / "dist"
    if not dist.is_dir():
        pytest.skip("web/dist not built; run `npm --prefix web run build` first")
    patterns = [
        re.compile(rb"xai-[A-Za-z0-9]{20,}"),
        re.compile(rb"api\.x\.ai"),
        re.compile(rb"XAI_"),
    ]
    env_file = REPO / "backend" / ".env"
    if env_file.is_file():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            key, _, value = line.partition("=")
            value = value.split("#")[0].strip().strip('"')
            if key.strip() in {"XAI_API_KEY", "SESSION_SECRET", "IP_HASH_SALT"} and len(value) >= 8:
                patterns.append(re.compile(re.escape(value.encode())))
    hits = []
    for path in dist.rglob("*"):
        if path.is_file():
            data = path.read_bytes()
            hits += [f"{path.name}: {p.pattern!r}" for p in patterns if p.search(data)]
    assert hits == []


def test_origin_header_value_is_exact(client: TestClient) -> None:
    assert ORIGIN == "http://testserver"


def test_middleware_problems_include_instance(client: TestClient) -> None:
    client.headers.pop("Origin")
    r = client.post("/api/v1/plan/template", json={"type": "birthday"})
    assert r.status_code == 403 and r.json()["instance"] == "/api/v1/plan/template"


def test_production_warns_about_missing_origin_and_proxy(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.WARNING, logger="toranly.config"):
        make_settings(app_env="production", session_secret="x" * 64, ip_hash_salt="y" * 40)
    text = " ".join(r.getMessage() for r in caplog.records)
    assert "APP_ORIGIN is empty" in text and "TRUSTED_PROXY_CIDRS is empty" in text
