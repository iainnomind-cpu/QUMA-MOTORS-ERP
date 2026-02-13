import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase environment variables are missing');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ===== Multi-Branch Types =====
export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  manager_name: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BranchCatalogStock {
  id: string;
  branch_id: string;
  catalog_item_id: string;
  stock: number;
  test_drive_available: boolean;
}

// ===== New Parts Inventory System Types =====

export interface PartsCatalog {
  id: string;
  sku: string;
  name: string;
  category: 'refaccion' | 'accesorio';
  subcategory: string | null;
  description: string | null;
  compatible_models: string[];
  brand: string | null;
  price_retail: number;
  cost_price: number | null;
  supplier: string | null;
  image_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PartsInventory {
  id: string;
  branch_id: string;
  catalog_id: string;
  stock_quantity: number;
  min_stock_alert: number;
  location: string | null;
  last_inventory_check: string | null;
  created_at: string;
  updated_at: string;
}

// Joined Type for Frontend Display
export interface PartItem extends PartsCatalog {
  inventory_id?: string;
  branch_id?: string;
  stock_quantity: number;
  min_stock_alert: number;
  location: string | null;
}

export interface PartsTransfer {
  id: string;
  catalog_id: string; // Changed from part_id to catalog_id
  from_branch_id: string;
  to_branch_id: string;
  quantity: number;
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
  requested_by: string | null;
  approved_by: string | null;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface CatalogItem {
  id: string;
  segment: string;
  model: string;
  price_cash: number;
  stock?: number; // Optional: Joined from branch_catalog_stock
  test_drive_available?: boolean; // Optional: Joined from branch_catalog_stock
  branch_stock_id?: string; // Optional: Used for frontend to check if item is in branch inventory
  year: number;
  color_options: string[];
  engine_cc: number | null;
  engine_type: string | null;
  max_power: string | null;
  max_torque: string | null;
  transmission: string | null;
  fuel_capacity: number | null;
  weight: number | null;
  seat_height: number | null;
  abs: boolean;
  traction_control: boolean;
  riding_modes: string[];
  description: string | null;
  key_features: string[];
  image_url: string | null;
  brochure_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  origin: string;
  score: number;
  status: string;
  model_interested: string | null;
  timeframe: string | null;
  financing_type: string | null;
  birthday: string | null;
  assigned_agent_id: string | null;
  test_drive_requested: boolean;
  test_drive_date: string | null;
  test_drive_completed: boolean;
  requires_financing: boolean;
  down_payment_amount: number | null;
  financing_term_months: number | null;
  monthly_payment_amount: number | null;
  has_id_document: boolean;
  has_income_proof: boolean;
  has_address_proof: boolean;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: string;
  last_purchase_date: string | null;
  birthday: string | null;
  converted_from_lead_id: string | null;
  purchased_model: string | null;
  purchase_type: string | null;
  purchase_price: number | null;
  original_interest_model: string | null;
  purchase_notes: string | null;
  branch_id: string | null;
  created_at: string;
}

export interface SalesAgent {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  total_leads_assigned: number;
  total_leads_converted: number;
  conversion_rate: number;
  branch_id: string | null;
  created_at: string;
}

export interface LeadInteraction {
  id: string;
  lead_id: string;
  interaction_type: string;
  channel: string;
  message: string;
  direction: string;
  agent_id: string | null;
  created_at: string;
}

export interface LeadAssignment {
  id: string;
  lead_id: string;
  agent_id: string;
  assigned_at: string;
  status: string;
  notes: string | null;
}

export interface LeadFollowUp {
  id: string;
  lead_id: string;
  agent_id: string;
  follow_up_date: string;
  status: string;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  type: string;
  target_segment: string;
  sent_count: number;
  conversion_rate: number;
  created_at: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  category: string;
  message_template: string;
  active: boolean;
  status?: string; // e.g. APPROVED, REJECTED, PENDING
  created_at: string;
}

export interface CampaignAudience {
  id: string;
  name: string;
  target_type: string;
  filters: Record<string, any>;
  created_at: string;
}

export interface AutomatedCampaign {
  id: string;
  name: string;
  type: string;
  trigger_type: string | null;
  template_id: string | null;
  audience_id: string | null;
  schedule_date: string | null;
  status: string;
  total_sent: number;
  total_delivered: number;
  total_responses: number;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignLog {
  id: string;
  campaign_id: string | null;
  recipient_type: string;
  recipient_id: string;
  phone: string;
  message: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  responded_at: string | null;
  wamid?: string;
  branch_id: string | null;
}

export interface LeadAttachment {
  id: string;
  lead_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  document_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  permissions: Record<string, any>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScoringRule {
  id: string;
  rule_name: string;
  rule_type: string;
  criteria: Record<string, any>;
  score_impact: number;
  active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface FinancialPromotion {
  id: string;
  name: string;
  description: string | null;
  promotion_type: string;
  conditions: Record<string, any>;
  benefits: Record<string, any>;
  active: boolean;
  start_date: string | null;
  end_date: string | null;
  applicable_models: string[];
  created_at: string;
  updated_at: string;
}

export interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: Record<string, any>;
  category: string;
  description: string | null;
  editable_by_role: string[];
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  changes: Record<string, any>;
  ip_address: string | null;
  branch_id: string | null;
  created_at: string;
}

export interface FinancingRule {
  id: string;
  financing_type: string;
  min_term_months: number;
  max_term_months: number;
  interest_rate: number;
  min_down_payment_percent: number;
  fixed_down_payment_percent: number | null;
  requires_minimum_price: boolean;
  minimum_price: number | null;
  active: boolean;
  description: string | null;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinancingCampaign {
  id: string;
  campaign_name: string;
  campaign_type: string;
  provider: string;
  start_date: string;
  end_date: string;
  applicable_models: string[];
  min_price: number | null;
  max_price: number | null;
  down_payment_percent: number;
  term_months: number;
  interest_rate: number;
  special_conditions: Record<string, any>;
  benefits_description: string | null;
  active: boolean;
  priority: number;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinancingCalculationLog {
  id: string;
  lead_id: string | null;
  model: string;
  price: number;
  financing_type: string;
  campaign_id: string | null;
  down_payment: number;
  term_months: number;
  monthly_payment: number;
  total_amount: number;
  interest_amount: number;
  calculation_source: string;
  created_at: string;
}

export interface PartsAccessoriesInventory {
  id: string;
  sku: string;
  name: string;
  category: 'refaccion' | 'accesorio';
  subcategory: string | null;
  description: string | null;
  compatible_models: string[];
  brand: string | null;
  price_retail: number;
  cost_price: number;
  stock_quantity: number;
  min_stock_alert: number;
  location: string | null;
  supplier: string | null;
  image_url: string | null;
  active: boolean;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartsSale {
  id: string;
  sale_date: string;
  customer_name: string;
  customer_phone: string | null;
  customer_type: 'walk-in' | 'cliente' | 'lead';
  related_customer_id: string | null;
  items: any[];
  subtotal: number;
  discount: number;
  total: number;
  payment_method: string | null;
  notes: string | null;
  sold_by: string | null;
  branch_id: string | null;
  created_at: string;
}

export interface PartsInventoryMovement {
  id: string;
  part_id: string;
  movement_type: 'entrada' | 'salida' | 'ajuste' | 'venta';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason: string | null;
  reference_id: string | null;
  performed_by: string | null;
  branch_id: string | null;
  created_at: string;
}

export interface ServiceTechnician {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  specialties: string[];
  status: string;
  max_daily_appointments: number;
  working_hours_start: string;
  working_hours_end: string;
  branch_id: string | null;
  created_at: string;
}

export interface TestDriveAppointment {
  id: string;
  lead_id: string | null;
  lead_name: string | null;
  lead_phone: string | null;
  catalog_item_id: string | null;
  catalog_model: string;
  agent_id: string | null;
  agent_name: string | null;
  appointment_date: string;
  duration_minutes: number;
  status: string;
  pickup_location: string;
  notes: string | null;
  completed_at: string | null;
  feedback: string | null;
  converted_to_sale: boolean;
  branch_id: string | null;
  created_at: string;
}

export interface ServiceAppointment {
  id: string;
  client_id: string | null;
  client_name: string;
  client_phone: string | null;
  technician_id: string | null;
  technician_name: string | null;
  appointment_date: string;
  service_type: string;
  estimated_duration_minutes: number;
  status: string;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  mileage: number | null;
  services_requested: string[];
  diagnosis: string | null;
  services_performed: string[];
  parts_used: any[];
  labor_cost: number;
  parts_cost: number;
  total_cost: number;
  notes: string | null;
  completed_at: string | null;
  branch_id: string | null;
  created_at: string;
}

export interface ServiceHistory {
  id: string;
  client_id: string | null;
  client_name: string;
  service_appointment_id: string | null;
  service_date: string;
  service_type: string;
  vehicle_model: string | null;
  mileage: number | null;
  services_performed: string[];
  parts_used: any[];
  total_cost: number;
  next_service_due_date: string | null;
  next_service_due_mileage: number | null;
  technician_id: string | null;
  technician_name: string | null;
  branch_id: string | null;
  created_at: string;
}

export interface ServiceReminder {
  id: string;
  client_id: string | null;
  client_name: string;
  client_phone: string | null;
  vehicle_model: string | null;
  reminder_type: string;
  last_service_date: string | null;
  last_service_mileage: number | null;
  next_service_due_date: string | null;
  next_service_due_mileage: number | null;
  status: string;
  sent_at: string | null;
  created_at: string;
}

// ============ Activity Logging Utility ============

interface LogActivityParams {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  branchId?: string | null;
  branchName?: string;
  actionType: string;     // e.g. 'create', 'update', 'delete', 'login', 'toggle'
  entityType: string;     // e.g. 'user', 'lead', 'notification', 'branch', 'scoring_rule'
  entityId?: string | null;
  details: Record<string, any>; // specific action details
}

export async function logActivity(params: LogActivityParams) {
  try {
    const changes = {
      performed_by: {
        name: params.userName,
        email: params.userEmail,
        role: params.userRole,
        branch_id: params.branchId || null,
        branch_name: params.branchName || null,
      },
      ...params.details,
    };

    const { error } = await supabase.from('activity_logs').insert([{
      user_id: params.userId,
      action_type: params.actionType,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      changes,
      branch_id: params.branchId || null,
      ip_address: null,
    }]);

    if (error) {
      console.warn('⚠ logActivity insert failed:', error.message, error.details);
    } else {
      console.log('✓ Activity logged:', params.actionType, params.entityType);
    }
  } catch (err) {
    console.error('❌ logActivity exception:', err);
  }
}
