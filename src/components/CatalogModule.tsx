import { useState, useEffect } from 'react';
import { supabase, CatalogItem } from '../lib/supabase';
import { PartsInventoryModule } from './PartsInventoryModule';
import { useAuth } from '../contexts/AuthContext';
import { useBranch } from '../contexts/BranchContext'; // Import useBranch
import { canEditCatalog, type Role } from '../utils/permissions';
import { Package, CheckCircle, XCircle, Plus, CreditCard as Edit2, Trash2, Eye, FileText, Bike, TrendingUp, DollarSign, Gauge, Palette, X, Search, Filter, Wrench, Upload, Image as ImageIcon } from 'lucide-react';
import { useNotificationContext } from '../context/NotificationContext';
import { createLowStockNotification, createOutOfStockNotification } from '../utils/notificationHelpers';

type ViewMode = 'grid' | 'table';
type FilterSegment = 'all' | 'Deportiva' | 'Naked' | 'Doble Propósito' | 'Scooter' | 'Trabajo' | 'Street' | 'Cross/Country' | 'Carros' | 'Cuatrimoto/ATV: Deportivas' | 'Cuatrimoto/ATV: Utilitarios' | 'Nuevos lanzamientos';
type MainView = 'motorcycles' | 'parts';

export function CatalogModule() {
  const { user } = useAuth();
  const { selectedBranchId } = useBranch(); // Use branch context
  const { addNotification, notifications } = useNotificationContext();
  const [mainView, setMainView] = useState<MainView>('motorcycles');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterSegment, setFilterSegment] = useState<FilterSegment>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  // Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchTermImport, setSearchTermImport] = useState('');

  const hasExistingStockNotification = (itemId: string, notifications: any[]) => {
    return notifications.some(
      n => n.entity_id === itemId &&
        (n.type === 'low_stock_alert' || n.type === 'out_of_stock_alert') &&
        !n.is_read
    );
  };

  // Helpers para persistencia de notificaciones de stock
  const getNotifiedItems = (): Record<string, number> => {
    const key = `quma_notified_stock_${user?.id || 'guest'}`;
    try {
      return JSON.parse(localStorage.getItem(key) || '{}');
    } catch {
      return {};
    }
  };

  const updateNotifiedItem = (itemId: string, stock: number) => {
    const key = `quma_notified_stock_${user?.id || 'guest'}`;
    const items = getNotifiedItems();
    items[itemId] = stock;
    localStorage.setItem(key, JSON.stringify(items));
  };

  const removeNotifiedItem = (itemId: string) => {
    const key = `quma_notified_stock_${user?.id || 'guest'}`;
    const items = getNotifiedItems();
    if (itemId in items) {
      delete items[itemId];
      localStorage.setItem(key, JSON.stringify(items));
    }
  };

  const [formData, setFormData] = useState({
    segment: 'Deportiva',
    model: '',
    price_cash: '',
    stock: '',
    test_drive_available: false,
    year: new Date().getFullYear(),
    color_options: '',
    engine_cc: '',
    engine_type: '',
    max_power: '',
    max_torque: '',
    transmission: '',
    fuel_capacity: '',
    weight: '',
    seat_height: '',
    abs: false,
    traction_control: false,
    riding_modes: '',
    description: '',
    key_features: '',
    image_url: '',
    brochure_url: '',
    active: true
  });

  useEffect(() => {
    loadCatalog();
  }, [selectedBranchId]); // Reload when branch changes

  useEffect(() => {
    const checkLowStock = async () => {
      // Only check low stock if we have items loaded and user is relevant
      if (catalog.length === 0) return;

      const lowStockItems = catalog.filter(item => (item.stock || 0) <= 2 && item.active);

      const notifiedItems = getNotifiedItems();

      lowStockItems.forEach(item => {
        if (notifiedItems[item.id] === (item.stock || 0)) return;

        if (!hasExistingStockNotification(item.id, notifications)) {
          const notification = createLowStockNotification({
            id: item.id,
            model: item.model,
            stock: item.stock || 0,
            segment: item.segment,
            price: item.price_cash
          });

          if (notification) {
            addNotification(notification);
            updateNotifiedItem(item.id, item.stock || 0);
          }
        }
      });
    };

    const interval = setInterval(checkLowStock, 1800000);
    return () => clearInterval(interval);
  }, [notifications, user?.id, catalog]);

  const loadCatalog = async () => {
    setLoading(true);
    // 1. Load Global Catalog
    const { data: catalogData, error: catalogError } = await supabase
      .from('catalog')
      .select('*')
      .order('segment', { ascending: true });

    if (catalogError || !catalogData) {
      console.error('Error loading catalog:', catalogError);
      setLoading(false);
      return;
    }

    // 2. Load Local Inventory (if branch selected)
    let inventoryMap: Record<string, { stock: number, test_drive_available: boolean, id: string }> = {};

    if (selectedBranchId) {
      const { data: stockData, error: stockError } = await supabase
        .from('branch_catalog_stock')
        .select('*')
        .eq('branch_id', selectedBranchId);

      if (!stockError && stockData) {
        stockData.forEach(item => {
          inventoryMap[item.catalog_item_id] = {
            stock: item.stock,
            test_drive_available: item.test_drive_available,
            id: item.id
          };
        });
      }
    }

    // 3. Merge Data
    // Note: We keep ALL catalog items in state to allow "Import", but we might want to filter 
    // what is SHOWN in the main grid/table to only "active in branch" items if desired, 
    // OR show all but with 0 stock. 
    // For consistency with Parts, let's show ALL but indicate stock is 0/Not carried if no record.
    // However, the previous logic implies showing everything. 
    // Let's attach the stock info.

    // BUT! For "Import" feature to make sense (like in Parts), we should probably only show items
    // that have a record in `branch_catalog_stock` OR are completely new?
    // In Parts refactor we filtered `parts` to only `inventory_id`.
    // Let's do the same here: Only show items that exist in this branch's inventory.

    // Correction: Catalog is usually global visibility for sales agents. 
    // If we hide items with 0 stock/no record, agents can't see the full lineup to sell/order.
    // So for MOTOS, usually you want to see the whole catalog even if 0 stock.
    // The "Import" concept is more about "Initializing stock record".

    const mergedCatalog: CatalogItem[] = catalogData.map(item => ({
      ...item,
      // If record exists in branch, use its stock. If not, 0.
      stock: inventoryMap[item.id]?.stock || 0,
      test_drive_available: inventoryMap[item.id]?.test_drive_available || false,
      // We add a flag to know if it's "linked" to branch or not
      branch_stock_id: inventoryMap[item.id]?.id
    }));

    setCatalog(mergedCatalog);
    setLoading(false);
  };

  // Filter for MAIN VIEW: Show all active catalog items (unlike parts where we might only want inventory)
  // OR do we want strict separation? 
  // Requirement: "Importar desde Catálogo". This implies they are not in the main list initially?
  // If I show ALL, then "Import" button is redundant unless "Import" just means "Add stock record".
  // Let's assume we want to see everything because agents need to sell Pre-Order.
  // So "Import" might not be as critical for VIEWING, but for MANAGING stock it is.
  // Actually, let's stick to the Parts pattern: Filter main view by "items that have a stock record (even 0)".
  // This keeps the UI clean and branch-specific.

  const filteredCatalog = catalog.filter(item => {
    // Only show if it has a branch_stock_id (meaning it's "in" this branch) OR if we are viewing as Global Admin (maybe?)
    // For now, strict branch view:
    if (selectedBranchId && !item.branch_stock_id) return false;

    const matchesSegment = filterSegment === 'all' || item.segment === filterSegment;
    const matchesSearch = searchTerm === '' ||
      item.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.segment.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSegment && matchesSearch && item.active;
  });

  // Items eligible for import (Global Catalog items NOT in current branch)
  const importableCatalog = catalog.filter(item => !item.branch_stock_id && (
    item.model.toLowerCase().includes(searchTermImport.toLowerCase()) ||
    item.segment.toLowerCase().includes(searchTermImport.toLowerCase())
  ));


  const handleImportCatalogItem = async (catalogItemId: string) => {
    if (!selectedBranchId) return;
    try {
      const { error } = await supabase.from('branch_catalog_stock').insert({
        branch_id: selectedBranchId,
        catalog_item_id: catalogItemId,
        stock: 0,
        test_drive_available: false
      });

      if (error) throw error;
      loadCatalog();
      // Optionally keep modal open
    } catch (err) {
      console.error("Error importing:", err);
      alert("Error al importar el modelo.");
    }
  };

  const handleOpenModal = (item?: CatalogItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        segment: item.segment,
        model: item.model,
        price_cash: item.price_cash.toString(),
        stock: (item.stock || 0).toString(),
        test_drive_available: item.test_drive_available || false,
        year: item.year,
        color_options: item.color_options.join(', '),
        engine_cc: item.engine_cc?.toString() || '',
        engine_type: item.engine_type || '',
        max_power: item.max_power || '',
        max_torque: item.max_torque || '',
        transmission: item.transmission || '',
        fuel_capacity: item.fuel_capacity?.toString() || '',
        weight: item.weight?.toString() || '',
        seat_height: item.seat_height?.toString() || '',
        abs: item.abs,
        traction_control: item.traction_control,
        riding_modes: item.riding_modes.join(', '),
        description: item.description || '',
        key_features: item.key_features.join(', '),
        image_url: item.image_url || '',
        brochure_url: item.brochure_url || '',
        active: item.active
      });
      setImagePreview(item.image_url || '');
    } else {
      setEditingItem(null);
      setFormData({
        segment: 'Deportiva',
        model: '',
        price_cash: '',
        stock: '', // Will be 0 init
        test_drive_available: false,
        year: new Date().getFullYear(),
        color_options: '',
        engine_cc: '',
        engine_type: '',
        max_power: '',
        max_torque: '',
        transmission: '',
        fuel_capacity: '',
        weight: '',
        seat_height: '',
        abs: false,
        traction_control: false,
        riding_modes: '',
        description: '',
        key_features: '',
        image_url: '',
        brochure_url: '',
        active: true
      });
      setImagePreview('');
    }
    setImageFile(null);
    setShowModal(true);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('La imagen no debe superar 5MB');
        return;
      }

      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
        alert('Solo se permiten archivos JPG, PNG o WEBP');
        return;
      }

      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;

    setUploadingImage(true);
    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `motorcycles/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('catalog-images')
        .upload(filePath, imageFile);

      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        alert('Error al subir la imagen');
        return null;
      }

      const { data } = supabase.storage
        .from('catalog-images')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error al subir la imagen');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async () => {
    let finalImageUrl = formData.image_url;

    if (imageFile) {
      const uploadedUrl = await uploadImage();
      if (uploadedUrl) {
        finalImageUrl = uploadedUrl;
      } else {
        return;
      }
    }

    const globalData = {
      segment: formData.segment,
      model: formData.model,
      price_cash: formData.price_cash ? parseFloat(formData.price_cash) : 0,
      // stock removed from global
      // test_drive_available removed from global
      year: formData.year,
      color_options: formData.color_options.split(',').map(c => c.trim()).filter(c => c),
      engine_cc: formData.engine_cc ? parseInt(formData.engine_cc) : null,
      engine_type: formData.engine_type || null,
      max_power: formData.max_power || null,
      max_torque: formData.max_torque || null,
      transmission: formData.transmission || null,
      fuel_capacity: formData.fuel_capacity ? parseFloat(formData.fuel_capacity) : null,
      weight: formData.weight ? parseFloat(formData.weight) : null,
      seat_height: formData.seat_height ? parseInt(formData.seat_height) : null,
      abs: formData.abs,
      traction_control: formData.traction_control,
      riding_modes: formData.riding_modes.split(',').map(m => m.trim()).filter(m => m),
      description: formData.description || null,
      key_features: formData.key_features.split(',').map(f => f.trim()).filter(f => f),
      image_url: finalImageUrl || null,
      brochure_url: formData.brochure_url || null,
      active: formData.active,
      updated_at: new Date().toISOString()
    };

    let catalogId = editingItem?.id;

    if (editingItem) {
      // Update Global Catalog
      const { error } = await supabase
        .from('catalog')
        .update(globalData)
        .eq('id', editingItem.id);

      if (error) {
        alert("Error actualizando catálogo global");
        return;
      }
    } else {
      // Create in Global Catalog
      const { data: newItem, error } = await supabase
        .from('catalog')
        .insert([globalData])
        .select()
        .single();

      if (error || !newItem) {
        alert("Error creando modelo");
        return;
      }
      catalogId = newItem.id;
    }

    // Update Local Branch Stock
    if (selectedBranchId && catalogId) {
      // Upsert stock record
      const stockData = {
        branch_id: selectedBranchId,
        catalog_item_id: catalogId,
        stock: formData.stock ? parseInt(formData.stock) : 0,
        test_drive_available: formData.test_drive_available,
        updated_at: new Date().toISOString()
      };

      const { error: stockError } = await supabase
        .from('branch_catalog_stock')
        .upsert(stockData, { onConflict: 'branch_id, catalog_item_id' }); // Requires unique constaint

      if (stockError) console.error("Error updating branch stock:", stockError);
    }


    setSuccessMessage(editingItem ? 'Modelo actualizado exitosamente' : 'Modelo registrado exitosamente');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);

    setShowModal(false);
    setEditingItem(null);
    setImageFile(null);
    setImagePreview('');
    loadCatalog();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar permanentemente este modelo del catálogo? Esta acción no se puede deshacer y eliminará el modelo de todos los módulos del sistema.')) return;

    const { error } = await supabase
      .from('catalog')
      .delete()
      .eq('id', id);

    if (!error) {

      setSuccessMessage('Modelo eliminado permanentemente');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      loadCatalog();
    } else {
      alert('Error al eliminar el modelo. Por favor intenta nuevamente.');
      console.error('Error al eliminar:', error);
    }
  };

  const getSegmentColor = (segment: string) => {
    switch (segment) {
      case 'Deportiva': return 'bg-red-100 text-red-800 border-red-300';
      case 'Naked': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Doble Propósito': return 'bg-green-100 text-green-800 border-green-300';
      case 'Scooter': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Trabajo': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Street': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Cross/Country': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Carros': return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'Cuatrimoto/ATV: Deportivas': return 'bg-pink-100 text-pink-800 border-pink-300';
      case 'Cuatrimoto/ATV: Utilitarios': return 'bg-teal-100 text-teal-800 border-teal-300';
      case 'Nuevos lanzamientos': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const stats = {
    total: catalog.filter(c => c.active).length,
    withTestDrive: catalog.filter(c => c.active && c.test_drive_available === true).length,
    totalStock: catalog.filter(c => c.active).reduce((acc, c) => acc + (c.stock || 0), 0),
    avgPrice: Math.round(catalog.filter(c => c.active).reduce((acc, c) => acc + c.price_cash, 0) / (catalog.filter(c => c.active).length || 1))
  };

  if (loading) {
    return <div className="text-center py-8">Cargando catálogo...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Package className="w-7 h-7 text-orange-600" />
            Catálogo y Logística
          </h2>
          <p className="text-sm text-gray-600 mt-1">Gestión centralizada de fichas técnicas y disponibilidad</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md border-2 border-gray-200">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setMainView('motorcycles')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${mainView === 'motorcycles'
              ? 'bg-orange-50 text-orange-700 border-b-2 border-orange-600'
              : 'text-gray-600 hover:bg-gray-50'
              }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Bike className="w-5 h-5" />
              Motocicletas
            </div>
          </button>
          <button
            onClick={() => setMainView('parts')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${mainView === 'parts'
              ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
              : 'text-gray-600 hover:bg-gray-50'
              }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Wrench className="w-5 h-5" />
              Refacciones y Accesorios
            </div>
          </button>
        </div>

        <div className="p-6">
          {mainView === 'parts' ? (
            <PartsInventoryModule />
          ) : (
            <div className="space-y-6">
              {canEditCatalog(user?.role as Role) && (
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                  >
                    <Package className="w-5 h-5" />
                    Importar del Catálogo
                  </button>
                  <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    Registrar Modelo
                  </button>
                </div>
              )}

              {/* Modal de Importación */}
              {showImportModal && (
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
                          placeholder="Buscar modelo, segmento..."
                          value={searchTermImport}
                          onChange={(e) => setSearchTermImport(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                      {importableCatalog.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                          <Bike className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p>No hay modelos disponibles para importar con esa búsqueda.</p>
                          <p className="text-sm mt-1">(O ya tienes todos en tu inventario)</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {importableCatalog.map(item => (
                            <div key={item.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow flex justify-between items-center group">
                              <div className="flex items-center gap-3">
                                {item.image_url ? (
                                  <img src={item.image_url} alt={item.model} className="w-16 h-16 object-cover rounded-md" />
                                ) : (
                                  <div className="w-16 h-16 bg-gray-100 rounded-md flex items-center justify-center">
                                    <Bike className="w-8 h-8 text-gray-400" />
                                  </div>
                                )}
                                <div>
                                  <div className="font-bold text-gray-800">{item.model}</div>
                                  <div className="text-sm text-gray-500">{item.year} - {item.segment}</div>
                                  <div className="text-xs text-indigo-600 font-semibold mt-1">
                                    ${item.price_cash.toLocaleString('es-MX')}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => handleImportCatalogItem(item.id)}
                                className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity hover:bg-indigo-200"
                              >
                                + Importar
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
              )}

              {showSuccess && (
                <div className="bg-green-100 border-2 border-green-400 text-green-800 px-4 py-3 rounded-lg flex items-center gap-3">
                  <TrendingUp className="w-5 h-5" />
                  <span className="font-semibold">{successMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <Bike className="w-8 h-8 opacity-80" />
                    <div className="text-right">
                      <div className="text-3xl font-bold">{stats.total}</div>
                      <div className="text-xs opacity-90 mt-1">modelos</div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold mt-2">Catálogo Activo</div>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <CheckCircle className="w-8 h-8 opacity-80" />
                    <div className="text-right">
                      <div className="text-3xl font-bold">{stats.withTestDrive}</div>
                      <div className="text-xs opacity-90 mt-1">disponibles</div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold mt-2">Prueba de Manejo</div>
                </div>

                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <Package className="w-8 h-8 opacity-80" />
                    <div className="text-right">
                      <div className="text-3xl font-bold">{stats.totalStock}</div>
                      <div className="text-xs opacity-90 mt-1">unidades</div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold mt-2">Stock Total</div>
                </div>

                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <DollarSign className="w-8 h-8 opacity-80" />
                    <div className="text-right">
                      <div className="text-2xl font-bold">${(stats.avgPrice / 1000).toFixed(0)}K</div>
                      <div className="text-xs opacity-90 mt-1">promedio</div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold mt-2">Precio Promedio</div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar por modelo o segmento..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFilterSegment('all')}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all ${filterSegment === 'all'
                        ? 'bg-orange-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => setViewMode(viewMode === 'grid' ? 'table' : 'grid')}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-all"
                    >
                      {viewMode === 'grid' ? 'Vista Tabla' : 'Vista Tarjetas'}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                  {['Deportiva', 'Naked', 'Doble Propósito', 'Scooter', 'Trabajo', 'Street', 'Cross/Country', 'Carros', 'Cuatrimoto/ATV: Deportivas', 'Cuatrimoto/ATV: Utilitarios', 'Nuevos lanzamientos'].map((segment) => (
                    <button
                      key={segment}
                      onClick={() => setFilterSegment(segment as FilterSegment)}
                      className={`px-3 py-1 rounded-full text-xs font-bold border-2 whitespace-nowrap transition-all ${filterSegment === segment
                        ? getSegmentColor(segment)
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                      {segment}
                    </button>
                  ))}
                </div>

                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredCatalog.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white rounded-xl shadow-md border-2 border-gray-200 hover:shadow-xl transition-all overflow-hidden"
                      >
                        <div className="bg-gradient-to-br from-gray-100 to-gray-200 h-40 flex items-center justify-center">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.model} className="h-full w-full object-cover" />
                          ) : (
                            <Bike className="w-20 h-20 text-gray-400" />
                          )}
                        </div>

                        <div className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <span className={`inline-block px-2 py-1 text-xs font-bold rounded-full border ${getSegmentColor(item.segment)}`}>
                                {item.segment}
                              </span>
                              <h3 className="text-xl font-bold text-gray-800 mt-2">{item.model}</h3>
                              <p className="text-sm text-gray-600 mt-1">{item.year}</p>
                            </div>
                          </div>

                          <div className="space-y-2 mb-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Precio</span>
                              <span className="text-lg font-bold text-green-600">
                                ${item.price_cash.toLocaleString('es-MX')}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Stock</span>
                              <span className={`text-sm font-bold ${(item.stock || 0) > 3 ? 'text-green-600' : (item.stock || 0) > 0 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                {item.stock || 0} unidades
                              </span>
                            </div>
                            {item.engine_cc && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Motor</span>
                                <span className="text-sm font-semibold text-gray-800">{item.engine_cc} cc</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mb-4">
                            {item.test_drive_available ? (
                              <>
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                <span className="text-xs font-medium text-green-700">Prueba disponible</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-4 h-4 text-gray-400" />
                                <span className="text-xs text-gray-500">Sin prueba</span>
                              </>
                            )}
                          </div>

                          {item.color_options.length > 0 && (
                            <div className="mb-4">
                              <div className="flex items-center gap-2 mb-2">
                                <Palette className="w-4 h-4 text-gray-600" />
                                <span className="text-xs font-semibold text-gray-700">Colores</span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {item.color_options.slice(0, 3).map((color, idx) => (
                                  <span key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">
                                    {color}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2 pt-4 border-t border-gray-200">
                            <button
                              onClick={() => {
                                setSelectedItem(item);
                                setShowDetailsModal(true);
                              }}
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all"
                            >
                              <Eye className="w-4 h-4" />
                              Ver
                            </button>
                            {canEditCatalog(user?.role as Role) && (
                              <>
                                <button
                                  onClick={() => handleOpenModal(item)}
                                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold transition-all"
                                >
                                  <Edit2 className="w-4 h-4" />
                                  Editar
                                </button>
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  className="flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-orange-50 to-orange-100 border-b-2 border-orange-200">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Segmento</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Modelo</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Precio</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Stock</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Motor</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Prueba</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {filteredCatalog.map((item) => (
                          <tr key={item.id} className="hover:bg-orange-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs font-bold rounded-full border ${getSegmentColor(item.segment)}`}>
                                {item.segment}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-bold text-gray-900">{item.model}</div>
                              <div className="text-xs text-gray-500">{item.year}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-semibold text-green-600">
                                ${item.price_cash.toLocaleString('es-MX')}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`text-sm font-bold ${(item.stock || 0) > 3 ? 'text-green-600' : (item.stock || 0) > 0 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                {item.stock || 0}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-semibold text-gray-700">{item.engine_cc} cc</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {item.test_drive_available ? (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                              ) : (
                                <XCircle className="w-5 h-5 text-gray-400" />
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedItem(item);
                                    setShowDetailsModal(true);
                                  }}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                {canEditCatalog(user?.role as Role) && (
                                  <>
                                    <button
                                      onClick={() => handleOpenModal(item)}
                                      className="p-2 text-orange-600 hover:bg-orange-50 rounded transition-colors"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDelete(item.id)}
                                      className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-lg shadow-md p-6 border-2 border-orange-200">
                <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-orange-600" />
                  Características del Catálogo
                </h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-orange-600 font-bold">•</span>
                    <span>Información centralizada de todos los modelos con especificaciones técnicas completas</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-600 font-bold">•</span>
                    <span>Control de disponibilidad de prueba de manejo por modelo</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-600 font-bold">•</span>
                    <span>La clasificación por segmento facilita la navegación y permite filtros inteligentes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-600 font-bold">•</span>
                    <span>Las fichas técnicas centralizadas reemplazan PDFs dispersos, permitiendo acceso rápido a datos</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-auto" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-8" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white rounded-t-xl">
              <h3 className="text-xl font-bold text-gray-800">
                {editingItem ? 'Editar Modelo' : 'Registrar Nuevo Modelo'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Segmento</label>
                  <select
                    value={formData.segment}
                    onChange={(e) => setFormData({ ...formData, segment: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  >
                    <option value="Deportiva">Deportiva</option>
                    <option value="Naked">Naked</option>
                    <option value="Doble Propósito">Doble Propósito</option>
                    <option value="Scooter">Scooter</option>
                    <option value="Trabajo">Trabajo</option>
                    <option value="Street">Street</option>
                    <option value="Cross/Country">Cross/Country</option>
                    <option value="Carros">Carros</option>
                    <option value="Cuatrimoto/ATV: Deportivas">Cuatrimoto/ATV: Deportivas</option>
                    <option value="Cuatrimoto/ATV: Utilitarios">Cuatrimoto/ATV: Utilitarios</option>
                    <option value="Nuevos lanzamientos">Nuevos lanzamientos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Modelo</label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                    placeholder="Ej: MT-07"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Precio Contado (MXN)</label>
                  <input
                    type="number"
                    value={formData.price_cash}
                    onChange={(e) => setFormData({ ...formData, price_cash: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Stock Disponible</label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Año</label>
                  <input
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Cilindraje (cc)</label>
                  <input
                    type="number"
                    value={formData.engine_cc}
                    onChange={(e) => setFormData({ ...formData, engine_cc: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de Motor</label>
                  <input
                    type="text"
                    value={formData.engine_type}
                    onChange={(e) => setFormData({ ...formData, engine_type: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                    placeholder="Ej: Bicilíndrico en línea"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Potencia Máxima</label>
                  <input
                    type="text"
                    value={formData.max_power}
                    onChange={(e) => setFormData({ ...formData, max_power: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                    placeholder="Ej: 73.4 HP @ 9,000 rpm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Torque Máximo</label>
                  <input
                    type="text"
                    value={formData.max_torque}
                    onChange={(e) => setFormData({ ...formData, max_torque: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                    placeholder="Ej: 68 Nm @ 6,500 rpm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Transmisión</label>
                  <input
                    type="text"
                    value={formData.transmission}
                    onChange={(e) => setFormData({ ...formData, transmission: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                    placeholder="Ej: 6 velocidades"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Capacidad Tanque (L)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.fuel_capacity}
                    onChange={(e) => setFormData({ ...formData, fuel_capacity: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Peso (kg)</label>
                  <input
                    type="number"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Altura Asiento (mm)</label>
                  <input
                    type="number"
                    value={formData.seat_height}
                    onChange={(e) => setFormData({ ...formData, seat_height: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Colores Disponibles (separados por coma)</label>
                <input
                  type="text"
                  value={formData.color_options}
                  onChange={(e) => setFormData({ ...formData, color_options: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  placeholder="Ej: Azul, Negro, Rojo"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Modos de Manejo (separados por coma)</label>
                <input
                  type="text"
                  value={formData.riding_modes}
                  onChange={(e) => setFormData({ ...formData, riding_modes: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  placeholder="Ej: Sport, Rain, Tour"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none h-24"
                  placeholder="Descripción comercial del modelo"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Características Destacadas (separadas por coma)</label>
                <textarea
                  value={formData.key_features}
                  onChange={(e) => setFormData({ ...formData, key_features: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none h-20"
                  placeholder="Ej: Motor CP2, Chasis ligero, ABS, TFT Display"
                />
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Imagen del Modelo</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600 mb-2">Opción 1: URL de imagen</label>
                      <input
                        type="text"
                        value={formData.image_url}
                        onChange={(e) => {
                          setFormData({ ...formData, image_url: e.target.value });
                          if (e.target.value) {
                            setImageFile(null);
                            setImagePreview(e.target.value);
                          }
                        }}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                        placeholder="https://..."
                        disabled={!!imageFile}
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-2">Opción 2: Cargar desde ordenador</label>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          onChange={handleImageFileChange}
                          className="hidden"
                          id="image-upload"
                          disabled={!!formData.image_url}
                        />
                        <label
                          htmlFor="image-upload"
                          className={`flex items-center justify-center gap-2 w-full px-4 py-2 border-2 border-dashed rounded-lg cursor-pointer transition-all ${formData.image_url
                            ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'border-orange-400 hover:border-orange-500 hover:bg-orange-50 text-orange-700'
                            }`}
                        >
                          <Upload className="w-5 h-5" />
                          <span className="text-sm font-medium">
                            {imageFile ? imageFile.name : 'Seleccionar imagen'}
                          </span>
                        </label>
                      </div>
                      {imageFile && (
                        <button
                          type="button"
                          onClick={() => {
                            setImageFile(null);
                            setImagePreview(formData.image_url || '');
                          }}
                          className="mt-2 text-xs text-red-600 hover:text-red-800"
                        >
                          Eliminar archivo seleccionado
                        </button>
                      )}
                    </div>
                  </div>

                  {imagePreview && (
                    <div className="mt-4">
                      <label className="block text-xs text-gray-600 mb-2">Vista previa:</label>
                      <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-300">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-full h-full object-contain"
                          onError={() => setImagePreview('')}
                        />
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-gray-500 mt-2">
                    Formatos permitidos: JPG, PNG, WEBP (máx. 5MB)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">URL Brochure/Ficha</label>
                  <input
                    type="text"
                    value={formData.brochure_url}
                    onChange={(e) => setFormData({ ...formData, brochure_url: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.test_drive_available}
                    onChange={(e) => setFormData({ ...formData, test_drive_available: e.target.checked })}
                    className="w-5 h-5 accent-orange-600"
                  />
                  <label className="text-sm font-semibold text-gray-700">Prueba de Manejo Disponible</label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.abs}
                    onChange={(e) => setFormData({ ...formData, abs: e.target.checked })}
                    className="w-5 h-5 accent-orange-600"
                  />
                  <label className="text-sm font-semibold text-gray-700">Sistema ABS</label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.traction_control}
                    onChange={(e) => setFormData({ ...formData, traction_control: e.target.checked })}
                    className="w-5 h-5 accent-orange-600"
                  />
                  <label className="text-sm font-semibold text-gray-700">Control de Tracción</label>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex gap-3 sticky bottom-0 bg-white rounded-b-xl">
              <button
                onClick={handleSubmit}
                disabled={uploadingImage}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${uploadingImage
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-orange-600 hover:bg-orange-700 text-white'
                  }`}
              >
                {uploadingImage ? (
                  <>
                    <Upload className="w-5 h-5 animate-pulse" />
                    Subiendo imagen...
                  </>
                ) : (
                  <>{editingItem ? 'Actualizar Modelo' : 'Registrar Modelo'}</>
                )}
              </button>
              <button
                onClick={() => setShowModal(false)}
                disabled={uploadingImage}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailsModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-auto" onClick={() => setShowDetailsModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-8" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white rounded-t-xl">
              <h3 className="text-2xl font-bold text-gray-800">{selectedItem.model}</h3>
              <button onClick={() => setShowDetailsModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="flex items-start gap-4">
                <span className={`px-3 py-1 text-sm font-bold rounded-full border ${getSegmentColor(selectedItem.segment)}`}>
                  {selectedItem.segment}
                </span>
                <span className="text-sm text-gray-600">{selectedItem.year}</span>
              </div>

              {selectedItem.description && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-700 mb-2">Descripción</h4>
                  <p className="text-gray-700 leading-relaxed">{selectedItem.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="text-xs text-gray-600 mb-1">Precio</div>
                  <div className="text-lg font-bold text-green-600">
                    ${selectedItem.price_cash.toLocaleString('es-MX')}
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="text-xs text-gray-600 mb-1">Stock</div>
                  <div className="text-lg font-bold text-blue-600">{selectedItem.stock} unidades</div>
                </div>

                {selectedItem.engine_cc && (
                  <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                    <div className="text-xs text-gray-600 mb-1">Motor</div>
                    <div className="text-lg font-bold text-orange-600">{selectedItem.engine_cc} cc</div>
                  </div>
                )}

                {selectedItem.weight && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">Peso</div>
                    <div className="text-lg font-bold text-gray-600">{selectedItem.weight} kg</div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Especificaciones Técnicas</h4>
                  <div className="space-y-2 text-sm">
                    {selectedItem.engine_type && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tipo de Motor:</span>
                        <span className="font-semibold text-gray-800">{selectedItem.engine_type}</span>
                      </div>
                    )}
                    {selectedItem.max_power && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Potencia:</span>
                        <span className="font-semibold text-gray-800">{selectedItem.max_power}</span>
                      </div>
                    )}
                    {selectedItem.max_torque && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Torque:</span>
                        <span className="font-semibold text-gray-800">{selectedItem.max_torque}</span>
                      </div>
                    )}
                    {selectedItem.transmission && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Transmisión:</span>
                        <span className="font-semibold text-gray-800">{selectedItem.transmission}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Dimensiones y Capacidades</h4>
                  <div className="space-y-2 text-sm">
                    {selectedItem.fuel_capacity && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tanque:</span>
                        <span className="font-semibold text-gray-800">{selectedItem.fuel_capacity} L</span>
                      </div>
                    )}
                    {selectedItem.seat_height && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Altura Asiento:</span>
                        <span className="font-semibold text-gray-800">{selectedItem.seat_height} mm</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">ABS:</span>
                      <span className="font-semibold text-gray-800">{selectedItem.abs ? 'Sí' : 'No'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Control Tracción:</span>
                      <span className="font-semibold text-gray-800">{selectedItem.traction_control ? 'Sí' : 'No'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedItem.color_options.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Colores Disponibles</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.color_options.map((color, idx) => (
                      <span key={idx} className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
                        {color}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedItem.riding_modes.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Modos de Manejo</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.riding_modes.map((mode, idx) => (
                      <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                        {mode}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedItem.key_features.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Características Destacadas</h4>
                  <ul className="space-y-2">
                    {selectedItem.key_features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  {selectedItem.test_drive_available ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-semibold text-green-700">Prueba de Manejo Disponible</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-gray-400" />
                      <span className="text-sm text-gray-500">Sin prueba de manejo disponible</span>
                    </>
                  )}
                </div>
              </div>

              {selectedItem.brochure_url && (
                <div className="pt-4 border-t border-gray-200">
                  <a
                    href={selectedItem.brochure_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all"
                  >
                    <FileText className="w-5 h-5" />
                    Ver Ficha Técnica Completa
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}