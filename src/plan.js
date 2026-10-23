export const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function organize(text, day) {
  return text
    .split(/(?:\r?\n|;|,|[.!?]\s+(?=[A-Z])|\band\b|\bthen\b)+/i)
    .map((s) => s.trim().replace(/^(?:need to|i need to)\s+/i, ""))
    .filter(Boolean)
    .map((title) => {
      const personal =
        /hairdresser|run\b|gym|exercise|walk|family|watch|willem|shop|grocery|dentist|doctor|leisure|dinner|kids|school|errand/i.test(
          title,
        );
      const match = title.match(
        /\b([01]?\d|2[0-3])[:.]([0-5]\d)\b|\b(1[0-2]|0?[1-9])\s*(am|pm)\b/i,
      );
      let time = "";
      if (match) {
        if (match[1]) time = `${match[1].padStart(2, "0")}:${match[2]}`;
        else
          time = `${String((Number(match[3]) % 12) + (/pm/i.test(match[4]) ? 12 : 0)).padStart(2, "0")}:00`;
      }
      const tomorrow = new Date(day + "T12:00:00");
      tomorrow.setDate(tomorrow.getDate() + 1);
      const weekday = title.match(
        /\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
      );
      let suggestedDate = day;
      if (weekday) {
        const d = new Date(day + "T12:00:00");
        const target = [
          "sunday",
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
        ].indexOf(weekday[2].toLowerCase());
        let offset = (target - d.getDay() + 7) % 7;
        if (weekday[1] && offset === 0) offset = 7;
        d.setDate(d.getDate() + offset);
        suggestedDate = dateKey(d);
      }
      const date =
        title.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ||
        (/tomorrow/i.test(title) ? dateKey(tomorrow) : suggestedDate);
      return {
        id: crypto.randomUUID(),
        title: title[0].toUpperCase() + title.slice(1),
        category: personal ? "Personal" : "Work",
        priority: /finish|urgent|proposal|escalation|deadline|important/i.test(
          title,
        )
          ? "High"
          : "Normal",
        kind: time
          ? "Appointment"
          : personal
            ? /run\b|gym|exercise|walk/i.test(title)
              ? "Exercise"
              : /watch|willem|leisure/i.test(title)
                ? "Leisure"
                : /family|kids|school/i.test(title)
                  ? "Family"
                  : "Errand"
            : /meeting|call|talk/i.test(title)
              ? "Meeting"
              : "Task",
        date,
        time,
        duration: 60,
        done: false,
      };
    });
}
const escapeICS = (s) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
export function calendar(input) {
  const tasks = Array.isArray(input) ? input : [input];
  if (!tasks.length) throw new Error("Select at least one activity.");
  const stamp = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const events = tasks.flatMap((task) => {
    const start = new Date(`${task.date}T${task.time}:00`);
    const duration = Number(task.duration);
    if (!task.title?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(task.date) ||
        !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(task.time) ||
        !Number.isFinite(+start) || dateKey(start) !== task.date ||
        !Number.isInteger(duration) || duration < 5 || duration > 1440)
      throw new Error("Each activity needs a title, valid date, start time, and duration (5–1440 minutes).");
    return ["BEGIN:VEVENT", `UID:${task.id}@clear-day.local`,
      `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(new Date(+start + duration * 60000))}`,
      `SUMMARY:${escapeICS(task.title)}`, "END:VEVENT"];
  });
  // Calendar content lines must stay within 75 UTF-8 octets.
  const fold = (line) => {
    let output = "", bytes = 0;
    for (const char of line) {
      const size = new TextEncoder().encode(char).length;
      if (bytes + size > 75) { output += "\r\n "; bytes = 1; }
      output += char; bytes += size;
    }
    return output;
  };
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Clear Day//EN",
    ...events, "END:VCALENDAR", ""].map(fold).join("\r\n");
}
