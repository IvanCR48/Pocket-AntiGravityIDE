/**
 * Terminal UI Theme & Animations
 * Provides neon gradients, box frames, badges, and animated CLI spinners.
 */

const ESC = '\x1b[';
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;
const DIM = `${ESC}2m`;

// Color palette (RGB truecolor)
const COLORS = {
  blurple: [88, 101, 242],
  cyan: [0, 240, 255],
  magenta: [255, 0, 128],
  neonGreen: [0, 255, 136],
  yellow: [255, 204, 0],
  red: [255, 68, 68],
  white: [250, 250, 255],
  gray: [120, 125, 135],
  darkGray: [60, 64, 75]
};

function rgb(r, g, b, text) {
  return `${ESC}38;2;${r};${g};${b}m${text}${RESET}`;
}

function hex(hexStr, text) {
  const num = parseInt(hexStr.replace('#', ''), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return rgb(r, g, b, text);
}

/**
 * Creates a smooth RGB horizontal gradient across a string of text
 */
function gradient(text, startRgb = COLORS.magenta, endRgb = COLORS.cyan) {
  const chars = Array.from(text);
  const len = chars.length || 1;
  return chars.map((ch, i) => {
    const factor = i / (len - 1 || 1);
    const r = Math.round(startRgb[0] + factor * (endRgb[0] - startRgb[0]));
    const g = Math.round(startRgb[1] + factor * (endRgb[1] - startRgb[1]));
    const b = Math.round(startRgb[2] + factor * (endRgb[2] - startRgb[2]));
    return `${ESC}38;2;${r};${g};${b}m${ch}`;
  }).join('') + RESET;
}

/**
 * Renders a stylized card box with rounded borders
 */
function box(lines, options = {}) {
  const {
    title = '',
    borderColor = COLORS.blurple,
    padding = 2,
    minWidth = 58
  } = options;

  // Clean ANSI for width calculations
  const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, '');

  let contentWidth = minWidth;
  if (title) contentWidth = Math.max(contentWidth, stripAnsi(title).length + 4);
  lines.forEach(l => {
    contentWidth = Math.max(contentWidth, stripAnsi(l).length + (padding * 2));
  });

  const border = (char) => rgb(borderColor[0], borderColor[1], borderColor[2], char);

  const topBorder = title
    ? border('╭─ ') + `${BOLD}${title}${RESET}` + border(' ' + '─'.repeat(Math.max(0, contentWidth - stripAnsi(title).length - 3)) + '╮')
    : border('╭' + '─'.repeat(contentWidth) + '╮');

  const bottomBorder = border('╰' + '─'.repeat(contentWidth) + '╯');

  const formattedLines = lines.map(line => {
    const stripped = stripAnsi(line);
    const rightPad = Math.max(0, contentWidth - stripped.length - (padding * 2));
    const padStr = ' '.repeat(padding);
    return border('│') + padStr + line + ' '.repeat(rightPad) + padStr + border('│');
  });

  return [topBorder, ...formattedLines, bottomBorder].join('\n');
}

/**
 * Animated terminal spinner for async tasks
 */
class Spinner {
  constructor(initialText = 'Loading...') {
    this.text = initialText;
    this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.index = 0;
    this.timer = null;
    this.isTTY = process.stdout.isTTY;
  }

  start() {
    if (!this.isTTY) {
      console.log(`[*] ${this.text}`);
      return this;
    }

    // Hide cursor
    process.stdout.write(`${ESC}?25l`);

    this.timer = setInterval(() => {
      const frame = rgb(COLORS.cyan[0], COLORS.cyan[1], COLORS.cyan[2], this.frames[this.index]);
      const current = `${frame} ${BOLD}${this.text}${RESET}`;
      process.stdout.write(`\r\x1b[K${current}`);
      this.index = (this.index + 1) % this.frames.length;
    }, 80);

    return this;
  }

  update(newText) {
    this.text = newText;
    if (!this.isTTY) {
      console.log(`[*] ${newText}`);
    }
  }

  succeed(msg) {
    this.stop();
    const mark = rgb(COLORS.neonGreen[0], COLORS.neonGreen[1], COLORS.neonGreen[2], '✔');
    console.log(`\r\x1b[K${mark} ${BOLD}${msg || this.text}${RESET}`);
  }

  fail(msg) {
    this.stop();
    const mark = rgb(COLORS.red[0], COLORS.red[1], COLORS.red[2], '✖');
    console.log(`\r\x1b[K${mark} ${BOLD}${msg || this.text}${RESET}`);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.isTTY) {
      // Show cursor
      process.stdout.write(`${ESC}?25h`);
    }
  }
}

const BANNER_ART = [
  "  █▀█ █▀█ █▀▀ █ █ █▀▀ ▀█▀   ▄▀█ █▄ █ ▀█▀ █ █▀▀ █▀█ █▀█ █ █ █ ▀█▀ █ █",
  "  █▀▀ █▄█ █▄▄ █▀▄ ██▄  █    █▀█ █ ▀█  █  █ █▄█ █▀▄ █▀█ ▀▄▀ █  █  ▀█▀"
];

function getLogoBanner() {
  return BANNER_ART.map(line => gradient(line, COLORS.magenta, COLORS.cyan)).join('\n');
}

module.exports = {
  COLORS,
  rgb,
  hex,
  gradient,
  box,
  Spinner,
  getLogoBanner,
  BOLD,
  DIM,
  RESET
};
