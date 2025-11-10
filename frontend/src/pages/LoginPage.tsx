import React, { useState } from 'react';
import { LoginUser, CreateUser } from '../types';

interface LoginPageProps {
  onLogin: (credentials: LoginUser) => Promise<void>;
  onRegister: (userData: CreateUser) => Promise<void>;
}

export default function LoginPage({ onLogin, onRegister }: LoginPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    position: '',
    phone: '',
    telegram_id: '',
    email: '',
  });

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await onLogin({
          username: formData.username,
          password: formData.password,
        });
      } else {
        await onRegister({
          username: formData.username,
          password: formData.password,
          name: formData.name,
          position: formData.position || 'Регистратор',
          phone: formData.phone || undefined,
          telegram_id: formData.telegram_id || undefined,
          email: formData.email || undefined,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-emerald-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-10 items-center">
        <div className="lg:col-span-3 space-y-6">
          <h1 className="text-4xl font-bold text-primary-700">
            Медицинская регистратура
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Управляйте расписанием приёмов, медицинскими картами пациентов и командой клиники в одном удобном пространстве. Система создана для бережного сопровождения пациентов на каждом этапе.
          </p>
          <ul className="space-y-3 text-gray-600">
            <li className="flex items-start">
              <span className="mt-1 mr-3 h-2 w-2 rounded-full bg-primary-400"></span>
              <span>Безопасный вход для сотрудников и медперсонала</span>
            </li>
            <li className="flex items-start">
              <span className="mt-1 mr-3 h-2 w-2 rounded-full bg-primary-400"></span>
              <span>Электронные карточки пациентов с историей визитов</span>
            </li>
            <li className="flex items-start">
              <span className="mt-1 mr-3 h-2 w-2 rounded-full bg-primary-400"></span>
              <span>Наглядное расписание приёмов и журнал наблюдений</span>
            </li>
          </ul>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white shadow-2xl rounded-2xl p-8 border border-primary-100">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">
                {isLogin ? 'Вход в личный кабинет' : 'Регистрация сотрудника'}
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                {isLogin ? 'Введите свои учетные данные, чтобы продолжить работу.' : 'Создайте учётную запись, чтобы начать сопровождать пациентов.'}
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-3">
                <div>
                  <label htmlFor="username" className="form-label">Логин</label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    value={formData.username}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="napример, registrator"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="form-label">Пароль</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="Минимум 6 символов"
                  />
                </div>

                {!isLogin && (
                  <>
                    <div>
                      <label htmlFor="name" className="form-label">ФИО</label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        required
                        value={formData.name}
                        onChange={handleInputChange}
                        className="form-input"
                        placeholder="Например, Анна Иванова"
                      />
                    </div>
                    <div>
                      <label htmlFor="position" className="form-label">Роль в клинике</label>
                      <input
                        id="position"
                        name="position"
                        type="text"
                        required
                        value={formData.position}
                        onChange={handleInputChange}
                        className="form-input"
                        placeholder="Регистратор, врач, медсестра"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="phone" className="form-label">Телефон</label>
                        <input
                          id="phone"
                          name="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={handleInputChange}
                          className="form-input"
                          placeholder="+7 (___) ___-__-__"
                        />
                      </div>
                      <div>
                        <label htmlFor="email" className="form-label">Email</label>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          className="form-input"
                          placeholder="clinic@example.com"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="telegram_id" className="form-label">Telegram</label>
                      <input
                        id="telegram_id"
                        name="telegram_id"
                        type="text"
                        value={formData.telegram_id}
                        onChange={handleInputChange}
                        className="form-input"
                        placeholder="@clinic_support"
                      />
                    </div>
                  </>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary h-11 flex items-center justify-center font-semibold"
              >
                {loading ? 'Обработка...' : (isLogin ? 'Войти' : 'Создать аккаунт')}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-600">
              {isLogin ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}
              <button
                type="button"
                onClick={() => setIsLogin(prev => !prev)}
                className="ml-2 font-semibold text-primary-600 hover:text-primary-700"
              >
                {isLogin ? 'Зарегистрируйтесь' : 'Войдите'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
