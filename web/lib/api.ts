import type {
  Farmer,
  Farm,
  Visit,
  DashboardStats,
  UserRole,
  Schedule,
  StaffUser,
  Notification,
  LocationsResponse,
  OptionsResponse,
} from "./types";
import { parseApiError } from "./api-utils";

const API_BASE = "";

const defaultCredentials: RequestCredentials = "include";

/** Support both DRF paginated ({ results: T[] }) and raw list responses. */
function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : (data.results ?? []);
}

async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: options.credentials ?? defaultCredentials,
  });
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

  async getFarmers(): Promise<Farmer[]> {
    const res = await authFetch(`${API_BASE}/api/farmers`);
    if (!res.ok) throw new Error("Failed to fetch farmers");
    return unwrapList(await res.json());
  },

  async createFarmer(data: {
    first_name: string;
    middle_name?: string;
    last_name: string;
    phone?: string;
    latitude: number;
    longitude: number;
    crop_type?: string;
    assigned_officer?: string;
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

  async getFarms(farmerId?: string | null): Promise<Farm[]> {
    const url = farmerId
      ? `${API_BASE}/api/farms?farmer=${encodeURIComponent(farmerId)}`
      : `${API_BASE}/api/farms`;
    const res = await authFetch(url);
    if (!res.ok) throw new Error("Failed to fetch farms");
    return unwrapList(await res.json());
  },

  async createFarm(data: {
    farmer_id: string;
    county_id: string;
    sub_county_id: string;
    village: string;
    latitude: number;
    longitude: number;
    plot_size?: string;
    crop_type?: string;
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

  async getVisits(params?: { officer?: string; date?: string; department?: string }): Promise<Visit[]> {
    const search = new URLSearchParams();
    if (params?.officer) search.set("officer", params.officer);
    if (params?.date) search.set("date", params.date);
    if (params?.department) search.set("department", params.department);
    const qs = search.toString();
    const url = qs ? `${API_BASE}/api/visits?${qs}` : `${API_BASE}/api/visits`;
    const res = await authFetch(url);
    if (!res.ok) throw new Error("Failed to fetch visits");
    return unwrapList(await res.json());
  },

  async getDashboardStats(): Promise<DashboardStats> {
    const res = await authFetch(`${API_BASE}/api/dashboard/stats`);
    if (!res.ok) {
      if (res.status === 403)
        throw new Error("Dashboard is for admin and supervisor only.");
      throw new Error("Failed to fetch dashboard stats");
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

  async getOfficers(): Promise<StaffUser[]> {
    const res = await authFetch(`${API_BASE}/api/officers`);
    if (!res.ok) throw new Error("Failed to fetch officers");
    return unwrapList(await res.json());
  },

  /** Kenya locations (regions, counties, sub_counties). Optimized: one fetch, cache on client. */
  async getLocations(): Promise<LocationsResponse> {
    const res = await authFetch(`${API_BASE}/api/locations`);
    if (!res.ok) throw new Error("Failed to fetch locations");
    return res.json();
  },

  /** Option sets for forms (departments, staff_roles). Single source of truth from backend. */
  async getOptions(): Promise<OptionsResponse> {
    const res = await authFetch(`${API_BASE}/api/options`);
    if (!res.ok) throw new Error("Failed to fetch options");
    return res.json();
  },

  async getStaff(): Promise<StaffUser[]> {
    const res = await authFetch(`${API_BASE}/api/staff`);
    if (!res.ok) throw new Error("Failed to fetch staff");
    return unwrapList(await res.json());
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
    action: "accept" | "reject"
  ): Promise<Schedule> {
    const res = await authFetch(
      `${API_BASE}/api/schedules/${scheduleId}/approve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
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
