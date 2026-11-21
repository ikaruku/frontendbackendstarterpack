"""Audit log inspection routes."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import require_permission
from app.db.session import get_session
from app.models import User
from app.schemas.user import AuditLogOut
from app.services.audit_service import list_audit_logs

router = APIRouter(prefix='/api/audit-logs', tags=['Audit'])


@router.get('', response_model=list[AuditLogOut])
def get_audit_logs(
    limit: int = Query(default=50, ge=1, le=200),
    _actor: User = Depends(require_permission('user_management', 'read')),
    session: Session = Depends(get_session),
) -> list[AuditLogOut]:
    return [AuditLogOut.model_validate(row) for row in list_audit_logs(session, limit=limit)]
