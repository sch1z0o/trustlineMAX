import dayjs from 'dayjs';

export const truncate = (text, limit = 500) => {
  if (!text) return '';
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
};

export const formatDateTime = (value) => {
  if (!value) return '—';
  return dayjs(value).format('DD.MM.YYYY HH:mm');
};

export const formatContact = (caseRecord) => {
  if (!caseRecord.contact_opt_in) {
    return 'нет';
  }
  if (caseRecord.contact_email) {
    return caseRecord.contact_email;
  }
  if (caseRecord.contact_phone) {
    return caseRecord.contact_phone;
  }
  return 'да';
};
