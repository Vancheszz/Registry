import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Search, Edit, Trash2, Stethoscope, Phone, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { patientsApi } from '../api.ts';
import { CreatePatient, Patient } from '../types';

const formatDate = (value?: string | null) => {
  if (!value) {
    return 'Не указано';
  }
  try {
    return new Date(value).toLocaleDateString('ru-RU');
  } catch (error) {
    return value;
  }
};

const PatientsPage: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreatePatient>();

  const loadPatients = async () => {
    try {
      setLoading(true);
      const data = await patientsApi.getAll();
      setPatients(data);
    } catch (error) {
      console.error('Failed to load patients', error);
      toast.error('Не удалось загрузить карточки пациентов');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  const filteredPatients = useMemo(() => {
    if (!search.trim()) {
      return patients;
    }
    const lower = search.toLowerCase();
    return patients.filter(patient =>
      patient.full_name.toLowerCase().includes(lower) ||
      (patient.policy_number && patient.policy_number.toLowerCase().includes(lower)) ||
      (patient.phone && patient.phone.toLowerCase().includes(lower))
    );
  }, [patients, search]);

  const openCreateModal = () => {
    setIsEditing(false);
    setSelectedPatient(null);
    reset({
      full_name: '',
      gender: '',
      birth_date: '',
      phone: '',
      email: '',
      address: '',
      policy_number: '',
      blood_type: '',
      allergies: '',
      chronic_conditions: '',
      medications: '',
      attending_physician: '',
      last_visit: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (patient: Patient) => {
    setIsEditing(true);
    setSelectedPatient(patient);
    reset({
      full_name: patient.full_name,
      gender: patient.gender || '',
      birth_date: patient.birth_date || '',
      phone: patient.phone || '',
      email: patient.email || '',
      address: patient.address || '',
      policy_number: patient.policy_number || '',
      blood_type: patient.blood_type || '',
      allergies: patient.allergies || '',
      chronic_conditions: patient.chronic_conditions || '',
      medications: patient.medications || '',
      attending_physician: patient.attending_physician || '',
      last_visit: patient.last_visit ? patient.last_visit.substring(0, 10) : '',
      notes: patient.notes || '',
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data: CreatePatient) => {
    try {
      if (isEditing && selectedPatient) {
        await patientsApi.update(selectedPatient.id, data);
        toast.success('Карточка обновлена');
      } else {
        await patientsApi.create(data);
        toast.success('Карточка пациента создана');
      }
      setIsModalOpen(false);
      setSelectedPatient(null);
      await loadPatients();
    } catch (error) {
      console.error('Failed to save patient', error);
      toast.error('Не удалось сохранить карточку пациента');
    }
  };

  const handleDelete = async (patient: Patient) => {
    if (!window.confirm(`Удалить карточку пациента «${patient.full_name}»?`)) {
      return;
    }
    try {
      await patientsApi.delete(patient.id);
      toast.success('Карточка удалена');
      if (selectedPatient?.id === patient.id) {
        setSelectedPatient(null);
      }
      await loadPatients();
    } catch (error) {
      console.error('Failed to delete patient', error);
      toast.error('Не удалось удалить карточку');
    }
  };

  const recentPatients = useMemo(() => patients.slice(0, 6), [patients]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Медицинские карточки</h1>
          <p className="text-sm text-gray-500 mt-1">Ведите учет пациентов, контролируйте историю обращений и доступ к данным в несколько кликов</p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary flex items-center gap-2 self-start">
          <Plus className="w-4 h-4" />
          Новая карточка
        </button>
      </div>

      <div className="card">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex-1 flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-gray-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по ФИО, полису ОМС или телефону"
              className="flex-1 outline-none text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full lg:w-auto">
            <div className="bg-primary-50 border border-primary-100 rounded-lg px-4 py-3">
              <p className="text-xs text-primary-600 uppercase tracking-wide">Всего пациентов</p>
              <p className="text-2xl font-semibold text-primary-700">{patients.length}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">
              <p className="text-xs text-emerald-600 uppercase tracking-wide">С записями сегодня</p>
              <p className="text-2xl font-semibold text-emerald-700">
                {patients.filter(patient => patient.last_visit && patient.last_visit.startsWith(new Date().toISOString().slice(0, 10))).length}
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-lg px-4 py-3">
              <p className="text-xs text-slate-600 uppercase tracking-wide">Недавно добавлены</p>
              <p className="text-2xl font-semibold text-slate-700">{recentPatients.length}</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-4">
            {filteredPatients.length === 0 ? (
              <div className="card text-center py-12 text-gray-500">
                Пациенты не найдены. Попробуйте изменить параметры поиска.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredPatients.map(patient => (
                  <div
                    key={patient.id}
                    className={`card cursor-pointer transition-shadow ${selectedPatient?.id === patient.id ? 'ring-2 ring-primary-300' : ''}`}
                    onClick={() => setSelectedPatient(patient)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{patient.full_name}</h3>
                        <p className="text-sm text-gray-500">{patient.attending_physician || 'Лечащий врач не назначен'}</p>
                      </div>
                      <Stethoscope className="w-5 h-5 text-primary-500" />
                    </div>
                    <dl className="mt-4 space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-700">Полис:</span>
                        <span>{patient.policy_number || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        <span>{patient.phone || 'Телефон не указан'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        <span>{patient.email || 'Email не указан'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-700">Последний визит:</span>
                        <span>{formatDate(patient.last_visit)}</span>
                      </div>
                    </dl>
                    <div className="flex justify-end gap-2 mt-4">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditModal(patient);
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDelete(patient);
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 rounded-lg hover:bg-rose-100 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Выбранный пациент</h2>
              {selectedPatient ? (
                <div className="space-y-3 text-sm text-gray-700">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">ФИО</p>
                    <p className="font-medium text-gray-900">{selectedPatient.full_name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Дата рождения</p>
                      <p>{selectedPatient.birth_date ? formatDate(selectedPatient.birth_date) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Пол</p>
                      <p>{selectedPatient.gender || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Телефон</p>
                      <p>{selectedPatient.phone || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Email</p>
                      <p>{selectedPatient.email || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Полис ОМС</p>
                      <p>{selectedPatient.policy_number || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Группа крови</p>
                      <p>{selectedPatient.blood_type || '—'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500 uppercase">Адрес</p>
                      <p>{selectedPatient.address || '—'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Хронические заболевания</p>
                    <p>{selectedPatient.chronic_conditions || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Аллергии</p>
                    <p>{selectedPatient.allergies || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Принимаемые препараты</p>
                    <p>{selectedPatient.medications || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Лечащий врач</p>
                    <p>{selectedPatient.attending_physician || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Последний визит</p>
                    <p>{formatDate(selectedPatient.last_visit)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Заметки</p>
                    <p className="text-gray-600 whitespace-pre-line">{selectedPatient.notes || '—'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Выберите пациента, чтобы посмотреть подробности.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {isEditing ? 'Редактирование карточки' : 'Новый пациент'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">ФИО *</label>
                  <input className="form-input" {...register('full_name', { required: 'Укажите ФИО пациента' })} />
                  {errors.full_name && <p className="text-sm text-rose-600 mt-1">{errors.full_name.message}</p>}
                </div>
                <div>
                  <label className="form-label">Дата рождения</label>
                  <input type="date" className="form-input" {...register('birth_date')} />
                </div>
                <div>
                  <label className="form-label">Пол</label>
                  <select className="form-input" {...register('gender')}>
                    <option value="">Не указан</option>
                    <option value="Женский">Женский</option>
                    <option value="Мужской">Мужской</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Телефон</label>
                  <input className="form-input" {...register('phone')} placeholder="+7 (___) ___-__-__" />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <input className="form-input" {...register('email')} placeholder="patient@example.com" />
                </div>
                <div>
                  <label className="form-label">Полис ОМС</label>
                  <input className="form-input" {...register('policy_number')} />
                </div>
                <div>
                  <label className="form-label">Группа крови</label>
                  <input className="form-input" {...register('blood_type')} placeholder="A (II) Rh+" />
                </div>
                <div>
                  <label className="form-label">Дата последнего визита</label>
                  <input type="date" className="form-input" {...register('last_visit')} />
                </div>
                <div className="sm:col-span-2">
                  <label className="form-label">Адрес</label>
                  <input className="form-input" {...register('address')} />
                </div>
                <div className="sm:col-span-2">
                  <label className="form-label">Хронические заболевания</label>
                  <textarea className="form-input resize-vertical" rows={2} {...register('chronic_conditions')} />
                </div>
                <div className="sm:col-span-2">
                  <label className="form-label">Аллергии</label>
                  <textarea className="form-input resize-vertical" rows={2} {...register('allergies')} />
                </div>
                <div className="sm:col-span-2">
                  <label className="form-label">Принимаемые препараты</label>
                  <textarea className="form-input resize-vertical" rows={2} {...register('medications')} />
                </div>
                <div className="sm:col-span-2">
                  <label className="form-label">Лечащий врач</label>
                  <input className="form-input" {...register('attending_physician')} placeholder="ФИО врача" />
                </div>
                <div className="sm:col-span-2">
                  <label className="form-label">Заметки</label>
                  <textarea className="form-input resize-vertical" rows={3} {...register('notes')} placeholder="Важные наблюдения, рекомендации и план лечения" />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary">
                  {isEditing ? 'Сохранить изменения' : 'Создать карточку'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientsPage;
