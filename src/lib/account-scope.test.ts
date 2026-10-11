import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Account-switch isolation check for on-device data.
 *
 * Simulates one shared device: a parent account and a teacher account
 * sign in one after another. Asserts that every local store key is
 * namespaced to the signed-in account + role, that a view running under
 * one account can never read another account's local entries, that
 * entries stay available to their owning account, and that pre-scoping
 * (legacy, unowned) entries are claimed exactly once — by the first
 * account to sign in after the change — and never surface for a later,
 * different account.
 */

class FakeStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  keys(): string[] {
    return [...this.map.keys()];
  }
}

const device = new FakeStorage();
(globalThis as { window?: unknown }).window = { localStorage: device };

const {
  activateAccountScope,
  clearAccountScope,
  createAccountScopedStorage,
  getAccountScope,
  scopedStorageKey,
} = await import("./account-scope.ts");

const LEDGER = "kiddo-ledger-v2";
const TEACHER = "pillarpath-teacher-v1";
const PARENT_A = { id: "user-a", role: "parent" };
const TEACHER_B = { id: "user-b", role: "teacher" };

const parentLedgerJson = JSON.stringify({
  state: { childName: "Alex", balance: 42, history: [{ note: "A's entry" }] },
  version: 0,
});
const legacyTeacherJson = JSON.stringify({
  state: { classrooms: [{ name: "Legacy class" }] },
  version: 0,
});
const teacherDataJson = JSON.stringify({
  state: { classrooms: [{ name: "B's class" }] },
  version: 0,
});

describe("per-account on-device scoping (shared device)", () => {
  it("claims pre-scoping legacy entries into the first account that signs in", () => {
    // A device that ran the old build: unscoped, ownerless entries.
    device.setItem(LEDGER, parentLedgerJson);
    device.setItem(TEACHER, legacyTeacherJson);

    const result = activateAccountScope(PARENT_A.id, PARENT_A.role);
    assert.equal(result, "changed");
    assert.equal(getAccountScope(), "parent:user-a");

    // Legacy copies moved under A's scope; nothing unscoped remains.
    assert.equal(device.getItem(LEDGER), null);
    assert.equal(device.getItem(`${LEDGER}@parent:user-a`), parentLedgerJson);
  });

  it("parent A's view reads A's ledger entries under A's scope only", () => {
    const storage = createAccountScopedStorage();
    assert.equal(storage.getItem(LEDGER), parentLedgerJson);
    assert.equal(scopedStorageKey(LEDGER), `${LEDGER}@parent:user-a`);
  });

  it("after sign-out, no account data is readable from the signed-out scope", () => {
    clearAccountScope();
    assert.equal(getAccountScope(), "signed-out");
    const storage = createAccountScopedStorage();
    assert.equal(storage.getItem(LEDGER), null);
    assert.equal(storage.getItem(TEACHER), null);
  });

  it("teacher B's view contains none of parent A's local ledger entries", () => {
    const result = activateAccountScope(TEACHER_B.id, TEACHER_B.role);
    assert.equal(result, "changed");
    const storage = createAccountScopedStorage();
    // The core isolation guarantee: B's scopes are empty of A's data.
    assert.equal(storage.getItem(LEDGER), null);
    assert.equal(storage.getItem(TEACHER), null);
    // No unscoped or A-scoped key was copied into B's namespace.
    assert.deepEqual(
      device.keys().filter((k) => k.includes("user-b")),
      [],
    );
  });

  it("B's own writes land only in B's scope and stay invisible to A", () => {
    const storage = createAccountScopedStorage();
    storage.setItem(TEACHER, teacherDataJson);
    assert.equal(device.getItem(`${TEACHER}@teacher:user-b`), teacherDataJson);

    activateAccountScope(PARENT_A.id, PARENT_A.role);
    const storageA = createAccountScopedStorage();
    // Under A's scope, A sees A's own (claimed legacy) teacher slice —
    // never B's "B's class" write, which lives only in B's scope.
    assert.equal(storageA.getItem(TEACHER), legacyTeacherJson);
    assert.notEqual(storageA.getItem(TEACHER), teacherDataJson);
    // And A's own ledger entries are still there, untouched.
    assert.equal(storageA.getItem(LEDGER), parentLedgerJson);
  });

  it("keys are role-sensitive: the same id under another role is a different scope", () => {
    activateAccountScope(PARENT_A.id, "teacher");
    assert.equal(scopedStorageKey(LEDGER), `${LEDGER}@teacher:user-a`);
    const storage = createAccountScopedStorage();
    assert.equal(storage.getItem(LEDGER), null);
    activateAccountScope(PARENT_A.id, PARENT_A.role);
    assert.equal(createAccountScopedStorage().getItem(LEDGER), parentLedgerJson);
  });

  it("legacy claim runs once: a later account never inherits leftover unscoped entries", () => {
    // An unscoped entry appearing after the one-time claim (e.g. written
    // by an old cached build) must stay isolated, not surface for C.
    device.setItem(LEDGER, JSON.stringify({ state: { childName: "Ghost" } }));
    activateAccountScope("user-c", "parent");
    const storage = createAccountScopedStorage();
    assert.equal(storage.getItem(LEDGER), null);
    assert.equal(device.getItem(`${LEDGER}@parent:user-c`), null);
  });
});
