from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, Boolean, func, or_
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import List, Optional
from passlib.context import CryptContext
from jose import JWTError, jwt
import os

# ==========================
#   НАСТРОЙКИ АУТЕНТИФИКАЦИИ
# ==========================

# Секретный ключ для подписи JWT-токенов
# В продакшене ОБЯЗАТЕЛЬНО заменить на надёжный ключ из переменных окружения
SECRET_KEY = "your-secret-key-here-change-in-production"

# Алгоритм подписи JWT
ALGORITHM = "HS256"

# Время жизни access-токена (в минутах)
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Контекст для хэширования и проверки паролей (используется bcrypt)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Схема OAuth2: токен берётся из заголовка Authorization: Bearer <token>
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


# ==================
#   НАСТРОЙКА БАЗЫ
# ==================

# URL базы данных.
# По умолчанию используется SQLite-файл clinic.db в текущей директории.
# Можно переопределить через переменную окружения DATABASE_URL.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./clinic.db")

# Создаём движок SQLAlchemy.
# Для SQLite нужно явно отключить проверку "check_same_thread".
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

# Фабрика сессий для работы с БД
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Базовый класс для декларативных моделей
Base = declarative_base()


# ===================
#   МОДЕЛИ БАЗЫ ДАННЫХ
# ===================

class User(Base):
    """Модель пользователя системы (сотрудник клиники)."""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)      # Логин для входа
    hashed_password = Column(String, nullable=False)            # Хэш пароля
    name = Column(String, nullable=False)                       # Отображаемое имя
    position = Column(String, nullable=False)                   # Должность
    phone = Column(String, nullable=True)                       # Телефон
    telegram_id = Column(String, nullable=True)                 # Telegram ID (если используется)
    email = Column(String, nullable=True)                       # Email
    is_active = Column(Boolean, default=True)                   # Активен ли пользователь
    is_admin = Column(Boolean, default=False)                   # Администратор или нет
    created_at = Column(DateTime, default=datetime.utcnow)      # Дата создания записи


class Shift(Base):
    """Модель смены/приёма (слот расписания)."""
    __tablename__ = "shifts"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, nullable=False)          # Дата смены в формате YYYY-MM-DD
    start_time = Column(String, nullable=False)    # Время начала (HH:MM)
    end_time = Column(String, nullable=False)      # Время окончания (HH:MM)
    shift_type = Column(String, nullable=False)    # Тип смены/приёма (консультация, осмотр и т.п.)
    user_id = Column(Integer, nullable=False)      # ID сотрудника
    user_name = Column(String, nullable=False)     # Имя сотрудника (денормализация для удобства)
    position = Column(String, nullable=False)      # Должность сотрудника
    patient_id = Column(Integer, nullable=True)    # ID пациента (если привязан)
    patient_name = Column(String, nullable=True)   # Имя пациента (денормализация)
    status = Column(String, default="scheduled")   # Статус: scheduled, completed, cancelled
    notes = Column(Text)                           # Заметки к смене/приёму
    created_at = Column(DateTime, default=datetime.utcnow)                       # Когда создано
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)  # Когда обновлено


class Patient(Base):
    """Модель пациента клиники."""
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)         # ФИО пациента
    birth_date = Column(String, nullable=True)         # Дата рождения (строкой)
    gender = Column(String, nullable=True)             # Пол
    phone = Column(String, nullable=True)              # Телефон
    email = Column(String, nullable=True)              # Email
    address = Column(String, nullable=True)            # Адрес
    policy_number = Column(String, nullable=True)      # Номер полиса / страховки
    blood_type = Column(String, nullable=True)         # Группа крови
    allergies = Column(Text, nullable=True)            # Аллергии
    chronic_conditions = Column(Text, nullable=True)   # Хронические заболевания
    medications = Column(Text, nullable=True)          # Принимаемые препараты
    attending_physician = Column(String, nullable=True) # Лечащий врач
    last_visit = Column(DateTime, nullable=True)       # Дата последнего визита (как datetime)
    notes = Column(Text, nullable=True)                # Дополнительные примечания
    created_at = Column(DateTime, default=datetime.utcnow)                       # Когда создано
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)  # Когда обновлено


class Asset(Base):
    """Модель 'актива' — кейс, запрос, задача и т.п."""
    __tablename__ = "assets"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)             # Заголовок актива
    description = Column(Text, nullable=False)         # Описание
    asset_type = Column(String, nullable=False)        # CASE, CHANGE_MANAGEMENT, ORANGE_CASE, CLIENT_REQUESTS
    status = Column(String, nullable=False)            # Статус: Active, Completed, On Hold
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class ShiftHandover(Base):
    """Передача смены (связь между сменами и общие заметки)."""
    __tablename__ = "shift_handovers"
    
    id = Column(Integer, primary_key=True, index=True)
    from_shift_id = Column(Integer, nullable=True)     # ID смены, которая передаёт
    to_shift_id = Column(Integer, nullable=True)       # ID смены, которая принимает
    handover_notes = Column(Text, nullable=False)      # Описание передачи (что передано, текущий статус дел)
    created_at = Column(DateTime, default=datetime.utcnow)


class HandoverAsset(Base):
    """Связь 'передача смены' ↔ 'активы', которые передаются."""
    __tablename__ = "handover_assets"
    
    id = Column(Integer, primary_key=True, index=True)
    handover_id = Column(Integer, nullable=False)      # ID записи передачи смены
    asset_id = Column(Integer, nullable=False)         # ID актива
    notes = Column(Text, nullable=True)                # Дополнительные примечания по активу
    status = Column(String, nullable=True)             # Статус актива в рамках передачи (опционально)


class HandoverLog(Base):
    """
    Упрощённый лог передачи смены.
    Эти данные используются для экспорта (например, в Excel) без сложных джойнов.
    """
    __tablename__ = "handover_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    log_date = Column(String, nullable=False)          # Дата логирования (строкой)
    log_time = Column(String, nullable=False)          # Время логирования (строкой)
    from_shift_user = Column(String, nullable=False)   # Сотрудник, сдающий смену
    from_shift_time = Column(String, nullable=False)   # Интервал его смены
    to_shift_user = Column(String, nullable=False)     # Сотрудник, принимающий смену
    to_shift_time = Column(String, nullable=False)     # Интервал его смены
    handover_notes = Column(Text, nullable=False)      # Основной текст передачи
    assets_info = Column(Text, nullable=False)         # Информация об активах (в виде строки/JSON)
    created_at = Column(DateTime, default=datetime.utcnow)


# =======================
#   ФУНКЦИИ АУТЕНТИФИКАЦИИ
# =======================

def verify_password(plain_password, hashed_password):
    """Проверка пароля пользователя: сравниваем введённый пароль с хэшем в базе."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    """Хэшируем пароль для сохранения в базе."""
    return pwd_context.hash(password)


async def get_user_by_username(db: Session, username: str):
    """Получить пользователя по username."""
    return db.query(User).filter(User.username == username).first()


async def authenticate_user(db: Session, username: str, password: str):
    """
    Аутентифицируем пользователя:
    - ищем его по username
    - проверяем пароль
    """
    user = await get_user_by_username(db, username)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """
    Создание JWT access-токена.
    В payload добавляется поле 'exp' — время истечения токена.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        # Если срок не передан, по умолчанию 15 минут
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    # Кодируем токен с использованием секретного ключа и алгоритма
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def parse_optional_datetime(value: Optional[str]) -> Optional[datetime]:
    """
    Универсальный парсер даты/даты-времени.
    Поддерживает строки формата:
    - YYYY-MM-DD
    - ISO-формат (YYYY-MM-DDTHH:MM:SS и т.п.)
    
    Возвращает datetime или None в случае ошибки.
    """
    if not value:
        return None
    try:
        if len(value) == 10:
            return datetime.strptime(value, "%Y-%m-%d")
        return datetime.fromisoformat(value)
    except ValueError:
        return None


# =====================
#   Pydantic-схемы (API)
# =====================

# ----- Пользователи -----

class UserCreate(BaseModel):
    """Данные для создания/обновления пользователя (входящие в API)."""
    username: str
    password: str
    name: str
    position: str
    phone: Optional[str] = None
    telegram_id: Optional[str] = None
    email: Optional[str] = None
    is_admin: Optional[bool] = False


class UserLogin(BaseModel):
    """Данные для логина через /api/login."""
    username: str
    password: str


class Token(BaseModel):
    """Ответ при успешной аутентификации (JWT-токен)."""
    access_token: str
    token_type: str


class TokenData(BaseModel):
    """Данные, извлекаемые из токена (минимум username)."""
    username: Optional[str] = None


class UserResponse(BaseModel):
    """Схема пользователя для ответов API."""
    id: int
    username: str
    name: str
    position: str
    phone: Optional[str]
    telegram_id: Optional[str]
    email: Optional[str]
    is_active: bool
    is_admin: bool
    created_at: datetime
    
    class Config:
        # Позволяет создавать модель напрямую из ORM-объекта SQLAlchemy
        from_attributes = True


class ProfileUpdate(BaseModel):
    """Схема для обновления своего профиля."""
    name: str
    position: str
    phone: Optional[str] = None
    telegram_id: Optional[str] = None
    email: Optional[str] = None


# ----- Смены -----

class ShiftCreate(BaseModel):
    """Данные для создания или обновления смены."""
    date: str
    start_time: str
    end_time: str
    shift_type: str
    user_id: int
    patient_id: Optional[int] = None
    notes: Optional[str] = None


class ShiftResponse(BaseModel):
    """Смена в ответах API."""
    id: int
    date: str
    start_time: str
    end_time: str
    shift_type: str
    user_id: int
    user_name: str
    position: str
    patient_id: Optional[int]
    patient_name: Optional[str]
    status: str
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ----- Пациенты -----

class PatientCreate(BaseModel):
    """Данные для создания пациента."""
    full_name: str
    birth_date: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    policy_number: Optional[str] = None
    blood_type: Optional[str] = None
    allergies: Optional[str] = None
    chronic_conditions: Optional[str] = None
    medications: Optional[str] = None
    attending_physician: Optional[str] = None
    last_visit: Optional[str] = None
    notes: Optional[str] = None


class PatientUpdate(PatientCreate):
    """Для обновления пациента используем те же поля, что и для создания."""
    pass


class PatientResponse(BaseModel):
    """Пациент в ответах API."""
    id: int
    full_name: str
    birth_date: Optional[str]
    gender: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    address: Optional[str]
    policy_number: Optional[str]
    blood_type: Optional[str]
    allergies: Optional[str]
    chronic_conditions: Optional[str]
    medications: Optional[str]
    attending_physician: Optional[str]
    last_visit: Optional[datetime]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ----- Дашборд -----

class DashboardSummary(BaseModel):
    """
    Сводная информация для дашборда:
    - количество пациентов, сотрудников, активных кейсов
    - ближайшие приёмы
    - последние добавленные пациенты
    """
    total_patients: int
    total_staff: int
    active_cases: int
    upcoming_appointments: int
    next_appointments: List[ShiftResponse]
    recent_patients: List[PatientResponse]


# ----- Активы -----

class AssetCreate(BaseModel):
    """Данные для создания актива."""
    title: str
    description: str
    asset_type: str  # CASE, CHANGE_MANAGEMENT, ORANGE_CASE, CLIENT_REQUESTS
    status: str      # Active, Completed, On Hold


class AssetResponse(BaseModel):
    """Актив в ответах API."""
    id: int
    title: str
    description: str
    asset_type: str
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class AssetUpdate(BaseModel):
    """Частичное обновление актива (все поля опциональны)."""
    title: Optional[str] = None
    description: Optional[str] = None
    asset_type: Optional[str] = None
    status: Optional[str] = None


# ----- Передачи смен -----

class HandoverCreate(BaseModel):
    """Данные для создания/обновления передачи смены."""
    from_shift_id: Optional[int] = None
    to_shift_id: Optional[int] = None
    handover_notes: str
    asset_ids: List[int]  # Список ID активов, которые передаются


class HandoverResponse(BaseModel):
    """Передача смены в ответах API."""
    id: int
    from_shift_id: Optional[int]
    to_shift_id: Optional[int]
    handover_notes: str
    assets: List[AssetResponse]
    created_at: datetime


# ----- Экспорт логов передач -----

class ExportHandoverData(BaseModel):
    """Структура для экспорта логов передач (расширенная, но сейчас не используется в эндпоинтах)."""
    id: int
    date: str
    time: str
    from_shift_user: str
    from_shift_date: str
    from_shift_time: str
    to_shift_user: str
    to_shift_date: str
    to_shift_time: str
    handover_notes: str
    assets_count: int
    assets: List[dict]
    
    class Config:
        from_attributes = True


class ExportResponse(BaseModel):
    """Обёртка для экспорта: массив данных + общее количество."""
    data: List[ExportHandoverData]
    total: int
    
    class Config:
        from_attributes = True


class HandoverLogCreate(BaseModel):
    """Входные данные для создания упрощённого лога (прямо не используются в текущем коде)."""
    log_date: str
    log_time: str
    from_shift_user: str
    from_shift_time: str
    to_shift_user: str
    to_shift_time: str
    handover_notes: str
    assets_info: str


class HandoverLogResponse(BaseModel):
    """Ответ по логам передач смен."""
    id: int
    log_date: str
    log_time: str
    from_shift_user: str
    from_shift_time: str
    to_shift_user: str
    to_shift_time: str
    handover_notes: str
    assets_info: str
    created_at: datetime
    
    class Config:
        from_attributes = True


# =======================
#   СОЗДАНИЕ ТАБЛИЦ В БД
# =======================

Base.metadata.create_all(bind=engine)


# ====================
#   ИНИЦИАЛИЗАЦИЯ FastAPI
# ====================

# Основное приложение FastAPI
app = FastAPI(title="Clinic Registry API", version="2.0.0")

# ==================
#   CORS МИДДЛВАРЬ
# ==================

# Настройка CORS, чтобы фронтенд (даже с другого домена) мог обращаться к API.
# В продакшене лучше явно перечислить разрешённые домены вместо ["*"].
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене указать конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================
#   ЗАВИСИМОСТИ (DEPENDENCIES)
# ==========================

def get_db():
    """
    Зависимость для получения сессии БД.
    Используется в эндпоинтах через Depends.
    По завершении запроса сессия будет закрыта.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """
    Получить текущего пользователя по JWT-токену:
    - декодируем токен
    - достаём username
    - ищем пользователя в БД
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Декодируем токен и извлекаем subject (username)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        # Токен повреждён/просрочен
        raise credentials_exception

    # Ищем пользователя в БД
    user = await get_user_by_username(db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)):
    """
    Убеждаемся, что текущий пользователь активен.
    Используется как зависимость во всех эндпоинтах, где нужна авторизация.
    """
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


# Функция проверки админских прав
async def get_current_admin_user(current_user: User = Depends(get_current_active_user)):
    """
    Зависимость для эндпоинтов, доступных только администраторам.
    Проверяет флаг is_admin у текущего пользователя.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions. Admin access required."
        )
    return current_user


# ============
#   API ROUTES
# ============

@app.get("/")
async def root():
    """Простой health-check эндпоинт: позволяет проверить, что API запущено."""
    return {"message": "Clinic Registry API is running"}


# ==========================
#   ЭНДПОИНТЫ АУТЕНТИФИКАЦИИ
# ==========================

@app.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    OAuth2-совместимый эндпоинт получения токена:
    принимает form-data: username, password.
    Используется, например, Swagger UI или внешними клиентами.
    """
    user = await authenticate_user(db, form_data.username, form_data.password)
    if not user:
        # Неверный логин или пароль
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # Создаём токен с заданным временем жизни
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/api/login", response_model=Token)
async def login(user_login: UserLogin, db: Session = Depends(get_db)):
    """
    Простой JSON-эндпоинт логина.
    Принимает {"username": "...", "password": "..."} и возвращает токен.
    """
    user = await authenticate_user(db, user_login.username, user_login.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/api/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate, db: Session = Depends(get_db)):
    """
    Регистрация нового пользователя.
    Доступно без авторизации (обычно для первичного создания учётки).
    """
    existing_user = await get_user_by_username(db, user.username)
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")

    # Хэшируем пароль и создаём пользователя
    user_data = user.dict()
    user_data['hashed_password'] = get_password_hash(user_data.pop('password'))
    # На всякий случай не даём создать админа через этот эндпоинт
    user_data['is_admin'] = False
    db_user = User(**user_data)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@app.get("/api/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    """Получить информацию о текущем авторизованном пользователе."""
    return current_user


@app.put("/api/profile", response_model=UserResponse)
async def update_profile(
    profile_update: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Обновить собственный профиль (имя, должность, контакты)."""
    # Обновляем данные текущего пользователя
    for key, value in profile_update.dict().items():
        if hasattr(current_user, key):
            setattr(current_user, key, value)
    
    db.commit()
    db.refresh(current_user)
    return current_user


# =================
#   ЭНДПОИНТЫ USER
# =================

@app.post("/api/users/", response_model=UserResponse)
async def create_user(
    user: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Создание пользователя администратором.
    Отличается от /api/register тем, что требует админ-права.
    """
    # Проверяем, не существует ли уже пользователь с таким username
    existing_user = await get_user_by_username(db, user.username)
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Создаем пользователя с хэшированным паролем
    user_data = user.dict()
    user_data['hashed_password'] = get_password_hash(user_data.pop('password'))
    db_user = User(**user_data)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@app.get("/api/users/", response_model=List[UserResponse])
async def get_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Получить список всех пользователей (только для администраторов)."""
    return db.query(User).all()


@app.get("/api/users/public", response_model=List[UserResponse])
async def get_users_public(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получить список всех пользователей (доступно всем авторизованным).
    Используется, например, для выбора врача в UI.
    """
    return db.query(User).all()


@app.get("/api/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Получить пользователя по ID (админ-доступ)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@app.put("/api/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_update: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Полное обновление данных пользователя (админ-доступ)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Проверяем, что username уникален (если он изменился)
    if user_update.username != user.username:
        existing_user = await get_user_by_username(db, user_update.username)
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already registered")
    
    # Обновляем данные пользователя
    user_data = user_update.dict()
    
    # Если пароль предоставлен, хэшируем его
    if user_data.get('password'):
        user_data['hashed_password'] = get_password_hash(user_data.pop('password'))
    else:
        # Если пароль пустой, не трогаем существующий хэш
        user_data.pop('password', None)
    
    for key, value in user_data.items():
        if hasattr(user, key):
            setattr(user, key, value)
    
    db.commit()
    db.refresh(user)
    return user


@app.delete("/api/users/{user_id}")
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Удалить пользователя (админ-доступ, нельзя удалить самого себя)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Нельзя удалить самого себя
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}


# =================
#   ЭНДПОИНТЫ SHIFT
# =================

@app.post("/api/shifts/", response_model=ShiftResponse)
async def create_shift(shift: ShiftCreate, db: Session = Depends(get_db)):
    """
    Создать одну смену/приём.
    Связывает смену с пользователем и, опционально, с пациентом.
    """
    # Получаем данные пользователя
    user = db.query(User).filter(User.id == shift.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Если указан patient_id — проверяем, что пациент существует
    patient_name = None
    if shift.patient_id:
        patient = db.query(Patient).filter(Patient.id == shift.patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        patient_name = patient.full_name

    # Создаем смену с денормализованными данными пользователя и пациента
    db_shift = Shift(
        date=shift.date,
        start_time=shift.start_time,
        end_time=shift.end_time,
        shift_type=shift.shift_type,
        user_id=shift.user_id,
        user_name=user.name,
        position=user.position,
        patient_id=shift.patient_id,
        patient_name=patient_name,
        notes=shift.notes
    )
    db.add(db_shift)
    db.commit()
    db.refresh(db_shift)
    return db_shift


@app.post("/api/shifts/bulk", response_model=List[ShiftResponse])
async def create_multiple_shifts(shifts_data: dict, db: Session = Depends(get_db)):
    """
    Пакетное создание смен.
    Ожидает JSON вида {"shifts": [ {ShiftCreate}, {ShiftCreate}, ... ]}.
    """
    shifts = shifts_data.get("shifts", [])
    created_shifts = []
    
    for shift_data in shifts:
        # Получаем данные пользователя для каждой смены
        user = db.query(User).filter(User.id == shift_data['user_id']).first()
        if not user:
            raise HTTPException(status_code=404, detail=f"User with id {shift_data['user_id']} not found")

        patient_name = None
        patient_id = shift_data.get('patient_id')
        if patient_id:
            patient = db.query(Patient).filter(Patient.id == patient_id).first()
            if not patient:
                raise HTTPException(status_code=404, detail=f"Patient with id {patient_id} not found")
            patient_name = patient.full_name

        # Создаем смену с данными пользователя
        db_shift = Shift(
            date=shift_data['date'],
            start_time=shift_data['start_time'],
            end_time=shift_data['end_time'],
            shift_type=shift_data['shift_type'],
            user_id=shift_data['user_id'],
            user_name=user.name,
            position=user.position,
            patient_id=patient_id,
            patient_name=patient_name,
            notes=shift_data.get('notes')
        )
        db.add(db_shift)
        created_shifts.append(db_shift)
    
    db.commit()
    
    # Обновляем объекты после коммита
    for shift in created_shifts:
        db.refresh(shift)
    
    return created_shifts


@app.get("/api/shifts/", response_model=List[ShiftResponse])
async def get_shifts(date: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Получить список смен.
    Можно фильтровать по конкретной дате (YYYY-MM-DD).
    """
    query = db.query(Shift)
    if date:
        query = query.filter(Shift.date == date)
    return query.order_by(Shift.created_at.desc()).all()


@app.get("/api/shifts/{shift_id}", response_model=ShiftResponse)
async def get_shift(shift_id: int, db: Session = Depends(get_db)):
    """Получить смену по ID."""
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    return shift


@app.put("/api/shifts/{shift_id}", response_model=ShiftResponse)
async def update_shift(
    shift_id: int,
    shift_update: ShiftCreate,
    db: Session = Depends(get_db)
):
    """Полностью обновить смену по ID."""
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")

    update_data = shift_update.dict()

    # Обработка пациента (если изменился)
    patient_name = None
    patient_id = update_data.pop('patient_id', None)
    if patient_id:
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        patient_name = patient.full_name

    # Обновляем остальные поля смены
    for key, value in update_data.items():
        setattr(shift, key, value)

    shift.patient_id = patient_id
    shift.patient_name = patient_name

    shift.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(shift)
    return shift


@app.delete("/api/shifts/{shift_id}")
async def delete_shift(shift_id: int, db: Session = Depends(get_db)):
    """Удалить смену по ID."""
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")

    db.delete(shift)
    db.commit()
    return {"message": "Shift deleted successfully"}


# ===================
#   ЭНДПОИНТЫ PATIENT
# ===================

@app.get("/api/patients/", response_model=List[PatientResponse])
async def get_patients(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получить список пациентов.
    Если передан search — ищет по ФИО, номеру полиса и телефону (по подстроке, регистр не важен).
    """
    query = db.query(Patient)
    if search:
        pattern = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(Patient.full_name).like(pattern),
                func.lower(func.coalesce(Patient.policy_number, "")).like(pattern),
                func.lower(func.coalesce(Patient.phone, "")).like(pattern)
            )
        )
    return query.order_by(Patient.created_at.desc()).all()


@app.post("/api/patients/", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(
    patient: PatientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Создать нового пациента.
    last_visit (если передан строкой) конвертируется в datetime.
    """
    patient_data = patient.dict()
    last_visit_raw = patient_data.pop("last_visit", None)
    db_patient = Patient(**patient_data)
    db_patient.last_visit = parse_optional_datetime(last_visit_raw)
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)
    return db_patient


@app.get("/api/patients/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Получить пациента по ID."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@app.put("/api/patients/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient_id: int,
    patient_update: PatientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Обновить данные пациента (частично или полностью)."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    update_data = patient_update.dict(exclude_unset=True)
    # Отдельно парсим last_visit, если пришёл
    if "last_visit" in update_data:
        patient.last_visit = parse_optional_datetime(update_data.pop("last_visit"))

    for key, value in update_data.items():
        setattr(patient, key, value)

    patient.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(patient)
    return patient


@app.delete("/api/patients/{patient_id}")
async def delete_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Удалить пациента по ID."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    db.delete(patient)
    db.commit()
    return {"message": "Patient deleted successfully"}


# ======================
#   DASHBOARD SUMMARY
# ======================

@app.get("/api/dashboard/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Сводка для дашборда:
    - всего пациентов
    - всего сотрудников
    - активных кейсов
    - количество будущих приёмов
    - список ближайших 5 приёмов
    - список 5 последних пациентов
    """
    total_patients = db.query(func.count(Patient.id)).scalar() or 0
    total_staff = db.query(func.count(User.id)).scalar() or 0
    active_cases = (
        db.query(func.count(Asset.id))
        .filter(Asset.status == "Active")
        .scalar()
        or 0
    )

    # Получаем все смены и отбираем только будущие
    all_shifts = db.query(Shift).all()
    now = datetime.utcnow()

    def shift_start(shift: Shift) -> Optional[datetime]:
        """Вспомогательная функция: собирает datetime начала смены из date + start_time."""
        try:
            return datetime.strptime(f"{shift.date} {shift.start_time}", "%Y-%m-%d %H:%M")
        except ValueError:
            return None

    # Фильтруем только смены, которые ещё не начались
    upcoming = [
        (start_dt, shift)
        for shift in all_shifts
        if (start_dt := shift_start(shift)) and start_dt >= now
    ]
    # Сортируем по времени начала
    upcoming.sort(key=lambda item: item[0])
    upcoming_shifts = [item[1] for item in upcoming]

    next_appointments = upcoming_shifts[:5]
    recent_patients = (
        db.query(Patient)
        .order_by(Patient.created_at.desc())
        .limit(5)
        .all()
    )

    return DashboardSummary(
        total_patients=total_patients,
        total_staff=total_staff,
        active_cases=active_cases,
        upcoming_appointments=len(upcoming_shifts),
        next_appointments=next_appointments,
        recent_patients=recent_patients,
    )


# =================
#   ЭНДПОИНТЫ ASSET
# =================

@app.post("/api/assets/", response_model=AssetResponse)
async def create_asset(
    asset: AssetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Создать новый актив (кейс/запрос/задачу)."""
    db_asset = Asset(**asset.dict())
    db.add(db_asset)
    db.commit()
    db.refresh(db_asset)
    return db_asset


@app.get("/api/assets/", response_model=List[AssetResponse])
async def get_assets(
    asset_type: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получить список активов с возможностью фильтрации по:
    - типу (asset_type)
    - статусу (status)
    - поиску по заголовку (search)
    """
    query = db.query(Asset)
    if asset_type:
        query = query.filter(Asset.asset_type == asset_type)
    if status:
        query = query.filter(Asset.status == status)
    if search:
        query = query.filter(Asset.title.ilike(f"%{search}%"))
    return query.all()


@app.get("/api/assets/{asset_id}", response_model=AssetResponse)
async def get_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Получить актив по ID."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@app.put("/api/assets/{asset_id}", response_model=AssetResponse)
async def update_asset(
    asset_id: int,
    asset_update: AssetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Обновить актив (частично)."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    for key, value in asset_update.dict(exclude_unset=True).items():
        setattr(asset, key, value)
    
    asset.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(asset)
    return asset


@app.delete("/api/assets/{asset_id}")
async def delete_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Удалить актив по ID."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    db.delete(asset)
    db.commit()
    return {"message": "Asset deleted successfully"}


# ====================
#   ЭНДПОИНТЫ HANDOVER
# ====================

@app.post("/api/handovers/", response_model=HandoverResponse)
async def create_handover(
    handover: HandoverCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Создать передачу смены:
    - связывает from_shift и to_shift (опционально)
    - связывает с активами (asset_ids)
    - создаёт упрощённый лог для последующего экспорта
    """
    # Создаем handover без списка asset_ids (он обрабатывается отдельно)
    handover_data = handover.dict()
    asset_ids = handover_data.pop('asset_ids')
    
    db_handover = ShiftHandover(**handover_data)
    db.add(db_handover)
    db.commit()
    db.refresh(db_handover)
    
    # Создаем связи с assets
    for asset_id in asset_ids:
        handover_asset = HandoverAsset(
            handover_id=db_handover.id,
            asset_id=asset_id
        )
        db.add(handover_asset)
    
    db.commit()
    
    # Получаем связанные assets для ответа
    assets = (
        db.query(Asset)
        .join(HandoverAsset, Asset.id == HandoverAsset.asset_id)
        .filter(HandoverAsset.handover_id == db_handover.id)
        .all()
    )
    
    # Создаем лог передачи для простого экспорта
    try:
        # Получаем информацию о сменах
        from_shift = db.query(Shift).filter(Shift.id == db_handover.from_shift_id).first() if db_handover.from_shift_id else None
        to_shift = db.query(Shift).filter(Shift.id == db_handover.to_shift_id).first() if db_handover.to_shift_id else None
        
        # Подготавливаем информацию об активах (простая текстовая строка)
        assets_info_list = []
        for asset in assets:
            assets_info_list.append(f"{asset.title} ({asset.asset_type}): {asset.description}")
        assets_info_str = "; ".join(assets_info_list) if assets_info_list else "Нет активов"
        
        # Создаем лог (упрощённую запись для экспорта)
        now = datetime.now()
        handover_log = HandoverLog(
            log_date=now.strftime("%Y-%m-%d"),
            log_time=now.strftime("%H:%M:%S"),
            from_shift_user=from_shift.user_name if from_shift else "Не указано",
            from_shift_time=f"{from_shift.start_time}-{from_shift.end_time}" if from_shift else "Не указано",
            to_shift_user=to_shift.user_name if to_shift else "Не указано",
            to_shift_time=f"{to_shift.start_time}-{to_shift.end_time}" if to_shift else "Не указано",
            handover_notes=db_handover.handover_notes,
            assets_info=assets_info_str
        )
        db.add(handover_log)
        db.commit()
        print(f"Handover log created successfully for handover {db_handover.id}")
    except Exception as e:
        # Логирование ошибок при создании лога, не ломает основной процесс
        print(f"Error creating handover log: {e}")
    
    # Возвращаем HandoverResponse
    return HandoverResponse(
        id=db_handover.id,
        from_shift_id=db_handover.from_shift_id,
        to_shift_id=db_handover.to_shift_id,
        handover_notes=db_handover.handover_notes,
        assets=assets,
        created_at=db_handover.created_at
    )


@app.get("/api/handovers/", response_model=List[HandoverResponse])
async def get_handovers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получить список всех передач смен.
    Для каждой передачи также подтягиваются связанные активы.
    """
    handovers = db.query(ShiftHandover).order_by(ShiftHandover.created_at.desc()).all()
    
    result = []
    for handover in handovers:
        assets = (
            db.query(Asset)
            .join(HandoverAsset, Asset.id == HandoverAsset.asset_id)
            .filter(HandoverAsset.handover_id == handover.id)
            .all()
        )
        result.append(HandoverResponse(
            id=handover.id,
            from_shift_id=handover.from_shift_id,
            to_shift_id=handover.to_shift_id,
            handover_notes=handover.handover_notes,
            assets=assets,
            created_at=handover.created_at
        ))
    
    return result


@app.get("/api/handovers/{handover_id}", response_model=HandoverResponse)
async def get_handover(
    handover_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Получить конкретную передачу смены по ID."""
    handover = db.query(ShiftHandover).filter(ShiftHandover.id == handover_id).first()
    if not handover:
        raise HTTPException(status_code=404, detail="Handover not found")
    
    assets = (
        db.query(Asset)
        .join(HandoverAsset, Asset.id == HandoverAsset.asset_id)
        .filter(HandoverAsset.handover_id == handover.id)
        .all()
    )
    
    return HandoverResponse(
        id=handover.id,
        from_shift_id=handover.from_shift_id,
        to_shift_id=handover.to_shift_id,
        handover_notes=handover.handover_notes,
        assets=assets,
        created_at=handover.created_at
    )


@app.put("/api/handovers/{handover_id}", response_model=HandoverResponse)
async def update_handover(
    handover_id: int,
    handover_update: HandoverCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Обновить передачу смены:
    - меняем информацию о сменах
    - переопределяем список связанных активов
    """
    handover = db.query(ShiftHandover).filter(ShiftHandover.id == handover_id).first()
    if not handover:
        raise HTTPException(status_code=404, detail="Handover not found")
    
    # Обновляем данные handover
    handover_data = handover_update.dict()
    asset_ids = handover_data.pop('asset_ids')
    
    for key, value in handover_data.items():
        setattr(handover, key, value)
    
    # Удаляем старые связи с assets
    db.query(HandoverAsset).filter(HandoverAsset.handover_id == handover_id).delete()
    
    # Создаем новые связи с assets
    for asset_id in asset_ids:
        handover_asset = HandoverAsset(
            handover_id=handover.id,
            asset_id=asset_id
        )
        db.add(handover_asset)
    
    db.commit()
    db.refresh(handover)
    
    # Получаем связанные assets для ответа
    assets = (
        db.query(Asset)
        .join(HandoverAsset, Asset.id == HandoverAsset.asset_id)
        .filter(HandoverAsset.handover_id == handover.id)
        .all()
    )
    
    return HandoverResponse(
        id=handover.id,
        from_shift_id=handover.from_shift_id,
        to_shift_id=handover.to_shift_id,
        handover_notes=handover.handover_notes,
        assets=assets,
        created_at=handover.created_at
    )


@app.get("/api/handovers/export")
async def export_handovers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Экспорт всех передач смен из упрощённых логов (HandoverLog).
    Возвращает простой JSON, пригодный для последующей выгрузки в Excel/Google Sheets.
    
    Также, если логов ещё нет, создаёт тестовую запись для проверки.
    """
    
    print(f"=== LOG EXPORT REQUEST START ===")
    print(f"Export request from user: {current_user.username}")
    
    try:
        # Сначала проверяем, есть ли уже логи
        logs_count = db.query(HandoverLog).count()
        print(f"Current logs count: {logs_count}")
        
        if logs_count == 0:
            print("No logs found, creating a test log entry...")
            # Создаем тестовый лог
            from datetime import datetime
            test_log = HandoverLog(
                log_date="2024-01-15",
                log_time="14:30:00",
                from_shift_user="Тестовый Пользователь 1",
                from_shift_time="09:00-21:00",
                to_shift_user="Тестовый Пользователь 2", 
                to_shift_time="21:00-09:00",
                handover_notes="Тестовая передача смены для проверки экспорта",
                assets_info="Тестовый кейс (CASE): Проверка работы системы"
            )
            db.add(test_log)
            db.commit()
            print("Test log created successfully")
        
        # Получаем все логи передач
        logs = db.query(HandoverLog).order_by(HandoverLog.created_at.desc()).all()
        print(f"Found {len(logs)} handover logs to export")
        
        # Очень простая структура данных для экспорта
        export_data = []
        for i, log in enumerate(logs):
            try:
                log_dict = {
                    "id": log.id,
                    "date": str(log.log_date),
                    "time": str(log.log_time),
                    "from_shift_user": str(log.from_shift_user),
                    "from_shift_time": str(log.from_shift_time),
                    "to_shift_user": str(log.to_shift_user),
                    "to_shift_time": str(log.to_shift_time),
                    "handover_notes": str(log.handover_notes),
                    "assets_info": str(log.assets_info)
                }
                export_data.append(log_dict)
                print(f"Processed log {i+1}/{len(logs)}: ID {log.id}")
            except Exception as e:
                # Если какая-то запись сломана — просто логируем ошибку и продолжаем
                print(f"Error processing log {log.id}: {e}")
                continue
        
        result = {
            "data": export_data,
            "total": len(export_data),
            "success": True
        }
        
        print(f"Export completed successfully. Processed {len(export_data)} logs")
        print(f"Returning result: {len(str(result))} characters")
        
        return result
        
    except Exception as e:
        # Глобальная обработка ошибок экспорта
        print(f"Log export error: {e}")
        import traceback
        traceback.print_exc()
        return {
            "data": [],
            "total": 0,
            "error": str(e),
            "success": False
        }


@app.delete("/api/handovers/clear")
async def clear_handovers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Очистка всех передач смен и логов (ТОЛЬКО для администраторов).
    Полностью удаляет:
    - связи handover_assets
    - сами handovers
    - логи handover_logs
    """
    # Удаляем все связи с активами
    db.query(HandoverAsset).delete()
    
    # Удаляем все передачи смен
    handovers_count = db.query(ShiftHandover).count()
    db.query(ShiftHandover).delete()
    
    # Удаляем все логи передач
    logs_count = db.query(HandoverLog).count()
    db.query(HandoverLog).delete()
    
    db.commit()
    
    return {
        "message": f"Удалено {handovers_count} передач смен и {logs_count} логов", 
        "deleted_handovers": handovers_count,
        "deleted_logs": logs_count
    }


# ====================================
#   СОЗДАНИЕ АДМИНИСТРАТОРА ПО УМОЛЧАНИЮ
# ====================================

def create_default_admin(db: Session):
    """
    Создаёт администратора по умолчанию, если его ещё нет.
    Используется при старте приложения.
    """
    # Проверяем, есть ли уже администратор с username "Sideffect"
    admin_user = db.query(User).filter(User.username == "Sideffect").first()
    if not admin_user:
        # Создаем администратора по умолчанию
        admin_user = User(
            username="Sideffect",
            hashed_password=get_password_hash("admin123"),
            name="Тимофей",
            position="Тех поддержка",
            is_active=True,
            is_admin=True
        )
        db.add(admin_user)
        db.commit()
        print("✅ Создан администратор по умолчанию: Sideffect / admin123")


# ВАЖНО: мы не дропаем таблицы, чтобы не потерять данные
# Base.metadata.drop_all(bind=engine)  # ЗАКОММЕНТИРОВАНО - не удаляем данные!

# Создаем только новые таблицы, если их ещё нет
Base.metadata.create_all(bind=engine)

# При старте приложения создаём дефолтного админа (если ещё не создан)
db = SessionLocal()
try:
    create_default_admin(db)
finally:
    db.close()


# =================
#   ТОЧКА ВХОДА
# =================

if __name__ == "__main__":
    """
    Локальный запуск приложения:
    python main.py

    Приложение поднимается на 0.0.0.0:8000
    Swagger UI будет доступен по адресу http://localhost:8000/docs
    """
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
