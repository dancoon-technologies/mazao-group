"use client";

import { ActionIcon, Badge, Box, Group, Menu, ScrollArea, Text } from "@mantine/core";
import { IconArchive, IconBell, IconCheck } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Notification } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

const POLL_VISIBLE_MS = 30_000;

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [opened, setOpened] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const prevUnreadRef = useRef<number>(0);
  const hasFetchedOnceRef = useRef(false);
  const mountedRef = useRef(true);
  const notificationsRef = useRef<Notification[]>([]);
  notificationsRef.current = notifications;

  const fetchNotifications = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const [list, countRes] = await Promise.all([
        api.getNotifications(),
        api.getNotificationUnreadCount(),
      ]);
      if (!mountedRef.current) return;
      const unread_count = typeof countRes?.unread_count === "number" ? countRes.unread_count : 0;
      const prev = prevUnreadRef.current;
      prevUnreadRef.current = unread_count;
      setNotifications(Array.isArray(list) ? list : []);
      setUnreadCount(unread_count);
      if (hasFetchedOnceRef.current && unread_count > prev && list.length > 0) {
        const latest = list[0];
        toast.info(latest?.title ?? "Notification", { description: latest?.message ?? "" });
      }
      hasFetchedOnceRef.current = true;
    } catch {
      // ignore
    }
  }, []);

  const markRead = useCallback(async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      toast.error("Failed to mark as read");
    }
  }, []);

  const markAllRead = useCallback(async () => {
    if (unreadCount === 0) return;
    setMarkingAll(true);
    try {
      const { marked_count } = await api.markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
      );
      setUnreadCount(0);
      if (marked_count > 0) toast.success(`Marked ${marked_count} as read`);
    } catch {
      toast.error("Failed to mark all as read");
    } finally {
      setMarkingAll(false);
    }
  }, [unreadCount]);

  const archive = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setArchivingId(id);
    try {
      await api.archiveNotification(id);
      const removed = notificationsRef.current.find((n) => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (removed?.read_at == null) setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      toast.error("Failed to archive");
    } finally {
      setArchivingId(null);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchNotifications();
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchNotifications();
      }
    }, POLL_VISIBLE_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchNotifications();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    if (opened) fetchNotifications();
  }, [opened, fetchNotifications]);

  return (
    <Menu
      position="bottom-end"
      width={360}
      shadow="md"
      closeOnItemClick={false}
      opened={opened}
      onChange={setOpened}
    >
      <Menu.Target>
        <Box style={{ position: "relative" }}>
          <ActionIcon variant="subtle" color="dark" size="lg" aria-label="Notifications">
            <IconBell size={22} />
          </ActionIcon>
          {unreadCount > 0 && (
            <Badge
              size="sm"
              circle
              variant="filled"
              color="green"
              style={{ position: "absolute", top: 2, right: 2, minWidth: 18, fontSize: 10 }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Box>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Notifications</Menu.Label>
        {unreadCount > 0 && (
          <Menu.Item
            closeMenuOnClick={false}
            onClick={markAllRead}
            leftSection={<IconCheck size={16} />}
            disabled={markingAll}
          >
            {markingAll ? "Marking…" : "Mark all as read"}
          </Menu.Item>
        )}
        <ScrollArea.Autosize mah={320} type="scroll">
          {notifications.length === 0 ? (
            <Text size="sm" c="dimmed" p="sm">
              No notifications
            </Text>
          ) : (
            notifications.map((n) => (
              <Menu.Item
                key={n.id}
                onClick={() => !n.read_at && markRead(n.id)}
                bg={n.read_at ? undefined : "var(--mantine-color-green-0)"}
                style={{
                  whiteSpace: "normal",
                  borderLeft: n.read_at
                    ? undefined
                    : "3px solid var(--mantine-color-green-6)",
                }}
              >
                <Group wrap="nowrap" justify="space-between" align="flex-start" gap="xs">
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={n.read_at ? 400 : 600}>
                      {n.title}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={2} mt={2}>
                      {n.message}
                    </Text>
                    <Text size="xs" c="dimmed" mt={4}>
                      {n.created_at ? formatDateTime(n.created_at) : "—"}
                    </Text>
                  </Box>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    aria-label="Archive"
                    loading={archivingId === n.id}
                    onClick={(e) => archive(n.id, e)}
                  >
                    <IconArchive size={14} />
                  </ActionIcon>
                </Group>
              </Menu.Item>
            ))
          )}
        </ScrollArea.Autosize>
      </Menu.Dropdown>
    </Menu>
  );
}
