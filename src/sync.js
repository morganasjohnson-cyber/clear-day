// A version check prevents one device from silently overwriting another.
export class PlanSync {
  constructor({
    store,
    storage,
    userId,
    onState,
    onStatus,
    canRefresh = () => true,
  }) {
    Object.assign(this, { store, storage, onState, onStatus, canRefresh });
    this.key = `clear-day-account-${userId}`;
    const cached = storage.getItem(this.key);
    this.cache = cached
      ? JSON.parse(cached)
      : { state: { days: {} }, version: null, dirty: false };
    this.generation = 0;
    this.stopped = false;
    this.running = false;
    this.conflict = null;
  }
  persist() {
    this.storage.setItem(this.key, JSON.stringify(this.cache));
  }
  changed(state) {
    this.cache.state = structuredClone(state);
    this.cache.dirty = true;
    this.generation++;
    this.persist();
    this.onStatus(this.conflict ? "conflict" : "pending");
  }
  stop() {
    this.stopped = true;
  }
  async tick() {
    if (this.running || this.stopped || this.conflict) return;
    this.running = true;
    try {
      this.onStatus("syncing");
      const remote = await this.store.read();
      if (this.stopped) return;
      const remoteVersion = remote?.version ?? null;
      if (this.cache.dirty) {
        if (remoteVersion !== this.cache.version) {
          this.conflict = remote ?? { state: { days: {} }, version: null };
          this.onStatus("conflict");
          return;
        }
        const generation = this.generation;
        const result = await this.store.write(
          structuredClone(this.cache.state),
          this.cache.version,
        );
        if (this.stopped) return;
        if (!result) {
          this.onStatus("pending");
          return;
        }
        this.cache.version = result.version;
        this.cache.dirty = generation !== this.generation;
        this.persist();
      } else if (
        remoteVersion !== this.cache.version ||
        this.cache.version === null
      ) {
        if (!this.canRefresh()) {
          this.onStatus("pending");
          return;
        }
        this.cache = {
          state: remote?.state ?? { days: {} },
          version: remoteVersion,
          dirty: false,
        };
        this.persist();
        this.onState(structuredClone(this.cache.state));
      }
      this.onStatus(this.cache.dirty ? "pending" : "synced");
    } catch (error) {
      if (!this.stopped) this.onStatus("error", error);
    } finally {
      this.running = false;
    }
  }
  resolve(choice) {
    if (!this.conflict) return;
    if (choice === "remote") {
      this.cache = {
        state: structuredClone(this.conflict.state),
        version: this.conflict.version,
        dirty: false,
      };
      this.onState(structuredClone(this.cache.state));
    } else {
      this.cache.version = this.conflict.version;
      this.cache.dirty = true;
    }
    this.conflict = null;
    this.persist();
    this.onStatus("pending");
  }
}
export function supabaseStore(client, userId) {
  return {
    async read() {
      const { data, error } = await client
        .from("clear_day_plans")
        .select("data,version")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data ? { state: data.data, version: data.version } : null;
    },
    async write(state, version) {
      let result;
      if (version === null) {
        result = await client
          .from("clear_day_plans")
          .insert({ user_id: userId, data: state, version: 1 })
          .select("version")
          .maybeSingle();
        if (result.error?.code === "23505") return null;
      } else {
        result = await client
          .from("clear_day_plans")
          .update({ data: state, version: version + 1 })
          .eq("user_id", userId)
          .eq("version", version)
          .select("version")
          .maybeSingle();
      }
      if (result.error) throw result.error;
      return result.data;
    },
  };
}

// Show useful diagnostics without exposing request URLs, tokens, or server payloads.
export function sharingProblem(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  if (/quota|storage|securityerror/i.test(message + ' ' + error?.name))
    return 'This browser could not save the local copy. Check that website storage is allowed and space is available. Export a backup before changing browser settings.';
  if (/fetch|network|load failed|offline|timeout/i.test(message))
    return 'This device could not reach the sharing service. Check its internet connection, then tap Sync now to retry.';
  if (/jwt|expired|session|refresh.?token/i.test(message) || code === 'PGRST301')
    return 'Your sign-in session needs attention. Export a backup of any pending changes before signing out and signing back in with the same Clear Day account.';
  if (code === '42501')
    return 'The sharing service refused access to these plans. The database permissions need checking; your device copy has not been removed.';
  if (['42P01','PGRST205','PGRST204'].includes(code))
    return 'The sharing service could not find the expected storage table. Its setup needs checking.';
  return 'The sharing service returned an unexpected error. Tap Sync now to retry and share the error reference if it continues.' + (/^[A-Z0-9_]{2,24}$/i.test(code) ? ` Reference: ${code}.` : '');
}
