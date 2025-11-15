# Product Requirements Document (PRD)
**Product name:** MAX TrustLine (Анонимная линия доверия)  
**Owner:** You  
**Date:** 15 Nov 2025 (EET)  
**Version:** 1.0 (MVP)

---

## 1) Summary
Anonymous whistleblowing bot and admin console inside **MAX** for HOAs/TSZh, universities, and government entities. Users submit anonymous reports (corruption, fraud, abuse of power, discrimination, data/privacy violations, etc.), attach evidence, receive a ticket ID, and communicate via an **anonymous two-way chat** with authorized handlers. Organizations triage, route, and close cases with auditable outcomes and exports.

**Why inside MAX:** official channel, frictionless UX, and momentum to move official chats/services into MAX. MAX provides Bot API (JS/TS client), messaging & uploads, buttons/callbacks, and mini-app support for an embedded admin UI.

**Publishing constraint:** production bots/mini-apps typically require a verified Russian legal entity (org account). Plan pilots accordingly.

---

## 2) Goals & Non-Goals
**Goals (MVP):**
- Anonymous intake of reports with categorization, evidence attachments, and ticketing.
- Case triage, assignment, SLA tracking, and **anonymous** handler–reporter messaging.
- Multitenancy: each organization (TSZh/University/Agency) is an isolated namespace.
- Exports (CSV/PDF), audit log, and basic analytics.

**Non-Goals (MVP):**
- No external KYC / forced deanonymization.
- No heavy ML; verification is procedural (checklists, evidence prompts).
- No deep third‑party DMS integrations (expose webhooks; integrate later).

---

## 3) Users & Needs
- **Reporter (citizen/student/employee):** stay safe, submit quickly, get status, remain anonymous.
- **Handler (compliance/moderator/legal):** triage queue, assign, ask follow‑ups via anonymous chat, resolve with disposition.
- **Org Admin:** manage categories, handler roles, SLAs, exports, and compliance reports.
- **Auditor (read‑only):** view immutable audit trails and result stats.

---

## 4) Scope — Functional Requirements (MVP)
### 4.1 Report submission (anonymous)
- Start flow with mandatory legal notice + “how to stay anonymous”.
- Select **Organization** (or deep link per org), **Category**, **Description**, **Location/Unit** (optional), **Attachments** (photo/video/file/audio), **Contact back?** (optional pseudonymous channel).
- Generate **ticket ID** and return **status link**.
- Persist minimal metadata; PII minimization by default.
- Use the **MAX Bot API** for messaging, uploads, quick replies, and callbacks (see: https://dev.max.ru/docs).

### 4.2 Anonymous two‑way chat
- Handler asks clarifying questions.
- Reporter replies via the bot; identity remains hidden to handler.
- Close case with final message and disposition code.

### 4.3 Case management (admin UI or bot‑embedded mini‑app)
- Views: **Inbox**, **Assigned to me**, **All**, **Overdue**.
- Actions: assign, change status, add internal note, ask reporter, close with disposition, export case.
- Filters: category, date, building/faculty/department, severity.
- SLA timers + reminders.
- Admin UI can be a **MAX mini‑app** (React) embedded into the bot.

### 4.4 Multitenancy & RBAC
- **Organization** (tenant) boundaries: data isolation by `org_id`.
- Roles: `OrgAdmin`, `Handler`, `Auditor` (read‑only).
- Per‑org category taxonomy and SLAs.

### 4.5 Exports & analytics
- CSV/PDF exports: cases, dispositions, average TTR, SLA % on‑time.
- Dashboards: cases by category, time to first response, repeat incidents.

---

## 5) Copy — End‑User Bot Text (Russian, ready to paste)
Use these exact strings for v1. Keep them short, neutral, and legally safe.

**Start / Welcome**
- `Привет! Это «ТрастЛайн» — анонимная линия доверия. Здесь вы можете сообщить о нарушении и сохранить конфиденциальность.`
- `Перед началом обратите внимание: за заведомо ложный донос предусмотрена ответственность. Пожалуйста, описывайте только факты и прикладывайте материалы.`

**Main menu (quick replies)**
- `Сообщить о нарушении`
- `Проверить статус по коду`
- `Как сохранить анонимность`

**Anonymity tips**
- `Совет: не указывайте ФИО и контакты. Удалите метаданные из файлов и фото. Не используйте рабочие устройства/сети.`

**Category prompt**
- `Выберите категорию:`  
  `• Взяточничество и коррупция`  
  `• Мошенничество / хищение`  
  `• Превышение полномочий / давление`  
  `• Конфликт интересов`  
  `• Дискриминация / домогательство`  
  `• Нарушение ИБ и конфиденциальности`  
  `• Злоупотребления в закупках/подрядах`  
  `• Прочее`

**Description prompt**
- `Опишите, что произошло. Когда и где? Кто участвовал? Какие факты подтверждают нарушение?`

**Attachments prompt**
- `Прикрепите файлы (фото/видео/документы/аудио), если есть. Можно пропустить.`

**Confirm & submit**
- `Проверьте данные и отправьте.`

**Success**
- `Спасибо! Ваше обращение принято.`  
  `Код: {CASE_ID}`  
  `Сохраните код, чтобы проверять статус и отвечать на вопросы.`

**Check status**
- `Введите код обращения:`  
- `Статус: {STATUS}. Обновлено: {UPDATED_AT}.`  
- `Если понадобятся уточнения, мы спросим здесь же. Ваша личность остаётся скрытой.`

**Handler asks a question (to reporter)**
- `Нам нужно уточнение по вашему обращению {CASE_ID}: {QUESTION_TEXT}`

**Closing**
- `Ваше обращение {CASE_ID} закрыто. Итог: {DISPOSITION}. Приняты меры: {ACTIONS}. Спасибо за помощь!`

**Out‑of‑scope redirect**
- `Похоже, этот вопрос вне компетенции организации. Рекомендуем обратиться на официальный «телефон доверия»: {CONTACTS}.`

**Legal footer (first submission step)**
- `Важно: Сообщая сведения, вы подтверждаете, что понимаете последствия заведомо ложного доноса и согласны с политикой обработки данных.`

---

## 6) User Stories (Acceptance)
- As a **Reporter**, I can submit an anonymous report in ≤3 steps and receive a case ID.
- As a **Reporter**, I can view my case status by ID without revealing identity.
- As a **Handler**, I can triage, assign, ask, and close with a disposition.
- As an **Org Admin**, I can manage categories, SLAs, roles, and export reports.
- As an **Auditor**, I can view immutable audit logs and read‑only case data.

---

## 7) Success Metrics (MVP)
- Time to First Response (TTFR) median ≤ 24h; SLA adherence ≥ 80%.
- ≥ 60% of cases contain at least one attachment.
- ≥ 2 tenants in pilot; ≥ 10 active handlers; ≥ 100 submissions first month.
- Export run time ≤ 10s for 1k cases.

---

## 8) Non‑Functional Requirements
- **Security & Privacy:** Encryption at rest and in transit; attachments stored encrypted; strict RBAC; audit log (WORM). PII minimization by design.
- **Performance:** p95 bot response ≤ 1s; file upload ≤ 50MB (configurable).
- **Availability:** 99.5% (MVP); graceful degradation if uploads fail.
- **Retention:** default 12 months (configurable per tenant); purge tooling.
- **Compliance:** legal disclaimer shown before first submission.

---

## 9) System Architecture (MVP)
**High‑level:**
- **MAX Bot** (JS/TS) ⇄ **Gateway** (auth, rate limit) → **Case Service** (REST)
  → **PostgreSQL** (cases, orgs, roles)
  → **Blob Storage** (encrypted attachments)
  → **Queue** (SLA timers/notifications)
  → **Admin UI** (React/Next; optionally embedded as MAX mini‑app)
  → **Audit Log** (append‑only)

**MAX integration:** use the Bot API for messages, attachments, quick replies/buttons, callbacks, chat actions, and bot info. Reference: https://dev.max.ru/docs

**Tokens/registration:** create and configure the bot via @MasterBot and the MAX Partners console; production requires an org account.

---

## 10) Data Model (MVP)
- **Organization**: `org_id`, name, settings (SLA, retention, categories).
- **Category**: `category_id`, `org_id`, name, severity, SLA.
- **Case**: `case_id`, `org_id`, `category_id`, status, severity, created_at, updated_at, closed_at, channel_ref (MAX chat/thread), anonymized reporter token.
- **Message**: `msg_id`, `case_id`, sender_type (`reporter`|`handler`), body, attachments[], timestamp.
- **Attachment**: `att_id`, `case_id`, storage_url (encrypted), media_type, size, checksum.
- **Actor**: `actor_id`, `org_id`, role (`Handler`|`OrgAdmin`|`Auditor`), MAX user ref (if any).
- **AuditLog**: append‑only `{who, action, what, when, prev→next}`.

---

## 11) Flows
**A) Submit report**
1. Bot shows legal notice + anonymity tips → **Continue**.  
2. Select **Category** → enter **Description** → attach files (optional).  
3. Confirm → create **Case** → reply with `CASE_ID` + status instruction.

**B) Anonymous Q&A**
1. Handler asks question → bot relays to reporter.  
2. Reporter replies in the same chat → bot posts to case.  
3. Handler closes with disposition → bot sends final result to reporter.

**C) Admin**
1. Log in (org SSO or email+OTP for MVP).  
2. View queue, filters, assign, message, close, export.  
3. Configure categories, roles, SLAs.

---

## 12) Buttons & UI (bot)
- Quick replies: `Сообщить о нарушении`, `Проверить статус`, `Как сохранить анонимность`.  
- Inline buttons during forms: `Пропустить`, `Назад`, `Отправить`.  
- Handle callbacks via Bot API to maintain state across steps.

---

## 13) Admin Mini‑App (optional in MVP, recommended)
- Tech: React + MAX UI components; hosted over HTTPS; linked in MAX Partners console.  
- Views: Inbox, Case, Settings, Audit, Exports.  
- No public access; auth via gateway.

---

## 14) Security & Privacy
- Encrypt DB volumes and blobs; server‑side key management.  
- Strict RBAC; least privilege; per‑tenant isolation.  
- No PII fields in case by default; free‑text stored but flagged for later PII scanning (not MVP).  
- WORM audit log; time‑sync; IP allowlists for admin.  
- Rate limits to mitigate spam/abuse.

---

## 15) Risks & Mitigations
- **False/defamatory reports:** pre‑submit checklist, legal warning, handler training.  
- **Deanonymization pressure:** policy + technical separation (no user mapping in case data).  
- **Load spikes:** queue + backpressure; attachment size caps.  
- **Platform policy changes:** keep abstraction over Bot API; monitor partner console updates.

---

## 16) Test Plan (UAT, must pass)
- Submit with/without attachments; verify max text length boundaries.  
- Receive `CASE_ID`, then retrieve status.  
- Handler can assign, ask, close; reporter receives messages.  
- Exports produce correct CSV/PDF; audit trail complete.  
- Multi‑tenant isolation (cannot cross‑read data).  
- Rate‑limit proof (scripted load) without user‑visible errors.

---

## 17) Delivery Artifacts
- Bot service (Node.js/TypeScript) using the official MAX Bot API client.  
- Gateway/Case service (Go or Node) + PostgreSQL + Object storage.  
- Admin mini‑app (React + MAX UI) + CI/CD.  
- Helm/docker‑compose files; `.env.example`; README with MAX token setup and @MasterBot steps.

---

## Developer Appendix — Implementation Shortcuts
- Use MAX Bot API to send messages (Markdown/HTML as allowed); respect message size limits.  
- Uploads are multi‑step (init → PUT file → attach to message).  
- Use typing indicators for UX; back‑pressure on uploads.  
- Mini‑app: configure HTTPS URL in the MAX Partners console and deep‑link from the bot.

