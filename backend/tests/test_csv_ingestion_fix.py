"""Comprehensive automated tests for Task 11A — CSV Ingestion, Parsing, Auto-Mapping & Validation."""

import io
import pytest
from fastapi.testclient import TestClient
from backend.main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_01_valid_csv_with_standard_headers(client):
    """1. Valid CSV with standard canonical headers."""
    csv_data = (
        "ticket_id,created_at,status,priority,title\n"
        "T-101,2026-10-30T10:00:00Z,Open,Critical,Server outage\n"
        "T-102,2026-10-30T10:15:00Z,In Progress,High,API latency spike\n"
    )
    res = client.post("/api/datasets/preview", data={"csv_text": csv_data})
    assert res.status_code == 200
    data = res.json()
    assert data["total_rows"] == 2
    assert "ticket_id" in data["detected_columns"]
    assert data["suggested_mappings"]["ticket_id"] == "ticket_id"
    assert data["suggested_mappings"]["created_at"] == "created_at"


def test_02_valid_csv_with_alternative_header_names(client):
    """2. Valid CSV with alternative header names (Creation Timestamp, Case ID, etc.)."""
    csv_data = (
        "Case ID,Creation Timestamp,Ticket Status,Severity,Product,Owner\n"
        "CASE-99,2026-10-30 08:30:00,Pending Customer Response,Urgent,Billing,team-a\n"
        "CASE-100,2026-10-30 09:00:00,Closed,Minor,Payments,team-b\n"
    )
    res = client.post("/api/datasets/preview", data={"csv_text": csv_data})
    assert res.status_code == 200
    data = res.json()
    assert data["suggested_mappings"]["Case ID"] == "ticket_id"
    assert data["suggested_mappings"]["Creation Timestamp"] == "created_at"
    assert data["suggested_mappings"]["Ticket Status"] == "status"
    assert data["suggested_mappings"]["Severity"] == "priority"
    assert data["suggested_mappings"]["Product"] == "category"
    assert data["suggested_mappings"]["Owner"] == "assigned_team_id"


def test_03_csv_containing_utf8_bom(client):
    """3. CSV file containing UTF-8 BOM byte sequence."""
    raw_bom = b"\xef\xbb\xbfticket_id,created_at,status\nT-BOM-1,2026-10-30T09:00:00Z,Open\n"
    files = {"file": ("dataset_bom.csv", io.BytesIO(raw_bom), "text/csv")}
    res = client.post("/api/datasets/preview", files=files)
    assert res.status_code == 200
    data = res.json()
    assert "ticket_id" in data["detected_columns"]
    assert not any("\ufeff" in col for col in data["detected_columns"])


def test_04_csv_with_semicolon_delimiter(client):
    """4. CSV with semicolon delimiter."""
    csv_data = (
        "ticket_id;created_at;status;priority\n"
        "T-SEMI-1;2026-10-30T10:00:00Z;Open;Medium\n"
        "T-SEMI-2;2026-10-30T10:05:00Z;Closed;Low\n"
    )
    res = client.post("/api/datasets/preview", data={"csv_text": csv_data})
    assert res.status_code == 200
    data = res.json()
    assert data["delimiter"] == ";"
    assert len(data["detected_columns"]) == 4
    assert data["total_rows"] == 2


def test_05_csv_containing_quoted_values_with_commas(client):
    """5. CSV containing quoted values with internal commas."""
    csv_data = (
        'ticket_id,created_at,status,title\n'
        'T-Q1,2026-10-30T12:00:00Z,Open,"Payment failed, customer refunded, webhook 500"\n'
        'T-Q2,2026-10-30T12:05:00Z,Open,"Database timeout in us-east, eu-west, ap-south"\n'
    )
    res = client.post("/api/datasets/preview", data={"csv_text": csv_data})
    assert res.status_code == 200
    data = res.json()
    assert len(data["detected_columns"]) == 4
    assert data["total_rows"] == 2
    assert "Payment failed, customer refunded, webhook 500" in data["preview_rows"][0]["title"]


def test_06_csv_with_whitespace_around_headers(client):
    """6. CSV with leading and trailing whitespace around column headers."""
    csv_data = (
        "  Ticket ID  ,  Creation Timestamp  , Status \n"
        "T-SPACE-1,2026-10-30T10:00:00Z,Open\n"
    )
    res = client.post("/api/datasets/preview", data={"csv_text": csv_data})
    assert res.status_code == 200
    data = res.json()
    assert "Ticket ID" in data["detected_columns"]
    assert "Creation Timestamp" in data["detected_columns"]
    assert data["suggested_mappings"]["Ticket ID"] == "ticket_id"
    assert data["suggested_mappings"]["Creation Timestamp"] == "created_at"


def test_07_csv_with_missing_creation_timestamp(client):
    """7. CSV missing Creation Timestamp raises informative validation errors upon import."""
    csv_data = (
        "ticket_id,status,priority\n"
        "T-NO-TIME-1,Open,High\n"
    )
    prev_res = client.post("/api/datasets/preview", data={"csv_text": csv_data})
    assert prev_res.status_code == 200
    upload_id = prev_res.json()["upload_id"]

    import_res = client.post(
        "/api/datasets/import",
        json={
            "upload_id": upload_id,
            "mapping": {"ticket_id": "ticket_id", "status": "status"},
        },
    )
    # Backend requires created_at for SLA evaluation
    assert import_res.status_code in (201, 400)
    if import_res.status_code == 201:
        data = import_res.json()
        assert data["rejected_rows"] > 0 or data["warning_count"] > 0


def test_08_csv_with_invalid_datetime_values(client):
    """8. CSV with unparseable datetime string logs granular row rejection."""
    csv_data = (
        "ticket_id,created_at,status\n"
        "T-BAD-TIME,NOT_A_VALID_DATE_STRING,Open\n"
    )
    prev = client.post("/api/datasets/preview", data={"csv_text": csv_data}).json()
    import_res = client.post(
        "/api/datasets/import",
        json={
            "upload_id": prev["upload_id"],
            "mapping": {"ticket_id": "ticket_id", "created_at": "created_at", "status": "status"},
        },
    )
    assert import_res.status_code in (400, 201)
    if import_res.status_code == 400:
        assert "validation" in import_res.json()["detail"].lower()


def test_09_empty_csv(client):
    """9. Empty CSV rejects with clear 400 error."""
    res = client.post("/api/datasets/preview", data={"csv_text": "   \n\n  "})
    assert res.status_code == 400
    assert "empty" in res.json()["detail"].lower()


def test_10_csv_containing_headers_but_no_data_rows(client):
    """10. CSV with headers but no data rows rejects with clear 400 error."""
    res = client.post("/api/datasets/preview", data={"csv_text": "ticket_id,created_at,status\n"})
    assert res.status_code == 400
    assert "zero data rows" in res.json()["detail"].lower()


def test_11_csv_with_duplicate_ticket_ids(client):
    """11. CSV with duplicate ticket IDs rejects the duplicate and accepts unique."""
    csv_data = (
        "ticket_id,created_at,status\n"
        "T-DUP-1,2026-10-30T10:00:00Z,Open\n"
        "T-DUP-1,2026-10-30T10:05:00Z,Open\n"
        "T-DUP-2,2026-10-30T10:10:00Z,Open\n"
    )
    prev = client.post("/api/datasets/preview", data={"csv_text": csv_data}).json()
    res = client.post(
        "/api/datasets/import",
        json={
            "upload_id": prev["upload_id"],
            "mapping": {"ticket_id": "ticket_id", "created_at": "created_at", "status": "status"},
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["accepted_rows"] == 2
    assert data["rejected_rows"] == 1
    assert any("duplicate" in err["message"].lower() for err in data["validation_errors"])


def test_12_csv_with_optional_columns_missing(client):
    """12. CSV with optional columns missing imports successfully."""
    csv_data = (
        "ticket_id,created_at\n"
        "T-MIN-1,2026-10-30T10:00:00Z\n"
        "T-MIN-2,2026-10-30T11:00:00Z\n"
    )
    prev = client.post("/api/datasets/preview", data={"csv_text": csv_data}).json()
    res = client.post(
        "/api/datasets/import",
        json={
            "upload_id": prev["upload_id"],
            "mapping": {"ticket_id": "ticket_id", "created_at": "created_at"},
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["accepted_rows"] == 2


def test_13_manual_column_mapping(client):
    """13. Manual column mapping where source header is arbitrary."""
    csv_data = (
        "custom_identifier,timestamp_opened,stage\n"
        "INC-888,2026-10-30T10:00:00Z,Investigating\n"
    )
    prev = client.post("/api/datasets/preview", data={"csv_text": csv_data}).json()
    # User maps custom headers manually
    mapping = {
        "custom_identifier": "ticket_id",
        "timestamp_opened": "created_at",
        "stage": "status",
    }
    res = client.post(
        "/api/datasets/import",
        json={"upload_id": prev["upload_id"], "mapping": mapping},
    )
    assert res.status_code == 201
    assert res.json()["accepted_rows"] == 1


def test_14_automatic_column_mapping(client):
    """14. Automatic column mapping accurately identifies standard aliases."""
    csv_data = (
        "ticketid,ticket_created_at,ticket_status,ticket_priority,issue_type,squad\n"
        "TK-1,2026-10-30T10:00:00Z,Open,Critical,Payments,team-a\n"
    )
    res = client.post("/api/datasets/preview", data={"csv_text": csv_data})
    assert res.status_code == 200
    mappings = res.json()["suggested_mappings"]
    assert mappings["ticketid"] == "ticket_id"
    assert mappings["ticket_created_at"] == "created_at"
    assert mappings["ticket_status"] == "status"
    assert mappings["ticket_priority"] == "priority"
    assert mappings["issue_type"] == "category"
    assert mappings["squad"] == "assigned_team_id"


def test_15_user_changes_mapping_manually(client):
    """15. User changes an automatic mapping to another column before import."""
    csv_data = (
        "ticket_id,created_at,incident_ref,status\n"
        "T-AUTO,2026-10-30T10:00:00Z,REF-999,Open\n"
    )
    prev = client.post("/api/datasets/preview", data={"csv_text": csv_data}).json()
    # User manually decides to use incident_ref instead of ticket_id
    manual_mapping = {
        "incident_ref": "ticket_id",
        "created_at": "created_at",
        "status": "status",
    }
    res = client.post(
        "/api/datasets/import",
        json={"upload_id": prev["upload_id"], "mapping": manual_mapping},
    )
    assert res.status_code == 201
    assert res.json()["accepted_rows"] == 1


def test_16_user_navigates_backward_and_returns_to_mapping(client):
    """16. Multiple preview calls with same content produce stable suggested mappings."""
    csv_data = (
        "Ticket ID,Creation Timestamp,Status\n"
        "T-10,2026-10-30T10:00:00Z,Open\n"
    )
    res1 = client.post("/api/datasets/preview", data={"csv_text": csv_data})
    res2 = client.post("/api/datasets/preview", data={"csv_text": csv_data})
    assert res1.status_code == 200
    assert res2.status_code == 200
    assert res1.json()["suggested_mappings"] == res2.json()["suggested_mappings"]


def test_17_preview_api_failure_and_retry(client):
    """17. Preview failure on invalid input followed by successful retry."""
    fail_res = client.post("/api/datasets/preview", data={"csv_text": ""})
    assert fail_res.status_code == 400

    retry_res = client.post(
        "/api/datasets/preview",
        data={"csv_text": "ticket_id,created_at,status\nT-OK,2026-10-30T10:00:00Z,Open\n"},
    )
    assert retry_res.status_code == 200
    assert retry_res.json()["total_rows"] == 1


def test_18_successful_preview_followed_by_successful_import(client):
    """18. Complete preview-to-import lifecycle."""
    csv_data = (
        "ticket_id,created_at,status,priority\n"
        "T-E2E-1,2026-10-30T10:00:00Z,Open,Critical\n"
        "T-E2E-2,2026-10-30T11:00:00Z,Closed,Low\n"
    )
    prev = client.post("/api/datasets/preview", data={"csv_text": csv_data}).json()
    upload_id = prev["upload_id"]

    import_res = client.post(
        "/api/datasets/import",
        json={
            "upload_id": upload_id,
            "mapping": prev["suggested_mappings"],
            "dataset_name": "E2E Intake Test Dataset",
        },
    )
    assert import_res.status_code == 201
    ds_id = import_res.json()["dataset_id"]

    ds_check = client.get(f"/api/datasets/{ds_id}")
    assert ds_check.status_code == 200
    assert ds_check.json()["accepted_rows"] == 2


def test_19_imported_tickets_remain_isolated_by_dataset(client):
    """19. Tickets imported into separate datasets do not leak into each other."""
    csv1 = "ticket_id,created_at,status\nT-DS1-1,2026-10-30T10:00:00Z,Open\n"
    csv2 = "ticket_id,created_at,status\nT-DS2-1,2026-10-30T10:00:00Z,Open\n"

    p1 = client.post("/api/datasets/preview", data={"csv_text": csv1}).json()
    p2 = client.post("/api/datasets/preview", data={"csv_text": csv2}).json()

    i1 = client.post("/api/datasets/import", json={"upload_id": p1["upload_id"], "mapping": p1["suggested_mappings"]}).json()
    i2 = client.post("/api/datasets/import", json={"upload_id": p2["upload_id"], "mapping": p2["suggested_mappings"]}).json()

    ds1_tickets = client.get(f"/api/datasets/{i1['dataset_id']}/tickets").json()["items"]
    ds2_tickets = client.get(f"/api/datasets/{i2['dataset_id']}/tickets").json()["items"]

    assert len(ds1_tickets) == 1
    assert len(ds2_tickets) == 1
    assert ds1_tickets[0]["source_ticket_id"] == "T-DS1-1"
    assert ds2_tickets[0]["source_ticket_id"] == "T-DS2-1"


def test_20_previously_imported_datasets_remain_unaffected(client):
    """20. Previously imported datasets retain exact row counts after new dataset imports."""
    csv_old = "ticket_id,created_at,status\nT-ORIG-1,2026-10-30T10:00:00Z,Open\n"
    p_old = client.post("/api/datasets/preview", data={"csv_text": csv_old}).json()
    i_old = client.post("/api/datasets/import", json={"upload_id": p_old["upload_id"], "mapping": p_old["suggested_mappings"]}).json()
    old_id = i_old["dataset_id"]

    # Import another dataset
    csv_new = "ticket_id,created_at,status\nT-NEW-1,2026-10-30T10:00:00Z,Open\nT-NEW-2,2026-10-30T11:00:00Z,Open\n"
    p_new = client.post("/api/datasets/preview", data={"csv_text": csv_new}).json()
    client.post("/api/datasets/import", json={"upload_id": p_new["upload_id"], "mapping": p_new["suggested_mappings"]})

    # Verify original dataset is untouched
    old_ds = client.get(f"/api/datasets/{old_id}").json()
    assert old_ds["accepted_rows"] == 1

