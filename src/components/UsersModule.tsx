import { useState, useEffect } from 'react';
import { supabase, SystemUser } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Users, Plus, X, Lock, Mail, Phone, User, Shield, CheckCircle, XCircle, Edit2, Trash2, AlertCircle } from 'lucide-react';
import { getRoleBadgeColor, getRoleDisplayName, type Role } from '../utils/permissions';

export function UsersModule() {
  const { user } = useAuth();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [newUser, setNewUser] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'vendedor' as Role,
    phone: ''
  });

  const [newRole, setNewRole] = useState<Role>('vendedor');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('system_users')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setUsers(data);
    }
    setLoading(false);
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string): boolean => {
    return password.length >= 8;
  };

  const handleCreateUser = async () => {
    setError('');

    if (!newUser.full_name.trim()) {
      setError('El nombre completo es requerido');
      return;
    }

    if (!newUser.email.trim()) {
      setError('El email es requerido');
      return;
    }

    if (!validateEmail(newUser.email)) {
      setError('Por favor ingresa un email válido');
      return;
    }

    if (!newUser.password.trim()) {
      setError('La contraseña es requerida');
      return;
    }

    if (!validatePassword(newUser.password)) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    const { data: existingUser } = await supabase
      .from('system_users')
      .select('email')
      .eq('email', newUser.email.trim())
      .maybeSingle();

    if (existingUser) {
      setError('Ya existe un usuario con este email');
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: newUser.email.trim(),
      password: newUser.password,
      options: {
        data: {
          full_name: newUser.full_name.trim(),
          role: newUser.role
        }
      }
    });

    if (authError) {
      setError(`Error al crear usuario: ${authError.message}`);
      return;
    }

    if (authData.user) {
      const { error: profileError } = await supabase
        .from('system_users')
        .insert([{
          id: authData.user.id,
          email: newUser.email.trim(),
          full_name: newUser.full_name.trim(),
          role: newUser.role,
          phone: newUser.phone.trim() || null,
          status: 'active',
          permissions: {},
          created_by: user?.id || null
        }]);

      if (profileError) {
        setError(`Error al crear perfil: ${profileError.message}`);
        return;
      }

      setSuccess('Usuario creado exitosamente');
      setTimeout(() => setSuccess(''), 3000);
      setShowCreateModal(false);
      setNewUser({
        full_name: '',
        email: '',
        password: '',
        role: 'vendedor',
        phone: ''
      });
      loadUsers();
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

    const { error } = await supabase
      .from('system_users')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (!error) {
      setSuccess(`Usuario ${newStatus === 'active' ? 'activado' : 'desactivado'} exitosamente`);
      setTimeout(() => setSuccess(''), 3000);
      loadUsers();
    } else {
      setError(`Error al cambiar estado: ${error.message}`);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleChangeRole = async () => {
    if (!selectedUser) return;

    const { error } = await supabase
      .from('system_users')
      .update({
        role: newRole,
        updated_at: new Date().toISOString()
      })
      .eq('id', selectedUser.id);

    if (!error) {
      setSuccess('Rol actualizado exitosamente');
      setTimeout(() => setSuccess(''), 3000);
      setShowRoleModal(false);
      setSelectedUser(null);
      loadUsers();
    } else {
      setError(`Error al cambiar rol: ${error.message}`);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (userId === user?.id) {
      setError('No puedes eliminar tu propia cuenta');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (!confirm(`¿Estás seguro de eliminar al usuario ${userName}? Esta acción no se puede deshacer.`)) {
      return;
    }

    const { error } = await supabase
      .from('system_users')
      .delete()
      .eq('id', userId);

    if (!error) {
      setSuccess('Usuario eliminado exitosamente');
      setTimeout(() => setSuccess(''), 3000);
      loadUsers();
    } else {
      setError(`Error al eliminar usuario: ${error.message}`);
      setTimeout(() => setError(''), 3000);
    }
  };

  const openRoleModal = (user: SystemUser) => {
    setSelectedUser(user);
    setNewRole(user.role as Role);
    setShowRoleModal(true);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Cargando usuarios...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="w-8 h-8 text-blue-600" />
            Gestión de Usuarios
          </h2>
          <p className="text-gray-600 mt-1">Administrar usuarios y permisos del sistema</p>
        </div>
        <button
          onClick={() => {
            setError('');
            setNewUser({
              full_name: '',
              email: '',
              password: '',
              role: 'vendedor',
              phone: ''
            });
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg"
        >
          <Plus className="w-5 h-5" />
          Crear Usuario
        </button>
      </div>

      {success && (
        <div className="bg-green-100 border-2 border-green-400 text-green-800 px-4 py-3 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5" />
          <span className="font-semibold">{success}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border-2 border-red-400 text-red-800 px-4 py-3 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md border-2 border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold uppercase">Nombre</th>
                <th className="px-6 py-4 text-left text-sm font-bold uppercase">Email</th>
                <th className="px-6 py-4 text-left text-sm font-bold uppercase">Rol</th>
                <th className="px-6 py-4 text-left text-sm font-bold uppercase">Teléfono</th>
                <th className="px-6 py-4 text-left text-sm font-bold uppercase">Estado</th>
                <th className="px-6 py-4 text-left text-sm font-bold uppercase">Fecha Creación</th>
                <th className="px-6 py-4 text-center text-sm font-bold uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((systemUser) => (
                <tr key={systemUser.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-bold text-sm">
                          {systemUser.full_name?.charAt(0).toUpperCase() || systemUser.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800">{systemUser.full_name || 'Sin nombre'}</div>
                        {systemUser.id === user?.id && (
                          <span className="text-xs text-blue-600 font-semibold">(Tú)</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{systemUser.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full border-2 ${getRoleBadgeColor(systemUser.role as Role)}`}>
                      {getRoleDisplayName(systemUser.role as Role)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-700">
                      {systemUser.phone ? (
                        <>
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">{systemUser.phone}</span>
                        </>
                      ) : (
                        <span className="text-sm text-gray-400">N/A</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleStatus(systemUser.id, systemUser.status)}
                      disabled={systemUser.id === user?.id}
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg font-semibold text-sm transition-all ${
                        systemUser.status === 'active'
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      } ${systemUser.id === user?.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {systemUser.status === 'active' ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Activo
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4" />
                          Inactivo
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(systemUser.created_at).toLocaleDateString('es-MX')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openRoleModal(systemUser)}
                        disabled={systemUser.id === user?.id}
                        className={`p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors ${
                          systemUser.id === user?.id ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        title="Cambiar rol"
                      >
                        <Shield className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(systemUser.id, systemUser.full_name || systemUser.email)}
                        disabled={systemUser.id === user?.id}
                        className={`p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors ${
                          systemUser.id === user?.id ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        title="Eliminar usuario"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">No hay usuarios registrados</p>
            <p className="text-sm mt-1">Crea el primer usuario del sistema</p>
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200">
        <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          Roles y Permisos del Sistema
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-3 py-1 text-xs font-bold rounded-full border-2 ${getRoleBadgeColor('admin')}`}>
                Administrador
              </span>
            </div>
            <p className="text-xs text-gray-700 leading-relaxed">
              Acceso total al sistema. Puede gestionar usuarios, configuración y todos los módulos.
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-3 py-1 text-xs font-bold rounded-full border-2 ${getRoleBadgeColor('gerente')}`}>
                Gerente
              </span>
            </div>
            <p className="text-xs text-gray-700 leading-relaxed">
              Acceso completo a leads, clientes, reportes e inventario. Sin gestión de usuarios.
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-3 py-1 text-xs font-bold rounded-full border-2 ${getRoleBadgeColor('vendedor')}`}>
                Vendedor
              </span>
            </div>
            <p className="text-xs text-gray-700 leading-relaxed">
              Acceso a leads asignados, catálogo, pruebas de manejo y financiamiento.
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-3 py-1 text-xs font-bold rounded-full border-2 ${getRoleBadgeColor('servicio')}`}>
                Servicio Técnico
              </span>
            </div>
            <p className="text-xs text-gray-700 leading-relaxed">
              Acceso a servicios, historial de mantenimiento, refacciones y agendamiento.
            </p>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-xl">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Plus className="w-6 h-6" />
                Crear Nuevo Usuario
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-white hover:bg-blue-800 rounded-full p-1 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="bg-red-100 border-2 border-red-400 text-red-800 px-4 py-3 rounded-lg flex items-center gap-3">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-semibold">{error}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nombre Completo *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={newUser.full_name}
                    onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                    className="block w-full pl-10 pr-3 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="Juan Pérez"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="block w-full pl-10 pr-3 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="juan@qumamotors.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Contraseña Temporal *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="block w-full pl-10 pr-3 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="Mínimo 8 caracteres"
                    required
                    minLength={8}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Debe tener al menos 8 caracteres</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Rol *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Shield className="h-5 w-5 text-gray-400" />
                  </div>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}
                    className="block w-full pl-10 pr-3 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    required
                  >
                    <option value="vendedor">Vendedor</option>
                    <option value="servicio">Servicio Técnico</option>
                    <option value="gerente">Gerente</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Teléfono (Opcional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    value={newUser.phone}
                    onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                    className="block w-full pl-10 pr-3 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="5512345678"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreateUser}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Crear Usuario
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowRoleModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Shield className="w-6 h-6 text-blue-600" />
                Cambiar Rol
              </h3>
              <button onClick={() => setShowRoleModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-600 mb-2">Usuario:</p>
                <p className="font-bold text-gray-800">{selectedUser.full_name || selectedUser.email}</p>
                <p className="text-sm text-gray-600 mt-2">Rol actual:</p>
                <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full border-2 mt-1 ${getRoleBadgeColor(selectedUser.role as Role)}`}>
                  {getRoleDisplayName(selectedUser.role as Role)}
                </span>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nuevo Rol
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as Role)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="vendedor">Vendedor</option>
                  <option value="servicio">Servicio Técnico</option>
                  <option value="gerente">Gerente</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleChangeRole}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                >
                  Actualizar Rol
                </button>
                <button
                  onClick={() => setShowRoleModal(false)}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
