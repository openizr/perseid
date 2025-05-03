import v from 'module';

const I = Object.defineProperty; const P = Object.defineProperties; const q = Object.getOwnPropertyDescriptors; const M = Object.getOwnPropertySymbols; const A = Object.prototype.hasOwnProperty; const O = Object.prototype.propertyIsEnumerable; const T = (n, e, t) => (e in n ? I(n, e, {
  enumerable: !0, configurable: !0, writable: !0, value: t,
}) : n[e] = t); const p = (n, e) => { for (var t in e || (e = {})) A.call(e, t) && T(n, t, e[t]); if (M) for (var t of M(e)) O.call(e, t) && T(n, t, e[t]); return n; }; const R = (n, e) => P(n, q(e)); const f = (n, e, t) => new Promise((r, a) => { const s = (i) => { try { d(t.next(i)); } catch (c) { a(c); } }; const o = (i) => { try { d(t.throw(i)); } catch (c) { a(c); } }; var d = (i) => (i.done ? r(i.value) : Promise.resolve(i.value).then(s, o)); d((t = t.apply(n, e)).next()); });

const S = typeof window !== 'undefined' ? null : v.createRequire('/'); const B = (n) => n.toString(16); const l = class l {
  constructor(e) { this.idRegExp = /^[a-f0-9]{24}$/; this.mask = 16777215; typeof window !== 'undefined' ? (this.value = this.idRegExp.test(String(e)) ? e : this.generate(), this.id = this.value) : (this.value = this.idRegExp.test(String(e)) ? Buffer.from(String(e), 'hex') : this.generate(), this.id = this.value.toString('hex')); }

  getCounter() { return l.index = (l.index + 1) % this.mask, l.index; }

  generate() { if (typeof window !== 'undefined') { l.uniqueId === null && (l.uniqueId = Array.prototype.map.call(window.crypto.getRandomValues(new Uint32Array(3)), B).join('').slice(0, 10)); const r = Math.floor(Date.now() / 1e3).toString(16); const a = l.uniqueId; const s = this.getCounter(); const o = ((s >> 16 & this.mask) + (s >> 8 & this.mask) + (s & this.mask)).toString(16).slice(0, 6); return `${r}${a}${o}`; } l.uniqueId === null && (l.uniqueId = (S == null ? void 0 : S('crypto')).randomBytes(5)); const e = Buffer.alloc(12); e.writeUInt32BE(Math.floor(Date.now() / 1e3), 0), [e[4], e[5], e[6], e[7], e[8]] = l.uniqueId; const t = this.getCounter(); return e[11] = t & 255, e[10] = t >> 8 & 255, e[9] = t >> 16 & 255, e; }

  toString() { return this.id; }

  valueOf() { return this.id; }

  toJSON() { return this.id; }
}; l.uniqueId = null, l.index = Math.floor(Math.random() * 16777215); const h = l; const g = class {
  constructor(e, t) { this.logger = e, this.labels = t, this.specialChar = '', this.t = this.t.bind(this), this.numeric = this.numeric.bind(this), this.dateTime = this.dateTime.bind(this); }

  t(e, t = {}) { let r = this.labels; const a = e.split('.'); for (; a.length > 0 && r !== void 0;)r = r[String(a.shift())]; if (r === void 0) return this.logger.error(`Missing translation for label "${e}".`), e; const s = Object.keys(t); let o = r; for (let d = 0, { length: i } = s; d < i; d += 1) { const c = s[d]; o = o.replace(new RegExp(`{{${c}}}`, 'g'), t[c]); } return o; }

  numeric(e) { return `${this.specialChar}${String(e)}`; }

  dateTime(e) { const t = e.toISOString().split('T'); return `${this.specialChar}${t[0].replace(/-/g, '/')} ${t[1].slice(0, 8)}`; }
}; const b = class {
  constructor(e) {
    const t = p({}, e); Object.keys(t).forEach((r) => {
      let s; let o; let d; const a = {
        version: t[r].version, enableAuthors: (s = t[r].enableAuthors) != null ? s : !1, enableDeletion: (o = t[r].enableDeletion) != null ? o : !0, enableTimestamps: (d = t[r].enableTimestamps) != null ? d : !1, fields: { _id: { type: 'id', isUnique: !0, isRequired: !0 } },
      }; if (a.version !== void 0 && (a.fields._version = { type: 'integer', isIndexed: !0, isRequired: !0 }), a.enableDeletion || (a.fields._isDeleted = { type: 'boolean', isIndexed: !0, isRequired: !0 }), a.enableAuthors) {
        const i = {
          type: 'id', isIndexed: !0, isRequired: r !== 'users', relation: 'users',
        }; const c = { type: 'id', isIndexed: !0, relation: 'users' }; a.fields._createdBy = i, a.fields._updatedBy = c;
      } a.enableTimestamps && (a.fields._createdAt = { type: 'date', isIndexed: !0, isRequired: !0 }, a.fields._updatedAt = { type: 'date', isIndexed: !0 }), t[r] = R(p(p({}, a), t[r]), { fields: p(p({}, a.fields), t[r].fields) });
    }), this.schema = t;
  }

  getResources() { return Object.keys(this.schema); }

  get(e) { let o; const t = e.split('.'); const r = t.shift(); let a = [r]; let s = this.schema[r]; for (; t.length > 0 && s !== void 0;) { const d = String(t.shift()); if (a.push(d), s = (o = s.fields) == null ? void 0 : o[d], (s == null ? void 0 : s.type) === 'array' && (s = s.fields), (s == null ? void 0 : s.type) === 'id' && s.relation !== void 0 && t.length > 0) { const { relation: i } = s; a = [i], s = { type: 'object', fields: this.get(i).schema.fields }; } } return s === void 0 ? null : { schema: s, canonicalPath: a }; }
}; const x = class { }; function k(n, e) { return f(this, null, function* () { for (let t = 0; t < n.length; t += 1) yield e(n[t], t); }); } function u(n) { return n !== null && typeof n === 'object' && (n.constructor === void 0 || n.constructor.name === 'Object'); } function m(n) { if (Array.isArray(n)) { const e = []; for (let t = 0, { length: r } = n; t < r; t += 1)e[t] = m(n[t]); return e; } if (u(n)) { const e = {}; const t = Object.keys(n); for (let r = 0, { length: a } = t; r < a; r += 1)e[t[r]] = m(n[t[r]]); return e; } return n; } function y(n, e) { if (Array.isArray(n) && Array.isArray(e)) { const t = []; const r = Math.max(n.length, e.length); for (let a = 0; a < r; a += 1)t[a] = y(n[a], e[a]); return t; } if (u(n) && u(e)) { const t = Object.keys(e); const r = m(n); for (let a = 0, { length: s } = t; a < s; a += 1)r[t[a]] = y(n[t[a]], e[t[a]]); return r; } return e !== void 0 ? m(e) : m(n); } const D = class {
  rawRequest(e) {
    return f(this, null, function* () {
      let s; let { body: t } = e; const r = p({}, e.headers); e.body instanceof FormData ? r['Content-Type'] = 'multipart/form-data' : u(e.body) && (t = JSON.stringify(t), r['Content-Type'] = 'application/json'); const a = yield fetch(e.url, {
        redirect: 'manual', body: t, method: e.method, headers: r, signal: AbortSignal.timeout(this.connectTimeout),
      }); if (a.status >= 400) {
        throw {
          body: (s = a.headers.get('content-type')) != null && s.includes('application/json') ? yield a.json() : yield a.text(), ok: a.ok, url: a.url, type: a.type, status: a.status, headers: a.headers, statusText: a.statusText, redirected: a.redirected,
        };
      } return a;
    });
  }

  request(e) { return f(this, null, function* () { let a; const t = yield this.rawRequest(e); return (a = t.headers.get('content-type')) != null && a.includes('application/json') ? yield t.json() : yield t.text(); }); }

  constructor(e) { this.connectTimeout = e; }
}; function w(n) { let e; return ((e = n.match(/([A-Z])/g)) != null ? e : []).reduce((t, r) => t.replace(new RegExp(r), `_${r}`), n).toUpperCase(); } export {
  D as HttpClient, g as I18n, h as Id, x as Logger, b as Model, m as deepCopy, y as deepMerge, k as forEach, u as isPlainObject, w as toSnakeCase,
};
