import { useState, useEffect } from 'react';
import { supabase, CatalogItem } from '../lib/supabase';
import { PartsInventoryModule } from './PartsInventoryModule';
import {
  Package, CheckCircle, XCircle, Plus, Edit2, Trash2, Eye, FileText,
  Bike, TrendingUp, DollarSign, Gauge, Palette, X, Search, Filter, Wrench, Upload, Image as ImageIcon
} from 'lucide-react';

type ViewMode = 'grid' | 'table';
type FilterSegment = 'all' | 'Deportiva' | 'Naked' | 'Doble Propósito' | 'Scooter' | 'Touring' | 'Adventure';
type MainView = 'motorcycles' | 'parts';

export function CatalogModule() {
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

  const [formData, setFormData] = useState({
    segment: 'Deportiva',
    model: '',
    price_cash: 0,
    stock: 0,
    test_drive_available: false,
    year: new Date().getFullYear(),
    color_options: '',
    engine_cc: 0,
    engine_type: '',
    max_power: '',
    max_torque: '',
    transmission: '',
    fuel_capacity: 0,
    weight: 0,
    seat_height: 0,
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
  }, []);

  const loadCatalog = async () => {
    const { data, error } = await supabase
      .from('catalog')
      .select('*')
      .order('segment', { ascending: true });

    if (!error && data) {
      setCatalog(data);
    }
    setLoading(false);
  };

  const filteredCatalog = catalog.filter(item => {
    const matchesSegment = filterSegment === 'all' || item.segment === filterSegment;
    const matchesSearch = searchTerm === '' ||
      item.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.segment.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSegment && matchesSearch && item.active;
  });

  const handleOpenModal = (item?: CatalogItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        segment: item.segment,
        model: item.model,
        price_cash: item.price_cash,
        stock: item.stock,
        test_drive_available: item.test_drive_available,
        year: item.year,
        color_options: item.color_options.join(', '),
        engine_cc: item.engine_cc || 0,
        engine_type: item.engine_type || '',
        max_power: item.max_power || '',
        max_torque: item.max_torque || '',
        transmission: item.transmission || '',
        fuel_capacity: item.fuel_capacity || 0,
        weight: item.weight || 0,
        seat_height: item.seat_height || 0,
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
        price_cash: 0,
        stock: 0,
        test_drive_available: false,
        year: new Date().getFullYear(),
        color_options: '',
        engine_cc: 0,
        engine_type: '',
        max_power: '',
        max_torque: '',
        transmission: '',
        fuel_capacity: 0,
        weight: 0,
        seat_height: 0,
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

    const dataToSubmit = {
      segment: formData.segment,
      model: formData.model,
      price_cash: formData.price_cash,
      stock: formData.stock,
      test_drive_available: formData.test_drive_available,
      year: formData.year,
      color_options: formData.color_options.split(',').map(c => c.trim()).filter(c => c),
      engine_cc: formData.engine_cc || null,
      engine_type: formData.engine_type || null,
      max_power: formData.max_power || null,
      max_torque: formData.max_torque || null,
      transmission: formData.transmission || null,
      fuel_capacity: formData.fuel_capacity || null,
      weight: formData.weight || null,
      seat_height: formData.seat_height || null,
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

    if (editingItem) {
      const { error } = await supabase
        .from('catalog')
        .update(dataToSubmit)
        .eq('id', editingItem.id);

      if (!error) {
        setSuccessMessage('Modelo actualizado exitosamente');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } else {
      const { error } = await supabase
        .from('catalog')
        .insert([dataToSubmit]);

      if (!error) {
        setSuccessMessage('Modelo registrado exitosamente');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    }

    setShowModal(false);
    setEditingItem(null);
    setImageFile(null);
    setImagePreview('');
    loadCatalog();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este modelo del catálogo?')) return;

    const { error } = await supabase
      .from('catalog')
      .update({ active: false })
      .eq('id', id);

    if (!error) {
      setSuccessMessage('Modelo desactivado');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      loadCatalog();
    }
  };

  const getSegmentColor = (segment: string) => {
    switch(segment) {
      case 'Deportiva': return 'bg-red-100 text-red-800 border-red-300';
      case 'Naked': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Doble Propósito': return 'bg-green-100 text-green-800 border-green-300';
      case 'Scooter': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Touring': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Adventure': return 'bg-orange-100 text-orange-800 border-orange-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const stats = {
    total: catalog.filter(c => c.active).length,
    withTestDrive: catalog.filter(c => c.active && c.test_drive_available).length,
    totalStock: catalog.filter(c => c.active).reduce((acc, c) => acc + c.stock, 0),
    avgPrice: Math.round(catalog.filter(c => c.active).reduce((acc, c) => acc + c.price_cash, 0) / catalog.filter(c => c.active).length)
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
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              mainView === 'motorcycles'
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
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              mainView === 'parts'
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
              <div className="flex items-center justify-end">
                <button
                  onClick={() => handleOpenModal()}
                  className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Registrar Modelo
                </button>
              </div>

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
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                filterSegment === 'all'
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

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['Deportiva', 'Naked', 'Doble Propósito', 'Scooter', 'Touring', 'Adventure'].map((segment) => (
            <button
              key={segment}
              onClick={() => setFilterSegment(segment as FilterSegment)}
              className={`px-3 py-1 rounded-full text-xs font-bold border-2 whitespace-nowrap transition-all ${
                filterSegment === segment
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
                      <span className={`text-sm font-bold ${
                        item.stock > 3 ? 'text-green-600' : item.stock > 0 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {item.stock} unidades
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
                      <span className={`text-sm font-bold ${
                        item.stock > 3 ? 'text-green-600' : item.stock > 0 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {item.stock}
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
                    <option value="Touring">Touring</option>
                    <option value="Adventure">Adventure</option>
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
                    onChange={(e) => setFormData({ ...formData, price_cash: Number(e.target.value) })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Stock Disponible</label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
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
                    onChange={(e) => setFormData({ ...formData, engine_cc: Number(e.target.value) })}
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
                    onChange={(e) => setFormData({ ...formData, fuel_capacity: Number(e.target.value) })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Peso (kg)</label>
                  <input
                    type="number"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: Number(e.target.value) })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Altura Asiento (mm)</label>
                  <input
                    type="number"
                    value={formData.seat_height}
                    onChange={(e) => setFormData({ ...formData, seat_height: Number(e.target.value) })}
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
                          className={`flex items-center justify-center gap-2 w-full px-4 py-2 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                            formData.image_url
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
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                  uploadingImage
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
