# Clear Day 🍀

A calm, mobile-friendly daily planner. Clear your mind. Organize your day. Enjoy your life.

## Development

Requires Node.js 22+ and npm. From this directory:

```sh
npm ci
npm run dev
```

`npm test` checks task extraction and calendar export; `npm run build` creates a static production site in `dist/`. Deploy that directory to any static host over HTTPS. The device-only planner needs no account. Optional cross-device sharing uses Supabase; see [sharing setup](supabase/README.md).

## Using your day

- Write a brain dump and choose **Organize My Day**. The local rule-based organizer separates comma-, semicolon-, newline-, and “and”-separated activities, suggests work/personal categories and priorities, and recognizes 24-hour times, am/pm, ISO dates, and tomorrow. Suggestions are editable; complex language may need manual correction.
- Click a task title to edit or delete it. Use arrows to reorder within its section; check a task to move it to Completed.
- **Export activities** beside “Your daily plan” opens bulk calendar export for the displayed plan. Scheduled, unfinished activities start selected. Use Select all or individual checkboxes, review titles, dates, start times, and durations, then download one `.ics` file containing the selected activities. Missing times must be filled in before export. Selected edits are saved when downloaded; closing the dialog discards edits. Open the file in Apple Calendar to confirm import.
- **Add to Calendar** opens an editable title, date, start time, and duration form. Download the `.ics` file and open it in Apple Calendar to confirm import. Exporting does not add the event automatically. Times use the device time zone; importing the same event repeatedly may create duplicates depending on the calendar client.
- **End My Day** shows your wins and outstanding tasks. Carry-forward explicitly moves unfinished tasks into tomorrow's plan while preserving completed tasks and original notes in history.
- Use the date picker or History to revisit plans. Brain dumps autosave on input, and each organized original is archived. Reorganizing an identical dump is prevented; reorganizing changed text may repeat tasks, which you can delete.

## Data and privacy

Plans live in this browser's localStorage and persist across refreshes. They stay device-only unless you connect optional sharing. Click **Share across devices** to sign in once the Supabase connection is configured. Signed-in account plans are cached separately by user, then synchronized while the app is open. Use the same account on Mac and phone. Existing device-only plans remain separate until you explicitly copy them into the account; that action downloads a backup first. Concurrent edits pause for a choice instead of silently overwriting either copy. See [sharing setup and limitations](supabase/README.md). Clearing site data, using private browsing, or changing the site address can remove or hide saved plans. Use **Export backup** regularly and **Restore backup** to recover or transfer them. Restoration downloads a copy of current data before replacing matching dates. Storage failures display a warning. No thoughts are sent to an AI service. When signed in, your account plans are sent to your configured Supabase project; database row-level security must be installed to protect them.

## Validation

The app has been exercised in Chromium at desktop and 390px mobile widths: organization of the example dump, completion and reload persistence, duplicate prevention, calendar downloads, task add/edit/delete/reorder, evening review, carry-forward, and history. Unit tests verify extraction, date rollover, and timed calendar file content. Actual import on an iPhone or Mac requires that device and has not been verified here.

## GitHub Pages

The `docs/` folder contains a ready-to-host production build with relative asset paths. In this repository's GitHub **Settings → Pages**, choose **Deploy from a branch**, branch **main**, folder **/docs**, then **Save**. GitHub will show the website address after deployment. Availability depends on your repository visibility and GitHub plan. This agent cannot enable Pages through the GitHub API in the current environment.

After app changes, refresh the website build with `npm run build -- --base=./ --outDir docs` and commit the updated `docs/` files.
