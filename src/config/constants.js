export const DEFAULT_CATEGORIES = [
  { id: 'CAT_BRIBERY', name: 'Взяточничество и коррупция' },
  { id: 'CAT_FRAUD', name: 'Мошенничество' },
  { id: 'CAT_CONFLICT', name: 'Конфликт интересов' },
  { id: 'CAT_HARASS', name: 'Дискриминация/домогательства' },
  { id: 'CAT_PRIVACY', name: 'Нарушение защиты данных' },
  { id: 'CAT_INSIDER', name: 'Использование инсайдерской информации' },
  { id: 'CAT_ABUSE', name: 'Злоупотребление полномочиями' },
  { id: 'CAT_OTHER', name: 'Иное' },
];

export const CASE_STATUSES = [
  'new',
  'triage',
  'in_progress',
  'resolved_confirmed',
  'resolved_unconfirmed',
  'rejected',
];

export const STATUS_LABELS_RU = {
  new: 'Новое',
  triage: 'На проверке',
  in_progress: 'В работе',
  resolved_confirmed: 'Закрыто (подтверждено)',
  resolved_unconfirmed: 'Закрыто (не подтвердилось)',
  rejected: 'Отклонено',
};

export const REVIEWER_ACTIONS = {
  TAKE: 'REV_TAKE',
  REPLY: 'REV_REPLY',
  ASK: 'REV_ASK',
  CLOSE_CONF: 'REV_CLOSE_CONF',
  CLOSE_UNCONF: 'REV_CLOSE_UNCONF',
  REJECT: 'REV_REJECT',
};
