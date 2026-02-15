import type {
  Farmer,
  Visit,
  DashboardStats,
  UserRole,
  Schedule,
  StaffUser,
  Notification,
} from "./types";
import { parseApiError } from "./api-utils";

const API_BASE = "";

const defaultCredentials: RequestCredentials = "include";

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
    return res.json();
  },

  async createFarmer(data: {
    title?: string;
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

  async getVisits(params?: { officer?: string; date?: string }): Promise<Visit[]> {
    const search = new URLSearchParams();
    if (params?.officer) search.set("officer", params.officer);
    if (params?.date) search.set("date", params.date);
    const qs = search.toString();
    const url = qs ? `${API_BASE}/api/visits?${qs}` : `${API_BASE}/api/visits`;
    const res = await authFetch(url);
    if (!res.ok) throw new Error("Failed to fetch visits");
    return res.json();
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

  async getSchedules(): Promise<Schedule[]> {
    const res = await authFetch(`${API_BASE}/api/schedules`);
    if (!res.ok) throw new Error("Failed to fetch schedules");
    return res.json();
  },

  async createSchedule(data: {
    officer: string;
    farmer?: string | null;
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
        parseApiError(err, "Failed to create schedule", ["officer"])
      );
    }
    return res.json();
  },

  async getOfficers(): Promise<StaffUser[]> {
    const res = await authFetch(`${API_BASE}/api/officers`);
    if (!res.ok) throw new Error("Failed to fetch officers");
    return res.json();
  },

  async getStaff(): Promise<StaffUser[]> {
    const res = await authFetch(`${API_BASE}/api/staff`);
    if (!res.ok) throw new Error("Failed to fetch staff");
    return res.json();
  },

  async registerStaff(data: {
    email: string;
    role: "supervisor" | "officer";
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    phone?: string;
    region?: string;
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

  async getNotifications(): Promise<Notification[]> {
    const res = await authFetch(`${API_BASE}/api/notifications`);
    if (!res.ok) throw new Error("Failed to fetch notifications");
    return res.json();
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
