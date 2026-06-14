import React, { createContext, useContext, useState, useRef, useEffect, useMemo } from 'react';
import { useDbQuery, dbInsert, dbUpdate, dbDelete, getLocalCache, type Product, type Category, type Transaction, type TransactionItemRecord, type PaymentMethod, type StoreSettings, type Voucher } from '@/hooks/db-hooks';
import { dbAdmin as db } from '@/lib/db';
import { useLocation } from 'react-router-dom';
import { mapProduct, mapTransaction } from '@/lib/sync';
import { Bell } from "lucide-react";
import { sendPushToRole } from '@/lib/fcm';
import { usePermissions } from '@/hooks/use-permissions';
import { toast } from 'sonner';

export interface CartItem {
  product: Product;
  qty: number;
  discountType: 'percentage' | 'nominal' | null;
  discountValue: number;
  selectedVariants?: { groupName: string; optionName: string; price: number }[];
  notes?: string;
}

export const getItemSubtotal = (item: CartItem) => {
  const variantsPrice = item.selectedVariants?.reduce((s, v) => s + v.price, 0) || 0;
  const base = (item.product.price + variantsPrice) * item.qty;
  if (item.discountType === 'percentage') return base * (1 - item.discountValue / 100);
  if (item.discountType === 'nominal') return base - item.discountValue;
  return base;
};

interface CashierContextType {
  // States
  search: string;
  setSearch: (s: string) => void;
  filterCategory: string;
  setFilterCategory: (s: string) => void;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  editingTxId: number | null;
  setEditingTxId: (id: number | null) => void;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  checkoutOpen: boolean;
  setCheckoutOpen: (open: boolean) => void;
  midtransPaymentType: 'qris' | 'transfer' | 'e-wallet' | 'lainnya' | null;
  setMidtransPaymentType: (type: 'qris' | 'transfer' | 'e-wallet' | 'lainnya' | null) => void;
  txDiscountType: 'percentage' | 'nominal' | null;
  setTxDiscountType: (type: 'percentage' | 'nominal' | null) => void;
  txDiscountValue: string;
  setTxDiscountValue: (val: string) => void;
  discountDialogOpen: boolean;
  setDiscountDialogOpen: (open: boolean) => void;
  tempDiscountType: 'percentage' | 'nominal';
  setTempDiscountType: (type: 'percentage' | 'nominal') => void;
  tempDiscountValue: string;
  setTempDiscountValue: (val: string) => void;
  paymentMethodId: string;
  setPaymentMethodId: (id: string) => void;
  paymentAmount: string;
  setPaymentAmount: (val: string) => void;
  payments: { methodId: number; methodName: string; amount: number; date: Date }[];
  setPayments: React.Dispatch<React.SetStateAction<{ methodId: number; methodName: string; amount: number; date: Date }[]>>;
  isQuickAdding: boolean;
  setIsQuickAdding: (val: boolean) => void;
  receiptOpen: boolean;
  setReceiptOpen: (open: boolean) => void;
  lastTransaction: Transaction | null;
  setLastTransaction: (tx: Transaction | null) => void;
  lastTxItems: TransactionItemRecord[];
  setLastTxItems: (items: TransactionItemRecord[]) => void;
  customerName: string;
  setCustomerName: (s: string) => void;
  tableNumber: string;
  setTableNumber: (s: string) => void;
  remarks: string;
  setRemarks: (s: string) => void;
  scannerOpen: boolean;
  setScannerOpen: (open: boolean) => void;
  openBillsOpen: boolean;
  setOpenBillsOpen: (open: boolean) => void;
  editingItemNotes: number | null;
  setEditingItemNotes: (idx: number | null) => void;
  processingBillsOpen: boolean;
  setProcessingBillsOpen: (open: boolean) => void;
  tempItemNotes: string;
  setTempItemNotes: (s: string) => void;
  cancelDialogOpen: boolean;
  setCancelDialogOpen: (open: boolean) => void;
  cancelTargetTx: Transaction | null;
  setCancelTargetTx: (tx: Transaction | null) => void;
  scanInput: string;
  setScanInput: (s: string) => void;
  voucherCode: string;
  setVoucherCode: (s: string) => void;
  voucherApplied: Voucher | null;
  setVoucherApplied: (v: Voucher | null) => void;
  voucherLoading: boolean;
  setVoucherLoading: (loading: boolean) => void;
  isCheckingOut: boolean;
  setIsCheckingOut: (val: boolean) => void;
  checkoutDataCache: any;
  setCheckoutDataCache: (data: any) => void;
  
  // Ref
  scanInputRef: React.RefObject<HTMLInputElement | null>;

  // Variant States
  variantProduct: Product | null;
  setVariantProduct: (p: Product | null) => void;
  variantSelection: Record<string, Record<string, number>>;
  setVariantSelection: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>;
  variantNotes: string;
  setVariantNotes: (s: string) => void;

  // Realtime Data
  products: Product[];
  categories: Category[];
  paymentMethods: PaymentMethod[];
  storeSettings: StoreSettings | undefined;
  allBills: Transaction[];
  openBills: Transaction[];
  vouchers: Voucher[];
  loading: boolean;

  // Computed / Memos
  processingBills: Transaction[];
  processingBillsCount: number;
  cartProductIds: Set<number | string>;
  filtered: Product[];
  subtotal: number;
  txDiscountAmount: number;
  ppnAmount: number;
  adminFee: number;
  taxAndService: number;
  total: number;
  totalPaidSoFar: number;
  totalProfit: number;
  cartCount: number;
  openBillsCount: number;
  hasEditAccess: boolean;

  // Constants / Variables
  remainingToPay: number;
  currentPaidAmount: number;
  change: number;

  // Handlers
  doFullReset: () => void;
  addToCart: (product: Product, variants?: { groupName: string; optionName: string; price: number }[], notes?: string) => void;
  updateQty: (index: number, delta: number) => void;
  removeFromCart: (index: number) => void;
  updateItemNotes: (index: number, notes: string) => void;
  saveOpenBill: () => Promise<void>;
  loadOpenBill: (tx: Transaction) => Promise<void>;
  cancelOpenBill: (tx: Transaction) => Promise<void>;
  handleCancelFromCart: () => void;
  handleCancelFromList: (bill: Transaction) => void;
  handleCheckout: () => Promise<void>;
  processCheckoutToDb: (overrideData?: any) => Promise<void>;
  handleScan: (barcode: string) => void;
  handleScanKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  rp: (n: number | string) => string;
}

const CashierContext = createContext<CashierContextType | undefined>(undefined);

export const CashierProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  // ==========================================
  // States
  // ==========================================
  // Load initial values from cache
  const cachedState = useMemo(() => {
    try {
      const cached = sessionStorage.getItem('cashier_session_state');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.payments) {
          parsed.payments = parsed.payments.map((p: any) => ({
            ...p,
            date: new Date(p.date)
          }));
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to load cached cashier session:', e);
    }
    return null;
  }, []);

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>(() => cachedState?.cart || []);
  const [editingTxId, setEditingTxId] = useState<number | null>(() => cachedState?.editingTxId ?? null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [midtransPaymentType, setMidtransPaymentType] = useState<'qris' | 'transfer' | 'e-wallet' | 'lainnya' | null>(null);
  const [txDiscountType, setTxDiscountType] = useState<'percentage' | 'nominal' | null>(() => cachedState?.txDiscountType ?? null);
  const [txDiscountValue, setTxDiscountValue] = useState(() => cachedState?.txDiscountValue || '');
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [tempDiscountType, setTempDiscountType] = useState<'percentage' | 'nominal'>('nominal');
  const [tempDiscountValue, setTempDiscountValue] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [payments, setPayments] = useState<{ methodId: number; methodName: string; amount: number; date: Date }[]>(() => cachedState?.payments || []);
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [lastTxItems, setLastTxItems] = useState<TransactionItemRecord[]>([]);
  const [customerName, setCustomerName] = useState(() => cachedState?.customerName || '');
  const [tableNumber, setTableNumber] = useState(() => cachedState?.tableNumber || 'Bawa Pulang');
  const [remarks, setRemarks] = useState(() => cachedState?.remarks || '');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [openBillsOpen, setOpenBillsOpen] = useState(false);
  const [editingItemNotes, setEditingItemNotes] = useState<number | null>(null);
  const [processingBillsOpen, setProcessingBillsOpen] = useState(false);
  const [tempItemNotes, setTempItemNotes] = useState('');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTargetTx, setCancelTargetTx] = useState<Transaction | null>(null);
  const [scanInput, setScanInput] = useState('');
  const [voucherCode, setVoucherCode] = useState(() => cachedState?.voucherCode || '');
  const [voucherApplied, setVoucherApplied] = useState<Voucher | null>(() => cachedState?.voucherApplied || null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutDataCache, setCheckoutDataCache] = useState<any>(null);

  const { canEdit } = usePermissions();
  const hasEditAccess = canEdit('cashier');

  // Variant States
  const [variantProduct, setVariantProduct] = useState<Product | null>(null);
  const [variantSelection, setVariantSelection] = useState<Record<string, Record<string, number>>>({});
  const [variantNotes, setVariantNotes] = useState('');

  // ==========================================
  // Refs
  // ==========================================
  const scanInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // Firebase realtime queries
  // ==========================================
  const realtimeProducts = useDbQuery<Product>('products') || [];
  const realtimeCategories = useDbQuery<Category>('categories') || [];
  const realtimeTransactions = useDbQuery<Transaction>('transactions') || [];
  const realtimePaymentMethods = useDbQuery<PaymentMethod>('paymentMethods') || [];
  const realtimeStoreSettings = useDbQuery<StoreSettings>('storeSettings') || [];
  const realtimeVouchers = useDbQuery<Voucher>('vouchers') || [];

  const products = realtimeProducts;
  const categories = useMemo(() => {
    return [...realtimeCategories].sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
      if (a.createdAt && b.createdAt) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return String(a.id).localeCompare(String(b.id));
    });
  }, [realtimeCategories]);
  const paymentMethods = realtimePaymentMethods;
  const storeSettings = realtimeStoreSettings[0];
  const allBills = useMemo(() => [...realtimeTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [realtimeTransactions]);
  const openBills = useMemo(() => realtimeTransactions.filter(t => t.status === 'belum lunas').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [realtimeTransactions]);
  const vouchers = useMemo(() => realtimeVouchers.filter(v => v.isActive), [realtimeVouchers]);
  
  const loading = realtimeProducts.length === 0 && realtimeCategories.length === 0;

  // ==========================================
  // Memoized Calculations
  // ==========================================
  const processingBills = useMemo(() => allBills
    .filter(t => t.kitchenStatus && t.kitchenStatus !== 'pending' && t.kitchenStatus !== 'diantarkan')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [allBills]);

  const processingBillsCount = processingBills.length;
  const cartProductIds = useMemo(() => new Set(cart.map(c => c.product.id)), [cart]);

  const filtered = useMemo(() => {
    let result = products?.filter(p => {
      const matchSearch = (p.name || '').toLowerCase().includes(search.toLowerCase());
      const matchCategory = filterCategory === 'all' || String(p.categoryId) === String(filterCategory);
      return matchSearch && matchCategory && (p.trackStock === false || p.stock > 0 || cartProductIds.has(p.id!));
    }) ?? [];

    if (filterCategory === 'all') {
      result = result.sort((a, b) => {
        const catA = categories?.findIndex(c => String(c.id) === String(a.categoryId)) ?? 0;
        const catB = categories?.findIndex(c => String(c.id) === String(b.categoryId)) ?? 0;
        return catA - catB;
      });
    }

    return result;
  }, [products, search, filterCategory, cartProductIds, categories]);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + getItemSubtotal(item), 0), [cart]);

  const txDiscountAmount = useMemo(() => {
    return txDiscountType === 'percentage'
      ? subtotal * (Number(txDiscountValue) || 0) / 100
      : txDiscountType === 'nominal' ? Number(txDiscountValue) || 0 : 0;
  }, [subtotal, txDiscountType, txDiscountValue]);

  const ppnAmount = useMemo(() => {
    if (!storeSettings?.enableTax) return 0;
    const baseTotal = Math.max(0, subtotal - txDiscountAmount);
    return Math.round(baseTotal * (storeSettings.taxPercentage || 0) / 100);
  }, [storeSettings, subtotal, txDiscountAmount]);

  const adminFee = useMemo(() => {
    const currentMethod = paymentMethods?.find(m => m.id!.toString() === paymentMethodId);
    const isMidtrans = currentMethod && currentMethod.provider !== 'manual';

    if (isMidtrans) {
      const baseTotal = Math.max(0, subtotal - txDiscountAmount);
      if (currentMethod.category === 'qris') return Math.round(baseTotal * 0.007);
      if (currentMethod.category === 'e-wallet') return Math.round(baseTotal * 0.02);
      if (currentMethod.category === 'transfer') return 4000;
      if (currentMethod.category === 'lainnya') return Math.round(baseTotal * 0.03);
    }
    return 0;
  }, [paymentMethodId, paymentMethods, subtotal, txDiscountAmount]);

  const taxAndService = useMemo(() => {
    return ppnAmount + adminFee;
  }, [ppnAmount, adminFee]);

  const total = useMemo(() => Math.max(0, subtotal - txDiscountAmount) + taxAndService, [subtotal, txDiscountAmount, taxAndService]);
  const totalPaidSoFar = useMemo(() => payments.reduce((sum, p) => sum + p.amount, 0), [payments]);
  const totalProfit = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.product.price - item.product.hpp) * item.qty, 0) - txDiscountAmount;
  }, [cart, txDiscountAmount]);

  const remainingToPay = Math.max(0, total - totalPaidSoFar);
  const currentPaidAmount = Number(paymentAmount) || 0;
  const change = (totalPaidSoFar + currentPaidAmount) - total;

  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const openBillsCount = openBills?.length ?? 0;

  // ==========================================
  // Effects
  // ==========================================
  // Save state to sessionStorage
  useEffect(() => {
    try {
      const stateToCache = {
        cart,
        editingTxId,
        customerName,
        tableNumber,
        remarks,
        txDiscountType,
        txDiscountValue,
        payments,
        voucherCode,
        voucherApplied,
      };
      sessionStorage.setItem('cashier_session_state', JSON.stringify(stateToCache));
    } catch (e) {
      console.warn('Failed to cache cashier session:', e);
    }
  }, [
    cart,
    editingTxId,
    customerName,
    tableNumber,
    remarks,
    txDiscountType,
    txDiscountValue,
    payments,
    voucherCode,
    voucherApplied,
  ]);

  // Focus SKU / Barcode input on scanInput cleared
  useEffect(() => {
    if (scanInput === '' && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [scanInput]);

  // Handle auto-load from ActiveOrders
  useEffect(() => {
    if (!loading && location.state?.loadBillId) {
      const billId = location.state.loadBillId;
      const billToLoad = openBills.find(b => b.id === billId);
      if (billToLoad) {
        // Clear state to prevent infinite loop
        window.history.replaceState({}, document.title);
        loadOpenBill(billToLoad);
      }
    }
  }, [loading, location.state, openBills]);

  // Polling: waiter calls
  useEffect(() => {
    let lastCheckedLength = JSON.parse(localStorage.getItem('waiter_calls') || '[]').length;
    const waiterPollInterval = setInterval(() => {
      const calls = JSON.parse(localStorage.getItem('waiter_calls') || '[]');
      if (calls.length > lastCheckedLength) {
        const newCalls = calls.slice(lastCheckedLength);
        lastCheckedLength = calls.length;
        newCalls.forEach((call: any) => {
          toast(
            <div className="flex items-center gap-3 w-full">
              <div className="bg-primary rounded-full p-2 text-white shrink-0">
                <Bell className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <p className="font-bold text-sm">Panggilan Pelayan!</p>
                <p className="text-xs text-muted-foreground">{String(call.table).toLowerCase().startsWith('meja') ? call.table : `Meja ${call.table}`} membutuhkan bantuan.</p>
              </div>
            </div>,
            { duration: 8000, position: 'top-right' }
          );
        });
      }
    }, 1000);

    return () => {
      clearInterval(waiterPollInterval);
    };
  }, []);

  // ==========================================
  // Handlers
  // ==========================================
  const doFullReset = () => {
    setCart([]);
    setEditingTxId(null);
    setTxDiscountType(null);
    setTxDiscountValue('');
    setPaymentMethodId('');
    setPaymentAmount('');
    setPayments([]);
    setCustomerName('');
    setTableNumber('Bawa Pulang');
    setRemarks('');
    setIsQuickAdding(false);
    setVoucherCode('');
    setVoucherApplied(null);
  };

  const addToCart = (product: Product, variants?: { groupName: string; optionName: string; price: number }[], notes?: string) => {
    if (!hasEditAccess) {
      toast.error('Akses ditolak. Anda tidak memiliki izin untuk melakukan transaksi.');
      return;
    }
    if (product.variants && product.variants.length > 0 && !variants) {
      setVariantProduct(product);
      setVariantSelection({});
      setVariantNotes('');
      return;
    }

    setCart(prev => {
      const existing = prev.find(c =>
        c.product.id === product.id &&
        JSON.stringify(c.selectedVariants || []) === JSON.stringify(variants || []) &&
        c.notes === notes
      );
      if (existing) {
        if (product.trackStock !== false && existing.qty >= product.stock) {
          toast.error('Stok tidak cukup');
          return prev;
        }
        return prev.map(c => c === existing ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { product, qty: 1, discountType: null, discountValue: 0, selectedVariants: variants, notes }];
    });
    setVariantProduct(null);
  };

  const updateQty = (index: number, delta: number) => {
    if (!hasEditAccess) return;
    setCart(prev => prev.map((c, i) => {
      if (i !== index) return c;
      const newQty = c.qty + delta;
      if (newQty <= 0) return c;
      if (c.product.trackStock !== false && newQty > c.product.stock) { toast.error('Stok tidak cukup'); return c; }
      return { ...c, qty: newQty };
    }));
  };

  const removeFromCart = (index: number) => {
    if (!hasEditAccess) return;
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const updateItemNotes = (index: number, notes: string) => {
    if (!hasEditAccess) return;
    setCart(prev => prev.map((c, i) => i === index ? { ...c, notes: notes.trim() || undefined } : c));
  };

  const saveOpenBill = async () => {
    if (!hasEditAccess) {
      toast.error('Akses ditolak. Anda tidak memiliki izin untuk menyimpan pesanan.');
      return;
    }
    if (cart.length === 0) { toast.error('Keranjang kosong'); return; }
    if (!tableNumber || !tableNumber.trim()) {
      toast.error('Harap pilih nomor meja terlebih dahulu untuk Makan di Tempat!');
      return;
    }

    const now = new Date();
    const txNeedsKitchen = cart.some(c => categories.find(cat => String(cat.id) === String(c.product.categoryId))?.needsKitchen !== false);

    const txPayload = {
      subtotal,
      discount_type: txDiscountType,
      discount_value: Number(txDiscountValue) || 0,
      discount_amount: txDiscountAmount,
      tax_and_service: taxAndService,
      tax_amount: ppnAmount,
      admin_fee: adminFee,
      total,
      customer_name: customerName.trim() || null,
      table_number: tableNumber.trim() || null,
      remarks: remarks.trim() || null,
      needs_kitchen: txNeedsKitchen,
      date: now.toISOString(),
    };

    const itemRecords = cart.map(c => ({
      transaction_id: editingTxId ?? 0,
      product_id: c.product.id!,
      product_name: c.product.name,
      quantity: c.qty,
      price: c.product.price,
      hpp: c.product.hpp,
      discount_type: c.discountType,
      discount_value: c.discountValue,
      discount_amount: c.discountType === 'percentage' ? c.product.price * c.qty * c.discountValue / 100 : c.discountType === 'nominal' ? c.discountValue : 0,
      subtotal: getItemSubtotal(c),
      selected_variants: c.selectedVariants || [],
      notes: c.notes || null,
    }));

    if (editingTxId) {
      // Offline-secure: read old items from IndexedDB
      const allLocalItems = await getLocalCache('transaction_items');
      const oldItems = allLocalItems.filter((oi: any) => String(oi.transaction_id) === String(editingTxId));

      // Offline-secure: update transaction
      await dbUpdate('transactions', editingTxId, txPayload);

      // Offline-secure: delete old items
      for (const oldItem of oldItems) {
        if (oldItem.id) {
          await dbDelete('transactionItems', oldItem.id);
        }
      }

      // Offline-secure: insert new items
      for (const itemRec of itemRecords) {
        const itemDocId = String(Date.now() + Math.floor(Math.random() * 10000));
        await dbInsert('transactionItems', { ...itemRec, id: itemDocId, transactionId: editingTxId });
      }

      // Offline-secure stock update using realtimeProducts state
      for (const cartItem of cart) {
        if (cartItem.product.trackStock === false) continue;
        const oldItem = oldItems?.find((oi: any) => String(oi.product_id) === String(cartItem.product.id));
        const oldQty = oldItem?.quantity ?? 0;
        const delta = cartItem.qty - oldQty;
        if (delta !== 0) {
          const prod = realtimeProducts.find(p => String(p.id) === String(cartItem.product.id));
          if (prod) {
            await dbUpdate('products', prod.id!, { stock: prod.stock - delta });
          }
        }
      }
      for (const oldItem of oldItems || []) {
        const stillInCart = cart.find(c => String(c.product.id) === String(oldItem.product_id));
        if (!stillInCart) {
          const prod = realtimeProducts.find(p => String(p.id) === String(oldItem.product_id));
          if (prod && prod.trackStock !== false) {
            await dbUpdate('products', prod.id!, { stock: prod.stock + (oldItem.quantity || 0) });
          }
        }
      }

      toast.success(`Bill diperbarui!`);
    } else {
      const receiptNumber = `TX${Date.now()}`;
      const newTxId = String(Date.now() + Math.floor(Math.random() * 1000));

      const txData = {
        ...txPayload,
        id: newTxId,
        receiptNumber: receiptNumber,
        status: 'belum lunas',
        kitchenStatus: 'pending',
        openedAt: now.toISOString(),
      };

      // Offline-secure: insert transaction
      await dbInsert('transactions', txData);

      // Offline-secure: insert items
      for (const r of itemRecords) {
        const itemDocId = String(Date.now() + Math.floor(Math.random() * 10000));
        await dbInsert('transactionItems', { ...r, id: itemDocId, transactionId: newTxId });
      }

      // Offline-secure: update product stock
      for (const item of cart) {
        if (item.product.trackStock === false) continue;
        const prod = realtimeProducts.find(p => String(p.id) === String(item.product.id));
        if (prod) {
          await dbUpdate('products', prod.id!, { stock: prod.stock - item.qty });
        }
      }

      toast.success(`Bill ${receiptNumber} disimpan!`);

      // Play local ding sound
      try {
        const audio = new Audio('/ding.mp3');
        audio.play().catch(e => console.warn('[Sound] Audio play blocked/failed:', e));
      } catch (err) {}
    }

    doFullReset();
    setCartOpen(false);
  };

  const loadOpenBill = async (tx: Transaction) => {
    if (!tx.id) return;
    // Offline-secure: query local cache transaction items
    const allLocalItems = await getLocalCache('transaction_items');
    const items = allLocalItems.filter((oi: any) => String(oi.transaction_id) === String(tx.id));

    // Convert snake_case properties to camelCase (matching CartItem schema)
    const cartItems: CartItem[] = items.map(item => {
      const product = realtimeProducts.find(p => String(p.id) === String(item.product_id));
      if (!product) throw new Error(`Produk "${item.product_name || 'Tidak Diketahui'}" tidak ditemukan`);
      return {
        product,
        qty: item.quantity || 0,
        discountType: item.discount_type as 'percentage' | 'nominal' | null,
        discountValue: item.discount_value || 0,
        selectedVariants: item.selected_variants || [],
        notes: item.notes || '',
      };
    });

    setCart(cartItems);
    setEditingTxId(tx.id);
    setTxDiscountType(tx.discountType as 'percentage' | 'nominal' | null);
    setTxDiscountValue(tx.discountType ? String(tx.discountValue) : '');
    setPayments(tx.payments || []);
    setCustomerName(tx.customerName || '');
    setTableNumber(tx.tableNumber || 'Bawa Pulang');
    setRemarks(tx.remarks || '');
    setOpenBillsOpen(false);
    setCartOpen(true);
  };

  const cancelOpenBill = async (tx: Transaction) => {
    if (!hasEditAccess) {
      toast.error('Akses ditolak. Anda tidak memiliki izin untuk membatalkan pesanan.');
      return;
    }
    if (!tx.id) return;

    // Offline-secure: read old items from IndexedDB
    const allLocalItems = await getLocalCache('transaction_items');
    const items = allLocalItems.filter((oi: any) => String(oi.transaction_id) === String(tx.id));

    // Offline-secure stock restoration using realtimeProducts state
    for (const item of items || []) {
      const prod = realtimeProducts.find(p => String(p.id) === String(item.product_id));
      if (prod && prod.trackStock !== false) {
        await dbUpdate('products', prod.id!, { stock: prod.stock + (item.quantity || 0) });
      }
    }

    // Offline-secure deletion of items
    for (const item of items) {
      if (item.id) {
        await dbDelete('transactionItems', item.id);
      }
    }

    // Offline-secure deletion of transaction
    await dbDelete('transactions', tx.id);

    toast.success(`Bill ${tx.receiptNumber} dibatalkan`);
    setCancelDialogOpen(false);
    setCancelTargetTx(null);
    if (editingTxId === tx.id) {
      doFullReset();
      setCartOpen(false);
    }
  };

  const handleCancelFromCart = () => {
    const tx = openBills?.find(b => b.id === editingTxId);
    if (tx) {
      setCancelTargetTx(tx);
      setCancelDialogOpen(true);
    }
  };

  const handleCancelFromList = (bill: Transaction) => {
    setCancelTargetTx(bill);
    setCancelDialogOpen(true);
  };

  const handleCheckout = async () => {
    if (!tableNumber || !tableNumber.trim()) {
      toast.error('Harap pilih nomor meja terlebih dahulu untuk Makan di Tempat!');
      return;
    }
    if (totalPaidSoFar + currentPaidAmount < total) {
      toast.error('Jumlah pembayaran kurang dari total');
      return;
    }

    const currentMethod = paymentMethods?.find(m => m.id!.toString() === paymentMethodId);
    if (!currentMethod && currentPaidAmount > 0) {
      toast.error('Pilih metode pembayaran');
      return;
    }

    const isMidtrans = currentMethod && ['qris', 'transfer', 'e-wallet', 'lainnya'].includes(currentMethod.category);
    if (isMidtrans) {
      setCheckoutOpen(false);
      setMidtransPaymentType(currentMethod.category as 'qris' | 'transfer' | 'e-wallet' | 'lainnya');
    } else {
      processCheckoutToDb();
    }
  };

  const processCheckoutToDb = async (overrideData?: any) => {
    if (!hasEditAccess) {
      toast.error('Akses ditolak. Anda tidak memiliki izin untuk melakukan pembayaran.');
      return;
    }
    setIsCheckingOut(true);
    try {
      const finalPayments = overrideData ? overrideData.finalPayments : [...payments];
      
      if (!overrideData) {
        const currentMethod = paymentMethods?.find(m => m.id!.toString() === paymentMethodId);
        if (currentPaidAmount > 0 && currentMethod) {
          finalPayments.push({
            methodId: currentMethod.id!,
            methodName: currentMethod.name,
            amount: currentPaidAmount,
            date: new Date()
          });
        }
      }

      const finalPaymentAmount = finalPayments.reduce((sum, p) => sum + p.amount, 0);
      const primaryMethodId = finalPayments.length > 0 ? finalPayments[finalPayments.length - 1].methodId : 0;
      const finalChange = overrideData ? overrideData.change : change;
      const finalCustomerName = (overrideData ? overrideData.customerName : customerName) || '';
      const finalTableNumber = (overrideData ? overrideData.tableNumber : tableNumber) || '';
      const finalTaxAndService = overrideData ? overrideData.taxAndService : taxAndService;
      const finalTaxAmount = overrideData ? overrideData.taxAmount : ppnAmount;
      const finalAdminFee = overrideData ? overrideData.adminFee : adminFee;
      const finalTotal = overrideData ? overrideData.total : total;

      const txNeedsKitchen = cart.some(c => categories.find(cat => String(cat.id) === String(c.product.categoryId))?.needsKitchen !== false);

      // Load active cashier name from admin session
      const authDataStr = localStorage.getItem('admin_auth') || '{}';
      let cashierName = 'Kasir';
      try {
        const authData = JSON.parse(authDataStr);
        cashierName = authData.name || authData.username || 'Kasir';
      } catch (e) {
        console.warn('Gagal parse auth data:', e);
      }

      const txPayload = {
        subtotal,
        discount_type: txDiscountType,
        discount_value: Number(txDiscountValue) || 0,
        discount_amount: txDiscountAmount,
        tax_and_service: finalTaxAndService,
        tax_amount: finalTaxAmount,
        admin_fee: finalAdminFee,
        total: finalTotal,
        payment_method_id: primaryMethodId,
        payment_amount: finalPaymentAmount,
        payments: finalPayments,
        change: finalChange,
        profit: totalProfit,
        customer_name: finalCustomerName.trim() || null,
        table_number: finalTableNumber.trim() || null,
        cashier_name: cashierName,
        needs_kitchen: txNeedsKitchen,
      };

      const itemRecords = cart.map(c => ({
        transaction_id: editingTxId ?? 0,
        product_id: c.product.id!,
        product_name: c.product.name,
        quantity: c.qty,
        price: c.product.price,
        hpp: c.product.hpp,
        discount_type: c.discountType,
        discount_value: c.discountValue,
        discount_amount: c.discountType === 'percentage' ? (c.product.price + (c.selectedVariants?.reduce((s, v) => s + v.price, 0) || 0)) * c.qty * c.discountValue / 100 : c.discountType === 'nominal' ? c.discountValue : 0,
        subtotal: getItemSubtotal(c),
        selected_variants: c.selectedVariants || [],
        notes: c.notes || null,
      }));

      if (editingTxId) {
        // Offline-secure: read old items from IndexedDB
        const allLocalItems = await getLocalCache('transaction_items');
        const oldItems = allLocalItems.filter((oi: any) => String(oi.transaction_id) === String(editingTxId));
        const openBillObj = openBills?.find(b => b.id === editingTxId);

        const finalTx = mapTransaction({
          ...txPayload,
          id: editingTxId,
          date: openBillObj ? openBillObj.date : new Date().toISOString(),
          receipt_number: openBillObj ? openBillObj.receiptNumber : `TX${editingTxId}`,
          status: 'lunas',
          kitchen_status: txNeedsKitchen ? 'diproses' : null,
          closed_at: new Date().toISOString(),
        });

        // Offline-secure: update transaction
        await dbUpdate('transactions', editingTxId, {
          ...txPayload,
          status: 'lunas',
          kitchen_status: txNeedsKitchen ? 'diproses' : null,
          closed_at: new Date().toISOString(),
        });

        // Offline-secure: delete old items
        for (const oldItem of oldItems) {
          if (oldItem.id) {
            await dbDelete('transactionItems', oldItem.id);
          }
        }

        // Offline-secure: insert new items
        for (const itemRec of itemRecords) {
          const itemDocId = String(Date.now() + Math.floor(Math.random() * 10000));
          await dbInsert('transactionItems', { ...itemRec, id: itemDocId, transactionId: editingTxId });
        }

        // Offline-secure stock update using realtimeProducts state
        for (const cartItem of cart) {
          if (cartItem.product.trackStock === false) continue;
          const oldItem = oldItems?.find((oi: any) => String(oi.product_id) === String(cartItem.product.id));
          const delta = cartItem.qty - (oldItem?.quantity ?? 0);
          if (delta !== 0) {
            const prod = realtimeProducts.find(p => String(p.id) === String(cartItem.product.id));
            if (prod) {
              await dbUpdate('products', prod.id!, { stock: prod.stock - delta });
            }
          }
        }

        setLastTransaction(finalTx);
        setLastTxItems(itemRecords.map((r, i) => ({
          id: i,
          transactionId: editingTxId,
          productId: r.product_id,
          productName: r.product_name,
          quantity: r.quantity,
          price: r.price,
          hpp: r.hpp,
          discountType: r.discount_type,
          discountValue: r.discount_value,
          discountAmount: r.discount_amount,
          subtotal: r.subtotal,
          selectedVariants: r.selected_variants,
          notes: r.notes
        })));

        // Play local ding sound
        try {
          const audio = new Audio('/ding.mp3');
          audio.play().catch(e => console.warn('[Sound] Audio play blocked/failed:', e));
        } catch (err) {}

        toast.success(`Transaksi berhasil!`);
        setCheckoutOpen(false);
        setTimeout(() => {
          setReceiptOpen(true);
        }, 400);

      } else {
        const receiptNumber = `TX${Date.now()}`;
        const newTxId = String(Date.now() + Math.floor(Math.random() * 1000));

        const txData = {
          ...txPayload,
          id: newTxId,
          date: new Date().toISOString(),
          receipt_number: receiptNumber,
          status: 'lunas',
          kitchen_status: txNeedsKitchen ? 'diproses' : null,
        };

        // Offline-secure: insert transaction
        await dbInsert('transactions', txData);

        // Offline-secure: insert items
        for (const r of itemRecords) {
          const itemDocId = String(Date.now() + Math.floor(Math.random() * 10000));
          await dbInsert('transactionItems', { ...r, id: itemDocId, transaction_id: newTxId });
        }

        // Offline-secure: update product stocks
        for (const item of cart) {
          if (item.product.trackStock === false) continue;
          const prod = realtimeProducts.find(p => String(p.id) === String(item.product.id));
          if (prod) {
            await dbUpdate('products', prod.id!, { stock: prod.stock - item.qty });
          }
        }

        const finalTx = mapTransaction({
          ...txData,
          id: newTxId,
        });
        setLastTransaction(finalTx);
        setLastTxItems(itemRecords.map((r, i) => ({
          id: i,
          transactionId: newTxId,
          productId: r.product_id,
          productName: r.product_name,
          quantity: r.quantity,
          price: r.price,
          hpp: r.hpp,
          discountType: r.discount_type,
          discountValue: r.discount_value,
          discountAmount: r.discount_amount,
          subtotal: r.subtotal,
          selectedVariants: r.selected_variants,
          notes: r.notes
        })));

        // Play local ding sound
        try {
          const audio = new Audio('/ding.mp3');
          audio.play().catch(e => console.warn('[Sound] Audio play blocked/failed:', e));
        } catch (err) {}

          toast.success(`Transaksi berhasil! ${receiptNumber}`);
          setCheckoutOpen(false);
          setTimeout(() => {
            setReceiptOpen(true);
          }, 400);
        }
    } catch (error) {
      console.error('[Cashier] Failed to process checkout:', error);
      toast.error('Gagal memproses transaksi. Coba lagi.');
    } finally {
      setIsCheckingOut(false);
      doFullReset();
      setCheckoutOpen(false);
      setCartOpen(false);
    }
  };

  const handleScan = (barcode: string) => {
    setScannerOpen(false);
    const product = products?.find(p => p.sku === barcode || p.barcode === barcode);
    if (product) {
      if (product.stock <= 0) {
        toast.error(`Stok ${product.name} habis`);
        return;
      }
      addToCart(product);
      toast.success(`Ditambahkan: ${product.name}`);
    } else {
      toast.error(`Produk dengan SKU/Barcode "${barcode}" tidak ditemukan`);
    }
  };

  const handleScanKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && scanInput.trim()) {
      const code = scanInput.trim();
      setScanInput('');
      const product = products?.find(p => p.sku === code || p.barcode === code);
      if (product) {
        if (product.stock <= 0) {
          toast.error(`Stok ${product.name} habis`);
          return;
        }
        addToCart(product);
        toast.success(`Ditambahkan: ${product.name}`);
      } else {
        toast.error(`Produk dengan SKU/Barcode "${code}" tidak ditemukan`);
      }
    }
  };

  const rp = (n: number | string) => {
    const val = Number(n) || 0;
    return `Rp ${val.toLocaleString('id-ID')}`;
  };

  return (
    <CashierContext.Provider
      value={{
        search, setSearch,
        filterCategory, setFilterCategory,
        cart, setCart,
        editingTxId, setEditingTxId,
        cartOpen, setCartOpen,
        checkoutOpen, setCheckoutOpen,
        midtransPaymentType, setMidtransPaymentType,
        txDiscountType, setTxDiscountType,
        txDiscountValue, setTxDiscountValue,
        discountDialogOpen, setDiscountDialogOpen,
        tempDiscountType, setTempDiscountType,
        tempDiscountValue, setTempDiscountValue,
        paymentMethodId, setPaymentMethodId,
        paymentAmount, setPaymentAmount,
        payments, setPayments,
        isQuickAdding, setIsQuickAdding,
        receiptOpen, setReceiptOpen,
        lastTransaction, setLastTransaction,
        lastTxItems, setLastTxItems,
        customerName, setCustomerName,
        tableNumber, setTableNumber,
        remarks, setRemarks,
        scannerOpen, setScannerOpen,
        openBillsOpen, setOpenBillsOpen,
        editingItemNotes, setEditingItemNotes,
        processingBillsOpen, setProcessingBillsOpen,
        tempItemNotes, setTempItemNotes,
        cancelDialogOpen, setCancelDialogOpen,
        cancelTargetTx, setCancelTargetTx,
        scanInput, setScanInput,
        voucherCode, setVoucherCode,
        voucherApplied, setVoucherApplied,
        voucherLoading, setVoucherLoading,
        isCheckingOut, setIsCheckingOut,
        checkoutDataCache, setCheckoutDataCache,
        scanInputRef,
        variantProduct, setVariantProduct,
        variantSelection, setVariantSelection,
        variantNotes, setVariantNotes,
        products,
        categories,
        paymentMethods,
        storeSettings,
        allBills,
        openBills,
        vouchers,
        loading,
        processingBills,
        processingBillsCount,
        cartProductIds,
        filtered,
        subtotal,
        txDiscountAmount,
        ppnAmount,
        adminFee,
        taxAndService,
        total,
        totalPaidSoFar,
        totalProfit,
        cartCount,
        openBillsCount,
        hasEditAccess,
        remainingToPay,
        currentPaidAmount,
        change,
        doFullReset,
        addToCart,
        updateQty,
        removeFromCart,
        updateItemNotes,
        saveOpenBill,
        loadOpenBill,
        cancelOpenBill,
        handleCancelFromCart,
        handleCancelFromList,
        handleCheckout,
        processCheckoutToDb,
        handleScan,
        handleScanKeyDown,
        rp
      }}
    >
      {children}
    </CashierContext.Provider>
  );
};

export const useCashier = () => {
  const context = useContext(CashierContext);
  if (context === undefined) {
    throw new Error('useCashier must be used within a CashierProvider');
  }
  return context;
};
