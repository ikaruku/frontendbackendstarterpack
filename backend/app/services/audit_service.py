"""Audit log recording and retrieval. Never log plain passwords or secrets."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditLog


def record_audit(
    session: Session,
    actor_user_id: int | None,
    action: str,
    target: str | None = None,
    detail: dict | None = None,
) -> None:
    """Append an audit log row inside the active transaction."""
    session.add(
        AuditLog(
            actor_user_id=actor_user_id,
            action=action,
            target=target,
            detail=detail,
        )
    )


def list_audit_logs(session: Session, limit: int = 50) -> list[AuditLog]:
    """Return most recent audit entries."""
    stmt = select(AuditLog).order_by(AuditLog.id.desc()).limit(min(limit, 200))
    return list(session.scalars(stmt).all())
