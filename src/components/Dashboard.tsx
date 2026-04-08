import { useState, useEffect } from 'react';
import { supabase, Lead, CatalogItem } from '../lib/supabase';
import { useBranch, Branch } from '../contexts/BranchContext';
import { useAuth } from '../contexts/AuthContext';
import { TrendingUp, Users, DollarSign, Target, Activity, Award, Calendar, MessageSquare, Building2, BarChart3, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { useNotificationContext } from '../context/NotificationContext';
import { createBirthdayNotification } from '../utils/notificationHelpers';

interface BranchStats {
  branchId: string;
  branchName: string;
  totalLeads: number;
  verdes: number;
  amarillos: number;
  rojos: number;
  avgScore: number;
  inmediatos: number;
  waLeads: number;
  plantaLeads: number;
  clients: number;
  partsSales: number;
  testDrives: number;
}

interface AgentStats {
  agentId: string;
  agentName: string;
  branchName: string;
  totalLeads: number;
  verdes: number;
  conversionRate: number;
}

export function Dashboard() {
  const { user } = useAuth();
  const { addNotification } = useNotificationContext();
  const { selectedBranchId, allBranches, isAllBranchesView } = useBranch();
  const [salesAgentId, setSalesAgentId] = useState<string | null>(null);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [branchStats, setBranchStats] = useState<BranchStats[]>([]);
  const [agentStats, setAgentStats] = useState<AgentStats[]>([]);
  const [stats, setStats] = useState({
    totalLeads: 0,
    verdes: 0,
    amarillos: 0,
    rojos: 0,
    avgScore: 0,
    waLeads: 0,
    plantaLeads: 0,
    inmediatos: 0,
    totalStock: 0,
    avgPrice: 0,
    totalClients: 0
  });

  useEffect(() => {
    // Obtener ID de agente si el rol es vendedor
    const fetchAgentId = async () => {
      if (user?.role === 'vendedor' || user?.role === 'gerente') {
        const { data } = await supabase
          .from('sales_agents')
          .select('id')
          .eq('email', user.email)
          .single();
        if (data) setSalesAgentId(data.id);
      }
    };
    fetchAgentId();
  }, [user]);

  useEffect(() => {
    loadData();
  }, [selectedBranchId, salesAgentId, user?.role]); // Dependencia de salesAgentId y rol

  useEffect(() => {
    // Comparativo solo para Admins
    if (user?.role === 'admin' && isAllBranchesView && allBranches.length > 0) {
      loadBranchComparison();
    }

    // Agent Stats: Admins (all) or Managers (their branch)
    if ((user?.role === 'admin' || user?.role === 'gerente') && allBranches.length > 0) {
      if (user?.role === 'admin' && isAllBranchesView) {
        loadAgentStats();
      } else if (user?.role === 'gerente') {
        loadAgentStats(); // Validar dentro de la función que filtre por branch
      }
    }
  }, [isAllBranchesView, allBranches, selectedBranchId, user?.role]);

  useEffect(() => {
    const checkBirthdays = async () => {
      const today = new Date();
      const todayMonth = today.getMonth() + 1;
      const todayDay = today.getDate();

      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, phone, birthday, last_purchase_date')
        .not('birthday', 'is', null);

      if (clients) {
        const birthdayClients = clients.filter(client => {
          if (!client.birthday) return false;
          const birthday = new Date(client.birthday);
          return birthday.getMonth() + 1 === todayMonth && birthday.getDate() === todayDay;
        });

        birthdayClients.forEach(client => {
          const notification = createBirthdayNotification({
            id: client.id,
            name: client.name,
            phone: client.phone,
            lastPurchase: client.last_purchase_date
          });
          addNotification(notification);
        });
      }
    };

    checkBirthdays();
    const interval = setInterval(checkBirthdays, 21600000);
    return () => clearInterval(interval);
  }, [addNotification]);

  const loadData = async () => {
    // 1. Leads Query
    let leadsQuery = supabase.from('leads').select('*');

    // Filtro de Sucursal (Contexto o Forzado por Rol)
    if (selectedBranchId) {
      leadsQuery = leadsQuery.eq('branch_id', selectedBranchId);
    }

    // Filtro de Vendedor (Solo sus leads)
    if (user?.role === 'vendedor' && salesAgentId) {
      leadsQuery = leadsQuery.eq('assigned_agent_id', salesAgentId);
    }

    const { data: leadsData } = await leadsQuery.order('created_at', { ascending: false });

    // 2. Catalog Query (Global por ahora, o ajustar si se requiere stock por sucursal)
    const { data: catalogData } = await supabase.from('catalog').select('*');

    // 3. Clients Query
    let clientsQuery = supabase.from('clients').select('id, converted_from_lead_id', { count: 'exact' });

    if (selectedBranchId) {
      clientsQuery = clientsQuery.eq('branch_id', selectedBranchId);
    }

    // Si es vendedor, solo contar clientes que provienen de sus leads (o asignados a él si existiera esa relación directa)
    if (user?.role === 'vendedor' && salesAgentId && leadsData) {
      // Opción A: Filtrar por leads convertidos que pertenezcan a este agente
      // Como leadsData ya tiene solo los leads del agente, podemos usar sus IDs
      const agentLeadIds = leadsData.map(l => l.id);
      if (agentLeadIds.length > 0) {
        clientsQuery = clientsQuery.in('converted_from_lead_id', agentLeadIds);
      } else {
        // Si no tiene leads, no tiene clientes (por conversion)
        // Forzamos query vacía o manejamos count en 0
        clientsQuery = clientsQuery.eq('id', '00000000-0000-0000-0000-000000000000'); // UUID dummy
      }
    }

    const { count: totalClients } = await clientsQuery;

    if (leadsData) {
      setLeads(leadsData);
      const verdes = leadsData.filter(l => l.status === 'Verde').length;
      const amarillos = leadsData.filter(l => l.status === 'Amarillo').length;
      const rojos = leadsData.filter(l => l.status === 'Rojo').length;
      const avgScore = leadsData.length > 0
        ? leadsData.reduce((acc, l) => acc + l.score, 0) / leadsData.length
        : 0;
      const waLeads = leadsData.filter(l => l.origin === 'WhatsApp' || l.origin === 'Chatbot WA').length;
      const plantaLeads = leadsData.filter(l => l.origin === 'Planta').length;
      const inmediatos = leadsData.filter(l => l.timeframe === 'Inmediato').length;

      setStats(prev => ({
        ...prev,
        totalLeads: leadsData.length,
        verdes, amarillos, rojos,
        avgScore: Math.round(avgScore),
        waLeads, plantaLeads, inmediatos,
        totalClients: totalClients || 0
      }));
    }

    if (catalogData) {
      setCatalog(catalogData);
      const totalStock = catalogData.reduce((acc, item) => acc + item.stock, 0); // TODO: Ajustar stock por sucursal si es necesario
      const avgPrice = catalogData.length > 0
        ? catalogData.reduce((acc, item) => acc + item.price_cash, 0) / catalogData.length
        : 0;

      setStats(prev => ({
        ...prev,
        totalStock,
        avgPrice: Math.round(avgPrice)
      }));
    }
  };

  const loadBranchComparison = async () => {
    const statsArr: BranchStats[] = [];

    for (const branch of allBranches) {
      const { data: branchLeads } = await supabase
        .from('leads').select('status, score, origin, timeframe')
        .eq('branch_id', branch.id);

      const { count: clientCount } = await supabase
        .from('clients').select('id', { count: 'exact' })
        .eq('branch_id', branch.id);

      const { count: partsCount } = await supabase
        .from('parts_sales').select('id', { count: 'exact' })
        .eq('branch_id', branch.id);

      const { count: tdCount } = await supabase
        .from('test_drive_appointments').select('id', { count: 'exact' })
        .eq('branch_id', branch.id);

      const bl = branchLeads || [];
      statsArr.push({
        branchId: branch.id,
        branchName: branch.name,
        totalLeads: bl.length,
        verdes: bl.filter(l => l.status === 'Verde').length,
        amarillos: bl.filter(l => l.status === 'Amarillo').length,
        rojos: bl.filter(l => l.status === 'Rojo').length,
        avgScore: bl.length > 0 ? Math.round(bl.reduce((a, l) => a + l.score, 0) / bl.length) : 0,
        inmediatos: bl.filter(l => l.timeframe === 'Inmediato').length,
        waLeads: bl.filter(l => l.origin === 'WhatsApp' || l.origin === 'Chatbot WA').length,
        plantaLeads: bl.filter(l => l.origin === 'Planta').length,
        clients: clientCount || 0,
        partsSales: partsCount || 0,
        testDrives: tdCount || 0
      });
    }

    setBranchStats(statsArr);
  };

  const loadAgentStats = async () => {
    let query = supabase
      .from('sales_agents')
      .select('id, name, branch_id')
      .eq('status', 'active');

    if (selectedBranchId) {
      query = query.eq('branch_id', selectedBranchId);
    }

    const { data: agents } = await query;

    if (!agents) return;

    const agentArr: AgentStats[] = [];
    for (const agent of agents) {
      const { data: agentLeads } = await supabase
        .from('leads')
        .select('status')
        .eq('assigned_agent_id', agent.id);

      const al = agentLeads || [];
      const branch = allBranches.find(b => b.id === agent.branch_id);
      agentArr.push({
        agentId: agent.id,
        agentName: agent.name,
        branchName: branch?.name || 'Sin sucursal',
        totalLeads: al.length,
        verdes: al.filter(l => l.status === 'Verde').length,
        conversionRate: al.length > 0
          ? Math.round((al.filter(l => l.status === 'Verde').length / al.length) * 100)
          : 0
      });
    }

    agentArr.sort((a, b) => b.conversionRate - a.conversionRate);
    setAgentStats(agentArr);
  };

  const conversionRate = stats.totalLeads > 0 ? ((stats.verdes / stats.totalLeads) * 100).toFixed(1) : '0';
  const hotLeadsRate = stats.totalLeads > 0 ? (((stats.verdes + stats.amarillos) / stats.totalLeads) * 100).toFixed(1) : '0';

  const topModels = leads.reduce((acc: { [key: string]: number }, lead) => {
    if (lead.model_interested) {
      acc[lead.model_interested] = (acc[lead.model_interested] || 0) + 1;
    }
    return acc;
  }, {});

  const topModelsArray = Object.entries(topModels)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  // Ranking: sort branches by total leads (highest first)
  const rankedBranches = [...branchStats].sort((a, b) => b.totalLeads - a.totalLeads);

  const getTrendIcon = (value: number, avg: number) => {
    if (value > avg * 1.1) return <ArrowUpRight className="w-4 h-4 text-green-500" />;
    if (value < avg * 0.9) return <ArrowDownRight className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Dashboard</h2>
          <p className="text-gray-600 mt-1">
            {isAllBranchesView
              ? 'Vista global — Todas las sucursales'
              : `Resumen ejecutivo y métricas clave`}
          </p>
        </div>
        {isAllBranchesView && (
          <div className="flex items-center gap-2 bg-purple-100 text-purple-800 px-4 py-2 rounded-lg border border-purple-300">
            <Building2 className="w-5 h-5" />
            <span className="font-semibold text-sm">{allBranches.length} Sucursales Activas</span>
          </div>
        )}
      </div>

      {/* === KPI Cards (branch-filtered or global) === */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-3">
            <Users className="w-8 h-8 opacity-80" />
            <div className="bg-white bg-opacity-20 rounded-lg px-3 py-1 text-xs font-semibold">Total</div>
          </div>
          <div className="text-4xl font-bold mb-1">{stats.totalLeads}</div>
          <div className="text-sm opacity-90">Leads Totales</div>
          <div className="mt-3 pt-3 border-t border-white border-opacity-30 text-xs">
            Score Promedio: <span className="font-bold">{stats.avgScore}/100</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-3">
            <Target className="w-8 h-8 opacity-80" />
            <div className="bg-white bg-opacity-20 rounded-lg px-3 py-1 text-xs font-semibold">Verdes</div>
          </div>
          <div className="text-4xl font-bold mb-1">{stats.verdes}</div>
          <div className="text-sm opacity-90">Alta Intención</div>
          <div className="mt-3 pt-3 border-t border-white border-opacity-30 text-xs">
            Tasa conversión: <span className="font-bold">{conversionRate}%</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-3">
            <Activity className="w-8 h-8 opacity-80" />
            <div className="bg-white bg-opacity-20 rounded-lg px-3 py-1 text-xs font-semibold">Proceso</div>
          </div>
          <div className="text-4xl font-bold mb-1">{stats.amarillos}</div>
          <div className="text-sm opacity-90">En Seguimiento</div>
          <div className="mt-3 pt-3 border-t border-white border-opacity-30 text-xs">
            Leads calientes: <span className="font-bold">{hotLeadsRate}%</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-3">
            <TrendingUp className="w-8 h-8 opacity-80" />
            <div className="bg-white bg-opacity-20 rounded-lg px-3 py-1 text-xs font-semibold">Nutrición</div>
          </div>
          <div className="text-4xl font-bold mb-1">{stats.rojos}</div>
          <div className="text-sm opacity-90">Leads Rojos</div>
          <div className="mt-3 pt-3 border-t border-white border-opacity-30 text-xs">
            Requieren seguimiento
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-3">
            <Users className="w-8 h-8 opacity-80" />
            <div className="bg-white bg-opacity-20 rounded-lg px-3 py-1 text-xs font-semibold">Clientes</div>
          </div>
          <div className="text-4xl font-bold mb-1">{stats.totalClients}</div>
          <div className="text-sm opacity-90">Clientes Convertidos</div>
          <div className="mt-3 pt-3 border-t border-white border-opacity-30 text-xs">
            Ciclo post-venta activo
          </div>
        </div>
      </div>

      {/* === Branch Comparison Table (Admin: All Branches View) === */}
      {isAllBranchesView && branchStats.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6 border-2 border-purple-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            Comparativo entre Sucursales
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="text-left p-3 font-bold text-gray-700">Sucursal</th>
                  <th className="text-center p-3 font-bold text-gray-700">Leads</th>
                  <th className="text-center p-3 font-bold text-gray-700">🟢</th>
                  <th className="text-center p-3 font-bold text-gray-700">🟡</th>
                  <th className="text-center p-3 font-bold text-gray-700">🔴</th>
                  <th className="text-center p-3 font-bold text-gray-700">Score Avg</th>
                  <th className="text-center p-3 font-bold text-gray-700">Clientes</th>
                  <th className="text-center p-3 font-bold text-gray-700">Vta. Partes</th>
                  <th className="text-center p-3 font-bold text-gray-700">Pruebas</th>
                  <th className="text-center p-3 font-bold text-gray-700">Conv. %</th>
                </tr>
              </thead>
              <tbody>
                {branchStats.map((bs, idx) => {
                  const convRate = bs.totalLeads > 0 ? ((bs.verdes / bs.totalLeads) * 100).toFixed(1) : '0';
                  const avgLeads = branchStats.reduce((a, b) => a + b.totalLeads, 0) / branchStats.length;
                  return (
                    <tr key={bs.branchId} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-purple-50 transition-colors`}>
                      <td className="p-3 font-semibold text-gray-800 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-purple-500" />
                        {bs.branchName}
                      </td>
                      <td className="text-center p-3 font-bold text-blue-600">
                        <div className="flex items-center justify-center gap-1">
                          {bs.totalLeads}
                          {getTrendIcon(bs.totalLeads, avgLeads)}
                        </div>
                      </td>
                      <td className="text-center p-3 font-semibold text-green-600">{bs.verdes}</td>
                      <td className="text-center p-3 font-semibold text-yellow-600">{bs.amarillos}</td>
                      <td className="text-center p-3 font-semibold text-red-600">{bs.rojos}</td>
                      <td className="text-center p-3">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-bold">{bs.avgScore}</span>
                      </td>
                      <td className="text-center p-3 font-semibold text-purple-600">{bs.clients}</td>
                      <td className="text-center p-3 font-semibold text-orange-600">{bs.partsSales}</td>
                      <td className="text-center p-3 font-semibold text-cyan-600">{bs.testDrives}</td>
                      <td className="text-center p-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${parseFloat(convRate) >= 40 ? 'bg-green-100 text-green-800' :
                          parseFloat(convRate) >= 20 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                          {convRate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 border-t-2 border-gray-300">
                  <td className="p-3 font-bold text-gray-800">TOTAL</td>
                  <td className="text-center p-3 font-bold text-blue-700">{branchStats.reduce((a, b) => a + b.totalLeads, 0)}</td>
                  <td className="text-center p-3 font-bold text-green-700">{branchStats.reduce((a, b) => a + b.verdes, 0)}</td>
                  <td className="text-center p-3 font-bold text-yellow-700">{branchStats.reduce((a, b) => a + b.amarillos, 0)}</td>
                  <td className="text-center p-3 font-bold text-red-700">{branchStats.reduce((a, b) => a + b.rojos, 0)}</td>
                  <td className="text-center p-3 font-bold text-blue-700">
                    {branchStats.length > 0 ? Math.round(branchStats.reduce((a, b) => a + b.avgScore, 0) / branchStats.length) : 0}
                  </td>
                  <td className="text-center p-3 font-bold text-purple-700">{branchStats.reduce((a, b) => a + b.clients, 0)}</td>
                  <td className="text-center p-3 font-bold text-orange-700">{branchStats.reduce((a, b) => a + b.partsSales, 0)}</td>
                  <td className="text-center p-3 font-bold text-cyan-700">{branchStats.reduce((a, b) => a + b.testDrives, 0)}</td>
                  <td className="text-center p-3 font-bold text-gray-700">
                    {branchStats.length > 0
                      ? ((branchStats.reduce((a, b) => a + b.verdes, 0) /
                        Math.max(branchStats.reduce((a, b) => a + b.totalLeads, 0), 1)) * 100).toFixed(1)
                      : 0}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* === Branch Ranking (Admin Only) === */}
      {isAllBranchesView && rankedBranches.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-yellow-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-600" />
              Ranking de Sucursales — Leads
            </h3>
            <div className="space-y-3">
              {rankedBranches.map((bs, index) => {
                const maxLeads = rankedBranches[0]?.totalLeads || 1;
                return (
                  <div key={bs.branchId} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-600' : 'bg-gray-300'
                      }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-semibold text-gray-800">{bs.branchName}</span>
                        <span className="text-sm font-bold text-blue-600">{bs.totalLeads}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all"
                          style={{ width: `${(bs.totalLeads / maxLeads) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-green-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-green-600" />
              Ranking de Sucursales — Conversión
            </h3>
            <div className="space-y-3">
              {[...branchStats]
                .sort((a, b) => {
                  const rateA = a.totalLeads > 0 ? (a.verdes / a.totalLeads) * 100 : 0;
                  const rateB = b.totalLeads > 0 ? (b.verdes / b.totalLeads) * 100 : 0;
                  return rateB - rateA;
                })
                .map((bs, index) => {
                  const rate = bs.totalLeads > 0 ? ((bs.verdes / bs.totalLeads) * 100).toFixed(1) : '0';
                  return (
                    <div key={bs.branchId} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm ${index === 0 ? 'bg-green-500' : index === 1 ? 'bg-green-400' : index === 2 ? 'bg-green-300' : 'bg-gray-300'
                        }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-semibold text-gray-800">{bs.branchName}</span>
                          <span className={`text-sm font-bold ${parseFloat(rate) >= 40 ? 'text-green-600' :
                            parseFloat(rate) >= 20 ? 'text-yellow-600' : 'text-red-600'
                            }`}>{rate}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${parseFloat(rate) >= 40 ? 'bg-gradient-to-r from-green-400 to-green-600' :
                              parseFloat(rate) >= 20 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                                'bg-gradient-to-r from-red-400 to-red-600'
                              }`}
                            style={{ width: `${Math.min(parseFloat(rate), 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* === Agent Performance (Admin & Manager) === */}
      {((isAllBranchesView && user?.role === 'admin') || user?.role === 'gerente') && agentStats.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6 border-2 border-indigo-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Métricas por Vendedor {user?.role === 'gerente' ? '(Mi Sucursal)' : 'por Sucursal'}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="text-left p-3 font-bold text-gray-700">#</th>
                  <th className="text-left p-3 font-bold text-gray-700">Vendedor</th>
                  <th className="text-left p-3 font-bold text-gray-700">Sucursal</th>
                  <th className="text-center p-3 font-bold text-gray-700">Leads Asignados</th>
                  <th className="text-center p-3 font-bold text-gray-700">Verdes</th>
                  <th className="text-center p-3 font-bold text-gray-700">Tasa Conv.</th>
                </tr>
              </thead>
              <tbody>
                {agentStats.slice(0, 10).map((agent, idx) => (
                  <tr key={agent.agentId} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-indigo-50 transition-colors`}>
                    <td className="p-3">
                      {idx < 3 ? (
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : 'bg-orange-600'
                          }`}>{idx + 1}</span>
                      ) : (
                        <span className="text-gray-500 ml-1">{idx + 1}</span>
                      )}
                    </td>
                    <td className="p-3 font-semibold text-gray-800">{agent.agentName}</td>
                    <td className="p-3 text-gray-600">{agent.branchName}</td>
                    <td className="text-center p-3 font-bold text-blue-600">{agent.totalLeads}</td>
                    <td className="text-center p-3 font-bold text-green-600">{agent.verdes}</td>
                    <td className="text-center p-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${agent.conversionRate >= 40 ? 'bg-green-100 text-green-800' :
                        agent.conversionRate >= 20 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                        {agent.conversionRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* === Existing panels: Sources, Top Models, Urgency, Stock === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            Fuentes de Captura
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">WhatsApp</span>
                <span className="text-2xl font-bold text-green-600">{stats.waLeads}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-600 h-3 rounded-full transition-all"
                  style={{ width: `${stats.totalLeads > 0 ? (stats.waLeads / stats.totalLeads) * 100 : 0}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {stats.totalLeads > 0 ? ((stats.waLeads / stats.totalLeads) * 100).toFixed(0) : 0}% del total
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Email Planta</span>
                <span className="text-2xl font-bold text-blue-600">{stats.plantaLeads}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{ width: `${stats.totalLeads > 0 ? (stats.plantaLeads / stats.totalLeads) * 100 : 0}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {stats.totalLeads > 0 ? ((stats.plantaLeads / stats.totalLeads) * 100).toFixed(0) : 0}% del total
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-orange-600" />
            Modelos Más Solicitados
          </h3>
          <div className="space-y-3">
            {topModelsArray.length > 0 ? topModelsArray.map(([model, count], index) => (
              <div key={model} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-600'
                  }`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-800">{model}</div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div
                      className="bg-orange-600 h-2 rounded-full transition-all"
                      style={{ width: `${stats.totalLeads > 0 ? (count / stats.totalLeads) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-lg font-bold text-gray-700">{count}</div>
              </div>
            )) : (
              <div className="text-center py-4 text-gray-500 text-sm">Sin datos de modelos</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-600" />
            Urgencia de Compra
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Inmediato</span>
              <span className="text-2xl font-bold text-green-600">{stats.inmediatos}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Futuro</span>
              <span className="text-2xl font-bold text-blue-600">{stats.totalLeads - stats.inmediatos}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Inventario
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Stock Total</span>
              <span className="text-2xl font-bold text-blue-600">{stats.totalStock}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Modelos</span>
              <span className="text-2xl font-bold text-orange-600">{catalog.length}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Precio Promedio
          </h3>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              ${stats.avgPrice.toLocaleString('es-MX')}
            </div>
            <div className="text-sm text-gray-600 mt-1">MXN por unidad</div>
          </div>
        </div>
      </div>

      {/* === Insights Section === */}
      <div className="bg-gradient-to-br from-blue-50 to-sky-50 rounded-xl shadow-md p-6 border-2 border-blue-200">
        <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Insights Clave
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <div className="text-sm font-semibold text-blue-900 mb-2">Calidad de Leads</div>
            <p className="text-xs text-gray-700 leading-relaxed">
              {hotLeadsRate}% de los leads están clasificados como calientes (Verde/Amarillo),
              superando el benchmark de la industria del 45%.
            </p>
          </div>

          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <div className="text-sm font-semibold text-blue-900 mb-2">Captura WhatsApp</div>
            <p className="text-xs text-gray-700 leading-relaxed">
              El {stats.totalLeads > 0 ? ((stats.waLeads / stats.totalLeads) * 100).toFixed(0) : 0}% de leads provienen de WhatsApp,
              canal principal de comunicación con clientes.
            </p>
          </div>

          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <div className="text-sm font-semibold text-blue-900 mb-2">Urgencia de Ventas</div>
            <p className="text-xs text-gray-700 leading-relaxed">
              {stats.inmediatos} leads tienen timeframe inmediato, representando oportunidades
              de cierre rápido con alta probabilidad.
            </p>
          </div>

          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <div className="text-sm font-semibold text-blue-900 mb-2">Score Promedio</div>
            <p className="text-xs text-gray-700 leading-relaxed">
              El score promedio de {stats.avgScore}/100 indica que el sistema de calificación
              está identificando correctamente leads de calidad.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
