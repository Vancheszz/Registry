# Бэкапы и выгрузка базы данных (SQLite)

В проекте используется SQLite (файловая БД). В контейнере бэкенда по умолчанию файл: `/app/clinic.db`.

## Где сейчас лежит БД

```bash
# Проверить
docker exec -it shift_management_backend sh -lc 'echo DATABASE_URL=$DATABASE_URL; ls -lah /app /app/data 2>/dev/null | grep clinic.db || true'
```

Если выводит `DATABASE_URL=sqlite:///./clinic.db` — БД внутри контейнера по пути `/app/clinic.db`.

## Рекомендация: сделать хранение устойчивым (bind-mount)

В `docker-compose.prod.yml` для `backend`:

```yaml
services:
  backend:
    volumes:
      - ./data:/app/data
    environment:
      - DATABASE_URL=sqlite:////app/data/clinic.db
```

Перезапуск:
```bash
docker compose -f docker-compose.prod.yml up -d --build backend
```
Файл появится на хосте: `./data/clinic.db`.

## Разовый бэкап

- Простой (через docker cp), когда БД внутри контейнера:
```bash
mkdir -p /opt/clinic/backups
docker cp shift_management_backend:/app/clinic.db /opt/clinic/backups/clinic_$(date +%F_%H%M).db
gzip -f /opt/clinic/backups/clinic_*.db
```

- Консистентный (даже при записи) через sqlite3 внутри контейнера:
```bash
mkdir -p /opt/clinic/backups
# sqlite3 при необходимости
docker exec shift_management_backend sh -lc 'command -v sqlite3 >/dev/null 2>&1 || (apt-get update && apt-get install -y sqlite3)'
# .backup во временный файл и копия на хост
docker exec shift_management_backend sh -lc "sqlite3 /app/clinic.db \".backup '/tmp/backup.db'\""
docker cp shift_management_backend:/tmp/backup.db /opt/clinic/backups/clinic_$(date +%F_%H%M).db
docker exec shift_management_backend sh -lc 'rm -f /tmp/backup.db'
gzip -f /opt/clinic/backups/clinic_*.db
```

## Проверка бэкапа

```bash
LATEST=$(ls -1t /opt/clinic/backups/clinic_*.db.gz | head -n1); echo "$LATEST"
gzip -t "$LATEST" && echo OK
TMP=/tmp/check.db; gunzip -c "$LATEST" > "$TMP"; sqlite3 "$TMP" ".tables"; rm -f "$TMP"
```

## Ежедневный бэкап, хранение 14 дней

Создайте скрипт (вставляйте построчно):
```bash
echo '#!/usr/bin/env bash' > /usr/local/bin/backup_clinic_db.sh
echo 'set -euo pipefail' >> /usr/local/bin/backup_clinic_db.sh
echo 'BACKUP_DIR=/opt/clinic/backups' >> /usr/local/bin/backup_clinic_db.sh
echo 'CONTAINER=shift_management_backend' >> /usr/local/bin/backup_clinic_db.sh
echo 'TIMESTAMP=$(date +%F_%H%M)' >> /usr/local/bin/backup_clinic_db.sh
echo 'mkdir -p "$BACKUP_DIR"' >> /usr/local/bin/backup_clinic_db.sh
echo 'docker cp "$CONTAINER":/app/clinic.db "$BACKUP_DIR"/clinic_"$TIMESTAMP".db' >> /usr/local/bin/backup_clinic_db.sh
echo 'gzip -f "$BACKUP_DIR"/clinic_"$TIMESTAMP".db' >> /usr/local/bin/backup_clinic_db.sh
echo 'find "$BACKUP_DIR" -type f -mtime +14 -delete' >> /usr/local/bin/backup_clinic_db.sh
chmod +x /usr/local/bin/backup_clinic_db.sh
mkdir -p /opt/clinic/backups
```

Добавьте в cron (02:00 ежедневно):
```bash
echo '0 2 * * * root /usr/local/bin/backup_clinic_db.sh >> /var/log/backup_clinic_db.log 2>&1' > /etc/cron.d/backup_clinic_db
chmod 644 /etc/cron.d/backup_clinic_db
systemctl restart cron
```

Проверка:
```bash
/usr/local/bin/backup_clinic_db.sh
ls -lah /opt/clinic/backups | tail -n 10
```

## Скачивание на компьютер

- SCP (команда запускается на вашем ПК):
```powershell
scp -P 50628 root@YOUR_SERVER_IP:/opt/clinic/backups/clinic_YYYY-MM-DD_HHMM.db.gz "$env:USERPROFILE\Downloads\"
```

- Если SCP недоступен — временный сервер загрузки (на сервере):
```bash
docker run --rm -d --name clinic_download -p 8089:80 -v /opt/clinic/backups:/usr/share/nginx/html:ro nginx:alpine
# затем скачайте в браузере: http://YOUR_SERVER_IP:8089/<имя_файла>.db.gz
docker stop clinic_download
```

- Одноразовая ссылка:
```bash
curl --upload-file /opt/clinic/backups/clinic_YYYY-MM-DD_HHMM.db.gz https://transfer.sh/clinic_YYYY-MM-DD_HHMM.db.gz
```

## Восстановление из бэкапа

Если БД внутри контейнера (`/app/clinic.db`):
```bash
docker compose -f docker-compose.prod.yml stop backend
cp /opt/clinic/backups/clinic_YYYY-MM-DD_HHMM.db /opt/clinic-app/backend_restore.db
docker cp /opt/clinic-app/backend_restore.db shift_management_backend:/app/clinic.db
rm -f /opt/clinic-app/backend_restore.db
docker compose -f docker-compose.prod.yml start backend
```

Если включён bind‑mount (`sqlite:////app/data/clinic.db`):
```bash
docker compose -f docker-compose.prod.yml stop backend
cp /opt/clinic/backups/clinic_YYYY-MM-DD_HHMM.db /opt/clinic-app/data/clinic.db
docker compose -f docker-compose.prod.yml start backend
```

## Частые ошибки
- Неверный путь вида `/path/to/repo/...` — найдите актуальный через `docker exec ... echo $DATABASE_URL`.
- SCP запускается на сервере — запускать нужно на ПК. Если порт закрыт, используйте 8089/transfer.sh.
- БД пропадает после пересоздания контейнера — включите bind‑mount и укажите `sqlite:////app/data/clinic.db`. 

