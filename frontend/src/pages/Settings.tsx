import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Save, Store, Receipt, Cpu } from 'lucide-react';
import toast from 'react-hot-toast';
import { AppDispatch, RootState } from '../store';
import { fetchSettings, saveSettings } from '../store/slices/settingsSlice';
import { Settings as SettingsType } from '../types';
import ProBlurGate from '../components/ui/ProBlurGate';

const tabs = [
  { id: 'store', label: 'Store Info', icon: Store },
  { id: 'tax', label: 'Tax & Currency', icon: Receipt },
  { id: 'receipt', label: 'Receipt', icon: Receipt },
  { id: 'hardware', label: 'Hardware', icon: Cpu },
];

export default function Settings() {
  const dispatch = useDispatch<AppDispatch>();
  const settings = useSelector((state: RootState) => state.settings);
  const [tab, setTab] = useState('store');
  const { user } = useSelector((state: RootState) => state.auth);
  const isPro = user?.plan !== 'free' && user?.plan != null;
  const [form, setForm] = useState<Partial<SettingsType>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dispatch(fetchSettings());
  }, [dispatch]);

  useEffect(() => {
    setForm({
      storeName: settings.storeName,
      address: settings.address,
      phone: settings.phone,
      email: settings.email,
      taxRate: settings.taxRate,
      currency: settings.currency,
      currencySymbol: settings.currencySymbol,
      receiptHeader: settings.receiptHeader,
      receiptFooter: settings.receiptFooter,
      taxId: settings.taxId,
      showLogo: settings.showLogo,
      showTaxId: settings.showTaxId,
      theme: settings.theme,
    });
  }, [settings]);

  const set = (key: keyof SettingsType, value: any) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await dispatch(saveSettings(form)).unwrap();
      toast.success('Settings saved successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'input';
  const labelCls = 'label';

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              tab === id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Icon size={15} />
            {label}
            {id === 'hardware' && !isPro && (
              <span className="text-[10px] font-bold tracking-wide bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full">
                PRO
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="card p-6">
        {tab === 'store' && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Store Information</h2>
            <div>
              <label className={labelCls}>Store Name</label>
              <input
                className={inputCls}
                value={form.storeName ?? ''}
                onChange={(e) => set('storeName', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Address</label>
              <input
                className={inputCls}
                value={form.address ?? ''}
                onChange={(e) => set('address', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Phone</label>
                <input
                  className={inputCls}
                  value={form.phone ?? ''}
                  onChange={(e) => set('phone', e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input
                  className={inputCls}
                  type="email"
                  value={form.email ?? ''}
                  onChange={(e) => set('email', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {tab === 'tax' && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Tax & Currency</h2>
            <div>
              <label className={labelCls}>Tax Rate (%)</label>
              <input
                className={inputCls}
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={form.taxRate ?? 0}
                onChange={(e) => set('taxRate', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Currency Code</label>
                <input
                  className={inputCls}
                  placeholder="USD"
                  maxLength={3}
                  value={form.currency ?? ''}
                  onChange={(e) => set('currency', e.target.value.toUpperCase())}
                />
              </div>
              <div>
                <label className={labelCls}>Currency Symbol</label>
                <input
                  className={inputCls}
                  placeholder="$"
                  maxLength={3}
                  value={form.currencySymbol ?? ''}
                  onChange={(e) => set('currencySymbol', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {tab === 'receipt' && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
              Receipt Customization
            </h2>
            <div>
              <label className={labelCls}>Receipt Header</label>
              <input
                className={inputCls}
                value={form.receiptHeader ?? ''}
                onChange={(e) => set('receiptHeader', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Receipt Footer</label>
              <input
                className={inputCls}
                value={form.receiptFooter ?? ''}
                onChange={(e) => set('receiptFooter', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Tax ID</label>
              <input
                className={inputCls}
                value={form.taxId ?? ''}
                onChange={(e) => set('taxId', e.target.value)}
              />
            </div>
            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-indigo-600"
                  checked={!!form.showLogo}
                  onChange={(e) => set('showLogo', e.target.checked)}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show store logo on receipt</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-indigo-600"
                  checked={!!form.showTaxId}
                  onChange={(e) => set('showTaxId', e.target.checked)}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show Tax ID on receipt</span>
              </label>
            </div>
          </div>
        )}


        {tab === 'hardware' && (
          <ProBlurGate locked={!isPro} feature="settings_hardware">
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Hardware</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Hardware configuration for peripheral devices connected to this terminal.
            </p>
            {[
              { label: 'Receipt Printer', desc: 'Thermal/inkjet receipt printer' },
              { label: 'Cash Drawer', desc: 'Automatic cash drawer controller' },
              { label: 'Barcode Scanner', desc: 'USB/Bluetooth barcode scanner' },
            ].map(({ label, desc }) => (
              <div
                key={label}
                className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-xl"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    Not configured
                  </span>
                </div>
              </div>
            ))}
          </div>
          </ProBlurGate>
        )}

        <div className="pt-6 border-t border-gray-100 dark:border-gray-700 mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={15} />
            )}
            Save Changes
          </button>
        </div>
      </div>

    </div>
  );
}
