export const CATEGORIES = [
  'Leather', 'Charol', 'Plywood', 'Wood/Lumber', 'Foam', 'Aluminum', 'Hardware/Consumables',
] as const;
export const UNITS = ['Meters', 'Pcs', 'Roll', 'Box'] as const;
export const STATUSES = ['Pending', 'In Progress', 'Ready for Pickup', 'Completed'] as const;

export interface Material {
  id: string; category: string; name: string; type: string; unit: string;
  current_stock: number; low_stock_level: number;
  unit_price: number | null; // null for clerks
  supplier_id: string | null; supplier_name: string | null; supplier_phone: string | null;
}
export interface Supplier {
  id: string; name: string; contact_number: string; supplied_materials: string[];
  items: { id: string; name: string; type: string; unit: string; current_stock: number; low_stock_level: number }[];
}
export interface Service { id: string; name: string; variant: string; base_price: number; is_addon: boolean }
export interface UserRow { id: string; full_name: string; nickname: string; role: 'owner' | 'admin' | 'clerk'; created_at: string }
export interface JobOrder {
  id: string; job_no: number; customer_name: string; contact_details: string; status: string;
  notes: string; total: number; created_by_name: string; created_at: string; completed_at: string | null;
  items: { kind: string; name: string; description: string; unit_price: number; quantity: number }[];
  materials: { label: string; quantity: number }[];
}
