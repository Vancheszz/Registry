import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { CalendarClock, Users, FileText, HeartPulse, LogOut, Pill, ClipboardList } from 'lucide-react';
import AppointmentsPage from './pages/AppointmentsPage.tsx';
import UsersPage from './pages/UsersPage.tsx';
import HandoversPage from './pages/HandoversPage.tsx';
import DashboardPage from './pages/DashboardPage.tsx';
import AssetsPage from './pages/AssetsPage.tsx';
import LoginPage from './pages/LoginPage.tsx';
import PatientsPage from './pages/PatientsPage.tsx';
import { authService } from './services/auth.ts';
import { LoginUser, CreateUser, User } from './types';

function Navigation({ currentUser, onLogout }: { currentUser: User | null; onLogout: () => void }) {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;
  
  const navItems = [
    { path: '/', label: 'Дашборд', icon: HeartPulse },
    { path: '/patients', label: 'Пациенты', icon: ClipboardList },
    { path: '/appointments', label: 'Приёмы', icon: CalendarClock },
    { path: '/users', label: 'Команда', icon: Users },
    { path: '/handovers', label: 'Журнал наблюдений', icon: FileText },
    { path: '/assets', label: 'Медицинские кейсы', icon: Pill },
  ];

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Медицинская регистратура</h1>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navItems.map(({ path, label, icon: Icon }) => (
                <Link
                  key={path}
                  to={path}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200 ${
                    isActive(path)
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
          
          {/* User info and logout */}
          <div className="flex items-center space-x-4">
            {currentUser && (
              <>
                <span className="text-sm text-gray-700">
                  {currentUser.name} ({currentUser.position})
                </span>
                <button
                  onClick={onLogout}
                  className="flex items-center space-x-1 text-gray-500 hover:text-gray-700"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm">Выйти</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      <div className="sm:hidden">
        <div className="pt-2 pb-3 space-y-1">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium transition-colors duration-200 ${
                isActive(path)
                  ? 'bg-primary-50 border-primary-500 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <Icon className="w-4 h-4 mr-3" />
                {label}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      if (authService.isAuthenticated()) {
        const user = await authService.getCurrentUser();
        setCurrentUser(user);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      authService.logout();
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (credentials: LoginUser) => {
    try {
      await authService.login(credentials);
      const user = await authService.getCurrentUser();
      setCurrentUser(user);
      setIsAuthenticated(true);
      toast.success('Вход выполнен успешно!');
    } catch (error) {
      toast.error('Ошибка входа. Проверьте логин и пароль.');
      throw error;
    }
  };

  const handleRegister = async (userData: CreateUser) => {
    try {
      await authService.register(userData);
      await authService.login({ username: userData.username, password: userData.password });
      const user = await authService.getCurrentUser();
      setCurrentUser(user);
      setIsAuthenticated(true);
      toast.success('Регистрация завершена! Добро пожаловать.');
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Не удалось создать аккаунт. Попробуйте другой логин.');
      throw error;
    }
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setIsAuthenticated(false);
    toast.success('Вы вышли из системы');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginPage onLogin={handleLogin} onRegister={handleRegister} />
        <Toaster position="top-right" />
      </>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-emerald-50">
        <Navigation currentUser={currentUser} onLogout={handleLogout} />
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/patients" element={<PatientsPage />} />
            <Route path="/appointments" element={<AppointmentsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/handovers" element={<HandoversPage />} />
            <Route path="/assets" element={<AssetsPage />} />
          </Routes>
        </main>
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
          }}
        />
      </div>
    </Router>
  );
}

export default App;
