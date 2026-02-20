export interface MCConnection {
  id: string;
  accountName: string | null;
  accountEmail: string | null;
  dataCenter: string;
  connectedAt: string;
}

export interface MCAudience {
  id: string;
  name: string;
  memberCount: number;
  openRate: number;
  clickRate: number;
  syncedAt: string;
}

export interface MCCampaign {
  id: string;
  audienceId: string | null;
  title: string;
  subjectLine: string | null;
  status: string;
  sendTime: string | null;
  emailsSent: number;
  openRate: number;
  clickRate: number;
  unsubscribeRate: number;
  syncedAt: string;
}

export function pct(rate: number) {
  return `${(rate * 100).toFixed(1)}%`;
}

export function fmtNum(n: number) {
  return n.toLocaleString();
}

export function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export const STATUS_COLORS: Record<string, string> = {
  sent:      "bg-green-100 text-green-700",
  draft:     "bg-gray-100 text-gray-600",
  scheduled: "bg-blue-100 text-blue-700",
  sending:   "bg-yellow-100 text-yellow-700",
  paused:    "bg-orange-100 text-orange-700",
  canceled:  "bg-red-100 text-red-600",
};
