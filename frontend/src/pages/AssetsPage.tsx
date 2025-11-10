import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Filter, Maximize2, X } from 'lucide-react';
import { assetsApi } from '../api.ts';
import { Asset, CreateAsset } from '../types';

export default function AssetsPage() {
  const formatMoscow = (iso: string) => {
    const normalized = iso.endsWith('Z') ? iso : `${iso}Z`;
    return new Date(normalized).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
  };
  const [assets, setAssets] = useState<Asset[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [fullscreenAsset, setFullscreenAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [formData, setFormData] = useState<CreateAsset>({
    title: '',
    description: '',
    asset_type: 'CASE',
    status: 'Active'
  });

  const loadAssets = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterType) params.append('asset_type', filterType);
      if (filterStatus) params.append('status', filterStatus);
      if (searchQuery) params.append('search', searchQuery);
      
      const data = await assetsApi.getAll(params.toString());
      setAssets(data);
    } catch (error) {
      console.error('Ошибка загрузки кейсов:', error);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus, searchQuery]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      asset_type: 'CASE',
      status: 'Active'
    });
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (asset: Asset) => {
    setEditingAsset(asset);
    setFormData({
      title: asset.title,
      description: asset.description,
      asset_type: asset.asset_type,
      status: asset.status
    });
    setShowEditModal(true);
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await assetsApi.create(formData);
      setShowCreateModal(false);
      resetForm();
      loadAssets();
    } catch (error) {
      console.error('Ошибка создания кейса:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;

    try {
      setLoading(true);
      await assetsApi.update(editingAsset.id, formData);
      setShowEditModal(false);
      setEditingAsset(null);
      resetForm();
      loadAssets();
    } catch (error) {
      console.error('Ошибка обновления кейса:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAsset = async (assetId: number) => {
    if (!window.confirm('Удалить медицинский кейс?')) return;

    try {
      setLoading(true);
      await assetsApi.delete(assetId);
      loadAssets();
    } catch (error) {
      console.error('Ошибка удаления кейса:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800';
      case 'Completed': return 'bg-blue-100 text-blue-800';
      case 'On Hold': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeDisplay = (type: string) => {
    switch (type) {
      case 'CASE': return 'Клинический случай';
      case 'CHANGE_MANAGEMENT': return 'Изменения плана лечения';
      case 'ORANGE_CASE': return 'Экстренный кейс';
      case 'CLIENT_REQUESTS': return 'Обращения пациентов';
      default: return type;
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Медицинские кейсы</h1>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
        >
          <Plus size={20} />
          Новый кейс
        </button>
      </div>

      {/* Поиск и фильтры */}
      <div className="mb-6 space-y-4">
        {/* Поиск по названию */}
        <div className="flex gap-4 items-center">
          <div className="flex-1 max-w-md relative">
            <input
              type="text"
              placeholder="Поиск по названию кейса..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 pl-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
        
        {/* Фильтры */}
        <div className="flex gap-4 items-center">
          <Filter size={20} className="text-gray-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border rounded-lg px-3 py-2"
          >
            <option value="">Все типы</option>
            <option value="CASE">Клинический случай</option>
            <option value="CHANGE_MANAGEMENT">Изменения плана лечения</option>
            <option value="ORANGE_CASE">Экстренный кейс</option>
            <option value="CLIENT_REQUESTS">Обращения пациентов</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border rounded-lg px-3 py-2"
          >
            <option value="">Все статусы</option>
            <option value="Active">В работе</option>
            <option value="Completed">Завершён</option>
            <option value="On Hold">Приостановлен</option>
          </select>
        </div>
      </div>

      {/* Список кейсов */}
      {loading ? (
        <div className="text-center py-8">Загрузка...</div>
      ) : (
        <div className="grid gap-4">
          {assets.map((asset) => (
            <div key={asset.id} className={`border rounded-lg p-4 bg-white shadow-sm overflow-hidden ${
              asset.asset_type === 'CASE' ? 'ring-2 ring-blue-300' :
              asset.asset_type === 'CLIENT_REQUESTS' ? 'ring-2 ring-green-300' :
              asset.asset_type === 'ORANGE_CASE' ? 'ring-2 ring-orange-300' :
              asset.asset_type === 'CHANGE_MANAGEMENT' ? 'ring-2 ring-purple-300' : ''
            }`}>
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold break-words flex-1 pr-2 min-w-0">{asset.title}</h3>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => setFullscreenAsset(asset)}
                    className="text-gray-600 hover:text-gray-800"
                    title="Развернуть"
                  >
                    <Maximize2 size={16} />
                  </button>
                  <button
                    onClick={() => openEditModal(asset)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteAsset(asset.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <p 
                className="text-gray-600 mb-3 text-wrap-force"
              >
                {asset.description}
              </p>
              <div className="flex gap-2 items-center">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(asset.status)}`}>
                  {asset.status === 'Active' ? 'В работе' :
                   asset.status === 'Completed' ? 'Завершён' :
                   asset.status === 'On Hold' ? 'Приостановлен' : asset.status}
                </span>
                <span className={`text-sm px-2 py-0.5 rounded-full ${
                  asset.asset_type === 'CASE' ? 'bg-blue-100 text-blue-700' :
                  asset.asset_type === 'CLIENT_REQUESTS' ? 'bg-green-100 text-green-700' :
                  asset.asset_type === 'ORANGE_CASE' ? 'bg-orange-100 text-orange-700' :
                  'bg-purple-100 text-purple-700'
                }`}>
                  {getTypeDisplay(asset.asset_type)}
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Создан: {formatMoscow(asset.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модальное окно создания */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal-overlay">
          <div className="bg-white rounded-lg p-6 w-full max-w-none resizable-modal modal-panel">
            <h2 className="text-xl font-bold mb-4">Создать медицинский кейс</h2>
            <form onSubmit={handleCreateAsset}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Название *</label>
                <input
                  type="text"
                  required
                  className="w-full border rounded-lg px-3 py-2"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Описание *</label>
                <textarea
                  required
                  rows={4}
                  className="w-full border rounded-lg px-3 py-2 textarea-wrap resize-vertical"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Тип *</label>
                <select
                  required
                  className="w-full border rounded-lg px-3 py-2"
                  value={formData.asset_type}
                  onChange={(e) => setFormData({ ...formData, asset_type: e.target.value as any })}
                >
                  <option value="CASE">Клинический случай</option>
                  <option value="CHANGE_MANAGEMENT">Изменения плана лечения</option>
                  <option value="ORANGE_CASE">Экстренный кейс</option>
                  <option value="CLIENT_REQUESTS">Обращения пациентов</option>
                </select>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Статус *</label>
                <select
                  required
                  className="w-full border rounded-lg px-3 py-2"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <option value="Active">В работе</option>
                  <option value="Completed">Завершён</option>
                  <option value="On Hold">Приостановлен</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Создать
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно редактирования */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal-overlay">
          <div className="bg-white rounded-lg p-6 w-full max-w-none resizable-modal modal-panel">
            <h2 className="text-xl font-bold mb-4">Редактировать медицинский кейс</h2>
            <form onSubmit={handleUpdateAsset}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Название *</label>
                <input
                  type="text"
                  required
                  className="w-full border rounded-lg px-3 py-2"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Описание *</label>
                <textarea
                  required
                  rows={4}
                  className="w-full border rounded-lg px-3 py-2 textarea-wrap resize-vertical"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Тип *</label>
                <select
                  required
                  className="w-full border rounded-lg px-3 py-2"
                  value={formData.asset_type}
                  onChange={(e) => setFormData({ ...formData, asset_type: e.target.value as any })}
                >
                  <option value="CASE">CASE</option>
                  <option value="CHANGE_MANAGEMENT">Change Management</option>
                  <option value="ORANGE_CASE">Orange CASE</option>
                  <option value="CLIENT_REQUESTS">Обращения клиентов</option>
                </select>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Статус *</label>
                <select
                  required
                  className="w-full border rounded-lg px-3 py-2"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <option value="Active">В работе</option>
                  <option value="Completed">Завершён</option>
                  <option value="On Hold">Приостановлен</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Полноэкранный просмотр кейса */}
      {fullscreenAsset && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 modal-overlay">
          <div className="bg-white rounded-lg p-6 w-full max-w-none max-h-[85vh] overflow-y-auto resizable-modal modal-panel">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-bold pr-4 break-words">{fullscreenAsset.title}</h2>
              <button className="text-gray-600 hover:text-gray-800" onClick={() => setFullscreenAsset(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="prose max-w-none">
              <p className="text-gray-700 text-wrap-force">{fullscreenAsset.description}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
