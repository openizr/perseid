# Security Audit Report — `perseid` monorepo

Date: 2026-04-27
Scope: All packages under `packages/*`, root `docker-compose.yml`, and `examples/*` reference apps.
Method: Static review of source files (no runtime fuzzing). Findings are restricted to issues judged to be real and exploitable; theoretical concerns and stylistic complaints are excluded.

Severity scale: **Critical** (immediate compromise) · **High** (likely compromise under realistic conditions) · **Medium** (requires specific preconditions) · **Low** (defense-in-depth / latent).

---

## Executive summary

| ID | Title | Pkg | Severity |
|----|-------|-----|----------|
| SECRET-001 | RSA private keys committed in `examples/` and server playground | examples + server | **Critical** |
| SRV-003 | `signUp` / `resetPassword` bypass `AuthEngineFragment` → password may land plaintext | server | **Critical** |
| SRV-001 | Field-level write permissions never enforced → password change on any user | server | **High** |
| JOB-001 | `jobs.scriptPath` is unrestricted → arbitrary Node Worker spawn | jobs | **High** |
| INFRA-001 | Hardcoded weak DB credentials (`Test123!`) in compose + examples | infra | **High** |
| INFRA-002 | MongoDB exposed without authentication | infra | **High** |
| UI-001 | `markdown()` accepts `javascript:` URLs in links | ui | **High** |
| UI-002 | Unsanitized `placeholder` injected via `dangerouslySetInnerHTML`/`v-html`/`{@html}` | ui | **High** |
| SRV-005 | No rate-limiting on `signIn` / `requestPasswordReset` + user enumeration | server | **Medium** |
| CORE-001 | Prototype pollution in `deepMerge` / `deepCopy` | core | **Medium** |
| CLI-001 | Open-redirect / phishing via `?redirect=` after sign-in | client | **Medium** |
| DEP-001 | Published packages run `postinstall` that mutates consumer's project | all | **Medium** |
| DEP-002 | Host-path file dependency `file:/var/lib/perseid/...` | server, jobs | **Medium** |
| SECRET-002 | Plaintext DB password in example apps & playgrounds | examples | **Medium** |
| INFRA-003 | `mysql:latest`, `postgres:latest`, stale `mongo:6.0.5` | infra | **Medium** |
| SRV-002 | Dead self-update permission check | server | Low |
| SRV-004 | `filters` AJV schema effectively unconstrained | server | Low |
| SRV-006 | Permissive CORS via `handleCORS: true` | server | Low |
| SRV-007 | SQL parameters logged at `debug` (incl. bcrypt hashes / refresh tokens) | server | Low |
| CORE-003 | `HttpClient` accepts any URL (caller-trust SSRF surface) | core | Low |
| CLI-002 | i18n labels piped through `markdown()` then raw-rendered | client | Low |
| CLI-003 | `new RegExp(pattern)` over server-supplied schema → ReDoS | client | Low |
| JOB-002 | Latent identifier injection in `updateMatchingTask` SQL builder | jobs | Low |
| JOB-003 | `JSON.parse(task.metadata)` without `__proto__` reviver | jobs | Low |
| STORE-001 | `markdown()` `target=_blank` doesn't auto-add `rel=noopener` | ui | Low |
| INFRA-004 | No healthchecks / restart / resource limits | infra | Low |
| INFRA-005 | No TLS in deployment templates | infra | Low |
| SECRET-003 | `.env` is tracked in git (currently benign) | infra | Low |
| DEP-003 | `coveralls` (devDep) unmaintained — replace with `coveralls-next` | infra | Low |

---

## packages/server (`@perseid/server`)

### SRV-001 — Field-level write permissions never enforced (account takeover)

- **Files:** `packages/server/src/scripts/core/services/EngineFragment.ts:334-438` (`applyPermissions`); `packages/server/src/scripts/core/services/Model.ts:47-104` (users schema).
- **Repro:**
  ```
  PATCH /users/<victim-id>
  Authorization: Bearer <attacker-with-USERS.UPDATE>
  Content-Type: application/json

  {"password":"Pwned123!"}
  ```
  `applyPermissions` only adds *output* fields (`queryOptions.fields`, `sortBy`, `_id`, filter/query keys for LIST) to `allFields`. Payload keys for CREATE/UPDATE are never walked, so the per-field `permission` check is skipped on writes. `users.password` (declared with `permission: null`) and `users._devices` (declared `USERS.VIEW_DETAILS`) are therefore writable by anyone with `USERS.UPDATE`.
- **Severity:** **High** — privilege escalation / account takeover of any user (including admins).
- **Mitigation:** In `applyPermissions`, walk `payload` recursively and add every leaf path to `allFields` for CREATE/UPDATE; explicitly forbid writes to fields whose `permission === null` unless an allowlisted self-update path applies.

### SRV-002 — Dead self-update branch (logic bug, masks audits)

- **File:** `packages/server/src/scripts/core/services/EngineFragment.ts:417`.
- **Issue:** `if (!(operation === 'USERS.UPDATE' && String(id) === String(session.user._id))) throw …` — `operation` is `'UPDATE'`, never `'USERS.UPDATE'`. The branch is unreachable, so the only way to update one's own profile is to hold `USERS.UPDATE`, which (combined with SRV-001) lets you also update everyone else.
- **Severity:** Low (functional, but compounds SRV-001).
- **Mitigation:** `if (!(resource === 'users' && operation === 'UPDATE' && String(id) === String(session.user._id))) throw …`.

### SRV-003 — `signUp` / `resetPassword` skip password hashing (plaintext storage)

- **Files:** `AuthEngine.ts:307-340, 498-528`; `AuthEngineFragment.ts` (whole file); `Engine.ts:110-118` (`registerFragment`); `Engine.fragmentPerResource = {}` by default.
- **Issue:** `AuthEngine`'s constructor (lines 207-230) never calls `registerFragment(...)` for `AuthEngineFragment`. `prepareCreatePayload` / `prepareUpdatePayload` therefore fall back to `EngineFragment`, which does *not* hash `password`.
- **Repro:** Boot a server with `new AuthEngine(...)` per the README; `POST /auth/sign-up { email, password, passwordConfirmation }`; inspect the `users` row — `password` is plaintext. Subsequent `signIn` then fails at `bcrypt.compare`, which is how this gets noticed in dev. A naïve "fix" (bypass the bcrypt comparison) puts plaintext-credential auth into production.
- **Severity:** **Critical** — credential storage is fundamentally broken out-of-the-box.
- **Mitigation:** In `AuthEngine` constructor, instantiate and `registerFragment` an `AuthEngineFragment` against the `users` resource. Add a unit test asserting the stored password is a bcrypt hash, not the input.

### SRV-004 — `filters` AJV schema is effectively unconstrained

- **File:** `packages/server/src/scripts/connectors/fastify/services/FastifyController.ts:766-779`.
- **Issue:** `patternProperties: { '^[0-9A-Za-z.]$': ... }` matches only single-character keys; combined with `additionalProperties: true`, all real filter keys bypass the type constraint. Clients can send objects/arrays/booleans where strings are expected.
- **Severity:** Low — no end-to-end SQLi today (downstream parameterization holds), but the layer of defense is gone and a future change could turn this into injection.
- **Mitigation:** `patternProperties: { '^[0-9A-Za-z.]+$': ... }` and `additionalProperties: false`.

### SRV-005 — No rate limiting on auth endpoints + user enumeration

- **Files:** `AuthEngine.ts:359-415` (`signIn`), `470-483` (`requestPasswordReset`); routes registered in `FastifyController.ts:171-304`. `grep -r 'rateLimit\|throttle\|brute\|limiter' src/` returns 0.
- **Issue:** `signIn` returns distinct error codes for missing user (`NO_USER`) vs. wrong password (`INVALID_CREDENTIALS`) and runs `bcrypt.compare` only on the latter, leaking which emails are registered (both via response body and timing). `requestPasswordReset` adds a 100 ms decoy delay that's smaller than the real DB lookup variance.
- **Severity:** **Medium** — credential stuffing, password spraying, account enumeration.
- **Mitigation:** Per-IP and per-account exponential-backoff via `cacheClient`; collapse `NO_USER`/`INVALID_CREDENTIALS` to one constant-time response; equalize work in `requestPasswordReset`.

### SRV-006 — Permissive CORS exposed as a documented setting

- **File:** `FastifyController.ts:635-644`.
- **Issue:** `handleCORS: true` returns `Access-Control-Allow-Origin: *` and `Allow-Headers/Methods: *` for every request, with no allowlist or per-route scoping. The README presents this as a production-safe toggle.
- **Severity:** Low — credentials are not exfiltrable under `*` in browsers, but `Authorization` header tokens still travel cross-origin if a downstream consumer flips that switch.
- **Mitigation:** Replace boolean with explicit allowlist (`handleCORS: false | string[]`); refuse the wildcard combo at runtime when `Authorization` is present; document dev-only.

### SRV-007 — SQL parameter values logged at `debug` (sensitive data)

- **File:** `packages/server/src/scripts/connectors/postgresql/services/PostgreSQLDatabaseClient.ts` lines 701-703, 786-788, 846-848, 892-894, 1721-1723, 1786-1788, 1894, 2072-2074, 2100-2102, 2126-2128, 2197-2199.
- **Issue:** Both SQL and joined parameter values are logged verbatim at `debug`. For `users` writes/reads this includes bcrypt hashes, `_devices._refreshToken`, email addresses, and (per SRV-003) potentially plaintext passwords.
- **Severity:** Low (only at debug level), Medium if consumer ships logs to a third-party aggregator.
- **Mitigation:** Redact known-sensitive columns (`password`, `_refreshToken`, `_apiKeys`) before logging; or log parameter count/types only.

**Audited and judged safe in `server`:** JWT verification (`RS256` + iss/aud + algorithm pinning); identifier handling (resource names come from the developer-defined model, not requests); device-id binding in JWT subject; `randomBytes(12).toString('hex')` token IDs; AJV `additionalProperties: false` on object payloads (preventing prototype pollution at request boundary).

---

## packages/jobs (`@perseid/jobs`)

### JOB-001 — `jobs.scriptPath` is a free-form string → arbitrary Worker spawn

- **Files:** `packages/jobs/src/scripts/core/services/JobScheduler.ts:213, 218`; `packages/jobs/src/scripts/core/model/index.ts:32-37`.
- **Issue:** `scriptPath` is `{ type: 'string', maxLength: 255 }` (no enum, no pattern). `executeTask` does `splittedPath = task.job.scriptPath.split(' '); new Worker(splittedPath[0], { workerData: { jobId: splittedPath[1], ... } })`. Anyone able to create or update a `jobs` row can point the scheduler at any local `.js`/`.mjs` file (or a `data:`/`file:` URL accepted by `Worker`) and have it executed in-process.
- **Repro:** As an admin (or any role with `JOBS.UPDATE`): `POST /jobs { scriptPath: "/etc/perseid/../../../tmp/payload.js" }` then trigger a task. The worker thread runs with the scheduler process's privileges — full RCE on the host.
- **Severity:** **High** — privileged-user RCE / lateral-movement primitive.
- **Mitigation:** In the model, set `scriptPath: { type: 'string', enum: Object.keys(settings.jobs) }`, or store an opaque `jobName` and resolve to a path server-side from the registered jobs map. Reject any character outside `[A-Za-z0-9_./-]`, and reject `..` segments.

### JOB-002 — Latent identifier injection in `updateMatchingTask`

- **File:** `packages/jobs/src/scripts/connectors/postgresql/services/PostgreSQLDatabaseClient.ts:144-160`.
- **Issue:** `\`"${fieldName}"\`` interpolation. Values are parameterized, but the column-name path trusts the caller. Today's call sites (`JobScheduler.ts:275-282, 318-327`) only pass hardcoded keys, so it is **not currently reachable**, but any future caller passing user-derived keys yields SQL injection.
- **Severity:** Low (latent).
- **Mitigation:** Whitelist `fieldName` against `Object.keys(model.get('tasks').schema.fields)`, or escape with `fieldName.replace(/"/g, '""')`.

### JOB-003 — `JSON.parse(task.metadata)` without `__proto__` reviver

- **Files:** `JobScheduler.ts:161, 216, 433, 454`.
- **Issue:** Caller-supplied (≤10 000 chars) string `metadata` is `JSON.parse`d. V8 sets `__proto__` as an own enumerable property. Spread (`{...metadata}`) is safe (no setter triggered), but `Object.assign(parsedMetadata, ...)` mutates the parsed object in place; any later code that `for…in`-iterates or `deepMerge`s it (see CORE-001) pollutes prototypes.
- **Severity:** Low — no current sink in `jobs`, but it's a latent gadget. Becomes irrelevant once CORE-001 is fixed.
- **Mitigation:** `JSON.parse(s, (k, v) => (k === '__proto__' || k === 'constructor') ? undefined : v)`.

---

## packages/core (`@perseid/core`)

### CORE-001 — Prototype pollution in `deepMerge` / `deepCopy`

- **Files:** `packages/core/src/scripts/helpers/deepMerge.ts:38-47`; `deepCopy.ts:26-33`; `isPlainObject.ts:16-24`.
- **Issue:** `JSON.parse('{"__proto__":{"isAdmin":true}}')` produces an object with `__proto__` as its own enumerable property. `Object.keys` returns it; `isPlainObject` accepts the value; `newObject[key] = …` triggers the `__proto__` setter and mutates `Object.prototype`. The same applies to `deepCopy`. Sinks: client `Store.ts:328, 651, 688` (registry merges of API responses) and `I18n.ts:75` (label merges).
- **Severity:** **Medium** — needs an upstream that can produce attacker-controlled JSON. Cascades into authz bypass / template-engine RCE wherever the polluted property is consulted.
- **Mitigation:**
  ```ts
  for (const key of Object.keys(source)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    // ...
  }
  ```
  Apply in both `deepMerge` and `deepCopy`. Also harden `isPlainObject` to reject objects whose prototype is not `Object.prototype` or `null`.

### CORE-003 — `HttpClient` accepts any URL (caller-trust SSRF surface)

- **File:** `packages/core/src/scripts/classes/HttpClient.ts:172-178`.
- **Issue:** `fetch(settings.url, ...)` accepts any scheme/host. Not directly exploitable; relevant only if a downstream caller passes user-controlled URLs (`ApiClient` honors absolute `url` at `ApiClient.ts:362`).
- **Severity:** Low (informational, caller-dependent).
- **Mitigation:** Document the trust boundary; in `ApiClient.request`, validate scheme/host of `settings.url` or restrict to relative paths from `baseUrl`.

---

## packages/client (`@perseid/client`)

### CLI-001 — Open-redirect / phishing via post-sign-in `redirect` query param

- **File:** `packages/client/src/scripts/core/services/Store.ts:709, 736; 1459-1469` (`navigate` / `window.open`).
- **Repro:** `https://app/sign-in?redirect=%2F%2Fevil.com` (or `https%3A%2F%2Fevil.com`, `javascript%3Aalert(document.cookie)`). After successful auth, `getPageData` reads `routerState.query.redirect`, `decodeURIComponent`s it, and calls `this.navigate(redirect)()`. Ctrl-clicking calls `window.open(url, '_blank')`, which executes any scheme — including `javascript:` → token theft from the post-auth context.
- **Severity:** **Medium** — phishing / credential pivot after the user successfully authenticates.
- **Mitigation:**
  ```ts
  const safe = (typeof redirect === 'string' && /^\/(?!\/)/.test(redirect))
    ? redirect : this.fallbackPageRoute;
  this.navigate(safe)();
  ```
  Apply the same allowlist inside `navigate`/`window.open`.

### CLI-002 — i18n labels rendered through `markdown()` raw

- **Files:** `packages/client/src/scripts/react/components/FormField.tsx:195`; `vue/components/FormField.vue:253`; equivalent Svelte file.
- **Issue:** `Message` renders `markdown(labels.label, false)` via `dangerouslySetInnerHTML` / `v-html` / `{@html}`. With UI-001 in play, any i18n label that contains `[click](javascript:...)` will execute. Default deployments ship static labels, but i18n bundles loaded from a CDN/CMS or merged with server data become exploit vectors.
- **Severity:** Low (defense-in-depth) → **High** if consumer loads i18n from a non-trusted source.
- **Mitigation:** Pipe `markdown()` output through DOMPurify *or* fix UI-001 (recommended).

### CLI-003 — Server-supplied regex compiled with `new RegExp`

- **File:** `packages/client/src/scripts/core/services/FormBuilder.ts:414`.
- **Issue:** `pattern` from `_model` (the server data model) is passed to `new RegExp(pattern)`. A malicious or compromised backend can ship `(a+)+$` and freeze every client tab.
- **Severity:** Low — server-trust dependent client-side DoS.
- **Mitigation:** `safe-regex2` check; or compile inside a `setTimeout` / Web Worker with a wall-clock budget.

---

## packages/ui (`@perseid/ui`)

### UI-001 — `markdown()` accepts `javascript:` URLs in links

- **File:** `packages/ui/src/scripts/core/markdown.ts:66-75`.
- **Issue:** The link parser interpolates the URL group directly into `href="${link}"`. HTML-special chars are escaped beforehand, but the `:` / scheme is not validated, so `javascript:` and `data:text/html,...` survive. The output is rendered through `dangerouslySetInnerHTML` / `v-html` / `{@html}` from every framework binding — `react/{P,Title,Options,Textfield,Textarea,FilePicker}.tsx`, the Vue equivalents, plus `svelte/Link.svelte:39` and `vue/UILink.vue:56`.
- **Repro:**
  ```ts
  markdown('[click me](javascript:alert(document.cookie))')
  // → <a class="ui-link" href="javascript:alert(document.cookie)">click me</a>
  ```
  Rendered into the DOM, a click executes attacker JS in the app's origin.
- **Severity:** **High** — XSS wherever a UI component receives untrusted text (form labels, helpers, option labels, link hrefs).
- **Mitigation:**
  ```js
  const safeLink = /^(https?:|mailto:|\/|#|\?)/i.test(link) ? link : '#';
  ```
  Always force `rel="noopener noreferrer"` when `target="_blank"` is set (covers STORE-001).

### UI-002 — Unsanitized `placeholder` injected via `{@html}`-class APIs

- **Files:**
  - `packages/ui/src/scripts/react/Options.tsx:304-308`
  - `packages/ui/src/scripts/svelte/Options.svelte:314-317`
  - `packages/ui/src/scripts/vue/UIOptions.vue:334-337`
- **Issue:** When `currentValue.length === 0`, the raw `placeholder` prop is injected via `dangerouslySetInnerHTML` / `{@html}` / `v-html` with no escaping and no `markdown()` call. Every other label in the component is at least passed through `markdown()`.
- **Repro:** `<UIOptions placeholder="<img src=x onerror=alert(1)>" options={...} value={[]} />` executes on render.
- **Severity:** **High** wherever the placeholder originates from i18n bundles, CMS, URL params, or any non-static source.
- **Mitigation:** Either pass `placeholder` through `markdown()` like the other labels, or render as text (`{placeholder}`).

### STORE-001 — `target="_blank"` markdown links lack `rel="noopener"`

- **File:** `packages/ui/src/scripts/core/markdown.ts:72`.
- **Issue:** Tabnabbing — opened page accesses `window.opener` and pivots the user.
- **Severity:** Low.
- **Mitigation:** Always set `rel="noopener noreferrer"` when `target` is provided.

**Audited and judged safe:** `form` package (no `eval`/`new Function`/regex-from-user-input/prototype pollution; reCAPTCHA loader interpolates only the `siteKey` into a fixed Google URL). `store` core (no deep-merge helpers, no localStorage). `store/extensions/router.ts:45-63` (the alarming-looking `JSON.parse('{"…"}')` neutralizes injected quotes via `\\"` escaping; not exploitable). `dev-kit` (postinstall scripts touch only the package's own cache; eslint config does not disable security rules).

---

## Infrastructure (`docker-compose.yml`, `examples/*`)

### INFRA-001 — Hardcoded weak DB credentials in compose + examples

- **Files:** `docker-compose.yml:180-198`; `examples/mysql-express-react/docker-compose.yml:61-62`; `examples/postgresql-express-react/docker-compose.yml:60-62`.
- **Issue:** `MYSQL_ROOT_PASSWORD: Test123!`, `POSTGRES_USER: root`, `POSTGRES_PASSWORD: Test123!`, `MYSQL_DATABASE: test`, `POSTGRES_DB: test`, no env-file indirection. Same string is echoed in example app source (see SECRET-002), making the credential pair trivially harvestable.
- **Severity:** **High** if any consumer reuses the compose for staging/CI/shared workstations.
- **Mitigation:** Replace with `${MYSQL_ROOT_PASSWORD}` / `${POSTGRES_PASSWORD}`, load from a gitignored `.env`, document a secret-generation step.

### INFRA-002 — MongoDB exposed without authentication

- **Files:** `docker-compose.yml:160-171` and the corresponding `examples/mongodb-*/docker-compose.yml`.
- **Issue:** `mongo:6.0.5` started with no `MONGO_INITDB_ROOT_USERNAME/PASSWORD` and no `--auth`, port published as `${HOST_IP}:27018:27017`. Default `HOST_IP=127.0.0.1` is fine, but a developer who flips it to `0.0.0.0` (typical when working from VM/WSL) exposes Mongo to the LAN.
- **Severity:** **High** in shared-LAN scenarios; classic exposed-Mongo wipe-and-ransom risk.
- **Mitigation:** Force auth via `MONGO_INITDB_ROOT_USERNAME/PASSWORD`; bind to `127.0.0.1` regardless of `HOST_IP`; or remove the published port and rely solely on the Docker network.

### INFRA-003 — Floating tags / stale base images

- **File:** `docker-compose.yml:163` (`mongo:6.0.5`), `:176` (`mysql:latest`), `:192` (`postgres:latest`); `openizr/node:8.0.1-dev` for Node services.
- **Issue:** `:latest` for MySQL/Postgres is unreproducible and may pull a major-version bump. `mongo:6.0.5` (May 2023) is missing 6.0.x security fixes.
- **Severity:** **Medium**.
- **Mitigation:** Pin exact versions with SHA256 digests (`mysql:8.4.0@sha256:...`). Confirm `openizr/node` is maintained.

### INFRA-004 — No healthchecks / restart / resource limits

- All services lack `healthcheck:` and (except `dev-kit`) `restart:`. `depends_on` cannot gate readiness, runaway containers have no `mem_limit`.
- **Severity:** Low.
- **Mitigation:** Add `healthcheck` + `depends_on: { condition: service_healthy }` for DBs.

### INFRA-005 — No TLS in deployment templates

- The repo ships only `docker-compose.yml`. No reverse-proxy / TLS overlay. `ssl: false` is hardcoded in `packages/jobs/src/__playground__/index.ts:38`.
- **Severity:** Low (dev) / High if reused in production.
- **Mitigation:** Provide a `compose.prod.yml` with a TLS-terminating reverse proxy (Caddy/Traefik) and a README warning.

---

## Dependencies

### DEP-001 — `postinstall` mutates the consumer's project

- **Files:** `packages/server/package.json:179`; `packages/jobs/package.json:147`; `packages/client/package.json:206`; `packages/form/package.json:168`; `packages/store/package.json:163`; `packages/ui/package.json:163`; `packages/dev-kit/src/__playground__/library/package.json:74`.
- **Issue:** Published packages run `postinstall` that `yarn add --peer mysql2@^… pg@^… mongodb@^… fastify@^… express@^…` (server) and similar elsewhere. This (a) silently rewrites the consumer's `package.json`, (b) re-resolves outside the lockfile (defeating reproducible builds), (c) is a perfect supply-chain amplifier — a compromised version of any of those upstreams hits every consumer's next install. `dev-kit/package.json:75` additionally `mv _eslintrc .eslintrc`, overwriting the user's ESLint config.
- **Severity:** **Medium**.
- **Mitigation:** Move peer-dep installation to documentation. Drop the `_eslintrc` rename or scope it to `node_modules`.

### DEP-002 — Host-path `file:` dependency

- **Files:** `packages/server/package.json:123` (`"@perseid/core": "file:/var/lib/perseid/core"`); `packages/jobs/package.json:104-105`.
- **Issue:** Absolute host paths only resolve inside the project's Docker container. Local installs copy whatever exists at `/var/lib/perseid/core`. On shared CI runners, anyone with write access to that path injects code.
- **Severity:** **Medium**.
- **Mitigation:** Use `workspace:*` / `link:../core` or publish `@perseid/core` and pin a real version range.

### DEP-003 — Outdated devDep

- `coveralls@^3.1.1` is unmaintained and pulls in old transitive packages.
- **Mitigation:** Replace with `coveralls-next` or remove.

Other deps (`bcrypt ^5.1.1`, `jsonwebtoken ^9.0.2`, `multiparty ^4.2.3`, `ajv ^8.17.1`, `pino ^9.3.2`, `mysql2 ^3.11.0`, `pg ^8.12.0`, `mongodb ^6.8.0`, `fastify ^4.28.1`, `express ^4.19.2`, `path-to-regexp ^7.1.0`) are at currently-patched versions. Re-run `yarn audit --severity high` periodically.

---

## Committed secrets

### SECRET-001 — RSA private keys committed in examples + server playground

- **Files (all tracked in git):**
  - `examples/mysql-express-react/backend/src/index.ts:142`
  - `examples/postgresql-express-react/backend/src/index.ts:142`
  - `examples/mongodb-express-react/backend/src/index.ts` (around L142)
  - `examples/mongodb-fastify-react/backend/src/index.ts` (around L142)
  - `packages/server/src/__playground__/index.ts:85`
- **Issue:** Full 2048-/3072-bit RSA private keys are inlined as the JWT signing key (`auth.algorithm: 'RS256'`, `auth.privateKey`). The accompanying comment ("You can use sites like https://cryptotools.net/rsagen") suggests they were generated through an online tool — already a compromised channel. Anyone using `examples/` as a starting point ships the same key in production.
- **Repro:** Clone repo → copy any of the above private keys → forge a JWT with `clientId: "example"`, `issuer: "example"`, `subject: "<userId>_<deviceId>"` → submit as `Authorization: Bearer …` to any deployment that hasn't rotated the key. Forged admin sessions on every unrotated install.
- **Severity:** **Critical**.
- **Mitigation:**
  1. Rotate every JWT keypair on every deployment derived from these examples — the keys in git history are permanently burned.
  2. Replace the literals with `process.env.JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY`; example READMEs show `openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096`.
  3. Add a CI pre-commit secret scan (gitleaks, trufflehog).
  4. (Optional) `git filter-repo` to scrub the keys from history — note that anything ever pushed publicly should still be considered compromised.

### SECRET-002 — Plaintext DB password copy-paste vector

- **Files:** `examples/mysql-express-react/backend/src/index.ts:115` and `jobs/src/index.ts:37`; `examples/postgresql-express-react/backend/src/index.ts:115` and `jobs/src/index.ts:37`; `packages/jobs/src/__playground__/index.ts:27`; `packages/server/src/__playground__/index.ts:38`.
- **Issue:** `password: 'Test123!'` matches `docker-compose.yml`. The example apps ship a turn-key working credential pair.
- **Severity:** **Medium** (paired with INFRA-001 it is High).
- **Mitigation:** `password: process.env.DB_PASSWORD!` with a comment that `Test123!` is exclusive to the bundled docker-compose.

### SECRET-003 — `.env` is tracked in git (currently benign)

- **File:** `/.env` (tracked). Contents match `.env.example`; only ports/IPs/CIDRs today.
- **Severity:** Low — risk is future drift (someone adds a real secret without realizing it's tracked).
- **Mitigation:** `git rm --cached .env`, add `/.env` to `.gitignore`, keep only `.env.example` in VCS.

---

## Top 5 to fix this week

1. **SECRET-001** — Rotate every JWT keypair derived from `examples/`; remove the literals and replace with env-loaded values.
2. **SRV-003** — Wire `AuthEngineFragment` into `AuthEngine`'s constructor; add a regression test that `users.password` is a bcrypt hash on disk.
3. **SRV-001** — Walk `payload` recursively in `applyPermissions` so `permission: null` fields are write-locked.
4. **JOB-001** — Replace `scriptPath` with an `enum` of registered job names; reject anything else.
5. **UI-001 / UI-002** — Allowlist link schemes in `markdown()`; render `placeholder` as text or via `markdown()`.

## Items reviewed and judged safe

- JWT verification (RS256, iss/aud, algorithm pinning).
- PostgreSQL/MongoDB query construction in `server` (parameterized values, identifiers from developer-defined model).
- Device-id binding inside JWT subject.
- AJV `additionalProperties: false` on object request payloads (preventing prototype pollution at the boundary).
- Atomic job-claim race in `jobs` (conditional `UPDATE … WHERE _status='PENDING' AND _runBy IS NULL`).
- `form` engine — no `eval`/`new Function`/server-supplied regex; `initialValues` deep-copied.
- `store/extensions/router.ts` — quote escaping in `JSON.parse` is sufficient.
- `dev-kit` — postinstall scripts mutate only their own caches; eslint config does not disable security rules.
- `Grid.tsx`/`Grid.vue` `innerHTML = css` — module-scope static string.

---

*End of report. Reproductions assume the current `major/11` branch HEAD as of 2026-04-27.*
