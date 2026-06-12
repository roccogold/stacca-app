/** Client-side queue for hour entries when offline or server unreachable. */

export const LOCAL_ENTRY_PREFIX = "local:";

export type EntryPayload = {
  date: string;
  hours: number;
  mansione: string;
  luogo: string;
  area: string;
  note: string | null;
};

export type QueueOperation =
  | {
      queueId: string;
      kind: "create";
      userId: string;
      clientId: string;
      payload: EntryPayload;
      createdAt: number;
    }
  | {
      queueId: string;
      kind: "update";
      userId: string;
      serverId?: string;
      clientId?: string;
      payload: EntryPayload;
      createdAt: number;
    }
  | {
      queueId: string;
      kind: "delete";
      userId: string;
      serverId?: string;
      clientId?: string;
      createdAt: number;
    };

export type MergedEntry = {
  id: string;
  serverId: string | null;
  clientId: string | null;
  pending: boolean;
  date: string;
  hours: number;
  mansione: string;
  luogo: string;
  area: string;
  note: string | null;
};

const DB_NAME = "stacca-offline";
const DB_VERSION = 1;
const STORE = "ops";

function newQueueId(): string {
  return crypto.randomUUID();
}

export function newClientId(): string {
  return crypto.randomUUID();
}

export function toLocalEntryId(clientId: string): string {
  return `${LOCAL_ENTRY_PREFIX}${clientId}`;
}

export function parseLocalEntryId(id: string): string | null {
  if (!id.startsWith(LOCAL_ENTRY_PREFIX)) return null;
  const rest = id.slice(LOCAL_ENTRY_PREFIX.length);
  return rest.length > 0 ? rest : null;
}

export function isLocalEntryId(id: string): boolean {
  return id.startsWith(LOCAL_ENTRY_PREFIX);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB non disponibile"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "queueId" });
        store.createIndex("userId", "userId", { unique: false });
        store.createIndex("userCreated", ["userId", "createdAt"], { unique: false });
      }
    };
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    Promise.resolve(fn(store))
      .then((result) => {
        if (result instanceof IDBRequest) {
          result.onsuccess = () => resolve(result.result as T);
          result.onerror = () => reject(result.error ?? new Error("IDB request failed"));
        } else {
          resolve(result);
        }
      })
      .catch(reject);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error ?? new Error("IDB transaction failed"));
  });
}

export async function listQueueOps(userId: string): Promise<QueueOperation[]> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const index = store.index("userId");
      const req = index.getAll(userId);
      req.onsuccess = () => {
        const ops = (req.result as QueueOperation[]).sort((a, b) => a.createdAt - b.createdAt);
        resolve(ops);
      };
      req.onerror = () => reject(req.error ?? new Error("IDB read failed"));
      tx.oncomplete = () => db.close();
    });
  } catch {
    return [];
  }
}

async function putOp(op: QueueOperation): Promise<void> {
  await withStore("readwrite", (store) => store.put(op));
}

async function deleteOp(queueId: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(queueId));
}

export type FlushResult = {
  synced: number;
  failed: boolean;
  errorMessage?: string;
};

export async function flushOfflineQueue(userId: string): Promise<FlushResult> {
  const ops = await listQueueOps(userId);
  if (ops.length === 0) return { synced: 0, failed: false };

  const clientToServer = new Map<string, string>();
  let synced = 0;

  for (const op of ops) {
    try {
      const ok = await applyQueueOp(op, clientToServer);
      if (!ok.ok) {
        return { synced, failed: true, errorMessage: ok.error };
      }
      await deleteOp(op.queueId);
      synced += 1;
    } catch {
      return { synced, failed: true, errorMessage: "Connessione assente" };
    }
  }

  return { synced, failed: false };
}

async function applyQueueOp(
  op: QueueOperation,
  clientToServer: Map<string, string>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (op.kind === "create") {
    const res = await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(op.payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = typeof data.error === "string" ? data.error : "Errore nel salvataggio";
      return { ok: false, error: msg };
    }
    const entry = data.entry as { id: string };
    clientToServer.set(op.clientId, entry.id);
    return { ok: true };
  }

  if (op.kind === "update") {
    const id = op.serverId ?? (op.clientId ? clientToServer.get(op.clientId) : undefined);
    if (!id) return { ok: false, error: "Voce non trovata" };
    const res = await fetch(`/api/entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(op.payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = typeof data.error === "string" ? data.error : "Errore nell'aggiornamento";
      return { ok: false, error: msg };
    }
    return { ok: true };
  }

  const id = op.serverId ?? (op.clientId ? clientToServer.get(op.clientId) : undefined);
  if (id) {
    const res = await fetch(`/api/entries/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = typeof data.error === "string" ? data.error : "Errore nell'eliminazione";
      return { ok: false, error: msg };
    }
  }
  return { ok: true };
}

export async function postEntryOnline(payload: EntryPayload): Promise<
  | { ok: true; entry: { id: string } }
  | { ok: false; error: string; retryable: boolean }
> {
  try {
    const res = await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = typeof data.error === "string" ? data.error : "Errore nel salvataggio";
      return { ok: false, error: msg, retryable: isRetryableResponse(res) };
    }
    return { ok: true, entry: data.entry as { id: string } };
  } catch (e) {
    return {
      ok: false,
      error: "Connessione assente",
      retryable: isRetryableFetchError(e),
    };
  }
}

export async function patchEntryOnline(
  id: string,
  payload: EntryPayload,
): Promise<{ ok: true } | { ok: false; error: string; retryable: boolean }> {
  try {
    const res = await fetch(`/api/entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = typeof data.error === "string" ? data.error : "Errore nell'aggiornamento";
      return { ok: false, error: msg, retryable: isRetryableResponse(res) };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: "Connessione assente",
      retryable: isRetryableFetchError(e),
    };
  }
}

export async function deleteEntryOnline(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string; retryable: boolean }> {
  try {
    const res = await fetch(`/api/entries/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = typeof data.error === "string" ? data.error : "Errore nell'eliminazione";
      return { ok: false, error: msg, retryable: isRetryableResponse(res) };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: "Connessione assente",
      retryable: isRetryableFetchError(e),
    };
  }
}

export async function clearQueueForUser(userId: string): Promise<void> {
  const ops = await listQueueOps(userId);
  await Promise.all(ops.map((o) => deleteOp(o.queueId)));
}

/** Fold queue onto server rows for display (same order as sync). */
export function mergeEntriesWithQueue(
  serverEntries: Array<{
    id: string;
    date: string;
    hours: number;
    mansione: string;
    luogo: string;
    area?: string;
    note: string | null;
  }>,
  ops: QueueOperation[],
): MergedEntry[] {
  const byServer = new Map<string, MergedEntry>();
  for (const e of serverEntries) {
    byServer.set(e.id, {
      id: e.id,
      serverId: e.id,
      clientId: null,
      pending: false,
      date: e.date,
      hours: e.hours,
      mansione: e.mansione,
      luogo: e.luogo,
      area: e.area ?? "",
      note: e.note,
    });
  }
  const pendingByClient = new Map<string, MergedEntry>();

  for (const op of ops) {
    if (op.kind === "create") {
      pendingByClient.set(op.clientId, {
        id: toLocalEntryId(op.clientId),
        serverId: null,
        clientId: op.clientId,
        pending: true,
        ...op.payload,
      });
    } else if (op.kind === "update") {
      if (op.clientId && pendingByClient.has(op.clientId)) {
        const row = pendingByClient.get(op.clientId)!;
        Object.assign(row, op.payload);
      } else if (op.serverId && byServer.has(op.serverId)) {
        const row = byServer.get(op.serverId)!;
        Object.assign(row, op.payload);
        row.pending = true;
      }
    } else if (op.kind === "delete") {
      if (op.clientId) pendingByClient.delete(op.clientId);
      if (op.serverId) byServer.delete(op.serverId);
    }
  }

  return [...byServer.values(), ...pendingByClient.values()];
}

export function filterMergedByDate(entries: MergedEntry[], date: string): MergedEntry[] {
  return entries.filter((e) => e.date === date);
}

export function filterMergedByMonth(entries: MergedEntry[], monthPrefix: string): MergedEntry[] {
  return entries.filter((e) => e.date.startsWith(monthPrefix));
}

export function sumHours(entries: MergedEntry[]): number {
  return entries.reduce((a, e) => a + e.hours, 0);
}

export async function getPendingCount(userId: string): Promise<number> {
  const ops = await listQueueOps(userId);
  return ops.length;
}

/** Add or replace a pending create. */
export async function enqueueCreate(
  userId: string,
  clientId: string,
  payload: EntryPayload,
): Promise<void> {
  const ops = await listQueueOps(userId);
  const existing = ops.find(
    (o): o is Extract<QueueOperation, { kind: "create" }> =>
      o.kind === "create" && o.clientId === clientId,
  );
  if (existing) {
    await putOp({ ...existing, payload });
    return;
  }
  await putOp({
    queueId: newQueueId(),
    kind: "create",
    userId,
    clientId,
    payload,
    createdAt: Date.now(),
  });
}

/** Update pending create in place, or append update op for server row. */
export async function enqueueSave(
  userId: string,
  opts: {
    serverId?: string | null;
    clientId?: string | null;
    payload: EntryPayload;
  },
): Promise<{ localEntryId?: string }> {
  const { serverId, clientId, payload } = opts;

  if (clientId) {
    const ops = await listQueueOps(userId);
    const createOp = ops.find(
      (o): o is Extract<QueueOperation, { kind: "create" }> =>
        o.kind === "create" && o.clientId === clientId,
    );
    if (createOp) {
      await putOp({ ...createOp, payload });
      return { localEntryId: toLocalEntryId(clientId) };
    }
  }

  if (serverId) {
    const ops = await listQueueOps(userId);
    const pendingUpdate = ops.find(
      (o): o is Extract<QueueOperation, { kind: "update" }> =>
        o.kind === "update" && o.serverId === serverId,
    );
    if (pendingUpdate) {
      await putOp({ ...pendingUpdate, payload });
      return {};
    }
    await putOp({
      queueId: newQueueId(),
      kind: "update",
      userId,
      serverId,
      payload,
      createdAt: Date.now(),
    });
    return {};
  }

  const newClient = clientId ?? newClientId();
  await enqueueCreate(userId, newClient, payload);
  return { localEntryId: toLocalEntryId(newClient) };
}

/** Remove pending create or queue delete for synced row. */
export async function enqueueDelete(
  userId: string,
  opts: { serverId?: string | null; clientId?: string | null },
): Promise<void> {
  const ops = await listQueueOps(userId);
  const { serverId, clientId } = opts;

  if (clientId) {
    const related = ops.filter(
      (o) =>
        (o.kind === "create" && o.clientId === clientId) ||
        (o.kind === "update" && o.clientId === clientId),
    );
    if (related.length > 0) {
      await Promise.all(related.map((o) => deleteOp(o.queueId)));
      return;
    }
  }

  if (serverId) {
    const related = ops.filter(
      (o) =>
        (o.kind === "update" && o.serverId === serverId) ||
        (o.kind === "delete" && o.serverId === serverId),
    );
    await Promise.all(related.map((o) => deleteOp(o.queueId)));
    await putOp({
      queueId: newQueueId(),
      kind: "delete",
      userId,
      serverId,
      createdAt: Date.now(),
    });
  }
}

export async function getPendingEntryByLocalId(
  userId: string,
  localEntryId: string,
): Promise<MergedEntry | null> {
  const clientId = parseLocalEntryId(localEntryId);
  if (!clientId) return null;
  const ops = await listQueueOps(userId);
  const merged = mergeEntriesWithQueue([], ops);
  return merged.find((e) => e.clientId === clientId) ?? null;
}

export function isRetryableFetchError(err: unknown): boolean {
  if (!navigator.onLine) return true;
  if (err instanceof TypeError) return true;
  return false;
}

export function isRetryableResponse(res: Response): boolean {
  if (res.status === 503) return true;
  if (res.status >= 500) return true;
  return false;
}
