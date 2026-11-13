// Time zones as people say them (audit S7): "British time", "West Africa time", never "Europe/London".

/** "British time (London)" from an IANA zone; the zone id itself if the browser can't name it. */
export function zoneLabel(timeZone: string): string {
  try {
    const name = new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "longGeneric" })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value
    const city = timeZone.split("/").pop()?.replace(/_/g, " ")
    if (!name) return city ?? timeZone
    return city && !name.includes(city) ? `${name} (${city})` : name
  } catch {
    return timeZone
  }
}
