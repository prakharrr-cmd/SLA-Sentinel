"""Comprehensive automated tests for Dataset Intake & Validation Pipeline."""

import io
from pathlib import Path
import pytest
import openpyxl

from backend.models import Team


def test_preview_valid_csv(client):
    """Verify preview of valid CSV returns detected columns, inferred types, and suggested mappings."""
    csv_content = (
        "ticket_id,problem,category,priority,created_at,resolution_deadline,assigned_team\n"
        "T101,Login failure,Auth,High,2026-10-29 10:00:00,2026-10-29 18:00:00,team-a\n"
        "T102,Payment timeout,Billing,Medium,2026-10-29 11:00:00,2026-10-30 11:00:00,team-b\n"
    )

    response = client.post(
        "/api/datasets/preview",
        files={"file": ("tickets.csv", csv_content.encode("utf-8"), "text/csv")},
    )
    assert response.status_code == 200
    data = response.json()
    assert "upload_id" in data
    assert data["filename"] == "tickets.csv"
    assert data["file_format"] == "csv"
    assert "ticket_id" in data["detected_columns"]
    assert data["suggested_mappings"]["ticket_id"] == "ticket_id"
    assert data["suggested_mappings"]["problem"] == "title"
    assert data["total_rows"] == 2
    assert len(data["preview_rows"]) == 2


def test_preview_and_import_demonstration_csv(client):
    """Verify preview and full import of the exact demonstration CSV schema."""
    demo_csv_with_created = (
        "ticket_id,problem,category,priority,created_at,pending_hours,deadline_hours_left,assigned_team,status\n"
        "T103,Server down in US-East,Infrastructure,Critical,2026-10-29 12:00:00,1.0,0.5,Team C,Pending\n"
        "T104,Refund delay,Billing,High,2026-10-29 10:00:00,10.0,-2.0,Team A,Escalated\n"
    )

    prev_res = client.post("/api/datasets/preview", data={"csv_text": demo_csv_with_created})
    assert prev_res.status_code == 200
    upload_id = prev_res.json()["upload_id"]

    mapping = {
        "ticket_id": "ticket_id",
        "problem": "title",
        "category": "category",
        "priority": "priority",
        "created_at": "created_at",
        "assigned_team": "assigned_team_id",
        "status": "status",
    }

    import_res = client.post(
        "/api/datasets/import",
        json={
            "upload_id": upload_id,
            "mapping": mapping,
            "dataset_name": "Demo Ingest",
        },
    )
    assert import_res.status_code == 201
    import_data = import_res.json()
    assert import_data["status"] == "completed"
    assert import_data["accepted_rows"] == 2
    assert import_data["rejected_rows"] == 0
    assert "ds_" in import_data["dataset_id"]


def test_preview_and_import_excel_xlsx(client):
    """Verify parsing and importing of an Excel (.xlsx) file with sheet selection."""
    wb = openpyxl.Workbook()
    ws1 = wb.active
    ws1.title = "TicketsSheet"
    ws1.append(["Ticket ID", "Ticket Subject", "Ticket Priority", "Ticket Created At", "Resolution Deadline"])
    ws1.append(["XLSX-1", "Database lockup", "High", "2026-10-29 14:00:00", "2026-10-30 14:00:00"])
    ws1.append(["XLSX-2", "UI alignment bug", "Low", "2026-10-29 15:00:00", "2026-10-31 15:00:00"])

    excel_buffer = io.BytesIO()
    wb.save(excel_buffer)
    excel_buffer.seek(0)

    # Preview
    response = client.post(
        "/api/datasets/preview",
        files={"file": ("tickets.xlsx", excel_buffer.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert response.status_code == 200
    p_data = response.json()
    assert p_data["file_format"] == "xlsx"
    assert p_data["sheet_names"] == ["TicketsSheet"]
    assert p_data["selected_sheet"] == "TicketsSheet"
    assert p_data["total_rows"] == 2

    # Import
    mapping = {
        "Ticket ID": "ticket_id",
        "Ticket Subject": "title",
        "Ticket Priority": "priority",
        "Ticket Created At": "created_at",
        "Resolution Deadline": "resolution_deadline",
    }
    imp_res = client.post(
        "/api/datasets/import",
        json={
            "upload_id": p_data["upload_id"],
            "mapping": mapping,
            "dataset_name": "Excel Dataset",
        },
    )
    assert imp_res.status_code == 201
    assert imp_res.json()["accepted_rows"] == 2


def test_utf8_bom_handling(client):
    """Verify CSV with UTF-8 BOM header is correctly parsed without polluting column names."""
    bom_csv = "\ufeffticket_id,title,created_at\nBOM-1,Subject test,2026-10-29 10:00:00\n"
    response = client.post(
        "/api/datasets/preview",
        files={"file": ("bom.csv", bom_csv.encode("utf-8-sig"), "text/csv")},
    )
    assert response.status_code == 200
    data = response.json()
    assert "ticket_id" in data["detected_columns"]
    assert not data["detected_columns"][0].startswith("\ufeff")


def test_missing_required_mapping_raises_400(client):
    """Verify import without mapping 'ticket_id' raises HTTP 400."""
    csv_text = "id,name,created_at\n1,Issue,2026-10-29 10:00:00\n"
    bad_mapping = {"name": "title", "created_at": "created_at"}

    response = client.post(
        "/api/datasets/import",
        json={
            "csv_text": csv_text,
            "mapping": bad_mapping,
        },
    )
    assert response.status_code == 400
    assert "ticket_id" in response.json()["detail"]


def test_missing_ticket_ids_and_duplicates_rejected(client):
    """Verify rows with blank ticket_id or duplicate ticket_ids are rejected and reported."""
    csv_text = (
        "ticket_id,title,created_at\n"
        "DUP-1,First occurrence,2026-10-29 10:00:00\n"
        ",Missing ID row,2026-10-29 10:05:00\n"
        "DUP-1,Second occurrence duplicate,2026-10-29 10:10:00\n"
        "VALID-2,Valid row,2026-10-29 10:15:00\n"
    )
    mapping = {"ticket_id": "ticket_id", "title": "title", "created_at": "created_at"}

    response = client.post(
        "/api/datasets/import",
        json={"csv_text": csv_text, "mapping": mapping},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "partial"
    assert data["total_rows"] == 4
    assert data["accepted_rows"] == 2
    assert data["rejected_rows"] == 2
    errors = data["validation_errors"]
    assert any("Missing or empty required Ticket ID" in e["message"] for e in errors)
    assert any("Duplicate ticket ID 'DUP-1'" in e["message"] for e in errors)


def test_unsupported_file_formats(client):
    """Verify uploading unsupported formats (.txt, .pdf, legacy .xls) is rejected with clear error."""
    # Legacy .xls
    res_xls = client.post(
        "/api/datasets/preview",
        files={"file": ("old.xls", b"binarycontent", "application/vnd.ms-excel")},
    )
    assert res_xls.status_code == 400
    assert "Legacy Excel .xls format is unsupported" in res_xls.json()["detail"]

    # .pdf
    res_pdf = client.post(
        "/api/datasets/preview",
        files={"file": ("doc.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert res_pdf.status_code == 400
    assert "Unsupported file type" in res_pdf.json()["detail"]


def test_empty_file_rejected(client):
    """Verify empty (0 bytes) file is rejected."""
    response = client.post(
        "/api/datasets/preview",
        files={"file": ("empty.csv", b"", "text/csv")},
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_completely_invalid_dataset_does_not_persist(client):
    """Verify import with 0 valid rows does not persist records."""
    csv_text = (
        "ticket_id,title,created_at\n"
        ",No ID 1,2026-10-29 10:00:00\n"
        ",No ID 2,2026-10-29 10:00:00\n"
    )
    mapping = {"ticket_id": "ticket_id", "title": "title", "created_at": "created_at"}

    response = client.post(
        "/api/datasets/import",
        json={"csv_text": csv_text, "mapping": mapping},
    )
    assert response.status_code == 400
    assert "0 of 2 rows were accepted" in response.json()["detail"]

    # Verify 0 datasets in database
    list_res = client.get("/api/datasets")
    assert len(list_res.json()) == 0


def test_dot_timestamp_and_real_dataset_sample(client):
    """Verify the timestamp format with dots e.g. '31-05-2023 19.14' from the real CSV parses accurately."""
    real_sample_csv = (
        "Ticket ID,Customer Name,Ticket Type,Ticket Subject,Ticket Priority,Ticket Created At,Response Deadline,Resolution Deadline\n"
        "1,Marisa,Technical issue,Product setup,Medium,31-05-2023 19.14,31-05-2023 20.14,01-06-2023 3.14\n"
        "2,Jessica,Technical issue,Peripheral compatibility,Low,01-06-2023 3.44,01-06-2023 4.44,01-06-2023 11.44\n"
    )

    prev_res = client.post("/api/datasets/preview", data={"csv_text": real_sample_csv})
    assert prev_res.status_code == 200
    u_id = prev_res.json()["upload_id"]

    mapping = {
        "Ticket ID": "ticket_id",
        "Ticket Subject": "title",
        "Ticket Type": "category",
        "Ticket Priority": "priority",
        "Ticket Created At": "created_at",
        "Response Deadline": "response_deadline",
        "Resolution Deadline": "resolution_deadline",
    }

    imp_res = client.post(
        "/api/datasets/import",
        json={"upload_id": u_id, "mapping": mapping, "dataset_name": "Real CSV Sample"},
    )
    assert imp_res.status_code == 201
    data = imp_res.json()
    assert data["accepted_rows"] == 2
    assert data["rejected_rows"] == 0

    # Retrieve dataset and verify ticket timestamps
    dataset_id = data["dataset_id"]
    tickets_res = client.get(f"/api/datasets/{dataset_id}/tickets")
    assert tickets_res.status_code == 200
    tickets_data = tickets_res.json()
    assert tickets_data["total"] == 2

    ticket_1 = tickets_data["items"][0]
    assert ticket_1["source_ticket_id"] == "1"
    assert "2023-05-31T19:14:00" in ticket_1["created_at"]
    assert "2023-05-31T20:14:00" in ticket_1["response_deadline"]
    assert "2023-06-01T03:14:00" in ticket_1["resolution_deadline"]
    assert "Customer Name" in ticket_1["original_values"]
    assert ticket_1["original_values"]["Customer Name"] == "Marisa"


def test_dataset_retrieval_and_isolation(client):
    """Verify multiple imported datasets remain isolated from each other and can be retrieved."""
    csv1 = "ticket_id,created_at\nDS1-A,2026-10-29 10:00:00\n"
    csv2 = "ticket_id,created_at\nDS2-A,2026-10-29 11:00:00\nDS2-B,2026-10-29 12:00:00\n"

    mapping = {"ticket_id": "ticket_id", "created_at": "created_at"}

    res1 = client.post("/api/datasets/import", json={"csv_text": csv1, "mapping": mapping, "dataset_name": "Batch 1"})
    res2 = client.post("/api/datasets/import", json={"csv_text": csv2, "mapping": mapping, "dataset_name": "Batch 2"})

    id1 = res1.json()["dataset_id"]
    id2 = res2.json()["dataset_id"]

    list_res = client.get("/api/datasets")
    assert len(list_res.json()) == 2

    t1_res = client.get(f"/api/datasets/{id1}/tickets")
    assert t1_res.json()["total"] == 1
    assert t1_res.json()["items"][0]["source_ticket_id"] == "DS1-A"

    t2_res = client.get(f"/api/datasets/{id2}/tickets")
    assert t2_res.json()["total"] == 2
    ids_in_2 = {t["source_ticket_id"] for t in t2_res.json()["items"]}
    assert ids_in_2 == {"DS2-A", "DS2-B"}


def test_impossible_durations_and_unregistered_teams_produce_warnings(client, test_db):
    """Verify impossible (negative) durations and unregistered teams generate warnings without rejecting."""
    # Register an active squad in DB so team data is available
    team = Team(id="team-main", name="Main Support", skill_tags=["Support"])
    test_db.add(team)
    test_db.commit()

    csv_text = (
        "ticket_id,created_at,time_to_res,assigned_team\n"
        "T-WARN,2026-10-29 10:00:00,-5.0,GhostSquad\n"
    )
    mapping = {
        "ticket_id": "ticket_id",
        "created_at": "created_at",
        "time_to_res": "resolution_duration",
        "assigned_team": "assigned_team_id",
    }

    imp_res = client.post(
        "/api/datasets/import",
        json={"csv_text": csv_text, "mapping": mapping},
    )
    assert imp_res.status_code == 201
    data = imp_res.json()
    assert data["accepted_rows"] == 1
    assert data["warning_count"] >= 1
    warnings = data["validation_warnings"]
    assert any("Negative resolution duration" in w["message"] for w in warnings)
    assert any("GhostSquad" in w["message"] for w in warnings)


def test_real_supplied_dataset_preview_and_intake(client):
    """Verify that the supplied 20-column customer_support_tickets_with_sla.csv can be previewed and imported."""
    real_csv_path = Path("customer_support_tickets_with_sla.csv")
    if not real_csv_path.exists():
        pytest.skip("customer_support_tickets_with_sla.csv not found in working directory")

    # Read a sample chunk (e.g. first 200 lines to keep test fast and responsive)
    with open(real_csv_path, "r", encoding="utf-8") as f:
        sample_lines = [f.readline() for _ in range(150)]
    sample_csv = "".join(sample_lines)

    # 1. Preview
    prev_res = client.post("/api/datasets/preview", data={"csv_text": sample_csv})
    assert prev_res.status_code == 200
    p_data = prev_res.json()
    assert len(p_data["detected_columns"]) == 20
    assert "Ticket ID" in p_data["detected_columns"]
    assert p_data["suggested_mappings"]["Ticket ID"] == "ticket_id"
    assert p_data["suggested_mappings"]["Ticket Subject"] == "title"
    assert p_data["suggested_mappings"]["Ticket Description"] == "description"
    assert p_data["suggested_mappings"]["Ticket Type"] == "category"
    assert p_data["suggested_mappings"]["Ticket Status"] == "status"
    assert p_data["suggested_mappings"]["Ticket Priority"] == "priority"
    assert p_data["suggested_mappings"]["Ticket Created At"] == "created_at"
    assert p_data["suggested_mappings"]["Response Deadline"] == "response_deadline"
    assert p_data["suggested_mappings"]["Resolution Deadline"] == "resolution_deadline"

    # 2. Import using suggested mappings
    imp_res = client.post(
        "/api/datasets/import",
        json={
            "upload_id": p_data["upload_id"],
            "mapping": p_data["suggested_mappings"],
            "dataset_name": "Real Support Tickets Ingest",
        },
    )
    assert imp_res.status_code == 201
    imp_data = imp_res.json()
    assert imp_data["accepted_rows"] > 0
    assert imp_data["status"] in {"completed", "partial"}
    assert "ds_" in imp_data["dataset_id"]

    # 3. Retrieve tickets and verify canonical attributes
    dataset_id = imp_data["dataset_id"]
    t_res = client.get(f"/api/datasets/{dataset_id}/tickets?page=1&page_size=10")
    assert t_res.status_code == 200
    t_data = t_res.json()
    assert len(t_data["items"]) > 0

    first_ticket = t_data["items"][0]
    assert first_ticket["source_ticket_id"] is not None
    assert first_ticket["status"] in {"Open", "Pending", "Closed", "Resolved", "In Progress", "Escalated"}
    assert first_ticket["priority"] in {"Critical", "High", "Medium", "Low"}
    assert first_ticket["created_at"] is not None
    # Verify unmapped source attributes like Customer Name / Email are retained in original_values
    assert "Customer Email" in first_ticket["original_values"]
    assert "Customer Name" in first_ticket["original_values"]


def test_dataset_persists_across_database_reconnect(tmp_path):
    """Verify that imported dataset records persist to disk and survive a database reconnect / restart."""
    import os
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from backend.models import Base, Dataset, ImportedTicket
    from backend.ingestion.service import execute_import

    db_path = tmp_path / "persistent_test.db"
    disk_db_url = f"sqlite:///{db_path}"

    # 1. Initialize and perform import
    engine1 = create_engine(disk_db_url)
    Base.metadata.create_all(bind=engine1)
    session_factory1 = sessionmaker(bind=engine1)
    session1 = session_factory1()

    csv_text = "ticket_id,title,created_at\nT-RESTART-1,Restart Test Issue,2026-10-29 10:00:00\n"
    mapping = {"ticket_id": "ticket_id", "title": "title", "created_at": "created_at"}

    import_res = execute_import(
        db=session1,
        mapping=mapping,
        csv_text=csv_text,
        dataset_name="Disk Persistence Test",
    )
    dataset_id = import_res["dataset_id"]
    session1.close()
    engine1.dispose()

    # 2. Simulate server restart: fresh engine connection to the same disk file
    engine2 = create_engine(disk_db_url)
    session_factory2 = sessionmaker(bind=engine2)
    session2 = session_factory2()

    saved_ds = session2.query(Dataset).filter(Dataset.id == dataset_id).first()
    assert saved_ds is not None
    assert saved_ds.name == "Disk Persistence Test"

    saved_tickets = session2.query(ImportedTicket).filter(ImportedTicket.dataset_id == dataset_id).all()
    assert len(saved_tickets) == 1
    assert saved_tickets[0].source_ticket_id == "T-RESTART-1"
    assert saved_tickets[0].title == "Restart Test Issue"

    session2.close()
    engine2.dispose()


def test_unknown_dataset_id_returns_404(client):
    """Verify requesting non-existent dataset details or tickets returns HTTP 404."""
    res_detail = client.get("/api/datasets/ds_nonexistent_999")
    assert res_detail.status_code == 404
    assert "not found" in res_detail.json()["detail"].lower()

    res_tickets = client.get("/api/datasets/ds_nonexistent_999/tickets")
    assert res_tickets.status_code == 404
    assert "not found" in res_tickets.json()["detail"].lower()


def test_imported_tickets_do_not_pollute_legacy_tickets_table(client, test_db):
    """Verify imported dataset records remain isolated and do not overwrite or duplicate into the legacy tickets table."""
    from backend.models import Ticket

    # 1. Seed legacy ticket "T101"
    legacy_ticket = Ticket(
        id="T101",
        title="Legacy production outage",
        category="Infrastructure",
        status="Open",
        sla_time_limit=12.0,
    )
    test_db.add(legacy_ticket)
    test_db.commit()

    # 2. Import a dataset with the SAME ticket ID "T101"
    import_csv = (
        "ticket_id,title,created_at\n"
        "T101,Imported billing inquiry,2026-10-29 10:00:00\n"
    )
    mapping = {"ticket_id": "ticket_id", "title": "title", "created_at": "created_at"}
    imp_res = client.post("/api/datasets/import", json={"csv_text": import_csv, "mapping": mapping, "dataset_name": "Conflict Isolation Test"})
    assert imp_res.status_code == 201
    dataset_id = imp_res.json()["dataset_id"]

    # 3. Verify legacy tickets table still has exactly 1 ticket with original legacy title
    legacy_tickets = client.get("/tickets").json()
    assert len(legacy_tickets) == 1
    assert legacy_tickets[0]["id"] == "T101"
    assert legacy_tickets[0]["title"] == "Legacy production outage"

    # 4. Verify imported dataset tickets contains the dataset's ticket
    ds_tickets = client.get(f"/api/datasets/{dataset_id}/tickets").json()
    assert ds_tickets["total"] == 1
    assert ds_tickets["items"][0]["source_ticket_id"] == "T101"
    assert ds_tickets["items"][0]["title"] == "Imported billing inquiry"


def test_missing_sla_deadline_data_is_preserved_without_fabrication(client):
    """Verify that importing tickets without deadline columns preserves None without fabricating artificial deadlines."""
    csv_text = "ticket_id,title,created_at\nT-NO-SLA,Issue without SLA,2026-10-29 10:00:00\n"
    mapping = {"ticket_id": "ticket_id", "title": "title", "created_at": "created_at"}

    imp_res = client.post("/api/datasets/import", json={"csv_text": csv_text, "mapping": mapping, "dataset_name": "No SLA Target Test"})
    assert imp_res.status_code == 201
    data = imp_res.json()
    assert data["accepted_rows"] == 1
    dataset_id = data["dataset_id"]

    # Verify coverage notes disclose missing deadline coverage
    detail_res = client.get(f"/api/datasets/{dataset_id}").json()
    coverage_notes = detail_res["validation_summary"]["metrics"]["coverage_notes"]
    assert any("No SLA deadline columns mapped" in note for note in coverage_notes)

    # Verify ticket has null deadlines without fabrication
    t_res = client.get(f"/api/datasets/{dataset_id}/tickets").json()
    ticket = t_res["items"][0]
    assert ticket["response_deadline"] is None
    assert ticket["resolution_deadline"] is None


def test_regression_existing_endpoints_preserved(client):
    """Verify existing /teams, /tickets, /tickets/{id}/sla-risk, and /tickets/{id}/assign work unchanged."""
    t_res = client.post("/teams", json={"id": "team-reg", "name": "Regression Team", "skill_tags": ["Infra"]})
    assert t_res.status_code == 201

    tk_res = client.post(
        "/tickets",
        json={
            "id": "TK-REG-1",
            "category": "Infra",
            "status": "Open",
            "sla_time_limit": 10.0,
        },
    )
    assert tk_res.status_code == 201

    risk_res = client.get("/tickets/TK-REG-1/sla-risk")
    assert risk_res.status_code == 200
    assert "risk_level" in risk_res.json()

    assign_res = client.post("/tickets/TK-REG-1/assign")
    assert assign_res.status_code == 200
    assert assign_res.json()["team_id"] == "team-reg"
