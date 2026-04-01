"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Box, Button, Card, Group, SegmentedControl, Stack, Text, TextInput, Textarea, Title } from "@mantine/core";
import { api } from "@/lib/api";
import type { MaintenanceIncident, MaintenanceStatus } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";

const STATUS_LABEL: Record<MaintenanceStatus, string> = {
  reported: "Reported",
  verified_breakdown: "Verified breakdown",
  at_garage: "At garage",
  approved: "Approved",
  rejected: "Rejected",
};

export default function MaintenancePage() {
  const { role } = useAuth();
  const isOfficer = role === "officer";
  const isSupervisor = role === "supervisor" || role === "admin";
  const [items, setItems] = useState<MaintenanceIncident[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState<{ color: "red" | "green"; message: string } | null>(null);
  const [vehicleType, setVehicleType] = useState<"motorbike" | "car" | "other">("motorbike");
  const [issueDescription, setIssueDescription] = useState("");
  const [supervisorNotes, setSupervisorNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.getMaintenanceIncidents();
      setItems(list);
    } catch (e) {
      setFlash({ color: "red", message: e instanceof Error ? e.message : "Failed to load maintenance incidents" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const getCoords = useCallback(async (): Promise<{ latitude: number; longitude: number }> => {
    if (!navigator.geolocation) throw new Error("Geolocation is not available in this browser.");
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => reject(new Error("Could not get location.")),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }, []);

  const submitIncident = useCallback(async () => {
    if (!isOfficer) return;
    if (!issueDescription.trim()) {
      setFlash({ color: "red", message: "Issue description is required." });
      return;
    }
    setSubmitting(true);
    try {
      const coords = await getCoords();
      await api.createMaintenanceIncident({
        vehicle_type: vehicleType,
        issue_description: issueDescription.trim(),
        reported_latitude: coords.latitude,
        reported_longitude: coords.longitude,
      });
      setIssueDescription("");
      setFlash({ color: "green", message: "Maintenance incident submitted." });
      await load();
    } catch (e) {
      setFlash({ color: "red", message: e instanceof Error ? e.message : "Failed to submit incident." });
    } finally {
      setSubmitting(false);
    }
  }, [getCoords, isOfficer, issueDescription, load, vehicleType]);

  const updateIncident = useCallback(
    async (incident: MaintenanceIncident, status: MaintenanceStatus) => {
      if (!isSupervisor) return;
      setSubmitting(true);
      try {
        const payload: Parameters<typeof api.updateMaintenanceIncident>[1] = {
          status,
          supervisor_notes: supervisorNotes[incident.id]?.trim() || undefined,
        };
        if (status === "verified_breakdown") {
          const coords = await getCoords();
          payload.breakdown_verified_latitude = coords.latitude;
          payload.breakdown_verified_longitude = coords.longitude;
        }
        if (status === "at_garage") {
          const coords = await getCoords();
          payload.garage_latitude = coords.latitude;
          payload.garage_longitude = coords.longitude;
        }
        await api.updateMaintenanceIncident(incident.id, payload);
        setFlash({ color: "green", message: `Incident marked ${STATUS_LABEL[status]}.` });
        await load();
      } catch (e) {
        setFlash({ color: "red", message: e instanceof Error ? e.message : "Failed to update incident." });
      } finally {
        setSubmitting(false);
      }
    },
    [getCoords, isSupervisor, load, supervisorNotes]
  );

  const openIncidents = useMemo(
    () => items.filter((x) => x.status !== "approved" && x.status !== "rejected"),
    [items]
  );

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Maintenance</Title>
        <Button variant="light" onClick={load} loading={loading}>
          Refresh
        </Button>
      </Group>
      {flash ? (
        <Alert color={flash.color} onClose={() => setFlash(null)} withCloseButton>
          {flash.message}
        </Alert>
      ) : null}

      {isOfficer ? (
        <Card withBorder>
          <Stack>
            <Text fw={600}>Report breakdown</Text>
            <SegmentedControl
              value={vehicleType}
              onChange={(v) => setVehicleType(v as "motorbike" | "car" | "other")}
              data={[
                { value: "motorbike", label: "Motorbike" },
                { value: "car", label: "Car" },
                { value: "other", label: "Other" },
              ]}
            />
            <Textarea
              label="Issue description"
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.currentTarget.value)}
              minRows={3}
              placeholder="Describe the issue"
            />
            <Button onClick={submitIncident} loading={submitting}>
              Submit with current GPS
            </Button>
          </Stack>
        </Card>
      ) : null}

      {openIncidents.map((item) => (
        <Card key={item.id} withBorder>
          <Stack>
            <Group justify="space-between">
              <Text fw={600}>
                {(item.officer_display_name || item.officer_email || "Officer")} · {item.vehicle_type}
              </Text>
              <Badge>{STATUS_LABEL[item.status]}</Badge>
            </Group>
            <Text size="sm">{item.issue_description}</Text>
            <Text size="xs" c="dimmed">
              Reported GPS: {item.reported_latitude ?? "—"}, {item.reported_longitude ?? "—"}
            </Text>
            <Text size="xs" c="dimmed">
              Verified GPS: {item.breakdown_verified_latitude ?? "—"}, {item.breakdown_verified_longitude ?? "—"}
            </Text>
            <Text size="xs" c="dimmed">
              Garage GPS: {item.garage_latitude ?? "—"}, {item.garage_longitude ?? "—"}
            </Text>

            {isSupervisor ? (
              <Box>
                <TextInput
                  label="Supervisor notes"
                  value={supervisorNotes[item.id] ?? ""}
                  onChange={(e) => setSupervisorNotes((prev) => ({ ...prev, [item.id]: e.currentTarget.value }))}
                />
                <Group mt="sm">
                  {item.status === "reported" ? (
                    <Button variant="light" onClick={() => updateIncident(item, "verified_breakdown")} loading={submitting}>
                      Verify breakdown (GPS)
                    </Button>
                  ) : null}
                  {item.status === "verified_breakdown" ? (
                    <Button variant="light" onClick={() => updateIncident(item, "at_garage")} loading={submitting}>
                      Mark at garage (GPS)
                    </Button>
                  ) : null}
                  {item.status === "at_garage" ? (
                    <>
                      <Button onClick={() => updateIncident(item, "approved")} loading={submitting}>
                        Approve
                      </Button>
                      <Button color="red" variant="light" onClick={() => updateIncident(item, "rejected")} loading={submitting}>
                        Reject
                      </Button>
                    </>
                  ) : null}
                </Group>
              </Box>
            ) : null}
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
