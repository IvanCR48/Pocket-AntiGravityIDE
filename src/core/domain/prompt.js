/**
 * Domain entity representing a user prompt sent to the IDE.
 */
class Prompt {
  constructor({ text = '', filePath = '', uploadedImage = null, focusShortcut = 'Auto', method = 'keybd_event', newChat = false }) {
    this.text = text.trim();
    this.filePath = filePath.trim();
    this.uploadedImage = uploadedImage;
    this.focusShortcut = focusShortcut;
    this.method = method;
    this.newChat = Boolean(newChat);
    this.createdAt = new Date();
  }

  isValid() {
    return Boolean(this.newChat || this.text || this.uploadedImage || this.filePath);
  }
}

module.exports = { Prompt };
