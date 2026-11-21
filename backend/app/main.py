"""FastAPI application entry point."""

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api import audit, auth, menus, users, ws
from app.core.config import settings
from app.db.session import get_session

app = FastAPI(title='Admin Panel API', version='0.1.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(menus.router)
app.include_router(audit.router)
app.include_router(ws.router)


@app.get('/api/health')
def health(session: Session = Depends(get_session)) -> dict[str, str]:
    session.execute(text('SELECT 1'))
    return {'status': 'ok'}
