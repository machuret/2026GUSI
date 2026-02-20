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
  // Actual output schema from easyapi/webmd-doctor-scraper:
  // name: { first, middle, last, full, suffix }
  // location: { name, address, city, state, zipcode, ... }
  // urls: { profile, appointment, website }
  // ratings: { averageRating, reviewCount }
  // specialties: string[]
  // gender: "M" | "F"
  const nameObj     = (typeof item.name === "object" && item.name !== null) ? item.name as Record<string, string> : undefined;
  const locationObj = (typeof item.location === "object" && item.location !== null) ? item.location as Record<string, unknown> : undefined;
  const urlsObj     = (typeof item.urls === "object" && item.urls !== null) ? item.urls as Record<string, string> : undefined;
  const ratingsObj  = (typeof item.ratings === "object" && item.ratings !== null) ? item.ratings as Record<string, unknown> : undefined;

  // Name
  const fullName  = nameObj?.full  ?? (item.fullName as string) ?? [item.firstName, item.lastName].filter(Boolean).join(" ") ?? "";
  const firstName = nameObj?.first ?? (item.firstName as string) ?? "";
  const lastName  = nameObj?.last  ?? (item.lastName  as string) ?? "";

  // Specialties
  const specialties: string[] = Array.isArray(item.specialties)
    ? item.specialties as string[]
    : typeof item.specialty === "string" ? [item.specialty] : [];

  // Practice / company name comes from location.name
  const company = (locationObj?.name as string)
    ?? (item.practiceName as string)
    ?? (item.hospital as string)
    ?? (item.company as string)
    ?? "";

  // Location fields
  const city    = (locationObj?.city  as string) ?? (item.city  as string) ?? "";
  const state   = (locationObj?.state as string) ?? (item.state as string) ?? "";
  const addr    = (locationObj?.address as string) ?? (item.address as string) ?? "";
  const zipcode = (locationObj?.zipcode as string) ?? "";
  const rawLocation = [addr, city, state, zipcode].filter(Boolean).join(", ");

  // Rating
  const rating = typeof ratingsObj?.averageRating === "number" ? ratingsObj.averageRating as number : null;

  // Email
  const email = (item.email as string) ?? (item.emailAddress as string) ?? "";

  // Gender — actor returns "M" or "F", expand to readable
  const genderRaw = (item.gender as string) ?? "";
  const gender = genderRaw === "M" ? "Male" : genderRaw === "F" ? "Female" : genderRaw;

  // Notes — strip HTML tags from bio
  const bioRaw = (item.bio as string) ?? "";
  const notes = bioRaw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500) || undefined;

  return {
    source: "webmd",
    fullName,
    firstName,
    lastName,
    email,
    gender,
    jobTitle: specialties[0] ?? (item.jobTitle as string) ?? "",
    specialties,
    company,
    location: rawLocation,
    city,
    state,
    country: "United States",
    profileUrl: urlsObj?.profile ?? (item.profileUrl as string) ?? (item.url as string) ?? "",
    website: urlsObj?.website ?? (item.website as string) ?? "",
    rating,
    notes,
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
