"use client";

import {
  Alert,
  Box,
  Button,
  Paper,
  PasswordInput,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { LoadingScreen } from "@/components/ui";
import { ROUTES } from "@/lib/constants";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace(`${ROUTES.LOGIN}?redirect=${encodeURIComponent(ROUTES.CHANGE_PASSWORD)}`);
    }
  }, [isAuthenticated, isLoading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      await logout();
      // Send to login with redirect to dashboard so they are not sent back to change-password
      router.replace(`${ROUTES.LOGIN}?redirect=${encodeURIComponent(ROUTES.DASHBOARD)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setLoading(false);
    }
  }

  if (isLoading || !isAuthenticated) {
    return <LoadingScreen />;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--mantine-color-gray-0)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--mantine-spacing-md)",
        boxSizing: "border-box",
      }}
    >
      <Box maw={420} w="100%">
        <Title order={2} mb="xs" ta={"center"}>
          Change password
        </Title>
        <Text size="sm" c="dimmed" mb="md" ta={"center"}>
          Set a new password. You must change your temporary password before continuing.
        </Text>
        <Paper p="md" radius="md" shadow="sm" withBorder>
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              {error && (
                <Alert color="red" variant="light">
                  {error}
                </Alert>
              )}
              <PasswordInput
                label="Current (temporary) password"
                description="Use the password from your welcome email"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
              <PasswordInput
                label="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="••••••••"
                minLength={8}
              />
              <PasswordInput
                label="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
              <Button type="submit" color="green" loading={loading}>
                {loading ? "Changing…" : "Change password"}
              </Button>
            </Stack>
          </form>
        </Paper>
      </Box>
    </div>
  );
}
