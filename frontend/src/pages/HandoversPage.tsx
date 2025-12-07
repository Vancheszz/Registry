import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Download, Trash2, Maximize2, X, CalendarClock, Sparkles, Stethoscope } from 'lucide-react';
import { handoversApi, shiftsApi } from '../api.ts';
import { Handover, Shift, CreateHandover, User } from '../types.ts';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { authService } from '../services/auth.ts';

const HandoversPage: React.FC = () => {
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingHandover, setEditingHandover] = useState<Handover | null>(null);
  const [fullscreenNotes, setFullscreenNotes] = useState<string | null>(null);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [selectedShiftIdsForClear, setSelectedShiftIdsForClear] = useState<number[]>([]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateHandover>();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!currentUser || shifts.length === 0) return;
    const personal = shifts.filter(shift => shift.user_id === currentUser.id);
    const active = findActiveShift(personal);
    setActiveShift(active);
  }, [shifts, currentUser]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [handoversData, shiftsData] = await Promise.all([
        handoversApi.getAll(),
        shiftsApi.getAll(),
      ]);
      setHandovers(handoversData);
      setShifts(shiftsData);
      const me = await authService.getCurrentUser();
      setCurrentUser(me);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Не удалось загрузить журнал наблюдений');
    } finally {
      setLoading(false);
    }
  };

  const findActiveShift = (personalShifts: Shift[]): Shift | null => {
    const now = new Date();

    for (const shift of personalShifts) {
      const shiftDate = new Date(shift.date);
      const [startHour, startMinute] = shift.start_time.split(':').map(Number);
      const [endHour, endMinute] = shift.end_time.split(':').map(Number);

      const shiftStart = new Date(shiftDate);
      shiftStart.setHours(startHour, startMinute, 0, 0);

      let shiftEnd = new Date(shiftDate);
      shiftEnd.setHours(endHour, endMinute, 0, 0);
      if (endHour < startHour) {
        shiftEnd.setDate(shiftEnd.getDate() + 1);
      }

      if (now >= shiftStart && now <= shiftEnd) {
        return shift;
      }
    }

    return null;
  };

  const personalShifts = useMemo(() => {
    if (!currentUser) return shifts;
    return shifts.filter(shift => shift.user_id === currentUser.id);
  }, [shifts, currentUser]);

  const openCreateModal = () => {
    setEditingHandover(null);
    const defaultShiftId = activeShift?.id || personalShifts[0]?.id || undefined;
    reset({
      from_shift_id: defaultShiftId,
      handover_notes: '',
    });
    setShowModal(true);
  };

  const openEditModal = (handover: Handover) => {
    setEditingHandover(handover);
    reset({
      from_shift_id: handover.from_shift_id || undefined,
      handover_notes: handover.handover_notes,
    });
    setShowModal(true);
  };

  const formatMoscow = (iso: string) => {
    const normalized = iso.endsWith('Z') ? iso : `${iso}Z`;
    return new Date(normalized).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
  };

  const handleCreateHandover = async (data: CreateHandover) => {
    const payload: CreateHandover = {
      from_shift_id: data.from_shift_id ? Number(data.from_shift_id) : undefined,
      handover_notes: data.handover_notes.trim(),
      asset_ids: [],
    };

    if (!payload.from_shift_id) {
      toast.error('Выберите приём текущего врача');
      return;
    }

    try {
      if (editingHandover) {
        await handoversApi.update(editingHandover.id, payload);
        toast.success('Запись обновлена');
      } else {
        await handoversApi.create(payload);
        toast.success('Запись добавлена');
      }

      setShowModal(false);
      setEditingHandover(null);
      reset();
      loadData();
    } catch (error: any) {
      console.error('Error creating/updating handover:', error);
      const detail = error.response?.data?.detail;
      toast.error(detail || 'Ошибка при сохранении записи');
    }
  };

  const getShiftInfo = (shiftId: number | null | undefined) => {
    if (!shiftId) return null;
    return shifts.find(s => s.id === shiftId) || null;
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const exportData = await handoversApi.export();

      if (!exportData || !exportData.data || exportData.data.length === 0) {
        toast('Нет данных для экспорта', { icon: 'ℹ️' });
        return;
      }

      const csvData = exportData.data.map((log: any) => ({
        'ID': log.id || 'Не указано',
        'Дата': log.date || 'Не указано',
        'Время': log.time || 'Не указано',
        'Врач': log.from_shift_user || 'Не указано',
        'Время приёма': log.from_shift_time || 'Не указано',
        'Описание наблюдений': log.handover_notes || 'Не указано',
      }));

      if (csvData.length === 0) {
        toast('Нет данных для экспорта', { icon: 'ℹ️' });
        return;
      }

      const headers = Object.keys(csvData[0] || {});
      const csvContent = [
        headers.join(','),
        ...csvData.map(row =>
          headers.map(header => `"${String((row as any)[header] || '').replace(/"/g, '""')}"`).join(',')
        )
      ].join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `handovers_export_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      toast.success(`Экспортировано ${exportData.total} записей журнала`);
    } catch (error: any) {
      console.error('Error exporting data:', error);
      if (error.response?.status === 403) {
        toast.error('Недостаточно прав для экспорта данных');
      } else {
        toast.error('Ошибка при экспорте данных');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearData = async () => {
    const hasSelection = selectedShiftIdsForClear.length > 0;
    const baseConfirm = hasSelection
      ? 'Удалить все записи журнала для выбранных смен?'
      : 'Удалить весь журнал наблюдений и связанные логи?';

    if (!window.confirm(baseConfirm)) {
      return;
    }

    try {
      setIsClearing(true);
      const result = await handoversApi.clear(hasSelection ? selectedShiftIdsForClear : undefined);
      toast.success(result.message);
      setSelectedShiftIdsForClear([]);
      loadData();
    } catch (error: any) {
      console.error('Error clearing data:', error);
      if (error.response?.status === 403) {
        toast.error('Недостаточно прав. Только администраторы могут очищать данные.');
      } else {
        toast.error('Ошибка при очистке данных');
      }
    } finally {
      setIsClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-50 via-white to-emerald-50 p-6 border border-primary-100 shadow-sm">
        <div className="absolute right-6 top-6 text-primary-200">
          <Sparkles className="w-10 h-10" />
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <span className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-primary-600 text-white">
                <CalendarClock size={20} />
              </span>
              Журнал наблюдений
            </h1>
            <p className="text-sm text-gray-600 mt-1">Фиксируйте заметки по текущему приёму врача. Следующий приём и активы больше не требуются.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="btn btn-secondary flex items-center gap-2 rounded-xl"
              title="Экспорт всех записей в CSV"
            >
              <Download size={18} />
              {isExporting ? 'Экспорт...' : 'Экспорт'}
            </button>
            <button
              onClick={handleClearData}
              disabled={isClearing}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl shadow-sm hover:bg-red-700 disabled:opacity-50 transition"
              title="Очистить журнал"
            >
              <Trash2 size={18} />
              {isClearing ? 'Очистка...' : 'Очистить'}
            </button>
            <button
              onClick={openCreateModal}
              className="btn btn-primary flex items-center gap-2 rounded-xl"
            >
              <Plus size={18} />
              Новая запись
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <label className="text-xs text-gray-500">Смены для точечной очистки</label>
            <select
              multiple
              value={selectedShiftIdsForClear.map(String)}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions).map(opt => Number(opt.value));
                setSelectedShiftIdsForClear(selected);
              }}
              className="w-full border rounded-xl px-3 py-2 bg-white shadow-inner focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              {personalShifts.map(shift => (
                <option key={shift.id} value={shift.id}>
                  {shift.date} • {shift.start_time}-{shift.end_time} — {shift.patient_name || shift.user_name}
                </option>
              ))}
            </select>
          </div>
          {activeShift && (
            <div className="px-4 py-3 rounded-xl bg-white/70 border border-primary-100 shadow-inner">
              <p className="text-xs text-gray-500">Активный приём</p>
              <p className="text-sm font-semibold text-primary-700">{activeShift.user_name}</p>
              <p className="text-xs text-gray-600">{activeShift.date} · {activeShift.start_time}-{activeShift.end_time}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4">
        {handovers.length === 0 && (
          <div className="bg-white/80 border border-dashed border-primary-200 rounded-2xl p-8 text-center text-gray-500 shadow-sm">
            Записей ещё нет. Добавьте заметку для текущего приёма.
          </div>
        )}
        {handovers.map((handover) => {
          const shift = getShiftInfo(handover.from_shift_id);
          return (
            <div key={handover.id} className="bg-white/90 border border-gray-100 rounded-2xl p-5 shadow hover:shadow-md transition">
              <div className="flex flex-col md:flex-row md:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-3 bg-primary-50 text-primary-700 rounded-xl shadow-inner">
                    <CalendarClock size={18} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase text-gray-400">Запись #{handover.id}</p>
                    <p className="text-base font-semibold text-gray-900">{shift?.user_name || 'Текущий врач'}</p>
                    {shift && (
                      <p className="text-sm text-gray-600">
                        {shift.date} • {shift.start_time}-{shift.end_time}
                      </p>
                    )}
                    {shift?.patient_name && (
                      <p className="flex items-center gap-1 text-sm text-primary-700">
                        <Stethoscope className="w-4 h-4" /> {shift.patient_name}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 text-sm">
                  <button
                    onClick={() => openEditModal(handover)}
                    className="px-3 py-2 rounded-lg border border-primary-100 text-primary-700 hover:bg-primary-50 transition"
                  >
                    Редактировать
                  </button>
                  <button
                    onClick={async () => {
                      if (!window.confirm('Удалить запись журнала?')) return;
                      try {
                        await handoversApi.delete(handover.id);
                        toast.success('Запись удалена');
                        loadData();
                      } catch (e) {
                        toast.error('Не удалось удалить запись');
                      }
                    }}
                    className="px-3 py-2 rounded-lg border border-red-100 text-red-600 hover:bg-red-50 transition"
                  >
                    Удалить
                  </button>
                </div>
              </div>

              <div className="mt-4 bg-gradient-to-r from-primary-50 via-white to-emerald-50 border border-primary-100 rounded-xl p-4 shadow-inner">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">Заметки по приёму</h4>
                  <button
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    onClick={() => setFullscreenNotes(handover.handover_notes)}
                  >
                    <Maximize2 size={16} /> Открыть
                  </button>
                </div>
                <p className="text-gray-700 whitespace-pre-wrap break-words text-wrap-force line-clamp-4">
                  {handover.handover_notes}
                </p>
              </div>

              <div className="mt-3 text-xs text-gray-500 flex items-center justify-between">
                <span>Создано: {formatMoscow(handover.created_at)}</span>
                {shift?.position && <span className="text-gray-400">{shift.position}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 modal-overlay">
          <div className="bg-white rounded-2xl p-6 w-full max-w-3xl shadow-2xl border border-gray-100 modal-panel">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs uppercase text-gray-400">Заметка</p>
                <h2 className="text-xl font-bold">{editingHandover ? 'Редактировать запись' : 'Добавить запись'}</h2>
              </div>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit(handleCreateHandover)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Приём текущего врача</label>
                <select
                  {...register('from_shift_id')}
                  className="w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
                >
                  <option value="">Выберите приём</option>
                  {personalShifts.map((shift) => (
                    <option
                      key={shift.id}
                      value={shift.id}
                      className={activeShift?.id === shift.id ? 'bg-primary-50' : ''}
                    >
                      {shift.date} — {shift.start_time}-{shift.end_time} ({shift.patient_name || shift.user_name})
                    </option>
                  ))}
                </select>
                {errors.from_shift_id && (
                  <p className="text-red-500 text-sm mt-1">{errors.from_shift_id.message}</p>
                )}
                {personalShifts.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">Нет приёмов, связанных с вашей учетной записью.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Заметки *</label>
                <textarea
                  {...register('handover_notes', { required: 'Заметки обязательны' })}
                  rows={5}
                  className="w-full border rounded-xl px-3 py-2 textarea-wrap resize-vertical focus:outline-none focus:ring-2 focus:ring-primary-300"
                  placeholder="Опишите наблюдения, рекомендации и дальнейшие шаги для пациента"
                />
                {errors.handover_notes && (
                  <p className="text-red-500 text-sm mt-1">{errors.handover_notes.message}</p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-xl hover:bg-primary-700 transition"
                >
                  {editingHandover ? 'Сохранить изменения' : 'Сохранить запись'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {fullscreenNotes && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 modal-overlay">
          <div className="bg-white rounded-2xl p-6 w-full max-w-4xl max-h-[85vh] overflow-y-auto shadow-2xl modal-panel">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-bold">Заметки по приёму</h2>
              <button className="text-gray-600 hover:text-gray-800" onClick={() => setFullscreenNotes(null)}>
                <X size={20} />
              </button>
            </div>
            <p className="text-gray-700 whitespace-pre-wrap break-words text-wrap-force">{fullscreenNotes}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default HandoversPage;
