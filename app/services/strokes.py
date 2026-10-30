from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.database import SessionLocal
from app.models import Stroke


def get_strokes(file_id, page):
    db = SessionLocal()

    try:
        statement = (
            select(Stroke)
            .where(
                Stroke.file_id == file_id,
                Stroke.page == page,
                Stroke.deleted_at.is_(None),
            )
            .order_by(Stroke.created_at)
        )

        result = db.execute(statement)

        return result.scalars().all()

    finally:
        db.close()


def save_strokes(rows):
    db = SessionLocal()

    try:
        statement = (
            insert(Stroke)
            .values(rows)
            .on_conflict_do_nothing(index_elements=[Stroke.id])
        )
        db.execute(statement)
        db.commit()
    except Exception:
        db.rollback()
        raise

    finally:
        db.close()
