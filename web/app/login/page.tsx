"use client";

import {
  Alert,
  Button,
  Center,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { LoadingScreen } from "@/components/ui";
import { ROUTES } from "@/lib/constants";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const redirect = searchParams.get("redirect") ?? ROUTES.DASHBOARD;

  if (isAuthenticated) {
    router.replace(redirect);
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      router.replace(user.must_change_password ? ROUTES.CHANGE_PASSWORD : redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Center mih="100dvh" p="md" style={{ background: "linear-gradient(180deg, #f0f9f4 0%, #e8f5ec 50%, #f8faf8 100%)" }}>
      <Paper w="100%" maw={400} p="xl" radius="lg" shadow="md" withBorder>
        <Title order={1} size="h2" ta="center" c="green.8">
          Mazao Group
        </Title>
        <Text size="sm" c="dimmed" ta="center" mt="xs">
          Sign in to manage farmers and field visits
        </Text>
        <form method="post" action="/api/auth/login" onSubmit={handleSubmit}>
          <Stack gap="md" mt="xl">
            {error && (
              <Alert color="red" title="Sign-in failed" variant="light" radius="md">
                {error}
              </Alert>
            )}
            <TextInput
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
            <PasswordInput
              label="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
            <Button type="submit" color="green" size="md" loading={loading} fullWidth mt="sm">
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <LoginForm />
    </Suspense>
  );
}
