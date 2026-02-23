import type { Lead } from "@/hooks/useLeads";

/** Shared column mapping for lead CSV exports — used by /leads and /qualified pages. */
export function leadToCsvRow(l: Lead): Record<string, string | number> {
  return {
    "Full Name": l.fullName ?? "",
    "First Name": l.firstName ?? "",
    "Last Name": l.lastName ?? "",
    "Job Title": l.jobTitle ?? "",
    Company: l.company ?? "",
    Email: l.email ?? "",
    Phone: l.phone ?? "",
    City: l.city ?? "",
    State: l.state ?? "",
    Country: l.country ?? "",
    Location: l.location ?? "",
    Source: l.source ?? "",
    Status: l.status ?? "",
    LinkedIn: l.linkedinUrl ?? "",
    "Profile URL": l.profileUrl ?? "",
    Website: l.website ?? "",
    Specialties: Array.isArray(l.specialties) ? l.specialties.join("; ") : "",
    Rating: l.rating ?? "",
    Notes: l.notes ?? "",
    Added: l.createdAt ? new Date(l.createdAt).toLocaleString() : "",
  };
}
