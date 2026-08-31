import { DatabaseSync } from 'node:sqlite';

export default class Database {
  constructor(path) {
    this.db = new DatabaseSync(path);
  }

  exec(sql) {
    return this.db.exec(sql);
  }

  pragma(str) {
    try {
      this.db.exec(`PRAGMA ${str}`);
    } catch {
      // ignore
    }
  }

  prepare(sql) {
    const stmt = this.db.prepare(sql);
    return {
      run: (...args) => stmt.run(...args),
      get: (...args) => stmt.get(...args),
      all: (...args) => stmt.all(...args),
    };
  }

  close() {
    return this.db.close();
  }
}
