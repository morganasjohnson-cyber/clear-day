import "./style.css";
import { createSharing } from "./sharing.js";
import { dateKey, organize, calendar } from "./plan.js";
const key = "clear-day-v1";
let state = { days: {} },
  day = dateKey(),
  tab = "plan",
  saveError = "",
  unreadable = null,
  raw = null;
try {
  raw = localStorage.getItem(key);
  if (raw) state = JSON.parse(raw);
  if (!state.days) throw Error();
} catch {
  unreadable = raw ?? "";
  saveError =
    "Saved data could not be read. Export a backup; existing saved data will not be overwritten.";
}
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const plan = () => (state.days[day] ??= { text: "", tasks: [], dumps: [] });
const sharing = createSharing({
  getState: () => state,
  setState: (next) => {
    state = next;
    saveError = "";
    unreadable = null;
  },
  render,
  modal,
  download,
  guestKey: key,
});
function save() {
  if (unreadable !== null) return;
  try {
    if (sharing.account) sharing.changed(state);
    else localStorage.setItem(key, JSON.stringify(state));
    saveError = "";
  } catch {
    saveError =
      "Saving is unavailable or storage is full. Please export a backup now.";
  }
  const el = $("#save");
  if (el) el.textContent = saveError || "✓ Saved on this device";
}
function download(data, name, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function render() {
  const p = plan(),
    done = p.tasks.filter((t) => t.done),
    pct = p.tasks.length ? Math.round((done.length / p.tasks.length) * 100) : 0;
  $("#app").innerHTML =
    `<aside><a class="brand" href="#">🍀 Clear Day<span>A LITTLE SPACE FOR YOU</span></a><nav><button class="${tab === "plan" ? "active" : ""}" data-tab="plan">◫ <span>My day</span></button><button class="${tab === "history" ? "active" : ""}" data-tab="history">◷ <span>History</span></button></nav><div class="aside-bottom"><p>Clear your mind.<br>Organize your day.<br><em>Enjoy your life.</em></p><button id="backup">↓ Export backup</button><button id="restore">↑ Restore backup</button><input id="restore-file" type="file" accept="application/json,.json" hidden></div></aside><main><header><div class="eyebrow">YOUR DAY, A LITTLE LIGHTER</div><div class="top"><div><h1>${tab === "history" ? "Your days, remembered." : day === dateKey() ? "A fresh start awaits." : "Make room for a clear day."}</h1><p>One thought, one task, one small win at a time.</p></div><div class="date"><label for="day">YOUR DAILY PLAN</label><input id="day" type="date" value="${day}" required></div></div></header>${sharing.markup()}<div id="save" role="status">${esc(saveError || "✓ Saved on this device")}</div>${
      tab === "history"
        ? `<section class="card"><h2>A little progress, every day</h2><p>Your plans and completed tasks stay here.</p>${Object.keys(
            state.days,
          )
            .sort()
            .reverse()
            .map(
              (d) =>
                `<button class="history" data-day="${d}"><strong>${new Date(d + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</strong><span>${state.days[d].tasks.filter((t) => t.done).length} of ${state.days[d].tasks.length} completed →</span></button>`,
            )
            .join("")}</section>`
        : `<section class="card dump"><div class="section-head"><div><span class="eyebrow">01 / MAKE SOME SPACE</span><h2>What’s on your mind?</h2></div><span class="leaf">✳</span></div><p>Let it all out. We’ll help you find a little order.</p><textarea id="dump" aria-label="Morning brain dump" placeholder="Finish the growth plan, call a friend, hairdresser at 15:00, go for a run…">${esc(p.text)}</textarea><div class="dump-footer"><small>No perfect words needed. Just start typing.</small><button class="primary" id="organize">🍀 Organize My Day <span>↗</span></button></div><small class="hint">Suggestions are made on your device. Review dates, categories and priorities.</small>${p.dumps.length ? `<details><summary>Original brain dumps (${p.dumps.length})</summary>${p.dumps.map((d) => `<p class="original">${esc(d.text)}</p>`).join("")}</details>` : ""}</section><section class="progress-card"><div class="progress-icon">☀</div><div><strong>You’re making room for what matters.</strong><p>${done.length} of ${p.tasks.length} tasks complete${pct === 100 && p.tasks.length ? " · Beautifully done!" : ""}</p></div><div class="progress-right"><strong>${pct}%</strong><progress value="${pct}" max="100">${pct}%</progress></div></section><div class="plan-heading"><div><span class="eyebrow">02 / ONE THING AT A TIME</span><h2>Your daily plan</h2>${p.carried ? `<small>${p.carried} unfinished tasks moved to a later plan.</small>` : ""}</div><div class="plan-actions"><button id="bulk-export">◷ Export activities</button><button id="add">＋ Add task</button></div></div><div class="columns">${[
            "Work",
            "Personal",
          ]
            .map(
              (c) =>
                `<section class="card task-section"><div class="section-head"><h2>${c === "Work" ? "▣" : "☘"} ${c}</h2><span class="count">${p.tasks.filter((t) => t.category === c && !t.done).length}</span></div>${
                  p.tasks
                    .filter((t) => t.category === c && !t.done)
                    .map(taskHTML)
                    .join("") ||
                  `<div class="empty">A little breathing room.<br><small>Your ${c.toLowerCase()} tasks will appear here.</small></div>`
                }</section>`,
            )
            .join(
              "",
            )}</div><section class="card completed"><details ${done.length ? "open" : ""}><summary>✓ Completed <span class="count">${done.length}</span></summary>${done.map(taskHTML).join("") || "<p>Small wins are on their way.</p>"}</details></section><footer><p>Enough for today is enough. <span>🍀</span></p><button id="end">☾ End My Day</button></footer>`
    }</main><dialog id="modal"></dialog>`;
  sharing.bind();
  $("#day").onchange = (e) => {
    if (e.target.value) {
      day = e.target.value;
      render();
    }
  };
  document.querySelectorAll("[data-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        tab = b.dataset.tab;
        render();
      }),
  );
  $("#backup").onclick = () =>
    download(
      unreadable ?? JSON.stringify(state, null, 2),
      "clear-day-backup.json",
      "application/json",
    );
  $("#restore").onclick = () => $("#restore-file").click();
  $("#restore-file").onchange = restore;
  document.querySelectorAll("[data-day]").forEach(
    (b) =>
      (b.onclick = () => {
        day = b.dataset.day;
        tab = "plan";
        render();
      }),
  );
  if (tab === "history") return;
  $("#dump").oninput = (e) => {
    p.text = e.target.value;
    save();
  };
  $("#organize").onclick = () => {
    if (!p.text.trim()) {
      $("#dump").focus();
      return;
    }
    if (p.dumps.some((d) => d.text === p.text)) {
      notice(
        "This brain dump is already organized. You can edit the tasks below or add new thoughts.",
      );
      return;
    }
    p.dumps.push({ text: p.text, created: new Date().toISOString() });
    p.tasks.push(...organize(p.text, day));
    save();
    render();
  };
  $("#add").onclick = () => edit();
  $("#bulk-export").onclick = bulkExport;
  $("#end").onclick = review;
  document.querySelectorAll("[data-check]").forEach(
    (b) =>
      (b.onchange = () => {
        p.tasks.find((t) => t.id === b.dataset.check).done = b.checked;
        save();
        render();
      }),
  );
  document
    .querySelectorAll("[data-edit]")
    .forEach(
      (b) =>
        (b.onclick = () => edit(p.tasks.find((t) => t.id === b.dataset.edit))),
    );
  document.querySelectorAll("[data-calendar]").forEach(
    (b) =>
      (b.onclick = () =>
        edit(
          p.tasks.find((t) => t.id === b.dataset.calendar),
          true,
        )),
  );
  document.querySelectorAll("[data-move]").forEach(
    (b) =>
      (b.onclick = () => {
        const i = p.tasks.findIndex((t) => t.id === b.dataset.move),
          dir = Number(b.dataset.dir),
          t = p.tasks[i];
        let j = i + dir;
        while (
          j >= 0 &&
          j < p.tasks.length &&
          (p.tasks[j].category !== t.category || p.tasks[j].done !== t.done)
        )
          j += dir;
        if (j >= 0 && j < p.tasks.length) {
          [p.tasks[i], p.tasks[j]] = [p.tasks[j], p.tasks[i]];
          save();
          render();
        }
      }),
  );
}
function taskHTML(t) {
  return `<article class="task ${t.done ? "done" : ""}"><input type="checkbox" aria-label="Complete ${esc(t.title)}" data-check="${t.id}" ${t.done ? "checked" : ""}><div class="task-content"><button class="task-title" data-edit="${t.id}">${esc(t.title)}</button><div class="tags">${t.priority === "High" ? '<span class="priority">● Priority</span>' : ""}<span>${esc(t.kind)}</span><button class="calendar" data-calendar="${t.id}">◷ ${t.date !== day ? esc(t.date) + " " : ""}${esc(t.time)} · Add to Calendar ↗</button></div></div><div class="reorder"><button data-move="${t.id}" data-dir="-1" aria-label="Move ${esc(t.title)} up">↑</button><button data-move="${t.id}" data-dir="1" aria-label="Move ${esc(t.title)} down">↓</button></div></article>`;
}
function modal(content) {
  const d = $("#modal");
  d.classList.remove("bulk-modal");
  d.innerHTML = content;
  d.showModal();
  d.querySelector("[data-close]").onclick = () => d.close();
}
function notice(text) {
  modal(
    `<h2>A little note</h2><p>${esc(text)}</p><button data-close>Got it</button>`,
  );
}
function edit(existing, exporting = false) {
  const t = existing || {
    title: "",
    category: "Work",
    priority: "Normal",
    kind: "Task",
    date: day,
    time: "",
    duration: 60,
  };
  modal(
    `<form id="taskform"><div class="section-head"><h2>${exporting ? "Add to Calendar" : existing ? "Edit your task" : "A new little intention"}</h2><button type="button" data-close aria-label="Close">✕</button></div><label>Task<input name="title" value="${esc(t.title)}" required maxlength="1000"></label><div class="form-row"><label>Category<select name="category">${["Work", "Personal"].map((v) => `<option ${v === t.category ? "selected" : ""}>${v}</option>`).join("")}</select></label><label>Priority<select name="priority">${["Normal", "High"].map((v) => `<option ${v === t.priority ? "selected" : ""}>${v}</option>`).join("")}</select></label></div><label>Type<select name="kind">${["Task", "Meeting", "Appointment", "Family", "Exercise", "Errand", "Leisure"].map((v) => `<option ${v === t.kind ? "selected" : ""}>${v}</option>`).join("")}</select></label><div class="form-row"><label>Date<input type="date" name="date" value="${t.date}" required></label><label>Start time<input type="time" name="time" value="${t.time}" ${exporting ? "required" : ""}></label></div><label>Duration (minutes)<input type="number" name="duration" value="${t.duration}" min="5" max="1440" required></label>${exporting ? '<p class="hint">Times use your device’s time zone. Downloads an .ics file; open it in Apple Calendar and confirm the import.</p>' : ""}<div class="form-actions">${existing && !exporting ? '<button type="button" class="danger" id="delete">Delete task</button>' : ""}<button class="primary" type="submit">${exporting ? "Download .ics" : "Save task"}</button></div></form>`,
  );
  $("#taskform").onsubmit = (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.target));
    values.title = values.title.trim();
    if (!values.title) return;
    const updated = {
      ...t,
      ...values,
      id: t.id || crypto.randomUUID(),
      done: t.done || false,
    };
    if (exporting)
      download(
        calendar(updated),
        "clear-day-event.ics",
        "text/calendar;charset=utf-8",
      );
    if (existing) Object.assign(existing, updated);
    else plan().tasks.push(updated);
    save();
    $("#modal").close();
    render();
  };
  if ($("#delete"))
    $("#delete").onclick = () => {
      if (
        confirm("Delete this task? Your original brain dump will be preserved.")
      ) {
        plan().tasks = plan().tasks.filter((x) => x.id !== t.id);
        save();
        $("#modal").close();
        render();
      }
    };
}
function bulkExport() {
  const tasks = plan().tasks;
  if (!tasks.length) {
    notice(
      "Add or organize a few activities first, then export them together.",
    );
    return;
  }
  modal(`<form id="bulk-form"><div class="section-head"><h2>Export activities</h2><button type="button" data-close aria-label="Close">✕</button></div>
    <p>Select activities for this plan. Review their details, then download one calendar file.</p>
    <div class="bulk-controls"><button type="button" id="select-all">Select all</button><button type="button" id="select-none">Clear selection</button><span id="selected-count" role="status"></span></div>
    <div class="bulk-list">${tasks
      .map(
        (
          t,
          i,
        ) => `<fieldset class="bulk-activity" data-index="${i}"><legend><label class="bulk-select"><input type="checkbox" name="include" ${t.time && !t.done ? "checked" : ""}><span>${esc(t.title)}${t.done ? " · Completed" : ""}</span></label></legend>
      <label>Event title<input name="title" value="${esc(t.title)}" maxlength="1000"></label>
      <div class="form-row"><label>Date<input type="date" name="date" value="${esc(t.date)}"></label><label>Start time<input type="time" name="time" value="${esc(t.time)}"></label></div>
      <label>Duration (minutes)<input type="number" name="duration" min="5" max="1440" step="1" value="${esc(t.duration)}"></label></fieldset>`,
      )
      .join("")}</div>
    <p class="hint">Times use your device’s time zone. Selected edits are saved to your plan when you download. Open the .ics file in Apple Calendar and confirm import; exporting does not add events automatically. Repeated imports may create duplicates.</p>
    <p id="bulk-error" role="alert"></p><div class="form-actions"><button class="primary" id="bulk-download" type="submit">Download calendar file</button></div></form>`);
  $("#modal").classList.add("bulk-modal");
  const rows = [...document.querySelectorAll(".bulk-activity")];
  const update = () => {
    let count = 0;
    for (const row of rows) {
      const selected = row.querySelector('[name="include"]').checked;
      if (selected) count++;
      row.querySelectorAll('input:not([name="include"])').forEach((input) => {
        input.disabled = !selected;
        input.required = selected;
      });
    }
    $("#selected-count").textContent = `${count} selected`;
    $("#bulk-download").disabled = count === 0;
  };
  for (const row of rows)
    row.querySelector('[name="include"]').onchange = update;
  for (const [selector, checked] of [
    ["#select-all", true],
    ["#select-none", false],
  ])
    $(selector).onclick = () => {
      rows.forEach(
        (row) => (row.querySelector('[name="include"]').checked = checked),
      );
      update();
    };
  update();
  $("#bulk-form").onsubmit = (e) => {
    e.preventDefault();
    const selected = rows
      .filter((row) => row.querySelector('[name="include"]').checked)
      .map((row) => {
        const task = tasks[Number(row.dataset.index)];
        return {
          ...task,
          ...Object.fromEntries(
            ["title", "date", "time", "duration"].map((name) => [
              name,
              row.querySelector(`[name="${name}"]`).value.trim(),
            ]),
          ),
        };
      });
    try {
      const content = calendar(selected);
      download(content, `clear-day-${day}.ics`, "text/calendar;charset=utf-8");
      selected.forEach((updated) =>
        Object.assign(
          tasks.find((t) => t.id === updated.id),
          updated,
        ),
      );
      save();
      $("#modal").close();
      render();
      notice(
        `Downloaded ${selected.length} ${selected.length === 1 ? "activity" : "activities"} in one calendar file. Open it in Apple Calendar to review and import.`,
      );
    } catch (error) {
      $("#bulk-error").textContent = error.message;
    }
  };
}
function review() {
  const p = plan(),
    done = p.tasks.filter((t) => t.done),
    remaining = p.tasks.filter((t) => !t.done);
  modal(
    `<div class="section-head"><h2>A day well lived. ☾</h2><button data-close aria-label="Close">✕</button></div><p>${done.length ? `You made ${done.length} small ${done.length === 1 ? "step" : "steps"} forward. Give yourself a little credit.` : "Taking a moment to plan is progress, too. Tomorrow is a fresh start."}</p><h3>Completed · ${done.length}</h3><ul>${done.map((t) => `<li>✓ ${esc(t.title)}</li>`).join("") || "<li>No completed tasks yet.</li>"}</ul><h3>Still ahead · ${remaining.length}</h3><ul>${remaining.map((t) => `<li>${esc(t.title)}</li>`).join("") || "<li>Everything is complete. Enjoy your evening!</li>"}</ul>${remaining.length ? '<p class="hint">Move unfinished tasks to tomorrow’s plan. Completed tasks and original notes stay in today’s history.</p><button class="primary" id="carry">Move unfinished tasks to tomorrow →</button>' : ""}`,
  );
  if ($("#carry"))
    $("#carry").onclick = () => {
      const tomorrow = new Date(day + "T12:00:00");
      tomorrow.setDate(tomorrow.getDate() + 1);
      const next = dateKey(tomorrow);
      state.days[next] ??= { text: "", tasks: [], dumps: [] };
      state.days[next].tasks.push(
        ...remaining.map((t) => ({
          ...t,
          date: t.date <= day ? next : t.date,
          carriedFrom: day,
        })),
      );
      p.tasks = done;
      p.carried = (p.carried || 0) + remaining.length;
      save();
      $("#modal").close();
      day = next;
      render();
    };
}
render();
sharing.init();

async function restore(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (
      !data ||
      typeof data.days !== "object" ||
      Array.isArray(data.days) ||
      !data.days
    )
      throw Error();
    for (const [date, p] of Object.entries(data.days)) {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        typeof p.text !== "string" ||
        !Array.isArray(p.dumps) ||
        !Array.isArray(p.tasks)
      )
        throw Error();
      for (const t of p.tasks)
        if (
          typeof t.title !== "string" ||
          typeof t.id !== "string" ||
          !/^[a-zA-Z0-9-]+$/.test(t.id) ||
          !["Work", "Personal"].includes(t.category) ||
          typeof t.date !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(t.date) ||
          typeof t.time !== "string" ||
          !/^(?:|(?:[01][0-9]|2[0-3]):[0-5][0-9])$/.test(t.time) ||
          !["", "High", "Normal"].includes(t.priority) ||
          ![
            "Task",
            "Meeting",
            "Appointment",
            "Family",
            "Exercise",
            "Errand",
            "Leisure",
          ].includes(t.kind)
        )
          throw Error();
      for (const dump of p.dumps)
        if (typeof dump.text !== "string") throw Error();
    }
    if (
      !confirm(
        "Restore this backup? A backup of your current data will download first. Matching dates will be replaced.",
      )
    )
      return;
    download(
      unreadable ?? JSON.stringify(state, null, 2),
      "clear-day-before-restore.json",
      "application/json",
    );
    state.days = { ...state.days, ...data.days };
    unreadable = null;
    save();
    render();
  } catch {
    notice(
      "This file is not a valid Clear Day backup. Your current plans are unchanged.",
    );
  }
}
