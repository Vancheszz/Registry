"""Юнит-тесты CRUD-запросов к эндпоинтам пациентов."""

from main import Patient


def test_create_patient_parses_last_visit(client):
    """Дата последнего визита конвертируется в datetime и возвращается в ответе."""
    response = client.post(
        "/api/patients/",
        json={
            "full_name": "Clara Oswald",
            "last_visit": "2024-04-10",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["last_visit"] is not None


def test_search_patient_by_phone(client, db_session):
    """Поиск по телефону находит ровно одного пациента."""
    db_session.add(Patient(full_name="River Song", phone="12345"))
    db_session.commit()

    response = client.get("/api/patients/", params={"search": "123"})
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_update_patient_changes_fields(client, db_session):
    """Обновление карточки перезаписывает имя и телефон."""
    patient = Patient(full_name="Martha Jones")
    db_session.add(patient)
    db_session.commit()

    response = client.put(
        f"/api/patients/{patient.id}",
        json={
            "full_name": "Martha Smith",
            "phone": "555",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["full_name"] == "Martha Smith"
    assert body["phone"] == "555"


def test_delete_patient(client, db_session):
    """Удаление пациента очищает запись в базе."""
    patient = Patient(full_name="Donna Noble")
    db_session.add(patient)
    db_session.commit()

    response = client.delete(f"/api/patients/{patient.id}")
    assert response.status_code == 200
    assert db_session.query(Patient).get(patient.id) is None
