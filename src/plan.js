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
export function calendar(task) {
  const start = new Date(`${task.date}T${task.time}:00`);
  if (!Number.isFinite(+start))
    throw new Error("Choose a valid date and start time.");
  const stamp = (d) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Clear Day//EN",
    "BEGIN:VEVENT",
    `UID:${task.id}@clear-day.local`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(new Date(+start + Number(task.duration) * 60000))}`,
    `SUMMARY:${escapeICS(task.title)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
