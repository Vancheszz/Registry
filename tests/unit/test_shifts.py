"""Покрытие запросов к сменам: создание, фильтрация, обновление и агрегации."""

from datetime import datetime, timedelta

from main import Patient, Shift, User


def test_create_shift_for_patient_updates_notes(client, db_session):
    """Создание смены с пациентом обновляет заметку у пациента."""
    patient = Patient(full_name="Amy Pond")
    db_session.add(patient)
    db_session.commit()

    response = client.post(
        "/api/shifts/",
        json={
            "date": "2024-07-01",
            "start_time": "09:00",
            "end_time": "10:00",
            "shift_type": "visit",
            "user_id": db_session.query(User).filter_by(username="doctor").first().id,
            "patient_id": patient.id,
            "notes": "Follow up",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["patient_name"] == "Amy Pond"

    updated_patient = db_session.query(Patient).get(patient.id)
    assert "2024-07-01" in updated_patient.notes


def test_create_shift_for_missing_user(client):
    """Если пользователь не найден, API возвращает 404."""
    response = client.post(
        "/api/shifts/",
        json={
            "date": "2024-07-02",
            "start_time": "09:00",
            "end_time": "10:00",
            "shift_type": "visit",
            "user_id": 999,
        },
    )
    assert response.status_code == 404


def test_get_shifts_filtered_by_date(client, db_session):
    """Фильтр по дате возвращает только нужные смены."""
    doctor = db_session.query(User).filter_by(username="doctor").first()
    shift_one = Shift(
        date="2024-07-03",
        start_time="09:00",
        end_time="10:00",
        shift_type="visit",
        user_id=doctor.id,
        user_name=doctor.name,
        position=doctor.position,
    )
    shift_two = Shift(
        date="2024-07-04",
        start_time="09:00",
        end_time="10:00",
        shift_type="visit",
        user_id=doctor.id,
        user_name=doctor.name,
        position=doctor.position,
    )
    db_session.add_all([shift_one, shift_two])
    db_session.commit()

    response = client.get("/api/shifts/", params={"date": "2024-07-03"})
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["date"] == "2024-07-03"


def test_update_shift_changes_patient_and_time(client, db_session):
    """Обновление смены переставляет время и пациента."""
    doctor = db_session.query(User).filter_by(username="doctor").first()
    patient = Patient(full_name="Rory")
    db_session.add(patient)
    shift = Shift(
        date="2024-07-05",
        start_time="09:00",
        end_time="10:00",
        shift_type="visit",
        user_id=doctor.id,
        user_name=doctor.name,
        position=doctor.position,
    )
    db_session.add(shift)
    db_session.commit()

    response = client.put(
        f"/api/shifts/{shift.id}",
        json={
            "date": "2024-07-06",
            "start_time": "10:00",
            "end_time": "11:00",
            "shift_type": "control",
            "user_id": doctor.id,
            "patient_id": patient.id,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["patient_name"] == "Rory"
    assert body["start_time"] == "10:00"


def test_update_shift_not_found(client):
    """Несуществующая смена возвращает 404 при обновлении."""
    response = client.put(
        "/api/shifts/999",
        json={
            "date": "2024-07-06",
            "start_time": "10:00",
            "end_time": "11:00",
            "shift_type": "control",
            "user_id": 1,
        },
    )
    assert response.status_code == 404


def test_delete_shift_removes_record(client, db_session):
    """Удалённая смена пропадает из базы."""
    doctor = db_session.query(User).filter_by(username="doctor").first()
    shift = Shift(
        date="2024-07-07",
        start_time="09:00",
        end_time="10:00",
        shift_type="visit",
        user_id=doctor.id,
        user_name=doctor.name,
        position=doctor.position,
    )
    db_session.add(shift)
    db_session.commit()

    response = client.delete(f"/api/shifts/{shift.id}")
    assert response.status_code == 200
    assert db_session.query(Shift).get(shift.id) is None


def test_create_multiple_shifts(client, db_session):
    """Массовое создание сохраняет все переданные слоты."""
    doctor = db_session.query(User).filter_by(username="doctor").first()
    response = client.post(
        "/api/shifts/bulk",
        json={
            "shifts": [
                {
                    "date": "2024-07-08",
                    "start_time": "09:00",
                    "end_time": "10:00",
                    "shift_type": "visit",
                    "user_id": doctor.id,
                },
                {
                    "date": "2024-07-09",
                    "start_time": "10:00",
                    "end_time": "11:00",
                    "shift_type": "visit",
                    "user_id": doctor.id,
                },
            ]
        },
    )
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_dashboard_counts_upcoming_appointments(client, db_session):
    """Дашборд подсчитывает будущие приёмы и персонал."""
    doctor = db_session.query(User).filter_by(username="doctor").first()
    future_date = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
    shift = Shift(
        date=future_date,
        start_time="09:00",
        end_time="10:00",
        shift_type="visit",
        user_id=doctor.id,
        user_name=doctor.name,
        position=doctor.position,
    )
    db_session.add(shift)
    db_session.commit()

    response = client.get("/api/dashboard/summary")
    assert response.status_code == 200
    summary = response.json()
    assert summary["total_staff"] >= 2
    assert summary["upcoming_appointments"] >= 1
