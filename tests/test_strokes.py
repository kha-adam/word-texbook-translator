import uuid

from app.database import SessionLocal
from app.models import File, Stroke
from tests.helpers import client, get_auth_headers


def make_stroke(page=1, n_points=3, stroke_id=None):
    return {
        "id": stroke_id or str(uuid.uuid4()),
        "page": page,
        "points": [[float(i), float(i) + 0.5, 0.5] for i in range(n_points)],
        "color": "#d00",
    }


# tests/test_strokes.py
#
# Written to match the style of the existing Cloudbox tests (module-level `client`,
# `SessionLocal`, `get_auth_headers()`), but NOT run against your code.
# Search for "ADAPT" below: those are the places that depend on your project.


from sqlalchemy import func, select, update

# ADAPT: use the same imports as your other test files, for example:
# from tests.conftest import client, get_auth_headers, SessionLocal
# from app.models import File, Stroke

MAX_POINTS = 5000  # ADAPT: the max_length you set on StrokeIn.points


def upload_pdf(headers):
    # ADAPT: route, field name and expected status of your plain upload endpoint
    response = client.post(
        "/files",
        files={"file": ("book.pdf", b"%PDF-1.4\n%test", "application/pdf")},
        headers=headers,
    )
    assert response.status_code in (200, 201)
    return response.json()["id"]


def second_user_headers():
    # ADAPT: your get_auth_headers() must be able to create a DIFFERENT user.
    # For example, give it an optional email parameter and call it like this:
    return get_auth_headers(email="other-user@example.com")


def save(file_id, strokes, headers):
    return client.post(
        f"/files/{file_id}/strokes",
        json={"strokes": strokes},
        headers=headers,
    )


def list_page(file_id, page, headers):
    return client.get(f"/files/{file_id}/pages/{page}/strokes", headers=headers)


# ---------- authentication ----------


def test_strokes_require_auth():
    # The file id does not matter: authentication is checked first.
    post = client.post("/files/1/strokes", json={"strokes": [make_stroke()]})
    get = client.get("/files/1/pages/1/strokes")

    assert post.status_code == 401
    assert get.status_code == 401


# ---------- saving and loading ----------


def test_save_and_list():
    headers = get_auth_headers()
    file_id = upload_pdf(headers)
    stroke = make_stroke(page=2)

    response = save(file_id, [stroke], headers)
    assert response.status_code == 204

    listed = list_page(file_id, 2, headers)
    assert listed.status_code == 200
    data = listed.json()
    assert len(data) == 1
    assert data[0]["id"] == stroke["id"]
    assert data[0]["page"] == 2
    assert data[0]["points"] == stroke["points"]
    assert data[0]["color"] == "#d00"


def test_pages_are_separate():
    headers = get_auth_headers()
    file_id = upload_pdf(headers)
    on_page_1 = make_stroke(page=1)
    on_page_2 = make_stroke(page=2)
    save(file_id, [on_page_1, on_page_2], headers)

    page_1 = list_page(file_id, 1, headers).json()
    page_2 = list_page(file_id, 2, headers).json()

    assert [s["id"] for s in page_1] == [on_page_1["id"]]
    assert [s["id"] for s in page_2] == [on_page_2["id"]]


def test_empty_page_returns_empty_list():
    headers = get_auth_headers()
    file_id = upload_pdf(headers)

    response = list_page(file_id, 7, headers)

    assert response.status_code == 200
    assert response.json() == []


# ---------- idempotency ----------


def test_save_is_idempotent():
    headers = get_auth_headers()
    file_id = upload_pdf(headers)
    batch = [make_stroke(), make_stroke()]

    first = save(file_id, batch, headers)
    second = save(
        file_id, batch, headers
    )  # e.g. the response was lost, browser retries

    assert first.status_code == 204
    assert second.status_code == 204
    assert len(list_page(file_id, 1, headers).json()) == 2


def test_duplicate_ids_inside_one_batch():
    headers = get_auth_headers()
    file_id = upload_pdf(headers)
    same_id = str(uuid.uuid4())
    batch = [make_stroke(stroke_id=same_id), make_stroke(stroke_id=same_id)]

    response = save(file_id, batch, headers)

    assert response.status_code == 204
    assert len(list_page(file_id, 1, headers).json()) == 1


# ---------- ownership ----------


def test_other_user_gets_404_on_both_routes():
    owner = get_auth_headers()
    intruder = second_user_headers()
    file_id = upload_pdf(owner)
    save(file_id, [make_stroke()], owner)

    read = list_page(file_id, 1, intruder)
    write = save(file_id, [make_stroke()], intruder)

    assert read.status_code == 404
    assert write.status_code == 404
    # and the intruder's write must not have changed anything
    assert len(list_page(file_id, 1, owner).json()) == 1


def test_stroke_id_collision_cannot_overwrite_another_users_stroke():
    owner = get_auth_headers()
    intruder = second_user_headers()
    owner_file = upload_pdf(owner)
    intruder_file = upload_pdf(intruder)

    original = make_stroke(n_points=3)
    save(owner_file, [original], owner)

    # the intruder reuses the owner's stroke id, with different points, on THEIR file
    forged = make_stroke(n_points=5, stroke_id=original["id"])
    response = save(intruder_file, [forged], intruder)

    # same response as any other save: nothing reveals that the id already existed
    assert response.status_code == 204
    # the owner's stroke is untouched
    owner_strokes = list_page(owner_file, 1, owner).json()
    assert len(owner_strokes) == 1
    assert owner_strokes[0]["points"] == original["points"]
    # and nothing was written to the intruder's file
    assert list_page(intruder_file, 1, intruder).json() == []


# ---------- validation ----------


def test_point_with_four_numbers_rejected():
    headers = get_auth_headers()
    file_id = upload_pdf(headers)
    bad = make_stroke()
    bad["points"][1] = [1.0, 2.0, 0.5, 9.9]

    response = save(file_id, [bad], headers)

    assert response.status_code == 422


def test_too_many_points_rejected():
    headers = get_auth_headers()
    file_id = upload_pdf(headers)

    response = save(file_id, [make_stroke(n_points=MAX_POINTS + 1)], headers)

    assert response.status_code == 422


def test_invalid_color_rejected():
    headers = get_auth_headers()
    file_id = upload_pdf(headers)
    bad = make_stroke()
    bad["color"] = "red; background:url(x)"

    response = save(file_id, [bad], headers)

    assert response.status_code == 422


def test_missing_stroke_id_rejected():
    headers = get_auth_headers()
    file_id = upload_pdf(headers)
    bad = make_stroke()
    del bad["id"]

    response = save(file_id, [bad], headers)

    assert response.status_code == 422


# ---------- database behavior ----------


def test_soft_deleted_strokes_are_hidden():
    headers = get_auth_headers()
    file_id = upload_pdf(headers)
    keep = make_stroke()
    remove = make_stroke()
    save(file_id, [keep, remove], headers)

    db = SessionLocal()
    try:
        db.execute(
            update(Stroke)
            .where(Stroke.id == uuid.UUID(remove["id"]))
            .values(deleted_at=func.now())
        )
        db.commit()
    finally:
        db.close()

    ids = [s["id"] for s in list_page(file_id, 1, headers).json()]
    assert ids == [keep["id"]]


def test_deleting_a_file_deletes_its_strokes():
    headers = get_auth_headers()
    file_id = upload_pdf(headers)
    save(file_id, [make_stroke(), make_stroke()], headers)

    db = SessionLocal()
    try:
        count = lambda: db.scalar(
            select(func.count()).select_from(Stroke).where(Stroke.file_id == file_id)
        )
        assert count() == 2

        db.delete(db.get(File, file_id))
        db.commit()

        assert count() == 0  # ON DELETE CASCADE did the work
    finally:
        db.close()
