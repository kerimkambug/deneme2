import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import type { AppState, Booking, Customer } from '../src/types';

export interface CustomerRec extends Customer {
  passHash: string;
}

export type Config = Omit<AppState, 'bookings' | 'live' | 'version' | 'customers'>;
export const CONFIG_KEYS = ['settings', 'vehicles', 'locations', 'routes', 'extras', 'drivers'] as const;

export interface Store {
  init(): Promise<void>;
  getConfig(): Promise<Config | null>;
  setConfig(c: Config): Promise<void>;
  getAdminHash(): Promise<string | null>;
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
  data: { config: Config | null; admin: string | null; bookings: Record<string, Booking>; customers?: Record<string, CustomerRec> } = { config: null, admin: null, bookings: {}, customers: {} };
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
  async listBookings() { return Object.values(this.data.bookings); }
  async upsertBooking(b: Booking) { this.data.bookings[b.id] = b; this.save(); }
  async deleteBooking(id: string) { delete this.data.bookings[id]; this.save(); }
  async listCustomers() { return Object.values(this.data.customers ?? {}); }
  async upsertCustomer(c: CustomerRec) { (this.data.customers ??= {})[c.id] = c; this.save(); }
  async deleteCustomer(id: string) { delete this.data.customers?.[id]; this.save(); }
}

export function createStore(): Store {
  const url = process.env.DATABASE_URL;
  if (url) {
    console.log('[db] PostgreSQL');
    return new PgStore(url);
  }
  const file = process.env.DATA_FILE || path.resolve('data/db.json');
  console.log(`[db] JSON dosyası: ${file} (kalıcı değildir, canlıda DATABASE_URL kullanın)`);
  return new FileStore(file);
}
