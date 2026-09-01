'use strict';
/**
 * WCAG 2.x relative-luminance / contrast-ratio computation.
 *
 * REUSED VERBATIM (not reimplemented) from the WO-10 Interface Artisan
 * exercise (E5), which built and independently verified this exact function:
 *   roster/wo10-interface-artisan-ex1-transcript.md, "contrast.js
 *   implementation (full, for the record)" (lines ~125-157) — Sol-authored
 *   (GPT-5.6 Sol, OpenAI casting), digit-for-digit cross-checked by an
 *   independent Node `require()` in that same record
 *   (contrastRatio('#172554','#ffffff') === 14.694794518800467), and
 *   further pinned by the WO-10 Test Designer (Q0) suite
 *   (roster/wo10-band-record.md line 337 / roster/wo10-test-designer-sonnet
 *   -ex1-report.md), which confirmed the function's one behavioral
 *   deviation from the WCAG-quoted constant (branches sRGB linearization at
 *   0.04045 rather than 0.03928) is unobservable across all 256 possible
 *   8-bit hex channel values. This module is the sole contrast authority
 *   for wo12/c's mechanical acceptance checks (§3.5 of wo12-protocol.md,
 *   "the contrast computation the WO-10 exercise already proved").
 *
 * No changes have been made to the algorithm below versus the WO-10 source.
 */

function contrastRatio(hex1, hex2) {
  const relativeLuminance = (hex) => {
    if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) {
      throw new TypeError('Color must be a six-digit hex string, such as #000000');
    }

    const channels = [1, 3, 5].map((start) =>
      parseInt(hex.slice(start, start + 2), 16) / 255
    );
    const linear = channels.map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4
    );

    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };

  const luminance1 = relativeLuminance(hex1);
  const luminance2 = relativeLuminance(hex2);
  const lighter = Math.max(luminance1, luminance2);
  const darker = Math.min(luminance1, luminance2);

  return (lighter + 0.05) / (darker + 0.05);
}

module.exports = { contrastRatio };
