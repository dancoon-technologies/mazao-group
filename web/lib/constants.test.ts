import { describe, it, expect } from "vitest";
import {
  ROUTES,
  ROLES,
  ROLES_CAN_ACCESS_DASHBOARD,
  ROLES_TRACKING,
  ROLES_STAFF_PAGE,
  ROLES_SCHEDULES_PAGE,
  DASHBOARD_VISITS_DAYS_MIN,
  DASHBOARD_VISITS_DAYS_MAX,
  DASHBOARD_VISITS_DAYS_DEFAULT,
  DASHBOARD_DAY_OPTIONS,
} from "./constants";

describe("ROUTES", () => {
  it("has expected paths", () => {
    expect(ROUTES.LOGIN).toBe("/login");
    expect(ROUTES.DASHBOARD).toBe("/dashboard");
    expect(ROUTES.FARMERS).toBe("/farmers");
    expect(ROUTES.VISITS).toBe("/visits");
    expect(ROUTES.TRACKING).toBe("/tracking");
    expect(ROUTES.CHANGE_PASSWORD).toBe("/change-password");
  });
});

describe("ROLES", () => {
  it("matches backend role values", () => {
    expect(ROLES.ADMIN).toBe("admin");
    expect(ROLES.SUPERVISOR).toBe("supervisor");
    expect(ROLES.OFFICER).toBe("officer");
  });
});

describe("ROLES_CAN_ACCESS_DASHBOARD", () => {
  it("includes admin and supervisor only", () => {
    expect(ROLES_CAN_ACCESS_DASHBOARD).toContain(ROLES.ADMIN);
    expect(ROLES_CAN_ACCESS_DASHBOARD).toContain(ROLES.SUPERVISOR);
    expect(ROLES_CAN_ACCESS_DASHBOARD).not.toContain(ROLES.OFFICER);
    expect(ROLES_CAN_ACCESS_DASHBOARD).toHaveLength(2);
  });
});

describe("ROLES_TRACKING", () => {
  it("includes admin and supervisor", () => {
    expect(ROLES_TRACKING).toContain(ROLES.ADMIN);
    expect(ROLES_TRACKING).toContain(ROLES.SUPERVISOR);
    expect(ROLES_TRACKING).not.toContain(ROLES.OFFICER);
  });
});

describe("ROLES_STAFF_PAGE", () => {
  it("is admin only", () => {
    expect(ROLES_STAFF_PAGE).toEqual([ROLES.ADMIN]);
  });
});

describe("ROLES_SCHEDULES_PAGE", () => {
  it("includes all three roles", () => {
    expect(ROLES_SCHEDULES_PAGE).toContain(ROLES.ADMIN);
    expect(ROLES_SCHEDULES_PAGE).toContain(ROLES.SUPERVISOR);
    expect(ROLES_SCHEDULES_PAGE).toContain(ROLES.OFFICER);
  });
});

describe("DASHBOARD day range", () => {
  it("has sensible min/max/default", () => {
    expect(DASHBOARD_VISITS_DAYS_MIN).toBe(7);
    expect(DASHBOARD_VISITS_DAYS_MAX).toBe(90);
    expect(DASHBOARD_VISITS_DAYS_DEFAULT).toBe(14);
    expect(DASHBOARD_VISITS_DAYS_DEFAULT).toBeGreaterThanOrEqual(
      DASHBOARD_VISITS_DAYS_MIN
    );
    expect(DASHBOARD_VISITS_DAYS_DEFAULT).toBeLessThanOrEqual(
      DASHBOARD_VISITS_DAYS_MAX
    );
  });

  it("day options include 7, 14, 30", () => {
    const values = DASHBOARD_DAY_OPTIONS.map((o) => o.value);
    expect(values).toContain("7");
    expect(values).toContain("14");
    expect(values).toContain("30");
  });
});
