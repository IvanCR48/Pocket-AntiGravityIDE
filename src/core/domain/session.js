/**
 * Domain entity representing an Antigravity conversation session.
 */
class Session {
  constructor({ id, mtime, title = null }) {
    this.id = id;
    this.mtime = mtime;
    this.title = title || `Session ${id.substring(0, 8)}`;
  }
}

module.exports = { Session };
