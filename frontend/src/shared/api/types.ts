// Типы ответов FastAPI (app/presentation/api/schemas.py).
export type RegionId = 'YKT' | 'DNR';
export type DirectionId = 'YKT-DNR' | 'DNR-YKT';
export type OrderStatus = 'accepted' | 'assembling' | 'transit' | 'pickup' | 'received' | 'cancelled';
export type WaveStatus = 'collecting' | 'closed' | 'transit' | 'arrived' | 'done' | 'postponed';
export type ReceiveMethod = 'pickup' | 'courier';

export interface Product {
  id: string; region: RegionId; manufacturer: string; name: string; category: string;
  weight_g: number; price_rub: number; temp_sensitive: boolean; shelf_life_days: number;
  photo: string; description: string; composition: string; tag: string; active: boolean;
}

export interface Wave {
  id: string; direction: DirectionId; title: string; departure: string; cutoff: string;
  arrival_from: string; arrival_to: string; off_season: boolean; status: WaveStatus; status_title: string;
  load_kg: number; fill: number; rate: number; discount_percent: number; open: boolean;
  days_left: number; orders_count: number; final_rate: number | null; final_load_kg: number | null;
}

export interface Quote {
  goods_rub: number; net_kg: number; weight_kg: number; current_load_kg: number; projected_load_kg: number;
  fill: number; fits: boolean; min_reached: boolean; rate: number; discount_percent: number;
  delivery_rub: number; base_delivery_rub: number; saving_rub: number;
  next_discount: { need_kg: number; rate: number; percent: number } | null;
  thermo: { sensitive: boolean; required: boolean; reason: string };
  thermo_applied: boolean; thermo_rub: number; gift_rub: number; receive_rub: number; total_rub: number;
}

export interface Offer { wave: Wave; quote: Quote | null }
export interface QuoteResponse { wave: Wave; quote: Quote }

export interface Order {
  code: string; number: number; created_at: string; customer_name: string; customer_phone: string;
  recipient: { name: string; phone: string; region: RegionId; city: string; receive: ReceiveMethod; address: string };
  items: { id: string; name: string; region: RegionId; photo: string; weight_g: number; price_rub: number; temp_sensitive: boolean; qty: number }[];
  direction: DirectionId; direction_title: string; wave: Wave | null;
  goods_rub: number; weight_kg: number; rate_rub: number; delivery_rub: number; thermo_rub: number;
  gift_rub: number; receive_rub: number; total_rub: number; refund_rub: number; final_delivery_rub: number | null;
  kind: 'self' | 'gift' | 'b2b'; gift: { message: string; signature: string; card: string; surprise: boolean } | null;
  company: string | null; payment_method: string; status: OrderStatus; status_title: string;
  history: { status: OrderStatus; status_title: string; date: string; note: string }[];
}

export interface Policy {
  wave_interval_days: number; cutoff_days_before: number; transit_days: [number, number];
  off_season_extra_days: number; base_tariff: number; min_load_kg: number; max_load_kg: number;
  discounts: [number, number][]; thermo_price: number; packaging_factor: number; min_billable_kg: number;
  gift_box_price: number; courier_price: number; pickup_price: number;
}

export interface Meta {
  today: string; policy: Policy;
  regions: Record<RegionId, { name: string; showcase: string; city: string; gen: string }>;
  directions: Record<DirectionId, { id: DirectionId; from: RegionId; to: RegionId; title: string }>;
  pickup_points: Record<RegionId, string[]>;
  categories: string[];
  order_statuses: { id: OrderStatus; title: string }[];
  wave_statuses: Record<WaveStatus, string>;
}

export interface Stats {
  orders: number; revenue: number; avg_check: number; gifts: number; commission: number;
  top: { id: string; name: string; qty: number }[];
  by_status: Record<OrderStatus, number>;
  counter: { direction: DirectionId; title: string; wave: Wave | null; forecast_kg: number | null }[];
}
