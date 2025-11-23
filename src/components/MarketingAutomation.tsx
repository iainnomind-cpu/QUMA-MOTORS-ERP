import { useState, useEffect } from 'react';
import { supabase, WhatsAppTemplate, CampaignAudience, AutomatedCampaign, Lead, Client } from '../lib/supabase';
import { Mail, Users, TrendingUp, Send, MessageSquare, Target, Calendar, Zap, Plus, X, CreditCard as Edit2, Play, Pause, Trash2, Eye, Filter, Gift } from 'lucide-react';

type ViewMode = 'overview' | 'templates' | 'campaigns' | 'audiences';

export function MarketingAutomation() {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [audiences, setAudiences] = useState<CampaignAudience[]>([]);
  const [automatedCampaigns, setAutomatedCampaigns] = useState<AutomatedCampaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showAudienceModal, setShowAudienceModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<AutomatedCampaign | null>(null);

  const [newTemplate, setNewTemplate] = useState({
    name: '',
    category: 'promotional',
    message_template: '',
    active: true
  });

  const [newCampaign, setNewCampaign] = useState({
    name: '',
    type: 'scheduled',
    trigger_type: null as string | null,
    template_id: '',
    audience_id: '',
    schedule_date: '',
    status: 'draft'
  });

  const [newAudience, setNewAudience] = useState({
    name: '',
    target_type: 'leads',
    status_filter: '',
    model_filter: '',
    timeframe_filter: '',
    score_min: ''
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    await Promise.all([
      loadTemplates(),
      loadAudiences(),
      loadAutomatedCampaigns(),
      loadLeads(),
      loadClients()
    ]);
  };

  const loadTemplates = async () => {
    const { data } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setTemplates(data);
  };

  const loadAudiences = async () => {
    const { data } = await supabase
      .from('campaign_audiences')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setAudiences(data);
  };

  const loadAutomatedCampaigns = async () => {
    const { data } = await supabase
      .from('automated_campaigns')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setAutomatedCampaigns(data);
  };

  const loadLeads = async () => {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .order('score', { ascending: false });
    if (data) setLeads(data);
  };

  const loadClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setClients(data);
  };

  const handleCreateTemplate = async () => {
    const { error } = await supabase
      .from('whatsapp_templates')
      .insert([newTemplate]);

    if (!error) {
      setSuccessMessage('Plantilla creada exitosamente');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      setShowTemplateModal(false);
      setNewTemplate({ name: '', category: 'promotional', message_template: '', active: true });
      loadTemplates();
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;

    const { error } = await supabase
      .from('whatsapp_templates')
      .update(newTemplate)
      .eq('id', editingTemplate.id);

    if (!error) {
      setSuccessMessage('Plantilla actualizada exitosamente');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      setShowTemplateModal(false);
      setEditingTemplate(null);
      setNewTemplate({ name: '', category: 'promotional', message_template: '', active: true });
      loadTemplates();
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta plantilla?')) return;

    const { error } = await supabase
      .from('whatsapp_templates')
      .delete()
      .eq('id', id);

    if (!error) {
      setSuccessMessage('Plantilla eliminada');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      loadTemplates();
    }
  };

  const handleCreateAudience = async () => {
    const filters: Record<string, any> = {};
    if (newAudience.status_filter) filters.status = newAudience.status_filter;
    if (newAudience.model_filter) filters.model_interested = newAudience.model_filter;
    if (newAudience.timeframe_filter) filters.timeframe = newAudience.timeframe_filter;
    if (newAudience.score_min) filters.score_min = parseInt(newAudience.score_min);

    const { error } = await supabase
      .from('campaign_audiences')
      .insert([{
        name: newAudience.name,
        target_type: newAudience.target_type,
        filters
      }]);

    if (!error) {
      setSuccessMessage('Audiencia creada exitosamente');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      setShowAudienceModal(false);
      setNewAudience({ name: '', target_type: 'leads', status_filter: '', model_filter: '', timeframe_filter: '', score_min: '' });
      loadAudiences();
    }
  };

  const handleCreateCampaign = async () => {
    const campaignData: any = {
      name: newCampaign.name,
      type: newCampaign.type,
      template_id: newCampaign.template_id || null,
      audience_id: newCampaign.audience_id || null,
      status: newCampaign.status,
      total_sent: 0,
      total_delivered: 0,
      total_responses: 0
    };

    if (newCampaign.type === 'triggered' && newCampaign.trigger_type) {
      campaignData.trigger_type = newCampaign.trigger_type;
    }

    if (newCampaign.type === 'scheduled' && newCampaign.schedule_date) {
      campaignData.schedule_date = newCampaign.schedule_date;
    }

    const { error } = await supabase
      .from('automated_campaigns')
      .insert([campaignData]);

    if (!error) {
      setSuccessMessage('Campaña creada exitosamente');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      setShowCampaignModal(false);
      setNewCampaign({ name: '', type: 'scheduled', trigger_type: null, template_id: '', audience_id: '', schedule_date: '', status: 'draft' });
      loadAutomatedCampaigns();
    }
  };

  const handleToggleCampaignStatus = async (campaign: AutomatedCampaign) => {
    const newStatus = campaign.status === 'active' ? 'paused' : 'active';

    const { error } = await supabase
      .from('automated_campaigns')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', campaign.id);

    if (!error) {
      setSuccessMessage(`Campaña ${newStatus === 'active' ? 'activada' : 'pausada'}`);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      loadAutomatedCampaigns();
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta campaña?')) return;

    const { error } = await supabase
      .from('automated_campaigns')
      .delete()
      .eq('id', id);

    if (!error) {
      setSuccessMessage('Campaña eliminada');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      loadAutomatedCampaigns();
    }
  };

  const getAudienceSize = (audience: CampaignAudience): number => {
    let count = 0;
    const filters = audience.filters;

    if (audience.target_type === 'leads' || audience.target_type === 'mixed') {
      const filteredLeads = leads.filter(lead => {
        if (filters.status && lead.status !== filters.status) return false;
        if (filters.model_interested && lead.model_interested !== filters.model_interested) return false;
        if (filters.timeframe && lead.timeframe !== filters.timeframe) return false;
        if (filters.score_min && lead.score < filters.score_min) return false;
        return true;
      });
      count += filteredLeads.length;
    }

    if (audience.target_type === 'clients' || audience.target_type === 'mixed') {
      const filteredClients = clients.filter(client => {
        if (filters.status && client.status !== filters.status) return false;
        return true;
      });
      count += filteredClients.length;
    }

    if (filters.birthday_month === 'current') {
      const currentMonth = new Date().getMonth();
      const birthdayCount = [...leads, ...clients].filter(person => {
        if (!person.birthday) return false;
        const birthMonth = new Date(person.birthday).getMonth();
        return birthMonth === currentMonth;
      }).length;
      count = birthdayCount;
    }

    return count;
  };

  const getBirthdaysThisMonth = () => {
    const currentMonth = new Date().getMonth();
    return [...leads, ...clients].filter(person => {
      if (!person.birthday) return false;
      const birthMonth = new Date(person.birthday).getMonth();
      return birthMonth === currentMonth;
    });
  };

  const openEditTemplate = (template: WhatsAppTemplate) => {
    setEditingTemplate(template);
    setNewTemplate({
      name: template.name,
      category: template.category,
      message_template: template.message_template,
      active: template.active
    });
    setShowTemplateModal(true);
  };

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case 'promotional': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'transactional': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'birthday': return 'bg-pink-100 text-pink-800 border-pink-300';
      case 'follow-up': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-300';
      case 'paused': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'completed': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'draft': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getTotalLeadsByStatus = (status: string) => {
    return leads.filter(lead => lead.status === status).length;
  };

  const getTotalClientsByStatus = (status: string) => {
    return clients.filter(client => client.status === status).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Mail className="w-7 h-7 text-blue-600" />
          Marketing Automation & Campañas
        </h2>
      </div>

      {showSuccess && (
        <div className="bg-green-100 border-2 border-green-400 text-green-800 px-4 py-3 rounded-lg flex items-center gap-3">
          <TrendingUp className="w-5 h-5" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md border-2 border-gray-200">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setViewMode('overview')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              viewMode === 'overview'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Vista General
            </div>
          </button>
          <button
            onClick={() => setViewMode('templates')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              viewMode === 'templates'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Plantillas ({templates.length})
            </div>
          </button>
          <button
            onClick={() => setViewMode('audiences')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              viewMode === 'audiences'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Target className="w-5 h-5" />
              Audiencias ({audiences.length})
            </div>
          </button>
          <button
            onClick={() => setViewMode('campaigns')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              viewMode === 'campaigns'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Send className="w-5 h-5" />
              Campañas ({automatedCampaigns.length})
            </div>
          </button>
        </div>

        <div className="p-6">
          {viewMode === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <Users className="w-8 h-8 opacity-80" />
                    <div className="text-right">
                      <div className="text-3xl font-bold">{getTotalClientsByStatus('Vigente')}</div>
                      <div className="text-xs opacity-90 mt-1">clientes</div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold mt-2">Clientes Vigentes</div>
                  <div className="text-xs opacity-80 mt-1">Base activa para campañas</div>
                </div>

                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <Users className="w-8 h-8 opacity-80" />
                    <div className="text-right">
                      <div className="text-3xl font-bold">{getTotalClientsByStatus('No Vigente')}</div>
                      <div className="text-xs opacity-90 mt-1">clientes</div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold mt-2">Clientes No Vigentes</div>
                  <div className="text-xs opacity-80 mt-1">Oportunidad de reactivación</div>
                </div>

                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <Users className="w-8 h-8 opacity-80" />
                    <div className="text-right">
                      <div className="text-3xl font-bold">{getTotalLeadsByStatus('Verde')}</div>
                      <div className="text-xs opacity-90 mt-1">leads</div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold mt-2">Leads Calientes</div>
                  <div className="text-xs opacity-80 mt-1">Alta prioridad</div>
                </div>

                <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <Gift className="w-8 h-8 opacity-80" />
                    <div className="text-right">
                      <div className="text-3xl font-bold">{getBirthdaysThisMonth().length}</div>
                      <div className="text-xs opacity-90 mt-1">cumpleaños</div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold mt-2">Este Mes</div>
                  <div className="text-xs opacity-80 mt-1">Automatización activa</div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-lg p-6 border-2 border-blue-200">
                <h4 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Zap className="w-6 h-6 text-blue-600" />
                  Campañas Activas
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {automatedCampaigns.filter(c => c.status === 'active').map(campaign => {
                    const audience = audiences.find(a => a.id === campaign.audience_id);
                    return (
                      <div key={campaign.id} className="bg-white rounded-lg p-4 border-2 border-gray-200">
                        <div className="flex items-start justify-between mb-2">
                          <h5 className="font-semibold text-gray-800">{campaign.name}</h5>
                          <span className={`px-2 py-1 text-xs font-bold rounded border ${getStatusBadgeColor(campaign.status)}`}>
                            {campaign.status}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mb-3">
                          <div>Tipo: {campaign.type === 'triggered' ? 'Automática' : 'Programada'}</div>
                          {audience && <div>Audiencia: {audience.name}</div>}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-blue-50 rounded p-2">
                            <div className="text-lg font-bold text-blue-600">{campaign.total_sent}</div>
                            <div className="text-xs text-gray-600">Enviados</div>
                          </div>
                          <div className="bg-green-50 rounded p-2">
                            <div className="text-lg font-bold text-green-600">{campaign.total_delivered}</div>
                            <div className="text-xs text-gray-600">Entregados</div>
                          </div>
                          <div className="bg-orange-50 rounded p-2">
                            <div className="text-lg font-bold text-orange-600">{campaign.total_responses}</div>
                            <div className="text-xs text-gray-600">Respuestas</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {automatedCampaigns.filter(c => c.status === 'active').length === 0 && (
                    <div className="col-span-2 text-center py-8 text-gray-500">
                      No hay campañas activas en este momento
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg p-6 border-2 border-yellow-200">
                <h4 className="text-lg font-semibold text-gray-700 mb-3">Funcionalidades Disponibles</h4>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <span>Segmentación precisa por estado, modelo, score y más</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <span>Plantillas personalizables con variables dinámicas</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <span>Automatización de cumpleaños con envío automático</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <span>Campañas programadas y triggered</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <span>Tracking en tiempo real de métricas de campaña</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {viewMode === 'templates' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-700">Plantillas de WhatsApp</h3>
                <button
                  onClick={() => {
                    setEditingTemplate(null);
                    setNewTemplate({ name: '', category: 'promotional', message_template: '', active: true });
                    setShowTemplateModal(true);
                  }}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Nueva Plantilla
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map(template => (
                  <div key={template.id} className="bg-white rounded-lg p-5 border-2 border-gray-200 hover:border-blue-400 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-800 mb-1">{template.name}</h4>
                        <span className={`inline-block px-2 py-1 text-xs font-bold rounded border ${getCategoryBadgeColor(template.category)}`}>
                          {template.category}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditTemplate(template)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded p-3 mt-3">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{template.message_template}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className={`text-xs font-semibold ${template.active ? 'text-green-600' : 'text-gray-400'}`}>
                        {template.active ? 'Activa' : 'Inactiva'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(template.created_at).toLocaleDateString('es-MX')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'audiences' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-700">Segmentos de Audiencia</h3>
                <button
                  onClick={() => setShowAudienceModal(true)}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Nueva Audiencia
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {audiences.map(audience => (
                  <div key={audience.id} className="bg-white rounded-lg p-5 border-2 border-gray-200">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-gray-800 mb-2">{audience.name}</h4>
                        <span className="inline-block px-2 py-1 text-xs font-bold rounded bg-blue-100 text-blue-800 border border-blue-300">
                          {audience.target_type}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600">{getAudienceSize(audience)}</div>
                        <div className="text-xs text-gray-500">contactos</div>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded p-3 mt-3">
                      <div className="text-xs font-semibold text-gray-600 mb-2">FILTROS:</div>
                      <div className="space-y-1 text-sm text-gray-700">
                        {Object.entries(audience.filters).map(([key, value]) => (
                          <div key={key} className="flex items-center gap-2">
                            <Filter className="w-3 h-3 text-gray-400" />
                            <span className="font-medium">{key}:</span>
                            <span>{typeof value === 'object' ? JSON.stringify(value) : value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'campaigns' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-700">Campañas Automatizadas</h3>
                <button
                  onClick={() => {
                    setEditingCampaign(null);
                    setNewCampaign({ name: '', type: 'scheduled', trigger_type: null, template_id: '', audience_id: '', schedule_date: '', status: 'draft' });
                    setShowCampaignModal(true);
                  }}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Nueva Campaña
                </button>
              </div>

              <div className="space-y-4">
                {automatedCampaigns.map(campaign => {
                  const template = templates.find(t => t.id === campaign.template_id);
                  const audience = audiences.find(a => a.id === campaign.audience_id);

                  return (
                    <div key={campaign.id} className="bg-white rounded-lg p-5 border-2 border-gray-200">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-800 text-lg mb-2">{campaign.name}</h4>
                          <div className="flex gap-2 flex-wrap">
                            <span className={`px-2 py-1 text-xs font-bold rounded border ${getStatusBadgeColor(campaign.status)}`}>
                              {campaign.status}
                            </span>
                            <span className="px-2 py-1 text-xs font-bold rounded bg-gray-100 text-gray-800 border border-gray-300">
                              {campaign.type === 'triggered' ? 'Automática' : 'Programada'}
                            </span>
                            {campaign.trigger_type && (
                              <span className="px-2 py-1 text-xs font-bold rounded bg-orange-100 text-orange-800 border border-orange-300">
                                Trigger: {campaign.trigger_type}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {campaign.status === 'draft' || campaign.status === 'paused' ? (
                            <button
                              onClick={() => handleToggleCampaignStatus(campaign)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="Activar"
                            >
                              <Play className="w-5 h-5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleCampaignStatus(campaign)}
                              className="p-2 text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
                              title="Pausar"
                            >
                              <Pause className="w-5 h-5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteCampaign(campaign.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {template && (
                          <div>
                            <div className="text-xs font-semibold text-gray-600 mb-1">PLANTILLA</div>
                            <div className="text-sm font-medium text-gray-800">{template.name}</div>
                          </div>
                        )}
                        {audience && (
                          <div>
                            <div className="text-xs font-semibold text-gray-600 mb-1">AUDIENCIA</div>
                            <div className="text-sm font-medium text-gray-800">{audience.name} ({getAudienceSize(audience)} contactos)</div>
                          </div>
                        )}
                        {campaign.schedule_date && (
                          <div>
                            <div className="text-xs font-semibold text-gray-600 mb-1">FECHA PROGRAMADA</div>
                            <div className="text-sm font-medium text-gray-800">
                              {new Date(campaign.schedule_date).toLocaleString('es-MX')}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-4 gap-3">
                        <div className="bg-blue-50 rounded-lg p-3 text-center">
                          <div className="text-2xl font-bold text-blue-600">{campaign.total_sent}</div>
                          <div className="text-xs text-gray-600 mt-1">Enviados</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3 text-center">
                          <div className="text-2xl font-bold text-green-600">{campaign.total_delivered}</div>
                          <div className="text-xs text-gray-600 mt-1">Entregados</div>
                        </div>
                        <div className="bg-orange-50 rounded-lg p-3 text-center">
                          <div className="text-2xl font-bold text-orange-600">{campaign.total_responses}</div>
                          <div className="text-xs text-gray-600 mt-1">Respuestas</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <div className="text-2xl font-bold text-gray-600">
                            {campaign.total_sent > 0 ? ((campaign.total_responses / campaign.total_sent) * 100).toFixed(1) : '0'}%
                          </div>
                          <div className="text-xs text-gray-600 mt-1">Tasa Respuesta</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowTemplateModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">
                {editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla de WhatsApp'}
              </h3>
              <button onClick={() => setShowTemplateModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre de la Plantilla</label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="Ej: Promoción Verano 2025"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Categoría</label>
                <select
                  value={newTemplate.category}
                  onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="promotional">Promocional</option>
                  <option value="transactional">Transaccional</option>
                  <option value="birthday">Cumpleaños</option>
                  <option value="follow-up">Seguimiento</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Mensaje</label>
                <textarea
                  value={newTemplate.message_template}
                  onChange={(e) => setNewTemplate({ ...newTemplate, message_template: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none h-32"
                  placeholder="Usa {{name}}, {{model}}, etc. para personalizar"
                />
                <div className="text-xs text-gray-500 mt-1">Variables disponibles: nombre, modelo, fecha</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newTemplate.active}
                  onChange={(e) => setNewTemplate({ ...newTemplate, active: e.target.checked })}
                  className="w-4 h-4"
                />
                <label className="text-sm font-medium text-gray-700">Plantilla activa</label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                >
                  {editingTemplate ? 'Actualizar' : 'Crear'} Plantilla
                </button>
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAudienceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowAudienceModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">Nueva Audiencia Segmentada</h3>
              <button onClick={() => setShowAudienceModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre del Segmento</label>
                <input
                  type="text"
                  value={newAudience.name}
                  onChange={(e) => setNewAudience({ ...newAudience, name: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="Ej: Leads Interesados en Deportivas"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de Audiencia</label>
                <select
                  value={newAudience.target_type}
                  onChange={(e) => setNewAudience({ ...newAudience, target_type: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="leads">Solo Leads</option>
                  <option value="clients">Solo Clientes</option>
                  <option value="mixed">Leads y Clientes</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Estado</label>
                  <select
                    value={newAudience.status_filter}
                    onChange={(e) => setNewAudience({ ...newAudience, status_filter: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Todos</option>
                    <option value="Verde">Verde</option>
                    <option value="Amarillo">Amarillo</option>
                    <option value="Rojo">Rojo</option>
                    <option value="Vigente">Vigente</option>
                    <option value="No Vigente">No Vigente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Modelo</label>
                  <input
                    type="text"
                    value={newAudience.model_filter}
                    onChange={(e) => setNewAudience({ ...newAudience, model_filter: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="MT-07, YZF-R3..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Timeframe</label>
                  <select
                    value={newAudience.timeframe_filter}
                    onChange={(e) => setNewAudience({ ...newAudience, timeframe_filter: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Todos</option>
                    <option value="Pronto">Pronto</option>
                    <option value="Inmediato">Inmediato</option>
                    <option value="Futuro">Futuro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Score Mínimo</label>
                  <input
                    type="number"
                    value={newAudience.score_min}
                    onChange={(e) => setNewAudience({ ...newAudience, score_min: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="0-100"
                    min="0"
                    max="100"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreateAudience}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                >
                  Crear Audiencia
                </button>
                <button
                  onClick={() => setShowAudienceModal(false)}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCampaignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowCampaignModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">Nueva Campaña Automatizada</h3>
              <button onClick={() => setShowCampaignModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre de la Campaña</label>
                <input
                  type="text"
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="Ej: Campaña de Verano 2025"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de Campaña</label>
                <select
                  value={newCampaign.type}
                  onChange={(e) => setNewCampaign({ ...newCampaign, type: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="scheduled">Programada</option>
                  <option value="triggered">Automática (Triggered)</option>
                </select>
              </div>
              {newCampaign.type === 'triggered' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de Trigger</label>
                  <select
                    value={newCampaign.trigger_type || ''}
                    onChange={(e) => setNewCampaign({ ...newCampaign, trigger_type: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="birthday">Cumpleaños</option>
                    <option value="inactivity">Inactividad</option>
                    <option value="status_change">Cambio de Estado</option>
                    <option value="custom">Personalizado</option>
                  </select>
                </div>
              )}
              {newCampaign.type === 'scheduled' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha y Hora</label>
                  <input
                    type="datetime-local"
                    value={newCampaign.schedule_date}
                    onChange={(e) => setNewCampaign({ ...newCampaign, schedule_date: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Plantilla</label>
                <select
                  value={newCampaign.template_id}
                  onChange={(e) => setNewCampaign({ ...newCampaign, template_id: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Seleccionar plantilla...</option>
                  {templates.filter(t => t.active).map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.category})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Audiencia</label>
                <select
                  value={newCampaign.audience_id}
                  onChange={(e) => setNewCampaign({ ...newCampaign, audience_id: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Seleccionar audiencia...</option>
                  {audiences.map(audience => (
                    <option key={audience.id} value={audience.id}>
                      {audience.name} ({getAudienceSize(audience)} contactos)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreateCampaign}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                >
                  Crear Campaña
                </button>
                <button
                  onClick={() => setShowCampaignModal(false)}
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
