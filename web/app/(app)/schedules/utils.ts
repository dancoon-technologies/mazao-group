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
 * Proposed schedule is editable only if the scheduled date is more than one day
 * from today (at least 2 days ahead).
 */
export function isScheduleEditable(schedule: Schedule): boolean {
  if (schedule.status !== "proposed") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(schedule.scheduled_date + "T00:00:00");
  const diffDays = Math.floor(
    (d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
  );
  return diffDays >= 2;
}

export const INITIAL_SCHEDULE_FORM = {
  officer: "",
  farmer: "",
  farm: "",
  scheduled_date: "",
  notes: "",
} as const;

export type ScheduleFormValues = {
  officer: string;
  farmer: string;
  farm: string;
  scheduled_date: string;
  notes: string;
};
