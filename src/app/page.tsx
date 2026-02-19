"use client";

import { useEffect, useState } from "react";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { SetupChecklist } from "@/components/dashboard/SetupChecklist";
import { QuickActions } from "@/components/dashboard/QuickActions";
import type { DashboardStats } from "@/components/dashboard/types";

import { DEMO_COMPANY_ID } from "@/lib/constants";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [statsRes, lessonsRes, companyRes] = await Promise.all([
          fetch(`/api/content/stats?companyId=${DEMO_COMPANY_ID}`),
          fetch("/api/lessons"),
          fetch("/api/company"),
        ]);
        const statsData = await statsRes.json();
        const lessonsData = await lessonsRes.json();
        const companyData = await companyRes.json();
        setStats({
          totalGenerated: statsData.totalGenerated ?? 0,
          pendingReview: statsData.pendingReview ?? 0,
          approved: statsData.approved ?? 0,
          rejected: statsData.rejected ?? 0,
          lessons: (lessonsData.lessons || []).length,
          ingestedPosts: 0,
          hasCompanyInfo: !!companyData.info,
          hasStyleProfile: !!companyData.info?.bulkContent,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const allSetup =
    stats?.hasCompanyInfo &&
    (stats?.ingestedPosts ?? 0) > 0 &&
    stats?.hasStyleProfile &&
    (stats?.totalGenerated ?? 0) > 0;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-gray-500">
          AI content that learns your voice and gets smarter with every piece of feedback
        </p>
      </div>

      <StatsRow stats={stats} loading={loading} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {!allSetup && (
          <div className="lg:col-span-1">
            <SetupChecklist stats={stats} />
          </div>
        )}
        <div className={allSetup ? "lg:col-span-3" : "lg:col-span-2"}>
          <QuickActions stats={stats} />
        </div>
      </div>
    </div>
  );
}
