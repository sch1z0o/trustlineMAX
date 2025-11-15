import logger from '../logger.js';
import config from '../config/index.js';
import RU from '../localization/ru.js';
import { ACTIONS, CALLBACK_PREFIXES } from './actions.js';
import {
  categoryKeyboard,
  contactKeyboard,
  mainMenuKeyboard,
  orgKeyboard,
  reviewerMenuKeyboard,
  reviewerCaseKeyboard,
  statusReplyKeyboard,
  submitKeyboard,
} from './keyboard-factory.js';
import organizationService from '../services/organization-service.js';
import caseService from '../services/case-service.js';
import reviewerService from '../services/reviewer-service.js';
import sessionService from '../services/session-service.js';
import auditService from '../services/audit-service.js';
import { formatCaseSummary, formatStatusMessage } from './formatter.js';

const MAX_MESSAGE_LENGTH = 3900;

const sanitizeText = (text) => {
  if (!text) return '';
  return text.length > MAX_MESSAGE_LENGTH ? `${text.slice(0, MAX_MESSAGE_LENGTH - 1)}…` : text;
};

const normalizeUserId = (message) => String(message?.sender?.id ?? '');

const ensureChatId = (message) => message?.chat?.id || message?.conversation?.id || message?.sender?.id;

const mapAttachments = (attachments = []) =>
  attachments.map((att) => ({
    id: att.id,
    type: att.type,
    file_id: att.file_id || att.fileId,
    mime_type: att.mime_type || att.mimeType,
    size: att.size,
    name: att.file_name || att.fileName,
  }));

export default class TrustLineBot {
  constructor(maxClient) {
    this.client = maxClient;
  }

  async handleUpdate(update) {
    try {
      if (update.type === 'message_created') {
        await this.handleMessage(update.message);
      } else if (update.type === 'message_callback') {
        await this.handleCallback(update.callback);
      }
    } catch (err) {
      logger.error('Failed to handle update: %s', err.message, { err });
    }
  }

  async handleMessage(message) {
    if (!message) return;
    const userId = normalizeUserId(message);
    const chatId = ensureChatId(message);
    if (!userId || !chatId) {
      return;
    }

    const text = (message.text || '').trim();
    const attachments = mapAttachments(message.attachments || []);
    const session = sessionService.getSession(userId);

    if (text === '/start') {
      sessionService.clearSession(userId);
      await this.sendMainMenu(chatId);
      return;
    }

    switch (session.state) {
      case 'report.contact':
        await this.client.sendMessage({ chatId, text: RU.contactAsk, keyboard: contactKeyboard() });
        break;
      case 'report.confirm':
        await this.sendReportSummary(userId, chatId, session.data?.draft || {});
        break;
      case 'report.description':
        await this.captureReportDescription({ userId, chatId, text, attachments, session });
        break;
      case 'report.contact_details':
        await this.captureContactDetails({ userId, chatId, text, session });
        break;
      case 'status.wait_short_id':
        await this.lookupStatus({ userId, chatId, text });
        break;
      case 'reporter.followup':
        await this.handleReporterFollowup({ userId, chatId, text, attachments, session });
        break;
      case 'reviewer.await_code':
        await this.handleReviewerCode({ userId, chatId, text });
        break;
      case 'reviewer.reply':
        await this.commitReviewerMessage({ userId, chatId, text, attachments, kind: 'reply', session });
        break;
      case 'reviewer.ask':
        await this.commitReviewerMessage({ userId, chatId, text, attachments, kind: 'ask', session });
        break;
      case 'reviewer.find_case':
        await this.handleReviewerFind({ userId, chatId, text });
        break;
      default:
        await this.sendMainMenu(chatId);
    }
  }

  async handleCallback(callback) {
    if (!callback) return;
    const { data, callback_id: callbackId, from } = callback;
    const payload = data || callback.payload;
    if (!payload) return;
    const userId = String(from?.id || callback.user_id || '');
    const chatId =
      callback.message?.chat?.id ||
      callback.chat?.id ||
      from?.chat_id ||
      from?.chatId ||
      callback.chat_id ||
      userId;

    if (callbackId) {
      await this.client.answerCallback({ callbackId, text: 'OK' }).catch(() => {});
    }

    if (payload === ACTIONS.HELP) {
      await this.client.sendMessage({ chatId, text: RU.helpText });
      return;
    }
    if (payload === ACTIONS.REPORT_START) {
      await this.startReportFlow(userId, chatId);
      return;
    }
    if (payload.startsWith(CALLBACK_PREFIXES.ORG)) {
      await this.onOrgSelected(userId, chatId, payload.replace(CALLBACK_PREFIXES.ORG, ''));
      return;
    }
    if (payload.startsWith(CALLBACK_PREFIXES.CAT)) {
      await this.onCategorySelected(userId, chatId, payload.replace(CALLBACK_PREFIXES.CAT, ''));
      return;
    }
    if (payload === ACTIONS.CONTACT_YES || payload === ACTIONS.CONTACT_NO) {
      await this.onContactChoice(userId, chatId, payload === ACTIONS.CONTACT_YES);
      return;
    }
    if (payload === ACTIONS.REPORT_SUBMIT) {
      await this.submitReport(userId, chatId);
      return;
    }
    if (payload === ACTIONS.REPORT_EDIT) {
      await this.editReport(userId, chatId);
      return;
    }
    if (payload === ACTIONS.STATUS) {
      await this.promptStatus(userId, chatId);
      return;
    }
    if (payload === ACTIONS.REVIEWER) {
      await this.enterReviewerMode(userId, chatId);
      return;
    }
    if (payload.startsWith(CALLBACK_PREFIXES.CASE_REPLY)) {
      const shortId = payload.replace(CALLBACK_PREFIXES.CASE_REPLY, '');
      await this.prepareReporterReply(userId, chatId, shortId);
      return;
    }
    if (payload.startsWith(CALLBACK_PREFIXES.REV_ORG)) {
      await this.switchReviewerOrg(userId, chatId, payload.replace(CALLBACK_PREFIXES.REV_ORG, ''));
      return;
    }

    if (
      payload.startsWith(CALLBACK_PREFIXES.REV_TAKE) ||
      payload.startsWith(CALLBACK_PREFIXES.REV_REPLY) ||
      payload.startsWith(CALLBACK_PREFIXES.REV_ASK) ||
      payload.startsWith(CALLBACK_PREFIXES.REV_CLOSE_CONF) ||
      payload.startsWith(CALLBACK_PREFIXES.REV_CLOSE_UNCONF) ||
      payload.startsWith(CALLBACK_PREFIXES.REV_REJECT)
    ) {
      await this.handleReviewerAction(userId, chatId, payload);
      return;
    }

    if (
      payload === ACTIONS.REV_INBOX ||
      payload === ACTIONS.REV_INPROG ||
      payload === ACTIONS.REV_CLOSED ||
      payload === ACTIONS.REV_FIND
    ) {
      await this.handleReviewerList(userId, chatId, payload);
    }
  }

  async sendMainMenu(chatId) {
    await this.client.sendMessage({
      chatId,
      text: sanitizeText(RU.mainMenuPrompt),
      keyboard: mainMenuKeyboard(),
    });
  }

  async startReportFlow(userId, chatId) {
    const orgs = organizationService.listActiveOrganizations();
    sessionService.saveSession(userId, { state: 'report.org', data: { draft: {} } });
    await this.client.sendMessage({
      chatId,
      text: RU.orgPrompt,
      keyboard: orgKeyboard(orgs),
    });
  }

  async onOrgSelected(userId, chatId, orgId) {
    const org = organizationService.getOrganizationById(orgId);
    if (!org) {
      await this.client.sendMessage({ chatId, text: RU.genericError });
      return;
    }
    const session = sessionService.getSession(userId);
    const draft = { ...(session.data?.draft || {}), orgId };
    sessionService.saveSession(userId, { state: 'report.category', data: { draft } });
    const categories = organizationService.listCategoriesForOrg(orgId);
    await this.client.sendMessage({
      chatId,
      text: RU.categoryPrompt,
      keyboard: categoryKeyboard(categories),
    });
  }

  async onCategorySelected(userId, chatId, categoryId) {
    const session = sessionService.getSession(userId);
    if (!session.data?.draft?.orgId) {
      await this.startReportFlow(userId, chatId);
      return;
    }
    const draft = { ...session.data.draft, categoryId };
    sessionService.saveSession(userId, { state: 'report.description', data: { draft } });
    await this.client.sendMessage({ chatId, text: RU.describePrompt });
  }

  async captureReportDescription({ userId, chatId, text, attachments, session }) {
    if (!text && !attachments.length) {
      await this.client.sendMessage({ chatId, text: RU.describePrompt });
      return;
    }
    const draft = {
      ...(session.data?.draft || {}),
      text,
      attachments,
    };
    sessionService.saveSession(userId, { state: 'report.contact', data: { draft } });
    await this.client.sendMessage({ chatId, text: RU.contactAsk, keyboard: contactKeyboard() });
  }

  async onContactChoice(userId, chatId, hasContact) {
    const session = sessionService.getSession(userId);
    const draft = { ...(session.data?.draft || {}), contactOptIn: hasContact };
    if (hasContact) {
      sessionService.saveSession(userId, { state: 'report.contact_details', data: { draft } });
      await this.client.sendMessage({ chatId, text: RU.contactRequest });
    } else {
      sessionService.saveSession(userId, { state: 'report.confirm', data: { draft } });
      await this.sendReportSummary(userId, chatId, draft);
    }
  }

  async captureContactDetails({ userId, chatId, text, session }) {
    if (!text) {
      await this.client.sendMessage({ chatId, text: RU.contactRequest });
      return;
    }
    const contact = this.extractContact(text);
    const draft = { ...(session.data?.draft || {}), contact: contact.raw, contactEmail: contact.email, contactPhone: contact.phone };
    sessionService.saveSession(userId, { state: 'report.confirm', data: { draft } });
    await this.sendReportSummary(userId, chatId, draft);
  }

  extractContact(value) {
    const emailMatch = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const digits = value.replace(/\D/g, '');
    return {
      raw: value,
      email: emailMatch ? emailMatch[0] : null,
      phone: digits.length >= 6 ? digits : null,
    };
  }

  async sendReportSummary(userId, chatId, draft) {
    const org = organizationService.getOrganizationById(draft.orgId);
    const categories = organizationService.listCategoriesForOrg(draft.orgId);
    const cat = categories.find((c) => c.id === draft.categoryId);
    const text = [
      RU.summaryTitle,
      `${RU.summaryOrg}: ${org?.name || draft.orgId}`,
      `${RU.summaryCategory}: ${cat?.name || draft.categoryId}`,
      `${RU.summaryText}: ${draft.text ? draft.text.slice(0, 500) : ''}`,
      `${RU.summaryAttachments}: ${draft.attachments?.length || 0}`,
      `${RU.summaryContact}: ${draft.contact ? draft.contact : draft.contactOptIn ? 'да' : 'нет'}`,
    ].join('\n');
    await this.client.sendMessage({ chatId, text, keyboard: submitKeyboard() });
  }

  async submitReport(userId, chatId) {
    const session = sessionService.getSession(userId);
    const draft = session.data?.draft;
    if (!draft?.orgId || !draft?.categoryId || !draft?.text) {
      await this.client.sendMessage({ chatId, text: RU.genericError });
      return;
    }
    const caseRecord = caseService.createCase({
      orgId: draft.orgId,
      categoryId: draft.categoryId,
      text: draft.text,
      reporterUserId: userId,
      reporterChatId: chatId,
      contactOptIn: !!draft.contactOptIn,
      contactEmail: draft.contactEmail || null,
      contactPhone: draft.contactPhone || null,
      contactNote: draft.contact || null,
      attachments: draft.attachments || [],
    });
    caseService.insertCaseMessage({
      caseId: caseRecord.id,
      senderType: 'reporter',
      text: draft.text,
      attachments: draft.attachments || [],
    });
    auditService.log(caseRecord.id, userId, 'CASE_CREATED', {});
    sessionService.clearSession(userId);
    await this.client.sendMessage({ chatId, text: RU.submitSuccess(caseRecord.short_id) });
    await this.notifyReviewers(draft.orgId, caseRecord.short_id);
  }

  async editReport(userId, chatId) {
    const session = sessionService.getSession(userId);
    if (!session.data?.draft) {
      await this.startReportFlow(userId, chatId);
      return;
    }
    sessionService.saveSession(userId, { state: 'report.description', data: session.data });
    await this.client.sendMessage({ chatId, text: RU.describePrompt });
  }

  async promptStatus(userId, chatId) {
    sessionService.saveSession(userId, { state: 'status.wait_short_id', data: {} });
    await this.client.sendMessage({ chatId, text: RU.statusPrompt });
  }

  async lookupStatus({ userId, chatId, text }) {
    if (!text) {
      await this.client.sendMessage({ chatId, text: RU.statusPrompt });
      return;
    }
    const caseRecord = caseService.findCaseByShortId(text.trim().toUpperCase());
    if (!caseRecord) {
      await this.client.sendMessage({ chatId, text: RU.caseNotFound });
      return;
    }
    const { statusText, questionText } = formatStatusMessage(caseRecord);
    await this.client.sendMessage({ chatId, text: statusText });
    if (questionText) {
      await this.client.sendMessage({
        chatId,
        text: `${questionText}\n${RU.pendingQuestionNotice}`,
        keyboard: statusReplyKeyboard(caseRecord.short_id),
      });
    }
    sessionService.saveSession(userId, { state: 'status.wait_short_id', data: { lastCaseShortId: caseRecord.short_id } });
  }

  async prepareReporterReply(userId, chatId, shortId) {
    const caseRecord = caseService.findCaseByShortId(shortId);
    if (!caseRecord || (caseRecord.reporter_user_id && caseRecord.reporter_user_id !== userId)) {
      await this.client.sendMessage({ chatId, text: RU.caseNotFound });
      return;
    }
    sessionService.saveSession(userId, { state: 'reporter.followup', data: { caseId: caseRecord.id } });
    await this.client.sendMessage({ chatId, text: RU.describePrompt });
  }

  async handleReporterFollowup({ userId, chatId, text, attachments, session }) {
    const caseId = session.data?.caseId;
    if (!caseId || (!text && !attachments.length)) {
      await this.client.sendMessage({ chatId, text: RU.describePrompt });
      return;
    }
    caseService.insertCaseMessage({ caseId, senderType: 'reporter', text, attachments });
    caseService.clearPendingQuestion(caseId);
    sessionService.saveSession(userId, { state: 'status.wait_short_id', data: session.data });
    await this.client.sendMessage({ chatId, text: RU.reporterReplySaved });
    await this.pushMessageToReviewers(caseId, text, attachments);
  }

  async notifyReviewers(orgId, shortId) {
    const reviewers = reviewerService.listReviewersForOrg(orgId).filter((r) => r.chat_id);
    const org = organizationService.getOrganizationById(orgId);
    const text = `Новое обращение ${shortId} в ${org?.name || orgId}.`;
    await Promise.all(
      reviewers.map((rev) =>
        this.client.sendMessage({
          chatId: rev.chat_id,
          text,
        })
      )
    );
  }

  async pushMessageToReviewers(caseId, text, attachments) {
    const caseRecord = caseService.findCaseById(caseId);
    if (!caseRecord) return;
    const orgReviewers = reviewerService.listReviewersForOrg(caseRecord.org_id).filter((r) => r.chat_id);
    const payload = `Заявитель #${caseRecord.short_id}:\n${text}`;
    await Promise.all(
      orgReviewers.map((rev) =>
        this.client.sendMessage({
          chatId: rev.chat_id,
          text: payload,
          attachments,
        })
      )
    );
  }

  async enterReviewerMode(userId, chatId) {
    const initialOrgIds = reviewerService.listReviewerOrgIds(userId);
    if (!initialOrgIds.length) {
      const granted = reviewerService.verifyByWhitelist(userId, config.reviewersWhitelist, chatId);
      if (!granted.length) {
        sessionService.saveSession(userId, { state: 'reviewer.await_code', data: {} });
        await this.client.sendMessage({ chatId, text: RU.reviewerCodePrompt });
        return;
      }
    }
    await this.showReviewerMenu(userId, chatId);
  }

  async handleReviewerCode(userId, chatId, code) {
    if (!code) {
      await this.client.sendMessage({ chatId, text: RU.reviewerCodePrompt });
      return;
    }
    const record = reviewerService.verifyByAccessCode(null, code.trim());
    if (!record) {
      await this.client.sendMessage({ chatId, text: RU.reviewerDenied });
      return;
    }
    reviewerService.upsertReviewer(userId, record.org_id, chatId);
    await this.showReviewerMenu(userId, chatId);
  }

  async showReviewerMenu(userId, chatId) {
    const orgIds = reviewerService.listReviewerOrgIds(userId);
    if (!orgIds.length) {
      await this.client.sendMessage({ chatId, text: RU.reviewerDenied });
      return;
    }
    const orgs = orgIds
      .map((id) => organizationService.getOrganizationById(id))
      .filter(Boolean);
    const activeOrgId = orgs[0]?.id;
    orgs.forEach((org) => reviewerService.ensureReviewerChat(userId, org.id, chatId));
    sessionService.saveSession(userId, { state: null, data: { reviewerOrgId: activeOrgId } });
    await this.client.sendMessage({
      chatId,
      text: RU.reviewerMenu,
      keyboard: reviewerMenuKeyboard(orgs, activeOrgId),
    });
  }

  async switchReviewerOrg(userId, chatId, orgId) {
    const orgIds = reviewerService.listReviewerOrgIds(userId);
    if (!orgIds.includes(orgId)) {
      await this.client.sendMessage({ chatId, text: RU.reviewerDenied });
      return;
    }
    const orgs = orgIds.map((id) => organizationService.getOrganizationById(id)).filter(Boolean);
    sessionService.saveSession(userId, { state: null, data: { reviewerOrgId: orgId } });
    await this.client.sendMessage({
      chatId,
      text: `${RU.reviewerMenu}\nАктивная организация: ${organizationService.getOrganizationById(orgId)?.name}`,
      keyboard: reviewerMenuKeyboard(orgs, orgId),
    });
  }

  getReviewerOrg(userId) {
    const session = sessionService.getSession(userId);
    const saved = session.data?.reviewerOrgId;
    if (saved) return saved;
    const orgIds = reviewerService.listReviewerOrgIds(userId);
    return orgIds[0];
  }

  async handleReviewerList(userId, chatId, action) {
    const orgId = this.getReviewerOrg(userId);
    if (!orgId) {
      await this.enterReviewerMode(userId, chatId);
      return;
    }
    if (action === ACTIONS.REV_FIND) {
      sessionService.saveSession(userId, { state: 'reviewer.find_case', data: { reviewerOrgId: orgId } });
      await this.client.sendMessage({ chatId, text: 'Введите номер обращения.' });
      return;
    }
    const statuses =
      action === ACTIONS.REV_INBOX
        ? ['new', 'triage']
        : action === ACTIONS.REV_INPROG
          ? ['in_progress']
          : ['resolved_confirmed', 'resolved_unconfirmed', 'rejected'];
    const cases = caseService.listCasesByStatuses({ orgId, statuses, limit: 5 });
    if (!cases.length) {
      await this.client.sendMessage({ chatId, text: 'Нет обращений.' });
      return;
    }
    const org = organizationService.getOrganizationById(orgId);
    const categories = organizationService.listCategoriesForOrg(orgId);
    await Promise.all(
      cases.map((c) =>
        this.client.sendMessage({
          chatId,
          text: formatCaseSummary({
            caseRecord: c,
            org,
            categoryName: categories.find((cat) => cat.id === c.category_id)?.name,
          }),
          keyboard: reviewerCaseKeyboard(c.short_id),
        })
      )
    );
  }

  async handleReviewerFind({ userId, chatId, text }) {
    const session = sessionService.getSession(userId);
    const orgId = session.data?.reviewerOrgId || this.getReviewerOrg(userId);
    sessionService.saveSession(userId, { state: null, data: { reviewerOrgId: orgId } });
    if (!text) {
      await this.client.sendMessage({ chatId, text: 'Введите номер обращения.' });
      return;
    }
    const caseRecord = caseService.findCaseByShortId(text.trim().toUpperCase());
    if (!caseRecord || caseRecord.org_id !== orgId) {
      await this.client.sendMessage({ chatId, text: RU.caseNotFound });
      return;
    }
    const org = organizationService.getOrganizationById(orgId);
    const categories = organizationService.listCategoriesForOrg(orgId);
    await this.client.sendMessage({
      chatId,
      text: formatCaseSummary({
        caseRecord,
        org,
        categoryName: categories.find((cat) => cat.id === caseRecord.category_id)?.name,
      }),
      keyboard: reviewerCaseKeyboard(caseRecord.short_id),
    });
  }

  async handleReviewerAction(userId, chatId, payload) {
    const shortId = payload.split('_').slice(-1)[0];
    const caseRecord = caseService.findCaseByShortId(shortId);
    if (!caseRecord) {
      await this.client.sendMessage({ chatId, text: RU.caseNotFound });
      return;
    }
    const action = this.resolveReviewerAction(payload);
    switch (action) {
      case 'TAKE':
        caseService.assignCase(caseRecord.id, userId, auditService);
        caseService.updateCaseStatus(caseRecord.id, 'in_progress', userId, auditService);
        await this.client.sendMessage({ chatId, text: RU.reviewerTakeAck });
        break;
      case 'REPLY':
        sessionService.saveSession(userId, { state: 'reviewer.reply', data: { caseId: caseRecord.id } });
        await this.client.sendMessage({ chatId, text: RU.reviewerReplyPrompt });
        break;
      case 'ASK':
        sessionService.saveSession(userId, { state: 'reviewer.ask', data: { caseId: caseRecord.id } });
        await this.client.sendMessage({ chatId, text: RU.reviewerAskPrompt });
        break;
      case 'CLOSE_CONF':
        caseService.updateCaseStatus(caseRecord.id, 'resolved_confirmed', userId, auditService);
        await this.client.sendMessage({ chatId, text: RU.reviewerCloseConfirmed });
        await this.bridgeToReporter(caseRecord, 'Обращение закрыто: подтверждено.');
        break;
      case 'CLOSE_UNCONF':
        caseService.updateCaseStatus(caseRecord.id, 'resolved_unconfirmed', userId, auditService);
        await this.client.sendMessage({ chatId, text: RU.reviewerCloseUnconfirmed });
        await this.bridgeToReporter(caseRecord, 'Обращение закрыто: не подтвердилось.');
        break;
      case 'REJECT':
        caseService.updateCaseStatus(caseRecord.id, 'rejected', userId, auditService);
        await this.client.sendMessage({ chatId, text: RU.reviewerRejected });
        await this.bridgeToReporter(caseRecord, 'Обращение отклонено.');
        break;
      default:
        await this.client.sendMessage({ chatId, text: RU.genericError });
    }
  }

  resolveReviewerAction(payload) {
    if (payload.startsWith(CALLBACK_PREFIXES.REV_TAKE)) return 'TAKE';
    if (payload.startsWith(CALLBACK_PREFIXES.REV_REPLY)) return 'REPLY';
    if (payload.startsWith(CALLBACK_PREFIXES.REV_ASK)) return 'ASK';
    if (payload.startsWith(CALLBACK_PREFIXES.REV_CLOSE_CONF)) return 'CLOSE_CONF';
    if (payload.startsWith(CALLBACK_PREFIXES.REV_CLOSE_UNCONF)) return 'CLOSE_UNCONF';
    if (payload.startsWith(CALLBACK_PREFIXES.REV_REJECT)) return 'REJECT';
    return null;
  }

  async commitReviewerMessage({ userId, chatId, text, attachments, kind, session }) {
    if (!text && !attachments.length) {
      await this.client.sendMessage({
        chatId,
        text: kind === 'ask' ? RU.reviewerAskPrompt : RU.reviewerReplyPrompt,
      });
      return;
    }
    const caseId = session.data?.caseId;
    const caseRecord = caseId ? caseService.findCaseById(caseId) : null;
    if (!caseRecord) {
      sessionService.saveSession(userId, { state: null, data: {} });
      await this.client.sendMessage({ chatId, text: RU.caseNotFound });
      return;
    }
    caseService.insertCaseMessage({ caseId, senderType: 'reviewer', text, attachments });
    if (kind === 'ask') {
      caseService.setPendingQuestion(caseId, text);
    }
    await this.bridgeToReporter(caseRecord, `${RU.bridgePrefix}\n${text}`, attachments);
    sessionService.saveSession(userId, { state: null, data: { reviewerOrgId: caseRecord.org_id } });
    await this.client.sendMessage({ chatId, text: RU.reviewerReplyAck });
  }

  async bridgeToReporter(caseRecord, text, attachments) {
    if (!caseRecord.reporter_chat_id) {
      return;
    }
    const payload =
      text && text.startsWith(RU.bridgePrefix)
        ? text
        : `${RU.bridgePrefix}\n${text || ''}`;
    await this.client.sendMessage({
      chatId: caseRecord.reporter_chat_id,
      text: payload,
      attachments,
    });
  }
}
