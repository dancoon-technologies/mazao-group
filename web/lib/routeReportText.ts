/** Human-readable remarks from route report_data (aligned with mobile route-report). */

function toText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function reportDataToRemarks(data?: Record<string, unknown> | null): string {
  if (!data || typeof data !== "object") return "";
  const d = data as Record<string, unknown>;
  const direct = toText(d.remarks).trim();
  if (direct) return direct;

  const parts: string[] = [];
  const push = (title: string, ...keys: string[]) => {
    for (const key of keys) {
      const v = toText(d[key]).trim();
      if (v) {
        parts.push(`${title}\n${v}`);
        return;
      }
    }
  };
  push("Summary", "summary");
  push("Challenges", "challenges", "issues");
  push("Next actions", "next_actions", "next_steps");
  push("Farmer feedback", "farmer_feedback", "farmers_feedback_summary");
  push("Notes", "notes");
  const crop = toText(d.crop_stages_summary).trim();
  if (crop) parts.push(`Crop stages (from visits)\n${crop}`);
  const fb = toText(d.farmers_feedback_summary).trim();
  if (fb) parts.push(`Farmer feedback (from visits)\n${fb}`);
  return parts.join("\n\n");
}
