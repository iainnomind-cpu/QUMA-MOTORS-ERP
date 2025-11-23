import { useState, useEffect } from 'react';
import { supabase, TestDriveAppointment, ServiceAppointment, ServiceTechnician, ServiceHistory, ServiceReminder, CatalogItem, Lead, Client } from '../lib/supabase';
import { useNotificationContext } from '../context/NotificationContext';
import {
  Calendar, Clock, CheckCircle, XCircle, Wrench, Car, User, Phone, Mail, Plus, Edit2, Eye, X,
  MapPin, FileText, TrendingUp, AlertCircle, Filter, Bell, Activity, Award, Bike, Trash2
} from 'lucide-react';

type ViewMode = 'test_drives' | 'service' | 'history' | 'technicians';

export function SchedulingModule() {
  const [viewMode, setViewMode] = useState<ViewMode>('test_drives');
  const [testDrives, setTestDrives] = useState<TestDriveAppointment[]>([]);
  const [serviceAppointments, setServiceAppointments] = useState<ServiceAppointment[]>([]);
  const [technicians, setTechnicians] = useState<ServiceTechnician[]>([]);
  const [serviceHistory, setServiceHistory] = useState<ServiceHistory[]>([]);
  const [reminders, setReminders] = useState<ServiceReminder[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const { addNotification } = useNotificationContext();

  const [showTestDriveModal, setShowTestDriveModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showTechnicianModal, setShowTechnicianModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<TestDriveAppointment | ServiceAppointment | null>(null);
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const [newTestDrive, setNewTestDrive] = useState({
    lead_id: '',
    catalog_model: '',
    appointment_date: '',
    duration_minutes: 30,
    pickup_location: 'agencia',
    notes: ''
  });

  const [newService, setNewService] = useState({
    client_id: '',
    technician_id: '',
    appointment_date: '',
    service_type: 'preventivo',
    estimated_duration_minutes: 120,
    vehicle_model: '',
    vehicle_plate: '',
    mileage: '',
    services_requested: '',
    notes: ''
  });

  const [newTechnician, setNewTechnician] = useState({
    name: '',
    email: '',
    phone: '',
    specialties: '',
    status: 'active',
    max_daily_appointments: 8,
    working_hours_start: '09:00',
    working_hours_end: '18:00'
  });

  useEffect(() => {
    loadAllData();
    syncTestDrivesFromLeads();

    const testDriveSubscription = supabase
      .channel('test_drive_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'test_drive_appointments' }, () => {
        loadTestDrives();
      })
      .subscribe();

    const leadSubscription = supabase
      .channel('lead_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        syncTestDrivesFromLeads();
      })
      .subscribe();

    return () => {
      testDriveSubscription.unsubscribe();
      leadSubscription.unsubscribe();
    };
  }, []);

  const loadAllData = async () => {
    await Promise.all([
      loadTestDrives(),
      loadServiceAppointments(),
      loadTechnicians(),
      loadServiceHistory(),
      loadReminders(),
      loadCatalog(),
      loadLeads(),
      loadClients()
    ]);
    setLoading(false);
  };

  const loadTestDrives = async () => {
    const { data } = await supabase
      .from('test_drive_appointments')
      .select('*')
      .order('appointment_date', { ascending: true });
    if (data) setTestDrives(data);
  };

  const syncTestDrivesFromLeads = async () => {
    const { data: leadsWithTestDrive } = await supabase
      .from('leads')
      .select('*')
      .eq('test_drive_requested', true)
      .not('test_drive_date', 'is', null);

    if (leadsWithTestDrive && leadsWithTestDrive.length > 0) {
      for (const lead of leadsWithTestDrive) {
        const { data: existingAppointment } = await supabase
          .from('test_drive_appointments')
          .select('*')
          .eq('lead_id', lead.id)
          .eq('status', 'scheduled')
          .maybeSingle();

        if (!existingAppointment && lead.model_interested) {
          await supabase
            .from('test_drive_appointments')
            .insert([{
              lead_id: lead.id,
              lead_name: lead.name,
              lead_phone: lead.phone,
              catalog_model: lead.model_interested,
              appointment_date: lead.test_drive_date,
              duration_minutes: 30,
              status: 'scheduled',
              pickup_location: 'agencia',
              notes: 'Sincronizado automáticamente desde lead existente'
            }]);
        }
      }
      loadTestDrives();
    }
  };

  const loadServiceAppointments = async () => {
    const { data } = await supabase
      .from('service_appointments')
      .select('*')
      .order('appointment_date', { ascending: true });
    if (data) setServiceAppointments(data);
  };

  const loadTechnicians = async () => {
    const { data } = await supabase
      .from('service_technicians')
      .select('*')
      .order('name');
    if (data) setTechnicians(data);
  };

  const loadServiceHistory = async () => {
    const { data } = await supabase
      .from('service_history')
      .select('*')
      .order('service_date', { ascending: false })
      .limit(50);
    if (data) setServiceHistory(data);
  };

  const loadReminders = async () => {
    const { data } = await supabase
      .from('service_reminders')
      .select('*')
      .order('next_service_due_date', { ascending: true });
    if (data) setReminders(data);
  };

  const loadCatalog = async () => {
    const { data } = await supabase
      .from('catalog')
      .select('*')
      .eq('active', true)
      .eq('test_drive_available', true);
    if (data) setCatalog(data);
  };

  const loadLeads = async () => {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .order('name');
    if (data) setLeads(data);
  };

  const loadClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('name');
    if (data) setClients(data);
  };

  const handleCreateTestDrive = async () => {
    const selectedLead = leads.find(l => l.id === newTestDrive.lead_id);
    if (!selectedLead) {
      alert('Por favor selecciona un lead válido');
      return;
    }

    const { data: catalogItem } = await supabase
      .from('catalog')
      .select('id')
      .eq('model', newTestDrive.catalog_model)
      .eq('active', true)
      .maybeSingle();

    const appointmentData = {
      lead_id: newTestDrive.lead_id,
      lead_name: selectedLead.name,
      lead_phone: selectedLead.phone,
      catalog_item_id: catalogItem?.id || null,
      catalog_model: newTestDrive.catalog_model,
      appointment_date: newTestDrive.appointment_date,
      duration_minutes: newTestDrive.duration_minutes,
      pickup_location: newTestDrive.pickup_location,
      notes: newTestDrive.notes,
      status: 'scheduled'
    };

    const { error } = await supabase
      .from('test_drive_appointments')
      .insert([appointmentData]);

    if (!error) {
      await supabase
        .from('leads')
        .update({
          test_drive_requested: true,
          test_drive_date: newTestDrive.appointment_date,
          updated_at: new Date().toISOString()
        })
        .eq('id', newTestDrive.lead_id);

      setSuccessMessage('Prueba de manejo agendada exitosamente');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      addNotification({
        type: 'test_drive_scheduled',
        title: 'Prueba de Manejo Agendada',
        message: `Nueva prueba de manejo: ${selectedLead.name} - ${newTestDrive.catalog_model} el ${new Date(newTestDrive.appointment_date).toLocaleString('es-MX')}`,
        priority: 'medium',
        category: 'appointment',
        entity_type: 'test_drive',
        metadata: {
          lead_name: selectedLead.name,
          model: newTestDrive.catalog_model,
          date: newTestDrive.appointment_date
        }
      });

      setShowTestDriveModal(false);
      setNewTestDrive({ lead_id: '', catalog_model: '', appointment_date: '', duration_minutes: 30, pickup_location: 'agencia', notes: '' });
      loadTestDrives();
      loadLeads();
    }
  };

  const handleCreateServiceAppointment = async () => {
    const selectedClient = clients.find(c => c.id === newService.client_id);
    const selectedTechnician = technicians.find(t => t.id === newService.technician_id);

    if (!selectedClient || !selectedTechnician) {
      alert('Por favor selecciona un cliente y técnico válidos');
      return;
    }

    const appointmentData = {
      client_id: newService.client_id,
      client_name: selectedClient.name,
      client_phone: selectedClient.phone,
      technician_id: newService.technician_id,
      technician_name: selectedTechnician.name,
      appointment_date: newService.appointment_date,
      service_type: newService.service_type,
      estimated_duration_minutes: newService.estimated_duration_minutes,
      vehicle_model: newService.vehicle_model,
      vehicle_plate: newService.vehicle_plate,
      mileage: newService.mileage ? parseInt(newService.mileage) : null,
      services_requested: newService.services_requested.split(',').map(s => s.trim()).filter(s => s),
      notes: newService.notes,
      status: 'scheduled'
    };

    const { error } = await supabase
      .from('service_appointments')
      .insert([appointmentData]);

    if (!error) {
      setSuccessMessage('Cita de servicio agendada exitosamente');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      addNotification({
        type: 'service_scheduled',
        title: 'Servicio Técnico Agendado',
        message: `Nuevo servicio: ${selectedClient.name} - ${newService.service_type} el ${new Date(newService.appointment_date).toLocaleString('es-MX')}`,
        priority: 'medium',
        category: 'service',
        entity_type: 'service_appointment',
        metadata: {
          client_name: selectedClient.name,
          service_type: newService.service_type,
          technician: selectedTechnician.name,
          date: newService.appointment_date
        }
      });

      setShowServiceModal(false);
      setNewService({ client_id: '', technician_id: '', appointment_date: '', service_type: 'preventivo', estimated_duration_minutes: 120, vehicle_model: '', vehicle_plate: '', mileage: '', services_requested: '', notes: '' });
      loadServiceAppointments();
    }
  };

  const handleCompleteTestDrive = async (appointment: TestDriveAppointment) => {
    const { error } = await supabase
      .from('test_drive_appointments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', appointment.id);

    if (!error) {
      if (appointment.lead_id) {
        await supabase
          .from('leads')
          .update({
            test_drive_completed: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', appointment.lead_id);
      }

      setSuccessMessage('Prueba de manejo marcada como completada');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      loadTestDrives();
      loadLeads();
    }
  };

  const handleCompleteServiceAppointment = async (appointment: ServiceAppointment) => {
    const { error } = await supabase
      .from('service_appointments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', appointment.id);

    if (!error) {
      const historyData = {
        client_id: appointment.client_id,
        client_name: appointment.client_name,
        service_appointment_id: appointment.id,
        service_date: new Date().toISOString().split('T')[0],
        service_type: appointment.service_type,
        vehicle_model: appointment.vehicle_model,
        mileage: appointment.mileage,
        services_performed: appointment.services_performed,
        parts_used: appointment.parts_used,
        total_cost: appointment.total_cost,
        technician_id: appointment.technician_id,
        technician_name: appointment.technician_name
      };

      await supabase.from('service_history').insert([historyData]);

      setSuccessMessage('Servicio completado y registrado en historial');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      loadServiceAppointments();
      loadServiceHistory();
    }
  };

  const handleDeleteTestDrive = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta prueba de manejo?')) return;

    const { error } = await supabase
      .from('test_drive_appointments')
      .delete()
      .eq('id', id);

    if (!error) {
      setSuccessMessage('Prueba de manejo eliminada');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      loadTestDrives();
    }
  };

  const handleDeleteServiceAppointment = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este servicio?')) return;

    const { error } = await supabase
      .from('service_appointments')
      .delete()
      .eq('id', id);

    if (!error) {
      setSuccessMessage('Servicio eliminado');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      loadServiceAppointments();
    }
  };

  const handleCreateTechnician = async () => {
    if (!newTechnician.name.trim()) {
      alert('Por favor ingresa el nombre del técnico');
      return;
    }

    const technicianData = {
      name: newTechnician.name.trim(),
      email: newTechnician.email.trim() || null,
      phone: newTechnician.phone.trim() || null,
      specialties: newTechnician.specialties ? newTechnician.specialties.split(',').map(s => s.trim()).filter(s => s) : [],
      status: newTechnician.status,
      max_daily_appointments: newTechnician.max_daily_appointments,
      working_hours_start: newTechnician.working_hours_start,
      working_hours_end: newTechnician.working_hours_end
    };

    const { error } = await supabase
      .from('service_technicians')
      .insert([technicianData]);

    if (!error) {
      setSuccessMessage('Técnico agregado exitosamente');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      setShowTechnicianModal(false);
      setNewTechnician({
        name: '',
        email: '',
        phone: '',
        specialties: '',
        status: 'active',
        max_daily_appointments: 8,
        working_hours_start: '09:00',
        working_hours_end: '18:00'
      });
      loadTechnicians();
    }
  };

  const handleDeleteTechnician = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este técnico? Esta acción no se puede deshacer.')) return;

    const { error } = await supabase
      .from('service_technicians')
      .delete()
      .eq('id', id);

    if (!error) {
      setSuccessMessage('Técnico eliminado');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      loadTechnicians();
    } else {
      alert('Error al eliminar técnico. Puede tener servicios asignados.');
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'completed': return 'bg-green-100 text-green-800 border-green-300';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-300';
      case 'no_show': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getServiceTypeBadge = (type: string) => {
    switch (type) {
      case 'preventivo': return 'bg-green-100 text-green-800 border-green-300';
      case 'correctivo': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'garantia': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'diagnostico': return 'bg-purple-100 text-purple-800 border-purple-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const filteredTestDrives = testDrives.filter(td => {
    const matchesDate = !filterDate || td.appointment_date.startsWith(filterDate);
    const matchesStatus = filterStatus === 'all' || td.status === filterStatus;
    return matchesDate && matchesStatus;
  });

  const filteredServiceAppointments = serviceAppointments.filter(sa => {
    const matchesDate = !filterDate || sa.appointment_date.startsWith(filterDate);
    const matchesStatus = filterStatus === 'all' || sa.status === filterStatus;
    return matchesDate && matchesStatus;
  });

  const upcomingReminders = reminders.filter(r => {
    if (!r.next_service_due_date) return false;
    const dueDate = new Date(r.next_service_due_date);
    const today = new Date();
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilDue <= 30 && daysUntilDue >= 0 && r.status === 'pending';
  });

  const stats = {
    scheduledTestDrives: testDrives.filter(td => td.status === 'scheduled').length,
    completedTestDrives: testDrives.filter(td => td.status === 'completed').length,
    scheduledServices: serviceAppointments.filter(sa => sa.status === 'scheduled').length,
    completedServices: serviceAppointments.filter(sa => sa.status === 'completed').length,
    activeTechnicians: technicians.filter(t => t.status === 'active').length,
    pendingReminders: upcomingReminders.length
  };

  if (loading) {
    return <div className="text-center py-8">Cargando módulo de agendamiento...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="w-7 h-7 text-blue-600" />
            Agendamiento: Pruebas de Manejo y Servicio
          </h2>
          <p className="text-sm text-gray-600 mt-1">Control de recursos críticos y calendario de citas</p>
        </div>
      </div>

      {showSuccess && (
        <div className="bg-green-100 border-2 border-green-400 text-green-800 px-4 py-3 rounded-lg flex items-center gap-3">
          <TrendingUp className="w-5 h-5" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <Bike className="w-6 h-6 opacity-80" />
            <div className="text-3xl font-bold">{stats.scheduledTestDrives}</div>
          </div>
          <div className="text-sm font-semibold">Pruebas Agendadas</div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-6 h-6 opacity-80" />
            <div className="text-3xl font-bold">{stats.completedTestDrives}</div>
          </div>
          <div className="text-sm font-semibold">Pruebas Completadas</div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <Wrench className="w-6 h-6 opacity-80" />
            <div className="text-3xl font-bold">{stats.scheduledServices}</div>
          </div>
          <div className="text-sm font-semibold">Servicios Agendados</div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg shadow-lg p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-6 h-6 opacity-80" />
            <div className="text-3xl font-bold">{stats.completedServices}</div>
          </div>
          <div className="text-sm font-semibold">Servicios Completados</div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <User className="w-6 h-6 opacity-80" />
            <div className="text-3xl font-bold">{stats.activeTechnicians}</div>
          </div>
          <div className="text-sm font-semibold">Técnicos Activos</div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <Award className="w-6 h-6 opacity-80" />
            <div className="text-3xl font-bold">{upcomingReminders.length}</div>
          </div>
          <div className="text-sm font-semibold">Servicios Próximos</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md border-2 border-gray-200">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setViewMode('test_drives')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              viewMode === 'test_drives'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Bike className="w-5 h-5" />
              Pruebas de Manejo
            </div>
          </button>
          <button
            onClick={() => setViewMode('service')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              viewMode === 'service'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Wrench className="w-5 h-5" />
              Servicio Técnico
            </div>
          </button>
          <button
            onClick={() => setViewMode('history')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              viewMode === 'history'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <FileText className="w-5 h-5" />
              Historial
            </div>
          </button>
          <button
            onClick={() => setViewMode('technicians')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              viewMode === 'technicians'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Wrench className="w-5 h-5" />
              Técnicos
            </div>
          </button>
        </div>

        <div className="p-6">
          {viewMode === 'test_drives' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-700">Citas de Prueba de Manejo</h3>
                <button
                  onClick={() => setShowTestDriveModal(true)}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Agendar Prueba
                </button>
              </div>

              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="all">Todos los estados</option>
                  <option value="scheduled">Agendado</option>
                  <option value="completed">Completado</option>
                  <option value="cancelled">Cancelado</option>
                  <option value="no_show">No se presentó</option>
                </select>
              </div>

              <div className="space-y-3">
                {filteredTestDrives.map(appointment => (
                  <div key={appointment.id} className="bg-white rounded-lg p-5 border-2 border-gray-200 hover:border-blue-400 transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h4 className="font-bold text-gray-800 text-lg">{appointment.lead_name}</h4>
                          <span className={`px-2 py-1 text-xs font-bold rounded border ${getStatusBadgeColor(appointment.status)}`}>
                            {appointment.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                          <div className="flex items-center gap-2 text-gray-700">
                            <Bike className="w-4 h-4 text-blue-600" />
                            <span className="font-semibold">{appointment.catalog_model}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-700">
                            <Calendar className="w-4 h-4 text-green-600" />
                            <span>{new Date(appointment.appointment_date).toLocaleString('es-MX')}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-700">
                            <Clock className="w-4 h-4 text-orange-600" />
                            <span>{appointment.duration_minutes} min</span>
                          </div>
                          {appointment.lead_phone && (
                            <div className="flex items-center gap-2 text-gray-700">
                              <Phone className="w-4 h-4 text-blue-600" />
                              <span>{appointment.lead_phone}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-gray-700">
                            <MapPin className="w-4 h-4 text-red-600" />
                            <span>{appointment.pickup_location}</span>
                          </div>
                        </div>
                        {appointment.notes && (
                          <div className="mt-3 bg-gray-50 rounded p-3">
                            <p className="text-sm text-gray-700">{appointment.notes}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        {appointment.status === 'scheduled' && (
                          <button
                            onClick={() => handleCompleteTestDrive(appointment)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Marcar como completada"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteTestDrive(appointment.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredTestDrives.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    No hay pruebas de manejo agendadas
                  </div>
                )}
              </div>
            </div>
          )}

          {viewMode === 'service' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-700">Citas de Servicio Técnico</h3>
                <button
                  onClick={() => setShowServiceModal(true)}
                  className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Agendar Servicio
                </button>
              </div>

              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                >
                  <option value="all">Todos los estados</option>
                  <option value="scheduled">Agendado</option>
                  <option value="in_progress">En Progreso</option>
                  <option value="completed">Completado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>

              <div className="space-y-3">
                {filteredServiceAppointments.map(appointment => (
                  <div key={appointment.id} className="bg-white rounded-lg p-5 border-2 border-gray-200 hover:border-orange-400 transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h4 className="font-bold text-gray-800 text-lg">{appointment.client_name}</h4>
                          <span className={`px-2 py-1 text-xs font-bold rounded border ${getStatusBadgeColor(appointment.status)}`}>
                            {appointment.status}
                          </span>
                          <span className={`px-2 py-1 text-xs font-bold rounded border ${getServiceTypeBadge(appointment.service_type)}`}>
                            {appointment.service_type}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm mb-3">
                          <div className="flex items-center gap-2 text-gray-700">
                            <Calendar className="w-4 h-4 text-blue-600" />
                            <span>{new Date(appointment.appointment_date).toLocaleString('es-MX')}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-700">
                            <User className="w-4 h-4 text-green-600" />
                            <span>{appointment.technician_name || 'Sin asignar'}</span>
                          </div>
                          {appointment.vehicle_model && (
                            <div className="flex items-center gap-2 text-gray-700">
                              <Car className="w-4 h-4 text-orange-600" />
                              <span>{appointment.vehicle_model}</span>
                            </div>
                          )}
                          {appointment.vehicle_plate && (
                            <div className="flex items-center gap-2 text-gray-700">
                              <FileText className="w-4 h-4 text-gray-600" />
                              <span>{appointment.vehicle_plate}</span>
                            </div>
                          )}
                        </div>
                        {appointment.services_requested.length > 0 && (
                          <div className="bg-gray-50 rounded p-3">
                            <div className="text-xs font-semibold text-gray-600 mb-2">SERVICIOS SOLICITADOS:</div>
                            <div className="flex flex-wrap gap-2">
                              {appointment.services_requested.map((service, idx) => (
                                <span key={idx} className="text-xs bg-white px-2 py-1 rounded border border-gray-300">
                                  {service}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        {appointment.status === 'scheduled' && (
                          <button
                            onClick={() => handleCompleteServiceAppointment(appointment)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Marcar como completado"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteServiceAppointment(appointment.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredServiceAppointments.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    No hay servicios técnicos agendados
                  </div>
                )}
              </div>
            </div>
          )}

          {viewMode === 'history' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Historial de Servicios</h3>
              <div className="space-y-3">
                {serviceHistory.map(record => (
                  <div key={record.id} className="bg-white rounded-lg p-5 border-2 border-gray-200">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-gray-800 text-lg">{record.client_name}</h4>
                        <div className="text-sm text-gray-600 mt-1">
                          {new Date(record.service_date).toLocaleDateString('es-MX')} • {record.vehicle_model}
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs font-bold rounded border ${getServiceTypeBadge(record.service_type)}`}>
                        {record.service_type}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs font-semibold text-gray-600 mb-1">SERVICIOS REALIZADOS</div>
                        <div className="space-y-1">
                          {record.services_performed.map((service, idx) => (
                            <div key={idx} className="text-sm text-gray-700 flex items-center gap-2">
                              <CheckCircle className="w-3 h-3 text-green-600" />
                              {service}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-600 mb-1">TÉCNICO</div>
                        <div className="text-sm text-gray-700">{record.technician_name || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-600 mb-1">COSTO TOTAL</div>
                        <div className="text-lg font-bold text-green-600">${record.total_cost.toLocaleString('es-MX')}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {serviceHistory.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    No hay historial de servicios
                  </div>
                )}
              </div>
            </div>
          )}


          {viewMode === 'technicians' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-700">Técnicos de Servicio</h3>
                <button
                  onClick={() => setShowTechnicianModal(true)}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Agregar Técnico
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {technicians.map(tech => (
                  <div key={tech.id} className="bg-white rounded-lg p-5 border-2 border-gray-200 hover:border-purple-400 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-100 rounded-full p-3">
                          <User className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800">{tech.name}</h4>
                          <span className={`text-xs font-semibold ${
                            tech.status === 'active' ? 'text-green-600' : 'text-gray-500'
                          }`}>
                            {tech.status}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteTechnician(tech.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Eliminar técnico"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="space-y-2 text-sm">
                      {tech.email && (
                        <div className="flex items-center gap-2 text-gray-700">
                          <Mail className="w-4 h-4 text-blue-600" />
                          <span className="truncate">{tech.email}</span>
                        </div>
                      )}
                      {tech.phone && (
                        <div className="flex items-center gap-2 text-gray-700">
                          <Phone className="w-4 h-4 text-green-600" />
                          <span>{tech.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-gray-700">
                        <Clock className="w-4 h-4 text-orange-600" />
                        <span>{tech.working_hours_start} - {tech.working_hours_end}</span>
                      </div>
                    </div>
                    {tech.specialties.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-semibold text-gray-600 mb-2">ESPECIALIDADES</div>
                        <div className="flex flex-wrap gap-1">
                          {tech.specialties.map((specialty, idx) => (
                            <span key={idx} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {specialty}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {technicians.length === 0 && (
                  <div className="col-span-3 text-center py-12 text-gray-500">
                    No hay técnicos registrados
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200">
        <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" />
          Interconexiones del Módulo
        </h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>Valida disponibilidad de modelos en el catálogo antes de agendar pruebas de manejo</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>Registra automáticamente servicios completados en el historial del cliente</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>Genera recordatorios automáticos basados en fechas y kilometraje</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>Envía notificaciones vía WhatsApp/Email a través del Módulo de Marketing</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>Conectado con inventario de refacciones para trazabilidad de partes</span>
          </li>
        </ul>
      </div>

      {showTestDriveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowTestDriveModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full my-8" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white rounded-t-xl">
              <h3 className="text-xl font-bold text-gray-800">Agendar Prueba de Manejo</h3>
              <button onClick={() => setShowTestDriveModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Lead</label>
                <select
                  value={newTestDrive.lead_id}
                  onChange={(e) => setNewTestDrive({ ...newTestDrive, lead_id: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Seleccionar lead...</option>
                  {leads.map(lead => (
                    <option key={lead.id} value={lead.id}>
                      {lead.name} - {lead.phone}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Modelo a Probar</label>
                <select
                  value={newTestDrive.catalog_model}
                  onChange={(e) => setNewTestDrive({ ...newTestDrive, catalog_model: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Seleccionar modelo...</option>
                  {catalog.map(item => (
                    <option key={item.id} value={item.model}>
                      {item.model} - {item.segment}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha y Hora</label>
                <input
                  type="datetime-local"
                  value={newTestDrive.appointment_date}
                  onChange={(e) => setNewTestDrive({ ...newTestDrive, appointment_date: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Duración (minutos)</label>
                  <input
                    type="number"
                    value={newTestDrive.duration_minutes}
                    onChange={(e) => setNewTestDrive({ ...newTestDrive, duration_minutes: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Punto de Partida</label>
                  <select
                    value={newTestDrive.pickup_location}
                    onChange={(e) => setNewTestDrive({ ...newTestDrive, pickup_location: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="agencia">Agencia</option>
                    <option value="domicilio">Domicilio del Cliente</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Notas</label>
                <textarea
                  value={newTestDrive.notes}
                  onChange={(e) => setNewTestDrive({ ...newTestDrive, notes: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none h-24"
                  placeholder="Observaciones adicionales..."
                />
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex gap-3 sticky bottom-0 bg-white rounded-b-xl">
              <button
                onClick={handleCreateTestDrive}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
              >
                Agendar Prueba
              </button>
              <button
                onClick={() => setShowTestDriveModal(false)}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showServiceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowServiceModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full my-8" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white rounded-t-xl">
              <h3 className="text-xl font-bold text-gray-800">Agendar Servicio Técnico</h3>
              <button onClick={() => setShowServiceModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Cliente</label>
                  <select
                    value={newService.client_id}
                    onChange={(e) => setNewService({ ...newService, client_id: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  >
                    <option value="">Seleccionar cliente...</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.name} - {client.phone}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Técnico</label>
                  <select
                    value={newService.technician_id}
                    onChange={(e) => setNewService({ ...newService, technician_id: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  >
                    <option value="">Seleccionar técnico...</option>
                    {technicians.filter(t => t.status === 'active').map(tech => (
                      <option key={tech.id} value={tech.id}>
                        {tech.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha y Hora</label>
                  <input
                    type="datetime-local"
                    value={newService.appointment_date}
                    onChange={(e) => setNewService({ ...newService, appointment_date: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de Servicio</label>
                  <select
                    value={newService.service_type}
                    onChange={(e) => setNewService({ ...newService, service_type: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  >
                    <option value="preventivo">Mantenimiento Preventivo</option>
                    <option value="correctivo">Mantenimiento Correctivo</option>
                    <option value="garantia">Servicio de Garantía</option>
                    <option value="diagnostico">Diagnóstico</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Modelo</label>
                  <input
                    type="text"
                    value={newService.vehicle_model}
                    onChange={(e) => setNewService({ ...newService, vehicle_model: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                    placeholder="MT-07, YZF-R3..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Placa</label>
                  <input
                    type="text"
                    value={newService.vehicle_plate}
                    onChange={(e) => setNewService({ ...newService, vehicle_plate: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                    placeholder="ABC-123"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Kilometraje</label>
                  <input
                    type="number"
                    value={newService.mileage}
                    onChange={(e) => setNewService({ ...newService, mileage: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                    placeholder="5000"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Servicios Solicitados (separados por coma)</label>
                <input
                  type="text"
                  value={newService.services_requested}
                  onChange={(e) => setNewService({ ...newService, services_requested: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  placeholder="Cambio de aceite, Revisión de frenos, Ajuste de cadena"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Notas</label>
                <textarea
                  value={newService.notes}
                  onChange={(e) => setNewService({ ...newService, notes: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none h-24"
                  placeholder="Observaciones adicionales..."
                />
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex gap-3 sticky bottom-0 bg-white rounded-b-xl">
              <button
                onClick={handleCreateServiceAppointment}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
              >
                Agendar Servicio
              </button>
              <button
                onClick={() => setShowServiceModal(false)}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showTechnicianModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowTechnicianModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full my-8" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white rounded-t-xl">
              <h3 className="text-xl font-bold text-gray-800">Agregar Técnico de Servicio</h3>
              <button onClick={() => setShowTechnicianModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre Completo *</label>
                <input
                  type="text"
                  value={newTechnician.name}
                  onChange={(e) => setNewTechnician({ ...newTechnician, name: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                  placeholder="Juan Pérez"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={newTechnician.email}
                    onChange={(e) => setNewTechnician({ ...newTechnician, email: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                    placeholder="juan@qumamotors.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Teléfono</label>
                  <input
                    type="tel"
                    value={newTechnician.phone}
                    onChange={(e) => setNewTechnician({ ...newTechnician, phone: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                    placeholder="+52 999 123 4567"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Especialidades (separadas por coma)</label>
                <input
                  type="text"
                  value={newTechnician.specialties}
                  onChange={(e) => setNewTechnician({ ...newTechnician, specialties: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                  placeholder="Mecánica, Electrónica, Carrocería"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Estado</label>
                  <select
                    value={newTechnician.status}
                    onChange={(e) => setNewTechnician({ ...newTechnician, status: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Hora Inicio</label>
                  <input
                    type="time"
                    value={newTechnician.working_hours_start}
                    onChange={(e) => setNewTechnician({ ...newTechnician, working_hours_start: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Hora Fin</label>
                  <input
                    type="time"
                    value={newTechnician.working_hours_end}
                    onChange={(e) => setNewTechnician({ ...newTechnician, working_hours_end: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Citas Máximas por Día</label>
                <input
                  type="number"
                  value={newTechnician.max_daily_appointments}
                  onChange={(e) => setNewTechnician({ ...newTechnician, max_daily_appointments: parseInt(e.target.value) || 8 })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                  min="1"
                  max="20"
                />
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex gap-3 sticky bottom-0 bg-white rounded-b-xl">
              <button
                onClick={handleCreateTechnician}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
              >
                Agregar Técnico
              </button>
              <button
                onClick={() => setShowTechnicianModal(false)}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
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
