# Connect automatic sharing

The app keeps working locally until these steps are complete. Supabase stores plans privately under each signed-in user's ID; row-level security is required. Never put a service-role or secret key in this project.

1. Create a Supabase account and a project at https://supabase.com/dashboard. Keep the database password private.
2. Open the project's SQL Editor. Run the contents of [setup.sql](./setup.sql).
3. In Authentication → URL Configuration, set the Site URL to `https://morganasjohnson-cyber.github.io/clear-day/`. Add that same URL to allowed redirect URLs. Keep email confirmation enabled. Email/password sign-in must be enabled. Supabase's built-in email sender has delivery/rate limits; production use may require custom SMTP.
4. In the project's Connect dialog / API settings, find its Project URL and **publishable** key (or legacy **anon** key). These are public browser configuration, not the database password or service-role key. Set `url` and `publishableKey` in `public/sync-config.json`. Rebuild `docs/` and push to GitHub. No private credentials belong in GitHub or chat.
5. In Clear Day, click **Share across devices**, create an account, confirm the email, and sign in. Click **Copy device plans to account** on your Mac after checking the account's plan. On your phone, open the same website and sign in with the same email and password.

## Behavior

- Account plans are separate from the pre-existing device-only plans. Migration is explicit and downloads a backup before copying. Conflicting dates are never silently replaced.
- Saves are cached under the user ID locally and sent to Supabase. The app checks about every eight seconds while visible, on reconnect, and when returning to the tab. Do not clear browser storage while changes are pending.
- When two devices edit before receiving one another's changes, version checking pauses writes and asks which copy to keep. The copy not selected is downloaded as a restorable backup before resolving the conflict. This avoids silently dropping a task, edit, or deletion.
- Remote refresh waits while a form/dialog is active. Signing out returns to device-only plans and clears the rendered account view. The account's local recovery cache remains on that device for offline recovery, so use a trusted personal device.
- The GitHub Pages website is public, but the database requires a signed-in user and RLS restricts each user to their own row. Test this with two separate test users before relying on the service.

## Validation still required on your Supabase project

Create two test users. Confirm user A cannot select, update, or insert a row belonging to user B using authenticated API requests. Sign into the same test account on two devices; add a task on one and complete it on the other. Test offline edits, reconnection, and a deliberate simultaneous edit conflict. Unit and browser tests with a simulated service cannot prove a live project's authentication, email delivery, or row security configuration.

## Repeatable local checks

Run `npm test` for the sync engine (two-device changes, offline recovery, concurrency, caching, and deferred refresh). Run `npm run test:security` for the SQL template in embedded PostgreSQL, including anonymous and cross-user denial.

With `npm run dev -- --port 5173` running, install a Playwright Chromium browser using `npx playwright install chromium`, then run `npm run test:sharing-browser`. If Chromium is already installed, set `CHROMIUM_EXECUTABLE_PATH` to its executable path instead. This browser suite simulates Supabase API responses and checks migration, phone completion, account separation, conflict recovery, and device-only behavior. Its credentials and URL are test fixtures, not real accounts.
