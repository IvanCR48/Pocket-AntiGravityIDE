/**
 * Domain entity representing a user prompt sent to the IDE.
 */
class Prompt {
  constructor({
    text = '',
    filePath = '',
    uploadedImage = null,
    focusShortcut = 'Auto',
    method = 'keybd_event',
    newChat = false,
    personaId = 'pair'
  }) {
    this.text = text.trim();
    this.filePath = filePath.trim();
    this.uploadedImage = uploadedImage;
    this.focusShortcut = focusShortcut;
    this.method = method;
    this.newChat = Boolean(newChat);
    this.personaId = personaId || 'pair';
    this.createdAt = new Date();
  }

  isValid() {
    return Boolean(this.newChat || this.text || this.uploadedImage || this.filePath);
  }
}

module.exports = { Prompt };
