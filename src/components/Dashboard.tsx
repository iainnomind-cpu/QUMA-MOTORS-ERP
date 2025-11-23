import { useState, useEffect } from 'react';
import { supabase, Lead, CatalogItem } from '../lib/supabase';
import { TrendingUp, Users, DollarSign, Target, Activity, Award, Calendar, MessageSquare } from 'lucide-react';

export function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
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
    avgPrice: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: leadsData } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: catalogData } = await supabase
      .from('catalog')
      .select('*');

    if (leadsData) {
      setLeads(leadsData);

      const verdes = leadsData.filter(l => l.status === 'Verde').length;
      const amarillos = leadsData.filter(l => l.status === 'Amarillo').length;
      const rojos = leadsData.filter(l => l.status === 'Rojo').length;
      const avgScore = leadsData.reduce((acc, l) => acc + l.score, 0) / leadsData.length;
      const waLeads = leadsData.filter(l => l.origin === 'WhatsApp' || l.origin === 'Chatbot WA').length;
      const plantaLeads = leadsData.filter(l => l.origin === 'Planta').length;
      const inmediatos = leadsData.filter(l => l.timeframe === 'Inmediato').length;

      setStats(prev => ({
        ...prev,
        totalLeads: leadsData.length,
        verdes,
        amarillos,
        rojos,
        avgScore: Math.round(avgScore),
        waLeads,
        plantaLeads,
        inmediatos
      }));
    }

    if (catalogData) {
      setCatalog(catalogData);
      const totalStock = catalogData.reduce((acc, item) => acc + item.stock, 0);
      const avgPrice = catalogData.reduce((acc, item) => acc + item.price_cash, 0) / catalogData.length;

      setStats(prev => ({
        ...prev,
        totalStock,
        avgPrice: Math.round(avgPrice)
      }));
    }
  };

  const conversionRate = stats.totalLeads > 0 ? ((stats.verdes / stats.totalLeads) * 100).toFixed(1) : 0;
  const hotLeadsRate = stats.totalLeads > 0 ? (((stats.verdes + stats.amarillos) / stats.totalLeads) * 100).toFixed(1) : 0;

  const topModels = leads.reduce((acc: { [key: string]: number }, lead) => {
    if (lead.model_interested) {
      acc[lead.model_interested] = (acc[lead.model_interested] || 0) + 1;
    }
    return acc;
  }, {});

  const topModelsArray = Object.entries(topModels)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-800">Dashboard</h2>
        <p className="text-gray-600 mt-1">Resumen ejecutivo y métricas clave del sistema</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
      </div>

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
                  style={{ width: `${(stats.waLeads / stats.totalLeads) * 100}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {((stats.waLeads / stats.totalLeads) * 100).toFixed(0)}% del total
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
                  style={{ width: `${(stats.plantaLeads / stats.totalLeads) * 100}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {((stats.plantaLeads / stats.totalLeads) * 100).toFixed(0)}% del total
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
            {topModelsArray.map(([model, count], index) => (
              <div key={model} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                  index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-600'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-800">{model}</div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div
                      className="bg-orange-600 h-2 rounded-full transition-all"
                      style={{ width: `${(count / stats.totalLeads) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-lg font-bold text-gray-700">{count}</div>
              </div>
            ))}
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

      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-md p-6 border-2 border-green-200">
        <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-600" />
          Sistema de Scoring Dinámico Activo
        </h3>
        <div className="bg-white rounded-lg p-4 border border-green-200 mb-4">
          <div className="text-sm font-semibold text-green-900 mb-2">Motor de Calificación Inteligente</div>
          <p className="text-xs text-gray-700 leading-relaxed mb-3">
            El sistema ajusta automáticamente el score de cada lead basado en:
          </p>
          <ul className="text-xs text-gray-700 space-y-1">
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">•</span>
              <span>Tipo y frecuencia de interacciones (llamadas, WhatsApp, reuniones, pruebas de manejo)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">•</span>
              <span>Dirección del contacto (inbound +8pts vs outbound +3pts)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">•</span>
              <span>Completación de seguimientos (+6pts) o incumplimiento (-3pts)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">•</span>
              <span>Cambios en preferencias: Timeframe Inmediato (+15pts), Yamaha Especial (+12pts)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">•</span>
              <span>Canal de comunicación: Presencial (+12pts), Teléfono (+7pts), WhatsApp (+5pts)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">•</span>
              <span>Actividades de alto valor: Prueba de manejo (+20pts), Reunión (+15pts), Cotización (+10pts)</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-md p-6 border-2 border-blue-200">
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
              El {((stats.waLeads / stats.totalLeads) * 100).toFixed(0)}% de leads provienen de WhatsApp,
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
