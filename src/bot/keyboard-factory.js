import { inlineKeyboard, chunkButtons } from '../utils/keyboard.js';
import RU from '../localization/ru.js';
import { ACTIONS, CALLBACK_PREFIXES } from './actions.js';

export const mainMenuKeyboard = () =>
  inlineKeyboard([
    [
      { text: RU.buttonReport, callbackData: ACTIONS.REPORT_START },
      { text: RU.buttonStatus, callbackData: ACTIONS.STATUS },
    ],
    [
      { text: RU.buttonReviewer, callbackData: ACTIONS.REVIEWER },
      { text: RU.buttonHelp, callbackData: ACTIONS.HELP },
    ],
  ]);

export const orgKeyboard = (orgs) => {
  const buttons = orgs.map((org) => ({
    text: org.name,
    callbackData: `${CALLBACK_PREFIXES.ORG}${org.id}`,
  }));
  return inlineKeyboard(chunkButtons(buttons, 1));
};

export const categoryKeyboard = (categories) => {
  const buttons = categories.map((cat) => ({
    text: cat.name,
    callbackData: `${CALLBACK_PREFIXES.CAT}${cat.id}`,
  }));
  return inlineKeyboard(chunkButtons(buttons, 2));
};

export const contactKeyboard = () =>
  inlineKeyboard([
    [
      { text: RU.contactYes, callbackData: ACTIONS.CONTACT_YES },
      { text: RU.contactNo, callbackData: ACTIONS.CONTACT_NO },
    ],
  ]);

export const submitKeyboard = () =>
  inlineKeyboard([
    [
      { text: RU.submitButton, callbackData: ACTIONS.REPORT_SUBMIT },
      { text: RU.editButton, callbackData: ACTIONS.REPORT_EDIT },
    ],
  ]);

export const statusReplyKeyboard = (shortId) =>
  inlineKeyboard([[{ text: RU.replyButton, callbackData: `${CALLBACK_PREFIXES.CASE_REPLY}${shortId}` }]]);

export const reviewerMenuKeyboard = (orgs, activeOrgId) => {
  const topRow = [
    { text: RU.reviewerButtons.inbox, callbackData: ACTIONS.REV_INBOX },
    { text: RU.reviewerButtons.inProgress, callbackData: ACTIONS.REV_INPROG },
  ];
  const secondRow = [
    { text: RU.reviewerButtons.closed, callbackData: ACTIONS.REV_CLOSED },
    { text: RU.reviewerButtons.find, callbackData: ACTIONS.REV_FIND },
  ];
  const rows = [topRow, secondRow];
  if (orgs.length > 1) {
    rows.push(
      orgs.map((org) => ({
        text: org.id === activeOrgId ? `▶ ${org.name}` : org.name,
        callbackData: `${CALLBACK_PREFIXES.REV_ORG}${org.id}`,
      }))
    );
  }
  return inlineKeyboard(rows);
};

export const reviewerCaseKeyboard = (shortId) =>
  inlineKeyboard([
    [
      { text: 'Взять в работу', callbackData: `${CALLBACK_PREFIXES.REV_TAKE}${shortId}` },
      { text: 'Ответить', callbackData: `${CALLBACK_PREFIXES.REV_REPLY}${shortId}` },
    ],
    [
      { text: 'Запросить уточнение', callbackData: `${CALLBACK_PREFIXES.REV_ASK}${shortId}` },
      { text: 'Закрыть (подтв.)', callbackData: `${CALLBACK_PREFIXES.REV_CLOSE_CONF}${shortId}` },
    ],
    [
      { text: 'Закрыть (не подтв.)', callbackData: `${CALLBACK_PREFIXES.REV_CLOSE_UNCONF}${shortId}` },
      { text: 'Отклонить', callbackData: `${CALLBACK_PREFIXES.REV_REJECT}${shortId}` },
    ],
  ]);
