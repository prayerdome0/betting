/**
 * Firestore paths owned by this application.
 *
 * Everything Nexus stores lives under ONE root document, `apps/nexus`, so the
 * simulation can share a Firebase project with other applications (the project
 * it is deployed into already serves other users). Earlier releases used
 * `users/{uid}` as the account document — the conventional home of a project's
 * primary profile — so a Nexus sign-in whose uid already had a profile there
 * found another application's document: the browser refused to render it as a
 * balance, the server refused to create or overwrite it, and the account could
 * never be initialized. Worse, both applications would have overwritten each
 * other's fields on every write.
 *
 * The namespace is a constant, not configuration: the browser, the server, the
 * worker and `firestore.rules` must all agree on it, and rules cannot read
 * environment variables. `users/{uid}` is never read or written by this code.
 *
 * This module is imported by both the browser bundle and the server, so it must
 * stay free of Firebase SDK imports.
 */
export const NEXUS_ROOT = "apps/nexus";

/** `apps/nexus/accounts/{uid}` — the authoritative simulation account. */
export const ACCOUNTS_COLLECTION = `${NEXUS_ROOT}/accounts`;
/** `apps/nexus/workQueue/{uid}` — server-only pointer to the active session. */
export const WORK_QUEUE_COLLECTION = `${NEXUS_ROOT}/workQueue`;
/** `apps/nexus/systemEvents/{id}` — admin-only errors and workflow audit. */
export const SYSTEM_EVENTS_COLLECTION = `${NEXUS_ROOT}/systemEvents`;
/** `apps/nexus/system/market` — the shared, explicitly synthetic feed. */
export const MARKET_DOCUMENT = `${NEXUS_ROOT}/system/market`;
/** `apps/nexus/system/worker` — worker heartbeat and operational status. */
export const WORKER_DOCUMENT = `${NEXUS_ROOT}/system/worker`;

export function accountPath(uid: string) {
  return `${ACCOUNTS_COLLECTION}/${uid}`;
}
export function workQueuePath(uid: string) {
  return `${WORK_QUEUE_COLLECTION}/${uid}`;
}
