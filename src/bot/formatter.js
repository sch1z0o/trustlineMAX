import { STATUS_LABELS_RU } from '../config/constants.js';
import { truncate, formatDateTime, formatContact } from '../utils/text.js';

export const formatCaseSummary = ({ caseRecord, org, categoryName }) => {
  return [
    `[${caseRecord.short_id}] Организация: ${org?.name || caseRecord.org_id}`,
    `Категория: ${categoryName || caseRecord.category_id}`,
    `Статус: ${STATUS_LABELS_RU[caseRecord.status] || caseRecord.status}`,
    `Текст: ${truncate(caseRecord.text, 240)}`,
    `Вложения: ${countAttachments(caseRecord.attachments_json)}`,
    `Контакт: ${formatContact(caseRecord)}`,
  ].join('\n');
};

export const countAttachments = (json) => {
  if (!json) return 0;
  try {
    const parsed = JSON.parse(json);
    return parsed.length;
  } catch (err) {
    return 0;
  }
};

export const formatReporterSummary = ({ orgName, categoryName, text, attachmentsCount, contactValue }) => {
  return [
    `${orgName ? `${orgName}` : ''}`,
    `${categoryName ? `Категория: ${categoryName}` : ''}`,
    `${text ? `Текст: ${truncate(text, 500)}` : ''}`,
    `Вложения: ${attachmentsCount}`,
    `Контакт: ${contactValue || 'нет'}`,
  ]
    .filter(Boolean)
    .join('\n');
};

export const formatStatusMessage = (caseRecord) => {
  const statusRu = STATUS_LABELS_RU[caseRecord.status] || caseRecord.status;
  const updatedAt = formatDateTime(caseRecord.updated_at);
  return {
    statusText: `Статус вашего обращения ${caseRecord.short_id}: ${statusRu}\nПоследнее изменение: ${updatedAt}.`,
    questionText: caseRecord.pending_question
      ? `Уточнение от службы контроля:\n${caseRecord.pending_question}`
      : null,
  };
};
