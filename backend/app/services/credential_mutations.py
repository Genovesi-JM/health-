"""Optimistic dossier mutations shared by applicant and reviewer entry points."""
from dataclasses import dataclass
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.health_models import ClinicianCredential


@dataclass(frozen=True)
class CredentialRevision:
    id: str
    status: str
    updated_at: datetime

    @classmethod
    def capture(cls, credential: ClinicianCredential) -> "CredentialRevision":
        # Capture before file/provider I/O; do not silently refresh this revision.
        return cls(credential.id, credential.status, credential.updated_at)


def mutate_credential(db: Session, credential: ClinicianCredential, *,
                      revision: CredentialRevision, **values) -> None:
    """Change only the revision the caller validated, leaving commit to caller.

    The conditional UPDATE also holds the PostgreSQL row lock until evidence,
    role/profile changes and audit are committed. Other participating writers
    wait and then conflict; SQLite does not need unsupported FOR UPDATE locks.
    Call before staging ORM changes to this dossier or its evidence.
    """
    if credential.id != revision.id:
        raise ValueError("Credential revision belongs to another dossier")
    values["updated_at"] = max(datetime.utcnow(), revision.updated_at + timedelta(microseconds=1))
    table = ClinicianCredential.__table__
    with db.no_autoflush:
        result = db.execute(update(table).where(
            table.c.id == revision.id,
            table.c.status == revision.status,
            table.c.updated_at == revision.updated_at,
        ).values(**values))
        if result.rowcount != 1:
            db.rollback()
            raise HTTPException(409, "A candidatura mudou. Atualize o processo antes de continuar.")
        db.refresh(credential)
