export const inlineKeyboard = (rows = []) => ({
  inline: true,
  buttons: rows.map((row) =>
    row.map((btn) => ({
      text: btn.text,
      callback_data: btn.callbackData,
    }))
  ),
});

export const chunkButtons = (items, perRow = 2) => {
  const rows = [];
  let buffer = [];
  items.forEach((item) => {
    buffer.push(item);
    if (buffer.length === perRow) {
      rows.push(buffer);
      buffer = [];
    }
  });
  if (buffer.length) {
    rows.push(buffer);
  }
  return rows;
};
