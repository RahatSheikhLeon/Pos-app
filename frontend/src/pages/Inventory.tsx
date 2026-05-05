import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Search, Plus, Edit2, Trash2, Boxes } from 'lucide-react';
import toast from 'react-hot-toast';
import { AppDispatch, RootState } from '../store';
import {
  fetchProducts,
  fetchCategories,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../store/slices/productsSlice';
import { Product } from '../types';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import { TableRowSkeleton } from '../components/ui/Skeleton';

const emptyForm: Partial<Product> = {
  name: '',
  sku: '',
  barcode: '',
  category: '',
  sellPrice: 0,
  buyPrice: 0,
  stock: 0,
  imageUrl: '',
  taxable: false,
};

export default function Inventory() {
  const dispatch = useDispatch<AppDispatch>();
  const { items, categories, loading } = useSelector((state: RootState) => state.products);
  const { currencySymbol } = useSelector((state: RootState) => state.settings);

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Partial<Product>>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchProducts());
    dispatch(fetchCategories());
  }, [dispatch]);

  const filtered = items.filter((p) => {
    const q = search.toLowerCase();
    return (
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.barcode.includes(q)
    );
  });

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ ...p });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name?.trim() || !form.sku?.trim()) {
      toast.error('Name and SKU are required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await dispatch(updateProduct({ id: editing.id, data: form })).unwrap();
        toast.success('Product updated');
      } else {
        await dispatch(createProduct(form)).unwrap();
        toast.success('Product created');
      }
      setShowModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await dispatch(deleteProduct(id)).unwrap();
      toast.success('Product deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    } finally {
      setDeleteId(null);
    }
  };

  const field = (key: keyof Product) => ({
    value: (form[key] as any) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const val =
        e.target.type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : e.target.type === 'number'
          ? parseFloat(e.target.value) || 0
          : e.target.value;
      setForm((f) => ({ ...f, [key]: val }));
    },
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 whitespace-nowrap">
          <Plus size={16} />
          Add Product
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Sell Price</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Boxes size={36} className="mx-auto mb-2 text-gray-300" />
                    <p className="text-gray-400">No products found</p>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <Boxes size={16} className="text-gray-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{p.name}</p>
                          <p className="text-xs text-gray-400 font-mono">{p.barcode || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">
                      {p.sku}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="gray">{p.category}</Badge>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                      {currencySymbol}{p.sellPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={p.stock === 0 ? 'red' : p.stock < 10 ? 'yellow' : 'green'}>
                        {p.stock} units
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteId(p.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Product' : 'Add Product'}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Product Name *</label>
            <input className="input" placeholder="Enter product name" {...field('name')} />
          </div>
          <div>
            <label className="label">SKU *</label>
            <input className="input" placeholder="SKU-001" {...field('sku')} />
          </div>
          <div>
            <label className="label">Barcode</label>
            <input className="input" placeholder="1234567890" {...field('barcode')} />
          </div>
          <div>
            <label className="label">Category</label>
            <input
              className="input"
              list="categories"
              placeholder="Category"
              {...field('category')}
            />
            <datalist id="categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">Stock</label>
            <input className="input" type="number"  {...field('stock')} />
          </div>
          <div>
            <label className="label">Sell Price ({currencySymbol})</label>
            <input className="input" type="number"  step="0.01" {...field('sellPrice')} />
          </div>
          <div>
            <label className="label">Buy Price ({currencySymbol})</label>
            <input className="input" type="number"  step="0.01" {...field('buyPrice')} />
          </div>
          <div className="col-span-2">
            <label className="label">Image URL</label>
            <input className="input" placeholder="https://..." {...field('imageUrl')} />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="taxable"
              className="w-4 h-4 accent-indigo-600"
              checked={!!form.taxable}
              onChange={(e) => setForm((f) => ({ ...f, taxable: e.target.checked }))}
            />
            <label htmlFor="taxable" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              Taxable product
            </label>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button className="btn-secondary flex-1" onClick={() => setShowModal(false)}>
            Cancel
          </button>
          <button
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            onClick={handleSave}
            disabled={saving}
          >
            {saving && (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {editing ? 'Update Product' : 'Create Product'}
          </button>
        </div>
      </Modal>

      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Product"
        size="sm"
      >
        <p className="text-gray-600 dark:text-gray-300 text-sm mb-6">
          Are you sure you want to delete this product? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button className="btn-secondary flex-1" onClick={() => setDeleteId(null)}>
            Cancel
          </button>
          <button
            className="btn-danger flex-1"
            onClick={() => deleteId && handleDelete(deleteId)}
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
