import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Search, ShoppingCart, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { AppDispatch, RootState } from '../store';
import { fetchProducts, fetchCategories } from '../store/slices/productsSlice';
import { addToCart } from '../store/slices/cartSlice';
import Badge from '../components/ui/Badge';
import { ProductCardSkeleton } from '../components/ui/Skeleton';

export default function Products() {
  const dispatch = useDispatch<AppDispatch>();
  const { items, categories, loading } = useSelector((state: RootState) => state.products);
  const cartItems = useSelector((state: RootState) => state.cart.items);
  const { currencySymbol } = useSelector((state: RootState) => state.settings);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch(fetchProducts({ search: search || undefined, category: category || undefined }));
    }, 300);
    return () => clearTimeout(timer);
  }, [dispatch, search, category]);

  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  const handleAddToCart = (product: (typeof items)[0]) => {
    const inCart = cartItems.find((i) => i.product.id === product.id);
    const currentQty = inCart?.quantity ?? 0;
    if (currentQty >= product.stock) {
      toast.error(`Only ${product.stock} units available`);
      return;
    }
    dispatch(addToCart(product));
    toast.success(`${product.name} added to cart`);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search by name, SKU or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input sm:w-48"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <a
          href="/checkout"
          onClick={(e) => {
            e.preventDefault();
            window.location.href = '/checkout';
          }}
          className="relative btn-primary flex items-center gap-2 whitespace-nowrap"
        >
          <ShoppingCart size={16} />
          Cart
          {cartCount > 0 && (
            <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </a>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Package size={48} className="mb-3 opacity-40" />
          <p className="text-lg font-medium">No products found</p>
          <p className="text-sm">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((product) => (
            <div key={product.id} className="card p-4 flex flex-col">
              <div className="h-36 bg-gray-100 dark:bg-gray-700 rounded-lg mb-3 overflow-hidden flex items-center justify-center">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package size={40} className="text-gray-300 dark:text-gray-600" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug">
                  {product.name}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{product.sku}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="gray">{product.category}</Badge>
                  {product.taxable && <Badge variant="blue">Taxable</Badge>}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {currencySymbol}{product.sellPrice.toFixed(2)}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      product.stock < 10 ? 'text-amber-500' : 'text-green-600 dark:text-green-400'
                    }`}
                  >
                    {product.stock} in stock
                  </span>
                </div>
              </div>
              <button
                className="btn-primary mt-3 w-full flex items-center justify-center gap-2 text-sm"
                disabled={product.stock === 0}
                onClick={() => handleAddToCart(product)}
              >
                <ShoppingCart size={14} />
                {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
