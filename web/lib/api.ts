import type {
  Farmer,
  Farm,
  Visit,
  DashboardStats,
  DashboardStatsByDepartmentItem,
  DashboardVisitsByDayItem,
  DashboardVisitsByActivityItem,
  DashboardTopOfficerItem,
  DashboardSchedulesSummary,
  DashboardProductRankingItem,
  DashboardStaffRankingItem,
  UserRole,
  Schedule,
  StaffUser,
  StaffPerformanceUser,
  Notification,
  LocationsResponse,
  OptionsResponse,
  LocationReport,
  MaintenanceIncident,
  MaintenanceStatus,
} from "./types";
import { parseApiError } from "./api-utils";

const API_BASE = "";

const defaultCredentials: RequestCredentials = "include";

/** Called when any authenticated request returns 401 (session expired). AuthContext registers this to clear state and trigger redirect to login. */
let onSessionExpired: (() => void) | null = null;
export function setOnSessionExpired(callback: (() => void) | null) {
  onSessionExpired = callback;
}

/** Support both DRF paginated ({ results: T[] }) and raw list responses. */
function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : (data.results ?? []);
}

/** Authenticated fetch. On 401, invokes onSessionExpired so the app can redirect to login. */
async function authFetch(
  url: string,
  options: RequestInit & { signal?: AbortSignal | null } = {}
): Promise<Response> {
  const { signal: _signal, ...rest } = options;
  const res = await fetch(url, {
    ...rest,
    credentials: rest.credentials ?? defaultCredentials,
  });
  if (res.status === 401) {
    onSessionExpired?.();
  }
  return res;
}

export interface AuthUser {
  email: string;
  role: UserRole;
  must_change_password?: boolean;
}

export const api = {
  async login(email: string, password: string): Promise<{ user: AuthUser }> {
    const res = await authFetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(parseApiError(err, "Login failed"));
    }
    return res.json();
  },

  async logout(): Promise<void> {
    await authFetch(`${API_BASE}/api/auth/logout`, { method: "POST" });
  },

  async getMe(): Promise<{ user: AuthUser } | null> {
    const res = await authFetch(`${API_BASE}/api/auth/me`);
    if (res.status === 401) return null;
    if (!res.ok) return null;
    return res.json();
  },

  async getFarmers(options?: { signal?: AbortSignal; is_stockist?: boolean }): Promise<Farmer[]> {
    const params = new URLSearchParams();
    if (options?.is_stockist !== undefined) params.set("is_stockist", String(options.is_stockist));
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await authFetch(`${API_BASE}/api/farmers${qs}`, { signal: options?.signal });
    if (!res.ok) throw new Error("Failed to fetch farmers");
    return unwrapList(await res.json());
  },

  async getFarmer(id: string, options?: { signal?: AbortSignal }): Promise<Farmer> {
    const res = await authFetch(`${API_BASE}/api/farmers/${encodeURIComponent(id)}/`, { signal: options?.signal });
    if (!res.ok) {
      if (res.status === 404) throw new Error("Farmer not found.");
      throw new Error("Failed to fetch farmer");
    }
    return res.json();
  },

  async createFarmer(data: {
    first_name: string;
    middle_name?: string;
    last_name: string;
    phone?: string;
    latitude: number;
    longitude: number;
    is_stockist?: boolean;
  }): Promise<Farmer> {
    const res = await authFetch(`${API_BASE}/api/farmers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        parseApiError(err, "Failed to create farmer", [
          "first_name",
          "last_name",
        ])
      );
    }
    return res.json();
  },

  async getFarms(
    farmerId?: string | null,
    options?: { signal?: AbortSignal; is_outlet?: boolean }
  ): Promise<Farm[]> {
    const params = new URLSearchParams();
    if (farmerId) params.set("farmer", farmerId);
    if (options?.is_outlet !== undefined) params.set("is_outlet", String(options.is_outlet));
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await authFetch(`${API_BASE}/api/farms${qs}`, { signal: options?.signal });
    if (!res.ok) throw new Error("Failed to fetch farms");
    return unwrapList(await res.json());
  },

  async getFarm(id: string, options?: { signal?: AbortSignal }): Promise<Farm> {
    const res = await authFetch(`${API_BASE}/api/farms/${encodeURIComponent(id)}/`, { signal: options?.signal });
    if (!res.ok) {
      if (res.status === 404) throw new Error("Farm not found.");
      throw new Error("Failed to fetch farm");
    }
    return res.json();
  },

  async createFarm(data: {
    farmer_id: string;
    county_id: string;
    sub_county_id: string;
    village: string;
    latitude: number;
    longitude: number;
    plot_size?: string;
    is_outlet?: boolean;
  }): Promise<Farm> {
    const res = await authFetch(`${API_BASE}/api/farms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        parseApiError(err, "Failed to create farm", ["farmer_id", "county", "sub_county", "village", "latitude", "longitude"])
      );
    }
    return res.json();
  },

  async getVisits(
    params?: { officer?: string; date?: string; date_from?: string; date_to?: string; department?: string; farm?: string; farmer?: string },
    options?: { signal?: AbortSignal }
  ): Promise<Visit[]> {
    const search = new URLSearchParams();
    if (params?.officer) search.set("officer", params.officer);
    if (params?.date) search.set("date", params.date);
    if (params?.date_from) search.set("date_from", params.date_from);
    if (params?.date_to) search.set("date_to", params.date_to);
    if (params?.department) search.set("department", params.department);
    if (params?.farm) search.set("farm", params.farm);
    if (params?.farmer) search.set("farmer", params.farmer);
    const all: Visit[] = [];
    let page = 1;
    type PageResponse = { results?: Visit[]; next?: string | null };
    while (true) {
      const pageSearch = new URLSearchParams(search);
      pageSearch.set("page", String(page));
      const qs = pageSearch.toString();
      const url = `${API_BASE}/api/visits?${qs}`;
      const res = await authFetch(url, { signal: options?.signal });
      if (!res.ok) throw new Error("Failed to fetch visits");
      const data = (await res.json()) as Visit[] | PageResponse;
      const batch = Array.isArray(data) ? data : (data.results ?? []);
      all.push(...batch);
      const hasNext =
        !Array.isArray(data) &&
        data != null &&
        typeof data === "object" &&
        Boolean((data as PageResponse).next);
      if (!hasNext || batch.length === 0) break;
      page += 1;
    }
    return all;
  },

  /** Supervisor or admin only. Accept or reject a visit record (sets verification_status). */
  async verifyVisit(
    visitId: string,
    action: "accept" | "reject"
  ): Promise<Visit> {
    const res = await authFetch(`${API_BASE}/api/visits/${encodeURIComponent(visitId)}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      if (res.status === 403) throw new Error("Only supervisors and admins can accept or reject visit records.");
      if (res.status === 404) throw new Error("Visit not found.");
      const err = await res.json().catch(() => ({})) as { action?: string[]; detail?: string };
      const msg = err?.detail ?? (Array.isArray(err?.action) ? err.action[0] : "Failed to update visit");
      throw new Error(msg);
    }
    return res.json();
  },

  /** Admin/supervisor only. Location reports (tracking during working hours). Same date params as visits: date or date_from+date_to. */
  async getTrackingReports(
    params?: { user_id?: string; date?: string; date_from?: string; date_to?: string; page_size?: number },
    options?: { signal?: AbortSignal }
  ): Promise<{ results: LocationReport[]; count: number }> {
    const search = new URLSearchParams();
    if (params?.user_id) search.set("user_id", params.user_id);
    if (params?.date) search.set("date", params.date);
    if (params?.date_from) search.set("date_from", params.date_from);
    if (params?.date_to) search.set("date_to", params.date_to);
    if (params?.page_size != null) search.set("page_size", String(params.page_size));
    const qs = search.toString();
    const url = qs ? `${API_BASE}/api/tracking/reports/?${qs}` : `${API_BASE}/api/tracking/reports/`;
    const res = await authFetch(url, { signal: options?.signal });
    if (!res.ok) {
      if (res.status === 403) throw new Error("Only admin or supervisor can view tracking.");
      const err = await res.json().catch(() => ({})) as { detail?: string };
      const msg = typeof err?.detail === "string" ? err.detail : "Failed to fetch location reports";
      throw new Error(msg);
    }
    const data = (await res.json()) as { results?: LocationReport[]; count?: number };
    return { results: data.results ?? [], count: data.count ?? 0 };
  },

  async sendTrackingReport(payload: {
    reported_at: string;
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    device_info?: Record<string, unknown>;
  }): Promise<{ created: number }> {
    const res = await authFetch(`${API_BASE}/api/tracking/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reports: [payload] }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = typeof data?.detail === "string" ? data.detail : "Failed to submit location report";
      throw new Error(msg);
    }
    return data as { created: number };
  },

  async getMaintenanceIncidents(params?: { status?: MaintenanceStatus; officer?: string }): Promise<MaintenanceIncident[]> {
    const search = new URLSearchParams();
    if (params?.status) search.set("status", params.status);
    if (params?.officer) search.set("officer", params.officer);
    const qs = search.toString();
    const url = qs ? `${API_BASE}/api/maintenance-incidents?${qs}` : `${API_BASE}/api/maintenance-incidents`;
    const res = await authFetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { detail?: string };
      throw new Error(err.detail || "Failed to fetch maintenance incidents");
    }
    return unwrapList(await res.json());
  },

  async createMaintenanceIncident(payload: {
    vehicle_type: "motorbike" | "car" | "other";
    issue_description: string;
    reported_latitude: number;
    reported_longitude: number;
  }): Promise<MaintenanceIncident> {
    const res = await authFetch(`${API_BASE}/api/maintenance-incidents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(parseApiError(data, "Failed to create maintenance incident", ["issue_description", "vehicle_type"]));
    }
    return data as MaintenanceIncident;
  },

  async updateMaintenanceIncident(
    id: string,
    payload: {
      status?: MaintenanceStatus;
      supervisor_notes?: string;
      breakdown_verified_latitude?: number;
      breakdown_verified_longitude?: number;
      garage_latitude?: number;
      garage_longitude?: number;
    }
  ): Promise<MaintenanceIncident> {
    const res = await authFetch(`${API_BASE}/api/maintenance-incidents/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(parseApiError(data, "Failed to update maintenance incident", ["status", "supervisor_notes"]));
    }
    return data as MaintenanceIncident;
  },

  async getDashboardStats(options?: { signal?: AbortSignal }): Promise<DashboardStats> {
    const res = await authFetch(`${API_BASE}/api/dashboard/stats`, { signal: options?.signal });
    if (!res.ok) {
      if (res.status === 401)
        throw new Error("Session expired. Please log in again.");
      if (res.status === 403)
        throw new Error("Dashboard is for admin and supervisor only.");
      const err = await res.json().catch(() => ({})) as { detail?: string };
      const msg = typeof err?.detail === "string" ? err.detail : "Failed to fetch dashboard stats";
      throw new Error(msg);
    }
    return res.json();
  },

  async getDashboardVisitsByDay(
    days = 14,
    options?: { signal?: AbortSignal }
  ): Promise<DashboardVisitsByDayItem[]> {
    const res = await authFetch(
      `${API_BASE}/api/dashboard/visits-by-day?days=${encodeURIComponent(String(days))}`,
      { signal: options?.signal }
    );
    if (!res.ok) {
      if (res.status === 403)
        throw new Error("Dashboard is for admin and supervisor only.");
      throw new Error("Failed to fetch visits by day");
    }
    return res.json();
  },

  async getDashboardStatsByDepartment(options?: { signal?: AbortSignal }): Promise<DashboardStatsByDepartmentItem[]> {
    const res = await authFetch(`${API_BASE}/api/dashboard/stats-by-department`, { signal: options?.signal });
    if (!res.ok) {
      if (res.status === 403)
        throw new Error("Dashboard is for admin and supervisor only.");
      throw new Error("Failed to fetch stats by department");
    }
    return res.json();
  },

  async getDashboardVisitsByActivity(options?: { signal?: AbortSignal }): Promise<DashboardVisitsByActivityItem[]> {
    const res = await authFetch(`${API_BASE}/api/dashboard/visits-by-activity`, { signal: options?.signal });
    if (!res.ok) {
      if (res.status === 403)
        throw new Error("Dashboard is for admin and supervisor only.");
      throw new Error("Failed to fetch visits by activity");
    }
    return res.json();
  },

  async getDashboardTopOfficers(
    params?: { limit?: number },
    options?: { signal?: AbortSignal }
  ): Promise<DashboardTopOfficerItem[]> {
    const limit = params?.limit ?? 10;
    const res = await authFetch(
      `${API_BASE}/api/dashboard/top-officers?limit=${encodeURIComponent(String(limit))}`,
      { signal: options?.signal }
    );
    if (!res.ok) {
      if (res.status === 403)
        throw new Error("Dashboard is for admin and supervisor only.");
      throw new Error("Failed to fetch top officers");
    }
    return res.json();
  },

  async getDashboardSchedulesSummary(options?: { signal?: AbortSignal }): Promise<DashboardSchedulesSummary> {
    const res = await authFetch(`${API_BASE}/api/dashboard/schedules-summary`, { signal: options?.signal });
    if (!res.ok) {
      if (res.status === 403)
        throw new Error("Dashboard is for admin and supervisor only.");
      throw new Error("Failed to fetch schedules summary");
    }
    return res.json();
  },

  async getDashboardProductRanking(
    params?: { days?: number },
    options?: { signal?: AbortSignal }
  ): Promise<DashboardProductRankingItem[]> {
    const days = params?.days ?? 30;
    const res = await authFetch(
      `${API_BASE}/api/dashboard/product-ranking/?days=${encodeURIComponent(String(days))}`,
      { signal: options?.signal }
    );
    if (!res.ok) {
      if (res.status === 403)
        throw new Error("Dashboard is for admin and supervisor only.");
      throw new Error("Failed to fetch product ranking");
    }
    return res.json();
  },

  async getDashboardStaffRanking(
    params?: { days?: number },
    options?: { signal?: AbortSignal }
  ): Promise<DashboardStaffRankingItem[]> {
    const days = params?.days ?? 30;
    const res = await authFetch(
      `${API_BASE}/api/dashboard/staff-ranking/?days=${encodeURIComponent(String(days))}`,
      { signal: options?.signal }
    );
    if (!res.ok) {
      if (res.status === 403)
        throw new Error("Dashboard is for admin and supervisor only.");
      throw new Error("Failed to fetch staff ranking");
    }
    return res.json();
  },

  async getSchedules(params?: { department?: string }): Promise<Schedule[]> {
    const search = new URLSearchParams();
    if (params?.department) search.set("department", params.department);
    const qs = search.toString();
    const url = qs ? `${API_BASE}/api/schedules?${qs}` : `${API_BASE}/api/schedules`;
    const res = await authFetch(url);
    if (!res.ok) throw new Error("Failed to fetch schedules");
    return unwrapList(await res.json());
  },

  async createSchedule(data: {
    officer?: string;
    farmer?: string | null;
    farm?: string | null;
    scheduled_date: string;
    notes?: string;
  }): Promise<Schedule> {
    const res = await authFetch(`${API_BASE}/api/schedules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        parseApiError(err, "Failed to create schedule", ["officer", "scheduled_date"])
      );
    }
    return res.json();
  },

  async updateSchedule(
    scheduleId: string,
    data: {
      officer?: string;
      farmer?: string | null;
      farm?: string | null;
      scheduled_date?: string;
      notes?: string;
      edit_reason?: string;
    }
  ): Promise<Schedule> {
    const res = await authFetch(`${API_BASE}/api/schedules/${scheduleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        parseApiError(err, "Failed to update schedule", ["detail", "scheduled_date", "officer", "edit_reason"])
      );
    }
    return res.json();
  },

  async getOfficers(options?: { signal?: AbortSignal }): Promise<StaffUser[]> {
    const res = await authFetch(`${API_BASE}/api/officers`, { signal: options?.signal });
    if (!res.ok) throw new Error("Failed to fetch officers");
    return unwrapList(await res.json());
  },

  /** Kenya locations (regions, counties, sub_counties). Optimized: one fetch, cache on client. */
  async getLocations(options?: { signal?: AbortSignal }): Promise<LocationsResponse> {
    const res = await authFetch(`${API_BASE}/api/locations`, { signal: options?.signal });
    if (!res.ok) throw new Error("Failed to fetch locations");
    return res.json();
  },

  /** Option sets for forms (departments, staff_roles). Single source of truth from backend. */
  async getOptions(options?: { signal?: AbortSignal }): Promise<OptionsResponse> {
    const res = await authFetch(`${API_BASE}/api/options`, { signal: options?.signal });
    if (!res.ok) throw new Error("Failed to fetch options");
    return res.json();
  },

  async getStaff(options?: { signal?: AbortSignal }): Promise<StaffUser[]> {
    const res = await authFetch(`${API_BASE}/api/staff`, { signal: options?.signal });
    if (!res.ok) throw new Error("Failed to fetch staff");
    return unwrapList(await res.json());
  },

  async getStaffById(staffId: string, options?: { signal?: AbortSignal }): Promise<StaffUser> {
    const res = await authFetch(`${API_BASE}/api/staff/${encodeURIComponent(staffId)}`, { signal: options?.signal });
    if (!res.ok) {
      if (res.status === 403) throw new Error("Only admins can view staff details.");
      if (res.status === 404) throw new Error("Staff member not found.");
      throw new Error("Failed to fetch staff");
    }
    return res.json();
  },

  async getStaffPerformance(options?: { signal?: AbortSignal }): Promise<StaffPerformanceUser[]> {
    const res = await authFetch(`${API_BASE}/api/staff/performance`, { signal: options?.signal });
    if (!res.ok) {
      if (res.status === 403) throw new Error("Only admins can view staff performance.");
      throw new Error("Failed to fetch staff performance");
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  async registerStaff(data: {
    email: string;
    role: "supervisor" | "officer";
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    phone?: string;
    department?: string;
    region_id?: number | null;
    county_id?: number | null;
    sub_county_id?: number | null;
  }): Promise<StaffUser> {
    const res = await authFetch(`${API_BASE}/api/staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        parseApiError(err, "Failed to register staff", ["email", "role"])
      );
    }
    return res.json();
  },

  async updateStaff(
    staffId: string,
    data: {
      is_active?: boolean;
      department?: string;
      region_id?: number | null;
      county_id?: number | null;
      sub_county_id?: number | null;
    }
  ): Promise<StaffUser> {
    const res = await authFetch(`${API_BASE}/api/staff/${staffId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        parseApiError(err, "Failed to update staff", ["is_active", "department", "region_id"])
      );
    }
    return res.json();
  },

  async approveSchedule(
    scheduleId: string,
    action: "accept" | "reject",
    rejectionReason?: string
  ): Promise<Schedule> {
    const body: { action: string; rejection_reason?: string } = { action };
    if (action === "reject" && rejectionReason != null) {
      body.rejection_reason = rejectionReason.trim();
    }
    const res = await authFetch(
      `${API_BASE}/api/schedules/${scheduleId}/approve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        parseApiError(err, "Failed to approve/reject schedule", ["action"])
      );
    }
    return res.json();
  },

  async getNotifications(): Promise<Notification[]> {
    const res = await authFetch(`${API_BASE}/api/notifications`);
    if (!res.ok) throw new Error("Failed to fetch notifications");
    return unwrapList(await res.json());
  },

  async getNotificationUnreadCount(): Promise<{ unread_count: number }> {
    const res = await authFetch(`${API_BASE}/api/notifications/unread-count`);
    if (!res.ok) throw new Error("Failed to fetch unread count");
    return res.json();
  },

  async markNotificationRead(id: string): Promise<Notification> {
    const res = await authFetch(`${API_BASE}/api/notifications/${id}/read`, {
      method: "PATCH",
    });
    if (!res.ok) throw new Error("Failed to mark notification read");
    return res.json();
  },

  async markAllNotificationsRead(): Promise<{ marked_count: number }> {
    const res = await authFetch(`${API_BASE}/api/notifications/mark-all-read`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to mark all read");
    return res.json();
  },

  async archiveNotification(id: string): Promise<void> {
    const res = await authFetch(`${API_BASE}/api/notifications/${id}/archive`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to archive notification");
  },

  async resendStaffCredentials(staffId: string): Promise<{ detail: string }> {
    const res = await authFetch(
      `${API_BASE}/api/staff/${staffId}/resend-credentials`,
      { method: "POST" }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        (data.detail as string) || "Failed to resend credentials"
      );
    }
    return data as { detail: string };
  },

  async resetStaffDevice(staffId: string): Promise<{ detail: string }> {
    const res = await authFetch(
      `${API_BASE}/api/staff/${staffId}/reset-device`,
      { method: "POST" }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        (data.detail as string) || "Failed to reset staff device"
      );
    }
    return data as { detail: string };
  },

  async changePassword(data: {
    current_password: string;
    new_password: string;
  }): Promise<{ user: AuthUser }> {
    const res = await authFetch(`${API_BASE}/api/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        parseApiError(err, "Failed to change password", [
          "current_password",
          "new_password",
        ])
      );
    }
    const json = await res.json();
    return { user: json.user };
  },
};

export function photoUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const baseUrl = base.replace(/\/api\/?$/, "");
  return path.startsWith("/") ? `${baseUrl}${path}` : `${baseUrl}/${path}`;
}
