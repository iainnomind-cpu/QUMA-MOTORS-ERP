import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { BranchProvider, useBranch } from './contexts/BranchContext';
import { NotificationProvider, useNotificationContext } from './context/NotificationContext';
import { Login } from './components/Login';
import { ProtectedRoute } from './components/ProtectedRoute';
import { NotificationCenter } from './components/NotificationCenter';
import { Dashboard } from './components/Dashboard';
import { LeadsModule } from './components/LeadsModule';
import { PipelineKanban } from './components/PipelineKanban';
import { CatalogModule } from './components/CatalogModule';
import { FinanceSimulator } from './components/FinanceSimulator';
import { MarketingAutomation } from './components/MarketingAutomation';
import { AdminModule } from './components/AdminModule';
import { SchedulingModule } from './components/SchedulingModule';
import { UsersModule } from './components/UsersModule';
import {
  Bike,
  LayoutDashboard,
  Users,
  Trello,
  Package,
  Calculator,
  Mail,
  Settings,
  ChevronLeft,
  ChevronRight,
  Calendar,
  LogOut,
  User,
  Shield,
  ChevronDown
} from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { canAccessModule, getRoleBadgeColor, getRoleDisplayName, canSwitchBranch } from './utils/permissions';
import { Building2 } from 'lucide-react';

type Module = 'dashboard' | 'leads' | 'pipeline' | 'catalog' | 'finance' | 'marketing' | 'scheduling' | 'admin' | 'users';

function AppContent() {
  const [activeModule, setActiveModule] = useState<Module>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const { notifications, markAsRead, markAllAsRead, dismissNotification } = useNotificationContext();
  const { user, signOut } = useAuth();
  const { currentBranch, allBranches, selectedBranchId, switchBranch, isAllBranchesView } = useBranch();
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (confirm('¿Estás seguro de cerrar sesión?')) {
      try {
        await signOut();
        navigate('/login');
      } catch (error) {
        console.error('Error al cerrar sesión:', error);
      }
    }
  };

  const allModules = [
    { id: 'dashboard' as Module, name: 'Dashboard', icon: LayoutDashboard, color: 'text-blue-600', bgColor: 'bg-blue-50', allowedFor: 'dashboard' },
    { id: 'leads' as Module, name: 'Leads', icon: Users, color: 'text-green-600', bgColor: 'bg-green-50', allowedFor: 'leads' },
    { id: 'pipeline' as Module, name: 'Pipeline', icon: Trello, color: 'text-gray-600', bgColor: 'bg-gray-50', allowedFor: 'pipeline' },
    { id: 'catalog' as Module, name: 'Catálogo', icon: Package, color: 'text-orange-600', bgColor: 'bg-orange-50', allowedFor: 'catalog' },
    { id: 'finance' as Module, name: 'Finanzas', icon: Calculator, color: 'text-emerald-600', bgColor: 'bg-emerald-50', allowedFor: 'finance' },
    { id: 'scheduling' as Module, name: 'Agendamiento', icon: Calendar, color: 'text-blue-600', bgColor: 'bg-blue-50', allowedFor: 'scheduling' },
    { id: 'marketing' as Module, name: 'Marketing', icon: Mail, color: 'text-pink-600', bgColor: 'bg-pink-50', allowedFor: 'marketing' },
    { id: 'users' as Module, name: 'Usuarios', icon: Shield, color: 'text-blue-700', bgColor: 'bg-blue-50', allowedFor: 'users' },
    { id: 'admin' as Module, name: 'Admin', icon: Settings, color: 'text-red-600', bgColor: 'bg-red-50', allowedFor: 'admin' }
  ];

  const modules = allModules.filter(module =>
    canAccessModule(user?.role as any, module.allowedFor)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex">
      <aside
        className={`${sidebarCollapsed ? 'w-20' : 'w-72'
          } bg-white shadow-xl border-r-2 border-gray-200 transition-all duration-300 flex flex-col fixed h-screen z-40`}
      >
        <div className="p-6 border-b-2 border-gray-200 bg-gradient-to-br from-red-600 to-red-700">
          <div className="flex items-center justify-between">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-3">
                <div className="bg-white rounded-lg p-2">
                  <Bike className="w-6 h-6 text-red-600" />
                </div>
                <div className="text-white">
                  <h1 className="text-lg font-bold">QuMa Motors</h1>
                  <p className="text-xs opacity-90">Sistema CRM</p>
                </div>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="mx-auto bg-white rounded-lg p-2">
                <Bike className="w-6 h-6 text-red-600" />
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-2">
            {modules.map((module) => {
              const Icon = module.icon;
              const isActive = activeModule === module.id;
              return (
                <button
                  key={module.id}
                  onClick={() => setActiveModule(module.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${isActive
                    ? `${module.bgColor} ${module.color} shadow-md`
                    : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  title={sidebarCollapsed ? module.name : ''}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? module.color : ''}`} />
                  {!sidebarCollapsed && <span>{module.name}</span>}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all text-gray-700 font-medium"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <>
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm">Contraer</span>
              </>
            )}
          </button>
        </div>

      </aside>

      <main
        className={`flex-1 ${sidebarCollapsed ? 'ml-20' : 'ml-72'
          } transition-all duration-300`}
      >
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
          <div className="px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  {modules.find(m => m.id === activeModule)?.name}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  QuMa Motors CRM - Automatización Integral
                </p>
              </div>
              <div className="flex items-center gap-4">
                <NotificationCenter
                  notifications={notifications}
                  onMarkAsRead={markAsRead}
                  onMarkAllAsRead={markAllAsRead}
                  onDismiss={dismissNotification}
                />
                {/* Branch Selector */}
                <div className="border-l border-gray-300 pl-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-gray-500" />
                  {canSwitchBranch(user?.role as any) ? (
                    <select
                      value={selectedBranchId || 'all'}
                      onChange={(e) => switchBranch(e.target.value === 'all' ? null : e.target.value)}
                      className="text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">🏢 Todas las Sucursales</option>
                      {allBranches.map(b => (
                        <option key={b.id} value={b.id}>📍 {b.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                      📍 {currentBranch?.name || 'Sin sucursal'}
                    </span>
                  )}
                </div>
                <div className="border-l border-gray-300 pl-4 relative">
                  <button
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="flex items-center gap-3 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-md">
                      <span className="text-white font-bold text-sm">
                        {user?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-semibold text-gray-800">{user?.full_name || user?.email}</div>
                      <div className="flex items-center gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${getRoleBadgeColor(user?.role as any)}`}>
                          {getRoleDisplayName(user?.role as any)}
                        </span>
                      </div>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>

                  {showUserDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowUserDropdown(false)}
                      />
                      <div className="absolute right-0 top-14 w-64 bg-white rounded-xl shadow-2xl border-2 border-gray-200 z-50 overflow-hidden">
                        <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-2">
                            <span className="text-blue-600 font-bold text-lg">
                              {user?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="text-center">
                            <div className="font-bold">{user?.full_name || user?.email}</div>
                            <div className="text-xs opacity-90 mt-1">{user?.email}</div>
                          </div>
                        </div>
                        <div className="p-2">
                          {user?.role === 'admin' && (
                            <>
                              <button
                                onClick={() => {
                                  setActiveModule('users');
                                  setShowUserDropdown(false);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-blue-50 rounded-lg transition-colors"
                              >
                                <Shield className="w-5 h-5 text-blue-600" />
                                <span className="font-medium">Gestión de Usuarios</span>
                              </button>
                              <div className="border-t border-gray-200 my-2"></div>
                            </>
                          )}
                          <button
                            onClick={() => {
                              setShowUserDropdown(false);
                              handleLogout();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
                          >
                            <LogOut className="w-5 h-5" />
                            Cerrar Sesión
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="p-8">
          {activeModule === 'dashboard' && <Dashboard />}
          {activeModule === 'leads' && <LeadsModule />}
          {activeModule === 'pipeline' && <PipelineKanban />}
          {activeModule === 'catalog' && <CatalogModule />}
          {activeModule === 'finance' && <FinanceSimulator />}
          {activeModule === 'scheduling' && <SchedulingModule />}
          {activeModule === 'marketing' && <MarketingAutomation />}
          {activeModule === 'users' && <UsersModule />}
          {activeModule === 'admin' && <AdminModule key="admin-module-v2" />}
        </div>

        <footer className="bg-white border-t border-gray-200 mt-12">
          <div className="px-8 py-6">
            <div className="text-center text-sm text-gray-600">
              <p className="font-semibold">QuMa Motors - Sistema CRM</p>
              <p className="text-xs mt-1">
                Automatización completa: Calificación 24/7, Centralización, Financiamiento Estratégico, Nutrición Post-Venta
              </p>
            </div>
          </div>
        </footer>
      </main>

    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BranchProvider>
          <NotificationProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <AppContent />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </NotificationProvider>
        </BranchProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
