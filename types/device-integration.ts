export interface DeviceEventLogRow {
  id: string;
  device_id: string;
  gym_id: string | null;
  branch_id: string | null;
  event_type: "ping" | "check_in" | "check_out" | "error" | "config_change" | "disconnected";
  payload: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
}

export interface DeviceEventLogInsert {
  device_id: string;
  gym_id?: string | null;
  branch_id?: string | null;
  event_type: DeviceEventLogRow["event_type"];
  payload?: Record<string, unknown>;
  occurred_at?: string;
}

export interface MemberDeviceMappingRow {
  id: string;
  member_id: string;
  gym_id: string;
  device_id: string;
  device_user_id: string;
  device_user_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MemberDeviceMappingInsert {
  member_id: string;
  gym_id: string;
  device_id: string;
  device_user_id: string;
  device_user_name?: string | null;
  is_active?: boolean;
}

export interface DeviceEventLogPayload {
  session_id?: string;
  member_id?: string;
  error?: string;
  device_user_id?: string | null;
  confidence?: number | null;
  mapping_id?: string | null;
  reason?: string;
  message?: string;
  action?: string;
  timestamp?: string;
  updates?: string[];
  duration_minutes?: number;
  registered_by?: string;
  decommissioned_by?: string;
}
