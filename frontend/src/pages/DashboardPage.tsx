import React, { useEffect, useState } from 'react';
import { Users, CalendarClock, ClipboardList, Pill, Stethoscope, Loader2 } from 'lucide-react';
import { dashboardApi } from '../api.ts';
import { DashboardSummary } from '../types';

const formatDate = (date: string, time?: string) => {
  try {
    const iso = time ? `${date}T${time}` : date;
    const parsed = new Date(iso);
    return parsed.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: time ? '2-digit' : undefined,
      minute: time ? '2-digit' : undefined,
    });
  } catch (error) {
    return date;
  }
};

const DashboardPage: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await dashboardApi.getSummary();
        setSummary(data);
      } catch (error) {
        console.error('Failed to load dashboard data', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading || !summary) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Центр управления клиникой</h1>
          <p className="text-sm text-gray-500 mt-2">Актуальная информация по пациентам, приёмам и медицинским случаям</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card bg-primary-50 border border-primary-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-100 rounded-lg">
              <ClipboardList className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-primary-600">Всего пациентов</p>
              <p className="text-2xl font-semibold text-primary-700">{summary.total_patients}</p>
            </div>
          </div>
        </div>
        <div className="card bg-emerald-50 border border-emerald-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <CalendarClock className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-emerald-600">Ближайшие приёмы</p>
              <p className="text-2xl font-semibold text-emerald-700">{summary.upcoming_appointments}</p>
            </div>
          </div>
        </div>
        <div className="card bg-sky-50 border border-sky-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-sky-100 rounded-lg">
              <Users className="w-6 h-6 text-sky-600" />
            </div>
            <div>
              <p className="text-sm text-sky-600">Сотрудники</p>
              <p className="text-2xl font-semibold text-sky-700">{summary.total_staff}</p>
            </div>
          </div>
        </div>
        <div className="card bg-amber-50 border border-amber-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-lg">
              <Pill className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-amber-600">Активные кейсы</p>
              <p className="text-2xl font-semibold text-amber-700">{summary.active_cases}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-primary-500" />
              Ближайшие приёмы
            </h2>
          </div>
          {summary.next_appointments.length === 0 ? (
            <p className="text-sm text-gray-500">Запланированных приёмов нет.</p>
          ) : (
            <ul className="space-y-3">
              {summary.next_appointments.map(appointment => (
                <li key={appointment.id} className="border border-gray-200 rounded-lg px-4 py-3 hover:border-primary-200 transition">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-gray-900">{appointment.patient_name || 'Пациент не назначен'}</p>
                      <p className="text-xs text-gray-500">{appointment.user_name}</p>
                      <p className="text-xs text-gray-600">{appointment.notes || 'Без примечаний'}</p>
                    </div>
                    <div className="text-right text-sm text-primary-700 font-semibold">
                      {formatDate(appointment.date, appointment.start_time)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-emerald-500" />
              Новые пациенты
            </h2>
          </div>
          {summary.recent_patients.length === 0 ? (
            <p className="text-sm text-gray-500">Пока нет добавленных пациентов.</p>
          ) : (
            <ul className="space-y-3">
              {summary.recent_patients.map(patient => (
                <li key={patient.id} className="border border-gray-200 rounded-lg px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{patient.full_name}</p>
                      <p className="text-xs text-gray-500">{patient.attending_physician || 'Лечащий врач не указан'}</p>
                      <p className="text-xs text-gray-500">Телефон: {patient.phone || '—'}</p>
                    </div>
                    <div className="text-right text-xs text-gray-400">
                      Добавлен: {formatDate(patient.created_at)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
