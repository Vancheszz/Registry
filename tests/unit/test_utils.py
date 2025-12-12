"""Проверка вспомогательных функций работы с датами и заметками пациентов."""

import datetime

from main import append_patient_note, parse_optional_datetime, Patient


def test_parse_optional_datetime_for_date():
    """Строка даты превращается в datetime-объект."""
    result = parse_optional_datetime("2024-05-01")
    assert isinstance(result, datetime.datetime)
    assert result.date().isoformat() == "2024-05-01"


def test_parse_optional_datetime_invalid():
    """Некорректная дата возвращает None без исключений."""
    assert parse_optional_datetime("invalid-date") is None


def test_append_patient_note_creates_history(db_session):
    """Добавление заметки переносит текст и дату в накопленное поле notes."""
    patient = Patient(full_name="John Doe")
    db_session.add(patient)
    db_session.commit()

    append_patient_note(
        db_session,
        patient,
        doctor_name="Доктор Кто",
        shift_date="2024-05-02",
        start_time="09:00",
        end_time="10:00",
    )
    refreshed = db_session.query(Patient).get(patient.id)
    assert "2024-05-02" in refreshed.notes
    assert "Доктор Кто" in refreshed.notes
    assert "09:00-10:00" in refreshed.notes
