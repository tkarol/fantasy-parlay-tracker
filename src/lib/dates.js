export function nextThursdaySixPmLocal(from = new Date()) {
    const d = new Date(from);
    const day = d.getDay();
    const daysUntilThu = (4 - day + 7) % 7 || 7;
    d.setDate(d.getDate() + daysUntilThu);
    d.setHours(18, 0, 0, 0);
    return d;
  }
  export function tsToDate(val) {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof val === "object" && typeof val.seconds === "number") return new Date(val.seconds * 1000);
    const d = new Date(val);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  export function fmtDateTimeLocalInput(d) {
    if (!d) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  export function fmtNice(d) {
    if (!d) return "—";
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  