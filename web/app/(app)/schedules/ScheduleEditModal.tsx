"use client";

import type { Schedule, Farmer, Farm } from "@/lib/types";
import type { ScheduleFormValues } from "./utils";
import {
  Alert,
  Box,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";

export interface ScheduleEditModalProps {
  schedule: Schedule | null;
  isAdminOrSupervisor: boolean;
  officerOptions: { value: string; label: string }[];
  form: ScheduleFormValues;
  updateField: (field: keyof ScheduleFormValues, value: string) => void;
  selectedFarmer: Farmer | undefined;
  selectedFarm: Farm | undefined;
  formError: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onOpenFarmerModal: () => void;
  onOpenFarmModal: () => void;
  partnerLabel?: string;
  locationLabel?: string;
}

export function ScheduleEditModal({
  schedule,
  isAdminOrSupervisor,
  officerOptions,
  form,
  updateField,
  selectedFarmer,
  selectedFarm,
  formError,
  submitting,
  onClose,
  onSubmit,
  onOpenFarmerModal,
  onOpenFarmModal,
  partnerLabel = "Farmer",
  locationLabel = "Farm",
}: ScheduleEditModalProps) {
  return (
    <Modal
      opened={schedule !== null}
      onClose={onClose}
      title="Request schedule change"
      size="md"
    >
      {schedule && (
        <Text size="sm" c="dimmed" mb="md">
          You can change the proposed visit only when it is more than one day
          away.
        </Text>
      )}
      <form onSubmit={onSubmit}>
        <Stack gap="md">
          {formError && (
            <Alert color="red" variant="light">
              {formError}
            </Alert>
          )}
          {isAdminOrSupervisor && schedule && (
            <Select
              label="Extension officer"
              placeholder="Select officer"
              data={officerOptions}
              value={form.officer || null}
              onChange={(v) => updateField("officer", v ?? "")}
            />
          )}
          <Box>
            <Text size="sm" fw={500} mb={4}>
              {partnerLabel} (optional)
            </Text>
            <Button variant="light" fullWidth onClick={onOpenFarmerModal}>
              {selectedFarmer
                ? `${selectedFarmer.display_name}${selectedFarmer.phone ? ` · ${selectedFarmer.phone}` : ""}`
                : `Select ${partnerLabel.toLowerCase()}`}
            </Button>
          </Box>
          {form.farmer && (
            <Box>
              <Text size="sm" fw={500} mb={4}>
                {locationLabel} (optional)
              </Text>
              <Button variant="light" fullWidth onClick={onOpenFarmModal}>
                {selectedFarm
                  ? selectedFarm.village
                  : `Select ${locationLabel.toLowerCase()}`}
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
            <Button type="submit" color="blue" loading={submitting}>
              {submitting ? "Saving…" : "Save changes"}
            </Button>
            <Button type="button" variant="default" onClick={onClose}>
              Cancel
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
