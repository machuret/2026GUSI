export interface MCAccount {
  account_id: string;
  account_name: string;
  email: string;
  dc: string;
}

export interface MCAudience {
  id: string;
  name: string;
  stats: {
    member_count: number;
    open_rate: number;
    click_rate: number;
  };
}

export interface MCCampaign {
  id: string;
  settings: { title: string; subject_line?: string };
  status: string;
  send_time?: string;
  emails_sent?: number;
  report_summary?: {
    open_rate: number;
    click_rate: number;
    unsubscribe_rate: number;
  };
  recipients?: { list_id: string };
}

export interface MCCreateCampaignBody {
  type: "regular";
  recipients: { list_id: string };
  settings: {
    subject_line: string;
    title: string;
    from_name: string;
    reply_to: string;
  };
}

export class MailchimpClient {
  private base: string;
  private headers: Record<string, string>;

  constructor(apiKey: string, dataCenter: string) {
    this.base = `https://${dataCenter}.api.mailchimp.com/3.0`;
    this.headers = {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`,
    };
  }

  private async req<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      ...options,
      headers: { ...this.headers, ...(options.headers as Record<string, string> ?? {}) },
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Mailchimp API error (${res.status}): ${err.slice(0, 300)}`);
    }
    return res.json() as Promise<T>;
  }

  async getAccount(): Promise<MCAccount> {
    return this.req<MCAccount>("/");
  }

  async getAudiences(): Promise<MCAudience[]> {
    const data = await this.req<{ lists: MCAudience[] }>("/lists?count=100&fields=lists.id,lists.name,lists.stats");
    return data.lists ?? [];
  }

  async getCampaigns(count = 100): Promise<MCCampaign[]> {
    const data = await this.req<{ campaigns: MCCampaign[] }>(
      `/campaigns?count=${count}&fields=campaigns.id,campaigns.settings,campaigns.status,campaigns.send_time,campaigns.emails_sent,campaigns.report_summary,campaigns.recipients&sort_field=send_time&sort_dir=DESC`
    );
    return data.campaigns ?? [];
  }

  async createCampaign(body: MCCreateCampaignBody): Promise<MCCampaign> {
    return this.req<MCCampaign>("/campaigns", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async setCampaignContent(campaignId: string, html: string): Promise<void> {
    await this.req(`/campaigns/${campaignId}/content`, {
      method: "PUT",
      body: JSON.stringify({ html }),
    });
  }

  async sendCampaign(campaignId: string): Promise<void> {
    await this.req(`/campaigns/${campaignId}/actions/send`, { method: "POST" });
  }

  async scheduleCampaign(campaignId: string, scheduleTime: string): Promise<void> {
    await this.req(`/campaigns/${campaignId}/actions/schedule`, {
      method: "POST",
      body: JSON.stringify({ schedule_time: scheduleTime }),
    });
  }
}

/** Extract data centre from a Mailchimp API key (format: xxxx-us6) */
export function extractDataCenter(apiKey: string): string | null {
  const match = apiKey.match(/-([a-z]+\d+)$/);
  return match ? match[1] : null;
}
