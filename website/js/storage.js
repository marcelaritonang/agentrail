// =========================================================================
// StorageProvider — persistence abstraction.
//
// UI code MUST depend on this interface, never on localStorage directly.
// Swapping to Supabase/Firebase/SQLite later means writing a new provider
// class and changing ONE line (the `storage` export) — no UI refactor.
// =========================================================================

/**
 * @typedef {Object} Profile
 * @property {string} text         Free-text profile (background, skills, projects).
 * @property {number} updatedAt    Epoch ms of last save.
 */

/**
 * @typedef {Object} Draft
 * @property {string} kind         Document type (cover_letter | cv_bullets | ...).
 * @property {string} opportunity  Opportunity text.
 * @property {string} output       Last generated output.
 * @property {number} updatedAt    Epoch ms of last save.
 */

/**
 * Abstract contract. All methods async so remote providers drop in cleanly.
 * @interface
 */
export class StorageProvider {
  /** @returns {Promise<Profile|null>} */
  async loadProfile() { throw new Error("not implemented"); }
  /** @param {Profile} _profile @returns {Promise<void>} */
  async saveProfile(_profile) { throw new Error("not implemented"); }
  /** @returns {Promise<Draft|null>} */
  async loadDraft() { throw new Error("not implemented"); }
  /** @param {Draft} _draft @returns {Promise<void>} */
  async saveDraft(_draft) { throw new Error("not implemented"); }
  /** @returns {Promise<void>} */
  async clear() { throw new Error("not implemented"); }
}

/**
 * Browser localStorage implementation. Single-user, per-browser, offline.
 * Honest for an MVP with no auth — does not pretend to be multi-user.
 */
export class LocalStorageProvider extends StorageProvider {
  constructor(namespace = "applymate") {
    super();
    this._profileKey = `${namespace}:profile`;
    this._draftKey = `${namespace}:draft`;
  }

  _read(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null; // corrupt data or storage disabled — fail soft
    }
  }

  _write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // quota exceeded / private mode — swallow; caller stays functional
    }
  }

  async loadProfile() { return this._read(this._profileKey); }

  async saveProfile(profile) {
    this._write(this._profileKey, { ...profile, updatedAt: Date.now() });
  }

  async loadDraft() { return this._read(this._draftKey); }

  async saveDraft(draft) {
    this._write(this._draftKey, { ...draft, updatedAt: Date.now() });
  }

  async clear() {
    try {
      localStorage.removeItem(this._profileKey);
      localStorage.removeItem(this._draftKey);
    } catch { /* ignore */ }
  }
}

// The one line to change when migrating backends:
export const storage = new LocalStorageProvider();
