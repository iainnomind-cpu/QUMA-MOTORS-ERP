import { useState, useEffect } from 'react';
import { supabase, Lead, Client, SalesAgent, LeadInteraction, LeadFollowUp, LeadAttachment } from '../lib/supabase';
import { useBranch } from '../contexts/BranchContext';
import { LeadScoringEngine } from '../lib/scoringEngine';
import {
  Trello, Phone, Mail, Calendar, Star, TrendingUp, X, User, DollarSign, Clock, Building,
  History, Upload, Eye, Trash2, FileText, Image as ImageIcon, Plus, Edit2, CheckCircle, UserCheck
} from 'lucide-react';

export function PipelineKanban() {
  const { selectedBranchId } = useBranch();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [agents, setAgents] = useState<SalesAgent[]>([]);
  const [interactions, setInteractions] = useState<LeadInteraction[]>([]);
  const [followUps, setFollowUps] = useState<LeadFollowUp[]>([]);
  const [attachments, setAttachments] = useState<LeadAttachment[]>([]);
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [selectedFile, setSelectedFile] = useState<LeadAttachment | null>(null);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [scoreDetails, setScoreDetails] = useState<{ adjustment: number; reason: string; leadName: string } | null>(null);

  useEffect(() => {
    loadAllData();

    const subscription = supabase
      .channel('leads_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        loadLeads();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedBranchId]);

  const loadAllData = async () => {
    await Promise.all([loadLeads(), loadClients(), loadAgents()]);
    setLoading(false);
  };

  const loadLeads = async () => {
    let query = supabase
      .from('leads')
      .select('*');

    if (selectedBranchId) {
      query = query.eq('branch_id', selectedBranchId);
    }

    const { data, error } = await query.order('score', { ascending: false });
    if (!error && data) {
      setLeads(data);
    }
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

  const loadAgents = async () => {
    const { data } = await supabase
      .from('sales_agents')
      .select('*')
      .eq('status', 'active')
      .order('name');

    if (data) setAgents(data);
  };

  const loadInteractions = async (leadId: string) => {
    const { data } = await supabase
      .from('lead_interactions')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (data) setInteractions(data);
  };

  const loadFollowUps = async (leadId: string) => {
    const { data } = await supabase
      .from('lead_follow_ups')
      .select('*')
      .eq('lead_id', leadId)
      .order('follow_up_date', { ascending: true });

    if (data) setFollowUps(data);
  };

  const loadAttachments = async (leadId: string) => {
    const { data } = await supabase
      .from('lead_attachments')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (data) setAttachments(data);
  };

  const openLeadDetails = async (lead: Lead) => {
    setSelectedLead(lead);
    await loadInteractions(lead.id);
    await loadFollowUps(lead.id);
    await loadAttachments(lead.id);
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'WhatsApp': return <Mail className="w-4 h-4 text-green-600" />;
      case 'Phone': return <Phone className="w-4 h-4 text-blue-600" />;
      case 'Email': return <Mail className="w-4 h-4 text-orange-600" />;
      default: return <Mail className="w-4 h-4 text-gray-600" />;
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <ImageIcon className="w-5 h-5 text-blue-600" />;
    } else if (fileType === 'application/pdf') {
      return <FileText className="w-5 h-5 text-red-600" />;
    }
    return <FileText className="w-5 h-5 text-gray-600" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleViewFile = (attachment: LeadAttachment) => {
    setSelectedFile(attachment);
    setShowFileViewer(true);
  };

  const rojos = leads.filter(l => l.status === 'Rojo');
  const amarillos = leads.filter(l => l.status === 'Amarillo');
  const verdes = leads.filter(l => l.status === 'Verde');
  const clientesActivos = clients;

  const getColumnColor = (status: string) => {
    switch (status) {
      case 'Rojo': return {
        bg: 'from-red-50 to-red-100',
        border: 'border-red-300',
        text: 'text-red-800',
        badge: 'bg-red-600'
      };
      case 'Amarillo': return {
        bg: 'from-yellow-50 to-yellow-100',
        border: 'border-yellow-300',
        text: 'text-yellow-800',
        badge: 'bg-yellow-600'
      };
      case 'Verde': return {
        bg: 'from-green-50 to-green-100',
        border: 'border-green-300',
        text: 'text-green-800',
        badge: 'bg-green-600'
      };
      case 'Cliente': return {
        bg: 'from-blue-50 to-blue-100',
        border: 'border-blue-300',
        text: 'text-blue-800',
        badge: 'bg-blue-600'
      };
      default: return {
        bg: 'from-gray-50 to-gray-100',
        border: 'border-gray-300',
        text: 'text-gray-800',
        badge: 'bg-gray-600'
      };
    }
  };

  const LeadCard = ({ lead }: { lead: Lead }) => (
    <div
      onClick={() => openLeadDetails(lead)}
      className="bg-white rounded-lg shadow-md p-4 mb-3 border-2 border-gray-200 hover:shadow-lg transition-all cursor-pointer hover:scale-105"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-bold text-gray-800 text-sm">{lead.name}</h4>
          <p className="text-xs text-gray-500 mt-1">{lead.model_interested || 'Sin modelo'}</p>
        </div>
        <div className="flex items-center gap-1 bg-yellow-100 rounded-full px-2 py-1">
          <Star className="w-3 h-3 text-yellow-600 fill-yellow-600" />
          <span className="text-xs font-bold text-yellow-800">{lead.score}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Phone className="w-3 h-3" />
          <span className="truncate">{lead.phone || 'N/A'}</span>
        </div>

        {lead.email && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Mail className="w-3 h-3" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Calendar className="w-3 h-3" />
          <span>{new Date(lead.created_at).toLocaleDateString('es-MX')}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">{lead.origin}</span>
        <span className="text-xs font-bold text-blue-600">{lead.timeframe || 'N/A'}</span>
      </div>

      {lead.financing_type && (
        <div className="mt-2">
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">
            {lead.financing_type}
          </span>
        </div>
      )}
    </div>
  );

  const ClientCard = ({ client }: { client: Client }) => (
    <div
      onClick={() => setSelectedClient(client)}
      className="bg-white rounded-lg shadow-md p-4 mb-3 border-2 border-gray-200 hover:shadow-lg transition-all cursor-pointer hover:scale-105"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-bold text-gray-800 text-sm">{client.name}</h4>
          <p className="text-xs text-gray-500 mt-1">Cliente ID: {client.id.slice(0, 8)}</p>
        </div>
        <div className="flex items-center gap-1 bg-blue-100 rounded-full px-2 py-1">
          <UserCheck className="w-3 h-3 text-blue-600" />
          <span className="text-xs font-bold text-blue-800">{client.status}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Phone className="w-3 h-3" />
          <span className="truncate">{client.phone || 'N/A'}</span>
        </div>

        {client.email && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Mail className="w-3 h-3" />
            <span className="truncate">{client.email}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Calendar className="w-3 h-3" />
          <span>{new Date(client.created_at).toLocaleDateString('es-MX')}</span>
        </div>
      </div>

      {client.last_purchase_date && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <span className="text-xs font-semibold text-gray-700">Última compra:</span>
          <span className="text-xs text-blue-600 ml-2">
            {new Date(client.last_purchase_date).toLocaleDateString('es-MX')}
          </span>
        </div>
      )}
    </div>
  );

  const KanbanColumn = ({ title, leads, clients, status }: { title: string; leads?: Lead[]; clients?: Client[]; status: string }) => {
    const colors = getColumnColor(status);

    return (
      <div className="flex-1 min-w-[320px]">
        <div className={`bg-gradient-to-br ${colors.bg} rounded-t-xl border-2 ${colors.border} p-4`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`font-bold text-lg ${colors.text}`}>{title}</h3>
            <div className={`${colors.badge} text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm`}>
              {leads ? leads.length : clients ? clients.length : 0}
            </div>
          </div>
          <p className="text-xs text-gray-600">
            {status === 'Rojo' && 'Requieren nutrición y seguimiento'}
            {status === 'Amarillo' && 'En proceso de contacto activo'}
            {status === 'Verde' && 'Alta prioridad - Trámite activo'}
            {status === 'Cliente' && 'Ventas convertidas - Post-venta activo'}
          </p>
        </div>

        <div className="bg-gray-50 rounded-b-xl border-2 border-t-0 border-gray-200 p-4 min-h-[600px] max-h-[600px] overflow-y-auto">
          {leads && leads.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">
                <TrendingUp className="w-12 h-12 mx-auto opacity-50" />
              </div>
              <p className="text-sm text-gray-500">No hay leads en esta etapa</p>
            </div>
          )}
          {clients && clients.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">
                <UserCheck className="w-12 h-12 mx-auto opacity-50" />
              </div>
              <p className="text-sm text-gray-500">No hay clientes registrados</p>
            </div>
          )}
          {leads && leads.map(lead => <LeadCard key={lead.id} lead={lead} />)}
          {clients && clients.map(client => <ClientCard key={client.id} client={client} />)}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="text-center py-8">Cargando pipeline...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <Trello className="w-8 h-8 text-purple-600" />
          Pipeline Kanban
        </h2>
        <p className="text-gray-600 mt-1">Visualización del flujo de oportunidades</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-4xl font-bold">{rojos.length}</div>
            <div className="bg-white bg-opacity-20 rounded-lg px-3 py-2 text-xs font-semibold">NUTRICIÓN</div>
          </div>
          <div className="text-sm opacity-90">Leads Rojos</div>
          <div className="mt-3 pt-3 border-t border-white border-opacity-30 text-xs">
            Promedio score: {rojos.length > 0 ? Math.round(rojos.reduce((acc, l) => acc + l.score, 0) / rojos.length) : 0}
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-4xl font-bold">{amarillos.length}</div>
            <div className="bg-white bg-opacity-20 rounded-lg px-3 py-2 text-xs font-semibold">EN PROCESO</div>
          </div>
          <div className="text-sm opacity-90">Leads Amarillos</div>
          <div className="mt-3 pt-3 border-t border-white border-opacity-30 text-xs">
            Promedio score: {amarillos.length > 0 ? Math.round(amarillos.reduce((acc, l) => acc + l.score, 0) / amarillos.length) : 0}
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-4xl font-bold">{verdes.length}</div>
            <div className="bg-white bg-opacity-20 rounded-lg px-3 py-2 text-xs font-semibold">ACTIVO</div>
          </div>
          <div className="text-sm opacity-90">Leads Verdes</div>
          <div className="mt-3 pt-3 border-t border-white border-opacity-30 text-xs">
            Promedio score: {verdes.length > 0 ? Math.round(verdes.reduce((acc, l) => acc + l.score, 0) / verdes.length) : 0}
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-4xl font-bold">{clientesActivos.length}</div>
            <div className="bg-white bg-opacity-20 rounded-lg px-3 py-2 text-xs font-semibold">CONVERTIDOS</div>
          </div>
          <div className="text-sm opacity-90">Clientes</div>
          <div className="mt-3 pt-3 border-t border-white border-opacity-30 text-xs">
            Ciclo post-venta activo
          </div>
        </div>
      </div>

      <div className="flex gap-6 overflow-x-auto pb-4">
        <KanbanColumn title="🔴 Nutrición" leads={rojos} status="Rojo" />
        <KanbanColumn title="🟡 En Proceso" leads={amarillos} status="Amarillo" />
        <KanbanColumn title="🟢 Trámite Activo" leads={verdes} status="Verde" />
        <KanbanColumn title="🔵 Clientes" clients={clientesActivos} status="Cliente" />
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200">
        <h3 className="text-lg font-bold text-gray-800 mb-3">Flujo de Conversión Automatizada</h3>
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          El pipeline visualiza el ciclo completo desde prospecto hasta cliente. Al convertir un lead a cliente
          (venta exitosa), automáticamente aparecerá en la columna azul de Clientes, donde entra al ciclo
          post-venta para servicios, accesorios y marketing de retención.
        </p>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>Leads progresan de Rojo → Amarillo → Verde según el sistema de scoring dinámico</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>Al registrarse la venta, el lead se convierte automáticamente en Cliente (columna azul)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>Los clientes entran al ciclo post-venta: servicio técnico, refacciones y campañas de retención</span>
          </li>
        </ul>
        <div className="mt-4 flex items-center gap-2 text-xs text-blue-700">
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
          <span className="font-semibold">Actualización en tiempo real activa</span>
        </div>
      </div>

      {selectedLead && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-auto"
          onClick={() => setSelectedLead(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-5 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white rounded-full p-2">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{selectedLead.name}</h3>
                  <p className="text-sm text-blue-100">ID: {selectedLead.id.slice(0, 8)}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="hover:bg-blue-800 rounded-full p-2 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[85vh] p-6 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b-2 border-gray-200">
                <div>
                  <span className={`inline-block px-4 py-2 rounded-lg font-bold text-sm ${selectedLead.status === 'Verde'
                      ? 'bg-green-100 text-green-800 border-2 border-green-300'
                      : selectedLead.status === 'Amarillo'
                        ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-300'
                        : 'bg-red-100 text-red-800 border-2 border-red-300'
                    }`}>
                    {selectedLead.status}
                  </span>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 bg-yellow-100 rounded-lg px-4 py-2 border-2 border-yellow-300">
                    <Star className="w-5 h-5 text-yellow-600 fill-yellow-600" />
                    <span className="text-2xl font-bold text-yellow-800">{selectedLead.score}</span>
                    <span className="text-xs text-yellow-700">/100</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                  <TrendingUp className="w-6 h-6 opacity-80 mb-3" />
                  <div className="text-3xl font-bold mb-1">{selectedLead.score}/100</div>
                  <div className="text-sm opacity-90">Score de Calificación</div>
                </div>

                <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-200">
                  <Clock className="w-6 h-6 text-orange-600 mb-3" />
                  <div className="text-2xl font-bold text-gray-800 mb-1">{selectedLead.timeframe || 'N/A'}</div>
                  <div className="text-sm text-gray-600">Timeframe</div>
                </div>

                <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-200">
                  <DollarSign className="w-6 h-6 text-green-600 mb-3" />
                  <div className="text-lg font-bold text-gray-800 mb-1">{selectedLead.financing_type || 'N/A'}</div>
                  <div className="text-sm text-gray-600">Financiamiento</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-blue-600" />
                    <div>
                      <div className="text-xs text-gray-500 font-semibold">Teléfono</div>
                      <div className="text-sm font-semibold text-gray-800">{selectedLead.phone || 'N/A'}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-green-600" />
                    <div>
                      <div className="text-xs text-gray-500 font-semibold">Email</div>
                      <div className="text-sm font-semibold text-gray-800 truncate">{selectedLead.email || 'N/A'}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                  <div className="flex items-center gap-3">
                    <Building className="w-5 h-5 text-orange-600" />
                    <div>
                      <div className="text-xs text-gray-500 font-semibold">Origen</div>
                      <div className="text-sm font-semibold text-gray-800">{selectedLead.origin}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-200">
                <h4 className="text-lg font-bold text-gray-800 mb-4">Información del Prospecto</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Modelo de Interés:</span>
                    <span className="font-semibold text-gray-800">{selectedLead.model_interested || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Días desde Ingreso:</span>
                    <span className="font-semibold text-gray-800">
                      {Math.floor((new Date().getTime() - new Date(selectedLead.created_at).getTime()) / (1000 * 60 * 60 * 24))} días
                    </span>
                  </div>
                  {selectedLead.birthday && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cumpleaños:</span>
                      <span className="font-semibold text-gray-800">
                        {new Date(selectedLead.birthday).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {selectedLead.assigned_agent_id && agents.length > 0 && (
                <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-200">
                  <h4 className="text-lg font-bold text-gray-800 mb-4">Asignación</h4>
                  {agents.find(a => a.id === selectedLead.assigned_agent_id) ? (
                    <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                      <div className="font-bold text-gray-800">{agents.find(a => a.id === selectedLead.assigned_agent_id)?.name}</div>
                      <div className="text-sm text-gray-600 mt-1">{agents.find(a => a.id === selectedLead.assigned_agent_id)?.email}</div>
                      <div className="text-sm text-gray-600">{agents.find(a => a.id === selectedLead.assigned_agent_id)?.phone}</div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">Sin asignar</div>
                  )}
                </div>
              )}

              <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Upload className="w-5 h-5 text-green-600" />
                    Archivos Adjuntos ({attachments.length})
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {attachments.length > 0 ? (
                    attachments.map((attachment) => (
                      <div key={attachment.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex items-center gap-3">
                        {getFileIcon(attachment.file_type)}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-800 truncate">{attachment.file_name}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {formatFileSize(attachment.file_size)} • {new Date(attachment.created_at).toLocaleDateString('es-MX')}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleViewFile(attachment)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Ver archivo"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-8 text-gray-500">
                      Sin archivos adjuntos
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <History className="w-5 h-5 text-blue-600" />
                    Historial de Interacciones
                  </h4>
                </div>

                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {interactions.length > 0 ? (
                    interactions.map((interaction) => (
                      <div key={interaction.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-start gap-3">
                          {getChannelIcon(interaction.channel)}
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-gray-500 uppercase">{interaction.channel}</span>
                              <span className="text-xs text-gray-400">
                                {new Date(interaction.created_at).toLocaleString('es-MX')}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700">{interaction.message}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      Sin interacciones registradas
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-green-600" />
                    Seguimientos Programados
                  </h4>
                </div>

                <div className="space-y-3">
                  {followUps.length > 0 ? (
                    followUps.map((followUp) => {
                      const agent = agents.find(a => a.id === followUp.agent_id);
                      return (
                        <div key={followUp.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-gray-800">
                                {new Date(followUp.follow_up_date).toLocaleString('es-MX')}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">Asignado a: {agent?.name || 'N/A'}</div>
                              {followUp.notes && (
                                <p className="text-sm text-gray-600 mt-2">{followUp.notes}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {followUp.status === 'pending' && selectedLead && (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();

                                    const scoreAdjustment = LeadScoringEngine.calculateScoreAdjustment(selectedLead, {
                                      type: 'follow_up',
                                      data: { followUpCompleted: true }
                                    });

                                    await supabase
                                      .from('lead_follow_ups')
                                      .update({
                                        status: 'completed',
                                        completed_at: new Date().toISOString()
                                      })
                                      .eq('id', followUp.id);

                                    await supabase
                                      .from('leads')
                                      .update({
                                        score: scoreAdjustment.newScore,
                                        status: scoreAdjustment.newStatus,
                                        updated_at: new Date().toISOString()
                                      })
                                      .eq('id', selectedLead.id);

                                    setScoreDetails({
                                      adjustment: scoreAdjustment.adjustment,
                                      reason: scoreAdjustment.reason,
                                      leadName: selectedLead.name
                                    });
                                    setShowScoreModal(true);
                                    loadFollowUps(selectedLead.id);
                                    loadLeads();
                                  }}
                                  className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded font-semibold transition-all"
                                  title="Marcar como completado"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                              )}
                              <span className={`px-2 py-1 text-xs font-bold rounded ${followUp.status === 'completed' ? 'bg-green-100 text-green-800' :
                                  followUp.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-gray-100 text-gray-800'
                                }`}>
                                {followUp.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      Sin seguimientos programados
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFileViewer && selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4" onClick={() => setShowFileViewer(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">{selectedFile.file_name}</h3>
              <button
                onClick={() => setShowFileViewer(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              {selectedFile.file_type.startsWith('image/') ? (
                <img src={selectedFile.file_url} alt={selectedFile.file_name} className="w-full h-auto" />
              ) : selectedFile.file_type === 'application/pdf' ? (
                <iframe src={selectedFile.file_url} className="w-full h-[70vh]" />
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>Vista previa no disponible para este tipo de archivo</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showScoreModal && scoreDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowScoreModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                <TrendingUp className={`w-8 h-8 ${scoreDetails.adjustment > 0 ? 'text-green-600' : 'text-red-600'
                  }`} />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-1">Score Actualizado</h3>
              <p className="text-sm text-gray-600 mb-3">{scoreDetails.leadName}</p>
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="text-3xl font-bold text-gray-800">
                  {scoreDetails.adjustment > 0 ? '+' : ''}{scoreDetails.adjustment}
                </span>
                <span className="text-sm text-gray-600">puntos</span>
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mb-4">
              <p className="text-sm text-blue-900 font-medium">
                {scoreDetails.reason}
              </p>
            </div>
            <button
              onClick={() => {
                setShowScoreModal(false);
                setSelectedLead(null);
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {selectedClient && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-auto"
          onClick={() => setSelectedClient(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-5 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white rounded-full p-2">
                  <UserCheck className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{selectedClient.name}</h3>
                  <p className="text-sm text-blue-100">Cliente ID: {selectedClient.id.slice(0, 8)}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedClient(null)}
                className="hover:bg-blue-800 rounded-full p-2 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[85vh] p-6 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b-2 border-gray-200">
                <div>
                  <span className="inline-block px-4 py-2 rounded-lg font-bold text-sm bg-blue-100 text-blue-800 border-2 border-blue-300">
                    {selectedClient.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-blue-600" />
                    <div>
                      <div className="text-xs text-gray-500 font-semibold">Teléfono</div>
                      <div className="text-sm font-semibold text-gray-800">{selectedClient.phone || 'N/A'}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-green-600" />
                    <div>
                      <div className="text-xs text-gray-500 font-semibold">Email</div>
                      <div className="text-sm font-semibold text-gray-800 truncate">{selectedClient.email || 'N/A'}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-orange-600" />
                    <div>
                      <div className="text-xs text-gray-500 font-semibold">Registrado</div>
                      <div className="text-sm font-semibold text-gray-800">
                        {new Date(selectedClient.created_at).toLocaleDateString('es-MX')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-200">
                <h4 className="text-lg font-bold text-gray-800 mb-4">Información del Cliente</h4>
                <div className="space-y-2 text-sm">
                  {selectedClient.last_purchase_date && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Última Compra:</span>
                      <span className="font-semibold text-gray-800">
                        {new Date(selectedClient.last_purchase_date).toLocaleDateString('es-MX')}
                      </span>
                    </div>
                  )}
                  {selectedClient.birthday && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cumpleaños:</span>
                      <span className="font-semibold text-gray-800">
                        {new Date(selectedClient.birthday).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
                      </span>
                    </div>
                  )}
                  {selectedClient.converted_from_lead_id && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Convertido desde Lead:</span>
                      <span className="font-semibold text-gray-800">{selectedClient.converted_from_lead_id.slice(0, 8)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-200">
                <h4 className="text-lg font-bold text-gray-800 mb-3">Ciclo Post-Venta Activo</h4>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Este cliente ha completado la conversión y está en el ciclo post-venta. Puede acceder a servicios
                  técnicos, compra de refacciones y accesorios, y recibirá campañas de marketing de retención.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
