"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingScreen } from "@/components/ui";
import { ROUTES } from "@/lib/constants";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading, canAccessDashboard } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      router.replace(canAccessDashboard ? ROUTES.DASHBOARD : ROUTES.FARMERS);
    } else {
      router.replace(ROUTES.LOGIN);
    }
  }, [isAuthenticated, isLoading, canAccessDashboard, router]);

  return <LoadingScreen />;
}
