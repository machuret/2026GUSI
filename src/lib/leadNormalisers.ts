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
  const nameObj = item.name as Record<string, string> | undefined;
  const locationObj = item.location as Record<string, string> | undefined;
  const urlsObj = item.urls as Record<string, string> | undefined;
  const rawLocation = locationObj
    ? `${locationObj.address ?? ""}, ${locationObj.city ?? ""}, ${locationObj.state ?? ""}`.replace(/^[,\s]+|[,\s]+$/g, "")
    : "";
  return {
    source: "webmd",
    fullName: nameObj?.full ?? "",
    firstName: nameObj?.first ?? "",
    lastName: nameObj?.last ?? "",
    gender: (item.gender ?? "") as string,
    jobTitle: Array.isArray(item.specialties) ? (item.specialties as string[])[0] ?? "" : "",
    specialties: Array.isArray(item.specialties) ? item.specialties as string[] : [],
    company: locationObj?.name ?? "",
    location: rawLocation,
    city: locationObj?.city ?? "",
    state: locationObj?.state ?? "",
    country: "United States",
    profileUrl: urlsObj?.profile ?? "",
    website: urlsObj?.website ?? "",
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
