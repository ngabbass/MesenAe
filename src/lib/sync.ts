
// ── Mapper: snake_case (Google Sheets) → camelCase (TypeScript) ───────────

export function mapCategory(r: Record<string, unknown>) {
  return {
    id: r.id as number,
    name: r.name as string,
    color: r.color as string,
    icon: r.icon as string,
    needsKitchen: r.needs_kitchen === undefined ? true : (r.needs_kitchen as boolean),
    createdAt: new Date(r.created_at as string)
  };
}

export function mapProduct(r: Record<string, unknown>) {
  return {
    id: r.id as number,
    name: r.name as string,
    sku: r.sku as string,
    categoryId: r.category_id as number,
    price: Number(r.price),
    hpp: Number(r.hpp),
    stock: Number(r.stock),
    unit: r.unit as string,
    variants: (r.variants as any) ?? [],
    photo: r.photo as string | undefined,
    barcode: r.barcode as string | undefined,
    createdAt: new Date(r.created_at as string),
    updatedAt: new Date(r.updated_at as string)
  };
}

export function mapSupplier(r: Record<string, unknown>) {
  return {
    id: r.id as number,
    name: r.name as string,
    phone: r.phone as string,
    address: r.address as string,
    notes: r.notes as string,
    createdAt: new Date(r.created_at as string)
  };
}

export function mapStockIn(r: Record<string, unknown>) {
  return {
    id: r.id as number,
    productId: r.product_id as number,
    supplierId: r.supplier_id as number,
    quantity: Number(r.quantity),
    buyPrice: Number(r.buy_price),
    totalPrice: Number(r.total_price),
    date: new Date(r.date as string),
    notes: r.notes as string,
  };
}

export function mapStockOut(r: Record<string, unknown>) {
  return {
    id: r.id as number,
    productId: r.product_id as number,
    quantity: Number(r.quantity),
    reason: r.reason as string,
    date: new Date(r.date as string),
    notes: r.notes as string,
  };
}

function mapHppHistory(r: Record<string, unknown>) {
  return {
    id: r.id as number,
    productId: r.product_id as number,
    oldHpp: Number(r.old_hpp),
    newHpp: Number(r.new_hpp),
    source: r.source as 'stock_in' | 'manual',
    date: new Date(r.date as string),
  };
}

export function mapPaymentMethod(r: Record<string, unknown>) {
  return {
    id: r.id as number,
    name: r.name as string,
    category: r.category as string,
    isDefault: r.is_default as boolean,
    createdAt: new Date(r.created_at as string),
  };
}

export function mapTransaction(r: Record<string, unknown>) {
  return {
    id: r.id as number,
    subtotal: Number(r.subtotal),
    discountType: r.discount_type as 'percentage' | 'nominal' | null,
    discountValue: Number(r.discount_value),
    discountAmount: Number(r.discount_amount),
    total: Number(r.total),
    taxAndService: r.tax_and_service ? Number(r.tax_and_service) : undefined,
    taxAmount: r.tax_amount ? Number(r.tax_amount) : undefined,
    adminFee: r.admin_fee ? Number(r.admin_fee) : undefined,
    paymentMethodId: r.payment_method_id as number,
    paymentAmount: Number(r.payment_amount),
    payments: (r.payments ?? []) as unknown[],
    change: Number(r.change),
    profit: Number(r.profit),
    date: new Date(r.date as string),
    receiptNumber: r.receipt_number as string,
    status: r.status as 'belum lunas' | 'lunas' | 'partial' | 'batal',
    kitchenStatus: r.kitchen_status as string | undefined,
    orderNumber: r.order_number as string | undefined,
    customerName: r.customer_name as string | undefined,
    tableNumber: r.table_number as string | undefined,
    remarks: r.remarks as string | undefined,
    needsKitchen: r.needs_kitchen as boolean | undefined,
    openedAt: r.opened_at ? new Date(r.opened_at as string) : undefined,
    closedAt: r.closed_at ? new Date(r.closed_at as string) : undefined,
  };
}

export function mapTransactionItem(r: Record<string, unknown>) {
  return {
    id: r.id as number,
    transactionId: r.transaction_id as number,
    productId: r.product_id as number,
    productName: r.product_name as string,
    quantity: Number(r.quantity),
    price: Number(r.price),
    hpp: Number(r.hpp),
    discountType: r.discount_type as 'percentage' | 'nominal' | null,
    discountValue: Number(r.discount_value),
    discountAmount: Number(r.discount_amount),
    subtotal: Number(r.subtotal),
    selectedVariants: (r.selected_variants ?? []) as unknown[],
    notes: r.notes as string | undefined,
  };
}

export function mapStoreSettings(s: Record<string, unknown>) {
  return {
    id: s.id as number,
    storeName: s.store_name as string,
    address: s.address as string,
    phone: s.phone as string,
    receiptFooter: s.receipt_footer as string,
    onboardingDone: s.onboarding_done as boolean,
    themeColor: s.theme_color as string,
    logo: s.logo as string,
    tables: s.tables as string[],
    promoBanners: (s.promo_banners as any[]) ?? [],
    deliveryMode: (s.delivery_mode as 'ambil' | 'diantar') || 'diantar',
    enableWhatsappNotification: s.enable_whatsapp_notification === undefined ? false : (s.enable_whatsapp_notification as boolean),
    enableTax: s.enable_tax === undefined ? false : (s.enable_tax as boolean),
    taxPercentage: s.tax_percentage ? Number(s.tax_percentage) : 0,
    enableAdminFee: s.enable_admin_fee === undefined ? false : (s.enable_admin_fee as boolean),
    adminFeeValue: s.admin_fee_value ? Number(s.admin_fee_value) : 0,
    enableSplitBill: s.enable_split_bill === undefined ? true : (s.enable_split_bill as boolean)
  };
}

export function mapUser(s: Record<string, unknown>) {
  return {
    id: s.id as number,
    username: s.username as string,
    password_hash: s.password_hash as string,
    role: s.role as 'admin' | 'user',
    createdAt: new Date(s.created_at as string)
  };
}

export function mapVoucher(v: Record<string, unknown>) {
  return {
    id: v.id as number,
    code: v.code as string,
    type: v.type as 'percentage' | 'nominal',
    value: Number(v.value),
    isActive: v.is_active as boolean,
    applicableProductIds: (v.applicable_product_ids as number[]) || [],
    validUntil: v.valid_until ? new Date(v.valid_until as string) : null,
    createdAt: new Date(v.created_at as string)
  };
}


// ── Mapper: camelCase (TypeScript) → snake_case (Google Sheets) ──────────

export function toDatabaseCategory(d: Record<string, unknown>) {
  return { id: d.id, name: d.name, color: d.color, icon: d.icon, needs_kitchen: d.needsKitchen, created_at: d.createdAt };
}

export function toDatabaseVoucher(d: Record<string, unknown>) {
  return {
    id: d.id,
    code: d.code,
    type: d.type,
    value: d.value,
    is_active: d.isActive,
    applicable_product_ids: d.applicableProductIds || [],
    valid_until: d.validUntil instanceof Date ? d.validUntil.toISOString() : d.validUntil,
    created_at: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt
  };
}

export function toDatabaseProduct(d: Record<string, unknown>) {
  return {
    id: d.id, name: d.name, sku: d.sku, category_id: d.categoryId,
    price: d.price, hpp: d.hpp, stock: d.stock, unit: d.unit,
    variants: d.variants ?? [], photo: d.photo ?? null, barcode: d.barcode ?? null,
    created_at: d.createdAt, updated_at: d.updatedAt
  };
}

export function toDatabaseSupplier(d: Record<string, unknown>) {
  return { id: d.id, name: d.name, phone: d.phone, address: d.address, notes: d.notes, created_at: d.createdAt };
}

export function toDatabaseStockIn(d: Record<string, unknown>) {
  return { id: d.id, product_id: d.productId, supplier_id: d.supplierId, quantity: d.quantity, buy_price: d.buyPrice, total_price: d.totalPrice, date: d.date, notes: d.notes };
}

export function toDatabaseStockOut(d: Record<string, unknown>) {
  return { id: d.id, product_id: d.productId, quantity: d.quantity, reason: d.reason, date: d.date, notes: d.notes };
}

export function toDatabaseHppHistory(d: Record<string, unknown>) {
  return { id: d.id, product_id: d.productId, old_hpp: d.oldHpp, new_hpp: d.newHpp, source: d.source, date: d.date };
}

export function toDatabasePaymentMethod(d: Record<string, unknown>) {
  return { id: d.id, name: d.name, category: d.category, is_default: d.isDefault, created_at: d.createdAt };
}

export function toDatabaseTransaction(d: Record<string, unknown>) {
  return {
    id: d.id, subtotal: d.subtotal, discount_type: d.discountType, discount_value: d.discountValue,
    discount_amount: d.discountAmount, total: d.total, payment_method_id: d.paymentMethodId,
    payment_amount: d.paymentAmount, payments: d.payments ?? [], change: d.change, profit: d.profit,
    date: d.date, receipt_number: d.receiptNumber, status: d.status, kitchen_status: d.kitchenStatus ?? null,
    order_number: d.orderNumber ?? null, customer_name: d.customerName ?? null,
    table_number: d.tableNumber ?? null, remarks: d.remarks ?? null,
    needs_kitchen: d.needsKitchen ?? null,
    opened_at: d.openedAt ?? null, closed_at: d.closedAt ?? null,
    tax_and_service: d.taxAndService ?? null,
    tax_amount: d.taxAmount ?? null,
    admin_fee: d.adminFee ?? null,
  };
}

export function toDatabaseTransactionItem(d: Record<string, unknown>) {
  return {
    id: d.id, transaction_id: d.transactionId, product_id: d.productId, product_name: d.productName,
    quantity: d.quantity, price: d.price, hpp: d.hpp, discount_type: d.discountType,
    discount_value: d.discountValue, discount_amount: d.discountAmount, subtotal: d.subtotal,
    selected_variants: d.selectedVariants ?? [], notes: d.notes ?? null,
  };
}

export function toDatabaseStoreSettings(d: Record<string, unknown>) {
  return {
    id: d.id,
    store_name: d.storeName,
    address: d.address,
    phone: d.phone,
    receipt_footer: d.receiptFooter,
    onboarding_done: d.onboardingDone,
    theme_color: d.themeColor,
    logo: d.logo,
    tables: d.tables,
    delivery_mode: d.deliveryMode,
    enable_whatsapp_notification: d.enableWhatsappNotification ?? false,
    enable_tax: d.enableTax ?? false,
    tax_percentage: d.taxPercentage ?? 0,
    enable_admin_fee: d.enableAdminFee ?? false,
    admin_fee_value: d.adminFeeValue ?? 0,
    enable_split_bill: d.enableSplitBill ?? true
  };
}

export function toDatabaseUser(d: Record<string, unknown>) {
  return {
    id: d.id,
    username: d.username,
    password_hash: d.password_hash,
    role: d.role,
    created_at: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt
  };
}
