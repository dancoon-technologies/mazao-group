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
    <Center mih="100dvh" p="md">
      <Paper w="100%" maw={400} p="xl" radius="lg" shadow="sm" withBorder>
        <Title order={1} size="h3" ta="center">
          Mazao Group
        </Title>
        <Text size="sm" c="dimmed" ta="center" mt="xs">
          Sign in to continue
        </Text>
        <form method="post" action="/api/auth/login" onSubmit={handleSubmit}>
          <Stack gap="md" mt="lg">
            {error && (
              <Alert color="red" title="Error" variant="light">
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
            <Button type="submit" color="green" loading={loading} fullWidth>
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
