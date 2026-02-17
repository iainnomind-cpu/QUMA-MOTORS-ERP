import { useState, useEffect } from 'react';
import { supabase, WhatsAppTemplate, CampaignAudience, AutomatedCampaign, Lead, Client } from '../lib/supabase';
import { useBranch } from '../contexts/BranchContext';
import { Upload, Mail, Users, TrendingUp, Send, MessageSquare, Target, Zap, Plus, X, CreditCard as Edit2, Play, Pause, Trash2, Filter, Gift, Loader2, Type, Link as LinkIcon, Phone, BarChart3, Hash, DollarSign, Bike, Clock, MapPin, Tag } from 'lucide-react';


type ViewMode = 'overview' | 'templates' | 'campaigns' | 'audiences';

const PhonePreview = ({ message, buttons, header_image }: { message: string, buttons: any[], header_image?: string | null }) => {
  const formattedMessage = message.replace(/\n/g, '<br />');

  return (
    <div className="w-[300px] h-[600px] bg-gray-900 rounded-[3rem] p-4 border-8 border-gray-800 shadow-2xl relative overflow-hidden mx-auto">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-xl z-20"></div>
      <div className="h-full bg-[#121b22] rounded-[2rem] overflow-y-auto pt-10 px-2 relative" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundRepeat: 'repeat' }}>
        <div className="bg-[#202c33] rounded-lg shadow-sm max-w-[90%] mb-2 relative overflow-hidden">
          {header_image && (
            <div className="w-full h-32 bg-gray-700">
              <img src={header_image} alt="Header" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-3">
            <p className="text-white text-sm whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{ __html: formattedMessage || 'Vista previa del mensaje...' }}></p>
            <div className="text-[10px] text-gray-400 text-right mt-1">12:00 PM</div>
          </div>
        </div>
        {buttons && buttons.map((btn, idx) => (
          <div key={idx} className="bg-[#202c33] rounded-lg p-3 shadow-sm max-w-[90%] mb-2 text-center text-[#53bdeb] font-semibold text-sm cursor-pointer hover:bg-[#2a3942]">
            {btn.type === 'PHONE_NUMBER' && <Phone className="w-4 h-4 inline mr-2" />}
            {btn.type === 'URL' && <LinkIcon className="w-4 h-4 inline mr-2" />}
            {btn.type === 'QUICK_REPLY' && <Type className="w-4 h-4 inline mr-2" />}
            {btn.text}
          </div>
        ))}
      </div>
    </div>
  );
};

const VariableInserter = ({ onInsert }: { onInsert: (val: string) => void }) => {
  return (
    <div className="flex flex-wrap gap-2 mb-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
      <span className="text-xs font-bold text-gray-500 w-full uppercase tracking-wider">Variables DinÃ¡micas</span>
      {[
        { label: 'Nombre Cliente', val: '{{nombre}}' },
        { label: 'Modelo Moto', val: '{{modelo}}' },
        { label: 'Precio', val: '{{precio}}' },
        { label: 'Asesor', val: '{{asesor}}' },
      ].map((v) => (
        <button
          key={v.val}
          onClick={() => onInsert(v.val)}
          className="text-xs bg-white border border-gray-300 hover:border-blue-500 hover:text-blue-600 px-2 py-1 rounded-md transition-colors font-medium flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          {v.label}
        </button>
      ))}
    </div>
  );
};


export function MarketingAutomation() {
  const { selectedBranchId } = useBranch();
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [audiences, setAudiences] = useState<CampaignAudience[]>([]);
  const [automatedCampaigns, setAutomatedCampaigns] = useState<AutomatedCampaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [catalogModels, setCatalogModels] = useState<string[]>([]);
  const [financingTypes, setFinancingTypes] = useState<string[]>([]);


  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showAudienceModal, setShowAudienceModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);


  const [newTemplate, setNewTemplate] = useState<{
    name: string;
    category: string;
    message_template: string;
    header_type: 'NONE' | 'IMAGE';
    header_image: string | null;
    buttons: any[];
    active: boolean;
  }>({
    name: '',
    category: 'promotional',
    message_template: '',
    header_type: 'NONE',
    header_image: null,
    buttons: [],
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
    score_min: '',
    origin_filter: '',
    financing_type_filter: '',
    requires_financing_filter: '',
    test_drive_filter: '',
    purchase_type_filter: '',
    price_min: '',
    price_max: '',
    birthday_month_filter: '',
    last_purchase_days: '',
  });

  useEffect(() => {
    loadAllData();
  }, [selectedBranchId]);

  const loadAllData = async () => {
    await Promise.all([
      loadTemplates(),
      loadAudiences(),
      loadAutomatedCampaigns(),
      loadLeads(),
      loadClients(),
      loadCatalogModels(),
      loadFinancingTypes()
    ]);
  };

  const loadCatalogModels = async () => {
    const { data } = await supabase
      .from('catalog')
      .select('model')
      .eq('active', true)
      .order('model');
    if (data) setCatalogModels(data.map((d: any) => d.model));
  };

  const loadFinancingTypes = async () => {
    const { data } = await supabase
      .from('financing_rules')
      .select('financing_type, description, interest_rate, min_term_months, max_term_months')
      .eq('active', true)
      .order('financing_type');
    if (data) {
      const unique = [...new Set(data.map((d: any) => d.financing_type))];
      setFinancingTypes(unique);
    }
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
    let query = supabase
      .from('leads')
      .select('*');

    if (selectedBranchId) {
      query = query.eq('branch_id', selectedBranchId);
    }

    const { data } = await query.order('score', { ascending: false });
    if (data) setLeads(data);
  };

  const loadClients = async () => {
    let query = supabase
      .from('clients')
      .select('*');

    if (selectedBranchId) {
      query = query.eq('branch_id', selectedBranchId);
    }

    const { data } = await query.order('created_at', { ascending: false });
    if (data) setClients(data);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no debe superar los 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setNewTemplate({ ...newTemplate, header_image: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleCreateTemplate = async () => {
    try {
      setIsSubmitting(true);
      setSuccessMessage('Creando plantilla en Meta y base de datos...');
      setShowSuccess(true);

      // Use the new API endpoint for sync
      const response = await fetch('/api/marketing?action=create_template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al crear plantilla');
      }

      setSuccessMessage('Plantilla creada y enviada a revisiÃ³n en WhatsApp');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      setShowTemplateModal(false);
      setNewTemplate({ name: '', category: 'promotional', message_template: '', header_type: 'NONE', header_image: null, buttons: [], active: true });
      loadTemplates();

    } catch (error: any) {
      console.error('Error creating template:', error);
      alert(`Error al crear plantilla: ${error.message}`);
      setShowSuccess(false);
    } finally {
      setIsSubmitting(false);
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
      setNewTemplate({ name: '', category: 'promotional', message_template: '', header_type: 'NONE', header_image: null, buttons: [], active: true });
      loadTemplates();
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Â¿EstÃ¡s seguro de eliminar esta plantilla?')) return;

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
    if (newAudience.origin_filter) filters.origin = newAudience.origin_filter;
    if (newAudience.financing_type_filter) filters.financing_type = newAudience.financing_type_filter;
    if (newAudience.requires_financing_filter) filters.requires_financing = newAudience.requires_financing_filter === 'true';
    if (newAudience.test_drive_filter) filters.test_drive = newAudience.test_drive_filter;
    if (newAudience.purchase_type_filter) filters.purchase_type = newAudience.purchase_type_filter;
    if (newAudience.price_min) filters.price_min = parseFloat(newAudience.price_min);
    if (newAudience.price_max) filters.price_max = parseFloat(newAudience.price_max);
    if (newAudience.birthday_month_filter) filters.birthday_month = newAudience.birthday_month_filter;
    if (newAudience.last_purchase_days) filters.last_purchase_days = parseInt(newAudience.last_purchase_days);

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
      setNewAudience({ name: '', target_type: 'leads', status_filter: '', model_filter: '', timeframe_filter: '', score_min: '', origin_filter: '', financing_type_filter: '', requires_financing_filter: '', test_drive_filter: '', purchase_type_filter: '', price_min: '', price_max: '', birthday_month_filter: '', last_purchase_days: '' });
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
      // datetime-local gives "2026-02-12T22:54" (local time without tz)
      // Convert to ISO string which includes proper UTC offset
      campaignData.schedule_date = new Date(newCampaign.schedule_date).toISOString();
    }

    const { error } = await supabase
      .from('automated_campaigns')
      .insert([campaignData]);

    if (!error) {
      setSuccessMessage('CampaÃ±a creada exitosamente');
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
      setSuccessMessage(`CampaÃ±a ${newStatus === 'active' ? 'activada' : 'pausada'}`);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      loadAutomatedCampaigns();
    }
  };

  const handleSendCampaign = async (campaign: AutomatedCampaign) => {
    if (!confirm(`Â¿EstÃ¡s seguro de enviar la campaÃ±a "${campaign.name}" ahora? Esto enviarÃ¡ mensajes a todos los contactos de la audiencia.`)) return;

    try {
      setSuccessMessage('Iniciando envÃ­o de campaÃ±a...');
      setShowSuccess(true);

      const response = await fetch('/api/marketing?action=send_campaign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ campaign_id: campaign.id }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage(`CampaÃ±a enviada: ${data.sent} mensajes. ${data.errors > 0 ? `Errores: ${data.errors}` : ''}`);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 5000);
        loadAutomatedCampaigns();
      } else {
        throw new Error(data.error || 'Error al enviar campaÃ±a');
      }
    } catch (error: any) {
      console.error('Error sending campaign:', error);
      alert(`Error al enviar: ${error.message}`);
      setShowSuccess(false);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('Â¿EstÃ¡s seguro de eliminar esta campaÃ±a?')) return;

    const { error } = await supabase
      .from('automated_campaigns')
      .delete()
      .eq('id', id);

    if (!error) {
      setSuccessMessage('CampaÃ±a eliminada');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      loadAutomatedCampaigns();
    }
  };

  const handleDeleteAudience = async (id: string) => {
    // Check if audience is used in any campaign
    const isUsed = automatedCampaigns.some(c => c.audience_id === id);
    if (isUsed) {
      alert('No se puede eliminar esta audiencia porque estÃ¡ siendo utilizada en una o mÃ¡s campaÃ±as. Elimina o modifica las campaÃ±as primero.');
      return;
    }

    if (!confirm('Â¿EstÃ¡s seguro de eliminar esta audiencia?')) return;

    const { error } = await supabase
      .from('campaign_audiences')
      .delete()
      .eq('id', id);

    if (!error) {
      setSuccessMessage('Audiencia eliminada correctamente');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      loadAudiences();
    } else {
      console.error('Error deleting audience:', error);
      alert('Error al eliminar audiencia: ' + error.message);
    }
  };

  const getAudienceSize = (audience: CampaignAudience): number => {
    let count = 0;
    const filters = audience.filters;

    if (filters.birthday_month === 'current') {
      const currentMonth = new Date().getMonth();
      const pool = audience.target_type === 'leads' ? leads : audience.target_type === 'clients' ? clients : [...leads, ...clients];
      return pool.filter(p => {
        if (!p.birthday) return false;
        return new Date(p.birthday).getMonth() === currentMonth;
      }).length;
    }
    if (filters.birthday_month && filters.birthday_month !== 'current') {
      const targetMonth = parseInt(filters.birthday_month);
      const pool = audience.target_type === 'leads' ? leads : audience.target_type === 'clients' ? clients : [...leads, ...clients];
      return pool.filter(p => {
        if (!p.birthday) return false;
        return new Date(p.birthday).getMonth() === targetMonth;
      }).length;
    }

    if (audience.target_type === 'leads' || audience.target_type === 'mixed') {
      const filteredLeads = leads.filter(lead => {
        if (filters.status && lead.status !== filters.status) return false;
        if (filters.model_interested && lead.model_interested !== filters.model_interested) return false;
        if (filters.timeframe && lead.timeframe !== filters.timeframe) return false;
        if (filters.score_min && lead.score < filters.score_min) return false;
        if (filters.origin && lead.origin !== filters.origin) return false;
        if (filters.financing_type && lead.financing_type !== filters.financing_type) return false;
        if (filters.requires_financing !== undefined && lead.requires_financing !== filters.requires_financing) return false;
        if (filters.test_drive === 'requested' && !lead.test_drive_requested) return false;
        if (filters.test_drive === 'completed' && !lead.test_drive_completed) return false;
        if (filters.test_drive === 'not_requested' && lead.test_drive_requested) return false;
        return true;
      });
      count += filteredLeads.length;
    }

    if (audience.target_type === 'clients' || audience.target_type === 'mixed') {
      const filteredClients = clients.filter(client => {
        if (filters.status && client.status !== filters.status) return false;
        if (filters.model_interested && client.purchased_model !== filters.model_interested) return false;
        if (filters.purchase_type && client.purchase_type !== filters.purchase_type) return false;
        if (filters.price_min && (client.purchase_price || 0) < filters.price_min) return false;
        if (filters.price_max && (client.purchase_price || 0) > filters.price_max) return false;
        if (filters.last_purchase_days && client.last_purchase_date) {
          const daysSince = Math.floor((Date.now() - new Date(client.last_purchase_date).getTime()) / (1000 * 60 * 60 * 24));
          if (daysSince > filters.last_purchase_days) return false;
        }
        return true;
      });
      count += filteredClients.length;
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
      active: template.active,
      header_type: 'NONE',
      header_image: null,
      buttons: []
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
          Marketing Automation & CampaÃ±as
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
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${viewMode === 'overview'
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
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${viewMode === 'templates'
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
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${viewMode === 'audiences'
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
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${viewMode === 'campaigns'
              ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
              : 'text-gray-600 hover:bg-gray-50'
              }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Send className="w-5 h-5" />
              CampaÃ±as ({automatedCampaigns.length})
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
                  <div className="text-xs opacity-80 mt-1">Base activa para campaÃ±as</div>
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
                  <div className="text-xs opacity-80 mt-1">Oportunidad de reactivaciÃ³n</div>
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
                      <div className="text-xs opacity-90 mt-1">cumpleaÃ±os</div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold mt-2">Este Mes</div>
                  <div className="text-xs opacity-80 mt-1">AutomatizaciÃ³n activa</div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-lg p-6 border-2 border-blue-200">
                <h4 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Zap className="w-6 h-6 text-blue-600" />
                  CampaÃ±as Activas
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
                          <div>Tipo: {campaign.type === 'triggered' ? 'AutomÃ¡tica' : 'Programada'}</div>
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
                      No hay campaÃ±as activas en este momento
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg p-6 border-2 border-yellow-200">
                <h4 className="text-lg font-semibold text-gray-700 mb-3">Funcionalidades Disponibles</h4>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">âœ“</span>
                    <span>SegmentaciÃ³n precisa por estado, modelo, score y mÃ¡s</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">âœ“</span>
                    <span>Plantillas personalizables con variables dinÃ¡micas</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">âœ“</span>
                    <span>AutomatizaciÃ³n de cumpleaÃ±os con envÃ­o automÃ¡tico</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">âœ“</span>
                    <span>CampaÃ±as programadas y triggered</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">âœ“</span>
                    <span>Tracking en tiempo real de mÃ©tricas de campaÃ±a</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {viewMode === 'templates' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-700">Plantillas de WhatsApp</h3>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        setSuccessMessage('Sincronizando estados con Meta...');
                        setShowSuccess(true);
                        const res = await fetch('/api/marketing?action=sync_templates', { method: 'POST' });
                        const data = await res.json();
                        if (res.ok) {
                          setSuccessMessage(`Sincronizado: ${data.updated} actualizados.`);
                          loadTemplates();
                        } else {
                          throw new Error(data.error);
                        }
                      } catch (e: any) {
                        alert('Error al sincronizar: ' + e.message);
                      } finally {
                        setTimeout(() => setShowSuccess(false), 3000);
                      }
                    }}
                    className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold transition-all border border-gray-300"
                  >
                    <Zap className="w-4 h-4" />
                    Sincronizar Estados
                  </button>
                  <button
                    onClick={() => {
                      setEditingTemplate(null);
                      setNewTemplate({ name: '', category: 'promotional', message_template: '', header_type: 'NONE', header_image: null, buttons: [], active: true });
                      setShowTemplateModal(true);
                    }}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    Nueva Plantilla
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map(template => (
                  <div key={template.id} className="bg-white rounded-lg p-5 border-2 border-gray-200 hover:border-blue-400 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-gray-800">{template.name}</h4>
                          {template.status && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ${template.status === 'APPROVED' ? 'bg-green-100 text-green-700 border-green-300' :
                              template.status === 'REJECTED' ? 'bg-red-100 text-red-700 border-red-300' :
                                'bg-yellow-100 text-yellow-700 border-yellow-300'
                              }`}>
                              {template.status}
                            </span>
                          )}
                        </div>
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
                  <div key={audience.id} className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-gray-800 mb-2">{audience.name}</h4>
                        <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-full ${audience.target_type === 'leads' ? 'bg-blue-100 text-blue-700' : audience.target_type === 'clients' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                          {audience.target_type === 'leads' ? 'ðŸŽ¯ Leads' : audience.target_type === 'clients' ? 'ðŸ‘¥ Clientes' : 'ðŸ”„ Mixto'}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-3 justify-end">
                          <div className="text-3xl font-black text-blue-600">{getAudienceSize(audience)}</div>
                          <button
                            onClick={() => handleDeleteAudience(audience.id)}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                            title="Eliminar Audiencia"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="text-xs text-gray-500 font-medium">contactos</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {Object.entries(audience.filters).map(([key, value]) => {
                        const filterLabels: Record<string, string> = {
                          status: 'Estado', model_interested: 'Modelo', timeframe: 'Tiempo', score_min: 'Score â‰¥', origin: 'Origen', financing_type: 'Financiamiento', requires_financing: 'Req. Financ.', test_drive: 'Test Drive', purchase_type: 'Tipo Compra', price_min: 'Precio â‰¥', price_max: 'Precio â‰¤', birthday_month: 'CumpleaÃ±os', last_purchase_days: 'Recencia'
                        };
                        const displayVal = key === 'requires_financing' ? (value ? 'SÃ­' : 'No') : key === 'birthday_month' ? (value === 'current' ? 'Este Mes' : ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][parseInt(value as string)]) : key === 'last_purchase_days' ? `${value} dÃ­as` : key === 'price_min' || key === 'price_max' ? `$${Number(value).toLocaleString()}` : String(value);
                        return (
                          <span key={key} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                            <Filter className="w-3 h-3 text-gray-400" />
                            {filterLabels[key] || key}: {displayVal}
                          </span>
                        );
                      })}
                      {Object.keys(audience.filters).length === 0 && (
                        <span className="text-xs text-gray-400 italic">Sin filtros â€” todos los contactos</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'campaigns' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-700">CampaÃ±as Automatizadas</h3>
                <button
                  onClick={() => {

                    setNewCampaign({ name: '', type: 'scheduled', trigger_type: null, template_id: '', audience_id: '', schedule_date: '', status: 'draft' });
                    setShowCampaignModal(true);
                  }}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Nueva CampaÃ±a
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
                              {campaign.type === 'triggered' ? 'AutomÃ¡tica' : 'Programada'}
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
                            onClick={() => handleSendCampaign(campaign)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Enviar Ahora (Manual)"
                          >
                            <Send className="w-5 h-5" />
                          </button>
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
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-all" onClick={() => setShowTemplateModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full h-[90vh] flex overflow-hidden border border-gray-100" onClick={(e) => e.stopPropagation()}>
            <div className="w-1/2 flex flex-col h-full border-r border-gray-100 bg-white">
              <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white z-10">
                <h3 className="text-2xl font-bold text-gray-900 tracking-tight">
                  {editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla'}
                </h3>
                <button onClick={() => setShowTemplateModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre de la Plantilla</label>
                  <input
                    type="text"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-gray-400"
                    placeholder="Ej: Oferta_Febrero_2025"
                  />
                  <p className="text-xs text-gray-500 mt-1">Solo letras minÃºsculas, nÃºmeros y guiones bajos.</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">CategorÃ­a</label>
                  <select
                    value={newTemplate.category}
                    onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white"
                  >
                    <option value="promotional">Promocional</option>
                    <option value="transactional">Transaccional</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de Encabezado</label>
                  <select
                    value={newTemplate.header_type}
                    onChange={(e) => setNewTemplate({ ...newTemplate, header_type: e.target.value as 'NONE' | 'IMAGE', header_image: null })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white mb-3"
                  >
                    <option value="NONE">Sin Encabezado</option>
                    <option value="IMAGE">Imagen</option>
                  </select>

                  {newTemplate.header_type === 'IMAGE' && (
                    <div className="mb-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Imagen de Ejemplo (para revisión)</label>
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="w-8 h-8 mb-3 text-gray-400" />
                            <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click para subir</span> o arrastra</p>
                            <p className="text-xs text-gray-500">PNG, JPG (MAX. 5MB)</p>
                          </div>
                          <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                        </label>
                      </div>
                      {newTemplate.header_image && (
                        <div className="mt-2 relative w-full h-40 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                          <img src={newTemplate.header_image} alt="Preview" className="w-full h-full object-cover" />
                          <button
                            onClick={() => setNewTemplate({ ...newTemplate, header_image: null })}
                            className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Mensaje del Cuerpo</label>
                  <VariableInserter onInsert={(val) => setNewTemplate({ ...newTemplate, message_template: newTemplate.message_template + ' ' + val })} />
                  <textarea
                    value={newTemplate.message_template}
                    onChange={(e) => setNewTemplate({ ...newTemplate, message_template: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none h-40 resize-none transition-all"
                    placeholder="Escribe tu mensaje aquÃ­..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Botones (Opcional)</label>
                  <div className="space-y-2">
                    {newTemplate.buttons?.map((btn, idx) => (
                      <div key={idx} className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-200">
                        <span className="text-xs font-bold text-gray-500 w-16">{btn.type === 'QUICK_REPLY' ? 'Respuesta' : btn.type === 'URL' ? 'Enlace' : 'TelÃ©fono'}</span>
                        <input
                          type="text"
                          value={btn.text}
                          onChange={(e) => {
                            const newButtons = [...newTemplate.buttons];
                            newButtons[idx].text = e.target.value;
                            setNewTemplate({ ...newTemplate, buttons: newButtons });
                          }}
                          className="flex-1 text-sm bg-white border border-gray-200 rounded px-2 py-1"
                          placeholder="Texto del botÃ³n"
                        />
                        {btn.type !== 'QUICK_REPLY' && (
                          <input
                            type="text"
                            value={btn.value}
                            onChange={(e) => {
                              const newButtons = [...newTemplate.buttons];
                              newButtons[idx].value = e.target.value;
                              setNewTemplate({ ...newTemplate, buttons: newButtons });
                            }}
                            className="flex-1 text-sm bg-white border border-gray-200 rounded px-2 py-1"
                            placeholder={btn.type === 'URL' ? 'https://...' : '+52...'}
                          />
                        )}
                        <button onClick={() => {
                          const newButtons = newTemplate.buttons.filter((_, i) => i !== idx);
                          setNewTemplate({ ...newTemplate, buttons: newButtons });
                        }} className="text-red-500 hover:bg-red-50 p-1 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {(!newTemplate.buttons || newTemplate.buttons.length < 3) && (
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => setNewTemplate({ ...newTemplate, buttons: [...(newTemplate.buttons || []), { type: 'QUICK_REPLY', text: '' }] })} className="text-xs flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition-colors text-gray-700 font-medium">
                          <Plus className="w-3 h-3" /> Respuesta RÃ¡pida
                        </button>
                        <button onClick={() => setNewTemplate({ ...newTemplate, buttons: [...(newTemplate.buttons || []), { type: 'URL', text: '', value: '' }] })} className="text-xs flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition-colors text-gray-700 font-medium">
                          <Plus className="w-3 h-3" /> Enlace
                        </button>
                        <button onClick={() => setNewTemplate({ ...newTemplate, buttons: [...(newTemplate.buttons || []), { type: 'PHONE_NUMBER', text: '', value: '' }] })} className="text-xs flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition-colors text-gray-700 font-medium">
                          <Plus className="w-3 h-3" /> Teléfono
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
                <button
                  onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
                  disabled={isSubmitting}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-white shadow-lg shadow-blue-500/30 transition-all ${isSubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:translate-y-[-1px]'
                    }`}
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  {editingTemplate ? 'Actualizar Plantilla' : 'Enviar a Revisión'}
                </button>
              </div>
            </div>

            <div className="w-1/2 bg-gray-50 flex items-center justify-center relative pattern-dots p-8 border-l border-gray-200">
              <div className="absolute inset-0 opacity-[0.03] pattern-grid-lg pointer-events-none"></div>
              <div className="scale-[0.85] transform origin-center">
                <PhonePreview message={newTemplate.message_template} buttons={newTemplate.buttons} header_image={newTemplate.header_image} />
              </div>
              <div className="absolute bottom-6 text-center w-full text-xs text-gray-400">
                Vista previa aproximada. El aspecto real puede variar según el dispositivo.
              </div>
            </div>
          </div>
        </div>
      )}

      {showAudienceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowAudienceModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full h-[92vh] flex overflow-hidden border border-gray-100" onClick={(e) => e.stopPropagation()}>
            {/* LEFT: Segmentation Builder */}
            <div className="w-2/3 flex flex-col h-full">
              <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-white">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 tracking-tight">Constructor de Audiencia</h3>
                  <p className="text-xs text-gray-500 mt-1">Segmenta tu base de datos con precisiÃ³n quirÃºrgica</p>
                </div>
                <button onClick={() => setShowAudienceModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* NAME + TYPE */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">Nombre del Segmento</label>
                    <input type="text" value={newAudience.name} onChange={(e) => setNewAudience({ ...newAudience, name: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm" placeholder="Ej: Leads Calientes Deportivas" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">Tipo de Audiencia</label>
                    <select value={newAudience.target_type} onChange={(e) => setNewAudience({ ...newAudience, target_type: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm bg-white">
                      <option value="leads">ðŸŽ¯ Solo Leads</option>
                      <option value="clients">ðŸ‘¥ Solo Clientes</option>
                      <option value="mixed">ðŸ”„ Leads y Clientes</option>
                    </select>
                  </div>
                </div>

                {/* SECTION: Lead Behavior */}
                {(newAudience.target_type === 'leads' || newAudience.target_type === 'mixed') && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                    <h4 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Comportamiento del Lead</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Temperatura</label>
                        <select value={newAudience.status_filter} onChange={(e) => setNewAudience({ ...newAudience, status_filter: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                          <option value="">Todos</option>
                          <option value="Verde">ðŸŸ¢ Verde (Caliente)</option>
                          <option value="Amarillo">ðŸŸ¡ Amarillo (Tibio)</option>
                          <option value="Rojo">ðŸ”´ Rojo (FrÃ­o)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Origen</label>
                        <select value={newAudience.origin_filter} onChange={(e) => setNewAudience({ ...newAudience, origin_filter: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                          <option value="">Todos</option>
                          <option value="Facebook">Facebook</option>
                          <option value="Instagram">Instagram</option>
                          <option value="WhatsApp">WhatsApp</option>
                          <option value="Showroom">Showroom</option>
                          <option value="Referido">Referido</option>
                          <option value="Web">Web</option>
                          <option value="TelÃ©fono">TelÃ©fono</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Score MÃ­nimo</label>
                        <input type="number" value={newAudience.score_min} onChange={(e) => setNewAudience({ ...newAudience, score_min: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0-100" min="0" max="100" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Timeframe</label>
                        <select value={newAudience.timeframe_filter} onChange={(e) => setNewAudience({ ...newAudience, timeframe_filter: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                          <option value="">Todos</option>
                          <option value="Inmediato">âš¡ Inmediato</option>
                          <option value="Pronto">ðŸ”œ Pronto</option>
                          <option value="Futuro">ðŸ“… Futuro</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Test Drive</label>
                        <select value={newAudience.test_drive_filter} onChange={(e) => setNewAudience({ ...newAudience, test_drive_filter: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                          <option value="">Todos</option>
                          <option value="requested">Solicitado</option>
                          <option value="completed">Completado</option>
                          <option value="not_requested">No Solicitado</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* SECTION: Financing */}
                {(newAudience.target_type === 'leads' || newAudience.target_type === 'mixed') && (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                    <h4 className="text-sm font-bold text-green-800 mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Financiamiento</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Requiere Financiamiento</label>
                        <select value={newAudience.requires_financing_filter} onChange={(e) => setNewAudience({ ...newAudience, requires_financing_filter: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500 outline-none">
                          <option value="">Todos</option>
                          <option value="true">SÃ­, requiere</option>
                          <option value="false">No, pago de contado</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de Financiamiento</label>
                        <select value={newAudience.financing_type_filter} onChange={(e) => setNewAudience({ ...newAudience, financing_type_filter: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500 outline-none">
                          <option value="">Todos</option>
                          {financingTypes.map(ft => <option key={ft} value={ft}>{ft}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* SECTION: Product */}
                <div className="bg-gradient-to-r from-purple-50 to-fuchsia-50 rounded-xl p-4 border border-purple-100">
                  <h4 className="text-sm font-bold text-purple-800 mb-3 flex items-center gap-2"><Bike className="w-4 h-4" /> Producto / Modelo</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">{newAudience.target_type === 'clients' ? 'Modelo Comprado' : 'Modelo de InterÃ©s'}</label>
                      <select value={newAudience.model_filter} onChange={(e) => setNewAudience({ ...newAudience, model_filter: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-500 outline-none">
                        <option value="">Todos los modelos</option>
                        {catalogModels.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Precio MÃ­n ($)</label>
                      <input type="number" value={newAudience.price_min} onChange={(e) => setNewAudience({ ...newAudience, price_min: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-500 outline-none" placeholder="50,000" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Precio MÃ¡x ($)</label>
                      <input type="number" value={newAudience.price_max} onChange={(e) => setNewAudience({ ...newAudience, price_max: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-500 outline-none" placeholder="300,000" />
                    </div>
                  </div>
                </div>

                {/* SECTION: Client History */}
                {(newAudience.target_type === 'clients' || newAudience.target_type === 'mixed') && (
                  <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-100">
                    <h4 className="text-sm font-bold text-orange-800 mb-3 flex items-center gap-2"><Clock className="w-4 h-4" /> Historial de Compra</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Estado de Cliente</label>
                        <select value={newAudience.target_type === 'clients' ? newAudience.status_filter : ''} onChange={(e) => setNewAudience({ ...newAudience, status_filter: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 outline-none">
                          <option value="">Todos</option>
                          <option value="Vigente">Vigente</option>
                          <option value="No Vigente">No Vigente</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de Compra</label>
                        <select value={newAudience.purchase_type_filter} onChange={(e) => setNewAudience({ ...newAudience, purchase_type_filter: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 outline-none">
                          <option value="">Todos</option>
                          <option value="Contado">Contado</option>
                          <option value="CrÃ©dito">CrÃ©dito</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">ComprÃ³ en los Ãºltimos...</label>
                        <select value={newAudience.last_purchase_days} onChange={(e) => setNewAudience({ ...newAudience, last_purchase_days: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 outline-none">
                          <option value="">Sin filtro de recencia</option>
                          <option value="30">Ãšltimos 30 dÃ­as</option>
                          <option value="60">Ãšltimos 60 dÃ­as</option>
                          <option value="90">Ãšltimos 90 dÃ­as</option>
                          <option value="180">Ãšltimos 6 meses</option>
                          <option value="365">Ãšltimo aÃ±o</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* SECTION: Birthday */}
                <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-4 border border-pink-100">
                  <h4 className="text-sm font-bold text-pink-800 mb-3 flex items-center gap-2"><Gift className="w-4 h-4" /> CumpleaÃ±os</h4>
                  <select value={newAudience.birthday_month_filter} onChange={(e) => setNewAudience({ ...newAudience, birthday_month_filter: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-pink-500 outline-none">
                    <option value="">Sin filtro de cumpleaÃ±os</option>
                    <option value="current">ðŸŽ‚ Este mes</option>
                    <option value="0">Enero</option>
                    <option value="1">Febrero</option>
                    <option value="2">Marzo</option>
                    <option value="3">Abril</option>
                    <option value="4">Mayo</option>
                    <option value="5">Junio</option>
                    <option value="6">Julio</option>
                    <option value="7">Agosto</option>
                    <option value="8">Septiembre</option>
                    <option value="9">Octubre</option>
                    <option value="10">Noviembre</option>
                    <option value="11">Diciembre</option>
                  </select>
                </div>
              </div>

              {/* FOOTER: Create Button */}
              <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-3">
                <button onClick={handleCreateAudience} className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all hover:translate-y-[-1px]">
                  <Target className="w-5 h-5" />
                  Crear Audiencia
                </button>
              </div>
            </div>

            {/* RIGHT: Live Preview */}
            <div className="w-1/3 bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col border-l border-gray-200">
              <div className="px-6 py-5 border-b border-gray-200">
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Vista Previa en Vivo</h4>
              </div>
              <div className="flex-1 p-6 flex flex-col items-center justify-center">
                <div className="w-36 h-36 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4 shadow-xl shadow-blue-500/20">
                  <span className="text-5xl font-black text-white">
                    {getAudienceSize({ id: '', name: '', target_type: newAudience.target_type, filters: (() => { const f: Record<string, any> = {}; if (newAudience.status_filter) f.status = newAudience.status_filter; if (newAudience.model_filter) f.model_interested = newAudience.model_filter; if (newAudience.timeframe_filter) f.timeframe = newAudience.timeframe_filter; if (newAudience.score_min) f.score_min = parseInt(newAudience.score_min); if (newAudience.origin_filter) f.origin = newAudience.origin_filter; if (newAudience.financing_type_filter) f.financing_type = newAudience.financing_type_filter; if (newAudience.requires_financing_filter) f.requires_financing = newAudience.requires_financing_filter === 'true'; if (newAudience.test_drive_filter) f.test_drive = newAudience.test_drive_filter; if (newAudience.purchase_type_filter) f.purchase_type = newAudience.purchase_type_filter; if (newAudience.price_min) f.price_min = parseFloat(newAudience.price_min); if (newAudience.price_max) f.price_max = parseFloat(newAudience.price_max); if (newAudience.birthday_month_filter) f.birthday_month = newAudience.birthday_month_filter; if (newAudience.last_purchase_days) f.last_purchase_days = parseInt(newAudience.last_purchase_days); return f; })(), created_at: '' })}
                  </span>
                </div>
                <p className="text-lg font-bold text-gray-800">Contactos</p>
                <p className="text-xs text-gray-500 mt-1">coinciden con tus filtros</p>

                {/* Active Filters Summary */}
                <div className="mt-6 w-full space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Filtros Activos</p>
                  {newAudience.status_filter && <div className="text-xs bg-white rounded-lg px-3 py-2 border border-gray-200 flex items-center gap-2"><Tag className="w-3 h-3 text-blue-500" /> Estado: <strong>{newAudience.status_filter}</strong></div>}
                  {newAudience.model_filter && <div className="text-xs bg-white rounded-lg px-3 py-2 border border-gray-200 flex items-center gap-2"><Bike className="w-3 h-3 text-purple-500" /> Modelo: <strong>{newAudience.model_filter}</strong></div>}
                  {newAudience.origin_filter && <div className="text-xs bg-white rounded-lg px-3 py-2 border border-gray-200 flex items-center gap-2"><MapPin className="w-3 h-3 text-green-500" /> Origen: <strong>{newAudience.origin_filter}</strong></div>}
                  {newAudience.score_min && <div className="text-xs bg-white rounded-lg px-3 py-2 border border-gray-200 flex items-center gap-2"><Hash className="w-3 h-3 text-orange-500" /> Score â‰¥ <strong>{newAudience.score_min}</strong></div>}
                  {newAudience.timeframe_filter && <div className="text-xs bg-white rounded-lg px-3 py-2 border border-gray-200 flex items-center gap-2"><Clock className="w-3 h-3 text-indigo-500" /> Timeframe: <strong>{newAudience.timeframe_filter}</strong></div>}
                  {newAudience.financing_type_filter && <div className="text-xs bg-white rounded-lg px-3 py-2 border border-gray-200 flex items-center gap-2"><DollarSign className="w-3 h-3 text-green-500" /> Financiamiento: <strong>{newAudience.financing_type_filter}</strong></div>}
                  {newAudience.requires_financing_filter && <div className="text-xs bg-white rounded-lg px-3 py-2 border border-gray-200 flex items-center gap-2"><DollarSign className="w-3 h-3 text-green-500" /> Req. Financiamiento: <strong>{newAudience.requires_financing_filter === 'true' ? 'SÃ­' : 'No'}</strong></div>}
                  {newAudience.test_drive_filter && <div className="text-xs bg-white rounded-lg px-3 py-2 border border-gray-200 flex items-center gap-2"><Bike className="w-3 h-3 text-blue-500" /> Test Drive: <strong>{newAudience.test_drive_filter === 'requested' ? 'Solicitado' : newAudience.test_drive_filter === 'completed' ? 'Completado' : 'No Solicitado'}</strong></div>}
                  {newAudience.purchase_type_filter && <div className="text-xs bg-white rounded-lg px-3 py-2 border border-gray-200 flex items-center gap-2"><Tag className="w-3 h-3 text-orange-500" /> Tipo Compra: <strong>{newAudience.purchase_type_filter}</strong></div>}
                  {(newAudience.price_min || newAudience.price_max) && <div className="text-xs bg-white rounded-lg px-3 py-2 border border-gray-200 flex items-center gap-2"><DollarSign className="w-3 h-3 text-green-500" /> Precio: <strong>${newAudience.price_min || '0'} - ${newAudience.price_max || 'âˆž'}</strong></div>}
                  {newAudience.birthday_month_filter && <div className="text-xs bg-white rounded-lg px-3 py-2 border border-gray-200 flex items-center gap-2"><Gift className="w-3 h-3 text-pink-500" /> CumpleaÃ±os: <strong>{newAudience.birthday_month_filter === 'current' ? 'Este Mes' : ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][parseInt(newAudience.birthday_month_filter)]}</strong></div>}
                  {newAudience.last_purchase_days && <div className="text-xs bg-white rounded-lg px-3 py-2 border border-gray-200 flex items-center gap-2"><Clock className="w-3 h-3 text-orange-500" /> Recencia: <strong>Ãšltimos {newAudience.last_purchase_days} dÃ­as</strong></div>}
                  {!newAudience.status_filter && !newAudience.model_filter && !newAudience.origin_filter && !newAudience.score_min && !newAudience.timeframe_filter && !newAudience.financing_type_filter && !newAudience.requires_financing_filter && !newAudience.test_drive_filter && !newAudience.purchase_type_filter && !newAudience.price_min && !newAudience.price_max && !newAudience.birthday_month_filter && !newAudience.last_purchase_days && (
                    <div className="text-xs text-gray-400 text-center py-4">Sin filtros â€” se incluyen todos los contactos del tipo seleccionado</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCampaignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowCampaignModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">Nueva CampaÃ±a Automatizada</h3>
              <button onClick={() => setShowCampaignModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre de la CampaÃ±a</label>
                <input
                  type="text"
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="Ej: CampaÃ±a de Verano 2025"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de CampaÃ±a</label>
                <select
                  value={newCampaign.type}
                  onChange={(e) => setNewCampaign({ ...newCampaign, type: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="scheduled">Programada</option>
                  <option value="triggered">AutomÃ¡tica (Triggered)</option>
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
                    <option value="birthday">CumpleaÃ±os</option>
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
                  Crear CampaÃ±a
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
