// ============================================================
// 全站共用型別定義
// ============================================================

export interface AdminRole {
  id: number
  role_name: string
  role_key: string
  permissions_json: string[]
}

export interface AdminUser {
  id: number
  name: string
  account: string
  role_id: number
  is_active: boolean
  created_at: string
  updated_at: string
  admin_roles?: AdminRole
}

export interface HealthCategory {
  id: number
  name: string
  slug: string
  sort_order: number
  is_active: boolean
}

export interface ProductVariant {
  id: number
  product_id: number
  variant_name: string
  sale_price: number
  original_price: number | null
  stock_qty: number
  sku_code: string | null
  sort_order: number
  is_active: boolean
}

export interface ProductImage {
  id: number
  product_id: number
  image_url: string
  sort_order: number
}

export interface Product {
  id: number
  product_name: string
  slug: string
  short_intro: string | null
  suitable_people: string | null
  usage_method: string | null
  ingredients: string | null
  precautions: string | null
  storage_method: string | null
  is_published: boolean
  cover_image_url: string | null
  created_at: string
  updated_at: string
  product_variants?: ProductVariant[]
  product_images?: ProductImage[]
  health_categories?: HealthCategory[]
}

export interface Store711 {
  id: number
  store_code: string | null
  store_name: string
  county: string
  district: string
  address: string
  is_active: boolean
}

export type OrderStatus = '待確認' | '已確認' | '備貨中' | '已出貨' | '已到店' | '已取消'

export interface OrderItem {
  id: number
  order_id: number
  product_id: number | null
  product_name_snapshot: string
  product_image_snapshot: string | null
  variant_id: number | null
  variant_name_snapshot: string
  sku_snapshot: string | null
  unit_price: number
  quantity: number
  subtotal: number
}

export interface Order {
  id: number
  order_no: string
  customer_name: string
  phone: string
  line_id: string | null
  store_id: number | null
  store_name: string
  store_address: string
  county: string
  district: string
  order_status: OrderStatus
  items_count: number
  total_amount: number
  note: string | null
  created_at: string
  updated_at: string
  order_items?: OrderItem[]
  /** 這筆是該客戶第幾次購買（依手機號，不計已取消；已取消訂單為 null） */
  purchase_seq?: number | null
  /** 該客戶累計購買次數（依手機號，不計已取消） */
  customer_orders?: number
}

// Cart types (client-side only)
export interface CartItem {
  product_id: number
  product_name: string
  product_slug: string
  cover_image_url: string | null
  variant_id: number
  variant_name: string
  sku_code: string | null
  unit_price: number
  quantity: number
  stock_qty: number
}

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Checkout form
export interface CheckoutForm {
  customer_name: string
  phone: string
  line_id: string
  store_id: number | null
  store_name: string
  store_address: string
  county: string
  district: string
  note: string
}

// Report types
export interface ReportSummary {
  total_orders: number
  total_items: number
  total_revenue: number
}

export interface ProductSalesReport {
  product_id: number
  product_name: string
  total_qty: number
  total_revenue: number
}

export interface VariantSalesReport {
  variant_id: number
  product_name: string
  variant_name: string
  sku_code: string | null
  total_qty: number
  total_revenue: number
}

export interface StatusReport {
  order_status: string
  count: number
}

export interface CategorySalesReport {
  category_name: string
  total_qty: number
  total_revenue: number
}
