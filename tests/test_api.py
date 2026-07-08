import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_generate_requires_api_key():
    res = client.post("/api/generate", json={
        "kind": "cover_letter", "profile": "p", "opportunity": "o",
    })
    assert res.status_code == 401


def test_generate_with_key_returns_output():
    res = client.post(
        "/api/generate",
        headers={"X-API-Key": "dev-key"},
        json={"kind": "cover_letter", "profile": "Python dev", "opportunity": "Acme"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["kind"] == "cover_letter"
    assert body["output"]


def test_polish_with_key():
    res = client.post(
        "/api/polish",
        headers={"X-API-Key": "dev-key"},
        json={"text": "Saya suka coding", "mode": "translate"},
    )
    assert res.status_code == 200
    assert res.json()["output"]


def test_fetch_job_requires_api_key():
    res = client.post("/api/fetch-job", json={"url": "https://example.com"})
    assert res.status_code == 401


def test_applications_crud_roundtrip():
    # create
    res = client.post("/api/applications", json={"organization": "TestCo", "role": "Dev"})
    assert res.status_code == 201
    app_id = res.json()["id"]

    # list contains it
    res = client.get("/api/applications")
    assert any(a["id"] == app_id for a in res.json())

    # update status
    res = client.patch(f"/api/applications/{app_id}", json={"status": "applied"})
    assert res.status_code == 200
    assert res.json()["status"] == "applied"

    # delete
    res = client.delete(f"/api/applications/{app_id}")
    assert res.status_code == 204
