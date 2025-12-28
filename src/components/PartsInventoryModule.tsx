import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Package, Plus, X, CreditCard as Edit2, Trash2, Search, Filter, TrendingUp, DollarSign, AlertTriangle, ShoppingCart, BarChart3, Eye } from 'lucide-react';

interface PartItem {
  id: string;
  sku: string;
  name: string;
  category: 'refaccion' | 'accesorio';
  subcategory: string | null;
  description: string | null;
  compatible_models: string[];
  brand: string | null;
  price_retail: number;
  cost_price: number;
  stock_quantity: number;
  min_stock_alert: number;
  location: string | null;
  supplier: string | null;
  image_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface PartSale {
  id: string;
  sale_date: string;
  customer_name: string;
  customer_phone: string | null;
  customer_type: 'walk-in' | 'cliente' | 'lead';
  related_customer_id: string | null;
  items: any[];
  subtotal: number;
  discount: number;
  total: number;
  payment_method: string | null;
  notes: string | null;
  sold_by: string | null;
  created_at: string;
}

interface InventoryMovement {
  id: string;
  part_id: string;
  movement_type: 'entrada' | 'salida' | 'ajuste' | 'venta';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason: string | null;
  reference_id: string | null;
  performed_by: string | null;
  created_at: string;
}

export function PartsInventoryModule() {
  const [parts, setParts] = useState<PartItem[]>([]);
  const [sales, setSales] = useState<PartSale[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'inventory' | 'sales' | 'movements'>('inventory');
  const [showPartModal, setShowPartModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [editingPart, setEditingPart] = useState<PartItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'refaccion' | 'accesorio'>('all');
  const [lowStockFilter, setLowStockFilter] = useState(false);

  const [partFormData, setPartFormData] = useState({
    sku: '',
    name: '',
    category: 'refaccion' as 'refaccion' | 'accesorio',
    subcategory: '',
    description: '',
    compatible_models: '',
    brand: '',
    sale_price: '',
    cost: '',
    stock: '',
    min_stock: '',
    location: '',
    supplier: '',
    active: true
  });

  const [saleFormData, setSaleFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_type: 'walk-in' as 'walk-in' | 'cliente' | 'lead',
    items: [] as any[],
    payment_method: '',
    notes: '',
    part_id: '',
    quantity: '',
    unit_price: ''
  });

  const [movementFormData, setMovementFormData] = useState({
    part_id: '',
    movement_type: 'entrada' as 'entrada' | 'salida' | 'ajuste' | 'venta',
    quantity: '',
    reason: ''
  });

  const [newSaleItem, setNewSaleItem] = useState({
    part_id: '',
    quantity: '',
    unit_price: ''
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([loadParts(), loadSales(), loadMovements()]);
    setLoading(false);
  };

  const loadParts = async () => {
    const { data, error } = await supabase
      .from('parts_accessories_inventory')
      .select('*')
      .order('name');

    if (!error && data) {
      setParts(data);
    }
  };

  const loadSales = async () => {
    const { data, error } = await supabase
      .from('parts_sales')
      .select('*')
      .order('sale_date', { ascending: false });

    if (!error && data) {
      setSales(data);
    }
  };

  const loadMovements = async () => {
    const { data, error } = await supabase
      .from('parts_inventory_movements')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setMovements(data);
    }
  };

  const handleOpenPartModal = (part?: PartItem) => {
    if (part) {
      setEditingPart(part);
      setPartFormData({
        sku: part.sku,
        name: part.name,
        category: part.category,
        subcategory: part.subcategory || '',
        description: part.description || '',
        compatible_models: part.compatible_models?.join(', ') || '',
        brand: part.brand || '',
        sale_price: part.price_retail?.toString() || '',
        cost: part.cost_price?.toString() || '',
        stock: part.stock_quantity?.toString() || '',
        min_stock: part.min_stock_alert?.toString() || '',
        location: part.location || '',
        supplier: part.supplier || '',
        active: part.active
      });
    } else {
      setEditingPart(null);
      setPartFormData({
        sku: '',
        name: '',
        category: 'refaccion',
        subcategory: '',
        description: '',
        compatible_models: '',
        brand: '',
        sale_price: '',
        cost: '',
        stock: '',
        min_stock: '',
        location: '',
        supplier: '',
        active: true
      });
    }
    setShowPartModal(true);
  };

  const handleSavePart = async () => {
    const partData = {
      ...partFormData,
      compatible_models: partFormData.compatible_models.split(',').map(m => m.trim()).filter(m => m),
      price_retail: parseFloat(partFormData.sale_price) || 0,
      cost_price: parseFloat(partFormData.cost) || 0,
      stock_quantity: parseInt(partFormData.stock) || 0,
      min_stock_alert: parseInt(partFormData.min_stock) || 5
    };

    if (editingPart) {
      const { error } = await supabase
        .from('parts_accessories_inventory')
        .update(partData)
        .eq('id', editingPart.id);

      if (!error) {
        loadParts();
        setShowPartModal(false);
      }
    } else {
      const { error } = await supabase
        .from('parts_accessories_inventory')
        .insert([partData]);

      if (!error) {
        loadParts();
        setShowPartModal(false);
      }
    }
  };

  const handleDeletePart = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este producto?')) {
      const { error } = await supabase
        .from('parts_accessories_inventory')
        .delete()
        .eq('id', id);

      if (!error) {
        loadParts();
      }
    }
  };

  const handleAddSaleItem = () => {
    const part = parts.find(p => p.id === newSaleItem.part_id);
    if (part && newSaleItem.quantity && newSaleItem.unit_price) {
      const quantity = parseInt(newSaleItem.quantity);
      const unitPrice = parseFloat(newSaleItem.unit_price);
      const total = quantity * unitPrice;

      const item = {
        part_id: part.id,
        part_name: part.name,
        quantity,
        unit_price: unitPrice,
        total
      };

      setSaleFormData(prev => ({
        ...prev,
        items: [...prev.items, item]
      }));

      setNewSaleItem({
        part_id: '',
        quantity: '',
        unit_price: ''
      });
    }
  };

  const handleRemoveSaleItem = (index: number) => {
    setSaleFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleSaveSale = async () => {
    const subtotal = saleFormData.items.reduce((sum, item) => sum + item.total, 0);
    const total = subtotal; // Sin descuento por ahora

    const saleData = {
      ...saleFormData,
      items: saleFormData.items,
      subtotal,
      total,
      discount: 0
    };

    const { error } = await supabase
      .from('parts_sales')
      .insert([saleData]);

    if (!error) {
      // Actualizar stock de cada item vendido
      for (const item of saleFormData.items) {
        const part = parts.find(p => p.id === item.part_id);
        if (part) {
          await supabase
            .from('parts_accessories_inventory')
            .update({ stock_quantity: part.stock_quantity - item.quantity })
            .eq('id', item.part_id);

          // Registrar movimiento de inventario
          await supabase
            .from('parts_inventory_movements')
            .insert([{
              part_id: item.part_id,
              movement_type: 'venta',
              quantity: -item.quantity,
              previous_stock: part.stock_quantity,
              new_stock: part.stock_quantity - item.quantity,
              reason: `Venta a ${saleFormData.customer_name}`
            }]);
        }
      }

      loadAllData();
      setShowSaleModal(false);
      setSaleFormData({
        customer_name: '',
        customer_phone: '',
        customer_type: 'walk-in',
        items: [],
        payment_method: '',
        notes: '',
        part_id: '',
        quantity: '',
        unit_price: ''
      });
    }
  };

  const handleSaveMovement = async () => {
    const part = parts.find(p => p.id === movementFormData.part_id);
    if (!part) return;

    const quantity = parseInt(movementFormData.quantity);
    const isPositive = movementFormData.movement_type === 'entrada' || movementFormData.movement_type === 'ajuste';
    const finalQuantity = isPositive ? quantity : -quantity;
    const newStock = part.stock_quantity + finalQuantity;

    const movementData = {
      part_id: movementFormData.part_id,
      movement_type: movementFormData.movement_type,
      quantity: finalQuantity,
      previous_stock: part.stock_quantity,
      new_stock: Math.max(0, newStock),
      reason: movementFormData.reason
    };

    const { error: movementError } = await supabase
      .from('parts_inventory_movements')
      .insert([movementData]);

    if (!movementError) {
      await supabase
        .from('parts_accessories_inventory')
        .update({ stock_quantity: Math.max(0, newStock) })
        .eq('id', movementFormData.part_id);

      loadAllData();
      setShowMovementModal(false);
      setMovementFormData({
        part_id: '',
        movement_type: 'entrada',
        quantity: '',
        reason: ''
      });
    }
  };

  const filteredParts = parts.filter(part => {
    const matchesSearch = part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         part.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         part.brand?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || part.category === categoryFilter;
    const matchesLowStock = !lowStockFilter || part.stock_quantity <= part.min_stock_alert;

    return matchesSearch && matchesCategory && matchesLowStock;
  });

  const totalInventoryValue = parts.reduce((sum, part) => sum + (part.stock_quantity * part.cost_price), 0);
  const lowStockItems = parts.filter(part => part.stock_quantity <= part.min_stock_alert).length;
  const totalSalesValue = sales.reduce((sum, sale) => sum + sale.total, 0);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Cargando inventario...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <Package className="w-8 h-8 text-orange-600" />
            Control de Inventario
          </h2>
          <p className="text-gray-600 mt-1">Gestión de refacciones y accesorios</p>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Package className="w-8 h-8 opacity-80" />
            <div className="text-right">
              <div className="text-3xl font-bold">{parts.length}</div>
              <div className="text-xs opacity-90 mt-1">productos</div>
            </div>
          </div>
          <div className="text-sm font-semibold mt-2">Total Productos</div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 opacity-80" />
            <div className="text-right">
              <div className="text-2xl font-bold">${totalInventoryValue.toLocaleString('es-MX')}</div>
              <div className="text-xs opacity-90 mt-1">MXN</div>
            </div>
          </div>
          <div className="text-sm font-semibold mt-2">Valor Inventario</div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-8 h-8 opacity-80" />
            <div className="text-right">
              <div className="text-3xl font-bold">{lowStockItems}</div>
              <div className="text-xs opacity-90 mt-1">productos</div>
            </div>
          </div>
          <div className="text-sm font-semibold mt-2">Stock Bajo</div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <BarChart3 className="w-8 h-8 opacity-80" />
            <div className="text-right">
              <div className="text-2xl font-bold">${totalSalesValue.toLocaleString('es-MX')}</div>
              <div className="text-xs opacity-90 mt-1">MXN</div>
            </div>
          </div>
          <div className="text-sm font-semibold mt-2">Ventas Totales</div>
        </div>
      </div>

      {/* Pestañas */}
      <div className="bg-white rounded-xl shadow-md border-2 border-gray-200">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              activeTab === 'inventory'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Package className="w-5 h-5" />
              Inventario ({parts.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              activeTab === 'sales'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Ventas ({sales.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              activeTab === 'movements'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Movimientos ({movements.length})
            </div>
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'inventory' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar productos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value as any)}
                    className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="all">Todas las categorías</option>
                    <option value="refaccion">Refacciones</option>
                    <option value="accesorio">Accesorios</option>
                  </select>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={lowStockFilter}
                      onChange={(e) => setLowStockFilter(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">Solo stock bajo</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowMovementModal(true)}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                  >
                    <TrendingUp className="w-5 h-5" />
                    Movimiento
                  </button>
                  <button
                    onClick={() => setShowSaleModal(true)}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    Nueva Venta
                  </button>
                  <button
                    onClick={() => handleOpenPartModal()}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    Nuevo Producto
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">SKU</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Producto</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Categoría</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Stock</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Precio Venta</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Costo</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-gray-600 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredParts.map((part) => (
                      <tr key={part.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-mono text-gray-800">{part.sku}</td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-semibold text-gray-800">{part.name}</div>
                            {part.brand && <div className="text-xs text-gray-500">{part.brand}</div>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2 py-1 text-xs font-bold rounded ${
                            part.category === 'refaccion' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {part.category === 'refaccion' ? 'Refacción' : 'Accesorio'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold ${
                              part.stock_quantity <= part.min_stock_alert 
                                ? 'text-red-600' 
                                : 'text-gray-800'
                            }`}>
                              {part.stock_quantity}
                            </span>
                            {part.stock_quantity <= part.min_stock_alert && (
                              <AlertTriangle className="w-4 h-4 text-red-600" />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                          ${part.price_retail.toLocaleString('es-MX')}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          ${part.cost_price.toLocaleString('es-MX')}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleOpenPartModal(part)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeletePart(part.id)}
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

          {activeTab === 'sales' && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Fecha</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Cliente</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Tipo</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Items</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Total</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-gray-600 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-800">
                          {new Date(sale.sale_date).toLocaleDateString('es-MX')}
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-semibold text-gray-800">{sale.customer_name}</div>
                            {sale.customer_phone && (
                              <div className="text-xs text-gray-500">{sale.customer_phone}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2 py-1 text-xs font-bold rounded ${
                            sale.customer_type === 'walk-in' 
                              ? 'bg-gray-100 text-gray-800'
                              : sale.customer_type === 'cliente'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {sale.customer_type === 'walk-in' ? 'Walk-in' : 
                             sale.customer_type === 'cliente' ? 'Cliente' : 'Lead'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {sale.items.length} productos
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                          ${sale.total.toLocaleString('es-MX')}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors">
                              <Eye className="w-4 h-4" />
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

          {activeTab === 'movements' && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Fecha</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Producto</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Tipo</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Cantidad</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Stock Anterior</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Stock Nuevo</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {movements.map((movement) => {
                      const part = parts.find(p => p.id === movement.part_id);
                      return (
                        <tr key={movement.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-800">
                            {new Date(movement.created_at).toLocaleDateString('es-MX')}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                            {part?.name || 'Producto eliminado'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-block px-2 py-1 text-xs font-bold rounded ${
                              movement.movement_type === 'entrada' 
                                ? 'bg-green-100 text-green-800'
                                : movement.movement_type === 'salida'
                                ? 'bg-red-100 text-red-800'
                                : movement.movement_type === 'venta'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {movement.movement_type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                            {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {movement.previous_stock}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {movement.new_stock}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {movement.reason || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Producto */}
      {showPartModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowPartModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">
                {editingPart ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <button onClick={() => setShowPartModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">SKU *</label>
                  <input
                    type="text"
                    value={partFormData.sku}
                    onChange={(e) => setPartFormData({ ...partFormData, sku: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="REF-001"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre *</label>
                  <input
                    type="text"
                    value={partFormData.name}
                    onChange={(e) => setPartFormData({ ...partFormData, name: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="Filtro de aceite"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Categoría *</label>
                  <select
                    value={partFormData.category}
                    onChange={(e) => setPartFormData({ ...partFormData, category: e.target.value as any })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    required
                  >
                    <option value="refaccion">Refacción</option>
                    <option value="accesorio">Accesorio</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Subcategoría</label>
                  <input
                    type="text"
                    value={partFormData.subcategory}
                    onChange={(e) => setPartFormData({ ...partFormData, subcategory: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="Filtros, Frenos, etc."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Descripción</label>
                <textarea
                  value={partFormData.description}
                  onChange={(e) => setPartFormData({ ...partFormData, description: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none h-20"
                  placeholder="Descripción detallada del producto"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Marca</label>
                  <input
                    type="text"
                    value={partFormData.brand}
                    onChange={(e) => setPartFormData({ ...partFormData, brand: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="Yamaha, NGK, etc."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Ubicación</label>
                  <input
                    type="text"
                    value={partFormData.location}
                    onChange={(e) => setPartFormData({ ...partFormData, location: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="A-01, B-02, etc."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Modelos Compatibles</label>
                <input
                  type="text"
                  value={partFormData.compatible_models}
                  onChange={(e) => setPartFormData({ ...partFormData, compatible_models: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="MT-07, YZF-R3, Tenere 700 (separados por comas)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Precio Venta (MXN)</label>
                  <input
                    type="number"
                    value={partFormData.sale_price}
                    onChange={(e) => setPartFormData({ ...partFormData, sale_price: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Costo (MXN)</label>
                  <input
                    type="number"
                    value={partFormData.cost}
                    onChange={(e) => setPartFormData({ ...partFormData, cost: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Stock Inicial</label>
                  <input
                    type="number"
                    value={partFormData.stock}
                    onChange={(e) => setPartFormData({ ...partFormData, stock: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Stock Mínimo</label>
                  <input
                    type="number"
                    value={partFormData.min_stock}
                    onChange={(e) => setPartFormData({ ...partFormData, min_stock: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Proveedor</label>
                <input
                  type="text"
                  value={partFormData.supplier}
                  onChange={(e) => setPartFormData({ ...partFormData, supplier: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="Distribuidora Yamaha MX"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={partFormData.active}
                  onChange={(e) => setPartFormData({ ...partFormData, active: e.target.checked })}
                  className="w-4 h-4"
                />
                <label className="text-sm font-medium text-gray-700">Producto activo</label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSavePart}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                >
                  {editingPart ? 'Actualizar' : 'Crear'} Producto
                </button>
                <button
                  onClick={() => setShowPartModal(false)}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Nueva Venta */}
      {showSaleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowSaleModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">Nueva Venta</h3>
              <button onClick={() => setShowSaleModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre del Cliente *</label>
                  <input
                    type="text"
                    value={saleFormData.customer_name}
                    onChange={(e) => setSaleFormData({ ...saleFormData, customer_name: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="Juan Pérez"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Teléfono</label>
                  <input
                    type="tel"
                    value={saleFormData.customer_phone}
                    onChange={(e) => setSaleFormData({ ...saleFormData, customer_phone: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="5512345678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de Cliente</label>
                  <select
                    value={saleFormData.customer_type}
                    onChange={(e) => setSaleFormData({ ...saleFormData, customer_type: e.target.value as any })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="walk-in">Walk-in</option>
                    <option value="cliente">Cliente</option>
                    <option value="lead">Lead</option>
                  </select>
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Agregar Productos</h4>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Producto</label>
                    <select
                      value={newSaleItem.part_id}
                      onChange={(e) => setNewSaleItem({ ...newSaleItem, part_id: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Seleccionar producto</option>
                      {parts.filter(p => p.active && p.stock_quantity > 0).map(part => (
                        <option key={part.id} value={part.id}>
                          {part.name} (Stock: {part.stock_quantity})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Cantidad</label>
                    <input
                      type="number"
                      value={saleFormData.quantity}
                      onChange={(e) => setSaleFormData({ ...saleFormData, quantity: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                      placeholder="0"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Precio Unitario</label>
                    <input
                      type="number"
                      value={newSaleItem.unit_price}
                      onChange={(e) => setNewSaleItem({ ...newSaleItem, unit_price: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleAddSaleItem}
                      className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                    >
                      Agregar
                    </button>
                  </div>
                </div>

                {saleFormData.items.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase">Producto</th>
                          <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase">Cantidad</th>
                          <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase">Precio Unit.</th>
                          <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase">Total</th>
                          <th className="px-4 py-2 text-center text-xs font-bold text-gray-600 uppercase">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {saleFormData.items.map((item, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 text-sm text-gray-800">{item.part_name}</td>
                            <td className="px-4 py-2 text-sm text-gray-800">{item.quantity}</td>
                            <td className="px-4 py-2 text-sm text-gray-800">${item.unit_price.toLocaleString('es-MX')}</td>
                            <td className="px-4 py-2 text-sm font-semibold text-gray-800">${item.total.toLocaleString('es-MX')}</td>
                            <td className="px-4 py-2 text-center">
                              <button
                                onClick={() => handleRemoveSaleItem(index)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="bg-gray-50 px-4 py-3 border-t">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-800">Total:</span>
                        <span className="text-xl font-bold text-gray-800">
                          ${saleFormData.items.reduce((sum, item) => sum + item.total, 0).toLocaleString('es-MX')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Método de Pago</label>
                  <select
                    value={saleFormData.payment_method}
                    onChange={(e) => setSaleFormData({ ...saleFormData, payment_method: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Seleccionar método</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="transferencia">Transferencia</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Notas</label>
                  <input
                    type="text"
                    value={saleFormData.notes}
                    onChange={(e) => setSaleFormData({ ...saleFormData, notes: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="Notas adicionales"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSaveSale}
                  disabled={saleFormData.items.length === 0}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                >
                  Registrar Venta
                </button>
                <button
                  onClick={() => setShowSaleModal(false)}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Movimiento de Inventario */}
      {showMovementModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowMovementModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">Movimiento de Inventario</h3>
              <button onClick={() => setShowMovementModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Producto *</label>
                <select
                  value={movementFormData.part_id}
                  onChange={(e) => setMovementFormData({ ...movementFormData, part_id: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  required
                >
                  <option value="">Seleccionar producto</option>
                  {parts.filter(p => p.active).map(part => (
                    <option key={part.id} value={part.id}>
                      {part.name} (Stock actual: {part.stock_quantity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de Movimiento *</label>
                <select
                  value={movementFormData.movement_type}
                  onChange={(e) => setMovementFormData({ ...movementFormData, movement_type: e.target.value as any })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  required
                >
                  <option value="entrada">Entrada (Aumentar stock)</option>
                  <option value="salida">Salida (Reducir stock)</option>
                  <option value="ajuste">Ajuste de inventario</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Cantidad *</label>
                <input
                  type="number"
                  value={movementFormData.quantity}
                  onChange={(e) => setMovementFormData({ ...movementFormData, quantity: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="0"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Motivo *</label>
                <input
                  type="text"
                  value={movementFormData.reason}
                  onChange={(e) => setMovementFormData({ ...movementFormData, reason: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="Recepción de mercancía, devolución, etc."
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSaveMovement}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                >
                  Registrar Movimiento
                </button>
                <button
                  onClick={() => setShowMovementModal(false)}
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