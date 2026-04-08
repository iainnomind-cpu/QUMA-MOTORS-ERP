import { useState, useEffect } from 'react';
import { supabase, logActivity } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useBranch } from '../contexts/BranchContext';
import { Users, Plus, X, Lock, Mail, Phone, User, Shield, CheckCircle, XCircle, Trash2, AlertCircle, Building2, ArrowRightLeft } from 'lucide-react';
import { getRoleBadgeColor, getRoleDisplayName, type Role } from '../utils/permissions';

// Interfaz para user_profiles (la tabla correcta)
interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  phone: string | null;
  active: boolean;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
}

export function UsersModule() {
  const { user } = useAuth();
  const { currentBranch, allBranches } = useBranch();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Helper to log activities with current user context
  const log = (actionType: string, entityType: string, details: Record<string, any>, entityId?: string | null) => {
    if (!user) return;
    logActivity({
      userId: user.id,
      userName: user.email?.split('@')[0] || user.id, // Fallback if full_name unavailable
      userEmail: user.email || '',
      userRole: 'admin', // assuming role isn't strictly typed here or we can fetch true role later
      branchId: currentBranch?.id || null,
      branchName: currentBranch?.name || '',
      actionType,
      entityType,
      entityId: entityId || null,
      details,
    });
  };
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [newUser, setNewUser] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'vendedor' as Role,
    phone: '',
    branch_id: ''
  });

  const [newRole, setNewRole] = useState<Role>('vendedor');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferBranchId, setTransferBranchId] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    // CAMBIO: Consultar user_profiles en lugar de system_users
    const { data, error } = await supabase
      .from('user_profiles')
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
    setCreating(true);

    try {
      // Validaciones
      if (!newUser.full_name.trim()) {
        setError('El nombre completo es requerido');
        setCreating(false);
        return;
      }

      if (!newUser.email.trim()) {
        setError('El email es requerido');
        setCreating(false);
        return;
      }

      if (!validateEmail(newUser.email)) {
        setError('Por favor ingresa un email válido');
        setCreating(false);
        return;
      }

      if (!newUser.password.trim()) {
        setError('La contraseña es requerida');
        setCreating(false);
        return;
      }

      if (!validatePassword(newUser.password)) {
        setError('La contraseña debe tener al menos 8 caracteres');
        setCreating(false);
        return;
      }

      // Verificar si el email ya existe en user_profiles
      const { data: existingUser } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('email', newUser.email.trim())
        .maybeSingle();

      if (existingUser) {
        setError('Ya existe un usuario con este email');
        setCreating(false);
        return;
      }

      console.log('📤 Enviando datos a Edge Function:', {
        email: newUser.email.trim(),
        full_name: newUser.full_name.trim(),
        role: newUser.role
      });

      // Llamar a la Edge Function
      const { data, error: functionError } = await supabase.functions.invoke('create-user', {
        body: {
          email: newUser.email.trim(),
          password: newUser.password,
          full_name: newUser.full_name.trim(),
          role: newUser.role,
          phone: newUser.phone.trim() || null,
          branch_id: newUser.branch_id || null
        }
      });

      if (functionError) {
        console.error('❌ Function error:', functionError);
        setError(`Error al crear usuario: ${functionError.message}`);
        setCreating(false);
        return;
      }

      if (data?.error) {
        console.error('❌ Edge Function returned error:', data.error);
        setError(`Error: ${data.error}`);
        setCreating(false);
        return;
      }

      // Usuario creado exitosamente
      console.log('✅ Usuario creado exitosamente:', data);
      setSuccess('Usuario creado exitosamente');
      setTimeout(() => setSuccess(''), 3000);
      log('create', 'user_profile', { email: newUser.email, name: newUser.full_name, role: newUser.role, branch: newUser.branch_id, action: 'Usuario creado' }, data?.user_id || existingUser?.id);
      setShowCreateModal(false);
      setNewUser({
        full_name: '',
        email: '',
        password: '',
        role: 'vendedor',
        phone: '',
        branch_id: ''
      });
      loadUsers();

    } catch (err: any) {
      console.error('❌ Error inesperado creando usuario:', err);
      setError(`Error inesperado: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (userId: string, currentActive: boolean) => {
    const newActive = !currentActive;

    const { error } = await supabase
      .from('user_profiles')
      .update({
        active: newActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (!error) {
      setSuccess(`Usuario ${newActive ? 'activado' : 'desactivado'} exitosamente`);
      setTimeout(() => setSuccess(''), 3000);
      log('toggle', 'user_profile', { active: newActive, action: newActive ? 'Usuario activado' : 'Usuario desactivado' }, userId);
      loadUsers();
    } else {
      setError(`Error al cambiar estado: ${error.message}`);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleChangeRole = async () => {
    if (!selectedUser) return;

    const { error } = await supabase
      .from('user_profiles')
      .update({
        role: newRole,
        updated_at: new Date().toISOString()
      })
      .eq('id', selectedUser.id);

    if (!error) {
      setSuccess('Rol actualizado exitosamente');
      setTimeout(() => setSuccess(''), 3000);
      log('update', 'user_profile', { new_role: newRole, action: 'Rol de usuario actualizado' }, selectedUser.id);
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

    // Llamar a Edge Function para eliminar de Auth y DB
    const { data, error: functionError } = await supabase.functions.invoke('delete-user', {
      body: { user_id: userId }
    });

    if (functionError || data?.error) {
      console.error('Error deleting user:', functionError || data?.error);
      setError(`Error al eliminar usuario: ${(functionError?.message || data?.error)}`);
      setTimeout(() => setError(''), 3000);
      return;
    }

    setSuccess('Usuario eliminado exitosamente');
    setTimeout(() => setSuccess(''), 3000);
    log('delete', 'user_profile', { name: userName, action: 'Usuario eliminado' }, userId);
    loadUsers();
  };

  const openRoleModal = (userProfile: UserProfile) => {
    setSelectedUser(userProfile);
    setNewRole(userProfile.role as Role);
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
              phone: '',
              branch_id: ''
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
          <table className="w-full min-w-[900px]">
            <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase whitespace-nowrap">Nombre</th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase whitespace-nowrap">Email</th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase whitespace-nowrap">Rol</th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase whitespace-nowrap">Sucursal</th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase whitespace-nowrap">Teléfono</th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase whitespace-nowrap">Estado</th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase whitespace-nowrap">Creación</th>
                <th className="px-3 py-3 text-center text-xs font-bold uppercase whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((userProfile) => (
                <tr key={userProfile.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-600 font-bold text-xs">
                          {userProfile.full_name?.charAt(0).toUpperCase() || userProfile.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-800 text-sm truncate max-w-[140px]">{userProfile.full_name || 'Sin nombre'}</div>
                        {userProfile.id === user?.id && (
                          <span className="text-xs text-blue-600 font-semibold">(Tú)</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1 text-gray-700">
                      <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-xs truncate max-w-[160px]">{userProfile.email}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded-full border ${getRoleBadgeColor(userProfile.role as Role)}`}>
                      {getRoleDisplayName(userProfile.role as Role)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-xs text-gray-700 truncate max-w-[120px]">
                        {allBranches.find(b => b.id === userProfile.branch_id)?.name || 'Sin asignar'}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-gray-700">
                      {userProfile.phone ? (
                        <>
                          <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="text-xs">{userProfile.phone}</span>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400">N/A</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => handleToggleStatus(userProfile.id, userProfile.active)}
                      disabled={userProfile.id === user?.id}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-semibold text-xs transition-all whitespace-nowrap ${userProfile.active
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-red-100 text-red-800 hover:bg-red-200'
                        } ${userProfile.id === user?.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {userProfile.active ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" />
                          Activo
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5" />
                          Inactivo
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">
                    {new Date(userProfile.created_at).toLocaleDateString('es-MX')}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => openRoleModal(userProfile)}
                        disabled={userProfile.id === user?.id}
                        className={`p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors ${userProfile.id === user?.id ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        title="Cambiar rol"
                      >
                        <Shield className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedUser(userProfile);
                          setTransferBranchId(userProfile.branch_id || '');
                          setShowTransferModal(true);
                        }}
                        disabled={userProfile.id === user?.id}
                        className={`p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors ${userProfile.id === user?.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="Transferir de sucursal"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(userProfile.id, userProfile.full_name || userProfile.email)}
                        disabled={userProfile.id === user?.id}
                        className={`p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors ${userProfile.id === user?.id ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        title="Eliminar usuario"
                      >
                        <Trash2 className="w-4 h-4" />
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

      {/* MODAL CREAR USUARIO */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => !creating && setShowCreateModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-xl flex-shrink-0">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Plus className="w-6 h-6" />
                Crear Nuevo Usuario
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
                className="text-white hover:bg-blue-800 rounded-full p-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
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
                    disabled={creating}
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
                    disabled={creating}
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
                    disabled={creating}
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
                    disabled={creating}
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
                    disabled={creating}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Sucursal *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building2 className="h-5 w-5 text-gray-400" />
                  </div>
                  <select
                    value={newUser.branch_id}
                    onChange={(e) => setNewUser({ ...newUser, branch_id: e.target.value })}
                    className="block w-full pl-10 pr-3 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    required
                    disabled={creating}
                  >
                    <option value="">Seleccionar sucursal...</option>
                    {allBranches.filter(b => b.active).map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreateUser}
                  disabled={creating}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Creando...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Crear Usuario
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CAMBIAR ROL */}
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

      {/* MODAL TRANSFERIR SUCURSAL */}
      {showTransferModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowTransferModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <ArrowRightLeft className="w-6 h-6 text-orange-600" />
                Transferir de Sucursal
              </h3>
              <button onClick={() => setShowTransferModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Usuario:</p>
                <p className="font-bold text-gray-800">{selectedUser.full_name || selectedUser.email}</p>
                <p className="text-sm text-gray-600 mt-2">Sucursal actual:</p>
                <p className="font-semibold text-blue-700">
                  {allBranches.find(b => b.id === selectedUser.branch_id)?.name || 'Sin asignar'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nueva Sucursal</label>
                <select
                  value={transferBranchId}
                  onChange={(e) => setTransferBranchId(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="">Seleccionar...</option>
                  {allBranches.filter(b => b.active).map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={async () => {
                    if (!transferBranchId) return;
                    const { error: transferError, count } = await supabase.from('user_profiles').update({
                      branch_id: transferBranchId,
                      updated_at: new Date().toISOString()
                    }).eq('id', selectedUser.id);

                    if (transferError) {
                      console.error('Error al transferir:', transferError);
                      setError(`Error al transferir: ${transferError.message}`);
                      setTimeout(() => setError(''), 5000);
                      return;
                    }

                    console.log('Transfer result - rows affected:', count);
                    setSuccess('Usuario transferido exitosamente');
                    setTimeout(() => setSuccess(''), 3000);
                    setShowTransferModal(false);
                    setSelectedUser(null);
                    loadUsers();
                  }}
                  disabled={!transferBranchId || transferBranchId === selectedUser.branch_id}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <ArrowRightLeft className="w-5 h-5" />
                  Transferir
                </button>
                <button
                  onClick={() => setShowTransferModal(false)}
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