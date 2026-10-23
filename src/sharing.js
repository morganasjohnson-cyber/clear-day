import { createClient } from "@supabase/supabase-js";
import { PlanSync, supabaseStore } from "./sync.js";

const html = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function createSharing({
  getState,
  setState,
  render,
  modal,
  download,
  guestKey,
}) {
  let client = null,
    engine = null,
    user = null,
    initialized = false;
  let status = "local",
    detail = "",
    initializationError = false,
    uploadTimer = null;
  const messages = {
    local: "Device-only plans",
    syncing: "Checking shared plans…",
    pending: "Changes waiting to sync",
    synced: "Synced with your account",
    conflict: "Both devices changed · review copies",
    error: "Sharing unavailable · local changes kept",
  };
  function updateStatus(next, error) {
    status = next;
    detail = error?.message || "";
    const text = document.querySelector("#sharing-status");
    if (text) text.textContent = messages[status];
  }
  function show(content) {
    modal(content);
  }
  async function switchUser(next) {
    if ((next?.id ?? null) === (user?.id ?? null)) return;
    engine?.stop();
    engine = null;
    user = next;
    if (!user) {
      try {
        setState(JSON.parse(localStorage.getItem(guestKey) || '{"days":{}}'));
      } catch {
        setState({ days: {} });
      }
      updateStatus("local");
      render();
      return;
    }
    try {
      engine = new PlanSync({
        store: supabaseStore(client, user.id),
        storage: localStorage,
        userId: user.id,
        onState: (state) => {
          setState(state);
          render();
        },
        onStatus: updateStatus,
        canRefresh: () =>
          !document.querySelector("dialog[open]") &&
          !["INPUT", "TEXTAREA", "SELECT"].includes(
            document.activeElement?.tagName,
          ),
      });
      setState(structuredClone(engine.cache.state));
      updateStatus("pending");
      render();
      await engine.tick();
    } catch {
      // Preserve unreadable account caches rather than falling back to overwriting them.
      engine = null;
      user = null;
      initializationError = true;
      updateStatus("error");
      render();
    }
  }
  async function init() {
    try {
      const response = await fetch(
        new URL("sync-config.json", document.baseURI),
        { cache: "no-store" },
      );
      if (!response.ok) throw Error();
      const config = await response.json();
      if (!config.url || !config.publishableKey) {
        initialized = true;
        return;
      }
      const url = new URL(config.url);
      if (
        url.protocol !== "https:" ||
        config.publishableKey.startsWith("sb_secret_")
      )
        throw Error();
      if (config.publishableKey.split(".").length === 3) {
        const payload = JSON.parse(
          atob(
            config.publishableKey
              .split(".")[1]
              .replace(/-/g, "+")
              .replace(/_/g, "/"),
          ),
        );
        if (payload.role !== "anon") throw Error();
      }
      client = createClient(url.href, config.publishableKey);
      client.auth.onAuthStateChange((_event, session) => {
        setTimeout(() => switchUser(session?.user ?? null), 0);
      });
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      initialized = true;
      await switchUser(data.session?.user ?? null);
    } catch {
      initialized = true;
      initializationError = true;
    }
  }
  function open() {
    if (!initialized) {
      show(
        "<h2>One moment</h2><p>Checking whether sharing is connected…</p><button data-close>Close</button>",
      );
      return;
    }
    if (!client || initializationError) {
      show(
        `<h2>Share across devices</h2><p>Your plans are safe on this device. Automatic sharing needs a private storage connection, which isn’t set up yet.</p><p>We’ll connect your Supabase project before you need to sign in.</p><button data-close>Keep using Clear Day</button>`,
      );
      return;
    }
    if (!user) {
      authForm();
      return;
    }
    if (engine?.conflict) {
      conflictForm();
      return;
    }
    show(
      `<div class="section-head"><h2>Your shared plans</h2><button data-close aria-label="Close">✕</button></div><p>Signed in as <strong>${html(user.email)}</strong>.</p><p>${html(messages[status])}</p>${detail ? '<p class="hint">Check your connection and storage setup, then retry. Your pending changes stay on this device.</p>' : ""}<p class="hint">On your phone, open this same website and sign in with the same account. Updates are checked every few seconds while the app is open.</p><div class="sharing-actions"><button id="sync-now">Sync now</button><button id="migrate">Copy device plans to account</button><button id="signout">Sign out</button></div><p id="account-message" role="status"></p>`,
    );
    document.querySelector("#sync-now").onclick = async () => {
      document.querySelector("#modal").close();
      await engine?.tick();
      open();
    };
    document.querySelector("#migrate").onclick = migrate;
    document.querySelector("#signout").onclick = async (e) => {
      if (
        engine?.cache.dirty &&
        !confirm(
          "Some changes have not synced. They will stay cached on this device for this account. Sign out?",
        )
      )
        return;
      e.target.disabled = true;
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) {
        document.querySelector("#account-message").textContent =
          "Could not sign out. Check your connection and try again.";
        e.target.disabled = false;
        return;
      }
      document.querySelector("#modal").close();
      await switchUser(null);
    };
  }
  function authForm(signup = false) {
    show(
      `<form id="sharing-auth"><div class="section-head"><h2>${signup ? "Create your account" : "Sign in to share"}</h2><button type="button" data-close aria-label="Close">✕</button></div><p>Use the same account on your Mac and phone.</p><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" autocomplete="${signup ? "new-password" : "current-password"}" minlength="8" required></label><p id="auth-message" role="status"></p><div class="form-actions"><button type="button" id="auth-switch">${signup ? "I already have an account" : "Create an account"}</button><button class="primary" type="submit">${signup ? "Create account" : "Sign in"}</button></div></form>`,
    );
    document.querySelector("#auth-switch").onclick = () => authForm(!signup);
    document.querySelector("#sharing-auth").onsubmit = async (e) => {
      e.preventDefault();
      const form = e.target;
      const values = Object.fromEntries(new FormData(form));
      const button = form.querySelector("[type=submit]");
      button.disabled = true;
      try {
        const { data, error } = signup
          ? await client.auth.signUp({
              ...values,
              options: { emailRedirectTo: location.origin + location.pathname },
            })
          : await client.auth.signInWithPassword(values);
        if (error) throw error;
        if (signup && !data.session) {
          document.querySelector("#auth-message").textContent =
            "Check your email to confirm your account, then return here to sign in.";
        } else {
          document.querySelector("#modal").close();
          await switchUser(data.user);
        }
      } catch (error) {
        const message = document.querySelector("#auth-message");
        if (message)
          message.textContent =
            error.message || "Could not sign in. Please try again.";
      } finally {
        button.disabled = false;
      }
    };
  }
  async function migrate() {
    const message = document.querySelector("#account-message");
    if (!engine || engine.running || status !== "synced") {
      message.textContent =
        "Please sync successfully first, then copy your device plans.";
      return;
    }
    try {
      const guest = JSON.parse(localStorage.getItem(guestKey) || '{"days":{}}');
      const meaningful = Object.entries(guest.days).filter(
        ([, p]) => p.text || p.tasks.length || p.dumps.length,
      );
      if (!meaningful.length) {
        message.textContent = "There are no device-only plans to copy.";
        return;
      }
      const current = getState();
      if (
        meaningful.some(([date]) => {
          const p = current.days[date];
          return p && (p.text || p.tasks.length || p.dumps.length);
        })
      ) {
        message.textContent =
          "Both copies contain plans for the same date. Export backups and review them before merging; nothing has been replaced.";
        return;
      }
      if (
        !confirm(
          "Copy your device-only plans into this account? A backup will download first. The originals will stay on this device.",
        )
      )
        return;
      download(
        JSON.stringify(guest, null, 2),
        "clear-day-before-sharing.json",
        "application/json",
      );
      const merged = structuredClone(current);
      for (const [date, p] of meaningful) merged.days[date] = p;
      engine.changed(merged);
      setState(merged);
      document.querySelector("#modal").close();
      render();
      await engine.tick();
    } catch {
      message.textContent =
        "Could not copy these plans. The originals are unchanged; export a backup before continuing.";
    }
  }
  function conflictForm() {
    show(
      `<h2>Two devices made changes</h2><p>Both copies are safe. Choose which complete set of plans to keep. Before continuing, the copy you don’t keep will download as a backup you can restore later.</p><p class="hint">Choosing a copy replaces the other shared version. You can use the backup to recover anything you want to keep.</p><div class="sharing-actions"><button id="keep-remote">Use shared copy</button><button id="keep-local">Use this device’s copy</button><button data-close>Decide later</button></div>`,
    );
    for (const [id, choice] of [
      ["#keep-remote", "remote"],
      ["#keep-local", "local"],
    ])
      document.querySelector(id).onclick = async () => {
        download(
          JSON.stringify(
            choice === "remote" ? engine.cache.state : engine.conflict.state,
            null,
            2,
          ),
          "clear-day-before-conflict-resolution.json",
          "application/json",
        );
        document.querySelector("#modal").close();
        engine.resolve(choice);
        render();
        await engine.tick();
      };
  }
  setInterval(() => {
    if (!document.hidden) engine?.tick();
  }, 8000);
  window.addEventListener("online", () => engine?.tick());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) engine?.tick();
  });
  window.addEventListener("focus", () => engine?.tick());
  return {
    init,
    get account() {
      return !!engine;
    },
    changed(state) {
      engine.changed(state);
      clearTimeout(uploadTimer);
      uploadTimer = setTimeout(() => engine?.tick(), 600);
    },
    markup() {
      return `<section class="sharing-bar"><span id="sharing-status" role="status">${html(messages[status])}</span><button id="sharing-open">${user ? "Account & sharing" : "Share across devices"}</button></section>`;
    },
    bind() {
      document.querySelector("#sharing-open").onclick = open;
    },
  };
}
