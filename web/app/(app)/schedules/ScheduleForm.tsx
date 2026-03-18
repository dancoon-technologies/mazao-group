"use client";

import type { Farmer, Farm } from "@/lib/types";
import type { ScheduleFormValues } from "./utils";
import {
  Alert,
  Box,
  Button,
  Group,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";

export type SchedulePartnerType = "farmer" | "stockist";

export interface ScheduleFormProps {
  /** Whether the current user is an officer (proposing) vs admin/supervisor (creating). */
  isOfficer: boolean;
  isAdminOrSupervisor: boolean;
  officerOptions: { value: string; label: string }[];
  form: ScheduleFormValues;
  updateField: (field: keyof ScheduleFormValues, value: string) => void;
  selectedFarmer: Farmer | undefined;
  selectedFarm: Farm | undefined;
  formError: string;
  submitting: boolean;
  partnerType: SchedulePartnerType;
  onPartnerTypeChange: (type: SchedulePartnerType) => void;
  onOpenFarmerModal: () => void;
  onOpenFarmModal: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  partnerLabel?: string;
  locationLabel?: string;
}

export function ScheduleForm({
  isOfficer,
  isAdminOrSupervisor,
  officerOptions,
  form,
  updateField,
  selectedFarmer,
  selectedFarm,
  formError,
  submitting,
  partnerType,
  onPartnerTypeChange,
  onOpenFarmerModal,
  onOpenFarmModal,
  onSubmit,
  onCancel,
  partnerLabel = "Farmer",
  locationLabel = "Farm",
}: ScheduleFormProps) {
  const isStockist = partnerType === "stockist";
  const displayPartnerLabel = isStockist ? "Stockist" : "Farmer";
  const displayLocationLabel = isStockist ? "Outlet" : "Farm";

  return (
    <Paper mt="md" p="md" radius="md" shadow="sm" withBorder>
      <Text size="lg" fw={600} mb="md">
        {isOfficer ? "Propose visit schedule" : "New schedule"}
      </Text>
      <Text size="sm" c="dimmed" mb="md">
        {isOfficer
          ? "Your proposal will be sent to your supervisor for approval."
          : "The officer will be notified. Schedule is created as accepted."}
      </Text>
      <form onSubmit={onSubmit}>
        <Stack gap="md">
          {formError && (
            <Alert color="red" variant="light">
              {formError}
            </Alert>
          )}
          {isAdminOrSupervisor && (
            <Select
              label="Extension officer"
              required
              placeholder="Select officer"
              data={officerOptions}
              value={form.officer || null}
              onChange={(v) => updateField("officer", v ?? "")}
            />
          )}
          <Box>
            <Text size="sm" fw={500} mb={4}>
              Partner type
            </Text>
            <SegmentedControl
              value={partnerType}
              onChange={(v) => onPartnerTypeChange(v as SchedulePartnerType)}
              data={[
                { label: "Farmer", value: "farmer" },
                { label: "Stockist", value: "stockist" },
              ]}
              mb="sm"
            />
          </Box>
          <Box>
            <Text size="sm" fw={500} mb={4}>
              {displayPartnerLabel} (optional)
            </Text>
            {isOfficer && (
              <Text size="xs" c="dimmed" mb="xs">
                Optional: link this visit to one of your assigned {displayPartnerLabel.toLowerCase()}s.
              </Text>
            )}
            <Button variant="light" fullWidth onClick={onOpenFarmerModal}>
              {selectedFarmer
                ? `${selectedFarmer.display_name}${selectedFarmer.phone ? ` · ${selectedFarmer.phone}` : ""}`
                : `Select ${displayPartnerLabel.toLowerCase()}`}
            </Button>
          </Box>
          {form.farmer && (
            <Box>
              <Text size="sm" fw={500} mb={4}>
                {displayLocationLabel} (optional)
              </Text>
              <Button variant="light" fullWidth onClick={onOpenFarmModal}>
                {selectedFarm
                  ? `${selectedFarm.village}${selectedFarm.crop_type ? ` · ${selectedFarm.crop_type}` : ""}`
                  : `Select ${displayLocationLabel.toLowerCase()}`}
              </Button>
            </Box>
          )}
          <DateInput
            label="Scheduled date"
            placeholder="Pick date"
            value={form.scheduled_date || null}
            onChange={(value) => updateField("scheduled_date", value ?? "")}
            valueFormat="YYYY-MM-DD"
            required
            clearable
          />
          <Textarea
            label="Notes"
            placeholder="Optional notes"
            value={form.notes}
            onChange={(e) => updateField("notes", e.target.value)}
          />
          <Group>
            <Button type="submit" color="green" loading={submitting}>
              {submitting
                ? "Saving…"
                : isOfficer
                  ? "Propose schedule"
                  : "Create schedule"}
            </Button>
            <Button type="button" variant="default" onClick={onCancel}>
              Cancel
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
