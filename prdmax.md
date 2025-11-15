# Product Requirements Document (PRD) — **MAX TrustLine Bot**

> Scope: MAX chat-bot. User‑facing copy in **Russian**.

---

## 1) Goal & Non‑Goals
**Goal:** A MAX chat‑bot that allows any user to **anonymously submit a report about a violation** to a chosen Organization (ТСЖ / University / Government entity) and allows **verified reviewers** to triage/process cases via inline buttons. use js or go

**Non‑Goals:** 

---

## 2) Platform & API Constraints (MAX)
- Transport: HTTPS Webhook (preferred) with secret validation; Long Polling fallback.
- Auth: Bot API token via HTTP `Authorization: Bearer <token>` header.
- Messages: text (≤ 4000 chars), optional formatting (`markdown`/`html`).
- Inline Keyboards: use `callback` buttons (no more than platform limits). Answer presses via `callback_id`.
- Uploads: user can send media; bot can upload files and attach to messages (respect platform size limits); store attachment metadata in DB.
- Updates to handle: `message_created`, `message_callback`.

---

## 3) Roles & Verification
- **Reporter (заявитель):** default role. Can create a report, check status, and reply with extra info. Remains anonymous to reviewers by default.
- **Reviewer (проверяющий):** must pass verification **per Organization**.

**Verification (MVP):**
1) **Whitelist** of reviewer `user_id` per `Organization` (from config) — primary method.
2) **Access‑code** (optional): reviewer provides organization code; on success we bind the reviewer `user_id` to that `org_id`.

**Anonymity:** never expose reporter’s `user_id` to reviewers. In reviewer UI show **“Заявитель #<shortCaseId>”**. All messages bridge through the bot.

---

## 4) Data Model (No Redis)
Use a single relational DB (SQLite file for hackathon; PostgreSQL for prod). Suggested tables:

- `Organization { id, name, short_code, is_active, created_at }`
- `Category { id, org_id NULLABLE, name_ru }` — global defaults plus per‑org overrides.
- `Case { id UUID, short_id VARCHAR(8), org_id, category_id, text, status, created_at, updated_at, reporter_user_id NULLABLE, contact_opt_in BOOL, contact_phone NULLABLE, contact_email NULLABLE, attachments_json JSONB }`
- `CaseMessage { id, case_id, sender_type ENUM('reporter','reviewer','system'), text, attachments_json JSONB, created_at }`
- `Reviewer { user_id BIGINT, org_id, verified_at }`  (PK: user_id+org_id)
- `AccessCode { org_id, code_hash, created_at, expires_at }` (optional)
- `AuditLog { id, case_id NULLABLE, actor_user_id NULLABLE, action, meta_json JSONB, created_at }`

**Case statuses:** `new` → `triage` → `in_progress` → `resolved_confirmed` | `resolved_unconfirmed` | `rejected`.

**Retention:** configurable (default 365 days). Archival/cleanup job optional.

---

## 5) High‑Level UX Flow (Inline Keyboards Only)
**Entry:** user adds/opens bot → `/start` → Main Menu (RU).

**Main Menu (RU):**
- `Сообщить о нарушении` → `ACT_REPORT_START`
- `Проверить статус` → `ACT_STATUS`
- `Я проверяющий` → `ACT_REVIEWER`
- `Справка и конфиденциальность` → `ACT_HELP`

### 5.1 Reporter Flow
1) **Organization selection**
   - RU: `Выберите организацию, куда хотите направить сообщение:`
   - Buttons: list orgs from config (paginate if needed). Payload: `ORG_<id>`

2) **Category selection**
   - RU: `Выберите категорию:`
   - Defaults (global):
     - `Взяточничество и коррупция` → `CAT_BRIBERY`
     - `Мошенничество` → `CAT_FRAUD`
     - `Конфликт интересов` → `CAT_CONFLICT`
     - `Дискриминация/домогательства` → `CAT_HARASS`
     - `Нарушение защиты данных` → `CAT_PRIVACY`
     - `Использование инсайдерской информации` → `CAT_INSIDER`
     - `Злоупотребление полномочиями` → `CAT_ABUSE`
     - `Иное` → `CAT_OTHER`
   - Allow per‑org overrides via config.

3) **Free‑text description**
   - RU message:
     ```
     Опишите ситуацию. Укажите факты, даты, участников, подразделение/адрес. Не указывайте лишние персональные данные.
     Отправьте сообщением текст; при необходимости прикрепите фото/файлы.
     ```
   - Bot captures next text and any attachments; store in draft state until confirmation.

4) **Optional contact**
   - RU: `Хотите оставить контакт для связи по вашему обращению?`
   - Buttons: `Оставить контакт` (`REPORT_CONTACT_YES`) | `Продолжить анонимно` (`REPORT_CONTACT_NO`)
   - If YES: request phone/email (or use platform contact‑request button if available); save to case draft.

5) **Confirm & create**
   - Show summary (org, category, text snippet ≤ 500 chars, attachments count, contact flag).
   - Buttons: `Отправить` (`REPORT_SUBMIT`) | `Назад` (`REPORT_EDIT`)
   - On submit: create `Case{status='new'}`, generate `short_id` (6–8 base36/62). RU reply:
     ```
     Обращение принято.
     Номер: <short_id>
     Вы можете отслеживать статус по кнопке «Проверить статус» и номеру.
     ```

6) **Status check**
   - Ask RU: `Введите номер обращения (например: A1B2C3):`
   - Reply with status + last update time. If there’s a reviewer question, show:
     ```
     Уточнение от службы контроля:
     <text>
     ```
   - Button: `Ответить` → next user message recorded as `CaseMessage{sender_type='reporter'}`.

### 5.2 Reviewer Flow
1) **Enter reviewer mode**: `Я проверяющий` (`ACT_REVIEWER`).
2) **Verification**:
   - If `Reviewer` exists for user → proceed.
   - Else RU: `Для доступа укажите код проверяющего вашей организации.`
     - If code ok → bind `user_id` to org (create `Reviewer`). Otherwise: `Доступ запрещён. Проверьте код или обратитесь к администратору.`
3) **Reviewer menu** (per org):
   - `Входящие` → `REV_INBOX` (statuses: `new`, `triage`)
   - `В работе` → `REV_INPROG` (`in_progress`)
   - `Закрытые` → `REV_CLOSED`
   - `По номеру` → `REV_FIND`
4) **Case card** (RU template):
   ```
   [<short_id>] Организация: <org>
   Категория: <cat>
   Статус: <status>
   Текст: <snippet>
   Вложения: <n>
   Контакт: <да/нет>
   ```
   **Buttons:**
   - `Взять в работу` → `REV_TAKE_<short_id>` (set `triage`→`in_progress`)
   - `Ответить заявителю` → `REV_REPLY_<short_id>` (next message from reviewer is bridged to reporter)
   - `Запросить уточнение` → `REV_ASK_<short_id>` (send RU prompt to reporter)
   - `Закрыть: подтверждено` → `REV_CLOSE_CONF_<short_id>` (`resolved_confirmed`)
   - `Закрыть: не подтвердилось` → `REV_CLOSE_UNCONF_<short_id>` (`resolved_unconfirmed`)
   - `Отклонить` → `REV_REJECT_<short_id>` (`rejected`)

**Bridging:** prepend reviewer → reporter messages with `Служба контроля:`. Never include reviewer names/IDs.

---

## 6) RU Message Catalog (exact strings)
**Main menu:**
```
Выберите действие:
```
Buttons: `Сообщить о нарушении` · `Проверить статус` · `Я проверяющий` · `Справка и конфиденциальность`

**Help:**
```
Этот бот позволяет безопасно и анонимно направлять сообщения о нарушениях в вашу организацию.
Мы скрываем вашу личность. Вы вправе оставить контакт для обратной связи.
Предупреждение: за заведомо ложные сообщения предусмотрена ответственность.
```

**Org pick:** `Выберите организацию, куда хотите направить сообщение:`

**Category pick:** `Выберите категорию:`

**Describe:**
```
Опишите ситуацию. Укажите факты, даты, участников, подразделение/адрес. Не указывайте лишние персональные данные.
Отправьте сообщением текст; при необходимости прикрепите фото/файлы.
```

**Contact ask:** `Хотите оставить контакт для связи по вашему обращению?`

**Submit OK:**
```
Обращение принято.
Номер: <short_id>
Вы можете отслеживать статус по кнопке «Проверить статус» и номеру.
```

**Status prompt:** `Введите номер обращения (например: A1B2C3):`

**Status view:**
```
Статус вашего обращения <short_id>: <status_ru>
Последнее изменение: <datetime>.
```

**Reviewer denied:** `Доступ запрещён. Проверьте код или обратитесь к администратору.`

---

## 7) Callback Payloads (stable keys)
- Top: `ACT_REPORT_START`, `ACT_STATUS`, `ACT_REVIEWER`, `ACT_HELP`
- Org: `ORG_<id>`
- Cat: `CAT_<id>` (e.g., `CAT_BRIBERY`, `CAT_FRAUD`, …)
- Contact: `REPORT_CONTACT_YES`, `REPORT_CONTACT_NO`
- Submit/Edit: `REPORT_SUBMIT`, `REPORT_EDIT`
- Reviewer lists: `REV_INBOX`, `REV_INPROG`, `REV_CLOSED`, `REV_FIND`
- Reviewer per‑case: `REV_TAKE_<short_id>`, `REV_REPLY_<short_id>`, `REV_ASK_<short_id>`, `REV_CLOSE_CONF_<short_id>`, `REV_CLOSE_UNCONF_<short_id>`, `REV_REJECT_<short_id>`

---

## 8) Security & Privacy
- Store bot token in environment only. Validate webhook secret.
- Never expose reporter `user_id` or metadata to reviewers.
- Minimize PII; contacts optional and clearly labeled.
- Redact long echoes to ≤ 4000 chars; chunk if needed.
- Attachment handling: persist metadata; restrict executable file types in outbound.
- Audit every status change and reviewer action in `AuditLog`.

---

## 9) Error Handling (RU)
- Generic: `Произошла ошибка. Повторите попытку позже.`
- Unauthorized reviewer: `Доступ запрещён. Проверьте код или обратитесь к администратору.`
- Too many requests: `Слишком много запросов. Попробуйте чуть позже.`
- Case not found: `Обращение не найдено. Проверьте номер.`

---

## 10) Configuration
- `BOT_TOKEN` (required)
- `WEBHOOK_URL` (preferred; else Long Polling)
- `WEBHOOK_SECRET` (optional but recommended)
- `DB_URL` (`sqlite:///data/trustline.db` or PostgreSQL DSN)
- `ORGS_CONFIG` (JSON/YAML; list of orgs + optional category overrides)
- `REVIEWERS_WHITELIST` (JSON mapping org_id → [user_ids])
- `ACCESS_CODES` (optional; per org)
- `RETENTION_DAYS` (int)

---

## 11) Non‑Functional
- Simplicity first: single process/service, no Redis/queues.
- Resilience: retry on transient 5xx/429 with exponential backoff.
- Logging: request/response (without tokens), app logs with correlation IDs, structured JSON preferred.
- I18N: RU user copy only; internal logs/keys in EN ok.

---

## 12) Test Scenarios (must pass)
1) Reporter happy path: org→cat→text(+file)→anonymous→submit→receive `<short_id>`; status shows `new`.
2) Reporter with contact: phone/email captured; visible to reviewers as “есть контакт”.
3) Reviewer whitelist: unverified denied; whitelisted sees Inbox, takes case, replies, closes as confirmed; reporter receives anonymized reply.
4) Status transitions visible to reporter; timestamps update.
5) Attachments: reporter sends image; reviewer can view; reviewer can send file (upload → message) back to reporter.
6) Edge cases: invalid `short_id` in status check; 429 rate limiting; webhook outage (bot re‑subscribes on start; LP fallback).

---

## 13) Acceptance Criteria
- Inline keyboards only; flows navigable without slash‑commands (aside from `/start`).
- Two roles implemented; reviewer verification enforced per organization.
- Full case lifecycle implemented with anonymized bridge messaging.
- Webhook subscription on startup; Long Polling fallback toggleable.
- Media handling for inbound and outbound within platform limits.
- No Redis; single DB; organizations and reviewers configured via files/env.

