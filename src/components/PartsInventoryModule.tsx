import { useState, useEffect } from 'react';
import { supabase, PartsAccessoriesInventory, PartsSale, PartsInventoryMovement } from '../lib/supabase';
import {
  Package, Plus, Edit2, Trash2, Search, AlertCircle, TrendingUp, DollarSign,
  ShoppingCart, X, Eye, Filter, BarChart3, ArrowUpCircle, ArrowDownCircle, ShoppingBag, Wrench
} from 'lucide-react';

type ViewMode = 'inventory' | 'sales' | 'movements';
type CategoryFilter = 'all' | 'refaccion' | 'accesorio';

export function PartsInventoryModule() {
  const [viewMode, setViewMode] = useState<ViewMode>('inventory');
  const [parts, setParts] = useState<PartsAccessoriesInventory[]>([]);
  const [sales, setSales] = useState<PartsSale[]>([]);
  const [movements, setMovements] = useState<PartsInventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [showModal, setShowModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [editingPart, setEditingPart] = useState<PartsAccessoriesInventory | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: 'refaccion' as 'refaccion' | 'accesorio',
    subcategory: '',
    description: '',
    compatible_models: '',
    brand: '',
    price_retail: 0,
    cost_price: 0,
    stock_quantity: 0,
    min_stock_alert: 5,
    location: '',
    supplier: '',
    image_url: '',
    active: true
  });

  const [saleData, setSaleData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_type: 'walk-in' as 'walk-in' | 'cliente' | 'lead',
    payment_method: 'Efectivo',
    discount: 0,
    notes: '',
    items: [] as Array<{ part_id: string; part_name: string; quantity: number; price: number }>
  });

  const [movementData, setMovementData] = useState({
    part_id: '',
    movement_type: 'entrada' as 'entrada' | 'salida' | 'ajuste',
    quantity: 0,
    reason: ''
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    await Promise.all([
      loadParts(),
      loadSales(),
      loadMovements()
    ]);
    setLoading(false);
  };

  const loadParts = async () => {
    const { data } = await supabase
      .from('parts_accessories_inventory')
      .select('*')
      .order('name');
    if (data) setParts(data);
  };

  const loadSales = async () => {
    const { data } = await supabase
      .from('parts_sales')
      .select('*')
      .order('sale_date', { ascending: false })
      .limit(50);
    if (data) setSales(data);
  };

  const loadMovements = async () => {
    const { data } = await supabase
      .from('parts_inventory_movements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setMovements(data);
  };

  const handleOpenModal = (part?: PartsAccessoriesInventory) => {
    if (part) {
      setEditingPart(part);
      setFormData({
        sku: part.sku,
        name: part.name,
        category: part.category,
        subcategory: part.subcategory || '',
        description: part.description || '',
        compatible_models: part.compatible_models.join(', '),
        brand: part.brand || '',
        price_retail: part.price_retail,
        cost_price: part.cost_price,
        stock_quantity: part.stock_quantity,
        min_stock_alert: part.min_stock_alert,
        location: part.location || '',
        supplier: part.supplier || '',
        image_url: part.image_url || '',
        active: part.active
      });
    } else {
      setEditingPart(null);
      setFormData({
        sku: '',
        name: '',
        category: 'refaccion',
        subcategory: '',
        description: '',
        compatible_models: '',
        brand: '',
        price_retail: 0,
        cost_price: 0,
        stock_quantity: 0,
        min_stock_alert: 5,
        location: '',
        supplier: '',
        image_url: '',
        active: true
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async () => {
    const dataToSubmit = {
      sku: formData.sku,
      name: formData.name,
      category: formData.category,
      subcategory: formData.subcategory || null,
      description: formData.description || null,
      compatible_models: formData.compatible_models.split(',').map(m => m.trim()).filter(m => m),
      brand: formData.brand || null,
      price_retail: formData.price_retail,
      cost_price: formData.cost_price,
      stock_quantity: formData.stock_quantity,
      min_stock_alert: formData.min_stock_alert,
      location: formData.location || null,
      supplier: formData.supplier || null,
      image_url: formData.image_url || null,
      active: formData.active,
      updated_at: new Date().toISOString()
    };

    if (editingPart) {
      const { error } = await supabase
        .from('parts_accessories_inventory')
        .update(dataToSubmit)
        .eq('id', editingPart.id);

      if (!error) {
        setSuccessMessage('Producto actualizado exitosamente');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } else {
      const { error } = await supabase
        .from('parts_accessories_inventory')
        .insert([dataToSubmit]);

      if (!error) {
        setSuccessMessage('Producto registrado exitosamente');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    }

    setShowModal(false);
    setEditingPart(null);
    loadParts();
  };

  const handleDeletePart = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;

    const { error } = await supabase
      .from('parts_accessories_inventory')
      .update({ active: false })
      .eq('id', id);

    if (!error) {
      setSuccessMessage('Producto desactivado');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      loadParts();
    }
  };

  const handleAddItemToSale = () => {
    const part = parts.find(p => p.id === movementData.part_id);
    if (!part) {
      alert('Selecciona un producto');
      return;
    }

    if (movementData.quantity <= 0) {
      alert('La cantidad debe ser mayor a 0');
      return;
    }

    if (movementData.quantity > part.stock_quantity) {
      alert('Stock insuficiente');
      return;
    }

    const existingItem = saleData.items.find(item => item.part_id === part.id);
    if (existingItem) {
      setSaleData({
        ...saleData,
        items: saleData.items.map(item =>
          item.part_id === part.id
            ? { ...item, quantity: item.quantity + movementData.quantity }
            : item
        )
      });
    } else {
      setSaleData({
        ...saleData,
        items: [...saleData.items, {
          part_id: part.id,
          part_name: part.name,
          quantity: movementData.quantity,
          price: part.price_retail
        }]
      });
    }

    setMovementData({ ...movementData, part_id: '', quantity: 0 });
  };

  const handleRemoveItemFromSale = (partId: string) => {
    setSaleData({
      ...saleData,
      items: saleData.items.filter(item => item.part_id !== partId)
    });
  };

  const calculateSaleTotal = () => {
    const subtotal = saleData.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const total = subtotal - saleData.discount;
    return { subtotal, total };
  };

  const handleSubmitSale = async () => {
    if (saleData.items.length === 0) {
      alert('Agrega al menos un producto a la venta');
      return;
    }

    if (!saleData.customer_name) {
      alert('Ingresa el nombre del cliente');
      return;
    }

    const { subtotal, total } = calculateSaleTotal();

    const { data: saleRecord, error: saleError } = await supabase
      .from('parts_sales')
      .insert([{
        customer_name: saleData.customer_name,
        customer_phone: saleData.customer_phone || null,
        customer_type: saleData.customer_type,
        items: saleData.items,
        subtotal,
        discount: saleData.discount,
        total,
        payment_method: saleData.payment_method,
        notes: saleData.notes || null
      }])
      .select()
      .single();

    if (saleError || !saleRecord) {
      alert('Error al registrar la venta');
      return;
    }

    for (const item of saleData.items) {
      const part = parts.find(p => p.id === item.part_id);
      if (!part) continue;

      const newStock = part.stock_quantity - item.quantity;

      await supabase
        .from('parts_accessories_inventory')
        .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
        .eq('id', part.id);

      await supabase
        .from('parts_inventory_movements')
        .insert([{
          part_id: part.id,
          movement_type: 'venta',
          quantity: -item.quantity,
          previous_stock: part.stock_quantity,
          new_stock: newStock,
          reason: `Venta a ${saleData.customer_name}`,
          reference_id: saleRecord.id
        }]);
    }

    setSuccessMessage('Venta registrada exitosamente');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
    setShowSaleModal(false);
    setSaleData({
      customer_name: '',
      customer_phone: '',
      customer_type: 'walk-in',
      payment_method: 'Efectivo',
      discount: 0,
      notes: '',
      items: []
    });
    loadAllData();
  };

  const handleSubmitMovement = async () => {
    if (!movementData.part_id || movementData.quantity === 0) {
      alert('Completa todos los campos');
      return;
    }

    const part = parts.find(p => p.id === movementData.part_id);
    if (!part) return;

    let quantityChange = movementData.quantity;
    if (movementData.movement_type === 'salida') {
      quantityChange = -Math.abs(quantityChange);
    }

    const newStock = part.stock_quantity + quantityChange;

    if (newStock < 0) {
      alert('Stock insuficiente');
      return;
    }

    await supabase
      .from('parts_accessories_inventory')
      .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
      .eq('id', part.id);

    await supabase
      .from('parts_inventory_movements')
      .insert([{
        part_id: part.id,
        movement_type: movementData.movement_type,
        quantity: quantityChange,
        previous_stock: part.stock_quantity,
        new_stock: newStock,
        reason: movementData.reason || null
      }]);

    setSuccessMessage('Movimiento registrado exitosamente');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
    setShowMovementModal(false);
    setMovementData({ part_id: '', movement_type: 'entrada', quantity: 0, reason: '' });
    loadAllData();
  };

  const filteredParts = parts.filter(part => {
    const matchesCategory = categoryFilter === 'all' || part.category === categoryFilter;
    const matchesSearch = searchTerm === '' ||
      part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (part.brand && part.brand.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch && part.active;
  });

  const lowStockParts = parts.filter(p => p.active && p.stock_quantity <= p.min_stock_alert);

  const stats = {
    totalProducts: parts.filter(p => p.active).length,
    totalRefacciones: parts.filter(p => p.active && p.category === 'refaccion').length,
    totalAccesorios: parts.filter(p => p.active && p.category === 'accesorio').length,
    lowStock: lowStockParts.length,
    totalValue: parts.filter(p => p.active).reduce((acc, p) => acc + (p.price_retail * p.stock_quantity), 0),
    totalSales: sales.length,
    totalSalesValue: sales.reduce((acc, s) => acc + s.total, 0)
  };

  const getCategoryColor = (category: string) => {
    return category === 'refaccion'
      ? 'bg-blue-100 text-blue-800 border-blue-300'
      : 'bg-green-100 text-green-800 border-green-300';
  };

  if (loading) {
    return <div className="text-center py-8">Cargando inventario...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Wrench className="w-7 h-7 text-blue-600" />
            Control de Inventario - Refacciones y Accesorios
          </h3>
          <p className="text-sm text-gray-600 mt-1">Gestión completa para ventas directas y walk-in</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
          >
            <Plus className="w-5 h-5" />
            Nuevo Producto
          </button>
          <button
            onClick={() => setShowSaleModal(true)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
          >
            <ShoppingCart className="w-5 h-5" />
            Registrar Venta
          </button>
          <button
            onClick={() => setShowMovementModal(true)}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
          >
            <ArrowUpCircle className="w-5 h-5" />
            Movimiento
          </button>
        </div>
      </div>

      {showSuccess && (
        <div className="bg-green-100 border-2 border-green-400 text-green-800 px-4 py-3 rounded-lg flex items-center gap-3">
          <TrendingUp className="w-5 h-5" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Package className="w-8 h-8 opacity-80" />
            <div className="text-right">
              <div className="text-3xl font-bold">{stats.totalProducts}</div>
              <div className="text-xs opacity-90 mt-1">productos</div>
            </div>
          </div>
          <div className="text-sm font-semibold mt-2">Total Activos</div>
        </div>

        <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Wrench className="w-8 h-8 opacity-80" />
            <div className="text-right">
              <div className="text-3xl font-bold">{stats.totalRefacciones}</div>
              <div className="text-xs opacity-90 mt-1">refacciones</div>
            </div>
          </div>
          <div className="text-sm font-semibold mt-2">Refacciones</div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <ShoppingBag className="w-8 h-8 opacity-80" />
            <div className="text-right">
              <div className="text-3xl font-bold">{stats.totalAccesorios}</div>
              <div className="text-xs opacity-90 mt-1">accesorios</div>
            </div>
          </div>
          <div className="text-sm font-semibold mt-2">Accesorios</div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <AlertCircle className="w-8 h-8 opacity-80" />
            <div className="text-right">
              <div className="text-3xl font-bold">{stats.lowStock}</div>
              <div className="text-xs opacity-90 mt-1">alertas</div>
            </div>
          </div>
          <div className="text-sm font-semibold mt-2">Stock Bajo</div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 opacity-80" />
            <div className="text-right">
              <div className="text-2xl font-bold">${(stats.totalValue / 1000).toFixed(0)}K</div>
              <div className="text-xs opacity-90 mt-1">valor</div>
            </div>
          </div>
          <div className="text-sm font-semibold mt-2">Valor Total</div>
        </div>
      </div>

      {lowStockParts.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-red-900 mb-2">Productos con Stock Bajo</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {lowStockParts.slice(0, 6).map(part => (
                  <div key={part.id} className="bg-white rounded p-2 border border-red-200">
                    <div className="text-sm font-semibold text-gray-800">{part.name}</div>
                    <div className="text-xs text-gray-600">Stock: {part.stock_quantity} (Min: {part.min_stock_alert})</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md border-2 border-gray-200">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setViewMode('inventory')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              viewMode === 'inventory'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Package className="w-5 h-5" />
              Inventario ({filteredParts.length})
            </div>
          </button>
          <button
            onClick={() => setViewMode('sales')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              viewMode === 'sales'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Ventas ({stats.totalSales})
            </div>
          </button>
          <button
            onClick={() => setViewMode('movements')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              viewMode === 'movements'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Movimientos
            </div>
          </button>
        </div>

        <div className="p-6">
          {viewMode === 'inventory' && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre, SKU o marca..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCategoryFilter('all')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                      categoryFilter === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setCategoryFilter('refaccion')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                      categoryFilter === 'refaccion'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Refacciones
                  </button>
                  <button
                    onClick={() => setCategoryFilter('accesorio')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                      categoryFilter === 'accesorio'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Accesorios
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b-2 border-blue-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">SKU</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Producto</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Categoría</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Marca</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Precio</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Stock</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Ubicación</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredParts.map((part) => (
                      <tr key={part.id} className="hover:bg-blue-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm font-mono font-bold text-gray-700">{part.sku}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-semibold text-gray-900">{part.name}</div>
                          {part.subcategory && (
                            <div className="text-xs text-gray-500">{part.subcategory}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-bold rounded border ${getCategoryColor(part.category)}`}>
                            {part.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm text-gray-700">{part.brand || 'N/A'}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm font-semibold text-green-600">
                            ${part.price_retail.toLocaleString('es-MX')}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`text-sm font-bold ${
                            part.stock_quantity <= part.min_stock_alert ? 'text-red-600' :
                            part.stock_quantity <= part.min_stock_alert * 2 ? 'text-yellow-600' :
                            'text-green-600'
                          }`}>
                            {part.stock_quantity}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm text-gray-600">{part.location || 'N/A'}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleOpenModal(part)}
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

          {viewMode === 'sales' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                  <div className="text-sm text-gray-600">Total Ventas</div>
                  <div className="text-2xl font-bold text-blue-600">{stats.totalSales}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                  <div className="text-sm text-gray-600">Valor Total</div>
                  <div className="text-2xl font-bold text-green-600">
                    ${stats.totalSalesValue.toLocaleString('es-MX')}
                  </div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4 border-2 border-orange-200">
                  <div className="text-sm text-gray-600">Promedio</div>
                  <div className="text-2xl font-bold text-orange-600">
                    ${stats.totalSales > 0 ? (stats.totalSalesValue / stats.totalSales).toFixed(0) : 0}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {sales.map((sale) => (
                  <div key={sale.id} className="bg-white rounded-lg p-4 border-2 border-gray-200 hover:border-blue-400 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-gray-800">{sale.customer_name}</h4>
                        <div className="text-sm text-gray-600">
                          {sale.customer_phone && <span>{sale.customer_phone}</span>}
                          <span className="ml-2 px-2 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-700">
                            {sale.customer_type}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">
                          ${sale.total.toLocaleString('es-MX')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(sale.sale_date).toLocaleDateString('es-MX')}
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded p-3">
                      <div className="text-xs font-semibold text-gray-600 mb-2">PRODUCTOS:</div>
                      {Array.isArray(sale.items) && sale.items.map((item: any, idx: number) => (
                        <div key={idx} className="text-sm text-gray-700 flex justify-between">
                          <span>{item.part_name} x {item.quantity}</span>
                          <span className="font-semibold">${(item.price * item.quantity).toLocaleString('es-MX')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'movements' && (
            <div className="space-y-3">
              {movements.map((movement) => {
                const part = parts.find(p => p.id === movement.part_id);
                return (
                  <div key={movement.id} className="bg-white rounded-lg p-4 border-2 border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {movement.movement_type === 'entrada' && <ArrowUpCircle className="w-5 h-5 text-green-600 mt-0.5" />}
                        {movement.movement_type === 'salida' && <ArrowDownCircle className="w-5 h-5 text-red-600 mt-0.5" />}
                        {movement.movement_type === 'ajuste' && <BarChart3 className="w-5 h-5 text-blue-600 mt-0.5" />}
                        {movement.movement_type === 'venta' && <ShoppingCart className="w-5 h-5 text-orange-600 mt-0.5" />}
                        <div>
                          <h4 className="font-bold text-gray-800">{part?.name || 'Producto eliminado'}</h4>
                          <p className="text-sm text-gray-600 mt-1">{movement.reason || 'Sin motivo especificado'}</p>
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(movement.created_at).toLocaleString('es-MX')}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-xl font-bold ${
                          movement.quantity > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {movement.previous_stock} → {movement.new_stock}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-auto" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full my-8" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white rounded-t-xl">
              <h3 className="text-xl font-bold text-gray-800">
                {editingPart ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">SKU *</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="REF-001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="Filtro de Aceite"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Categoría *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as 'refaccion' | 'accesorio' })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="refaccion">Refacción</option>
                    <option value="accesorio">Accesorio</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Subcategoría</label>
                  <input
                    type="text"
                    value={formData.subcategory}
                    onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="Filtros, Sistema de Frenado..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Marca</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="Yamaha, NGK, DID..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Precio Venta *</label>
                  <input
                    type="number"
                    value={formData.price_retail}
                    onChange={(e) => setFormData({ ...formData, price_retail: Number(e.target.value) })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Costo</label>
                  <input
                    type="number"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: Number(e.target.value) })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Stock Inicial *</label>
                  <input
                    type="number"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: Number(e.target.value) })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Alerta Stock Mínimo</label>
                  <input
                    type="number"
                    value={formData.min_stock_alert}
                    onChange={(e) => setFormData({ ...formData, min_stock_alert: Number(e.target.value) })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Ubicación</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="A-01, B-02..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Proveedor</label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="Distribuidora Yamaha MX"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Modelos Compatibles (separados por coma)</label>
                <input
                  type="text"
                  value={formData.compatible_models}
                  onChange={(e) => setFormData({ ...formData, compatible_models: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="MT-07, MT-09, YZF-R3"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none h-20"
                  placeholder="Descripción del producto"
                />
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex gap-3 sticky bottom-0 bg-white rounded-b-xl">
              <button
                onClick={handleSubmit}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
              >
                {editingPart ? 'Actualizar' : 'Registrar'} Producto
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showSaleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-auto" onClick={() => setShowSaleModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-8" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white rounded-t-xl">
              <h3 className="text-xl font-bold text-gray-800">Registrar Venta</h3>
              <button onClick={() => setShowSaleModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre del Cliente *</label>
                  <input
                    type="text"
                    value={saleData.customer_name}
                    onChange={(e) => setSaleData({ ...saleData, customer_name: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Teléfono</label>
                  <input
                    type="text"
                    value={saleData.customer_phone}
                    onChange={(e) => setSaleData({ ...saleData, customer_phone: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de Cliente</label>
                  <select
                    value={saleData.customer_type}
                    onChange={(e) => setSaleData({ ...saleData, customer_type: e.target.value as any })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="walk-in">Walk-in</option>
                    <option value="cliente">Cliente Registrado</option>
                    <option value="lead">Lead</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Método de Pago</label>
                  <select
                    value={saleData.payment_method}
                    onChange={(e) => setSaleData({ ...saleData, payment_method: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="Efectivo">Efectivo</option>
                    <option value="Tarjeta">Tarjeta</option>
                    <option value="Transferencia">Transferencia</option>
                  </select>
                </div>
              </div>

              <div className="border-t-2 border-gray-200 pt-4">
                <h4 className="text-lg font-bold text-gray-800 mb-4">Agregar Productos</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Producto</label>
                    <select
                      value={movementData.part_id}
                      onChange={(e) => setMovementData({ ...movementData, part_id: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Seleccionar...</option>
                      {parts.filter(p => p.active && p.stock_quantity > 0).map(part => (
                        <option key={part.id} value={part.id}>
                          {part.name} (Stock: {part.stock_quantity}) - ${part.price_retail}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      value={movementData.quantity}
                      onChange={(e) => setMovementData({ ...movementData, quantity: Number(e.target.value) })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={handleAddItemToSale}
                      className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                    >
                      Agregar
                    </button>
                  </div>
                </div>

                {saleData.items.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                    <div className="space-y-2">
                      {saleData.items.map((item) => (
                        <div key={item.part_id} className="flex items-center justify-between bg-white rounded p-3">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-800">{item.part_name}</div>
                            <div className="text-sm text-gray-600">
                              {item.quantity} x ${item.price.toLocaleString('es-MX')}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-lg font-bold text-gray-800">
                              ${(item.price * item.quantity).toLocaleString('es-MX')}
                            </span>
                            <button
                              onClick={() => handleRemoveItemFromSale(item.part_id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 pt-4 border-t-2 border-gray-300">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-700">Subtotal:</span>
                        <span className="text-xl font-bold text-gray-800">
                          ${calculateSaleTotal().subtotal.toLocaleString('es-MX')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-700">Descuento:</span>
                        <input
                          type="number"
                          min="0"
                          value={saleData.discount}
                          onChange={(e) => setSaleData({ ...saleData, discount: Number(e.target.value) })}
                          className="w-32 px-3 py-1 border-2 border-gray-300 rounded-lg text-right"
                        />
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t-2 border-gray-300">
                        <span className="text-lg font-bold text-gray-800">TOTAL:</span>
                        <span className="text-2xl font-bold text-green-600">
                          ${calculateSaleTotal().total.toLocaleString('es-MX')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Notas</label>
                <textarea
                  value={saleData.notes}
                  onChange={(e) => setSaleData({ ...saleData, notes: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none h-20"
                  placeholder="Notas adicionales..."
                />
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex gap-3 sticky bottom-0 bg-white rounded-b-xl">
              <button
                onClick={handleSubmitSale}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
              >
                Completar Venta
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
      )}

      {showMovementModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowMovementModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">Registrar Movimiento de Inventario</h3>
              <button onClick={() => setShowMovementModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Producto *</label>
                <select
                  value={movementData.part_id}
                  onChange={(e) => setMovementData({ ...movementData, part_id: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Seleccionar producto...</option>
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
                  value={movementData.movement_type}
                  onChange={(e) => setMovementData({ ...movementData, movement_type: e.target.value as any })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
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
                  value={movementData.quantity}
                  onChange={(e) => setMovementData({ ...movementData, quantity: Number(e.target.value) })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="Cantidad"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Motivo</label>
                <textarea
                  value={movementData.reason}
                  onChange={(e) => setMovementData({ ...movementData, reason: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none h-20"
                  placeholder="Describe el motivo del movimiento..."
                />
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex gap-3">
              <button
                onClick={handleSubmitMovement}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
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
      )}
    </div>
  );
}
