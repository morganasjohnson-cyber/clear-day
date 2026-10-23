import { test } from "node:test";
import assert from "node:assert/strict";
import { organize, calendar, dateKey } from "./plan.js";
test("organizes the supplied morning dump without dropping activities", () => {
  const text =
    "Need to finish my 2027 growth plan, review deal escalations, prepare the Nordic customer proposal, talk to my predecessor, check next week's calendar, hairdresser at 15:00, run 10 km and watch Willem II tonight.";
  const tasks = organize(text, "2026-10-23");
  assert.equal(tasks.length, 8);
  assert.equal(tasks.filter((t) => t.category === "Work").length, 5);
  assert.equal(tasks.filter((t) => t.category === "Personal").length, 3);
  assert.equal(tasks[5].time, "15:00");
  assert.equal(tasks[0].priority, "High");
  assert.equal(tasks[6].kind, "Exercise");
  assert.equal(new Set(tasks.map((t) => t.id)).size, 8);
});
test("handles tomorrow, ISO dates, and twelve-hour times", () => {
  const tasks = organize(
    "Call tomorrow at 2 pm; Dentist 2026-11-03 at 9 am",
    "2026-10-31",
  );
  assert.equal(tasks[0].date, "2026-11-01");
  assert.equal(tasks[0].time, "14:00");
  assert.equal(tasks[1].date, "2026-11-03");
  assert.equal(tasks[1].time, "09:00");
  assert.deepEqual(organize("  ", "2026-10-23"), []);
});
test("calendar exports a timed event with escaped title and duration", () => {
  const text = calendar({
    id: "test",
    title: "Review, plan; finish\nNext",
    date: "2026-10-23",
    time: "15:00",
    duration: 45,
  });
  assert.match(text, /BEGIN:VCALENDAR\r\n/);
  assert.match(text, /SUMMARY:Review\\, plan\\; finish\\nNext/);
  const start = text.match(/DTSTART:(.*)/)[1].trim(),
    end = text.match(/DTEND:(.*)/)[1].trim();
  const parse = (s) =>
    Date.UTC(
      +s.slice(0, 4),
      +s.slice(4, 6) - 1,
      +s.slice(6, 8),
      +s.slice(9, 11),
      +s.slice(11, 13),
    );
  assert.equal(parse(end) - parse(start), 45 * 60000);
  assert.throws(() => calendar({ date: "invalid", time: "" }));
});
test("local date keys do not shift at midnight", () =>
  assert.equal(dateKey(new Date(2026, 9, 23, 0, 5)), "2026-10-23"));

test("bulk calendar contains exactly the selected events in one calendar", () => {
  const tasks = [
    { id: "first", title: "Team review", date: "2026-10-23", time: "09:00", duration: 30 },
    { id: "second", title: "Run 🍀", date: "2026-10-24", time: "17:00", duration: 60 },
  ];
  const text = calendar(tasks);
  assert.equal((text.match(/BEGIN:VCALENDAR/g) || []).length, 1);
  assert.equal((text.match(/END:VCALENDAR/g) || []).length, 1);
  assert.equal((text.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.match(text, /UID:first@clear-day.local/);
  assert.match(text, /UID:second@clear-day.local/);
  assert.match(text, /SUMMARY:Run 🍀/);
  assert.equal((calendar([tasks[1]]).match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.throws(() => calendar([]), /Select/);
  assert.throws(() => calendar([...tasks, { ...tasks[0], time: "" }]));
  assert.throws(() => calendar([{ ...tasks[0], date: "2026-02-30" }]));
  assert.throws(() => calendar([{ ...tasks[0], duration: 0 }]));
});

test("calendar folds long Unicode titles without breaking characters", () => {
  const title = "🍀 A calm day, " .repeat(30);
  const text = calendar({ id:"long", title, date:"2026-10-23", time:"09:00", duration:60 });
  for (const line of text.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75);
  assert.ok(text.replace(/\r\n /g, "").includes(`SUMMARY:${title.replace(/,/g, "\\,")}`));
});
