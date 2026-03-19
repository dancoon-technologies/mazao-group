import type { Schedule } from "@/lib/types";

export function scheduleStatusColor(status: string): string {
  switch (status) {
    case "proposed":
      return "yellow";
    case "accepted":
      return "green";
    case "rejected":
      return "red";
    default:
      return "gray";
  }
}

export function scheduleStatusLabel(status: string): string {
  switch (status) {
    case "proposed":
      return "Pending";
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
}

/**
 * Proposed: editable if date is at least 2 days ahead.
 * Accepted: officer may request a change (reason + supervisor re-approval) for their own schedule.
 */
export function isScheduleEditable(
  schedule: Schedule,
  context?: {
    isOfficer?: boolean;
    officerUserId?: string | null;
    officerEmail?: string | null;
  }
): boolean {
  const isOwnAccepted =
    context?.isOfficer &&
    schedule.status === "accepted" &&
    ((context.officerUserId != null && schedule.officer === context.officerUserId) ||
      (context.officerEmail != null &&
        schedule.officer_email?.toLowerCase() === context.officerEmail.toLowerCase()));
  if (isOwnAccepted) {
    return true;
  }
  if (schedule.status !== "proposed") return false;
  return isScheduleDateAtLeastTwoDaysAhead(schedule.scheduled_date);
}

/** New proposed date must be at least one calendar days from today. */
export function isScheduleDateAtLeastTwoDaysAhead(dateYmd: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateYmd + "T00:00:00");
  const diffDays = Math.floor(
    (d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
  );
  return diffDays >= 1;
}

export const INITIAL_SCHEDULE_FORM = {
  officer: "",
  farmer: "",
  farm: "",
  scheduled_date: "",
  notes: "",
  edit_reason: "",
} as const;

export type ScheduleFormValues = {
  officer: string;
  farmer: string;
  farm: string;
  scheduled_date: string;
  notes: string;
  edit_reason: string;
};
