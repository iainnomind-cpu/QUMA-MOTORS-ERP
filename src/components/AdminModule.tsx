import { useState, useEffect } from 'react';
import { supabase, SystemUser, ScoringRule, FinancialPromotion, SystemSetting, ActivityLog, CatalogItem } from '../lib/supabase';
import {
  Settings, Users, Award, DollarSign, Sliders, Shield, Activity, Plus, Edit2, Trash2, X, Save, Eye, EyeOff, ToggleLeft, ToggleRight, TrendingUp
} from 'lucide-react';

type ViewMode = 'overview' | 'users' | 'scoring' | 'promotions' | 'settings' | 'catalog' | 'logs';

export function AdminModule() {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [scoringRules, setScoringRules] = useState<ScoringRule[]>([]);
  const [promotions, setPromotions] = useState<FinancialPromotion[]>([]);
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);

  const [showUserModal, setShowUserModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [editingRule, setEditingRule] = useState<ScoringRule | null>(null);
  const [editingPromotion, setEditingPromotion] = useState<FinancialPromotion | null>(null);
  const [editingCatalogItem, setEditingCatalogItem] = useState<CatalogItem | null>(null);

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'agent',
    status: 'active',
    permissions: {}
  });

  const [newRule, setNewRule] = useState({
    rule_name: '',
    rule_type: 'base_score',
    criteria: {},
    score_impact: 0,
    active: true,
    priority: 0
  });

  const [newPromotion, setNewPromotion] = useState({
    name: '',
    description: '',
    promotion_type: 'msi',
    conditions: {},
    benefits: {},
    active: true,
    start_date: '',
    end_date: '',
    applicable_models: [] as string[]
  });

  const [newCatalogItem, setNewCatalogItem] = useState({
    segment: '',
    model: '',
    price_cash: 0,
    stock: 0,
    test_drive_available: false
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    await Promise.all([
      loadUsers(),
      loadScoringRules(),
      loadPromotions(),
      loadSettings(),
      loadLogs(),
      loadCatalog()
    ]);
  };

  const loadUsers = async () => {
    const { data } = await supabase.from('system_users').select('*').order('created_at', { ascending: false });
    if (data) setUsers(data);
  };

  const loadScoringRules = async () => {
    const { data } = await supabase.from('scoring_rules').select('*').order('priority', { ascending: false });
    if (data) setScoringRules(data);
  };

  const loadPromotions = async () => {
    const { data } = await supabase.from('financial_promotions').select('*').order('created_at', { ascending: false });
    if (data) setPromotions(data);
  };

  const loadSettings = async () => {
    const { data } = await supabase.from('system_settings').select('*').order('category');
    if (data) setSettings(data);
  };

  const loadLogs = async () => {
    const { data } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(50);
    if (data) setLogs(data);
  };

  const loadCatalog = async () => {
    const { data } = await supabase.from('catalog').select('*').order('price_cash');
    if (data) setCatalog(data);
  };

  const handleCreateUser = async () => {
    const { error } = await supabase.from('system_users').insert([newUser]);
    if (!error) {
      setShowUserModal(false);
      setNewUser({ name: '', email: '', role: 'agent', status: 'active', permissions: {} });
      loadUsers();
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    const { error } = await supabase.from('system_users').update(newUser).eq('id', editingUser.id);
    if (!error) {
      setShowUserModal(false);
      setEditingUser(null);
      setNewUser({ name: '', email: '', role: 'agent', status: 'active', permissions: {} });
      loadUsers();
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
    await supabase.from('system_users').delete().eq('id', id);
    loadUsers();
  };

  const handleCreateRule = async () => {
    const { error } = await supabase.from('scoring_rules').insert([newRule]);
    if (!error) {
      setShowRuleModal(false);
      setNewRule({ rule_name: '', rule_type: 'base_score', criteria: {}, score_impact: 0, active: true, priority: 0 });
      loadScoringRules();
    }
  };

  const handleUpdateRule = async () => {
    if (!editingRule) return;
    const { error } = await supabase.from('scoring_rules').update(newRule).eq('id', editingRule.id);
    if (!error) {
      setShowRuleModal(false);
      setEditingRule(null);
      setNewRule({ rule_name: '', rule_type: 'base_score', criteria: {}, score_impact: 0, active: true, priority: 0 });
      loadScoringRules();
    }
  };

  const handleToggleRule = async (rule: ScoringRule) => {
    await supabase.from('scoring_rules').update({ active: !rule.active }).eq('id', rule.id);
    loadScoringRules();
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta regla?')) return;
    await supabase.from('scoring_rules').delete().eq('id', id);
    loadScoringRules();
  };

  const handleCreatePromotion = async () => {
    const { error } = await supabase.from('financial_promotions').insert([newPromotion]);
    if (!error) {
      setShowPromotionModal(false);
      setNewPromotion({ name: '', description: '', promotion_type: 'msi', conditions: {}, benefits: {}, active: true, start_date: '', end_date: '', applicable_models: [] });
      loadPromotions();
    }
  };

  const handleUpdatePromotion = async () => {
    if (!editingPromotion) return;
    const { error } = await supabase.from('financial_promotions').update(newPromotion).eq('id', editingPromotion.id);
    if (!error) {
      setShowPromotionModal(false);
      setEditingPromotion(null);
      setNewPromotion({ name: '', description: '', promotion_type: 'msi', conditions: {}, benefits: {}, active: true, start_date: '', end_date: '', applicable_models: [] });
      loadPromotions();
    }
  };

  const handleTogglePromotion = async (promo: FinancialPromotion) => {
    await supabase.from('financial_promotions').update({ active: !promo.active }).eq('id', promo.id);
    loadPromotions();
  };

  const handleDeletePromotion = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta promoción?')) return;
    await supabase.from('financial_promotions').delete().eq('id', id);
    loadPromotions();
  };

  const handleUpdateSetting = async (setting: SystemSetting, newValue: any) => {
    await supabase.from('system_settings').update({ setting_value: { value: newValue } }).eq('id', setting.id);
    loadSettings();
  };

  const handleUpdateCatalogItem = async () => {
    if (!editingCatalogItem) return;
    const { error } = await supabase.from('catalog').update(newCatalogItem).eq('id', editingCatalogItem.id);
    if (!error) {
      setShowCatalogModal(false);
      setEditingCatalogItem(null);
      setNewCatalogItem({ segment: '', model: '', price_cash: 0, stock: 0, test_drive_available: false });
      loadCatalog();
    }
  };

  const openEditUser = (user: SystemUser) => {
    setEditingUser(user);
    setNewUser({ name: user.name, email: user.email, role: user.role, status: user.status, permissions: user.permissions });
    setShowUserModal(true);
  };

  const openEditRule = (rule: ScoringRule) => {
    setEditingRule(rule);
    setNewRule({ rule_name: rule.rule_name, rule_type: rule.rule_type, criteria: rule.criteria, score_impact: rule.score_impact, active: rule.active, priority: rule.priority });
    setShowRuleModal(true);
  };

  const openEditPromotion = (promo: FinancialPromotion) => {
    setEditingPromotion(promo);
    setNewPromotion({ name: promo.name, description: promo.description || '', promotion_type: promo.promotion_type, conditions: promo.conditions, benefits: promo.benefits, active: promo.active, start_date: promo.start_date || '', end_date: promo.end_date || '', applicable_models: promo.applicable_models });
    setShowPromotionModal(true);
  };

  const openEditCatalogItem = (item: CatalogItem) => {
    setEditingCatalogItem(item);
    setNewCatalogItem({ segment: item.segment, model: item.model, price_cash: item.price_cash, stock: item.stock, test_drive_available: item.test_drive_available });
    setShowCatalogModal(true);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 border-red-300';
      case 'manager': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'marketing': return 'bg-pink-100 text-pink-800 border-pink-300';
      case 'agent': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-300';
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'suspended': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Settings className="w-7 h-7 text-gray-700" />
          Administración y Configuración (BPM)
        </h2>
      </div>

      <div className="bg-white rounded-lg shadow-md border-2 border-gray-200">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {[
            { id: 'overview', label: 'Vista General', icon: TrendingUp },
            { id: 'users', label: 'Usuarios', icon: Users, count: users.length },
            { id: 'scoring', label: 'Lead Scoring', icon: Award, count: scoringRules.length },
            { id: 'promotions', label: 'Promociones', icon: DollarSign, count: promotions.length },
            { id: 'catalog', label: 'Catálogo PIM', icon: Sliders, count: catalog.length },
            { id: 'settings', label: 'Configuración', icon: Shield, count: settings.length },
            { id: 'logs', label: 'Logs', icon: Activity, count: logs.length }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id as ViewMode)}
                className={`flex-1 min-w-fit px-6 py-4 font-semibold transition-colors ${
                  viewMode === tab.id
                    ? 'bg-gray-50 text-gray-800 border-b-2 border-gray-800'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Icon className="w-5 h-5" />
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className="bg-gray-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                      {tab.count}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {viewMode === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
                  <Users className="w-8 h-8 opacity-80 mb-3" />
                  <div className="text-3xl font-bold mb-1">{users.length}</div>
                  <div className="text-sm opacity-90">Usuarios del Sistema</div>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
                  <Award className="w-8 h-8 opacity-80 mb-3" />
                  <div className="text-3xl font-bold mb-1">{scoringRules.filter(r => r.active).length}</div>
                  <div className="text-sm opacity-90">Reglas de Scoring Activas</div>
                </div>

                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
                  <DollarSign className="w-8 h-8 opacity-80 mb-3" />
                  <div className="text-3xl font-bold mb-1">{promotions.filter(p => p.active).length}</div>
                  <div className="text-sm opacity-90">Promociones Activas</div>
                </div>

                <div className="bg-gradient-to-br from-gray-500 to-gray-600 rounded-lg shadow-lg p-6 text-white">
                  <Sliders className="w-8 h-8 opacity-80 mb-3" />
                  <div className="text-3xl font-bold mb-1">{catalog.length}</div>
                  <div className="text-sm opacity-90">Modelos en Catálogo</div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-gray-50 rounded-lg p-6 border-2 border-blue-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Sistema de Control BPM</h3>
                <p className="text-sm text-gray-700 leading-relaxed mb-4">
                  Este módulo permite la gestión centralizada de usuarios, roles, permisos, reglas de negocio,
                  y configuración de parámetros operativos del sistema CRM QuMa Motors.
                </p>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <span>Control granular de permisos basado en roles (RBAC)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <span>Configuración dinámica de reglas de Lead Scoring sin código</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <span>Gestión de promociones financieras y campañas especiales</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <span>Administración centralizada del catálogo de productos (PIM)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <span>Auditoría completa con registro de todas las acciones del sistema</span>
                  </li>
                </ul>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-5 border-2 border-gray-200">
                  <h4 className="font-bold text-gray-800 mb-3">Distribución de Roles</h4>
                  <div className="space-y-2">
                    {['admin', 'manager', 'marketing', 'agent'].map(role => (
                      <div key={role} className="flex items-center justify-between">
                        <span className={`px-3 py-1 text-xs font-bold rounded border ${getRoleBadgeColor(role)}`}>
                          {role}
                        </span>
                        <span className="text-lg font-bold text-gray-700">
                          {users.filter(u => u.role === role).length}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-lg p-5 border-2 border-gray-200">
                  <h4 className="font-bold text-gray-800 mb-3">Estado del Sistema</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Usuarios Activos</span>
                      <span className="text-lg font-bold text-green-600">{users.filter(u => u.status === 'active').length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Reglas de Scoring</span>
                      <span className="text-lg font-bold text-blue-600">{scoringRules.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Acciones Registradas</span>
                      <span className="text-lg font-bold text-orange-600">{logs.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {viewMode === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-700">Gestión de Usuarios y Roles</h3>
                <button
                  onClick={() => {
                    setEditingUser(null);
                    setNewUser({ name: '', email: '', role: 'agent', status: 'active', permissions: {} });
                    setShowUserModal(true);
                  }}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Nuevo Usuario
                </button>
              </div>

              <div className="bg-white rounded-lg shadow-md overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Usuario</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Email</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Rol</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Estado</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Creado</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-semibold text-gray-800">{user.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600">{user.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-bold rounded border ${getRoleBadgeColor(user.role)}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-bold rounded border ${getStatusBadgeColor(user.status)}`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(user.created_at).toLocaleDateString('es-MX')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex gap-2">
                            <button
                              onClick={() => openEditUser(user)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
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
            </div>
          )}

          {viewMode === 'scoring' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-700">Configuración de Lead Scoring</h3>
                <button
                  onClick={() => {
                    setEditingRule(null);
                    setNewRule({ rule_name: '', rule_type: 'base_score', criteria: {}, score_impact: 0, active: true, priority: 0 });
                    setShowRuleModal(true);
                  }}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Nueva Regla
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {scoringRules.map((rule) => (
                  <div key={rule.id} className={`bg-white rounded-lg p-5 border-2 ${rule.active ? 'border-green-300' : 'border-gray-200'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-bold text-gray-800">{rule.rule_name}</h4>
                          <span className="px-2 py-1 text-xs font-bold rounded bg-blue-100 text-blue-800 border border-blue-300">
                            {rule.rule_type}
                          </span>
                          <span className={`px-2 py-1 text-xs font-bold rounded ${rule.score_impact >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {rule.score_impact >= 0 ? '+' : ''}{rule.score_impact} pts
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          Prioridad: {rule.priority} | Criterios: {JSON.stringify(rule.criteria)}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleToggleRule(rule)}
                          className={`p-2 rounded transition-colors ${rule.active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`}
                        >
                          {rule.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                        <button
                          onClick={() => openEditRule(rule)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'promotions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-700">Gestión de Promociones Financieras</h3>
                <button
                  onClick={() => {
                    setEditingPromotion(null);
                    setNewPromotion({ name: '', description: '', promotion_type: 'msi', conditions: {}, benefits: {}, active: true, start_date: '', end_date: '', applicable_models: [] });
                    setShowPromotionModal(true);
                  }}
                  className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Nueva Promoción
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {promotions.map((promo) => (
                  <div key={promo.id} className={`bg-white rounded-lg p-5 border-2 ${promo.active ? 'border-orange-300' : 'border-gray-200'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-800 mb-1">{promo.name}</h4>
                        <p className="text-sm text-gray-600 mb-2">{promo.description}</p>
                        <span className="px-2 py-1 text-xs font-bold rounded bg-orange-100 text-orange-800 border border-orange-300">
                          {promo.promotion_type}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleTogglePromotion(promo)}
                          className={`p-2 rounded transition-colors ${promo.active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`}
                        >
                          {promo.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                        <button
                          onClick={() => openEditPromotion(promo)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePromotion(promo.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="text-xs text-gray-500">
                        Vigencia: {promo.start_date ? new Date(promo.start_date).toLocaleDateString('es-MX') : 'N/A'} - {promo.end_date ? new Date(promo.end_date).toLocaleDateString('es-MX') : 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Modelos: {promo.applicable_models.join(', ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'catalog' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-700">Gestión de Catálogo (PIM)</h3>
              </div>

              <div className="bg-white rounded-lg shadow-md overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Segmento</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Modelo</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Precio</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Stock</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Prueba Disponible</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {catalog.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-bold rounded bg-blue-100 text-blue-800">
                            {item.segment}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-800">{item.model}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                          ${item.price_cash.toLocaleString('es-MX')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-lg font-bold ${item.stock > 3 ? 'text-green-600' : item.stock > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {item.stock}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {item.test_drive_available ? (
                            <Eye className="w-5 h-5 text-green-600" />
                          ) : (
                            <EyeOff className="w-5 h-5 text-gray-400" />
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => openEditCatalogItem(item)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {viewMode === 'settings' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700">Configuración del Sistema</h3>

              <div className="grid grid-cols-1 gap-4">
                {settings.map((setting) => (
                  <div key={setting.id} className="bg-white rounded-lg p-5 border-2 border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-bold text-gray-800">{setting.setting_key}</h4>
                          <span className="px-2 py-1 text-xs font-bold rounded bg-gray-100 text-gray-700 border border-gray-300">
                            {setting.category}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{setting.description}</p>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-gray-700">Valor Actual:</span>
                          {typeof setting.setting_value.value === 'boolean' ? (
                            <button
                              onClick={() => handleUpdateSetting(setting, !setting.setting_value.value)}
                              className={`flex items-center gap-2 px-3 py-1 rounded font-semibold text-sm ${
                                setting.setting_value.value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {setting.setting_value.value ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                              {setting.setting_value.value ? 'Activo' : 'Inactivo'}
                            </button>
                          ) : (
                            <span className="px-3 py-1 bg-blue-50 text-blue-800 rounded font-mono text-sm">
                              {JSON.stringify(setting.setting_value.value)}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          Editable por: {setting.editable_by_role.join(', ')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'logs' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700">Registro de Actividad del Sistema</h3>

              <div className="bg-white rounded-lg shadow-md overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Fecha</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Acción</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Entidad</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Cambios</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(log.created_at).toLocaleString('es-MX')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-bold rounded bg-blue-100 text-blue-800">
                            {log.action_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800">
                          {log.entity_type}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                          {JSON.stringify(log.changes)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {log.ip_address || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowUserModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
              <button onClick={() => setShowUserModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre Completo</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="Juan Pérez"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="usuario@qumamotors.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Rol</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="agent">Agent (Vendedor)</option>
                    <option value="manager">Manager (Gerente)</option>
                    <option value="marketing">Marketing</option>
                    <option value="admin">Admin (Administrador)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Estado</label>
                  <select
                    value={newUser.status}
                    onChange={(e) => setNewUser({ ...newUser, status: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                    <option value="suspended">Suspendido</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={editingUser ? handleUpdateUser : handleCreateUser}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                >
                  <Save className="w-5 h-5" />
                  {editingUser ? 'Actualizar' : 'Crear'} Usuario
                </button>
                <button
                  onClick={() => setShowUserModal(false)}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRuleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowRuleModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">{editingRule ? 'Editar Regla' : 'Nueva Regla de Scoring'}</h3>
              <button onClick={() => setShowRuleModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre de la Regla</label>
                <input
                  type="text"
                  value={newRule.rule_name}
                  onChange={(e) => setNewRule({ ...newRule, rule_name: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="Modelo Premium Bonus"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de Regla</label>
                  <select
                    value={newRule.rule_type}
                    onChange={(e) => setNewRule({ ...newRule, rule_type: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="base_score">Base Score</option>
                    <option value="model_bonus">Model Bonus</option>
                    <option value="timeframe_bonus">Timeframe Bonus</option>
                    <option value="financing_bonus">Financing Bonus</option>
                    <option value="status_threshold">Status Threshold</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Impacto en Score</label>
                  <input
                    type="number"
                    value={newRule.score_impact}
                    onChange={(e) => setNewRule({ ...newRule, score_impact: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="15"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Prioridad</label>
                  <input
                    type="number"
                    value={newRule.priority}
                    onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="5"
                  />
                </div>
                <div className="flex items-center gap-2 mt-7">
                  <input
                    type="checkbox"
                    checked={newRule.active}
                    onChange={(e) => setNewRule({ ...newRule, active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label className="text-sm font-medium text-gray-700">Regla activa</label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Criterios (JSON)</label>
                <textarea
                  value={JSON.stringify(newRule.criteria)}
                  onChange={(e) => {
                    try {
                      setNewRule({ ...newRule, criteria: JSON.parse(e.target.value) });
                    } catch (err) {
                      // Ignore parse errors during typing
                    }
                  }}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-mono text-sm h-24"
                  placeholder='{"timeframe": "Inmediato"}'
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={editingRule ? handleUpdateRule : handleCreateRule}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                >
                  <Save className="w-5 h-5" />
                  {editingRule ? 'Actualizar' : 'Crear'} Regla
                </button>
                <button
                  onClick={() => setShowRuleModal(false)}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPromotionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowPromotionModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">{editingPromotion ? 'Editar Promoción' : 'Nueva Promoción'}</h3>
              <button onClick={() => setShowPromotionModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre de la Promoción</label>
                <input
                  type="text"
                  value={newPromotion.name}
                  onChange={(e) => setNewPromotion({ ...newPromotion, name: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="Yamaha Especial 12 MSI"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Descripción</label>
                <textarea
                  value={newPromotion.description}
                  onChange={(e) => setNewPromotion({ ...newPromotion, description: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none h-20"
                  placeholder="Promoción exclusiva..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo</label>
                  <select
                    value={newPromotion.promotion_type}
                    onChange={(e) => setNewPromotion({ ...newPromotion, promotion_type: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="msi">Meses Sin Intereses</option>
                    <option value="special_rate">Tasa Especial</option>
                    <option value="cashback">Cashback</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 mt-7">
                  <input
                    type="checkbox"
                    checked={newPromotion.active}
                    onChange={(e) => setNewPromotion({ ...newPromotion, active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label className="text-sm font-medium text-gray-700">Promoción activa</label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha Inicio</label>
                  <input
                    type="date"
                    value={newPromotion.start_date}
                    onChange={(e) => setNewPromotion({ ...newPromotion, start_date: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha Fin</label>
                  <input
                    type="date"
                    value={newPromotion.end_date}
                    onChange={(e) => setNewPromotion({ ...newPromotion, end_date: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Modelos Aplicables (separados por coma)</label>
                <input
                  type="text"
                  value={newPromotion.applicable_models.join(', ')}
                  onChange={(e) => setNewPromotion({ ...newPromotion, applicable_models: e.target.value.split(',').map(m => m.trim()) })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="MT-07, YZF-R3, NMAX"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={editingPromotion ? handleUpdatePromotion : handleCreatePromotion}
                  className="flex-1 flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                >
                  <Save className="w-5 h-5" />
                  {editingPromotion ? 'Actualizar' : 'Crear'} Promoción
                </button>
                <button
                  onClick={() => setShowPromotionModal(false)}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCatalogModal && editingCatalogItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowCatalogModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">Editar Catálogo - {editingCatalogItem.model}</h3>
              <button onClick={() => setShowCatalogModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Precio (MXN)</label>
                  <input
                    type="number"
                    value={newCatalogItem.price_cash}
                    onChange={(e) => setNewCatalogItem({ ...newCatalogItem, price_cash: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Stock Actual</label>
                  <input
                    type="number"
                    value={newCatalogItem.stock}
                    onChange={(e) => setNewCatalogItem({ ...newCatalogItem, stock: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newCatalogItem.test_drive_available}
                  onChange={(e) => setNewCatalogItem({ ...newCatalogItem, test_drive_available: e.target.checked })}
                  className="w-4 h-4"
                />
                <label className="text-sm font-medium text-gray-700">Disponible para prueba de manejo</label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleUpdateCatalogItem}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                >
                  <Save className="w-5 h-5" />
                  Actualizar Catálogo
                </button>
                <button
                  onClick={() => setShowCatalogModal(false)}
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
