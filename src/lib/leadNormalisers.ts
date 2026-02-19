/**
 * Normalise raw Apify actor output into the Lead DB shape.
 * Each source has a different JSON structure — these functions flatten them.
 * Extracted from the scrape route for testability and reuse.
 */

type NormalisedLead = Record<string, unknown>;

function normaliseLinkedIn(item: Record<string, unknown>): NormalisedLead {
  return {
    source: "linkedin",
    fullName: (item.fullName ?? item.name ?? "") as string,
    firstName: (item.firstName ?? "") as string,
    lastName: (item.lastName ?? "") as string,
    jobTitle: (item.headline ?? item.jobTitle ?? "") as string,
    company: (item.currentCompany ?? item.company ?? "") as string,
    location: (item.location ?? "") as string,
    linkedinUrl: (item.profileUrl ?? item.url ?? "") as string,
    profileUrl: (item.profileUrl ?? item.url ?? "") as string,
    rawData: item,
  };
}

function normaliseDoctolib(item: Record<string, unknown>): NormalisedLead {
  const name = (item.name ?? item.fullName ?? "") as string;
  const parts = name.split(" ");
  return {
    source: "doctolib",
    fullName: name,
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
    jobTitle: (item.specialty ?? item.speciality ?? "") as string,
    company: (item.practiceName ?? item.clinic ?? "") as string,
    location: (item.address ?? item.location ?? "") as string,
    city: (item.city ?? "") as string,
    country: "France",
    profileUrl: (item.url ?? item.profileUrl ?? "") as string,
    specialties: Array.isArray(item.specialties) ? item.specialties as string[] : [],
    rawData: item,
  };
}

function normaliseWebMD(item: Record<string, unknown>): NormalisedLead {
  // easyapi/webmd-doctor-scraper can return nested or flat structures
  const nameObj = item.name as Record<string, string> | undefined;
  const locationObj = item.location as Record<string, string> | undefined;
  const addressObj = item.address as Record<string, string> | undefined;
  const urlsObj = item.urls as Record<string, string> | undefined;
  const practiceObj = item.practice as Record<string, string> | undefined;

  // Name — try nested object first, then flat fields
  const fullName = nameObj?.full
    ?? (item.fullName as string)
    ?? (item.name as string)
    ?? [item.firstName, item.lastName].filter(Boolean).join(" ")
    ?? "";
  const firstName = nameObj?.first ?? (item.firstName as string) ?? "";
  const lastName  = nameObj?.last  ?? (item.lastName  as string) ?? "";

  // Specialties
  const specialties: string[] = Array.isArray(item.specialties)
    ? item.specialties as string[]
    : typeof item.specialty === "string" ? [item.specialty] : [];

  // Company / practice name
  const company = practiceObj?.name
    ?? locationObj?.name
    ?? (item.practiceName as string)
    ?? (item.hospital as string)
    ?? (item.company as string)
    ?? "";

  // Location
  const city  = locationObj?.city  ?? addressObj?.city  ?? (item.city  as string) ?? "";
  const state = locationObj?.state ?? addressObj?.state ?? (item.state as string) ?? "";
  const addr  = locationObj?.address ?? addressObj?.street ?? (item.address as string) ?? "";
  const rawLocation = [addr, city, state].filter(Boolean).join(", ");

  // Email — some actors return it, most don't
  const email = (item.email as string) ?? (item.emailAddress as string) ?? "";

  return {
    source: "webmd",
    fullName,
    firstName,
    lastName,
    email,
    gender: (item.gender ?? "") as string,
    jobTitle: specialties[0] ?? (item.jobTitle as string) ?? "",
    specialties,
    company,
    location: rawLocation,
    city,
    state,
    country: "United States",
    profileUrl: urlsObj?.profile ?? (item.profileUrl as string) ?? (item.url as string) ?? "",
    website: urlsObj?.website ?? (item.website as string) ?? "",
    rawData: item,
  };
}

export function normalise(sourceId: string, item: Record<string, unknown>): NormalisedLead {
  switch (sourceId) {
    case "linkedin":  return normaliseLinkedIn(item);
    case "doctolib":  return normaliseDoctolib(item);
    case "webmd":     return normaliseWebMD(item);
    default:          return { source: sourceId, fullName: "", rawData: item };
  }
}
