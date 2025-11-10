import React, { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronLeft, ChevronRight, Edit, Trash2, Stethoscope } from 'lucide-react';
import { shiftsApi, usersApi, patientsApi } from '../api.ts';
import { Shift, User, CreateShift, Patient } from '../types';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

const AppointmentsPage: React.FC = () => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [isMultipleMode, setIsMultipleMode] = useState(false);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<CreateShift>();
  const watchedShiftType = watch('shift_type');
  const appointmentTypes: Record<string, { label: string; gradient: string; accent: string; dot: string }> = {
    consultation: {
      label: 'Консультация',
      gradient: 'from-primary-50 to-emerald-50',
      accent: 'text-primary-700',
      dot: 'bg-primary-500',
    },
    diagnostics: {
      label: 'Диагностика',
      gradient: 'from-sky-50 to-blue-100',
      accent: 'text-sky-700',
      dot: 'bg-sky-500',
    },
    follow_up: {
      label: 'Повторный визит',
      gradient: 'from-violet-50 to-purple-100',
      accent: 'text-violet-700',
      dot: 'bg-violet-500',
    },
    procedure: {
      label: 'Процедура',
      gradient: 'from-amber-50 to-orange-100',
      accent: 'text-amber-700',
      dot: 'bg-amber-500',
    },
  };
  const defaultAppointmentMeta = {
    label: 'Приём',
    gradient: 'from-slate-50 to-slate-100',
    accent: 'text-slate-700',
    dot: 'bg-slate-500',
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [shiftsData, usersData, patientsData] = await Promise.all([
        shiftsApi.getAll(),
        usersApi.getAllPublic(),
        patientsApi.getAll()
      ]);
      setShifts(shiftsData);
      setUsers(usersData);
      setPatients(patientsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Принудительный ререндер при изменении месяца
  useEffect(() => {
    // Заставляем React полностью перерисовать календарь
    const timer = setTimeout(() => {
      // Пустой эффект для принудительного обновления
    }, 0);
    return () => clearTimeout(timer);
  }, [currentMonth]);

  // Функция для определения статуса смены
  const getShiftStatus = (shift: Shift) => {
    const now = new Date();
    const shiftDate = new Date(shift.date);
    const [startHour, startMinute] = shift.start_time.split(':').map(Number);
    const [endHour, endMinute] = shift.end_time.split(':').map(Number);
    
    // Создаем даты начала и конца смены
    const shiftStart = new Date(shiftDate);
    shiftStart.setHours(startHour, startMinute, 0, 0);
    
    let shiftEnd = new Date(shiftDate);
    shiftEnd.setHours(endHour, endMinute, 0, 0);
    
    // Если время окончания меньше времени начала - смена переходит на следующий день
    if (endHour < startHour) {
      shiftEnd.setDate(shiftEnd.getDate() + 1);
    }

    if (now < shiftStart) {
      return 'ожидается';
    }
    if (now >= shiftStart && now <= shiftEnd) {
      return 'идёт';
    }
    return 'завершён';
  };

  // Функция для получения цвета статуса
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'идёт':
        return 'bg-emerald-100 text-emerald-800';
      case 'ожидается':
        return 'bg-blue-100 text-blue-800';
      case 'завершён':
        return 'bg-slate-100 text-slate-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  // Получение дней месяца
  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Определяем день недели первого дня месяца (0 = воскресенье, корректируем на понедельник = 0)
    const firstDayOfWeek = (firstDay.getDay() + 6) % 7;
    
    const days: (number | null)[] = [];
    
    // Добавляем пустые ячейки для предыдущего месяца
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }
    
    // Добавляем дни текущего месяца
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    // Добавляем пустые ячейки для следующего месяца, чтобы получить полные 6 недель (42 дня)
    while (days.length < 42) {
      days.push(null);
    }
    
    return days;
  };

  // Получение смен для конкретного дня
  const getShiftsForDay = (day: number) => {
    if (!day) return [];
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return shifts.filter(shift => shift.date === dateStr);
  };

  // Открытие модального окна создания смены
  const openCreateModal = (day?: number) => {
    setEditingShift(null);
    setIsMultipleMode(false);
    setSelectedUsers([]);
    
    const date = day 
      ? `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      : new Date().toISOString().split('T')[0];
    
    reset({
      date,
      user_id: 0,
      start_time: '09:00',
      end_time: '09:30',
      shift_type: 'consultation',
      patient_id: undefined,
      notes: '',
    });
    setShowModal(true);
  };

  // Открытие модального окна для множественного создания
  const openMultipleModal = (day?: number) => {
    setEditingShift(null);
    setIsMultipleMode(true);
    setSelectedUsers([]);
    
    const date = day 
      ? `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      : new Date().toISOString().split('T')[0];
    
    reset({
      date,
      user_id: 0,
      start_time: '09:00',
      end_time: '09:30',
      shift_type: 'consultation',
      patient_id: undefined,
      notes: '',
    });
    setShowModal(true);
  };

  // Открытие модального окна редактирования
  const openEditModal = (shift: Shift) => {
    setEditingShift(shift);
    setIsMultipleMode(false);
    const normalizedType = appointmentTypes[shift.shift_type] ? shift.shift_type : 'consultation';
    reset({
      date: shift.date,
      user_id: shift.user_id,
      start_time: shift.start_time,
      end_time: shift.end_time,
      shift_type: normalizedType,
      patient_id: shift.patient_id,
      notes: shift.notes,
    });
    setShowModal(true);
  };

  // Создание/обновление смены
  const handleCreateShift = async (data: CreateShift) => {
    try {
      const payload: CreateShift = {
        ...data,
        patient_id: data.patient_id && data.patient_id > 0 ? data.patient_id : undefined,
      };

      if (editingShift) {
        await shiftsApi.update(editingShift.id, payload);
        toast.success('Приём обновлён');
      } else if (isMultipleMode && selectedUsers.length > 0) {
        const shiftsToCreate = selectedUsers.map(userId => ({
          ...payload,
          user_id: userId
        }));
        await shiftsApi.createMultiple(shiftsToCreate);
        toast.success(`Запланировано ${selectedUsers.length} приёмов`);
      } else {
        await shiftsApi.create(payload);
        toast.success('Приём создан');
      }

      setShowModal(false);
      setEditingShift(null);
      setSelectedUsers([]);
      reset();
      loadData();
    } catch (error) {
      console.error('Error creating/updating shift:', error);
      toast.error('Ошибка при сохранении смены');
    }
  };

  // Удаление смены
  const handleDeleteShift = async (shiftId: number) => {
    if (!window.confirm('Удалить приём? Действие нельзя отменить.')) {
      return;
    }

    try {
      await shiftsApi.delete(shiftId);
      toast.success('Приём удалён');
      loadData();
    } catch (error) {
      console.error('Error deleting shift:', error);
      toast.error('Ошибка при удалении смены');
    }
  };

  // Отслеживание изменений типа смены
  useEffect(() => {
    const templates: Record<string, { start: string; end: string }> = {
      consultation: { start: '09:00', end: '09:30' },
      diagnostics: { start: '10:00', end: '11:00' },
      follow_up: { start: '12:00', end: '12:30' },
      procedure: { start: '14:00', end: '15:00' },
    };

    if (watchedShiftType && templates[watchedShiftType]) {
      setValue('start_time', templates[watchedShiftType].start);
      setValue('end_time', templates[watchedShiftType].end);
    }
  }, [watchedShiftType, setValue]);

  // Переключение месяца
  const changeMonth = (direction: number) => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setMonth(newMonth.getMonth() + direction);
      return newMonth;
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const days = getDaysInMonth();
  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Расписание приёмов</h1>
          <p className="text-sm text-gray-500 mt-1">Следите за загруженностью врачей и историей визитов пациентов</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => openMultipleModal()}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Plus size={20} />
            Назначить серию приёмов
          </button>
          <button
            onClick={() => openCreateModal()}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus size={20} />
            Назначить приём
          </button>
        </div>
      </div>

      {/* Навигация по месяцам */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow">
        <button
          onClick={() => changeMonth(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-xl font-semibold">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h2>
        <button
          onClick={() => changeMonth(1)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Календарная сетка */}
        <div key={`calendar-container-${currentMonth.getFullYear()}-${currentMonth.getMonth()}`} className="bg-white rounded-lg shadow overflow-hidden" style={{ height: '816px' }}>
        {/* Заголовки дней недели */}
        <div className="grid grid-cols-7 bg-gray-50" style={{ height: '48px' }}>
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
            <div key={`header-${day}`} className="p-3 text-center text-sm font-medium text-gray-700 border border-gray-200 flex items-center justify-center">
              {day}
            </div>
          ))}
        </div>

        {/* Дни месяца */}
        <div key={`calendar-${currentMonth.getFullYear()}-${currentMonth.getMonth()}`} className="grid grid-cols-7 grid-rows-6 gap-0" style={{ height: '768px' }}>
          {days.map((day, index) => {
            if (!day) {
              return <div key={`empty-${currentMonth.getFullYear()}-${currentMonth.getMonth()}-${index}`} className="border border-gray-200 bg-gray-50"></div>;
            }

            const dayShifts = getShiftsForDay(day);
            const isToday = new Date().toDateString() === new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toDateString();

            return (
              <div
                key={`day-${currentMonth.getFullYear()}-${currentMonth.getMonth()}-${day}`}
                className={`border border-gray-200 p-2 overflow-y-auto ${
                  isToday ? 'bg-primary-50' : 'bg-white'
                } hover:bg-gray-50`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-sm font-medium ${isToday ? 'text-primary-700' : 'text-gray-900'}`}>
                    {day}
                  </span>
                  <button
                    onClick={() => openCreateModal(day)}
                    className="text-gray-400 hover:text-blue-600 p-1"
                    title="Добавить смену"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Смены */}
                <div className="space-y-1.5">
                  {dayShifts
                    .sort((a, b) => {
                      // Сортируем: дневные смены выше ночных
                      if (a.shift_type === 'day' && b.shift_type === 'night') return -1;
                      if (a.shift_type === 'night' && b.shift_type === 'day') return 1;
                      return 0;
                    })
                    .map(shift => {
                    const user = users.find(u => u.id === shift.user_id);
                    const status = getShiftStatus(shift);
                    const meta = appointmentTypes[shift.shift_type] || defaultAppointmentMeta;

                    return (
                      <div
                        key={shift.id}
                        className={`text-xs p-3 rounded-lg border-2 border-white/60 bg-gradient-to-r ${meta.gradient} hover:shadow-md transition-all duration-200`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`}></span>
                              <p className={`font-semibold text-xs leading-tight truncate ${meta.accent}`}>
                                {meta.label}
                              </p>
                            </div>
                            <p className="text-xs text-gray-600">
                              <span className="font-semibold text-gray-800">Врач:</span> {user?.name || 'Неизвестно'}
                            </p>
                            {shift.patient_name ? (
                              <p className="text-xs text-gray-600 flex items-center gap-1">
                                <Stethoscope className="w-3 h-3 text-primary-500" />
                                {shift.patient_name}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-400">Пациент не назначен</p>
                            )}
                            <p className="text-xs text-gray-600">
                              {shift.start_time} – {shift.end_time}
                            </p>
                            {shift.notes && (
                              <p className="text-xs text-gray-500 italic line-clamp-2">{shift.notes}</p>
                            )}
                            <span className={`inline-block px-1.5 py-0.5 text-[11px] rounded-full font-medium ${getStatusColor(status)}`}>
                              {status}
                            </span>
                          </div>
                          <div className="flex gap-1 ml-1">
                            <button
                              onClick={() => openEditModal(shift)}
                              className="text-primary-700 hover:text-primary-900 p-1 rounded hover:bg-white/60 transition-colors"
                              title="Редактировать"
                            >
                              <Edit size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteShift(shift.id)}
                              className="text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-white/60 transition-colors"
                              title="Удалить"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Модальное окно создания/редактирования смены */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal-overlay">
          <div className="bg-white rounded-lg p-6 w-full max-w-none resizable-modal modal-panel">
            <h2 className="text-xl font-bold mb-4">
              {editingShift ? 'Редактировать приём' :
               isMultipleMode ? 'Назначить серию приёмов' : 'Назначить приём'}
            </h2>
            <form onSubmit={handleSubmit(handleCreateShift)}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Дата приёма *</label>
                  <input
                    type="date"
                    {...register('date', { required: 'Дата обязательна' })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                  {errors.date && (
                    <p className="text-red-500 text-sm mt-1">{errors.date.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Тип приёма *</label>
                  <select
                    {...register('shift_type', { required: 'Тип приёма обязателен' })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="consultation">Консультация</option>
                    <option value="diagnostics">Диагностика</option>
                    <option value="follow_up">Повторный визит</option>
                    <option value="procedure">Процедура / манипуляция</option>
                  </select>
                  {errors.shift_type && (
                    <p className="text-red-500 text-sm mt-1">{errors.shift_type.message}</p>
                  )}
                </div>

                {isMultipleMode ? (
                  <div>
                    <label className="block text-sm font-medium mb-2">Врачи *</label>
                    <div className="max-h-40 overflow-y-auto border rounded-lg p-2">
                      {users.map(user => (
                        <label key={user.id} className="flex items-center space-x-2 p-1">
                          <input
                            type="checkbox"
                            checked={selectedUsers.includes(user.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUsers(prev => [...prev, user.id]);
                              } else {
                                setSelectedUsers(prev => prev.filter(id => id !== user.id));
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-sm">{user.name} ({user.position})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium mb-2">Врач *</label>
                    <select
                      {...register('user_id', {
                        required: 'Врач обязателен',
                        valueAsNumber: true
                      })}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value={0}>Выберите сотрудника</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.position})
                        </option>
                      ))}
                    </select>
                    {errors.user_id && (
                      <p className="text-red-500 text-sm mt-1">{errors.user_id.message}</p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Начало</label>
                    <input
                      type="time"
                      {...register('start_time')}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Окончание</label>
                    <input
                      type="time"
                      {...register('end_time')}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Пациент</label>
                  <select
                    {...register('patient_id', { valueAsNumber: true })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Выберите пациента</option>
                    {patients.map(patient => (
                      <option key={patient.id} value={patient.id}>
                        {patient.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Комментарий для приёма</label>
                  <textarea
                    {...register('notes')}
                    className="w-full border rounded-lg px-3 py-2 resize-vertical"
                    rows={3}
                    placeholder="Напоминания для врача или важные детали для пациента"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  type="submit"
                  disabled={loading || (isMultipleMode && selectedUsers.length === 0)}
                  className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {editingShift ? 'Сохранить изменения' :
                   isMultipleMode ? `Запланировать ${selectedUsers.length} приёмов` : 'Сохранить'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentsPage;