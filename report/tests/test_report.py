import csv
import io

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)
CUSTOMER_ID = "11111111-1111-4111-8111-111111111111"
URL = f"/reports/{CUSTOMER_ID}/2026-01"
HEADERS = {"Authorization": "Bearer lab-report-token"}
ORDERS = [
    {"status": "open", "amountCents": 2450},
    {"status": "shipped", "amountCents": 1800},
    {"status": "cancelled", "amountCents": 999},
]


def test_S08_report_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer wrong"}])
def test_S03_requires_service_token(headers):
    response = client.post(URL, headers=headers, json={"orders": []})
    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"


def test_S03_uses_configured_service_token(monkeypatch):
    monkeypatch.setenv("REPORT_TOKEN", "custom-test-token")
    assert client.post(URL, headers=HEADERS, json={"orders": []}).status_code == 401
    response = client.post(
        URL, headers={"Authorization": "Bearer custom-test-token"}, json={"orders": []}
    )
    assert response.status_code == 200


def test_S03_summarizes_month_as_json():
    response = client.post(URL, headers=HEADERS, json={"orders": ORDERS})
    assert response.status_code == 200
    assert response.json() == {
        "customerId": CUSTOMER_ID,
        "month": "2026-01",
        "orderCount": 3,
        "openCount": 1,
        "shippedCount": 1,
        "cancelledCount": 1,
        "totalAmountCents": 4250,
    }


def test_S03_returns_the_same_summary_in_csv():
    response = client.post(f"{URL}?format=csv", headers=HEADERS, json={"orders": ORDERS})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert response.headers["content-disposition"] == 'attachment; filename="orders-2026-01.csv"'
    rows = list(csv.DictReader(io.StringIO(response.text)))
    assert rows == [{
        "customerId": CUSTOMER_ID,
        "month": "2026-01",
        "orderCount": "3",
        "openCount": "1",
        "shippedCount": "1",
        "cancelledCount": "1",
        "totalAmountCents": "4250",
    }]


def test_S03_empty_month_has_zero_orders_and_amount():
    response = client.post(URL, headers=HEADERS, json={"orders": []})
    assert response.status_code == 200
    assert response.json()["totalAmountCents"] == response.json()["orderCount"] == 0


@pytest.mark.parametrize("month", ["2026-13", "2026-1", "0000-01"])
def test_S07_rejects_invalid_month(month):
    response = client.post(f"/reports/{CUSTOMER_ID}/{month}", headers=HEADERS, json={"orders": []})
    assert response.status_code == 422


def test_S07_rejects_malformed_customer_id():
    response = client.post("/reports/invalid/2026-01", headers=HEADERS, json={"orders": []})
    assert response.status_code == 422


def test_S07_rejects_unknown_output_format():
    response = client.post(f"{URL}?format=xml", headers=HEADERS, json={"orders": []})
    assert response.status_code == 422


@pytest.mark.parametrize("row", [
    {"status": "paused", "amountCents": 100},
    {"status": "open", "amountCents": -100},
    {"status": "open", "amountCents": "100"},
    {"status": "open", "amountCents": 100_000_001},
])
def test_S07_rejects_invalid_order_line(row):
    response = client.post(URL, headers=HEADERS, json={"orders": [row]})
    assert response.status_code == 422
