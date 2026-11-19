import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { MongoClient, type Collection, type Db } from 'mongodb';
import type { AppState, Booking, Customer } from '../src/types';

export interface CustomerRec extends Customer {
  passHash: string;
}

export type Config = Omit<AppState, 'bookings' | 'live' | 'version' | 'customers' | 'expenses' | 'settlements'>;
export const CONFIG_KEYS = ['settings', 'vehicles', 'locations', 'routes', 'extras', 'drivers', 'fleet'] as const;

export interface Store {
  init(): Promise<void>;
  getConfig(): Promise<Config | null>;
  setConfig(c: Config): Promise<void>;
  getAdminHash(): Promise<string | null>;
  /** Tek seferlik veri güncellemelerinin kaydı */
  getMigrations(): Promise<string[]>;
  /** Genel amaçlı anahtar-değer kaydı */
  getKv<T>(key: string): Promise<T | null>;
  setKv(key: string, value: unknown): Promise<void>;
  addMigration(name: string): Promise<void>;
  setAdminHash(h: string): Promise<void>;
  listBookings(): Promise<Booking[]>;
  upsertBooking(b: Booking): Promise<void>;
  deleteBooking(id: string): Promise<void>;
  listCustomers(): Promise<CustomerRec[]>;
  upsertCustomer(c: CustomerRec): Promise<void>;
  deleteCustomer(id: string): Promise<void>;
}

/* ---------------- PostgreSQL ---------------- */
class PgStore implements Store {
  pool: pg.Pool;
  constructor(url: string) {
    const local = /localhost|127\.0\.0\.1/.test(url);
    this.pool = new pg.Pool({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false }, max: 5 });
  }
  async init() {
    await this.pool.query(`
      create table if not exists kv (key text primary key, value jsonb not null, updated_at timestamptz default now());
      create table if not exists bookings (id text primary key, code text unique not null, data jsonb not null, updated_at timestamptz default now());
      create table if not exists customers (id text primary key, email text unique not null, data jsonb not null, created_at timestamptz default now());
    `);
  }
  private async kvGet<T>(key: string): Promise<T | null> {
    const r = await this.pool.query('select value from kv where key=$1', [key]);
    return r.rows[0]?.value ?? null;
  }
  private async kvSet(key: string, value: unknown) {
    await this.pool.query(
      'insert into kv(key,value,updated_at) values($1,$2,now()) on conflict(key) do update set value=excluded.value, updated_at=now()',
      [key, JSON.stringify(value)],
    );
  }
  getConfig() { return this.kvGet<Config>('config'); }
  setConfig(c: Config) { return this.kvSet('config', c); }
  async getAdminHash() { return (await this.kvGet<{ h: string }>('admin'))?.h ?? null; }
  setAdminHash(h: string) { return this.kvSet('admin', { h }); }
  getKv<T>(key: string) { return this.kvGet<T>(key); }
  setKv(key: string, value: unknown) { return this.kvSet(key, value); }
  async getMigrations() { return (await this.kvGet<string[]>('migrations')) ?? []; }
  async addMigration(name: string) { await this.kvSet('migrations', [...(await this.getMigrations()), name]); }
  async listBookings() {
    const r = await this.pool.query('select data from bookings order by data->>\'date\', data->>\'time\'');
    return r.rows.map((x) => x.data as Booking);
  }
  async upsertBooking(b: Booking) {
    await this.pool.query(
      'insert into bookings(id,code,data,updated_at) values($1,$2,$3,now()) on conflict(id) do update set data=excluded.data, updated_at=now()',
      [b.id, b.code, JSON.stringify(b)],
    );
  }
  async deleteBooking(id: string) { await this.pool.query('delete from bookings where id=$1', [id]); }
  async listCustomers() {
    const r = await this.pool.query('select data from customers');
    return r.rows.map((x) => x.data as CustomerRec);
  }
  async upsertCustomer(c: CustomerRec) {
    await this.pool.query(
      'insert into customers(id,email,data) values($1,$2,$3) on conflict(id) do update set email=excluded.email, data=excluded.data',
      [c.id, c.email, JSON.stringify(c)],
    );
  }
  async deleteCustomer(id: string) { await this.pool.query('delete from customers where id=$1', [id]); }
}

/* ---------------- JSON dosyası (yerel geliştirme) ---------------- */
class FileStore implements Store {
  file: string;
  data: { config: Config | null; admin: string | null; bookings: Record<string, Booking>; customers?: Record<string, CustomerRec>; migrations?: string[]; kv?: Record<string, unknown> } = { config: null, admin: null, bookings: {}, customers: {}, migrations: [] };
  constructor(file: string) { this.file = file; }
  async init() {
    try {
      this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {
      /* yeni dosya */
    }
  }
  private save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data));
  }
  async getConfig() { return this.data.config; }
  async setConfig(c: Config) { this.data.config = c; this.save(); }
  async getAdminHash() { return this.data.admin; }
  async setAdminHash(h: string) { this.data.admin = h; this.save(); }
  async getKv<T>(key: string) { return (this.data.kv?.[key] as T) ?? null; }
  async setKv(key: string, value: unknown) { (this.data.kv ??= {})[key] = value; this.save(); }
  async getMigrations() { return this.data.migrations ?? []; }
  async addMigration(name: string) { (this.data.migrations ??= []).push(name); this.save(); }
  async listBookings() { return Object.values(this.data.bookings); }
  async upsertBooking(b: Booking) { this.data.bookings[b.id] = b; this.save(); }
  async deleteBooking(id: string) { delete this.data.bookings[id]; this.save(); }
  async listCustomers() { return Object.values(this.data.customers ?? {}); }
  async upsertCustomer(c: CustomerRec) { (this.data.customers ??= {})[c.id] = c; this.save(); }
  async deleteCustomer(id: string) { delete this.data.customers?.[id]; this.save(); }
}

/* ---------------- MongoDB (Atlas) ---------------- */
type KvDoc = { _id: string; value: unknown };
type DataDoc<T> = { _id: string; data: T; code?: string; email?: string };

class MongoStore implements Store {
  client: MongoClient;
  db!: Db;
  kv!: Collection<KvDoc>;
  bookingsCol!: Collection<DataDoc<Booking>>;
  customersCol!: Collection<DataDoc<CustomerRec>>;
  constructor(url: string) {
    this.client = new MongoClient(url, { maxPoolSize: 5, serverSelectionTimeoutMS: 15000 });
  }
  async init() {
    await this.client.connect();
    // Adreste veritabanı adı yoksa 'viptransfer' kullanılır
    this.db = this.client.db(process.env.MONGODB_DB || undefined);
    if (this.db.databaseName === 'test') this.db = this.client.db('viptransfer');
    this.kv = this.db.collection<KvDoc>('kv');
    this.bookingsCol = this.db.collection<DataDoc<Booking>>('bookings');
    this.customersCol = this.db.collection<DataDoc<CustomerRec>>('customers');
    await this.bookingsCol.createIndex({ code: 1 }, { unique: true });
    await this.customersCol.createIndex({ email: 1 }, { unique: true });
  }
  async getKv<T>(key: string) {
    const d = await this.kv.findOne({ _id: key });
    return (d?.value as T) ?? null;
  }
  async setKv(key: string, value: unknown) {
    await this.kv.updateOne({ _id: key }, { $set: { value } }, { upsert: true });
  }
  getConfig() { return this.getKv<Config>('config'); }
  setConfig(c: Config) { return this.setKv('config', c); }
  async getAdminHash() { return (await this.getKv<{ h: string }>('admin'))?.h ?? null; }
  setAdminHash(h: string) { return this.setKv('admin', { h }); }
  async getMigrations() { return (await this.getKv<string[]>('migrations')) ?? []; }
  async addMigration(name: string) { await this.setKv('migrations', [...(await this.getMigrations()), name]); }
  async listBookings() {
    const rows = await this.bookingsCol.find({}).toArray();
    return rows.map((r) => r.data).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  }
  async upsertBooking(b: Booking) {
    await this.bookingsCol.updateOne({ _id: b.id }, { $set: { code: b.code, data: b } }, { upsert: true });
  }
  async deleteBooking(id: string) { await this.bookingsCol.deleteOne({ _id: id }); }
  async listCustomers() {
    return (await this.customersCol.find({}).toArray()).map((r) => r.data);
  }
  async upsertCustomer(c: CustomerRec) {
    await this.customersCol.updateOne({ _id: c.id }, { $set: { email: c.email, data: c } }, { upsert: true });
  }
  async deleteCustomer(id: string) { await this.customersCol.deleteOne({ _id: id }); }
}

/** Boş hedefe eski veritabanındaki her şeyi kopyalar (yalnızca hedef boşsa). */
async function copyAll(from: Store, to: Store) {
  const cfg = await from.getConfig();
  if (!cfg) return false;
  for (const b of await from.listBookings()) await to.upsertBooking(b);
  for (const c of await from.listCustomers()) await to.upsertCustomer(c);
  const admin = await from.getAdminHash();
  if (admin) await to.setAdminHash(admin);
  // Tek seferlik güncelleme kayıtları (depo türüne göre farklı yerde tutulur)
  const done = await to.getMigrations();
  for (const m of await from.getMigrations()) if (!done.includes(m)) await to.addMigration(m);
  for (const k of ['vapid', 'push-subs', 'ledger']) {
    const v = await from.getKv(k);
    if (v != null) await to.setKv(k, v);
  }
  // sohbetler (chat:<rezervasyon id>)
  for (const b of await from.listBookings()) {
    const c = await from.getKv(`chat:${b.id}`);
    if (c != null) await to.setKv(`chat:${b.id}`, c);
  }
  await to.setConfig(cfg); // en son: config yazılınca taşıma tamamlanmış sayılır
  return true;
}

/** MongoDB önce init edilir; boşsa ve PostgreSQL adresi de verilmişse veriler taşınır. */
class MigratingStore implements Store {
  constructor(private target: Store, private source?: Store) {}
  async init() {
    await this.target.init();
    if (this.source && !(await this.target.getConfig())) {
      try {
        await this.source.init();
        if (await copyAll(this.source, this.target)) console.log('[db] PostgreSQL verileri MongoDB\'ye taşındı');
      } catch (e) {
        console.warn('[db] Eski veritabanından taşınamadı (boş başlanıyor):', (e as Error).message);
      }
    }
  }
  getConfig() { return this.target.getConfig(); }
  setConfig(c: Config) { return this.target.setConfig(c); }
  getAdminHash() { return this.target.getAdminHash(); }
  setAdminHash(h: string) { return this.target.setAdminHash(h); }
  getMigrations() { return this.target.getMigrations(); }
  addMigration(n: string) { return this.target.addMigration(n); }
  getKv<T>(k: string) { return this.target.getKv<T>(k); }
  setKv(k: string, v: unknown) { return this.target.setKv(k, v); }
  listBookings() { return this.target.listBookings(); }
  upsertBooking(b: Booking) { return this.target.upsertBooking(b); }
  deleteBooking(id: string) { return this.target.deleteBooking(id); }
  listCustomers() { return this.target.listCustomers(); }
  upsertCustomer(c: CustomerRec) { return this.target.upsertCustomer(c); }
  deleteCustomer(id: string) { return this.target.deleteCustomer(id); }
}

export function createStore(): Store {
  // Kopyala-yapıştırda gelen baştaki/sondaki boşluklar bağlantıyı bozmasın
  const mongo = process.env.MONGODB_URI?.trim();
  const pg = process.env.DATABASE_URL?.trim();
  if (mongo) {
    console.log('[db] MongoDB');
    return new MigratingStore(new MongoStore(mongo), pg ? new PgStore(pg) : undefined);
  }
  if (pg) {
    console.log('[db] PostgreSQL');
    return new PgStore(pg);
  }
  const file = process.env.DATA_FILE || path.resolve('data/db.json');
  console.log(`[db] JSON dosyası: ${file} (kalıcı değildir, canlıda MONGODB_URI veya DATABASE_URL kullanın)`);
  return new FileStore(file);
}

/** Testler için: verilen iki depo arasında taşıma */
export const _test = { copyAll, MigratingStore, MongoStore, FileStore };
