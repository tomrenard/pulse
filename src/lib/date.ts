/** Days are YYYY-MM-DD strings in Europe/Berlin, the athlete's time zone. */
export const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

export const addDays = (date: string, n: number) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

export const weekday = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
