import { useState, useEffect } from 'react';
import { supabase, SystemUser, ScoringRule, FinancialPromotion, SystemSetting, ActivityLog, CatalogItem, Branch, logActivity } from '../lib/supabase';
import { useBranch } from '../contexts/BranchContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Settings, Users, Award, DollarSign, Sliders, Shield, Activity, Plus, Edit2, Trash2, X, Save, Eye, EyeOff, ToggleLeft, ToggleRight, TrendingUp,
  MessageSquare, Bell, Send, RefreshCw, Phone, CheckCircle, Clock, AlertTriangle, XCircle, Search, Filter, Calendar, Image, Building2, MapPin, Package, Mail, Download, Loader2, Wifi
} from 'lucide-react';

type ViewMode = 'overview' | 'users' | 'scoring' | 'promotions' | 'settings' | 'catalog' | 'logs' | 'notifications' | 'branches' | 'email-leads';

interface WhatsAppNotification {
  id: string;
  event_key: string;
  event_label: string;
  description: string | null;
  template_name: string;
  message_template: string;
  variables: string[];
  recipient_type: string;
  recipient_phone: string | null;
  category: string;
  status: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export function AdminModule() {
  const { refreshBranches: refreshGlobalBranches, currentBranch } = useBranch();
  const { user: authUser } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [scoringRules, setScoringRules] = useState<ScoringRule[]>([]);
  const [promotions, setPromotions] = useState<FinancialPromotion[]>([]);
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [notifications, setNotifications] = useState<WhatsAppNotification[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [managerProfiles, setManagerProfiles] = useState<{ id: string, full_name: string, role: string }[]>([]);

  const [showUserModal, setShowUserModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [editingRule, setEditingRule] = useState<ScoringRule | null>(null);
  const [editingPromotion, setEditingPromotion] = useState<FinancialPromotion | null>(null);
  const [editingCatalogItem, setEditingCatalogItem] = useState<CatalogItem | null>(null);
  const [editingNotification, setEditingNotification] = useState<WhatsAppNotification | null>(null);
  const [isSyncingNotifications, setIsSyncingNotifications] = useState(false);
  const [submittingNotification, setSubmittingNotification] = useState(false);
  const [notifSuccessMsg, setNotifSuccessMsg] = useState('');
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  const [newBranch, setNewBranch] = useState({
    name: '', code: '', address: '', city: '', state: '', phone: '', manager_name: ''
  });
  const [geocodingStatus, setGeocodingStatus] = useState<string>('');

  // ===== Email Leads State =====
  const [emailConfig, setEmailConfig] = useState({
    gmail_email: '',
    gmail_app_password: '',
    sender_filter: 'cliente_potencial@yamaha-motor.com.mx',
    auto_sync_enabled: false,
    sync_interval_minutes: 30,
    enabled: false,
    last_sync_at: null as string | null,
    last_sync_result: null as string | null
  });
  const [emailConfigLoaded, setEmailConfigLoaded] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<{ success: boolean; message: string; unreadCount?: number } | null>(null);
  const [emailTesting, setEmailTesting] = useState(false);
  const [emailSyncing, setEmailSyncing] = useState(false);
  const [emailSyncResult, setEmailSyncResult] = useState<any>(null);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailImportHistory, setEmailImportHistory] = useState<any[]>([]);
  const [showAppPasswordHelp, setShowAppPasswordHelp] = useState(false);

  const [userSearch, setUserSearch] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogSegmentFilter, setCatalogSegmentFilter] = useState('');

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

  const NOTIFICATION_EVENTS = [
    { key: 'new_lead', label: 'Nuevo Lead Asignado', icon: '🔔', vars: ['nombre', 'telefono', 'modelo'] },
    { key: 'test_drive_scheduled', label: 'Prueba de Manejo Programada', icon: '🏍️', vars: ['nombre', 'modelo', 'fecha', 'hora'] },
    { key: 'parts_request', label: 'Solicitud de Refacción', icon: '🔧', vars: ['nombre', 'refaccion', 'modelo', 'ubicacion'] },
    { key: 'service_completed', label: 'Servicio Completado', icon: '✅', vars: ['nombre', 'tipo_servicio', 'modelo'] },
    { key: 'financing_approved', label: 'Financiamiento Aprobado', icon: '🎉', vars: ['nombre', 'modelo', 'plan', 'monto'] },
    { key: 'sale_completed', label: 'Venta Completada', icon: '🎊', vars: ['vendedor', 'cliente', 'modelo', 'monto'] },
    { key: 'lead_followup', label: 'Seguimiento de Lead', icon: '📋', vars: ['nombre', 'ultimo_contacto', 'modelo', 'temperatura'] },
    { key: 'appointment_reminder', label: 'Recordatorio de Cita', icon: '📅', vars: ['nombre', 'fecha', 'hora', 'motivo'] },
  ];

  const [newNotification, setNewNotification] = useState({
    event_key: '',
    event_label: '',
    description: '',
    template_name: '',
    message_template: '',
    variables: [] as string[],
    recipient_type: 'agent',
    recipient_phone: '',
    category: 'UTILITY',
  });

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (viewMode === 'email-leads' && !emailConfigLoaded) {
      loadEmailConfig();
      loadEmailImportHistory();
    }
  }, [viewMode]);

  const loadAllData = async () => {
    await Promise.all([
      loadUsers(),
      loadScoringRules(),
      loadPromotions(),
      loadSettings(),
      loadLogs(),
      loadCatalog(),
      loadNotifications(),
      loadBranches(),
      loadManagerProfiles()
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
    const { data } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (data) setLogs(data);
  };

  // Helper to log activities with current user context
  const log = (actionType: string, entityType: string, details: Record<string, any>, entityId?: string | null) => {
    if (!authUser) return;
    logActivity({
      userId: authUser.id,
      userName: authUser.full_name || authUser.email || 'Unknown',
      userEmail: authUser.email || '',
      userRole: authUser.role || '',
      branchId: authUser.branch_id || currentBranch?.id || null,
      branchName: currentBranch?.name || '',
      actionType,
      entityType,
      entityId: entityId || null,
      details,
    });
  };

  const loadCatalog = async () => {
    const { data } = await supabase.from('catalog').select('*').order('price_cash');
    if (data) setCatalog(data);
  };

  // ===== Email Leads Functions =====
  const loadEmailConfig = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'gmail_leads_config')
        .maybeSingle();

      if (data?.setting_value?.value) {
        const cfg = data.setting_value.value;
        setEmailConfig({
          gmail_email: cfg.gmail_email || '',
          gmail_app_password: cfg.gmail_app_password || '',
          sender_filter: cfg.sender_filter || 'cliente_potencial@yamaha-motor.com.mx',
          auto_sync_enabled: cfg.auto_sync_enabled || false,
          sync_interval_minutes: cfg.sync_interval_minutes || 30,
          enabled: cfg.enabled || false,
          last_sync_at: cfg.last_sync_at || null,
          last_sync_result: cfg.last_sync_result || null
        });
      }
      setEmailConfigLoaded(true);
    } catch (err) {
      console.error('Error loading email config:', err);
    }
  };

  const loadEmailImportHistory = async () => {
    const { data } = await supabase
      .from('email_lead_imports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setEmailImportHistory(data);
  };

  const handleSaveEmailConfig = async () => {
    setEmailSaving(true);
    try {
      const res = await fetch('/api/leads/gmail-leads?action=save_config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailConfig)
      });
      const result = await res.json();
      if (result.success) {
        log('update', 'email_config', { email: emailConfig.gmail_email, enabled: emailConfig.enabled, action: 'Configuración email leads actualizada' });
        setEmailTestResult({ success: true, message: '✅ Configuración guardada exitosamente' });
        setTimeout(() => setEmailTestResult(null), 4000);
      } else {
        setEmailTestResult({ success: false, message: `Error: ${result.error}` });
      }
    } catch (err: any) {
      setEmailTestResult({ success: false, message: `Error de red: ${err.message}` });
    } finally {
      setEmailSaving(false);
    }
  };

  const handleTestEmailConnection = async () => {
    setEmailTesting(true);
    setEmailTestResult(null);
    try {
      const res = await fetch('/api/leads/gmail-leads?action=test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gmail_email: emailConfig.gmail_email,
          gmail_app_password: emailConfig.gmail_app_password,
          sender_filter: emailConfig.sender_filter
        })
      });
      const result = await res.json();
      setEmailTestResult(result);
    } catch (err: any) {
      setEmailTestResult({ success: false, message: `Error de conexión: ${err.message}` });
    } finally {
      setEmailTesting(false);
    }
  };

  const handleSyncEmails = async () => {
    setEmailSyncing(true);
    setEmailSyncResult(null);
    try {
      // Save config first (to ensure latest password is stored)
      await fetch('/api/leads/gmail-leads?action=save_config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailConfig)
      });

      const res = await fetch('/api/leads/gmail-leads?action=sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await res.json();
      setEmailSyncResult(result);
      log('sync', 'email_leads', {
        processed: result.processed, created: result.created,
        duplicates: result.duplicates, errors: result.errors,
        action: 'Sincronización de correos ejecutada'
      });

      // Reload config (for last_sync_at) and history
      loadEmailConfig();
      loadEmailImportHistory();
    } catch (err: any) {
      setEmailSyncResult({ success: false, details: [{ status: 'error', reason: err.message }] });
    } finally {
      setEmailSyncing(false);
    }
  };
  // ===== End Email Leads Functions =====

  const loadNotifications = async () => {
    const { data } = await supabase.from('whatsapp_notifications').select('*').order('created_at', { ascending: false });
    if (data) setNotifications(data);
  };

  const loadManagerProfiles = async () => {
    const { data } = await supabase.from('user_profiles').select('id, full_name, role').or('role.eq.gerente,role.eq.manager').order('full_name');
    if (data) setManagerProfiles(data);
  };

  const loadBranches = async () => {
    const { data } = await supabase.from('branches').select('*').order('name');
    if (data) setBranches(data);
  };

  const handleCreateBranch = async () => {
    try {
      // Auto-geocodificar la dirección usando Google Maps API
      let latitude: number | null = null;
      let longitude: number | null = null;

      const addressParts = [newBranch.address, newBranch.city, newBranch.state, 'México'].filter(Boolean);
      const fullAddress = addressParts.join(', ');

      if (fullAddress.length > 10) {
        setGeocodingStatus('📍 Geocodificando dirección...');
        try {
          const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyCnpONcNQf8EaAGx0B2wy3Gziyw38WtdHw';
          const encoded = encodeURIComponent(fullAddress);
          const geoResponse = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${apiKey}&region=mx&language=es`
          );
          const geoData = await geoResponse.json();

          if (geoData.status === 'OK' && geoData.results?.length > 0) {
            const location = geoData.results[0].geometry.location;
            latitude = location.lat;
            longitude = location.lng;
            setGeocodingStatus(`✅ Ubicación encontrada: ${latitude?.toFixed(4)}, ${longitude?.toFixed(4)}`);
          } else {
            setGeocodingStatus('⚠️ No se pudo geocodificar, se guardará sin coordenadas');
          }
        } catch (geoError) {
          console.error('Error en geocodificación:', geoError);
          setGeocodingStatus('⚠️ Error de geocodificación, se guardará sin coordenadas');
        }
      }

      const branchPayload = {
        name: newBranch.name,
        code: newBranch.code.toUpperCase(),
        address: newBranch.address || null,
        city: newBranch.city || null,
        state: newBranch.state || null,
        phone: newBranch.phone || null,
        manager_name: newBranch.manager_name || null,
        latitude,
        longitude,
        updated_at: new Date().toISOString()
      };

      if (editingBranch) {
        await supabase.from('branches').update(branchPayload).eq('id', editingBranch.id);
        log('update', 'branch', { name: newBranch.name, code: newBranch.code, latitude, longitude, action: 'Sucursal actualizada con geocodificación' }, editingBranch.id);
      } else {
        await supabase.from('branches').insert([branchPayload]);
        log('create', 'branch', { name: newBranch.name, code: newBranch.code, latitude, longitude, action: 'Nueva sucursal creada con geocodificación' });
      }
      setShowBranchModal(false);
      setEditingBranch(null);
      setNewBranch({ name: '', code: '', address: '', city: '', state: '', phone: '', manager_name: '' });
      setGeocodingStatus('');
      await loadBranches();
      await refreshGlobalBranches();
    } catch (error) {
      console.error('Error saving branch:', error);
      setGeocodingStatus('');
    }
  };

  const handleToggleBranch = async (id: string, active: boolean) => {
    const branch = branches.find(b => b.id === id);
    await supabase.from('branches').update({ active: !active, updated_at: new Date().toISOString() }).eq('id', id);
    log('toggle', 'branch', { name: branch?.name, active: !active, action: !active ? 'Sucursal activada' : 'Sucursal desactivada' }, id);
    await loadBranches();
    await refreshGlobalBranches();
  };

  const handleEditBranch = (branch: Branch) => {
    setEditingBranch(branch);
    setNewBranch({
      name: branch.name,
      code: branch.code,
      address: branch.address || '',
      city: branch.city || '',
      state: branch.state || '',
      phone: branch.phone || '',
      manager_name: branch.manager_name || ''
    });
    setGeocodingStatus(
      branch.latitude && branch.longitude
        ? `📍 Coordenadas actuales: ${branch.latitude.toFixed(4)}, ${branch.longitude.toFixed(4)}`
        : ''
    );
    setShowBranchModal(true);
  };

  const handleCreateNotification = async () => {
    setSubmittingNotification(true);
    try {
      // 1. Save to DB
      const payload = {
        event_key: newNotification.event_key,
        event_label: newNotification.event_label,
        description: newNotification.description,
        template_name: newNotification.template_name || `notif_${newNotification.event_key}`,
        message_template: newNotification.message_template,
        variables: newNotification.variables,
        recipient_type: newNotification.recipient_type,
        recipient_phone: newNotification.recipient_phone || null,
        category: 'UTILITY',
        status: 'pending',
        active: false,
      };

      if (editingNotification) {
        await supabase.from('whatsapp_notifications').update({
          ...payload,
          updated_at: new Date().toISOString(),
        }).eq('id', editingNotification.id);
      } else {
        await supabase.from('whatsapp_notifications').insert([payload]);
      }

      // 2. Close modal immediately to show feedback in main view
      setShowNotificationModal(false);
      setEditingNotification(null);
      log(editingNotification ? 'update' : 'create', 'whatsapp_notification', { template: payload.template_name, event: payload.event_key, action: editingNotification ? 'Plantilla WA actualizada' : 'Plantilla WA creada y enviada a revisión' }, editingNotification?.id);

      // 3. Send to Meta for approval
      try {
        const res = await fetch('/api/marketing?action=create_template', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: payload.template_name,
            category: 'UTILITY',
            message_template: payload.message_template,
          }),
        });
        const result = await res.json();

        if (result.success) {
          await supabase.from('whatsapp_notifications').update({ status: 'pending' }).eq('event_key', payload.event_key);
          setNotifSuccessMsg(`✅ Plantilla "${payload.event_label}" guardada y enviada a Meta para revisión. El estado se actualizará automáticamente.`);
        } else {
          await supabase.from('whatsapp_notifications').update({ status: 'rejected' }).eq('event_key', payload.event_key);
          setNotifSuccessMsg(`⚠️ Plantilla guardada pero Meta respondió: ${result.error}`);
        }
      } catch (fetchErr) {
        // Template was saved to DB but API call failed
        setNotifSuccessMsg(`✅ Plantilla "${payload.event_label}" guardada exitosamente. La sincronización con Meta se realizará cuando el servidor API esté disponible.`);
      }

      setTimeout(() => setNotifSuccessMsg(''), 8000);
      loadNotifications();
    } catch (err: any) {
      setNotifSuccessMsg(`❌ Error al guardar: ${err.message}`);
      setTimeout(() => setNotifSuccessMsg(''), 6000);
    } finally {
      setSubmittingNotification(false);
    }
  };

  const handleToggleNotification = async (notif: WhatsAppNotification) => {
    await supabase.from('whatsapp_notifications').update({ active: !notif.active }).eq('id', notif.id);
    loadNotifications();
  };

  const handleDeleteNotification = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta notificación?')) return;
    await supabase.from('whatsapp_notifications').delete().eq('id', id);
    loadNotifications();
  };

  const handleSyncNotificationStatus = async () => {
    setIsSyncingNotifications(true);
    try {
      const res = await fetch('/api/marketing?action=sync_templates', { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        // Match synced template statuses to notifications by template_name
        for (const notif of notifications) {
          const { data: tpl } = await supabase.from('whatsapp_templates').select('status').eq('name', notif.template_name).maybeSingle();
          if (tpl && tpl.status) {
            const isActive = tpl.status.toUpperCase() === 'APPROVED';
            await supabase.from('whatsapp_notifications').update({ status: tpl.status.toLowerCase(), active: isActive }).eq('id', notif.id);
          }
        }
        loadNotifications();
        setNotifSuccessMsg('✅ Estados sincronizados con Meta');
        setTimeout(() => setNotifSuccessMsg(''), 3000);
      }
    } catch (err: any) {
      setNotifSuccessMsg(`❌ Error sincronizando: ${err.message}`);
      setTimeout(() => setNotifSuccessMsg(''), 5000);
    }
    setIsSyncingNotifications(false);
  };

  const openEditNotification = (notif: WhatsAppNotification) => {
    setEditingNotification(notif);

    // Find latest config to ensure we have up-to-date variables
    const eventConfig = NOTIFICATION_EVENTS.find(e => e.key === notif.event_key);

    setNewNotification({
      event_key: notif.event_key,
      event_label: notif.event_label,
      description: notif.description || '',
      template_name: notif.template_name,
      message_template: notif.message_template,
      variables: eventConfig ? eventConfig.vars : (notif.variables || []),
      recipient_type: notif.recipient_type,
      recipient_phone: notif.recipient_phone || '',
      category: notif.category || 'UTILITY',
    });
    setShowNotificationModal(true);
  };

  const getStatusConfig = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved': return { label: 'Aprobada', color: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle };
      case 'pending': return { label: 'En Revisión', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: Clock };
      case 'rejected': return { label: 'Rechazada', color: 'bg-red-100 text-red-800 border-red-300', icon: XCircle };
      default: return { label: 'Borrador', color: 'bg-gray-100 text-gray-700 border-gray-300', icon: AlertTriangle };
    }
  };

  const handleCreateUser = async () => {
    const { error } = await supabase.from('system_users').insert([newUser]);
    if (!error) {
      log('create', 'system_user', { name: newUser.name, email: newUser.email, role: newUser.role, action: 'Usuario creado' });
      setShowUserModal(false);
      setNewUser({ name: '', email: '', role: 'agent', status: 'active', permissions: {} });
      loadUsers();
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    const { error } = await supabase.from('system_users').update(newUser).eq('id', editingUser.id);
    if (!error) {
      log('update', 'system_user', { name: newUser.name, email: newUser.email, role: newUser.role, action: 'Usuario actualizado' }, editingUser.id);
      setShowUserModal(false);
      setEditingUser(null);
      setNewUser({ name: '', email: '', role: 'agent', status: 'active', permissions: {} });
      loadUsers();
    }
  };

  const handleDeleteUser = async (id: string) => {
    const u = users.find(x => x.id === id);
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
    await supabase.from('system_users').delete().eq('id', id);
    log('delete', 'system_user', { name: u?.name, email: u?.email, action: 'Usuario eliminado' }, id);
    loadUsers();
  };

  const handleCreateRule = async () => {
    const { error } = await supabase.from('scoring_rules').insert([newRule]);
    if (!error) {
      log('create', 'scoring_rule', { name: newRule.rule_name, type: newRule.rule_type, impact: newRule.score_impact, action: 'Regla de scoring creada' });
      setShowRuleModal(false);
      setNewRule({ rule_name: '', rule_type: 'base_score', criteria: {}, score_impact: 0, active: true, priority: 0 });
      loadScoringRules();
    }
  };

  const handleUpdateRule = async () => {
    if (!editingRule) return;
    const { error } = await supabase.from('scoring_rules').update(newRule).eq('id', editingRule.id);
    if (!error) {
      log('update', 'scoring_rule', { name: newRule.rule_name, type: newRule.rule_type, impact: newRule.score_impact, action: 'Regla de scoring actualizada' }, editingRule.id);
      setShowRuleModal(false);
      setEditingRule(null);
      setNewRule({ rule_name: '', rule_type: 'base_score', criteria: {}, score_impact: 0, active: true, priority: 0 });
      loadScoringRules();
    }
  };

  const handleToggleRule = async (rule: ScoringRule) => {
    await supabase.from('scoring_rules').update({ active: !rule.active }).eq('id', rule.id);
    log('toggle', 'scoring_rule', { name: rule.rule_name, active: !rule.active, action: !rule.active ? 'Regla activada' : 'Regla desactivada' }, rule.id);
    loadScoringRules();
  };

  const handleDeleteRule = async (id: string) => {
    const r = scoringRules.find(x => x.id === id);
    if (!confirm('¿Estás seguro de eliminar esta regla?')) return;
    await supabase.from('scoring_rules').delete().eq('id', id);
    log('delete', 'scoring_rule', { name: r?.rule_name, action: 'Regla de scoring eliminada' }, id);
    loadScoringRules();
  };

  const handleCreatePromotion = async () => {
    const { error } = await supabase.from('financial_promotions').insert([newPromotion]);
    if (!error) {
      log('create', 'promotion', { name: newPromotion.name, type: newPromotion.promotion_type, action: 'Promoción creada' });
      setShowPromotionModal(false);
      setNewPromotion({ name: '', description: '', promotion_type: 'msi', conditions: {}, benefits: {}, active: true, start_date: '', end_date: '', applicable_models: [] });
      loadPromotions();
    }
  };

  const handleUpdatePromotion = async () => {
    if (!editingPromotion) return;
    const { error } = await supabase.from('financial_promotions').update(newPromotion).eq('id', editingPromotion.id);
    if (!error) {
      log('update', 'promotion', { name: newPromotion.name, action: 'Promoción actualizada' }, editingPromotion.id);
      setShowPromotionModal(false);
      setEditingPromotion(null);
      setNewPromotion({ name: '', description: '', promotion_type: 'msi', conditions: {}, benefits: {}, active: true, start_date: '', end_date: '', applicable_models: [] });
      loadPromotions();
    }
  };

  const handleTogglePromotion = async (promo: FinancialPromotion) => {
    await supabase.from('financial_promotions').update({ active: !promo.active }).eq('id', promo.id);
    log('toggle', 'promotion', { name: promo.name, active: !promo.active, action: !promo.active ? 'Promoción activada' : 'Promoción desactivada' }, promo.id);
    loadPromotions();
  };

  const handleDeletePromotion = async (id: string) => {
    const p = promotions.find(x => x.id === id);
    if (!confirm('¿Estás seguro de eliminar esta promoción?')) return;
    await supabase.from('financial_promotions').delete().eq('id', id);
    log('delete', 'promotion', { name: p?.name, action: 'Promoción eliminada' }, id);
    loadPromotions();
  };

  const handleUpdateSetting = async (setting: SystemSetting, newValue: any) => {
    const oldValue = setting.setting_value?.value;

    // Merge new value with existing metadata to prevent data loss
    const updatedValue = {
      ...setting.setting_value,
      value: newValue
    };

    const { error } = await supabase.from('system_settings').update({
      setting_value: updatedValue,
      updated_at: new Date().toISOString()
    }).eq('id', setting.id);

    if (error) {
      console.error('Error updating setting:', error);
      alert('Error al actualizar la configuración');
      return;
    }

    log('update', 'setting', { key: setting.setting_key, old_value: oldValue, new_value: newValue, action: 'Configuración actualizada' }, setting.id);
    loadSettings();
  };

  const handleUpdateCatalogItem = async () => {
    if (!editingCatalogItem) return;
    const { error } = await supabase.from('catalog').update(newCatalogItem).eq('id', editingCatalogItem.id);
    if (!error) {
      log('update', 'catalog', { model: newCatalogItem.model, segment: newCatalogItem.segment, stock: newCatalogItem.stock, action: 'Catálogo actualizado' }, editingCatalogItem.id);
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
        <div className="flex flex-nowrap border-b border-gray-200 overflow-x-auto pb-1">
          {[
            { id: 'overview', label: 'General', icon: TrendingUp },
            { id: 'scoring', label: 'Scoring', icon: Award, count: scoringRules.length },
            { id: 'notifications', label: 'Notif. WA', icon: MessageSquare, count: notifications.length },
            { id: 'email-leads', label: 'Email Leads', icon: Mail },
            { id: 'branches', label: 'Sucursales', icon: Building2, count: branches.length },
            { id: 'settings', label: 'Config', icon: Shield, count: settings.length },
            { id: 'logs', label: 'Logs', icon: Activity, count: logs.length }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id as ViewMode)}
                className={`flex-shrink-0 px-3 py-3 text-sm font-semibold transition-colors whitespace-nowrap ${viewMode === tab.id
                  ? 'bg-gray-50 text-gray-800 border-b-2 border-gray-800'
                  : 'text-gray-600 hover:bg-gray-50'
                  }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className="bg-gray-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
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
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-700">Gestión de Usuarios y Roles</h3>
                  <p className="text-sm text-gray-500">Administra el acceso y permisos del sistema</p>
                </div>
                <div className="flex gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar usuario..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-64"
                    />
                  </div>
                  <button
                    onClick={() => {
                      setEditingUser(null);
                      setNewUser({ name: '', email: '', role: 'agent', status: 'active', permissions: {} });
                      setShowUserModal(true);
                    }}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-all shadow-sm"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="hidden md:inline">Nuevo Usuario</span>
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Usuario</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Rol</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Estado</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Creado</th>
                        <th className="px-3 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {users
                        .filter(u => u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()))
                        .map((user) => (
                          <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-700 font-bold text-xs border border-blue-200 flex-shrink-0">
                                  {user.name.charAt(0).toUpperCase()}{user.name.split(' ')[1]?.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-gray-900 text-sm truncate max-w-[160px]">{user.name}</div>
                                  <div className="text-xs text-gray-500 truncate max-w-[160px]">{user.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${getRoleBadgeColor(user.role)}`}>
                                {user.role.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <span className={`flex items-center gap-1 w-fit px-2 py-0.5 text-xs font-bold rounded-full border ${getStatusBadgeColor(user.status)}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                {user.status === 'active' ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500">
                              {new Date(user.created_at).toLocaleDateString('es-MX')}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-right">
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => openEditUser(user)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                                  title="Editar"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                  title="Eliminar"
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
                  <div className="p-8 text-center text-gray-500">
                    No se encontraron usuarios.
                  </div>
                )}
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
                <div>
                  <h3 className="text-lg font-semibold text-gray-700">Gestión de Promociones Financieras</h3>
                  <p className="text-sm text-gray-500">Configura campañas y planes de financiamiento</p>
                </div>
                <button
                  onClick={() => {
                    setEditingPromotion(null);
                    setNewPromotion({ name: '', description: '', promotion_type: 'msi', conditions: {}, benefits: {}, active: true, start_date: '', end_date: '', applicable_models: [] });
                    setShowPromotionModal(true);
                  }}
                  className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-semibold transition-all shadow-sm"
                >
                  <Plus className="w-5 h-5" />
                  Nueva Promoción
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {promotions.map((promo) => (
                  <div key={promo.id} className={`bg-white rounded-xl shadow-sm overflow-hidden transition-all hover:shadow-md border ${promo.active ? 'border-orange-200' : 'border-gray-200'}`}>
                    <div className={`h-2 w-full ${promo.active ? 'bg-orange-500' : 'bg-gray-300'}`}></div>
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-gray-800 text-lg">{promo.name}</h4>
                            {!promo.active && <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">Inactiva</span>}
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2">{promo.description}</p>
                        </div>
                        <div className="flex items-center gap-1 ml-4">
                          <button
                            onClick={() => handleTogglePromotion(promo)}
                            className={`p-2 rounded-lg transition-colors ${promo.active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`}
                            title={promo.active ? 'Desactivar' : 'Activar'}
                          >
                            {promo.active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                          </button>
                          <div className="h-6 w-px bg-gray-200 mx-1"></div>
                          <button
                            onClick={() => openEditPromotion(promo)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePromotion(promo.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-orange-50 text-orange-700 border border-orange-100">
                          <DollarSign className="w-3 h-3" />
                          {promo.promotion_type.toUpperCase()}
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-50 text-gray-700 border border-gray-100">
                          <Calendar className="w-3 h-3" />
                          {promo.start_date ? new Date(promo.start_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : 'Inicio'} - {promo.end_date ? new Date(promo.end_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : 'Fin'}
                        </span>
                      </div>

                      <div className="pt-3 border-t border-gray-100">
                        <div className="text-xs font-semibold text-gray-500 mb-1.5">MODELOS PARTICIPANTES:</div>
                        <div className="flex flex-wrap gap-1">
                          {promo.applicable_models.length > 0 ? (
                            promo.applicable_models.map(m => (
                              <span key={m} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium border border-gray-200">{m}</span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400">Todos los modelos</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'catalog' && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-700">Catálogo PIM</h3>
                  <p className="text-sm text-gray-500">Inventario y configuración de productos</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2 w-full md:w-auto">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <select
                      value={catalogSegmentFilter}
                      onChange={(e) => setCatalogSegmentFilter(e.target.value)}
                      className="bg-transparent text-sm outline-none text-gray-700 w-32"
                    >
                      <option value="">Todos</option>
                      {Array.from(new Set(catalog.map(c => c.segment))).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar modelo..."
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Modelo</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Segmento</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Precio</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Stock</th>
                        <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Test Drive</th>
                        <th className="px-3 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {catalog
                        .filter(item =>
                          (catalogSegmentFilter ? item.segment === catalogSegmentFilter : true) &&
                          (item.model.toLowerCase().includes(catalogSearch.toLowerCase()) || item.segment.toLowerCase().includes(catalogSearch.toLowerCase()))
                        )
                        .map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-6 rounded bg-gray-100 flex items-center justify-center border border-gray-200 flex-shrink-0">
                                  <Image className="w-3 h-3 text-gray-400" />
                                </div>
                                <div className="font-bold text-gray-800 text-sm">{item.model}</div>
                              </div>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                                {item.segment}
                              </span>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <div className="font-bold text-gray-900 text-sm">${item.price_cash.toLocaleString('es-MX')}</div>
                              <div className="text-[10px] text-gray-500">Contado</div>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full ${item.stock > 10 ? 'bg-green-500' : item.stock > 0 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                                <span className={`font-bold text-sm ${item.stock === 0 ? 'text-red-600' : 'text-gray-700'}`}>
                                  {item.stock} u.
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-center">
                              {item.test_drive_available ? (
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-green-600">
                                  <CheckCircle className="w-4 h-4" />
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-400">
                                  <XCircle className="w-4 h-4" />
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-right">
                              <button
                                onClick={() => openEditCatalogItem(item)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
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
            </div>
          )}

          {viewMode === 'settings' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">Configuración del Sistema</h3>
                  <p className="text-gray-500">Administra los parámetros globales de la aplicación.</p>
                </div>
                <button
                  onClick={loadSettings}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Recargar configuración"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>

              {settings.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                  <Settings className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No hay configuraciones disponibles.</p>
                  <p className="text-sm text-gray-400">Ejecuta el script de migración para inicializar los datos.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-8">
                  {Object.entries(
                    settings
                      .filter(s => s.setting_key !== 'gmail_leads_config' && s.category !== 'integrations')
                      .reduce((acc, setting) => {
                      const cat = setting.category || 'Otros';
                      if (!acc[cat]) acc[cat] = [];
                      acc[cat].push(setting);
                      return acc;
                    }, {} as Record<string, typeof settings>)
                  ).map(([category, categorySettings]) => (
                    <div key={category} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${category === 'general' ? 'bg-blue-100 text-blue-600' :
                          category === 'finance' ? 'bg-green-100 text-green-600' :
                            category === 'crm' ? 'bg-purple-100 text-purple-600' :
                              category === 'inventory' ? 'bg-orange-100 text-orange-600' :
                                'bg-gray-100 text-gray-600'
                          }`}>
                          {category === 'general' ? <Building2 className="w-5 h-5" /> :
                            category === 'finance' ? <DollarSign className="w-5 h-5" /> :
                              category === 'crm' ? <Users className="w-5 h-5" /> :
                                category === 'inventory' ? <Package className="w-5 h-5" /> :
                                  category === 'notifications' ? <Bell className="w-5 h-5" /> :
                                    <Settings className="w-5 h-5" />}
                        </div>
                        <h4 className="text-lg font-bold text-gray-800 capitalize">
                          {category === 'crm' ? 'CRM & Leads' :
                            category === 'finance' ? 'Finanzas & Ventas' :
                              category === 'inventory' ? 'Inventario & Stock' :
                                category === 'notifications' ? 'Notificaciones' :
                                  category}
                        </h4>
                      </div>

                      <div className="divide-y divide-gray-100">
                        {categorySettings.map((setting) => (
                          <div key={setting.id} className="p-6 hover:bg-gray-50 transition-colors group">
                            <div className="flex items-start gap-6">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-gray-800 text-base">
                                    {setting.setting_value.label || setting.setting_key}
                                  </span>
                                  {setting.is_public && (
                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-bold rounded-full border border-blue-100">
                                      Público
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500 mb-3">{setting.description}</p>

                                <div className="w-full max-w-xl">
                                  {/* Boolean Toggle */}
                                  {setting.setting_value.type === 'boolean' && (
                                    <button
                                      onClick={() => handleUpdateSetting(setting, !setting.setting_value.value)}
                                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${setting.setting_value.value ? 'bg-blue-600' : 'bg-gray-200'
                                        }`}
                                    >
                                      <span
                                        className={`${setting.setting_value.value ? 'translate-x-6' : 'translate-x-1'
                                          } inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm`}
                                      />
                                    </button>
                                  )}

                                  {/* Number Input */}
                                  {setting.setting_value.type === 'number' && (
                                    <div className="relative">
                                      <input
                                        type="number"
                                        value={setting.setting_value.value}
                                        onChange={(e) => handleUpdateSetting(setting, Number(e.target.value))}
                                        className="block w-full rounded-lg border-gray-300 bg-gray-50 focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2 border hover:bg-white transition-colors"
                                      />
                                    </div>
                                  )}

                                  {/* String Input */}
                                  {setting.setting_value.type === 'string' && (
                                    <input
                                      type="text"
                                      value={setting.setting_value.value}
                                      onChange={(e) => handleUpdateSetting(setting, e.target.value)}
                                      onBlur={(e) => handleUpdateSetting(setting, e.target.value)}
                                      className="block w-full rounded-lg border-gray-300 bg-gray-50 focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2 border hover:bg-white transition-colors"
                                    />
                                  )}

                                  {/* List/JSON Input */}
                                  {(setting.setting_value.type === 'list' || setting.setting_value.type === 'json') && (
                                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-2 font-mono text-xs text-gray-600 overflow-x-auto">
                                      {JSON.stringify(setting.setting_value.value)}
                                      <div className="mt-1 text-xs text-orange-500 italic">
                                        (Edición avanzada próximamente)
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {viewMode === 'logs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-700">Registro de Actividad del Sistema</h3>
                <button
                  onClick={loadLogs}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" /> Actualizar
                </button>
              </div>

              {logs.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
                  <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-semibold">No hay registros de actividad aún</p>
                  <p className="text-sm mt-1">Las acciones realizadas en el sistema aparecerán aquí.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((logEntry) => {
                    const performer = logEntry.changes?.performed_by;
                    const actionColor = {
                      create: 'bg-green-100 text-green-800 border-green-200',
                      update: 'bg-blue-100 text-blue-800 border-blue-200',
                      delete: 'bg-red-100 text-red-800 border-red-200',
                      toggle: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                    }[logEntry.action_type] || 'bg-gray-100 text-gray-800 border-gray-200';
                    const actionLabel = {
                      create: 'Creación', update: 'Actualización', delete: 'Eliminación', toggle: 'Cambio de estado',
                    }[logEntry.action_type] || logEntry.action_type;
                    const entityLabel = {
                      system_user: 'Usuario', branch: 'Sucursal', scoring_rule: 'Regla Scoring',
                      promotion: 'Promoción', setting: 'Configuración', whatsapp_notification: 'Plantilla WA',
                      catalog: 'Catálogo', lead: 'Lead', campaign: 'Campaña',
                    }[logEntry.entity_type] || logEntry.entity_type;
                    // Extract details excluding performed_by
                    const { performed_by, ...details } = logEntry.changes || {};

                    return (
                      <div key={logEntry.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            {/* User avatar */}
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center text-indigo-700 font-bold text-xs border border-indigo-200 flex-shrink-0">
                              {performer?.name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div className="min-w-0 flex-1">
                              {/* User info line */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-gray-900 text-sm">
                                  {performer?.name || 'Sistema'}
                                </span>
                                {performer?.email && (
                                  <span className="text-xs text-gray-500">{performer.email}</span>
                                )}
                                {performer?.role && (
                                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-gray-100 text-gray-600 border border-gray-200 uppercase">
                                    {performer.role}
                                  </span>
                                )}
                                {performer?.branch_name && (
                                  <span className="flex items-center gap-0.5 text-[10px] text-gray-500">
                                    <Building2 className="w-3 h-3" /> {performer.branch_name}
                                  </span>
                                )}
                              </div>
                              {/* Action description */}
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${actionColor}`}>
                                  {actionLabel}
                                </span>
                                <span className="text-xs font-semibold text-gray-700">{entityLabel}</span>
                                {details?.action && (
                                  <span className="text-xs text-gray-500">— {details.action}</span>
                                )}
                              </div>
                              {/* Details */}
                              {Object.keys(details).filter(k => k !== 'action').length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {Object.entries(details).filter(([k]) => k !== 'action').map(([key, value]) => (
                                    <span key={key} className="text-[10px] px-1.5 py-0.5 bg-gray-50 border border-gray-100 rounded text-gray-600">
                                      <span className="font-semibold">{key}:</span> {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Timestamp */}
                          <div className="text-right flex-shrink-0">
                            <div className="text-[10px] text-gray-400 whitespace-nowrap">
                              {new Date(logEntry.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })}
                            </div>
                            <div className="text-xs font-semibold text-gray-500 whitespace-nowrap">
                              {new Date(logEntry.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {viewMode === 'notifications' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-700">Notificaciones por WhatsApp</h3>
                  <p className="text-sm text-gray-500 mt-1">Configura plantillas automáticas para eventos del sistema. Requieren aprobación de Meta.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSyncNotificationStatus}
                    disabled={isSyncingNotifications}
                    className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold transition-all border border-gray-300"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncingNotifications ? 'animate-spin' : ''}`} />
                    Sincronizar Estado
                  </button>
                  <button
                    onClick={() => {
                      setEditingNotification(null);
                      setNewNotification({ event_key: '', event_label: '', description: '', template_name: '', message_template: '', variables: [], recipient_type: 'agent', recipient_phone: '', category: 'UTILITY' });
                      setShowNotificationModal(true);
                    }}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    Nueva Notificación
                  </button>
                </div>
              </div>

              {notifSuccessMsg && (
                <div className={`px-4 py-3 rounded-lg text-sm font-medium ${notifSuccessMsg.startsWith('✅') ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                  {notifSuccessMsg}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                {notifications.map((notif) => {
                  const statusCfg = getStatusConfig(notif.status);
                  const StatusIcon = statusCfg.icon;
                  const eventDef = NOTIFICATION_EVENTS.find(e => e.key === notif.event_key);
                  return (
                    <div key={notif.id} className={`bg-white rounded-xl p-5 border-2 transition-all ${notif.status?.toLowerCase() === 'approved' ? 'border-green-300 shadow-sm' : notif.status?.toLowerCase() === 'pending' ? 'border-yellow-300' : notif.status?.toLowerCase() === 'rejected' ? 'border-red-300' : 'border-gray-200'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">{eventDef?.icon || '📢'}</span>
                            <h4 className="font-bold text-gray-800 text-lg">{notif.event_label}</h4>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full border ${statusCfg.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {statusCfg.label}
                            </span>
                            {notif.active && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full bg-green-500 text-white">
                                <Bell className="w-3 h-3" />
                                Activa
                              </span>
                            )}
                          </div>
                          {notif.description && <p className="text-sm text-gray-600 mb-3 ml-9">{notif.description}</p>}
                          <div className="ml-9 bg-gray-50 rounded-lg p-3 border border-gray-100">
                            <div className="text-xs font-semibold text-gray-500 mb-1">PLANTILLA:</div>
                            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{notif.message_template}</pre>
                          </div>
                          <div className="ml-9 mt-3 flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                              <Phone className="w-3 h-3" />
                              Destinatario: {notif.recipient_type === 'agent' ? 'Agente' : notif.recipient_type === 'manager' ? 'Gerente' : notif.recipient_type === 'client' ? 'Cliente' : 'Personalizado'}
                            </span>
                            {notif.variables && notif.variables.map((v: string) => (
                              <span key={v} className="px-2 py-1 text-xs font-mono rounded bg-purple-50 text-purple-700 border border-purple-200">
                                {`{{${v}}}`}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-4">
                          <button
                            onClick={() => handleToggleNotification(notif)}
                            className={`p-2 rounded transition-colors ${notif.active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`}
                            title={notif.active ? 'Desactivar' : 'Activar'}
                          >
                            {notif.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                          </button>
                          <button
                            onClick={() => openEditNotification(notif)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteNotification(notif.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {notifications.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No hay notificaciones configuradas</p>
                    <p className="text-sm">Crea tu primera notificación para comenzar</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {viewMode === 'email-leads' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Mail className="w-6 h-6 text-red-500" />
                    Importación de Leads por Email
                  </h3>
                  <p className="text-gray-500 mt-1">Conecta tu cuenta de Gmail para importar leads automáticamente desde correos de Yamaha Motor de México.</p>
                </div>
              </div>

              {/* Connection Status Banner */}
              {emailConfig.enabled && emailConfig.gmail_email && (
                <div className={`rounded-lg p-4 border-2 flex items-center gap-3 ${emailConfig.last_sync_result ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                  <Wifi className="w-5 h-5 text-green-600" />
                  <div className="flex-1">
                    <span className="font-semibold text-gray-800">Conectado: {emailConfig.gmail_email}</span>
                    {emailConfig.last_sync_at && (
                      <p className="text-sm text-gray-600 mt-0.5">
                        Última sincronización: {new Date(emailConfig.last_sync_at).toLocaleString('es-MX')} — {emailConfig.last_sync_result}
                      </p>
                    )}
                  </div>
                  {emailConfig.auto_sync_enabled && (
                    <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full border border-green-300">Auto-Sync ON</span>
                  )}
                </div>
              )}

              {/* Gmail Configuration */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-red-50 to-orange-50 border-b border-gray-200">
                  <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Mail className="w-5 h-5 text-red-500" />
                    Conexión Gmail
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">Configura las credenciales de tu cuenta de Gmail para leer los correos de Yamaha.</p>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Correo Gmail</label>
                      <input
                        type="email"
                        value={emailConfig.gmail_email}
                        onChange={(e) => setEmailConfig({ ...emailConfig, gmail_email: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                        placeholder="tucuenta@gmail.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        Contraseña de Aplicación
                        <button
                          onClick={() => setShowAppPasswordHelp(!showAppPasswordHelp)}
                          className="text-blue-500 hover:text-blue-700 text-xs underline"
                        >
                          ¿Cómo obtenerla?
                        </button>
                      </label>
                      <input
                        type="password"
                        value={emailConfig.gmail_app_password}
                        onChange={(e) => setEmailConfig({ ...emailConfig, gmail_app_password: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                        placeholder="xxxx xxxx xxxx xxxx"
                      />
                    </div>
                  </div>

                  {showAppPasswordHelp && (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 text-sm space-y-2">
                      <h5 className="font-bold text-blue-800">📋 Cómo generar una Contraseña de Aplicación:</h5>
                      <ol className="list-decimal list-inside text-blue-900 space-y-1">
                        <li>Ve a <a href="https://myaccount.google.com/security" target="_blank" rel="noopener" className="text-blue-600 underline font-medium">myaccount.google.com/security</a></li>
                        <li>Activa la <strong>Verificación en 2 pasos</strong> si no la tienes</li>
                        <li>Ve a <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener" className="text-blue-600 underline font-medium">myaccount.google.com/apppasswords</a></li>
                        <li>En "Nombre de app" escribe: <strong>QuMa ERP</strong></li>
                        <li>Haz clic en <strong>Crear</strong></li>
                        <li>Copia la contraseña de 16 caracteres que aparece</li>
                        <li>Pégala aquí en el campo de Contraseña de Aplicación</li>
                      </ol>
                      <p className="text-blue-700 italic mt-2">⚠️ Esta NO es tu contraseña normal de Gmail. Es una contraseña especial para apps.</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email del Remitente (filtro)</label>
                    <input
                      type="email"
                      value={emailConfig.sender_filter}
                      onChange={(e) => setEmailConfig({ ...emailConfig, sender_filter: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                      placeholder="cliente_potencial@yamaha-motor.com.mx"
                    />
                    <p className="text-xs text-gray-500 mt-1">Solo se procesarán correos de este remitente.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setEmailConfig({ ...emailConfig, enabled: !emailConfig.enabled })}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${emailConfig.enabled ? 'bg-green-600' : 'bg-gray-200'}`}
                      >
                        <span className={`${emailConfig.enabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm`} />
                      </button>
                      <span className="text-sm font-medium text-gray-700">Activar importación</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setEmailConfig({ ...emailConfig, auto_sync_enabled: !emailConfig.auto_sync_enabled })}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${emailConfig.auto_sync_enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                      >
                        <span className={`${emailConfig.auto_sync_enabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm`} />
                      </button>
                      <span className="text-sm font-medium text-gray-700">Auto-sincronizar</span>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Intervalo (minutos)</label>
                      <select
                        value={emailConfig.sync_interval_minutes}
                        onChange={(e) => setEmailConfig({ ...emailConfig, sync_interval_minutes: parseInt(e.target.value) })}
                        className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm w-full"
                      >
                        <option value={15}>Cada 15 min</option>
                        <option value={30}>Cada 30 min</option>
                        <option value={60}>Cada 1 hora</option>
                        <option value={120}>Cada 2 horas</option>
                      </select>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={handleSaveEmailConfig}
                      disabled={emailSaving || !emailConfig.gmail_email}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-5 py-2.5 rounded-lg font-semibold transition-all shadow-sm"
                    >
                      {emailSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Guardar Configuración
                    </button>
                    <button
                      onClick={handleTestEmailConnection}
                      disabled={emailTesting || !emailConfig.gmail_email || !emailConfig.gmail_app_password}
                      className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 px-5 py-2.5 rounded-lg font-semibold transition-all border border-gray-300"
                    >
                      {emailTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                      Probar Conexión
                    </button>
                    <button
                      onClick={handleSyncEmails}
                      disabled={emailSyncing || !emailConfig.gmail_email}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-5 py-2.5 rounded-lg font-semibold transition-all shadow-sm"
                    >
                      {emailSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      {emailSyncing ? 'Sincronizando...' : 'Sincronizar Ahora'}
                    </button>
                  </div>

                  {/* Test Result */}
                  {emailTestResult && (
                    <div className={`rounded-lg p-4 border-2 flex items-start gap-3 ${emailTestResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      {emailTestResult.success ? <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-600 mt-0.5" />}
                      <div>
                        <p className={`font-semibold ${emailTestResult.success ? 'text-green-800' : 'text-red-800'}`}>{emailTestResult.message}</p>
                        {emailTestResult.unreadCount !== undefined && (
                          <p className="text-sm text-green-700 mt-1">
                            📬 {emailTestResult.unreadCount} correo(s) sin leer de Yamaha pendientes de procesar
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Sync Result */}
                  {emailSyncResult && (
                    <div className={`rounded-lg p-4 border-2 ${emailSyncResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex items-center gap-2 mb-3">
                        {emailSyncResult.success ? <CheckCircle className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
                        <span className="font-bold text-gray-800">Resultado de Sincronización</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white rounded-lg p-3 border border-gray-200 text-center">
                          <div className="text-2xl font-bold text-blue-600">{emailSyncResult.processed || 0}</div>
                          <div className="text-xs text-gray-500">Procesados</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-gray-200 text-center">
                          <div className="text-2xl font-bold text-green-600">{emailSyncResult.created || 0}</div>
                          <div className="text-xs text-gray-500">Creados</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-gray-200 text-center">
                          <div className="text-2xl font-bold text-yellow-600">{emailSyncResult.duplicates || 0}</div>
                          <div className="text-xs text-gray-500">Duplicados</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-gray-200 text-center">
                          <div className="text-2xl font-bold text-red-600">{emailSyncResult.errors || 0}</div>
                          <div className="text-xs text-gray-500">Errores</div>
                        </div>
                      </div>
                      {emailSyncResult.details && emailSyncResult.details.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {emailSyncResult.details.map((d: any, i: number) => (
                            <div key={i} className={`text-sm px-3 py-1.5 rounded flex items-center gap-2 ${
                              d.status === 'created' ? 'bg-green-100 text-green-800' :
                              d.status === 'duplicate' ? 'bg-yellow-100 text-yellow-800' :
                              d.status === 'skipped' ? 'bg-gray-100 text-gray-700' :
                              'bg-red-100 text-red-800'
                            }`}>
                              <span>{d.status === 'created' ? '✅' : d.status === 'duplicate' ? '🔁' : d.status === 'skipped' ? '⏭️' : '❌'}</span>
                              <span className="font-medium">{d.name || d.subject || 'Correo'}</span>
                              {d.model && <span className="text-xs opacity-75">— {d.model}</span>}
                              {d.reason && <span className="text-xs opacity-75">— {d.reason}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Import History */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-gray-600" />
                    Historial de Importaciones
                  </h4>
                  <button
                    onClick={loadEmailImportHistory}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  {emailImportHistory.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="font-medium">No hay importaciones registradas</p>
                      <p className="text-sm">Sincroniza correos para ver el historial aquí</p>
                    </div>
                  ) : (
                    <table className="w-full min-w-[700px]">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Fecha</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Nombre</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Teléfono</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Modelo</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Estado</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Resultado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {emailImportHistory.map((imp) => (
                          <tr key={imp.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                              {new Date(imp.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-800">{imp.lead_name || '—'}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{imp.lead_phone || '—'}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{imp.model_interested || '—'}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{imp.lead_state || '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full border ${
                                imp.status === 'success' ? 'bg-green-100 text-green-800 border-green-300' :
                                imp.status === 'duplicate' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                                imp.status === 'skipped' ? 'bg-gray-100 text-gray-700 border-gray-300' :
                                'bg-red-100 text-red-800 border-red-300'
                              }`}>
                                {imp.status === 'success' ? '✅ Creado' :
                                 imp.status === 'duplicate' ? '🔁 Duplicado' :
                                 imp.status === 'skipped' ? '⏭️ Omitido' :
                                 '❌ Error'}
                              </span>
                              {imp.error_message && (
                                <p className="text-xs text-gray-500 mt-1 max-w-xs truncate" title={imp.error_message}>{imp.error_message}</p>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {
        showUserModal && (
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
        )
      }

      {
        showRuleModal && (
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
        )
      }

      {
        showPromotionModal && (
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
        )
      }

      {
        showCatalogModal && editingCatalogItem && (
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
        )
      }

      {
        showNotificationModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowNotificationModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">{editingNotification ? 'Editar Notificación' : 'Nueva Notificación WhatsApp'}</h3>
                    <p className="text-xs text-gray-500">Se enviará a Meta para aprobación automáticamente</p>
                  </div>
                </div>
                <button onClick={() => setShowNotificationModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Evento Disparador</label>
                  <select
                    value={newNotification.event_key}
                    onChange={(e) => {
                      const evt = NOTIFICATION_EVENTS.find(ev => ev.key === e.target.value);
                      if (evt) {
                        setNewNotification({
                          ...newNotification,
                          event_key: evt.key,
                          event_label: evt.label,
                          template_name: `notif_${evt.key}`,
                          variables: evt.vars,
                          message_template: newNotification.message_template || '',
                        });
                      }
                    }}
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none text-sm"
                  >
                    <option value="">Selecciona un evento...</option>
                    {NOTIFICATION_EVENTS.map(evt => (
                      <option key={evt.key} value={evt.key}>{evt.icon} {evt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Descripción</label>
                  <input
                    type="text"
                    value={newNotification.description}
                    onChange={(e) => setNewNotification({ ...newNotification, description: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none text-sm"
                    placeholder="¿Qué hace esta notificación?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Mensaje de la Plantilla</label>
                  {newNotification.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className="text-xs text-gray-500 mr-1">Variables disponibles:</span>
                      {newNotification.variables.map(v => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setNewNotification({ ...newNotification, message_template: newNotification.message_template + `{{${v}}}` })}
                          className="px-2 py-0.5 text-xs font-mono rounded bg-purple-100 text-purple-700 border border-purple-200 hover:bg-purple-200 transition-colors cursor-pointer"
                        >
                          {`{{${v}}}`}
                        </button>
                      ))}
                    </div>
                  )}
                  <textarea
                    value={newNotification.message_template}
                    onChange={(e) => setNewNotification({ ...newNotification, message_template: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none font-mono text-sm"
                    rows={6}
                    placeholder="Escribe el mensaje con {{variables}}..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Destinatario</label>
                    <select
                      value={newNotification.recipient_type}
                      onChange={(e) => setNewNotification({ ...newNotification, recipient_type: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none text-sm"
                    >
                      <option value="agent">Agente Asignado</option>
                      <option value="manager">Gerente</option>
                      <option value="client">Cliente</option>
                      <option value="custom">Número Personalizado</option>
                    </select>
                  </div>
                  {newNotification.recipient_type === 'custom' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Teléfono</label>
                      <input
                        type="tel"
                        value={newNotification.recipient_phone}
                        onChange={(e) => setNewNotification({ ...newNotification, recipient_phone: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none text-sm"
                        placeholder="521234567890"
                      />
                    </div>
                  )}
                </div>

                {newNotification.message_template && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="text-xs font-semibold text-gray-500 mb-2">VISTA PREVIA:</div>
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                        {newNotification.message_template.replace(/\{\{(\w+)\}\}/g, (_, v) => `[${v}]`)}
                      </pre>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleCreateNotification}
                    disabled={!newNotification.event_key || !newNotification.message_template || submittingNotification}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-semibold transition-all"
                  >
                    {submittingNotification ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Enviando a revisión...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        {editingNotification ? 'Actualizar y Enviar a Meta' : 'Crear y Enviar a Revisión'}
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowNotificationModal(false)}
                    className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
      {/* ===== BRANCHES TAB ===== */}
      {viewMode === 'branches' && (
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Building2 className="w-6 h-6" /> Gestión de Sucursales
            </h3>
            <button
              onClick={() => { setEditingBranch(null); setNewBranch({ name: '', code: '', address: '', city: '', state: '', phone: '', manager_name: '' }); setGeocodingStatus(''); setShowBranchModal(true); }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold transition-all shadow-md"
            >
              <Plus className="w-5 h-5" /> Nueva Sucursal
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map(branch => (
              <div key={branch.id} className={`bg-white rounded-xl border-2 shadow-md p-5 transition-all ${branch.active ? 'border-blue-200 hover:border-blue-400' : 'border-gray-200 opacity-60'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${branch.active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                      {branch.code}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800">{branch.name}</h4>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${branch.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {branch.active ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                  </div>
                </div>
                {branch.address && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <MapPin className="w-4 h-4 text-gray-400" /> {branch.address}
                  </div>
                )}
                {branch.city && (
                  <div className="text-sm text-gray-500 ml-6 mb-1">
                    {branch.city}{branch.state ? `, ${branch.state}` : ''}
                  </div>
                )}
                {(branch.latitude && branch.longitude) && (
                  <div className="flex items-center gap-2 text-xs text-green-600 ml-6 mb-1">
                    📍 {branch.latitude.toFixed(4)}, {branch.longitude.toFixed(4)}
                  </div>
                )}
                {(!branch.latitude || !branch.longitude) && (
                  <div className="flex items-center gap-2 text-xs text-amber-600 ml-6 mb-1">
                    ⚠️ Sin coordenadas — edite para geocodificar
                  </div>
                )}
                {branch.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <Phone className="w-4 h-4 text-gray-400" /> {branch.phone}
                  </div>
                )}
                {branch.manager_name && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                    <Users className="w-4 h-4 text-gray-400" /> Gerente: {branch.manager_name}
                  </div>
                )}
                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <button onClick={() => handleEditBranch(branch)} className="flex-1 flex items-center justify-center gap-1 text-blue-600 hover:bg-blue-50 rounded-lg py-2 text-sm font-semibold transition-colors">
                    <Edit2 className="w-4 h-4" /> Editar
                  </button>
                  <button onClick={() => handleToggleBranch(branch.id, branch.active)} className={`flex-1 flex items-center justify-center gap-1 rounded-lg py-2 text-sm font-semibold transition-colors ${branch.active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>
                    {branch.active ? <><XCircle className="w-4 h-4" /> Desactivar</> : <><CheckCircle className="w-4 h-4" /> Activar</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Branch Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">
                {editingBranch ? 'Editar Sucursal' : 'Nueva Sucursal'}
              </h3>
              <button onClick={() => setShowBranchModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1 block">Nombre *</label>
                  <input value={newBranch.name} onChange={e => setNewBranch({ ...newBranch, name: e.target.value })} className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500" placeholder="Sucursal Centro" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1 block">Código *</label>
                  <input value={newBranch.code} onChange={e => setNewBranch({ ...newBranch, code: e.target.value.toUpperCase() })} maxLength={5} className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 uppercase" placeholder="CTR" />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1 block">Dirección</label>
                <input value={newBranch.address} onChange={e => setNewBranch({ ...newBranch, address: e.target.value })} className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500" placeholder="Av. Principal #123" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1 block">Ciudad</label>
                  <input value={newBranch.city} onChange={e => setNewBranch({ ...newBranch, city: e.target.value })} className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500" placeholder="Colima" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1 block">Estado</label>
                  <input value={newBranch.state} onChange={e => setNewBranch({ ...newBranch, state: e.target.value })} className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500" placeholder="Colima" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1 block">Teléfono</label>
                  <input value={newBranch.phone} onChange={e => setNewBranch({ ...newBranch, phone: e.target.value })} className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500" />
                </div>
                <div className="flex items-end">
                  {geocodingStatus && (
                    <div className="text-xs text-gray-600 py-2.5">{geocodingStatus}</div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1 block">Nombre del Gerente</label>
                <select
                  value={newBranch.manager_name}
                  onChange={e => setNewBranch({ ...newBranch, manager_name: e.target.value })}
                  className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Seleccionar Gerente...</option>
                  {managerProfiles.map(u => (
                    <option key={u.id} value={u.full_name || ''}>
                      {u.full_name}
                    </option>
                  ))}
                  {managerProfiles.length === 0 && (
                    <option value="" disabled>No hay gerentes registrados</option>
                  )}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleCreateBranch} disabled={!newBranch.name || !newBranch.code} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-semibold transition-all">
                  <Save className="w-5 h-5" />
                  {editingBranch ? 'Guardar Cambios' : 'Crear Sucursal'}
                </button>
                <button onClick={() => setShowBranchModal(false)} className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div >
  );
}
