from app.models import ApplicationIn
from app.services.tracker import TrackerService


def _svc(tmp_path) -> TrackerService:
    return TrackerService(db_path=str(tmp_path / "test.db"))


def test_add_and_list(tmp_path):
    svc = _svc(tmp_path)
    app = svc.add(ApplicationIn(organization="Acme", role="Engineer", deadline="2026-08-01"))
    assert app.id > 0
    assert app.organization == "Acme"
    items = svc.list()
    assert len(items) == 1
    assert items[0].organization == "Acme"


def test_update_status(tmp_path):
    svc = _svc(tmp_path)
    app = svc.add(ApplicationIn(organization="Beta"))
    updated = svc.update_status(app.id, "applied")
    assert updated is not None
    assert updated.status == "applied"
    assert svc.update_status(9999, "applied") is None


def test_delete(tmp_path):
    svc = _svc(tmp_path)
    app = svc.add(ApplicationIn(organization="Gamma"))
    assert svc.delete(app.id) is True
    assert svc.delete(app.id) is False
    assert svc.list() == []


def test_list_orders_by_deadline(tmp_path):
    svc = _svc(tmp_path)
    svc.add(ApplicationIn(organization="NoDeadline"))
    svc.add(ApplicationIn(organization="Late", deadline="2026-12-01"))
    svc.add(ApplicationIn(organization="Early", deadline="2026-01-01"))
    orgs = [a.organization for a in svc.list()]
    # Earliest deadline first; empty deadline sinks to the bottom.
    assert orgs[0] == "Early"
    assert orgs[-1] == "NoDeadline"
