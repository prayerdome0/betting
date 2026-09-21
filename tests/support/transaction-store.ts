/**
 * Test double ONLY. Never imported by src/, scripts/, or deployed services.
 * It tests transaction/state-machine contracts, NOT Firebase security rules,
 * gRPC, Auth, indexes, or network behavior. Official-emulator tests cover those.
 */
import { randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
type Row = Record<string, unknown>;
class Reference {
  constructor(readonly path: string) {}
  get id() {
    return this.path.split("/").at(-1)!;
  }
  collection(name: string) {
    return new Collection(`${this.path}/${name}`);
  }
}
class Collection {
  constructor(
    readonly path: string,
    readonly filters: [string, unknown][] = [],
  ) {}
  doc(id = randomUUID()) {
    return new Reference(`${this.path}/${id}`);
  }
  where(field: string, operator: string, value: unknown) {
    if (operator !== "==") throw new Error("Unsupported test query");
    return new Collection(this.path, [...this.filters, [field, value]]);
  }
}
const snapshot = (ref: Reference, value: Row | undefined) => ({
  id: ref.id,
  ref,
  exists: !!value,
  data: () => structuredClone(value),
});
class Transaction {
  private writing = false;
  readonly writes: {
    ref: Reference;
    data?: Row;
    type: "set" | "create" | "update" | "delete";
  }[] = [];
  constructor(private readonly source: Map<string, Row>) {}
  async get(target: Reference | Collection) {
    if (this.writing)
      throw new Error("All Firestore reads must precede writes.");
    if (target instanceof Reference)
      return snapshot(target, this.source.get(target.path));
    const rows = [...this.source.entries()].filter(
      ([path, row]) =>
        path.startsWith(target.path + "/") &&
        path.split("/").length === target.path.split("/").length + 1 &&
        target.filters.every(([key, value]) => row[key] === value),
    );
    return {
      empty: rows.length === 0,
      size: rows.length,
      docs: rows.map(([path, row]) => snapshot(new Reference(path), row)),
    };
  }
  set(ref: Reference, data: Row) {
    this.writing = true;
    this.writes.push({ ref, data: structuredClone(data), type: "set" });
  }
  create(ref: Reference, data: Row) {
    this.writing = true;
    this.writes.push({ ref, data: structuredClone(data), type: "create" });
  }
  update(ref: Reference, data: Row) {
    this.writing = true;
    this.writes.push({ ref, data: structuredClone(data), type: "update" });
  }
  delete(ref: Reference) {
    this.writing = true;
    this.writes.push({ ref, type: "delete" });
  }
  commit() {
    const next = new Map(this.source);
    for (const write of this.writes) {
      if (write.type === "create" && next.has(write.ref.path))
        throw new Error("Document already exists.");
      if (write.type === "update" && !next.has(write.ref.path))
        throw new Error("Document does not exist.");
      if (write.type === "delete") next.delete(write.ref.path);
      else
        next.set(
          write.ref.path,
          write.type === "update"
            ? { ...next.get(write.ref.path), ...write.data }
            : write.data!,
        );
    }
    this.source.clear();
    for (const [path, data] of next) this.source.set(path, data);
  }
}
export class TransactionStore {
  private documents = new Map<string, Row>();
  private tail = Promise.resolve();
  abortNextCommit = false;
  retryNextCommit: (() => void) | null = null;
  readonly firestore = this as unknown as Firestore;
  doc(path: string) {
    return new Reference(path);
  }
  collection(path: string) {
    return new Collection(path);
  }
  seed(path: string, data: object) {
    this.documents.set(path, structuredClone(data) as Row);
  }
  read<T>(path: string): T {
    return structuredClone(this.documents.get(path)) as T;
  }
  list<T>(path: string): T[] {
    return [...this.documents.entries()]
      .filter(
        ([key]) =>
          key.startsWith(path + "/") &&
          key.split("/").length === path.split("/").length + 1,
      )
      .map(([, row]) => structuredClone(row) as T);
  }
  dump() {
    return structuredClone([...this.documents.entries()]);
  }
  async runTransaction<T>(fn: (tx: Transaction) => Promise<T>) {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      let tx = new Transaction(this.documents);
      let result = await fn(tx);
      if (this.retryNextCommit) {
        const retry = this.retryNextCommit;
        this.retryNextCommit = null;
        retry();
        tx = new Transaction(this.documents);
        result = await fn(tx);
      }
      if (this.abortNextCommit) {
        this.abortNextCommit = false;
        throw new Error("Injected transaction commit failure");
      }
      tx.commit();
      return result;
    } finally {
      release();
    }
  }
}
