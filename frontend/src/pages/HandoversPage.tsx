import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Download, Trash2, Maximize2, X } from 'lucide-react';
import { handoversApi, shiftsApi, assetsApi } from '../api.ts';
import { Handover, Shift, Asset, CreateHandover } from '../types';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

const HandoversPage: React.FC = () => {
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingHandover, setEditingHandover] = useState<Handover | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<number[]>([]);
  const [showAssetDetail, setShowAssetDetail] = useState(false);
  const [selectedAssetDetail, setSelectedAssetDetail] = useState<Asset | null>(null);
  const [fullscreenNotes, setFullscreenNotes] = useState<string | null>(null);

  const [suggestedToShift, setSuggestedToShift] = useState<Shift | null>(null);
  const [selectedActiveShift, setSelectedActiveShift] = useState<Shift | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<CreateHandover>();
  const watchedFromShift = watch('from_shift_id');

  useEffect(() => {
    loadData();
  }, []);

  // Функция для поиска следующей смены по графику
  const findNextShift = useCallback((fromShift: Shift): Shift | null => {
    const fromDate = new Date(fromShift.date);
    let targetDate: Date;
    let targetType: string;

    if (fromShift.shift_type === 'day') {
      // Если дневная смена, ищем ночную того же дня
      targetDate = new Date(fromDate);
      targetType = 'night';
    } else {
      // Если ночная смена, ищем дневную следующего дня
      targetDate = new Date(fromDate);
      targetDate.setDate(targetDate.getDate() + 1);
      targetType = 'day';
    }

    const targetDateStr = targetDate.toISOString().split('T')[0];
    
    // Ищем смену на целевую дату с целевым типом
    const candidateShifts = shifts.filter(shift => 
      shift.date === targetDateStr && 
      shift.shift_type === targetType
    );

    // Возвращаем первую найденную смену (можно добавить дополнительную логику выбора)
    return candidateShifts.length > 0 ? candidateShifts[0] : null;
  }, [shifts]);

  // Отслеживаем изменение выбранной "передающей смены" и предлагаем следующую
  useEffect(() => {
    if (watchedFromShift && shifts.length > 0) {
      const fromShift = shifts.find(s => s.id === parseInt(watchedFromShift.toString()));
      if (fromShift) {
        const nextShift = findNextShift(fromShift);
        setSuggestedToShift(nextShift);
        if (nextShift) {
          setValue('to_shift_id', nextShift.id);
        }
      }
    }
  }, [watchedFromShift, shifts, setValue, findNextShift]);

  // Функция для поиска активной смены
  const findActiveShift = (): Shift | null => {
    const now = new Date();
    
    // Проходим по всем сменам и ищем активную
    for (const shift of shifts) {
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

      // Проверяем, активна ли смена сейчас
      if (now >= shiftStart && now <= shiftEnd) {
        return shift;
      }
    }
    
    return null;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [handoversData, shiftsData, assetsData] = await Promise.all([
        handoversApi.getAll(),
        shiftsApi.getAll(),
        assetsApi.getAll()
      ]);
      setHandovers(handoversData);
      setShifts(shiftsData);
      setAssets(assetsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingHandover(null);
    setSelectedAssets([]);
    
    // Ищем активную смену и автоматически выбираем её
    const activeShift = findActiveShift();
    setSelectedActiveShift(activeShift);
    
    reset({
      from_shift_id: activeShift ? activeShift.id : undefined,
      to_shift_id: undefined,
      handover_notes: '',
      asset_ids: []
    });
    
    // Если есть активная смена, сразу предлагаем следующую
    if (activeShift) {
      const nextShift = findNextShift(activeShift);
      setSuggestedToShift(nextShift);
      if (nextShift) {
        setValue('to_shift_id', nextShift.id);
      }
    }
    
    setShowModal(true);
  };

  const openEditModal = (handover: Handover) => {
    setEditingHandover(handover);
    setSelectedAssets(handover.assets.map(asset => asset.id));
    reset({
      from_shift_id: handover.from_shift_id || undefined,
      to_shift_id: handover.to_shift_id || undefined,
      handover_notes: handover.handover_notes,
      asset_ids: handover.assets.map(asset => asset.id)
    });
    setShowModal(true);
  };

  const formatMoscow = (iso: string) => {
    const normalized = iso.endsWith('Z') ? iso : `${iso}Z`;
    return new Date(normalized).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
  };

  const handleCreateHandover = async (data: CreateHandover) => {
    try {
      const handoverData = {
        ...data,
        asset_ids: selectedAssets
      };

      if (editingHandover) {
        await handoversApi.update(editingHandover.id, handoverData);
        toast.success('Запись обновлена');
      } else {
        await handoversApi.create(handoverData);
        toast.success('Запись добавлена');
      }
      
      setShowModal(false);
      setEditingHandover(null);
      setSelectedAssets([]);
      setSelectedActiveShift(null);
      setSuggestedToShift(null);
      reset();
      loadData();
    } catch (error) {
      console.error('Error creating/updating handover:', error);
      toast.error('Ошибка при сохранении записи');
    }
  };

  const toggleAssetSelection = (assetId: number) => {
    setSelectedAssets(prev => 
      prev.includes(assetId) 
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    );
  };

  const openAssetDetail = (asset: Asset) => {
    setSelectedAssetDetail(asset);
    setShowAssetDetail(true);
  };

  const getShiftInfo = (shiftId: number | null | undefined) => {
    if (!shiftId) return 'Не указана';
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) return 'Не найдена';
    return `${shift.user_name} (${shift.date} ${shift.start_time}-${shift.end_time})`;
  };

  const getAssetTypeDisplay = (type: string) => {
    switch (type) {
      case 'CASE': return 'CASE';
      case 'CHANGE_MANAGEMENT': return 'Change Management';
      case 'ORANGE_CASE': return 'Orange CASE';
      case 'CLIENT_REQUESTS': return 'Обращения клиентов';
      default: return type;
    }
  };

  const getAssetStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800';
      case 'Completed': return 'bg-blue-100 text-blue-800';
      case 'On Hold': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Функция экспорта данных
  const handleExport = async () => {
    try {
      setIsExporting(true);
      console.log('Starting export...');
      const exportData = await handoversApi.export();
      console.log('Export response:', exportData);
      
      if (!exportData || !exportData.data || exportData.data.length === 0) {
        toast('Нет данных для экспорта', { icon: 'ℹ️' });
        return;
      }
      
      // Подготавливаем данные для CSV из простых логов
      const csvData = exportData.data.map((log: any) => ({
        'ID': log.id || 'Не указано',
        'Дата': log.date || 'Не указано',
        'Время': log.time || 'Не указано',
        'Передающий': log.from_shift_user || 'Не указано',
        'Время приёма (от)': log.from_shift_time || 'Не указано',
        'Принимающий': log.to_shift_user || 'Не указано',
        'Время приёма (до)': log.to_shift_time || 'Не указано',
        'Описание передачи': log.handover_notes || 'Не указано',
        'Активы': log.assets_info || 'Нет активов'
      }));

      if (csvData.length === 0) {
        toast('Нет данных для экспорта', { icon: 'ℹ️' });
        return;
      }

      // Создаем CSV строку
      const headers = Object.keys(csvData[0] || {});
      const csvContent = [
        headers.join(','),
        ...csvData.map(row => 
          headers.map(header => `"${String((row as any)[header] || '').replace(/"/g, '""')}"`).join(',')
        )
      ].join('\n');

      // Скачиваем файл
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `handovers_export_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      
      toast.success(`Экспортировано ${exportData.total} записей журнала`);
    } catch (error: any) {
      console.error('Error exporting data:', error);
      if (error.response?.status === 422) {
        toast.error('Ошибка обработки данных на сервере. Проверьте данные передач.');
      } else if (error.response?.status === 403) {
        toast.error('Недостаточно прав для экспорта данных');
      } else {
        toast.error('Ошибка при экспорте данных');
      }
    } finally {
      setIsExporting(false);
    }
  };

  // Функция очистки данных
  const handleClearData = async () => {
    if (!window.confirm('Удалить весь журнал наблюдений и связанные логи? Это действие нельзя отменить!')) {
      return;
    }

    if (!window.confirm('Это действие удалит все записи журнала и связанные логи из базы данных. Подтвердите удаление.')) {
      return;
    }

    try {
      setIsClearing(true);
      const result = await handoversApi.clear();
      toast.success(result.message);
      loadData(); // Перезагружаем данные
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
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Журнал наблюдений</h1>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="btn btn-secondary flex items-center gap-2"
            title="Экспорт всех передач в CSV"
          >
            <Download size={20} />
            {isExporting ? 'Экспорт...' : 'Экспорт'}
          </button>
          <button
            onClick={handleClearData}
            disabled={isClearing}
            className="btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            title="Очистить всю базу данных передач"
          >
            <Trash2 size={20} />
            {isClearing ? 'Очистка...' : 'Очистить'}
          </button>
          <button
            onClick={openCreateModal}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus size={20} />
            Новая запись
          </button>
        </div>
      </div>

      {/* Handover Cards */}
      <div className="grid gap-6">
        {handovers.map((handover) => (
          <div key={handover.id} className="card">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Запись #{handover.id}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => openEditModal(handover)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
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
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Удалить
                </button>
              </div>
            </div>

            {/* Shift Information */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Информация о приёмах</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="font-medium">Предыдущий приём:</span>
                  <p className="text-gray-600">{getShiftInfo(handover.from_shift_id)}</p>
                </div>
                <div>
                  <span className="font-medium">Следующий приём:</span>
                  <p className="text-gray-600">{getShiftInfo(handover.to_shift_id)}</p>
                </div>
              </div>
            </div>

            {/* Handover Notes */}
            <div className="mb-4">
              <h4 className="font-medium text-gray-900 mb-2">Заметки по передаче:</h4>
              <div className="relative">
                <p className="text-gray-600 whitespace-pre-wrap break-words text-wrap-force line-clamp-5">
                  {handover.handover_notes}
                </p>
                <button
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  onClick={() => setFullscreenNotes(handover.handover_notes)}
                >
                  <Maximize2 size={16} /> Открыть
                </button>
              </div>
            </div>

            {/* Assets */}
            <div className="mb-4">
              <h4 className="font-medium text-gray-900 mb-2">
                Активы ({handover.assets.length})
              </h4>
              <div className="grid gap-3">
                {[
                  { label: 'CASE', key: 'CASE', ring: 'ring-blue-300', badge: 'bg-blue-100 text-blue-700' },
                  { label: 'Обращения', key: 'CLIENT_REQUESTS', ring: 'ring-green-300', badge: 'bg-green-100 text-green-700' },
                  { label: 'Orange CASE', key: 'ORANGE_CASE', ring: 'ring-orange-300', badge: 'bg-orange-100 text-orange-700' },
                  { label: 'Change Management', key: 'CHANGE_MANAGEMENT', ring: 'ring-purple-300', badge: 'bg-purple-100 text-purple-700' },
                ].map((grp) => (
                  <div key={grp.key}>
                    <div className="text-sm font-semibold text-gray-700 mb-2">{grp.label}</div>
                    {handover.assets.filter(a => a.asset_type === (grp.key as any)).map((asset) => (
                      <div
                        key={asset.id}
                        onClick={() => openAssetDetail(asset)}
                        className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors ring-2 ${grp.ring}`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900 break-words">{asset.title}</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAssetStatusColor(asset.status)} ${grp.badge}`}>
                              {asset.status === 'Active' ? 'Активен' : asset.status === 'Completed' ? 'Завершён' : 'На удержании'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 break-words whitespace-pre-wrap">
                            {asset.description.length > 100 
                              ? `${asset.description.substring(0, 100)}...` 
                              : asset.description}
                          </p>
                          <span className="text-xs text-gray-500">
                            {getAssetTypeDisplay(asset.asset_type)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Created Date */}
            <div className="text-xs text-gray-500">
              Создано: {formatMoscow(handover.created_at)}
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal-overlay">
          <div className="bg-white rounded-lg p-6 w-full max-w-none overflow-auto resizable-modal modal-panel modal-wide">
            <h2 className="text-xl font-bold mb-4">
              {editingHandover ? 'Редактировать запись' : 'Добавить запись'}
            </h2>
            <form onSubmit={handleSubmit(handleCreateHandover)}>
              {/* Shift Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Предыдущий приём
                    {selectedActiveShift && (
                      <span className="text-blue-600 text-xs ml-2">
                        (выбрана активная: {selectedActiveShift.user_name})
                      </span>
                    )}
                  </label>
                  <select
                    {...register('from_shift_id')}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Выберите приём</option>
                    {shifts.map((shift) => (
                      <option 
                        key={shift.id} 
                        value={shift.id}
                        className={selectedActiveShift?.id === shift.id ? 'bg-blue-50' : ''}
                      >
                        {shift.user_name} - {shift.date} ({shift.start_time}-{shift.end_time})
                        {selectedActiveShift?.id === shift.id ? ' ⭐ Активная' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Следующий приём
                    {suggestedToShift && (
                      <span className="text-green-600 text-xs ml-2">
                        (автопредложение: {suggestedToShift.user_name})
                      </span>
                    )}
                  </label>
                  <select
                    {...register('to_shift_id')}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Выберите приём</option>
                    {shifts.map((shift) => (
                      <option 
                        key={shift.id} 
                        value={shift.id}
                        className={suggestedToShift?.id === shift.id ? 'bg-green-50' : ''}
                      >
                        {shift.user_name} - {shift.date} ({shift.start_time}-{shift.end_time})
                        {suggestedToShift?.id === shift.id ? ' ⭐ Рекомендуется' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Заметки по передаче *</label>
                <textarea
                  {...register('handover_notes', { required: 'Заметки обязательны' })}
                  rows={4}
                  className="w-full border rounded-lg px-3 py-2 textarea-wrap resize-vertical"
                  style={{ 
                    wordWrap: 'break-word', 
                    overflowWrap: 'break-word', 
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflowX: 'hidden'
                  }}
                  placeholder="Опишите передаваемую информацию..."
                />
                {errors.handover_notes && (
                  <p className="text-red-500 text-sm mt-1">{errors.handover_notes.message}</p>
                )}
              </div>

              {/* Asset Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Выберите активы</label>
                <div className="max-h-64 overflow-y-auto border rounded-lg p-3 space-y-4">
                  {[
                    { label: 'CASE', color: 'border-blue-300', badge: 'bg-blue-100 text-blue-700' },
                    { label: 'Обращения', key: 'CLIENT_REQUESTS', color: 'border-green-300', badge: 'bg-green-100 text-green-700' },
                    { label: 'Orange CASE', key: 'ORANGE_CASE', color: 'border-orange-300', badge: 'bg-orange-100 text-orange-700' },
                    { label: 'Change Management', key: 'CHANGE_MANAGEMENT', color: 'border-purple-300', badge: 'bg-purple-100 text-purple-700' },
                  ].map((grp) => (
                    <div key={grp.key || 'CASE'}>
                      <div className="text-sm font-semibold text-gray-700 mb-2">{grp.label}</div>
                      {(assets.filter(a => a.status !== 'Completed' && (
                        (grp.key ? a.asset_type === (grp.key as any) : a.asset_type === 'CASE')
                      ))).map((asset) => (
                        <div
                          key={asset.id}
                          className={`flex items-center p-2 rounded-lg mb-2 cursor-pointer transition-colors border ${
                            selectedAssets.includes(asset.id) ? grp.color + ' bg-white' : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                          onClick={() => toggleAssetSelection(asset.id)}
                        >
                          <input
                            type="checkbox"
                            checked={selectedAssets.includes(asset.id)}
                            onChange={() => toggleAssetSelection(asset.id)}
                            className="mr-3"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm break-words">{asset.title}</div>
                            <div className="text-xs text-gray-600 break-words">{getAssetTypeDisplay(asset.asset_type)}</div>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAssetStatusColor(asset.status)} ${grp.badge}`}>
                            {asset.status === 'Active' ? 'Активен' : asset.status === 'Completed' ? 'Завершён' : 'На удержании'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  {editingHandover ? 'Сохранить изменения' : 'Сохранить запись'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setSelectedActiveShift(null);
                    setSuggestedToShift(null);
                  }}
                  className="flex-1 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Asset Detail Modal */}
      {showAssetDetail && selectedAssetDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal-overlay">
          <div className="bg-white rounded-lg p-6 w-full max-w-none resizable-modal modal-panel">
            <h2 className="text-xl font-bold mb-4">Детали актива</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
                <p className="text-gray-900">{selectedAssetDetail.title}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
                <p className="text-gray-900 whitespace-pre-wrap break-words text-wrap-force">
                  {selectedAssetDetail.description}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
                <p className="text-gray-900">{getAssetTypeDisplay(selectedAssetDetail.asset_type)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getAssetStatusColor(selectedAssetDetail.status)}`}>
                  {selectedAssetDetail.status === 'Active' ? 'Активен' : 
                   selectedAssetDetail.status === 'Completed' ? 'Завершён' : 
                   selectedAssetDetail.status === 'On Hold' ? 'На удержании' : selectedAssetDetail.status}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Создан</label>
                <p className="text-gray-600 text-sm">
                  {formatMoscow(selectedAssetDetail.created_at)}
                </p>
              </div>
            </div>
            <div className="mt-6">
              <button
                onClick={() => setShowAssetDetail(false)}
                className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Полноэкранный просмотр заметок */}
      {fullscreenNotes && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 modal-overlay">
          <div className="bg-white rounded-lg p-6 w-full max-w-none max-h-[85vh] overflow-y-auto resizable-modal modal-panel">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-bold">Заметки по передаче</h2>
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