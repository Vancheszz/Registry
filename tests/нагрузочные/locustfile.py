"""
Нагрузочные сценарии для проверки массового входа и операций записи на приём.
Запуск: locust -f tests/нагрузочные/locustfile.py --users 100 --spawn-rate 10 --host http://localhost:8000
"""

import os
import random
from datetime import datetime, timedelta

from locust import HttpUser, between, task


class RegistryUser(HttpUser):
    """Пользователь для нагрузочного тестирования API клиники."""

    wait_time = between(1, 3)

    def on_start(self):
        """Авторизация перед выполнением задач и кеширование id пользователя."""
        self.username = os.getenv("LOCUST_USERNAME", "doctor")
        self.password = os.getenv("LOCUST_PASSWORD", "doctorpass")
        self._user_id = None
        self._authenticate()

    def _authenticate(self):
        """Запрашивает токен и устанавливает Authorization-заголовок."""
        response = self.client.post(
            "/api/login",
            json={"username": self.username, "password": self.password},
        )
        if response.ok:
            token = response.json().get("access_token")
            self.client.headers.update({"Authorization": f"Bearer {token}"})
            self._user_id = self._resolve_user_id()

    def _resolve_user_id(self):
        """Пытаемся определить id текущего пользователя (public-list > первый)."""
        response = self.client.get("/api/users/public")
        if response.ok and response.json():
            return response.json()[0].get("id")
        return None

    @task
    def массовый_вход(self):
        """Повторный вход для проверки аутентификации под нагрузкой."""
        self.client.post(
            "/api/login",
            json={"username": self.username, "password": self.password},
        )

    @task
    def массовая_запись_на_приём(self):
        """Создание большого числа слотов/приёмов для врача."""
        if not self._user_id:
            self._authenticate()
            if not self._user_id:
                return

        day = datetime.utcnow() + timedelta(days=random.randint(1, 5))
        payload = {
            "date": day.strftime("%Y-%m-%d"),
            "start_time": f"0{random.randint(8, 9)}:00",
            "end_time": f"1{random.randint(0, 2)}:00",
            "shift_type": "load-test",
            "user_id": self._user_id,
            "notes": "Автотест нагрузочной записи",
        }
        self.client.post("/api/shifts/", json=payload)

    @task
    def запись_наблюдения_в_журнал(self):
        """Запись заметки врача в журнал передачи смен после создания слота."""
        if not self._user_id:
            return

        # Сначала создаём смену, чтобы было что записывать в журнале
        now = datetime.utcnow() + timedelta(days=1)
        shift_resp = self.client.post(
            "/api/shifts/",
            json={
                "date": now.strftime("%Y-%m-%d"),
                "start_time": "15:00",
                "end_time": "16:00",
                "shift_type": "handover-log",
                "user_id": self._user_id,
            },
        )
        if not shift_resp.ok:
            return

        shift_id = shift_resp.json().get("id")
        self.client.post(
            "/api/handovers/",
            json={
                "from_shift_id": shift_id,
                "handover_notes": "Нагрузка: быстрая фиксация приёма и заметок",
                "asset_ids": [],
            },
        )
