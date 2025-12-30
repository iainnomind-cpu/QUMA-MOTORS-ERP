import { useState, useEffect } from 'react';
import { supabase, Lead, Client, SalesAgent, LeadInteraction, LeadFollowUp, LeadAttachment } from '../lib/supabase';
import { LeadScoringEngine } from '../lib/scoringEngine';
import { useNotificationContext } from '../context/NotificationContext';
import { createLeadNotification } from '../utils/notificationHelpers';
import { useAuth } from '../contexts/AuthContext';
import { canDeleteLead, canViewAllLeads, type Role } from '../utils/permissions';
import {
  Users, Phone, Mail, Calendar, TrendingUp, MapPin, Briefcase, DollarSign, Clock, Star, X,
  Plus, Edit2, UserCheck, MessageSquare, Filter, Search, CheckCircle, History, UserPlus,
  Trash2, Upload, FileText, Image as ImageIcon, Download, Eye, Bike, CreditCard
} from 'lucide-react';

type ViewMode = 'leads' | 'clients' | 'detail' | 'create' | 'edit' | 'client-detail' | 'client-edit';

export function LeadsModule() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('leads');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const { addNotification } = useNotificationContext();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [agents, setAgents] = useState<SalesAgent[]>([]);
  const [interactions, setInteractions] = useState<LeadInteraction[]>([]);
  const [followUps, setFollowUps] = useState<LeadFollowUp[]>([]);
  const [attachments, setAttachments] = useState<LeadAttachment[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [originFilter, setOriginFilter] = useState('all');

  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showInteractionModal, setShowInteractionModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteClientModal, setShowDeleteClientModal] = useState(false);
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [selectedFile, setSelectedFile] = useState<LeadAttachment | null>(null);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [scoreDetails, setScoreDetails] = useState<{ adjustment: number; reason: string } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    origin: 'Planta',
    model_interested: '',
    timeframe: '',
    financing_type: '',
    birthday: '',
    test_drive_requested: false,
    test_drive_date: '',
    requires_financing: false,
    down_payment_amount: '',
    financing_term_months: '',
    monthly_payment_amount: ''
  });

  const [clientFormData, setClientFormData] = useState({
    name: '',
    phone: '',
    email: '',
    status: 'Vigente',
    birthday: '',
    last_purchase_date: '',
    purchased_model: '',
    purchase_type: 'moto_nueva',
    purchase_price: '',
    purchase_notes: ''
  });

  const [clientNote, setClientNote] = useState('');
  const [convertFormData, setConvertFormData] = useState({
    purchased_model: '',
    purchase_type: 'moto_nueva',
    purchase_price: '',
    purchase_notes: ''
  });

  const [interactionForm, setInteractionForm] = useState({
    interaction_type: 'note',
    channel: 'Phone',
    message: '',
    direction: 'outbound'
  });

  const [followUpForm, setFollowUpForm] = useState({
    follow_up_date: '',
    notes: '',
    agent_id: ''
  });

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    filterLeads();
  }, [leads, searchTerm, statusFilter, originFilter]);

  useEffect(() => {
    filterClients();
  }, [clients, searchTerm, statusFilter]);

  const loadAllData = async () => {
    await Promise.all([loadLeads(), loadClients(), loadAgents()]);
    setLoading(false);
  };

  const loadLeads = async () => {
    let query = supabase
      .from('leads')
      .select('*');

    if (user?.role === 'vendedor') {
      const { data: agentData } = await supabase
        .from('sales_agents')
        .select('id')
        .eq('email', user.email)
        .maybeSingle();

      if (agentData) {
        query = query.eq('assigned_agent_id', agentData.id);
      } else {
        query = query.eq('assigned_agent_id', 'none');
      }
    }

    const { data, error } = await query.order('score', { ascending: false });

    if (!error && data) {
      setLeads(data);
    }
  };

  const loadClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

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

  const filterLeads = () => {
    let filtered = [...leads];

    if (searchTerm) {
      filtered = filtered.filter(lead =>
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.phone?.includes(searchTerm) ||
        lead.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(lead => lead.status === statusFilter);
    }

    if (originFilter !== 'all') {
      filtered = filtered.filter(lead => lead.origin === originFilter);
    }

    setFilteredLeads(filtered);
  };

  const filterClients = () => {
    let filtered = [...clients];

    if (searchTerm) {
      filtered = filtered.filter(client =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.phone?.includes(searchTerm) ||
        client.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(client => client.status === statusFilter);
    }

    setFilteredClients(filtered);
  };

  const openLeadDetails = async (lead: Lead) => {
    setSelectedLead(lead);
    setViewMode('detail');
    await loadInteractions(lead.id);
    await loadFollowUps(lead.id);
    await loadAttachments(lead.id);
  };

  const openClientDetails = async (client: Client) => {
    setSelectedClient(client);
    setViewMode('client-detail');
  };

  const openEditClient = (client: Client) => {
    setSelectedClient(client);
    setClientFormData({
      name: client.name,
      phone: client.phone || '',
      email: client.email || '',
      status: client.status,
      birthday: client.birthday || '',
      last_purchase_date: client.last_purchase_date || '',
      purchased_model: client.purchased_model || '',
      purchase_type: client.purchase_type || 'moto_nueva',
      purchase_price: client.purchase_price?.toString() || '',
      purchase_notes: client.purchase_notes || ''
    });
    setViewMode('client-edit');
  };

  const openEditLead = (lead: Lead) => {
    setSelectedLead(lead);
    setFormData({
      name: lead.name,
      phone: lead.phone || '',
      email: lead.email || '',
      origin: lead.origin,
      model_interested: lead.model_interested || '',
      timeframe: lead.timeframe || '',
      financing_type: lead.financing_type || '',
      birthday: lead.birthday || '',
      test_drive_requested: lead.test_drive_requested || false,
      test_drive_date: lead.test_drive_date || '',
      requires_financing: lead.requires_financing || false,
      down_payment_amount: lead.down_payment_amount?.toString() || '',
      financing_term_months: lead.financing_term_months?.toString() || '',
      monthly_payment_amount: lead.monthly_payment_amount?.toString() || ''
    });
    setViewMode('edit');
  };

  const handleCreateLead = async () => {
    const dataToInsert = {
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      origin: formData.origin,
      model_interested: formData.model_interested,
      timeframe: formData.timeframe,
      financing_type: formData.financing_type,
      birthday: formData.birthday || null,
      test_drive_requested: formData.test_drive_requested,
      test_drive_date: formData.test_drive_date || null,
      test_drive_completed: false,
      requires_financing: formData.requires_financing,
      down_payment_amount: formData.down_payment_amount ? parseFloat(formData.down_payment_amount) : null,
      financing_term_months: formData.financing_term_months ? parseInt(formData.financing_term_months) : null,
      monthly_payment_amount: formData.monthly_payment_amount ? parseFloat(formData.monthly_payment_amount) : null,
      has_id_document: false,
      has_income_proof: false,
      has_address_proof: false,
      score: 45,
      status: 'Rojo'
    };

    const { data: leadData, error } = await supabase
      .from('leads')
      .insert([dataToInsert])
      .select();

    if (!error && leadData && leadData.length > 0) {
      const newLead = leadData[0];

      if (formData.test_drive_requested && formData.test_drive_date && formData.model_interested) {
        const { data: catalogItem } = await supabase
          .from('catalog')
          .select('id')
          .eq('model', formData.model_interested)
          .eq('active', true)
          .maybeSingle();

        const { error: appointmentError } = await supabase
          .from('test_drive_appointments')
          .insert([{
            lead_id: newLead.id,
            lead_name: formData.name,
            lead_phone: formData.phone,
            catalog_item_id: catalogItem?.id || null,
            catalog_model: formData.model_interested,
            appointment_date: formData.test_drive_date,
            duration_minutes: 30,
            status: 'scheduled',
            pickup_location: 'agencia',
            notes: `Prueba de manejo programada desde registro de lead. Origen: ${formData.origin}`
          }]);

        if (!appointmentError) {
          addNotification({
            type: 'test_drive_scheduled',
            title: 'Prueba de Manejo Agendada',
            message: `Nueva prueba de manejo: ${formData.name} - ${formData.model_interested} el ${new Date(formData.test_drive_date).toLocaleString('es-MX')}`,
            priority: 'medium',
            category: 'appointment',
            entity_type: 'test_drive',
            metadata: {
              lead_name: formData.name,
              model: formData.model_interested,
              date: formData.test_drive_date
            }
          });
        }
      }

      setViewMode('leads');
      setFormData({
        name: '',
        phone: '',
        email: '',
        origin: 'Planta',
        model_interested: '',
        timeframe: '',
        financing_type: '',
        birthday: '',
        test_drive_requested: false,
        test_drive_date: '',
        requires_financing: false,
        down_payment_amount: '',
        financing_term_months: '',
        monthly_payment_amount: ''
      });
      loadLeads();
    }
  };

  const handleUpdateLead = async () => {
    if (!selectedLead) return;

    const scoreAdjustment = LeadScoringEngine.calculateScoreAdjustment(selectedLead, {
      type: 'edit',
      data: {
        oldModel: selectedLead.model_interested,
        newModel: formData.model_interested,
        oldTimeframe: selectedLead.timeframe,
        newTimeframe: formData.timeframe,
        oldFinancing: selectedLead.financing_type,
        newFinancing: formData.financing_type
      }
    });

    const dataToUpdate = {
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      origin: formData.origin,
      model_interested: formData.model_interested,
      timeframe: formData.timeframe,
      financing_type: formData.financing_type,
      birthday: formData.birthday || null,
      test_drive_requested: formData.test_drive_requested,
      test_drive_date: formData.test_drive_date || null,
      requires_financing: formData.requires_financing,
      down_payment_amount: formData.down_payment_amount ? parseFloat(formData.down_payment_amount) : null,
      financing_term_months: formData.financing_term_months ? parseInt(formData.financing_term_months) : null,
      monthly_payment_amount: formData.monthly_payment_amount ? parseFloat(formData.monthly_payment_amount) : null,
      score: scoreAdjustment.newScore,
      status: scoreAdjustment.newStatus,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('leads')
      .update(dataToUpdate)
      .eq('id', selectedLead.id);

    if (!error) {
      const { data: existingAppointments } = await supabase
        .from('test_drive_appointments')
        .select('*')
        .eq('lead_id', selectedLead.id)
        .in('status', ['scheduled', 'pending'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (formData.test_drive_requested && formData.test_drive_date && formData.model_interested) {
        const { data: catalogItem } = await supabase
          .from('catalog')
          .select('id')
          .eq('model', formData.model_interested)
          .eq('active', true)
          .maybeSingle();

        if (existingAppointments && existingAppointments.length > 0) {
          await supabase
            .from('test_drive_appointments')
            .update({
              lead_name: formData.name,
              lead_phone: formData.phone,
              catalog_item_id: catalogItem?.id || null,
              catalog_model: formData.model_interested,
              appointment_date: formData.test_drive_date,
              notes: `Prueba de manejo actualizada desde edición de lead. Origen: ${formData.origin}`
            })
            .eq('id', existingAppointments[0].id);
        } else {
          const { error: appointmentError } = await supabase
            .from('test_drive_appointments')
            .insert([{
              lead_id: selectedLead.id,
              lead_name: formData.name,
              lead_phone: formData.phone,
              catalog_item_id: catalogItem?.id || null,
              catalog_model: formData.model_interested,
              appointment_date: formData.test_drive_date,
              duration_minutes: 30,
              status: 'scheduled',
              pickup_location: 'agencia',
              notes: `Prueba de manejo programada desde edición de lead. Origen: ${formData.origin}`
            }]);

          if (!appointmentError) {
            addNotification({
              type: 'test_drive_scheduled',
              title: 'Prueba de Manejo Agendada',
              message: `Nueva prueba de manejo: ${formData.name} - ${formData.model_interested} el ${new Date(formData.test_drive_date).toLocaleString('es-MX')}`,
              priority: 'medium',
              category: 'appointment',
              entity_type: 'test_drive',
              metadata: {
                lead_name: formData.name,
                model: formData.model_interested,
                date: formData.test_drive_date
              }
            });
          }
        }
      } else if (!formData.test_drive_requested && existingAppointments && existingAppointments.length > 0) {
        await supabase
          .from('test_drive_appointments')
          .update({ status: 'cancelled' })
          .eq('id', existingAppointments[0].id);
      }

      const notification = createLeadNotification({
        name: formData.name,
        score: scoreAdjustment.newScore,
        status: scoreAdjustment.newStatus,
        phone: formData.phone,
        model_interested: formData.model_interested,
        timeframe: formData.timeframe
      });

      if (notification) {
        addNotification(notification);
      }

      if (scoreAdjustment.adjustment !== 0) {
        setScoreDetails({ adjustment: scoreAdjustment.adjustment, reason: scoreAdjustment.reason });
        setShowScoreModal(true);
      }
      setViewMode('leads');
      setSelectedLead(null);
      loadLeads();
    }
  };

  const handleDeleteClient = async () => {
    if (!selectedClient) return;

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', selectedClient.id);

    if (!error) {
      setShowDeleteClientModal(false);
      setViewMode('clients');
      setSelectedClient(null);
      loadClients();
    }
  };

  const handleDeleteLead = async () => {
    if (!selectedLead) return;

    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', selectedLead.id);

    if (!error) {
      setShowDeleteModal(false);
      setViewMode('leads');
      setSelectedLead(null);
      loadLeads();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, documentType?: string) => {
    if (!selectedLead || !event.target.files || event.target.files.length === 0) return;

    const file = event.target.files[0];
    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
      alert('El archivo es demasiado grande. Tamaño máximo: 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;

      const { error } = await supabase
        .from('lead_attachments')
        .insert([{
          lead_id: selectedLead.id,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          file_url: base64String,
          document_type: documentType || null,
          uploaded_by: null
        }]);

      if (!error) {
        if (documentType) {
          const updateData: any = {};
          if (documentType === 'ine') updateData.has_id_document = true;
          if (documentType === 'comprobante_ingresos') updateData.has_income_proof = true;
          if (documentType === 'comprobante_domicilio') updateData.has_address_proof = true;

          await supabase
            .from('leads')
            .update(updateData)
            .eq('id', selectedLead.id);
        }
        loadAttachments(selectedLead.id);
        loadLeads();
      }
    };

    reader.readAsDataURL(file);
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm('¿Estás seguro de eliminar este archivo?')) return;

    const { error } = await supabase
      .from('lead_attachments')
      .delete()
      .eq('id', attachmentId);

    if (!error && selectedLead) {
      loadAttachments(selectedLead.id);
    }
  };

  const handleViewFile = (attachment: LeadAttachment) => {
    setSelectedFile(attachment);
    setShowFileViewer(true);
  };

  const handleAssignAgent = async (agentId: string) => {
    if (!selectedLead) return;

    const { error: leadError } = await supabase
      .from('leads')
      .update({ assigned_agent_id: agentId, updated_at: new Date().toISOString() })
      .eq('id', selectedLead.id);

    const { error: assignmentError } = await supabase
      .from('lead_assignments')
      .insert([{
        lead_id: selectedLead.id,
        agent_id: agentId,
        status: 'active',
        notes: 'Asignación manual desde módulo de leads'
      }]);

    if (!leadError && !assignmentError) {
      const { data: agentData } = await supabase
        .from('sales_agents')
        .select('total_leads_assigned, total_leads_converted')
        .eq('id', agentId)
        .single();

      if (agentData) {
        const newTotalLeadsAssigned = (agentData.total_leads_assigned || 0) + 1;
        const conversionRate = newTotalLeadsAssigned > 0
          ? ((agentData.total_leads_converted || 0) / newTotalLeadsAssigned) * 100
          : 0;

        await supabase
          .from('sales_agents')
          .update({
            total_leads_assigned: newTotalLeadsAssigned,
            conversion_rate: parseFloat(conversionRate.toFixed(2))
          })
          .eq('id', agentId);
      }

      setSelectedLead({ ...selectedLead, assigned_agent_id: agentId });
      setShowAssignModal(false);
      await Promise.all([loadLeads(), loadAgents()]);

      const updatedLead = leads.find(l => l.id === selectedLead.id);
      if (updatedLead) {
        openLeadDetails({ ...updatedLead, assigned_agent_id: agentId });
      }
    }
  };

  const handleAddInteraction = async () => {
    if (!selectedLead) return;

    const { error } = await supabase
      .from('lead_interactions')
      .insert([{
        lead_id: selectedLead.id,
        ...interactionForm,
        agent_id: null
      }]);

    if (!error) {
      const scoreAdjustment = LeadScoringEngine.calculateScoreAdjustment(selectedLead, {
        type: 'interaction',
        data: {
          interactionType: interactionForm.interaction_type,
          channel: interactionForm.channel,
          direction: interactionForm.direction
        }
      });

      await supabase
        .from('leads')
        .update({
          score: scoreAdjustment.newScore,
          status: scoreAdjustment.newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedLead.id);

      setScoreDetails({ adjustment: scoreAdjustment.adjustment, reason: scoreAdjustment.reason });
      setShowScoreModal(true);

      setShowInteractionModal(false);
      setInteractionForm({
        interaction_type: 'note',
        channel: 'Phone',
        message: '',
        direction: 'outbound'
      });
      loadInteractions(selectedLead.id);
      loadLeads();
    }
  };

  const handleAddFollowUp = async () => {
    if (!selectedLead) return;

    const { error } = await supabase
      .from('lead_follow_ups')
      .insert([{
        lead_id: selectedLead.id,
        agent_id: followUpForm.agent_id || agents[0]?.id,
        follow_up_date: followUpForm.follow_up_date,
        notes: followUpForm.notes,
        status: 'pending'
      }]);

    if (!error) {
      setShowFollowUpModal(false);
      setFollowUpForm({
        follow_up_date: '',
        notes: '',
        agent_id: ''
      });
      loadFollowUps(selectedLead.id);
    }
  };

  const handleConvertToClient = async () => {
    if (!selectedLead) return;

    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .insert([{
        name: selectedLead.name,
        phone: selectedLead.phone,
        email: selectedLead.email,
        status: 'Vigente',
        last_purchase_date: new Date().toISOString(),
        birthday: selectedLead.birthday,
        converted_from_lead_id: selectedLead.id,
        original_interest_model: selectedLead.model_interested,
        purchased_model: convertFormData.purchased_model || selectedLead.model_interested,
        purchase_type: convertFormData.purchase_type,
        purchase_price: convertFormData.purchase_price ? parseFloat(convertFormData.purchase_price) : null,
        purchase_notes: convertFormData.purchase_notes
      }])
      .select();

    if (!clientError && clientData) {
      await supabase
        .from('lead_interactions')
        .insert([{
          lead_id: selectedLead.id,
          interaction_type: 'note',
          channel: 'System',
          message: `Lead convertido a cliente exitosamente. Cliente ID: ${clientData[0].id}`,
          direction: 'outbound',
          agent_id: null
        }]);

      if (selectedLead.assigned_agent_id) {
        const { data: agentData } = await supabase
          .from('sales_agents')
          .select('total_leads_assigned, total_leads_converted')
          .eq('id', selectedLead.assigned_agent_id)
          .single();

        if (agentData) {
          const newTotalLeadsConverted = (agentData.total_leads_converted || 0) + 1;
          const conversionRate = (agentData.total_leads_assigned || 0) > 0
            ? (newTotalLeadsConverted / (agentData.total_leads_assigned || 1)) * 100
            : 0;

          await supabase
            .from('sales_agents')
            .update({
              total_leads_converted: newTotalLeadsConverted,
              conversion_rate: parseFloat(conversionRate.toFixed(2))
            })
            .eq('id', selectedLead.assigned_agent_id);
        }
      }

      setShowConvertModal(false);
      setViewMode('leads');
      setSelectedLead(null);
      setConvertFormData({
        purchased_model: '',
        purchase_type: 'moto_nueva',
        purchase_price: '',
        purchase_notes: ''
      });
      await Promise.all([loadLeads(), loadClients(), loadAgents()]);
    }
  };

  const handleUpdateClient = async () => {
    if (!selectedClient) return;

    const { error } = await supabase
      .from('clients')
      .update({
        name: clientFormData.name,
        phone: clientFormData.phone,
        email: clientFormData.email,
        status: clientFormData.status,
        birthday: clientFormData.birthday || null,
        last_purchase_date: clientFormData.last_purchase_date || null,
        purchased_model: clientFormData.purchased_model || null,
        purchase_type: clientFormData.purchase_type || null,
        purchase_price: clientFormData.purchase_price ? parseFloat(clientFormData.purchase_price) : null,
        purchase_notes: clientFormData.purchase_notes || null
      })
      .eq('id', selectedClient.id);

    if (!error) {
      setViewMode('client-detail');
      loadClients();
      const updatedClient = await supabase
        .from('clients')
        .select('*')
        .eq('id', selectedClient.id)
        .single();

      if (updatedClient.data) {
        setSelectedClient(updatedClient.data);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Verde': return 'bg-green-100 text-green-800 border-green-300';
      case 'Amarillo': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Rojo': return 'bg-red-100 text-red-800 border-red-300';
      case 'Vigente': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'No Vigente': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getChannelIcon = (channel: string) => {
    switch(channel) {
      case 'WhatsApp': return <MessageSquare className="w-4 h-4 text-green-600" />;
      case 'Phone': return <Phone className="w-4 h-4 text-blue-600" />;
      case 'Email': return <Mail className="w-4 h-4 text-orange-600" />;
      default: return <MessageSquare className="w-4 h-4 text-gray-600" />;
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

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  if (viewMode === 'client-edit' && selectedClient) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <Edit2 className="w-8 h-8 text-blue-600" />
            Editar Cliente
          </h2>
          <button
            onClick={() => setViewMode('client-detail')}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-all"
          >
            Cancelar
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre Completo *</label>
              <input
                type="text"
                value={clientFormData.name}
                onChange={(e) => setClientFormData({ ...clientFormData, name: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                placeholder="Ej: Juan Pérez García"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Teléfono</label>
              <input
                type="tel"
                value={clientFormData.phone}
                onChange={(e) => setClientFormData({ ...clientFormData, phone: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                placeholder="5551234567"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={clientFormData.email}
                onChange={(e) => setClientFormData({ ...clientFormData, email: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                placeholder="juan@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Estado</label>
              <select
                value={clientFormData.status}
                onChange={(e) => setClientFormData({ ...clientFormData, status: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                <option value="Vigente">Vigente</option>
                <option value="No Vigente">No Vigente</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha de Nacimiento</label>
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={clientFormData.birthday ? new Date(clientFormData.birthday).getDate() : ''}
                  onChange={(e) => {
                    const day = e.target.value;
                    if (day) {
                      const currentDate = clientFormData.birthday ? new Date(clientFormData.birthday) : new Date();
                      currentDate.setDate(parseInt(day));
                      setClientFormData({ ...clientFormData, birthday: currentDate.toISOString().split('T')[0] });
                    }
                  }}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Día</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
                <select
                  value={clientFormData.birthday ? new Date(clientFormData.birthday).getMonth() + 1 : ''}
                  onChange={(e) => {
                    const month = e.target.value;
                    if (month) {
                      const currentDate = clientFormData.birthday ? new Date(clientFormData.birthday) : new Date();
                      currentDate.setMonth(parseInt(month) - 1);
                      setClientFormData({ ...clientFormData, birthday: currentDate.toISOString().split('T')[0] });
                    }
                  }}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Mes</option>
                  <option value="1">Enero</option>
                  <option value="2">Febrero</option>
                  <option value="3">Marzo</option>
                  <option value="4">Abril</option>
                  <option value="5">Mayo</option>
                  <option value="6">Junio</option>
                  <option value="7">Julio</option>
                  <option value="8">Agosto</option>
                  <option value="9">Septiembre</option>
                  <option value="10">Octubre</option>
                  <option value="11">Noviembre</option>
                  <option value="12">Diciembre</option>
                </select>
                <select
                  value={clientFormData.birthday ? new Date(clientFormData.birthday).getFullYear() : ''}
                  onChange={(e) => {
                    const year = e.target.value;
                    if (year) {
                      const currentDate = clientFormData.birthday ? new Date(clientFormData.birthday) : new Date();
                      currentDate.setFullYear(parseInt(year));
                      setClientFormData({ ...clientFormData, birthday: currentDate.toISOString().split('T')[0] });
                    }
                  }}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Año</option>
                  {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Última Compra</label>
              <input
                type="date"
                value={clientFormData.last_purchase_date}
                onChange={(e) => setClientFormData({ ...clientFormData, last_purchase_date: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-6 bg-gray-50 rounded-lg p-6 border-2 border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Bike className="w-5 h-5 text-blue-600" />
              Información de Compra
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Modelo Comprado</label>
                <input
                  type="text"
                  value={clientFormData.purchased_model}
                  onChange={(e) => setClientFormData({ ...clientFormData, purchased_model: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="Ej: MT-07, YZF-R3"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de Compra</label>
                <select
                  value={clientFormData.purchase_type}
                  onChange={(e) => setClientFormData({ ...clientFormData, purchase_type: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="moto_nueva">Motocicleta Nueva</option>
                  <option value="moto_usada">Motocicleta Usada</option>
                  <option value="refacciones">Refacciones</option>
                  <option value="accesorios">Accesorios</option>
                  <option value="servicio">Servicio</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Precio de Compra (MXN)</label>
                <input
                  type="number"
                  value={clientFormData.purchase_price}
                  onChange={(e) => setClientFormData({ ...clientFormData, purchase_price: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="Ej: 165000"
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Notas de la Compra</label>
                <textarea
                  value={clientFormData.purchase_notes}
                  onChange={(e) => setClientFormData({ ...clientFormData, purchase_notes: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none h-24"
                  placeholder="Detalles adicionales de la compra, color, extras incluidos, etc."
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleUpdateClient}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
              disabled={!clientFormData.name}
            >
              Guardar Cambios
            </button>
            <button
              onClick={() => setViewMode('client-detail')}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'client-detail' && selectedClient) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-gray-800">Detalles del Cliente</h2>
          <div className="flex gap-2">
            <button
              onClick={() => openEditClient(selectedClient)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all"
            >
              <Edit2 className="w-4 h-4" />
              Editar
            </button>
            <button
              onClick={() => setShowDeleteClientModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
            </button>
            <button
              onClick={() => setViewMode('clients')}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-all"
            >
              Volver
            </button>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h4 className="text-2xl font-bold text-gray-800">{selectedClient.name}</h4>
              <p className="text-sm text-gray-500 mt-1">Cliente ID: {selectedClient.id.slice(0, 8)}</p>
            </div>
            <span className={`px-4 py-2 text-sm font-bold rounded-full border-2 ${getStatusColor(selectedClient.status)}`}>
              {selectedClient.status}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="text-xs text-gray-500 font-semibold">Teléfono</div>
                  <div className="text-sm font-semibold text-gray-800">{selectedClient.phone || 'N/A'}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-green-600" />
                <div>
                  <div className="text-xs text-gray-500 font-semibold">Email</div>
                  <div className="text-sm font-semibold text-gray-800">{selectedClient.email || 'N/A'}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4">
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
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-200">
            <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-600" />
              Información Personal
            </h4>
            <div className="space-y-3 text-sm">
              {selectedClient.birthday && (
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600 font-medium">Cumpleaños:</span>
                  <span className="font-semibold text-gray-800">
                    {new Date(selectedClient.birthday).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              )}
              {selectedClient.last_purchase_date && (
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600 font-medium">Última Compra:</span>
                  <span className="font-semibold text-gray-800">
                    {new Date(selectedClient.last_purchase_date).toLocaleDateString('es-MX')}
                  </span>
                </div>
              )}
              {selectedClient.converted_from_lead_id && (
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="text-blue-700 font-medium">Convertido desde Lead:</span>
                  <span className="font-semibold text-blue-800">
                    {selectedClient.converted_from_lead_id.slice(0, 8)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-600 font-medium">Días como Cliente:</span>
                <span className="font-semibold text-gray-800">
                  {Math.floor((new Date().getTime() - new Date(selectedClient.created_at).getTime()) / (1000 * 60 * 60 * 24))} días
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-200">
            <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Bike className="w-5 h-5 text-blue-600" />
              Información de Compra
            </h4>
            <div className="space-y-3 text-sm">
              {selectedClient.original_interest_model && (
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="text-blue-700 font-medium">Modelo de Interés Original:</span>
                  <span className="font-semibold text-blue-800">
                    {selectedClient.original_interest_model}
                  </span>
                </div>
              )}
              {selectedClient.purchased_model && (
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-200">
                  <span className="text-green-700 font-medium">Modelo Comprado:</span>
                  <span className="font-semibold text-green-800">
                    {selectedClient.purchased_model}
                  </span>
                </div>
              )}
              {selectedClient.purchase_type && (
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600 font-medium">Tipo de Compra:</span>
                  <span className="font-semibold text-gray-800">
                    {selectedClient.purchase_type === 'moto_nueva' ? 'Motocicleta Nueva' :
                     selectedClient.purchase_type === 'moto_usada' ? 'Motocicleta Usada' :
                     selectedClient.purchase_type === 'refacciones' ? 'Refacciones' :
                     selectedClient.purchase_type === 'accesorios' ? 'Accesorios' :
                     selectedClient.purchase_type === 'servicio' ? 'Servicio' : 'Otro'}
                  </span>
                </div>
              )}
              {selectedClient.purchase_price && (
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="text-gray-600 font-medium">Precio de Compra:</span>
                  <span className="font-semibold text-green-700">
                    ${selectedClient.purchase_price.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
                  </span>
                </div>
              )}
              {selectedClient.purchase_notes && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600 font-medium block mb-2">Notas de la Compra:</span>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {selectedClient.purchase_notes}
                  </p>
                </div>
              )}
              {!selectedClient.purchased_model && !selectedClient.purchase_type && (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No hay información de compra registrada
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-200">
            <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-green-600" />
              Acciones Rápidas
            </h4>
            <div className="space-y-3">
              <button
                className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border-2 border-blue-300 rounded-lg transition-all font-semibold text-gray-800"
                onClick={() => {}}
              >
                <Calendar className="w-5 h-5 text-blue-600" />
                Agendar Servicio
              </button>
              <button
                className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 border-2 border-green-300 rounded-lg transition-all font-semibold text-gray-800"
                onClick={() => {}}
              >
                <MessageSquare className="w-5 h-5 text-green-600" />
                Enviar WhatsApp
              </button>
              <button
                className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 border-2 border-orange-300 rounded-lg transition-all font-semibold text-gray-800"
                onClick={() => {}}
              >
                <Mail className="w-5 h-5 text-orange-600" />
                Enviar Email
              </button>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-md p-6 border-2 border-green-200">
          <h4 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Estado del Cliente
          </h4>
          <p className="text-sm text-gray-700 leading-relaxed">
            Este cliente está en el ciclo post-venta y tiene acceso a todos los servicios del CRM incluyendo
            servicio técnico, compra de refacciones y accesorios, y campañas de marketing de retención.
            {selectedClient.status === 'Vigente'
              ? ' El cliente se encuentra activo y vigente en nuestro sistema.'
              : ' El cliente requiere seguimiento para reactivación.'}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              Historial y Notas del Cliente
            </h4>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Agregar Nota</label>
            <div className="flex gap-2">
              <textarea
                value={clientNote}
                onChange={(e) => setClientNote(e.target.value)}
                className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none h-20"
                placeholder="Escribe una nota sobre este cliente..."
              />
              <button
                onClick={async () => {
                  if (!clientNote.trim() || !selectedClient) return;

                  await supabase
                    .from('lead_interactions')
                    .insert([{
                      lead_id: selectedClient.converted_from_lead_id || selectedClient.id,
                      interaction_type: 'note',
                      channel: 'System',
                      message: `[NOTA CLIENTE] ${clientNote}`,
                      direction: 'outbound',
                      agent_id: null
                    }]);

                  setClientNote('');
                  addNotification({
                    type: 'client_note_added',
                    title: 'Nota Agregada',
                    message: `Se agregó una nota al cliente ${selectedClient.name}`,
                    priority: 'low',
                    category: 'system',
                    entity_type: 'client',
                    metadata: { client_name: selectedClient.name }
                  });
                }}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all"
                disabled={!clientNote.trim()}
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
            <History className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">El historial de interacciones se mostrará aquí</p>
          </div>
        </div>

        {showDeleteClientModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowDeleteClientModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-red-600 mb-4">Eliminar Cliente</h3>
              <p className="text-gray-700 mb-6">
                ¿Estás seguro de que deseas eliminar este cliente? Esta acción no se puede deshacer.
                Se eliminará toda la información del cliente incluyendo su historial.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteClient}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                >
                  Eliminar Cliente
                </button>
                <button
                  onClick={() => setShowDeleteClientModal(false)}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (viewMode === 'create' || viewMode === 'edit') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            {viewMode === 'create' ? <UserPlus className="w-8 h-8 text-green-600" /> : <Edit2 className="w-8 h-8 text-blue-600" />}
            {viewMode === 'create' ? 'Registrar Nuevo Lead' : 'Editar Lead'}
          </h2>
          <button
            onClick={() => {
              setViewMode('leads');
              setSelectedLead(null);
            }}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-all"
          >
            Cancelar
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre Completo *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                placeholder="Ej: Juan Pérez García"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Teléfono</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                placeholder="5551234567"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                placeholder="juan@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Origen *</label>
              <select
                value={formData.origin}
                onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                <option value="Planta">Planta (Email)</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Piso Venta">Piso de Venta</option>
                <option value="Telefónico">Telefónico</option>
                <option value="Facebook">Facebook</option>
                <option value="Instagram">Instagram</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Modelo de Interés</label>
              <input
                type="text"
                value={formData.model_interested}
                onChange={(e) => setFormData({ ...formData, model_interested: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                placeholder="Ej: MT-07, YZF-R3"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Timeframe</label>
              <select
                value={formData.timeframe}
                onChange={(e) => setFormData({ ...formData, timeframe: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                <option value="">Seleccionar...</option>
                <option value="Inmediato">Inmediato</option>
                <option value="Pronto">Pronto</option>
                <option value="Futuro">Futuro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de Financiamiento</label>
              <select
                value={formData.financing_type}
                onChange={(e) => setFormData({ ...formData, financing_type: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                <option value="">Seleccionar...</option>
                <option value="Contado">Contado</option>
                <option value="Corto Plazo Interno">Corto Plazo Interno</option>
                <option value="Caja Colón S/I">Caja Colón S/I</option>
                <option value="Tarjeta Bancaria S/I">Tarjeta Bancaria S/I</option>
                <option value="Yamaha Especial">Yamaha Especial</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha de Nacimiento</label>
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={formData.birthday ? new Date(formData.birthday).getDate() : ''}
                  onChange={(e) => {
                    const day = e.target.value;
                    if (day) {
                      const currentDate = formData.birthday ? new Date(formData.birthday) : new Date();
                      currentDate.setDate(parseInt(day));
                      setFormData({ ...formData, birthday: currentDate.toISOString().split('T')[0] });
                    }
                  }}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Día</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
                <select
                  value={formData.birthday ? new Date(formData.birthday).getMonth() + 1 : ''}
                  onChange={(e) => {
                    const month = e.target.value;
                    if (month) {
                      const currentDate = formData.birthday ? new Date(formData.birthday) : new Date();
                      currentDate.setMonth(parseInt(month) - 1);
                      setFormData({ ...formData, birthday: currentDate.toISOString().split('T')[0] });
                    }
                  }}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Mes</option>
                  <option value="1">Enero</option>
                  <option value="2">Febrero</option>
                  <option value="3">Marzo</option>
                  <option value="4">Abril</option>
                  <option value="5">Mayo</option>
                  <option value="6">Junio</option>
                  <option value="7">Julio</option>
                  <option value="8">Agosto</option>
                  <option value="9">Septiembre</option>
                  <option value="10">Octubre</option>
                  <option value="11">Noviembre</option>
                  <option value="12">Diciembre</option>
                </select>
                <select
                  value={formData.birthday ? new Date(formData.birthday).getFullYear() : ''}
                  onChange={(e) => {
                    const year = e.target.value;
                    if (year) {
                      const currentDate = formData.birthday ? new Date(formData.birthday) : new Date();
                      currentDate.setFullYear(parseInt(year));
                      setFormData({ ...formData, birthday: currentDate.toISOString().split('T')[0] });
                    }
                  }}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Año</option>
                  {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-blue-50 rounded-lg p-6 border-2 border-blue-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Bike className="w-5 h-5 text-blue-600" />
              Prueba de Manejo
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formData.test_drive_requested}
                  onChange={(e) => setFormData({ ...formData, test_drive_requested: e.target.checked })}
                  className="w-5 h-5 accent-blue-600"
                />
                <label className="text-sm font-semibold text-gray-700">Solicitó prueba de manejo</label>
              </div>
              {formData.test_drive_requested && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha programada</label>
                  <input
                    type="datetime-local"
                    value={formData.test_drive_date}
                    onChange={(e) => setFormData({ ...formData, test_drive_date: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 bg-green-50 rounded-lg p-6 border-2 border-green-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-green-600" />
              Información de Financiamiento
            </h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formData.requires_financing}
                  onChange={(e) => setFormData({ ...formData, requires_financing: e.target.checked })}
                  className="w-5 h-5 accent-green-600"
                />
                <label className="text-sm font-semibold text-gray-700">Requiere financiamiento</label>
              </div>
              {formData.requires_financing && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Monto de Enganche (MXN)</label>
                    <input
                      type="number"
                      value={formData.down_payment_amount}
                      onChange={(e) => setFormData({ ...formData, down_payment_amount: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                      placeholder="15000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Plazo (meses)</label>
                    <input
                      type="number"
                      value={formData.financing_term_months}
                      onChange={(e) => setFormData({ ...formData, financing_term_months: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                      placeholder="12, 24, 36"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Pago Mensual (MXN)</label>
                    <input
                      type="number"
                      value={formData.monthly_payment_amount}
                      onChange={(e) => setFormData({ ...formData, monthly_payment_amount: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                      placeholder="4500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={viewMode === 'create' ? handleCreateLead : handleUpdateLead}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
              disabled={!formData.name}
            >
              {viewMode === 'create' ? 'Registrar Lead' : 'Guardar Cambios'}
            </button>
            <button
              onClick={() => {
                setViewMode('leads');
                setSelectedLead(null);
              }}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'detail' && selectedLead) {
    const assignedAgent = agents.find(a => a.id === selectedLead.assigned_agent_id);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-gray-800">Detalles del Lead</h2>
          <div className="flex gap-2">
            {canDeleteLead(user?.role as Role) && (
              <>
                <button
                  onClick={() => openEditLead(selectedLead)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all"
                >
                  <Edit2 className="w-4 h-4" />
                  Editar
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </button>
              </>
            )}
            <button
              onClick={() => setViewMode('leads')}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-all"
            >
              Volver
            </button>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h4 className="text-2xl font-bold text-gray-800">{selectedLead.name}</h4>
              <p className="text-sm text-gray-500 mt-1">Lead ID: {selectedLead.id.slice(0, 8)}</p>
            </div>
            <span className={`px-4 py-2 text-sm font-bold rounded-full border-2 ${getStatusColor(selectedLead.status)}`}>
              {selectedLead.status}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="text-xs text-gray-500 font-semibold">Teléfono</div>
                  <div className="text-sm font-semibold text-gray-800">{selectedLead.phone || 'N/A'}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-green-600" />
                <div>
                  <div className="text-xs text-gray-500 font-semibold">Email</div>
                  <div className="text-sm font-semibold text-gray-800">{selectedLead.email || 'N/A'}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-orange-600" />
                <div>
                  <div className="text-xs text-gray-500 font-semibold">Origen</div>
                  <div className="text-sm font-semibold text-gray-800">{selectedLead.origin}</div>
                </div>
              </div>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600" />
                Asignación
              </h4>
              <button
                onClick={() => setShowAssignModal(true)}
                className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
              >
                {assignedAgent ? 'Reasignar' : 'Asignar'}
              </button>
            </div>
            {assignedAgent ? (
              <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                <div className="font-bold text-gray-800">{assignedAgent.name}</div>
                <div className="text-sm text-gray-600 mt-1">{assignedAgent.email}</div>
                <div className="text-sm text-gray-600">{assignedAgent.phone}</div>
                <div className="text-xs text-gray-500 mt-2">
                  Conversión: {assignedAgent.conversion_rate}%
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                Sin asignar
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-200">
            <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-orange-600" />
              Información del Prospecto
            </h4>
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
        </div>

        {selectedLead.test_drive_requested && (
          <div className="bg-blue-50 rounded-xl shadow-md p-6 border-2 border-blue-300">
            <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Bike className="w-5 h-5 text-blue-600" />
              Prueba de Manejo
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">Estado</div>
                <div className={`inline-block px-3 py-1 rounded-full font-semibold ${
                  selectedLead.test_drive_completed
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {selectedLead.test_drive_completed ? 'Completada' : 'Pendiente'}
                </div>
              </div>
              {selectedLead.test_drive_date && (
                <div>
                  <div className="text-sm text-gray-600 mb-1">Fecha programada</div>
                  <div className="text-lg font-semibold text-gray-800">
                    {new Date(selectedLead.test_drive_date).toLocaleString('es-MX')}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedLead.requires_financing && (
          <div className="bg-green-50 rounded-xl shadow-md p-6 border-2 border-green-300">
            <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-green-600" />
              Detalles de Financiamiento
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {selectedLead.down_payment_amount && (
                <div className="bg-white rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Enganche</div>
                  <div className="text-xl font-bold text-green-600">
                    ${selectedLead.down_payment_amount.toLocaleString('es-MX')}
                  </div>
                </div>
              )}
              {selectedLead.financing_term_months && (
                <div className="bg-white rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Plazo</div>
                  <div className="text-xl font-bold text-gray-800">
                    {selectedLead.financing_term_months} meses
                  </div>
                </div>
              )}
              {selectedLead.monthly_payment_amount && (
                <div className="bg-white rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Pago Mensual</div>
                  <div className="text-xl font-bold text-blue-600">
                    ${selectedLead.monthly_payment_amount.toLocaleString('es-MX')}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-green-200">
              <h5 className="text-sm font-bold text-gray-700 mb-3">Documentos requeridos para financiamiento</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className={`flex items-center gap-3 p-3 rounded-lg ${
                  selectedLead.has_id_document ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  {selectedLead.has_id_document ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <X className="w-5 h-5 text-gray-400" />
                  )}
                  <span className="text-sm font-medium">INE</span>
                </div>
                <div className={`flex items-center gap-3 p-3 rounded-lg ${
                  selectedLead.has_income_proof ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  {selectedLead.has_income_proof ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <X className="w-5 h-5 text-gray-400" />
                  )}
                  <span className="text-sm font-medium">Comprobante de Ingresos</span>
                </div>
                <div className={`flex items-center gap-3 p-3 rounded-lg ${
                  selectedLead.has_address_proof ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  {selectedLead.has_address_proof ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <X className="w-5 h-5 text-gray-400" />
                  )}
                  <span className="text-sm font-medium">Comprobante de Domicilio</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Upload className="w-5 h-5 text-green-600" />
              Archivos Adjuntos ({attachments.length})
            </h4>
            <div className="flex gap-2">
              {selectedLead.requires_financing && (
                <>
                  <label className="flex items-center gap-2 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-semibold transition-all cursor-pointer">
                    INE
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileUpload(e, 'ine')}
                      className="hidden"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-semibold transition-all cursor-pointer">
                    Ingresos
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileUpload(e, 'comprobante_ingresos')}
                      className="hidden"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-semibold transition-all cursor-pointer">
                    Domicilio
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileUpload(e, 'comprobante_domicilio')}
                      className="hidden"
                    />
                  </label>
                </>
              )}
              <label className="flex items-center gap-2 text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg font-semibold transition-all cursor-pointer">
                <Plus className="w-4 h-4" />
                Otro
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileUpload(e)}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {attachments.length > 0 ? (
              attachments.map((attachment) => (
                <div key={attachment.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex items-center gap-3">
                  {getFileIcon(attachment.file_type)}
                  <div className="flex-1 min-w-0">
                    {attachment.document_type && (
                      <div className="mb-1">
                        <span className="inline-block px-2 py-0.5 text-xs font-bold rounded bg-blue-100 text-blue-800">
                          {attachment.document_type === 'ine' && 'INE'}
                          {attachment.document_type === 'comprobante_ingresos' && 'Comprobante de Ingresos'}
                          {attachment.document_type === 'comprobante_domicilio' && 'Comprobante de Domicilio'}
                        </span>
                      </div>
                    )}
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
                    <button
                      onClick={() => handleDeleteAttachment(attachment.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
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
            <button
              onClick={() => setShowInteractionModal(true)}
              className="flex items-center gap-2 text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-semibold transition-all"
            >
              <Plus className="w-4 h-4" />
              Agregar
            </button>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
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
            <button
              onClick={() => setShowFollowUpModal(true)}
              className="flex items-center gap-2 text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg font-semibold transition-all"
            >
              <Plus className="w-4 h-4" />
              Programar
            </button>
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
                        {followUp.status === 'pending' && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!selectedLead) return;

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

                              setScoreDetails({ adjustment: scoreAdjustment.adjustment, reason: scoreAdjustment.reason });
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
                        <span className={`px-2 py-1 text-xs font-bold rounded ${
                          followUp.status === 'completed' ? 'bg-green-100 text-green-800' :
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

        <div className="flex gap-3">
          <button
            onClick={() => setShowConvertModal(true)}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            Convertir a Cliente
          </button>
        </div>

        {showAssignModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowAssignModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-gray-800 mb-4">Asignar Vendedor</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {agents.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => handleAssignAgent(agent.id)}
                    className="w-full text-left p-4 bg-gray-50 hover:bg-blue-50 rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-all"
                  >
                    <div className="font-semibold text-gray-800">{agent.name}</div>
                    <div className="text-sm text-gray-600">{agent.email}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Conversión: {agent.conversion_rate}% | Leads: {agent.total_leads_assigned}
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="mt-4 w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {showInteractionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowInteractionModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full my-8" onClick={(e) => e.stopPropagation()}>
              <div className="border-b border-gray-200 px-6 py-4 sticky top-0 bg-white rounded-t-xl">
                <h3 className="text-xl font-bold text-gray-800">Agregar Interacción</h3>
              </div>

              <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de Interacción</label>
                  <select
                    value={interactionForm.interaction_type}
                    onChange={(e) => setInteractionForm({ ...interactionForm, interaction_type: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="note">Nota</option>
                    <option value="call">Llamada</option>
                    <option value="meeting">Reunión</option>
                    <option value="test_drive">Prueba de Manejo</option>
                    <option value="quotation">Cotización</option>
                    <option value="email">Email</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Canal</label>
                  <select
                    value={interactionForm.channel}
                    onChange={(e) => setInteractionForm({ ...interactionForm, channel: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="Phone">Teléfono</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Email">Email</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Instagram">Instagram</option>
                    <option value="In-Person">Presencial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Dirección</label>
                  <select
                    value={interactionForm.direction}
                    onChange={(e) => setInteractionForm({ ...interactionForm, direction: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="outbound">Saliente (Nosotros contactamos)</option>
                    <option value="inbound">Entrante (Lead nos contactó)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Mensaje</label>
                  <textarea
                    value={interactionForm.message}
                    onChange={(e) => setInteractionForm({ ...interactionForm, message: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none h-32"
                    placeholder="Describe la interacción..."
                  />
                </div>
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <p className="text-xs text-blue-800">
                    El scoring se ajustará automáticamente basándose en el tipo de interacción, canal y dirección.
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-200 px-6 py-4 flex gap-3 sticky bottom-0 bg-white rounded-b-xl">
                <button
                  onClick={handleAddInteraction}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                  disabled={!interactionForm.message}
                >
                  Guardar
                </button>
                <button
                  onClick={() => setShowInteractionModal(false)}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {showFollowUpModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowFollowUpModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-gray-800 mb-4">Programar Seguimiento</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha y Hora</label>
                  <input
                    type="datetime-local"
                    value={followUpForm.follow_up_date}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, follow_up_date: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Asignar a</label>
                  <select
                    value={followUpForm.agent_id}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, agent_id: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    {agents.map(agent => (
                      <option key={agent.id} value={agent.id}>{agent.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Notas</label>
                  <textarea
                    value={followUpForm.notes}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, notes: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none h-24"
                    placeholder="Notas del seguimiento..."
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleAddFollowUp}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                  disabled={!followUpForm.follow_up_date}
                >
                  Programar
                </button>
                <button
                  onClick={() => setShowFollowUpModal(false)}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {showConvertModal && selectedLead && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowConvertModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <UserCheck className="w-6 h-6 text-green-600" />
                Convertir a Cliente
              </h3>
              <p className="text-gray-700 mb-6">
                Completa la información de compra para registrar la venta y convertir este lead a cliente.
              </p>

              <div className="bg-blue-50 rounded-lg p-4 mb-6 border border-blue-200">
                <div className="text-sm font-semibold text-blue-900 mb-2">Información del Lead</div>
                <div className="text-sm text-gray-700">
                  <div><span className="font-semibold">Nombre:</span> {selectedLead.name}</div>
                  <div><span className="font-semibold">Modelo de Interés Original:</span> {selectedLead.model_interested || 'No especificado'}</div>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Modelo Comprado *
                  </label>
                  <input
                    type="text"
                    value={convertFormData.purchased_model}
                    onChange={(e) => setConvertFormData({ ...convertFormData, purchased_model: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder={selectedLead.model_interested || "Ej: MT-07, YZF-R3"}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Se llenará automáticamente con el modelo de interés si no lo cambias
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tipo de Compra *
                  </label>
                  <select
                    value={convertFormData.purchase_type}
                    onChange={(e) => setConvertFormData({ ...convertFormData, purchase_type: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="moto_nueva">Motocicleta Nueva</option>
                    <option value="moto_usada">Motocicleta Usada</option>
                    <option value="refacciones">Refacciones</option>
                    <option value="accesorios">Accesorios</option>
                    <option value="servicio">Servicio</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Precio de Compra (MXN)
                  </label>
                  <input
                    type="number"
                    value={convertFormData.purchase_price}
                    onChange={(e) => setConvertFormData({ ...convertFormData, purchase_price: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="Ej: 165000"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Notas de la Compra
                  </label>
                  <textarea
                    value={convertFormData.purchase_notes}
                    onChange={(e) => setConvertFormData({ ...convertFormData, purchase_notes: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none h-24"
                    placeholder="Detalles adicionales de la compra, color, extras incluidos, etc."
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleConvertToClient}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  Confirmar Conversión
                </button>
                <button
                  onClick={() => setShowConvertModal(false)}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowDeleteModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-red-600 mb-4">Eliminar Lead</h3>
              <p className="text-gray-700 mb-6">
                ¿Estás seguro de que deseas eliminar este lead? Esta acción no se puede deshacer y se eliminarán todos los datos asociados incluyendo interacciones, seguimientos y archivos adjuntos.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteLead}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                >
                  Eliminar
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-all"
                >
                  Cancelar
                </button>
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
                  <TrendingUp className={`w-8 h-8 ${
                    scoreDetails.adjustment > 0 ? 'text-green-600' : 'text-red-600'
                  }`} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Score Actualizado</h3>
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
                  if (selectedLead) openLeadDetails(selectedLead);
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="w-8 h-8 text-blue-600" />
            Gestión de Leads y Clientes
          </h2>
          <p className="text-gray-600 mt-1">Centralización y seguimiento de prospectos y clientes</p>
        </div>
        {viewMode === 'leads' && (
          <button
            onClick={() => setViewMode('create')}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg"
          >
            <Plus className="w-5 h-5" />
            Registrar Lead Manual
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md border-2 border-gray-200">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setViewMode('leads')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              viewMode === 'leads'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Leads ({leads.length})
            </div>
          </button>
          <button
            onClick={() => setViewMode('clients')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              viewMode === 'clients'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Users className="w-5 h-5" />
              Clientes ({clients.length})
            </div>
          </button>
        </div>

        <div className="p-6">
          <div className="bg-white rounded-xl shadow-md p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre, teléfono o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="all">Todos los Estados</option>
                  {viewMode === 'leads' ? (
                    <>
                      <option value="Verde">Verde</option>
                      <option value="Amarillo">Amarillo</option>
                      <option value="Rojo">Rojo</option>
                    </>
                  ) : (
                    <>
                      <option value="Vigente">Vigente</option>
                      <option value="No Vigente">No Vigente</option>
                    </>
                  )}
                </select>
              </div>

              {viewMode === 'leads' && (
                <div>
                  <select
                    value={originFilter}
                    onChange={(e) => setOriginFilter(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="all">Todos los Orígenes</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Planta">Planta</option>
                    <option value="Piso Venta">Piso de Venta</option>
                    <option value="Telefónico">Telefónico</option>
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Filter className="w-4 h-4" />
                <span className="font-semibold">
                  {viewMode === 'leads' ? filteredLeads.length : filteredClients.length}
                  {viewMode === 'leads' ? ' leads' : ' clientes'}
                </span>
              </div>
            </div>
          </div>

          {viewMode === 'leads' && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="grid grid-cols-12 gap-4 bg-gray-50 border-b border-gray-200 px-6 py-4 font-semibold text-sm text-gray-700">
                <div className="col-span-3">PROSPECTO</div>
                <div className="col-span-2">CONTACTO</div>
                <div className="col-span-2">MODELO</div>
                <div className="col-span-2">ESTADO</div>
                <div className="col-span-2">VENDEDOR</div>
                <div className="col-span-1">SCORE</div>
              </div>

              <div className="divide-y divide-gray-200">
                {filteredLeads.map((lead) => {
                  const assignedAgent = agents.find(a => a.id === lead.assigned_agent_id);
                  return (
                    <div
                      key={lead.id}
                      onClick={() => openLeadDetails(lead)}
                      className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-blue-50 transition-colors cursor-pointer items-center"
                    >
                      <div className="col-span-3">
                        <div className="font-bold text-gray-800">{lead.name}</div>
                        <div className="text-sm text-gray-500 mt-0.5">{lead.origin}</div>
                      </div>

                      <div className="col-span-2">
                        <div className="text-sm text-gray-700">{lead.phone || 'Sin teléfono'}</div>
                        <div className="text-sm text-gray-500 mt-0.5 truncate">{lead.email || 'Sin email'}</div>
                      </div>

                      <div className="col-span-2">
                        <div className="text-sm font-medium text-gray-800">
                          {lead.model_interested || 'Sin especificar'}
                        </div>
                      </div>

                      <div className="col-span-2">
                        <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full ${getStatusColor(lead.status)}`}>
                          {lead.status}
                        </span>
                      </div>

                      <div className="col-span-2">
                        {assignedAgent ? (
                          <div className="text-sm font-medium text-gray-800">{assignedAgent.name}</div>
                        ) : (
                          <div className="text-sm text-gray-400">Sin asignar</div>
                        )}
                      </div>

                      <div className="col-span-1">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span className="text-sm font-bold text-gray-800">{lead.score}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === 'clients' && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="grid grid-cols-12 gap-4 bg-gray-50 border-b border-gray-200 px-6 py-4 font-semibold text-sm text-gray-700">
                <div className="col-span-3">CLIENTE</div>
                <div className="col-span-3">CONTACTO</div>
                <div className="col-span-2">ESTADO</div>
                <div className="col-span-2">ÚLTIMA COMPRA</div>
                <div className="col-span-2">CUMPLEAÑOS</div>
              </div>

              <div className="divide-y divide-gray-200">
                {filteredClients.map((client) => (
                  <div
                    key={client.id}
                    onClick={() => openClientDetails(client)}
                    className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-blue-50 transition-colors cursor-pointer items-center"
                  >
                    <div className="col-span-3">
                      <div className="font-bold text-gray-800">{client.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">ID: {client.id.slice(0, 8)}</div>
                    </div>

                    <div className="col-span-3">
                      <div className="text-sm text-gray-700">{client.phone || 'Sin teléfono'}</div>
                      <div className="text-sm text-gray-500 mt-0.5 truncate">{client.email || 'Sin email'}</div>
                    </div>

                    <div className="col-span-2">
                      <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full ${getStatusColor(client.status)}`}>
                        {client.status}
                      </span>
                    </div>

                    <div className="col-span-2">
                      <div className="text-sm text-gray-700">
                        {client.last_purchase_date
                          ? new Date(client.last_purchase_date).toLocaleDateString('es-MX')
                          : 'N/A'
                        }
                      </div>
                    </div>

                    <div className="col-span-2">
                      <div className="text-sm text-gray-700">
                        {client.birthday
                          ? new Date(client.birthday).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })
                          : 'N/A'
                        }
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {((viewMode === 'leads' && filteredLeads.length === 0) ||
            (viewMode === 'clients' && filteredClients.length === 0)) && (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                No se encontraron {viewMode === 'leads' ? 'leads' : 'clientes'} con los filtros seleccionados
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}