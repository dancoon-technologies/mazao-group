"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Box, Button, Card, Group, Modal, SegmentedControl, Stack, Tabs, Text, TextInput, Textarea, Title } from "@mantine/core";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import type { LocationReport, MaintenanceIncident, MaintenanceStatus } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { LocationMiniMap, type LocationMiniMapPoint } from "@/components/LocationMiniMap";

const STATUS_LABEL: Record<MaintenanceStatus, string> = {
  reported: "Reported",
  verified_breakdown: "Verified breakdown",
  at_garage: "Repair reported",
  released: "Acknowledged",
  rejected: "Rejected",
};

const PIN_REPORTED = "#228be6";
const PIN_GARAGE = "#6d28d9";
const MAP_CENTER: [number, number] = [-1.292066, 36.821946];

const MapView = dynamic(
  () =>
    import("@/components/tracking/TrackingMap").then((m) => ({ default: m.TrackingMap })),
  { ssr: false }
);

function mapPointsFrom(
  id: string,
  lat: number | null | undefined,
  lng: number | null | undefined,
  color: string
): LocationMiniMapPoint[] {
  if (lat == null || lng == null) return [];
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return [];
  return [{ id, latitude: la, longitude: ln, color }];
}

function IncidentLocationMaps({
  item,
  onOpenMap,
}: {
  item: MaintenanceIncident;
  onOpenMap: (title: string, points: LocationMiniMapPoint[]) => void;
}) {
  const reported = mapPointsFrom(`rep-${item.id}`, item.reported_latitude, item.reported_longitude, PIN_REPORTED);
  const garage = mapPointsFrom(`gar-${item.id}`, item.garage_latitude, item.garage_longitude, PIN_GARAGE);

  return (
    <Stack gap="sm">
      <Group>
        <Button
          variant="light"
          size="xs"
          onClick={() => onOpenMap("Incident location", reported)}
        >
          Incident location
        </Button>
        <Button
          variant="light"
          size="xs"
          onClick={() => onOpenMap("Garage location", garage)}
        >
          Garage location
        </Button>
      </Group>
    </Stack>
  );
}

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
  const [mapModal, setMapModal] = useState<{ title: string; points: LocationMiniMapPoint[] } | null>(null);

  const [previewCoords, setPreviewCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

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

  const refreshPreviewLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocError("Geolocation is not available in this browser.");
      setPreviewCoords(null);
      return;
    }
    setLocLoading(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPreviewCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocLoading(false);
      },
      () => {
        setLocError("Could not get location. Allow access in the browser and tap Refresh.");
        setPreviewCoords(null);
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    if (isOfficer) refreshPreviewLocation();
  }, [isOfficer, refreshPreviewLocation]);

  const officerPreviewPoints = useMemo((): LocationMiniMapPoint[] => {
    if (!previewCoords) return [];
    return [
      {
        id: "preview-gps",
        latitude: previewCoords.latitude,
        longitude: previewCoords.longitude,
        color: PIN_REPORTED,
      },
    ];
  }, [previewCoords]);

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
      if (!isSupervisor && !isOfficer) return;
      setSubmitting(true);
      try {
        const payload: Parameters<typeof api.updateMaintenanceIncident>[1] = {
          status,
          supervisor_notes: isSupervisor ? supervisorNotes[incident.id]?.trim() || undefined : undefined,
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
    [getCoords, isOfficer, isSupervisor, load, supervisorNotes]
  );

  const openIncidents = useMemo(
    () => items.filter((x) => x.status !== "released" && x.status !== "rejected"),
    [items]
  );
  const recordsIncidents = useMemo(
    () => items.filter((x) => x.status === "released" || x.status === "rejected"),
    [items]
  );

  const openLocationModal = useCallback((title: string, points: LocationMiniMapPoint[]) => {
    if (points.length === 0) {
      setFlash({ color: "red", message: `${title} is not available for this incident yet.` });
      return;
    }
    setMapModal({ title, points });
  }, []);

  return (
    <Stack>
      <Modal
        opened={mapModal != null}
        onClose={() => setMapModal(null)}
        title={mapModal?.title ?? "Location"}
        centered
        size="lg"
      >
        {mapModal ? (
          <Stack gap="sm">
            <Box style={{ overflow: "hidden", borderRadius: 12, border: "1px solid var(--mantine-color-gray-3)" }}>
              <MapView
                reports={mapModal.points.map<LocationReport>((p, i) => ({
                  id: i + 1,
                  user_id: p.id,
                  user_email: "maintenance@location.local",
                  user_display_name: mapModal.title,
                  reported_at: new Date().toISOString(),
                  latitude: p.latitude,
                  longitude: p.longitude,
                  accuracy: null,
                  battery_percent: null,
                  device_info: {},
                  created_at: new Date().toISOString(),
                }))}
                center={mapModal.points[0] ? [mapModal.points[0].latitude, mapModal.points[0].longitude] : MAP_CENTER}
                zoom={15}
                singleUserPathMode={false}
              />
            </Box>
            <LocationMiniMap points={mapModal.points} height={180} title={mapModal.title} />
            <Text size="xs" c="dimmed">
              Lat: {mapModal.points[0].latitude.toFixed(6)} · Lng: {mapModal.points[0].longitude.toFixed(6)}
            </Text>
          </Stack>
        ) : null}
      </Modal>
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
            <Group justify="space-between" align="center" wrap="nowrap">
              <Text fw={600} size="sm">
                Location
              </Text>
              <Button variant="light" size="xs" onClick={refreshPreviewLocation} loading={locLoading}>
                Refresh
              </Button>
            </Group>
            {locLoading && !previewCoords ? (
              <Text size="sm" c="dimmed">
                Getting location…
              </Text>
            ) : null}
            {locError ? (
              <Text size="sm" c="red">
                {locError}
              </Text>
            ) : null}
            {officerPreviewPoints.length > 0 ? (
              <LocationMiniMap
                points={officerPreviewPoints}
                height={140}
                title="Your location"
                subtitle="Where this report will be pinned"
                aria-label={
                  previewCoords
                    ? `Map preview at ${previewCoords.latitude.toFixed(5)}, ${previewCoords.longitude.toFixed(5)}`
                    : undefined
                }
              />
            ) : !locLoading && !locError ? (
              <Text size="sm" c="dimmed">
                No GPS fix yet — tap Refresh
              </Text>
            ) : null}
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
              Report issue
            </Button>
          </Stack>
        </Card>
      ) : null}

      <Tabs defaultValue="open">
        <Tabs.List>
          <Tabs.Tab value="open">Open incidents ({openIncidents.length})</Tabs.Tab>
          <Tabs.Tab value="records">Records ({recordsIncidents.length})</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="open" pt="md">
          <Stack>
            {openIncidents.length === 0 ? (
              <Card withBorder>
                <Text size="sm" c="dimmed">
                  No open maintenance incidents.
                </Text>
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
                  <IncidentLocationMaps item={item} onOpenMap={openLocationModal} />

                  {isOfficer && item.status === "reported" ? (
                    <Text size="sm" c="dimmed">
                      Wait for your supervisor to verify the breakdown before you can report repair at the garage.
                    </Text>
                  ) : null}

                  {isOfficer && item.status === "verified_breakdown" ? (
                    <Group>
                      <Button variant="light" onClick={() => updateIncident(item, "at_garage")} loading={submitting}>
                        Report fixing / at garage
                      </Button>
                    </Group>
                  ) : null}

                  {isSupervisor ? (
                    <Box>
                      {item.status === "reported" || item.status === "at_garage" ? (
                        <TextInput
                          label="Supervisor notes"
                          value={supervisorNotes[item.id] ?? ""}
                          onChange={(e) => setSupervisorNotes((prev) => ({ ...prev, [item.id]: e.currentTarget.value }))}
                        />
                      ) : null}
                      <Group mt="sm">
                        {item.status === "reported" ? (
                          <>
                            <Button onClick={() => updateIncident(item, "verified_breakdown")} loading={submitting}>
                              Verify breakdown
                            </Button>
                            <Button color="red" variant="light" onClick={() => updateIncident(item, "rejected")} loading={submitting}>
                              Reject
                            </Button>
                          </>
                        ) : null}
                        {item.status === "at_garage" ? (
                          <>
                            <Button onClick={() => updateIncident(item, "released")} loading={submitting}>
                              Acknowledge issue
                            </Button>
                            <Button color="red" variant="light" onClick={() => updateIncident(item, "rejected")} loading={submitting}>
                              Reject
                            </Button>
                          </>
                        ) : null}
                      </Group>
                      {item.status === "verified_breakdown" ? (
                        <Text size="sm" c="dimmed" mt="sm">
                          Waiting for the officer to report repair at the garage.
                        </Text>
                      ) : null}
                    </Box>
                  ) : null}
                </Stack>
              </Card>
            ))}
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="records" pt="md">
          <Stack>
            {recordsIncidents.length === 0 ? (
              <Card withBorder>
                <Text size="sm" c="dimmed">
                  No released/rejected records yet.
                </Text>
              </Card>
            ) : null}
            {recordsIncidents.map((item) => (
              <Card key={item.id} withBorder>
                <Stack>
                  <Group justify="space-between">
                    <Text fw={600}>
                      {(item.officer_display_name || item.officer_email || "Officer")} · {item.vehicle_type}
                    </Text>
                    <Badge color={item.status === "released" ? "green" : "red"}>
                      {STATUS_LABEL[item.status]}
                    </Badge>
                  </Group>
                  <Text size="sm">{item.issue_description}</Text>
                  {item.supervisor_notes ? (
                    <Text size="sm" c="dimmed">
                      Supervisor notes: {item.supervisor_notes}
                    </Text>
                  ) : null}
                  <IncidentLocationMaps item={item} onOpenMap={openLocationModal} />
                </Stack>
              </Card>
            ))}
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
