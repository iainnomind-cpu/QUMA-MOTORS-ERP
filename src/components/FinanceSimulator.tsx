import { useState, useEffect } from 'react';
import { supabase, CatalogItem, FinancingRule, FinancingCampaign } from '../lib/supabase';
import { Calculator, AlertCircle, TrendingUp, DollarSign, Calendar, Percent, Settings, Plus, Edit2, Trash2, CheckCircle, X } from 'lucide-react';

type ViewMode = 'simulator' | 'rules' | 'campaigns';

export function FinanceSimulator() {
  const [viewMode, setViewMode] = useState<ViewMode>('simulator');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [financingRules, setFinancingRules] = useState<FinancingRule[]>([]);
  const [financingCampaigns, setFinancingCampaigns] = useState<FinancingCampaign[]>([]);

  const [selectedModel, setSelectedModel] = useState('');
  const [downPayment, setDownPayment] = useState(0);
  const [term, setTerm] = useState(12);
  const [selectedFinancingType, setSelectedFinancingType] = useState('');

  const [activeCampaign, setActiveCampaign] = useState<FinancingCampaign | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [editingRule, setEditingRule] = useState<FinancingRule | null>(null);

  const [newRule, setNewRule] = useState({
    financing_type: '',
    min_term_months: 6,
    max_term_months: 12,
    interest_rate: 0,
    min_down_payment_percent: 0,
    description: '',
    active: true
  });

  const [newCampaign, setNewCampaign] = useState({
    campaign_name: '',
    campaign_type: 'yamaha_special',
    provider: 'Yamaha Motor Finance',
    start_date: '',
    end_date: '',
    applicable_models: '',
    min_price: 0,
    down_payment_percent: 50,
    term_months: 12,
    interest_rate: 0,
    benefits_description: '',
    active: true,
    priority: 0
  });

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    checkActiveCampaign();
  }, [selectedModel, financingCampaigns, catalog]);

  useEffect(() => {
    if (financingRules.length > 0 && !selectedFinancingType) {
      setSelectedFinancingType(financingRules[0].financing_type);
    }
  }, [financingRules]);

  const loadAllData = async () => {
    await Promise.all([
      loadCatalog(),
      loadFinancingRules(),
      loadFinancingCampaigns()
    ]);
  };

  const loadCatalog = async () => {
    const { data } = await supabase
      .from('catalog')
      .select('*')
      .order('price_cash', { ascending: true });

    if (data) {
      setCatalog(data);
      if (data.length > 0) {
        setSelectedModel(data[0].model);
      }
    }
  };

  const loadFinancingRules = async () => {
    const { data } = await supabase
      .from('financing_rules')
      .select('*')
      .eq('active', true)
      .order('financing_type');

    if (data) setFinancingRules(data);
  };

  const loadFinancingCampaigns = async () => {
    const { data } = await supabase
      .from('financing_campaigns')
      .select('*')
      .eq('active', true)
      .order('priority', { ascending: false });

    if (data) setFinancingCampaigns(data);
  };

  const checkActiveCampaign = () => {
    const model = catalog.find(m => m.model === selectedModel);
    if (!model) {
      setActiveCampaign(null);
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    const validCampaigns = financingCampaigns.filter(campaign => {
      const isDateValid = campaign.start_date <= today && campaign.end_date >= today;
      const isModelApplicable = campaign.applicable_models.includes(selectedModel);
      const isPriceValid = !campaign.min_price || model.price_cash >= campaign.min_price;

      return campaign.active && isDateValid && isModelApplicable && isPriceValid;
    });

    if (validCampaigns.length > 0) {
      setActiveCampaign(validCampaigns[0]);
      setSelectedFinancingType('campaign');
      setTerm(validCampaigns[0].term_months);
      const calculatedDownPayment = (model.price_cash * validCampaigns[0].down_payment_percent) / 100;
      setDownPayment(calculatedDownPayment);
    } else {
      setActiveCampaign(null);
      if (selectedFinancingType === 'campaign') {
        setSelectedFinancingType(financingRules[0]?.financing_type || '');
      }
    }
  };

  const getSelectedRule = (): FinancingRule | null => {
    return financingRules.find(r => r.financing_type === selectedFinancingType) || null;
  };

  const calculateMonthlyPayment = (): number => {
    const model = catalog.find(m => m.model === selectedModel);
    if (!model) return 0;

    if (activeCampaign && selectedFinancingType === 'campaign') {
      if (activeCampaign.special_conditions?.hide_monthly_calculation) {
        return 0;
      }

      const amount = model.price_cash - downPayment;
      if (activeCampaign.interest_rate === 0) {
        return amount / activeCampaign.term_months;
      }

      const monthlyRate = activeCampaign.interest_rate / 12;
      return (amount * monthlyRate * Math.pow(1 + monthlyRate, activeCampaign.term_months)) /
             (Math.pow(1 + monthlyRate, activeCampaign.term_months) - 1);
    }

    const rule = getSelectedRule();
    if (!rule) return 0;

    const amount = model.price_cash - downPayment;

    if (rule.interest_rate === 0) {
      return amount / term;
    }

    const monthlyRate = rule.interest_rate / 12;
    return (amount * monthlyRate * Math.pow(1 + monthlyRate, term)) /
           (Math.pow(1 + monthlyRate, term) - 1);
  };

  const saveCalculation = async () => {
    const model = catalog.find(m => m.model === selectedModel);
    if (!model) return;

    const monthlyPayment = calculateMonthlyPayment();
    const totalAmount = downPayment + (monthlyPayment * term);
    const interestAmount = totalAmount - model.price_cash;

    await supabase
      .from('financing_calculations_log')
      .insert({
        model: selectedModel,
        price: model.price_cash,
        financing_type: selectedFinancingType,
        campaign_id: activeCampaign?.id || null,
        down_payment: downPayment,
        term_months: term,
        monthly_payment: monthlyPayment,
        total_amount: totalAmount,
        interest_amount: interestAmount,
        calculation_source: 'simulator'
      });
  };

  const handleCreateRule = async () => {
    if (!newRule.financing_type.trim()) {
      alert('El tipo de financiamiento es obligatorio');
      return;
    }

    if (newRule.min_term_months <= 0 || newRule.max_term_months <= 0) {
      alert('Los plazos deben ser mayores a 0');
      return;
    }

    if (newRule.min_term_months > newRule.max_term_months) {
      alert('El plazo mínimo no puede ser mayor al plazo máximo');
      return;
    }

    const { error } = await supabase
      .from('financing_rules')
      .insert([{
        financing_type: newRule.financing_type.trim(),
        min_term_months: newRule.min_term_months,
        max_term_months: newRule.max_term_months,
        interest_rate: newRule.interest_rate / 100,
        min_down_payment_percent: newRule.min_down_payment_percent,
        description: newRule.description?.trim() || null,
        active: newRule.active,
        requires_minimum_price: false,
        minimum_price: null,
        fixed_down_payment_percent: null
      }]);

    if (error) {
      console.error('Error al crear regla:', error);
      alert(`Error al crear regla: ${error.message}`);
      return;
    }

    setSuccessMessage('Regla de financiamiento creada exitosamente');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
    setShowRuleModal(false);
    setNewRule({
      financing_type: '',
      min_term_months: 6,
      max_term_months: 12,
      interest_rate: 0,
      min_down_payment_percent: 0,
      description: '',
      active: true
    });
    loadFinancingRules();
  };

  const handleUpdateRule = async () => {
    if (!editingRule) return;

    if (!newRule.financing_type.trim()) {
      alert('El tipo de financiamiento es obligatorio');
      return;
    }

    if (newRule.min_term_months <= 0 || newRule.max_term_months <= 0) {
      alert('Los plazos deben ser mayores a 0');
      return;
    }

    if (newRule.min_term_months > newRule.max_term_months) {
      alert('El plazo mínimo no puede ser mayor al plazo máximo');
      return;
    }

    const { error } = await supabase
      .from('financing_rules')
      .update({
        min_term_months: newRule.min_term_months,
        max_term_months: newRule.max_term_months,
        interest_rate: newRule.interest_rate / 100,
        min_down_payment_percent: newRule.min_down_payment_percent,
        description: newRule.description?.trim() || null,
        active: newRule.active,
        updated_at: new Date().toISOString()
      })
      .eq('id', editingRule.id);

    if (error) {
      console.error('Error al actualizar regla:', error);
      alert(`Error al actualizar regla: ${error.message}`);
      return;
    }

    setSuccessMessage('Regla actualizada exitosamente');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
    setShowRuleModal(false);
    setEditingRule(null);
    setNewRule({
      financing_type: '',
      min_term_months: 6,
      max_term_months: 12,
      interest_rate: 0,
      min_down_payment_percent: 0,
      description: '',
      active: true
    });
    loadFinancingRules();
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('¿Eliminar esta regla?')) return;

    const { error } = await supabase
      .from('financing_rules')
      .update({ active: false })
      .eq('id', id);

    if (!error) {
      setSuccessMessage('Regla desactivada');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      loadFinancingRules();
    }
  };

  const handleCreateCampaign = async () => {
    const modelsArray = newCampaign.applicable_models.split(',').map(m => m.trim()).filter(m => m);

    const { error } = await supabase
      .from('financing_campaigns')
      .insert([{
        ...newCampaign,
        applicable_models: modelsArray,
        interest_rate: newCampaign.interest_rate / 100,
        special_conditions: {
          show_promotion_banner: true,
          hide_monthly_calculation: newCampaign.campaign_type === 'yamaha_special',
          contact_agent: true
        }
      }]);

    if (!error) {
      setSuccessMessage('Campaña creada');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      setShowCampaignModal(false);
      setNewCampaign({
        campaign_name: '',
        campaign_type: 'yamaha_special',
        provider: 'Yamaha Motor Finance',
        start_date: '',
        end_date: '',
        applicable_models: '',
        min_price: 0,
        down_payment_percent: 50,
        term_months: 12,
        interest_rate: 0,
        benefits_description: '',
        active: true,
        priority: 0
      });
      loadFinancingCampaigns();
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('¿Eliminar esta campaña?')) return;

    const { error } = await supabase
      .from('financing_campaigns')
      .update({ active: false })
      .eq('id', id);

    if (!error) {
      setSuccessMessage('Campaña desactivada');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      loadFinancingCampaigns();
    }
  };

  const selectedModelData = catalog.find(m => m.model === selectedModel);
  const selectedRule = getSelectedRule();
  const availableTerms = selectedRule
    ? Array.from(
        { length: (selectedRule.max_term_months - selectedRule.min_term_months) / 6 + 1 },
        (_, i) => selectedRule.min_term_months + i * 6
      ).filter(t => t <= selectedRule.max_term_months)
    : [6, 12, 18, 24];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Calculator className="w-7 h-7 text-green-600" />
          Simulador Financiero Estratégico
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
            onClick={() => setViewMode('simulator')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              viewMode === 'simulator'
                ? 'bg-green-50 text-green-700 border-b-2 border-green-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Calculator className="w-5 h-5" />
              Simulador
            </div>
          </button>
          <button
            onClick={() => setViewMode('rules')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              viewMode === 'rules'
                ? 'bg-green-50 text-green-700 border-b-2 border-green-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Settings className="w-5 h-5" />
              Reglas Fijas ({financingRules.length})
            </div>
          </button>
          <button
            onClick={() => setViewMode('campaigns')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              viewMode === 'campaigns'
                ? 'bg-green-50 text-green-700 border-b-2 border-green-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Campañas Variables ({financingCampaigns.length})
            </div>
          </button>
        </div>

        <div className="p-6">
          {viewMode === 'simulator' && (
            <div className="space-y-6">
              {catalog.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-xl font-bold text-gray-800 mb-2">No hay modelos en el catálogo</h3>
                  <p className="text-gray-600 mb-4">
                    Para usar el simulador financiero, primero necesitas agregar modelos al catálogo.
                  </p>
                  <p className="text-sm text-gray-500">
                    Ve al módulo de Catálogo para agregar motocicletas.
                  </p>
                </div>
              ) : (
                <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Modelo</label>
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      >
                        {catalog.map((item) => (
                          <option key={item.id} value={item.model}>
                            {item.model} - ${item.price_cash.toLocaleString('es-MX')} MXN
                          </option>
                        ))}
                      </select>
                    </div>

                  {!activeCampaign && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Plan de Financiamiento</label>
                        <div className="space-y-2">
                          {financingRules.map((rule) => (
                            <label
                              key={rule.id}
                              className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50"
                              style={{
                                borderColor: selectedFinancingType === rule.financing_type ? '#16a34a' : '#e5e7eb',
                                backgroundColor: selectedFinancingType === rule.financing_type ? '#f0fdf4' : 'white'
                              }}
                            >
                              <input
                                type="radio"
                                name="financing"
                                value={rule.financing_type}
                                checked={selectedFinancingType === rule.financing_type}
                                onChange={(e) => {
                                  setSelectedFinancingType(e.target.value);
                                  setTerm(rule.min_term_months);
                                }}
                                className="w-4 h-4 accent-green-600"
                              />
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-700">{rule.financing_type}</div>
                                <div className="text-xs text-gray-500 mt-1">{rule.description}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Plazo (meses)</label>
                        <div className="grid grid-cols-4 gap-2">
                          {availableTerms.map((t) => (
                            <button
                              key={t}
                              onClick={() => setTerm(t)}
                              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                                term === t
                                  ? 'bg-green-600 text-white shadow-lg'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      {selectedModelData && (
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Enganche: ${downPayment.toLocaleString('es-MX')} MXN
                            {selectedRule && selectedRule.min_down_payment_percent > 0 && (
                              <span className="text-xs text-orange-600 ml-2">
                                (Mínimo: {selectedRule.min_down_payment_percent}%)
                              </span>
                            )}
                          </label>
                          <input
                            type="range"
                            min={selectedRule ? (selectedModelData.price_cash * selectedRule.min_down_payment_percent) / 100 : 0}
                            max={selectedModelData.price_cash}
                            step="5000"
                            value={downPayment}
                            onChange={(e) => setDownPayment(Number(e.target.value))}
                            className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>
                              ${selectedRule ? ((selectedModelData.price_cash * selectedRule.min_down_payment_percent) / 100).toLocaleString('es-MX') : '0'}
                            </span>
                            <span>${selectedModelData.price_cash.toLocaleString('es-MX')}</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="space-y-4">
                  {activeCampaign ? (
                    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 border-2 border-yellow-300">
                      <div className="flex items-start gap-3 mb-4">
                        <AlertCircle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
                        <div>
                          <h3 className="text-lg font-bold text-orange-900 mb-2">{activeCampaign.campaign_name}</h3>
                          <p className="text-sm text-orange-800 leading-relaxed mb-3">
                            {activeCampaign.benefits_description}
                          </p>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-4 mb-4">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-600">Proveedor:</span>
                            <div className="font-semibold text-gray-800">{activeCampaign.provider}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Plazo:</span>
                            <div className="font-semibold text-gray-800">{activeCampaign.term_months} meses</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Enganche:</span>
                            <div className="font-semibold text-gray-800">{activeCampaign.down_payment_percent}%</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Interés:</span>
                            <div className="font-semibold text-gray-800">
                              {activeCampaign.interest_rate === 0 ? 'Sin Intereses' : `${(activeCampaign.interest_rate * 100).toFixed(2)}%`}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-orange-100 border border-orange-300 rounded-lg p-4 text-center">
                        <div className="text-xs text-orange-700 uppercase tracking-wide mb-1">Monto de Enganche</div>
                        <div className="text-3xl font-bold text-orange-900">
                          ${downPayment.toLocaleString('es-MX')}
                        </div>
                        <div className="text-xs text-orange-700 mt-2">
                          Contacte a un agente para iniciar el trámite
                        </div>
                      </div>

                      <div className="mt-4 text-xs text-gray-600 text-center">
                        Vigencia: {new Date(activeCampaign.start_date).toLocaleDateString('es-MX')} al {new Date(activeCampaign.end_date).toLocaleDateString('es-MX')}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-200">
                      <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-600" />
                        Resumen de Financiamiento
                      </h3>

                      {selectedModelData && (
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Modelo:</span>
                            <span className="text-sm font-bold text-gray-900">{selectedModelData.model}</span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Precio:</span>
                            <span className="text-sm font-bold text-gray-900">
                              ${selectedModelData.price_cash.toLocaleString('es-MX')} MXN
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Enganche:</span>
                            <span className="text-sm font-bold text-gray-900">
                              ${downPayment.toLocaleString('es-MX')} MXN
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Monto a Financiar:</span>
                            <span className="text-sm font-bold text-gray-900">
                              ${(selectedModelData.price_cash - downPayment).toLocaleString('es-MX')} MXN
                            </span>
                          </div>

                          <div className="border-t-2 border-green-300 pt-3 mt-3">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm text-gray-600">Plan:</span>
                              <span className="text-sm font-bold text-gray-900">{selectedFinancingType}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Plazo:</span>
                              <span className="text-sm font-bold text-gray-900">{term} meses</span>
                            </div>
                            {selectedRule && selectedRule.interest_rate > 0 && (
                              <div className="flex justify-between items-center mt-2">
                                <span className="text-sm text-gray-600">Tasa Anual:</span>
                                <span className="text-sm font-bold text-gray-900">
                                  {(selectedRule.interest_rate * 100).toFixed(2)}%
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="bg-green-600 rounded-lg p-4 mt-4">
                            <div className="text-center">
                              <div className="text-xs text-green-100 uppercase tracking-wide mb-1">Mensualidad Estimada</div>
                              <div className="text-3xl font-bold text-white">
                                ${Math.round(calculateMonthlyPayment()).toLocaleString('es-MX')}
                              </div>
                              <div className="text-xs text-green-100 mt-1">MXN/mes</div>
                            </div>
                          </div>

                          <button
                            onClick={saveCalculation}
                            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                          >
                            <CheckCircle className="w-5 h-5" />
                            Guardar Cálculo
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-6 border-2 border-blue-200">
                <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Sistema de Financiamiento Inteligente
                </h4>
                <ul className="space-y-2 text-sm text-blue-800">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>Las reglas fijas codifican los planes estándar de la concesionaria (Corto Plazo Interno, Caja Colón)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>Las campañas variables gestionan promociones temporales de Yamaha/Banco por modelo y periodo</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>El sistema prioriza automáticamente campañas activas vigentes sobre reglas generales</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>Todos los cálculos se registran para análisis y seguimiento histórico</span>
                  </li>
                </ul>
              </div>
            </>
            )}
          </div>
          )}

          {viewMode === 'rules' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-700">Reglas de Financiamiento Fijas</h3>
                <button
                  onClick={() => {
                    setEditingRule(null);
                    setNewRule({
                      financing_type: '',
                      min_term_months: 6,
                      max_term_months: 12,
                      interest_rate: 0,
                      min_down_payment_percent: 0,
                      description: '',
                      active: true
                    });
                    setShowRuleModal(true);
                  }}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Nueva Regla
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {financingRules.map(rule => (
                  <div key={rule.id} className="bg-white rounded-lg p-5 border-2 border-gray-200 hover:border-green-400 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-800 text-lg mb-2">{rule.financing_type}</h4>
                        <p className="text-sm text-gray-600 mb-3">{rule.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingRule(rule);
                            setNewRule({
                              financing_type: rule.financing_type,
                              min_term_months: rule.min_term_months,
                              max_term_months: rule.max_term_months,
                              interest_rate: rule.interest_rate * 100,
                              min_down_payment_percent: rule.min_down_payment_percent,
                              description: rule.description || '',
                              active: rule.active
                            });
                            setShowRuleModal(true);
                          }}
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

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-blue-50 rounded-lg p-3">
                        <div className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Plazo
                        </div>
                        <div className="text-sm font-bold text-blue-600">
                          {rule.min_term_months === rule.max_term_months
                            ? `${rule.min_term_months} meses`
                            : `${rule.min_term_months}-${rule.max_term_months} meses`
                          }
                        </div>
                      </div>

                      <div className="bg-green-50 rounded-lg p-3">
                        <div className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                          <Percent className="w-3 h-3" />
                          Tasa Anual
                        </div>
                        <div className="text-sm font-bold text-green-600">
                          {rule.interest_rate === 0 ? 'Sin Intereses' : `${(rule.interest_rate * 100).toFixed(2)}%`}
                        </div>
                      </div>

                      <div className="bg-orange-50 rounded-lg p-3">
                        <div className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          Enganche Mín.
                        </div>
                        <div className="text-sm font-bold text-orange-600">
                          {rule.min_down_payment_percent}%
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs text-gray-600 mb-1">Estado</div>
                        <div className={`text-sm font-bold ${rule.active ? 'text-green-600' : 'text-gray-400'}`}>
                          {rule.active ? 'Activa' : 'Inactiva'}
                        </div>
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
                <h3 className="text-lg font-semibold text-gray-700">Campañas de Financiamiento Variables</h3>
                <button
                  onClick={() => {
                    setNewCampaign({
                      campaign_name: '',
                      campaign_type: 'yamaha_special',
                      provider: 'Yamaha Motor Finance',
                      start_date: '',
                      end_date: '',
                      applicable_models: '',
                      min_price: 0,
                      down_payment_percent: 50,
                      term_months: 12,
                      interest_rate: 0,
                      benefits_description: '',
                      active: true,
                      priority: 0
                    });
                    setShowCampaignModal(true);
                  }}
                  className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Nueva Campaña
                </button>
              </div>

              <div className="space-y-4">
                {financingCampaigns.map(campaign => {
                  const isCurrentlyActive = campaign.start_date <= new Date().toISOString().split('T')[0] &&
                                           campaign.end_date >= new Date().toISOString().split('T')[0];

                  return (
                    <div key={campaign.id} className={`bg-white rounded-lg p-5 border-2 ${
                      isCurrentlyActive ? 'border-orange-300 bg-orange-50' : 'border-gray-200'
                    }`}>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-bold text-gray-800 text-lg">{campaign.campaign_name}</h4>
                            {isCurrentlyActive && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded border border-green-300">
                                VIGENTE
                              </span>
                            )}
                            <span className={`px-2 py-1 text-xs font-bold rounded ${
                              campaign.priority >= 100 ? 'bg-red-100 text-red-800 border border-red-300' :
                              campaign.priority >= 50 ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' :
                              'bg-blue-100 text-blue-800 border border-blue-300'
                            }`}>
                              Prioridad: {campaign.priority}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mb-3">{campaign.benefits_description}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDeleteCampaign(campaign.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <div className="bg-blue-50 rounded-lg p-3">
                          <div className="text-xs text-gray-600 mb-1">Proveedor</div>
                          <div className="text-sm font-bold text-blue-600">{campaign.provider}</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3">
                          <div className="text-xs text-gray-600 mb-1">Plazo</div>
                          <div className="text-sm font-bold text-green-600">{campaign.term_months} meses</div>
                        </div>
                        <div className="bg-orange-50 rounded-lg p-3">
                          <div className="text-xs text-gray-600 mb-1">Enganche</div>
                          <div className="text-sm font-bold text-orange-600">{campaign.down_payment_percent}%</div>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-3">
                          <div className="text-xs text-gray-600 mb-1">Tasa</div>
                          <div className="text-sm font-bold text-purple-600">
                            {campaign.interest_rate === 0 ? 'S/I' : `${(campaign.interest_rate * 100).toFixed(2)}%`}
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3 mb-3">
                        <div className="text-xs font-semibold text-gray-600 mb-2">MODELOS APLICABLES:</div>
                        <div className="flex flex-wrap gap-2">
                          {campaign.applicable_models.map((model, idx) => (
                            <span key={idx} className="px-2 py-1 bg-white text-gray-800 rounded text-xs font-medium border border-gray-300">
                              {model}
                            </span>
                          ))}
                        </div>
                      </div>

                      {campaign.min_price && (
                        <div className="bg-yellow-50 rounded p-2 mb-3 text-xs text-yellow-800">
                          <span className="font-semibold">Precio mínimo requerido:</span> ${campaign.min_price.toLocaleString('es-MX')} MXN
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {new Date(campaign.start_date).toLocaleDateString('es-MX')} al {new Date(campaign.end_date).toLocaleDateString('es-MX')}
                          </span>
                        </div>
                        <div className={`font-semibold ${campaign.active ? 'text-green-600' : 'text-gray-400'}`}>
                          {campaign.active ? 'Activa' : 'Inactiva'}
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

      {showRuleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowRuleModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">
                {editingRule ? 'Editar Regla' : 'Nueva Regla de Financiamiento'}
              </h3>
              <button onClick={() => setShowRuleModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de Financiamiento</label>
                <input
                  type="text"
                  value={newRule.financing_type}
                  onChange={(e) => setNewRule({ ...newRule, financing_type: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                  placeholder="Ej: Corto Plazo Interno"
                  disabled={!!editingRule}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Plazo Mínimo (meses)</label>
                  <input
                    type="number"
                    value={newRule.min_term_months}
                    onChange={(e) => setNewRule({ ...newRule, min_term_months: Number(e.target.value) })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Plazo Máximo (meses)</label>
                  <input
                    type="number"
                    value={newRule.max_term_months}
                    onChange={(e) => setNewRule({ ...newRule, max_term_months: Number(e.target.value) })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tasa de Interés Anual (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newRule.interest_rate}
                    onChange={(e) => setNewRule({ ...newRule, interest_rate: Number(e.target.value) })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                    placeholder="Ej: 15.00 (para 15%)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Enganche Mínimo (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newRule.min_down_payment_percent}
                    onChange={(e) => setNewRule({ ...newRule, min_down_payment_percent: Number(e.target.value) })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Descripción</label>
                <textarea
                  value={newRule.description}
                  onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none h-20"
                  placeholder="Descripción del plan de financiamiento"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newRule.active}
                  onChange={(e) => setNewRule({ ...newRule, active: e.target.checked })}
                  className="w-4 h-4"
                />
                <label className="text-sm font-medium text-gray-700">Regla activa</label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={editingRule ? handleUpdateRule : handleCreateRule}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                >
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

      {showCampaignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-auto" onClick={() => setShowCampaignModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full my-8" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-xl font-bold text-gray-800">Nueva Campaña de Financiamiento</h3>
              <button onClick={() => setShowCampaignModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre de la Campaña</label>
                <input
                  type="text"
                  value={newCampaign.campaign_name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, campaign_name: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  placeholder="Ej: Yamaha Especial Octubre-Diciembre 2025"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de Campaña</label>
                  <select
                    value={newCampaign.campaign_type}
                    onChange={(e) => setNewCampaign({ ...newCampaign, campaign_type: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  >
                    <option value="yamaha_special">Yamaha Especial</option>
                    <option value="bank_promotion">Promoción Bancaria</option>
                    <option value="seasonal">Temporada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Proveedor</label>
                  <input
                    type="text"
                    value={newCampaign.provider}
                    onChange={(e) => setNewCampaign({ ...newCampaign, provider: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha Inicio</label>
                  <input
                    type="date"
                    value={newCampaign.start_date}
                    onChange={(e) => setNewCampaign({ ...newCampaign, start_date: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha Fin</label>
                  <input
                    type="date"
                    value={newCampaign.end_date}
                    onChange={(e) => setNewCampaign({ ...newCampaign, end_date: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Modelos Aplicables (separados por coma)</label>
                <input
                  type="text"
                  value={newCampaign.applicable_models}
                  onChange={(e) => setNewCampaign({ ...newCampaign, applicable_models: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  placeholder="MT-07, YZF-R3, Tenere 700"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Precio Mínimo (MXN)</label>
                  <input
                    type="number"
                    value={newCampaign.min_price}
                    onChange={(e) => setNewCampaign({ ...newCampaign, min_price: Number(e.target.value) })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Prioridad</label>
                  <input
                    type="number"
                    value={newCampaign.priority}
                    onChange={(e) => setNewCampaign({ ...newCampaign, priority: Number(e.target.value) })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                    placeholder="0-100 (mayor = más prioritario)"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Enganche (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newCampaign.down_payment_percent}
                    onChange={(e) => setNewCampaign({ ...newCampaign, down_payment_percent: Number(e.target.value) })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Plazo (meses)</label>
                  <input
                    type="number"
                    value={newCampaign.term_months}
                    onChange={(e) => setNewCampaign({ ...newCampaign, term_months: Number(e.target.value) })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tasa Anual (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newCampaign.interest_rate}
                    onChange={(e) => setNewCampaign({ ...newCampaign, interest_rate: Number(e.target.value) })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                    placeholder="0 para S/I"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Descripción de Beneficios</label>
                <textarea
                  value={newCampaign.benefits_description}
                  onChange={(e) => setNewCampaign({ ...newCampaign, benefits_description: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none h-24"
                  placeholder="Descripción completa de la promoción"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newCampaign.active}
                  onChange={(e) => setNewCampaign({ ...newCampaign, active: e.target.checked })}
                  className="w-4 h-4"
                />
                <label className="text-sm font-medium text-gray-700">Campaña activa</label>
              </div>
              <div className="flex gap-3 pt-4 sticky bottom-0 bg-white">
                <button
                  onClick={handleCreateCampaign}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
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
