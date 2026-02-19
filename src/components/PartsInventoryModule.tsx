import { useState, useEffect } from 'react';
import { supabase, PartItem, PartsCatalog, PartsInventory } from '../lib/supabase'; // Import types from supabase.ts
import { useBranch } from '../contexts/BranchContext';
import { useAuth } from '../contexts/AuthContext';
import { Package, Plus, X, CreditCard as Edit2, Trash2, Search, TrendingUp, DollarSign, AlertTriangle, ShoppingCart, BarChart3, Eye, ClipboardList, Phone, MapPin, Wrench as WrenchIcon } from 'lucide-react';

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
  part_id: string; // This effectively refers to catalog_id now, or the movement record's FK
  movement_type: 'entrada' | 'salida' | 'ajuste' | 'venta';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason: string | null;
  reference_id: string | null;
  performed_by: string | null;
  created_at: string;
}

interface PartRequest {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  part_name: string;
  motorcycle_model: string | null;
  city: string | null;
  state: string | null;
  branch_id: string | null;
  assigned_manager_id: string | null;
  assigned_manager_name: string | null;
  status: 'pendiente' | 'en_proceso' | 'completada' | 'cancelada';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function PartsInventoryModule() {
  const { selectedBranchId } = useBranch();
  const { user } = useAuth();
  const [parts, setParts] = useState<PartItem[]>([]);
  const [sales, setSales] = useState<PartSale[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [partsRequests, setPartsRequests] = useState<PartRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'inventory' | 'sales' | 'movements' | 'solicitudes'>('inventory');
  const [requestSearchTerm, setRequestSearchTerm] = useState('');
  const [requestStatusFilter, setRequestStatusFilter] = useState<'all' | 'pendiente' | 'en_proceso' | 'completada' | 'cancelada'>('all');
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
  }, [selectedBranchId]);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([loadParts(), loadSales(), loadMovements(), loadPartsRequests()]);
    setLoading(false);
  };

  const loadParts = async () => {
    // 1. Cargar el Catálogo Global
    const { data: catalogData, error: catalogError } = await supabase
      .from('parts_catalog')
      .select('*')
      .order('name');

    if (catalogError || !catalogData) {
      console.error('Error loading parts catalog:', catalogError);
      return;
    }

    // 2. Cargar Inventario Local (si hay sucursal seleccionada)
    let inventoryMap: Record<string, PartsInventory> = {};

    if (selectedBranchId) {
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('parts_inventory')
        .select('*')
        .eq('branch_id', selectedBranchId);

      if (!inventoryError && inventoryData) {
        inventoryData.forEach(item => {
          inventoryMap[item.catalog_id] = item;
        });
      }
    }

    // 3. Fusionar datos
    const mergedParts: PartItem[] = catalogData.map(item => ({
      ...item,
      inventory_id: inventoryMap[item.id]?.id,
      branch_id: selectedBranchId || undefined,
      stock_quantity: inventoryMap[item.id]?.stock_quantity || 0,
      min_stock_alert: inventoryMap[item.id]?.min_stock_alert || 5,
      location: inventoryMap[item.id]?.location || null
    }));

    setParts(mergedParts);
  };

  const loadSales = async () => {
    let query = supabase
      .from('parts_sales')
      .select('*');

    if (selectedBranchId) {
      query = query.eq('branch_id', selectedBranchId);
    }

    const { data, error } = await query.order('sale_date', { ascending: false });
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

  const loadPartsRequests = async () => {
    let query = supabase
      .from('parts_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (selectedBranchId) {
      query = query.eq('branch_id', selectedBranchId);
    }

    const { data, error } = await query;
    if (!error && data) {
      setPartsRequests(data);
    }
  };

  const handleUpdateRequestStatus = async (requestId: string, newStatus: string) => {
    const { error } = await supabase
      .from('parts_requests')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', requestId);

    if (!error) {
      loadPartsRequests();
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
    // 1. Preparar datos del Catálogo (Global)
    const catalogData = {
      sku: partFormData.sku,
      name: partFormData.name,
      category: partFormData.category,
      subcategory: partFormData.subcategory,
      description: partFormData.description,
      compatible_models: partFormData.compatible_models.split(',').map(m => m.trim()).filter(m => m),
      brand: partFormData.brand,
      price_retail: parseFloat(partFormData.sale_price) || 0,
      cost_price: parseFloat(partFormData.cost) || 0,
      supplier: partFormData.supplier,
      image_url: null, // TODO: Implementar subida de imagen
      active: partFormData.active
    };

    let catalogId = editingPart?.id;

    if (editingPart) {
      // Actualizar Catálogo
      const { error: catalogError } = await supabase
        .from('parts_catalog')
        .update(catalogData)
        .eq('id', catalogId);

      if (catalogError) {
        console.error('Error updating catalog:', catalogError);
        return;
      }
    } else {
      // Crear en Catálogo
      const { data: newPart, error: catalogError } = await supabase
        .from('parts_catalog')
        .insert([catalogData])
        .select()
        .single();

      if (catalogError || !newPart) {
        console.error('Error creating part:', catalogError);
        return;
      }
      catalogId = newPart.id;
    }

    // 2. Actualizar Inventario Local (Si hay sucursal seleccionada)
    if (selectedBranchId && catalogId) {
      const inventoryData = {
        branch_id: selectedBranchId,
        catalog_id: catalogId,
        stock_quantity: parseInt(partFormData.stock) || 0,
        min_stock_alert: parseInt(partFormData.min_stock) || 5,
        location: partFormData.location
      };

      // Verificar si ya existe registro de inventario para esta sucursal
      const { data: existingInventory } = await supabase
        .from('parts_inventory')
        .select('id')
        .eq('branch_id', selectedBranchId)
        .eq('catalog_id', catalogId)
        .single();

      if (existingInventory) {
        await supabase
          .from('parts_inventory')
          .update(inventoryData)
          .eq('id', existingInventory.id);
      } else {
        await supabase
          .from('parts_inventory')
          .insert([inventoryData]);
      }
    }

    loadParts();
    setShowPartModal(false);
  };

  const handleDeletePart = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este producto del Catálogo Global? Esto afectará a todas las sucursales.')) {
      const { error } = await supabase
        .from('parts_catalog')
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
    if (!selectedBranchId) {
      alert('Selecciona una sucursal para registrar la venta');
      return;
    }

    const subtotal = saleFormData.items.reduce((sum, item) => sum + item.total, 0);
    const total = subtotal; // Sin descuento por ahora

    const saleData = {
      ...saleFormData,
      items: saleFormData.items,
      subtotal,
      total,
      discount: 0,
      branch_id: selectedBranchId // Asociar venta a sucursal
    };

    const { error } = await supabase
      .from('parts_sales')
      .insert([saleData]);

    if (!error) {
      // Actualizar stock de cada item vendido
      for (const item of saleFormData.items) {
        const part = parts.find(p => p.id === item.part_id);
        if (part) {
          // Buscar inventario específico
          const { data: invData } = await supabase
            .from('parts_inventory')
            .select('id, stock_quantity')
            .eq('branch_id', selectedBranchId)
            .eq('catalog_id', item.part_id)
            .maybeSingle(); // Use maybeSingle to avoid error if not found

          let inventoryId = invData?.id;
          let currentStock = invData?.stock_quantity || 0;

          // Si no existe inventario, crearlo
          if (!inventoryId) {
            const { data: newInv, error: createError } = await supabase
              .from('parts_inventory')
              .insert([{
                branch_id: selectedBranchId,
                catalog_id: item.part_id,
                stock_quantity: 0,
                min_stock_alert: 5
              }])
              .select()
              .single();

            if (!createError && newInv) {
              inventoryId = newInv.id;
              currentStock = 0;
            }
          }

          if (inventoryId) {
            // Permitir stock negativo para no bloquear venta
            const newStock = currentStock - item.quantity;

            await supabase
              .from('parts_inventory')
              .update({ stock_quantity: newStock })
              .eq('id', inventoryId);

            // Registrar movimiento de inventario
            await supabase
              .from('parts_inventory_movements')
              .insert([{
                part_id: item.part_id, // Refers to catalog_id conceptually
                branch_id: selectedBranchId,
                movement_type: 'venta',
                quantity: -item.quantity,
                previous_stock: currentStock,
                new_stock: newStock,
                reason: `Venta a ${saleFormData.customer_name}`
              }]);
          }
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
    if (!part || !selectedBranchId) return;

    // Obtener stock actual real de base de datos
    const { data: invData } = await supabase
      .from('parts_inventory')
      .select('id, stock_quantity')
      .eq('branch_id', selectedBranchId)
      .eq('catalog_id', movementFormData.part_id)
      .single();

    // Si no existe registro de inventario, asumimos stock 0 (o creamos si es entrada)
    const currentStock = invData ? invData.stock_quantity : 0;
    const invId = invData?.id;

    const quantity = parseInt(movementFormData.quantity);
    const isPositive = movementFormData.movement_type === 'entrada' || movementFormData.movement_type === 'ajuste'; // Simplificación (ajuste puede ser negativo, asumir entrada por ahora)

    // Mejor lógica para tipo de movimiento:
    let finalQuantity = quantity;
    if (movementFormData.movement_type === 'salida' || movementFormData.movement_type === 'venta') {
      finalQuantity = -quantity;
    }
    // Ajuste suele ser "setear a X" o "diferencia". Asumiremos diferencia por simplicidad del UI actual (+/-)
    // Si el usuario pone cantidad positiva en "salida", lo restamos.

    const newStock = Math.max(0, currentStock + finalQuantity);

    const movementData = {
      part_id: movementFormData.part_id,
      branch_id: selectedBranchId,
      movement_type: movementFormData.movement_type,
      quantity: finalQuantity,
      previous_stock: currentStock,
      new_stock: newStock,
      reason: movementFormData.reason
    };

    const { error: movementError } = await supabase
      .from('parts_inventory_movements')
      .insert([movementData]);

    if (!movementError) {
      if (invId) {
        await supabase
          .from('parts_inventory')
          .update({ stock_quantity: newStock })
          .eq('id', invId);
      } else if (finalQuantity > 0) {
        // Si es entrada y no existe registro, crearlo
        await supabase.from('parts_inventory').insert({
          branch_id: selectedBranchId,
          catalog_id: movementFormData.part_id,
          stock_quantity: newStock,
          min_stock_alert: 5 // Default
        });
      }

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

  const [showImportModal, setShowImportModal] = useState(false);
  const [searchTermImport, setSearchTermImport] = useState('');

  // ... (previous state declarations)

  const handleImportPart = async (catalogId: string) => {
    if (!selectedBranchId) return;

    try {
      const { error } = await supabase
        .from('parts_inventory')
        .insert({
          branch_id: selectedBranchId,
          catalog_id: catalogId,
          stock_quantity: 0,
          min_stock_alert: 5 // Default
        });

      if (error) throw error;

      // Reload to update list
      loadParts();
      // Optional: Close modal or keep open for more imports
    } catch (error) {
      console.error('Error importing part:', error);
      alert('Error al importar el producto');
    }
  };

  const filteredParts = parts.filter(part => {
    // Si hay sucursal seleccionada, solo mostrar lo que tiene inventario (o se acaba de crear).
    // Si NO hay sucursal (Vista Global Admin), mostrar todo el catálogo.
    if (selectedBranchId && !part.inventory_id) return false;

    const matchesSearch = part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.brand?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || part.category === categoryFilter;
    const matchesLowStock = !lowStockFilter || part.stock_quantity <= part.min_stock_alert;

    return matchesSearch && matchesCategory && matchesLowStock;
  });

  // Partes disponibles para importar (están en catálogo pero NO en inventario local)
  const importableParts = parts.filter(part => !part.inventory_id && (
    part.name.toLowerCase().includes(searchTermImport.toLowerCase()) ||
    part.sku.toLowerCase().includes(searchTermImport.toLowerCase())
  ));

  const totalInventoryValue = filteredParts.reduce((sum, part) => sum + (part.stock_quantity * (part.cost_price || 0)), 0);
  const lowStockItems = filteredParts.filter(part => part.stock_quantity <= part.min_stock_alert).length;
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
        {/* Branch Selector Shortcut or Status */}
        {!selectedBranchId && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>Vista Global: Selecciona una sucursal para gestionar existencias específicas.</span>
          </div>
        )}
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
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${activeTab === 'inventory'
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
            onClick={() => setActiveTab('sales')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${activeTab === 'sales'
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
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${activeTab === 'movements'
              ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
              : 'text-gray-600 hover:bg-gray-50'
              }`}
          >
            <div className="flex items-center justify-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Movimientos ({movements.length})
            </div>
          </button>
          {(user?.role === 'admin' || user?.role === 'gerente') && (
            <button
              onClick={() => setActiveTab('solicitudes')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${activeTab === 'solicitudes'
                ? 'bg-orange-50 text-orange-700 border-b-2 border-orange-600'
                : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              <div className="flex items-center justify-center gap-2">
                <ClipboardList className="w-5 h-5" />
                Solicitudes ({partsRequests.length})
              </div>
            </button>
          )}
        </div>

        <div className="p-6">
          {activeTab === 'inventory' && (
            <div className="space-y-4">
              <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar productos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
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
                  <label className="flex items-center gap-2 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={lowStockFilter}
                      onChange={(e) => setLowStockFilter(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">Solo stock bajo</span>
                  </label>
                </div>

                <div className="flex flex-wrap gap-2 w-full xl:w-auto justify-end">
                  <button
                    onClick={() => setShowMovementModal(true)}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg font-semibold transition-all whitespace-nowrap text-sm"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Movimiento
                  </button>
                  <button
                    onClick={() => setShowSaleModal(true)}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg font-semibold transition-all whitespace-nowrap text-sm"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Nueva Venta
                  </button>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg font-semibold transition-all whitespace-nowrap text-sm"
                  >
                    <Package className="w-4 h-4" />
                    Importar Catálogo
                  </button>
                  <button
                    onClick={() => handleOpenPartModal()}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-semibold transition-all whitespace-nowrap text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Nuevo
                  </button>
                </div>
              </div>

              {/* Modal de Importación */}
              {
                showImportModal && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                      <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
                        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                          <Package className="w-6 h-6 text-indigo-600" />
                          Importar del Catálogo Global
                        </h3>
                        <button
                          onClick={() => setShowImportModal(false)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <X className="w-6 h-6" />
                        </button>
                      </div>

                      <div className="p-6 border-b border-gray-100">
                        <div className="relative">
                          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Buscar en catálogo global..."
                            value={searchTermImport}
                            onChange={(e) => setSearchTermImport(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto p-6">
                        {importableParts.length === 0 ? (
                          <div className="text-center py-12 text-gray-500">
                            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>No hay productos disponibles para importar con esa búsqueda.</p>
                            <p className="text-sm mt-1">(O ya están todos en tu inventario)</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {importableParts.map(part => (
                              <div key={part.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow flex justify-between items-center group">
                                <div>
                                  <div className="font-bold text-gray-800">{part.name}</div>
                                  <div className="text-sm text-gray-500 font-mono">{part.sku}</div>
                                  <span className={`inline-block px-2 py-0.5 text-xs rounded mt-1 ${part.category === 'refaccion' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                    }`}>
                                    {part.category}
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleImportPart(part.id)}
                                  className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity hover:bg-indigo-200"
                                >
                                  + Agregar
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end">
                        <button
                          onClick={() => setShowImportModal(false)}
                          className="px-4 py-2 text-gray-600 font-semibold hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          Cerrar
                        </button>
                      </div>
                    </div>
                  </div>
                )
              }

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
                    {filteredParts.length > 0 ? (
                      filteredParts.map((part) => (
                        <tr key={part.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm font-mono text-gray-800">{part.sku}</td>
                          <td className="px-6 py-4">
                            <div>
                              <div className="font-semibold text-gray-800">{part.name}</div>
                              {part.brand && <div className="text-xs text-gray-500">{part.brand}</div>}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-block px-2 py-1 text-xs font-bold rounded ${part.category === 'refaccion'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                              }`}>
                              {part.category === 'refaccion' ? 'Refacción' : 'Accesorio'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {part.inventory_id ? (
                                <>
                                  <span className={`font-bold ${part.stock_quantity <= part.min_stock_alert
                                    ? 'text-red-600'
                                    : 'text-gray-800'
                                    }`}>
                                    {part.stock_quantity}
                                  </span>
                                  {part.stock_quantity <= part.min_stock_alert && (
                                    <AlertTriangle className="w-4 h-4 text-red-600" />
                                  )}
                                </>
                              ) : (
                                <span className="text-gray-400 font-mono">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                            ${(part.price_retail || 0).toLocaleString('es-MX')}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            ${(part.cost_price || 0).toLocaleString('es-MX')}
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
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                          <div className="flex flex-col items-center gap-3">
                            <Package className="w-12 h-12 text-gray-300" />
                            <p className="text-lg font-medium text-gray-700">No hay productos en el inventario</p>
                            <p className="text-sm max-w-sm mx-auto mb-4">
                              Hay {parts.length} productos en el catálogo global. Importa productos para gestionar su stock en esta sucursal.
                            </p>
                            <button
                              onClick={() => setShowImportModal(true)}
                              className="text-blue-600 hover:text-blue-800 font-semibold underline"
                            >
                              Importar del Catálogo
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )
          }

          {
            activeTab === 'sales' && (
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
                            <span className={`inline-block px-2 py-1 text-xs font-bold rounded ${sale.customer_type === 'walk-in'
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
            )
          }

          {
            activeTab === 'movements' && (
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
                              <span className={`inline-block px-2 py-1 text-xs font-bold rounded ${movement.movement_type === 'entrada'
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
            )
          }

          {activeTab === 'solicitudes' && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por cliente, refacción..."
                      value={requestSearchTerm}
                      onChange={(e) => setRequestSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <select
                    value={requestStatusFilter}
                    onChange={(e) => setRequestStatusFilter(e.target.value as any)}
                    className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="en_proceso">En Proceso</option>
                    <option value="completada">Completada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
                <div className="text-sm text-gray-500">
                  {partsRequests.filter(r => {
                    const matchesSearch = requestSearchTerm === '' ||
                      r.customer_name.toLowerCase().includes(requestSearchTerm.toLowerCase()) ||
                      r.part_name.toLowerCase().includes(requestSearchTerm.toLowerCase());
                    const matchesStatus = requestStatusFilter === 'all' || r.status === requestStatusFilter;
                    return matchesSearch && matchesStatus;
                  }).length} solicitudes
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-orange-50 to-orange-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Cliente</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Refacción</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Modelo</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Ubicación</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Gerente</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {partsRequests
                      .filter(r => {
                        const matchesSearch = requestSearchTerm === '' ||
                          r.customer_name.toLowerCase().includes(requestSearchTerm.toLowerCase()) ||
                          r.part_name.toLowerCase().includes(requestSearchTerm.toLowerCase());
                        const matchesStatus = requestStatusFilter === 'all' || r.status === requestStatusFilter;
                        return matchesSearch && matchesStatus;
                      })
                      .map((request) => (
                        <tr key={request.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-4 text-sm text-gray-600">
                            {new Date(request.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                            <div className="text-xs text-gray-400">
                              {new Date(request.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-semibold text-gray-800">{request.customer_name}</div>
                            {request.customer_phone && (
                              <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                <Phone className="w-3 h-3" />
                                {request.customer_phone}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1.5">
                              <WrenchIcon className="w-4 h-4 text-orange-500" />
                              <span className="font-medium text-gray-800">{request.part_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700">
                            {request.motorcycle_model || '-'}
                          </td>
                          <td className="px-4 py-4">
                            {(request.city || request.state) ? (
                              <div className="flex items-center gap-1 text-sm text-gray-600">
                                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                {[request.city, request.state].filter(Boolean).join(', ')}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700">
                            {request.assigned_manager_name || '-'}
                          </td>
                          <td className="px-4 py-4 text-center">
                            <select
                              value={request.status}
                              onChange={(e) => handleUpdateRequestStatus(request.id, e.target.value)}
                              className={`px-3 py-1.5 text-xs font-bold rounded-full border-2 cursor-pointer transition-colors ${request.status === 'pendiente'
                                ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                                : request.status === 'en_proceso'
                                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                                  : request.status === 'completada'
                                    ? 'bg-green-100 text-green-800 border-green-300'
                                    : 'bg-red-100 text-red-800 border-red-300'
                                }`}
                            >
                              <option value="pendiente">Pendiente</option>
                              <option value="en_proceso">En Proceso</option>
                              <option value="completada">Completada</option>
                              <option value="cancelada">Cancelada</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>

                {partsRequests.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-semibold">No hay solicitudes de refacciones</p>
                    <p className="text-sm mt-1">Las solicitudes llegarán desde el bot de WhatsApp</p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div >
      </div >

      {/* Modal de Producto */}
      {
        showPartModal && (
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
        )
      }

      {/* Modal de Nueva Venta */}
      {
        showSaleModal && (
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
                        {parts.filter(p => p.active).map(part => (
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
        )
      }

      {/* Modal de Movimiento de Inventario */}
      {
        showMovementModal && (
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
        )
      }
    </div >
  );
}