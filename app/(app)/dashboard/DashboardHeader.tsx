"use client";

import LogoutButton from "@/app/components/LogoutButton";

export default function DashboardHeader() {
  return (
    <div className="flex items-center justify-between mb-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <LogoutButton />
    </div>
  );
}

