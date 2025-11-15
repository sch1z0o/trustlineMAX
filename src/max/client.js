import axios from 'axios';
import logger from '../logger.js';

export default class MaxClient {
  constructor({ token, baseUrl }) {
    this.token = token;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.http = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      timeout: 10000,
    });
  }

  async sendMessage({ chatId, text, keyboard = null, attachments = null, parseMode = 'markdown' }) {
    const payload = {
      chat_id: chatId,
      text,
      parse_mode: parseMode,
    };

    if (keyboard) {
      payload.keyboard = keyboard;
    }

    if (attachments?.length) {
      payload.attachments = attachments;
    }

    return this._request('post', '/messages', payload);
  }

  async editMessage(messageId, { text, keyboard }) {
    return this._request('put', `/messages/${messageId}`, {
      text,
      keyboard,
    });
  }

  async answerCallback({ callbackId, text, showAlert = false }) {
    return this._request('post', '/callbacks/answer', {
      callback_id: callbackId,
      text,
      show_alert: showAlert,
    });
  }

  async setWebhook(url, secret) {
    return this._request('post', '/webhooks', {
      url,
      secret,
    });
  }

  async deleteWebhook() {
    return this._request('delete', '/webhooks');
  }

  async getFile(fileId) {
    return this._request('get', `/files/${fileId}`, null, { responseType: 'arraybuffer' });
  }

  async uploadFile(fileBuffer, filename, mimeType) {
    const body = {
      filename,
      content_type: mimeType,
      data: fileBuffer.toString('base64'),
    };
    return this._request('post', '/files', body);
  }

  async fetchUpdates({ offset = 0, timeout = 15 } = {}) {
    return this._request('get', '/updates', null, {
      params: { offset, timeout },
    });
  }

  async _request(method, url, data, extraConfig = {}) {
    try {
      const response = await this.http.request({
        method,
        url,
        data,
        ...extraConfig,
      });
      return response.data;
    } catch (error) {
      logger.error('MAX API error %s %s: %s', method.toUpperCase(), url, error.message, {
        response: error.response?.data,
      });
      throw error;
    }
  }
}
