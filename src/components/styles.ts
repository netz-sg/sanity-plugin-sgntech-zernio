const STYLE_ID = 'sgntech-zernio-styles'

/**
 * The one stylesheet the tool injects.
 *
 * Everything here is what `@sanity/ui` props cannot express — hover, focus,
 * transitions, gradients — and it is written against the Studio's own CSS
 * variables, so it follows the workspace theme instead of fighting it.
 */
const CSS = `
:where(
  .zn-shell,
  .zn-card,
  .zn-nav,
  .zn-chip,
  .zn-seg,
  .zn-status,
  .zn-event,
  .zn-label,
  .zn-brand,
  .zn-thumb,
  .zn-daycell
) {
  --zn-brand: #ff5500;
  --zn-radius: 12px;
  --zn-line: var(--card-border-color, rgba(127, 127, 127, 0.25));
  --zn-muted: var(--card-muted-fg-color, rgba(127, 127, 127, 0.9));
}

.zn-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--zn-muted);
  margin: 0;
}

.zn-card {
  background: var(--card-bg-color);
  border: 1px solid var(--zn-line);
  border-radius: var(--zn-radius);
  transition: border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
}

.zn-card--hover:hover {
  border-color: color-mix(in srgb, var(--zn-brand) 45%, var(--zn-line));
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
  transform: translateY(-1px);
}

.zn-card--flush {
  background: color-mix(in srgb, var(--card-fg-color, #888) 4%, transparent);
  border-style: dashed;
}

.zn-nav {
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: 999px;
  border: 1px solid var(--zn-line);
  background: color-mix(in srgb, var(--card-fg-color, #888) 5%, transparent);
  overflow-x: auto;
  scrollbar-width: none;
}

.zn-nav::-webkit-scrollbar {
  display: none;
}

.zn-nav button {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--zn-muted);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  padding: 7px 14px;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  transition: background 120ms ease, color 120ms ease;
}

.zn-nav button:hover {
  color: var(--card-fg-color);
  background: color-mix(in srgb, var(--card-fg-color, #888) 8%, transparent);
}

.zn-nav button[aria-selected='true'] {
  background: var(--card-bg-color);
  color: var(--card-fg-color);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.16);
}

.zn-nav button[aria-selected='true'] .zn-nav-dot {
  background: var(--zn-brand);
}

.zn-nav-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: transparent;
}

.zn-nav-count {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--card-fg-color, #888) 12%, transparent);
}

.zn-brand {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: #fff;
  background: linear-gradient(135deg, #ff7a2f, var(--zn-brand));
  box-shadow: 0 2px 8px rgba(255, 85, 0, 0.35);
  flex: none;
}

.zn-chip {
  appearance: none;
  font: inherit;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--zn-line);
  background: transparent;
  color: var(--card-fg-color);
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
}

.zn-chip:hover {
  border-color: color-mix(in srgb, var(--zn-brand) 40%, var(--zn-line));
}

.zn-chip[aria-pressed='true'] {
  border-color: var(--zn-brand);
  background: color-mix(in srgb, var(--zn-brand) 12%, transparent);
}

.zn-seg {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: 10px;
  border: 1px solid var(--zn-line);
  background: color-mix(in srgb, var(--card-fg-color, #888) 5%, transparent);
}

.zn-seg button {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--zn-muted);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  padding: 5px 12px;
  border-radius: 7px;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}

.zn-seg button:hover {
  color: var(--card-fg-color);
}

.zn-seg button[aria-pressed='true'] {
  background: var(--card-bg-color);
  color: var(--card-fg-color);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
}

.zn-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  padding: 3px 9px 3px 7px;
  border-radius: 999px;
  border: 1px solid var(--zn-line);
  color: var(--card-fg-color);
  white-space: nowrap;
}

.zn-status i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.zn-status[data-tone='draft'] { color: var(--zn-muted); }
.zn-status[data-tone='ready'],
.zn-status[data-tone='scheduled'] { color: #3b82f6; border-color: rgba(59, 130, 246, 0.4); }
.zn-status[data-tone='publishing'],
.zn-status[data-tone='partial'] { color: #d97706; border-color: rgba(217, 119, 6, 0.4); }
.zn-status[data-tone='published'] { color: #16a34a; border-color: rgba(22, 163, 74, 0.4); }
.zn-status[data-tone='failed'] { color: #dc2626; border-color: rgba(220, 38, 38, 0.45); }

.zn-thumb {
  border-radius: 10px;
  overflow: hidden;
  background: color-mix(in srgb, var(--card-fg-color, #888) 8%, transparent);
  flex: none;
  display: grid;
  place-items: center;
}

.zn-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.zn-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  cursor: pointer;
}

.zn-daycell {
  transition: background 120ms ease, border-color 120ms ease;
}

.zn-daycell:hover {
  border-color: color-mix(in srgb, var(--zn-brand) 35%, var(--zn-line));
}

.zn-daycell .zn-add {
  opacity: 0;
  transition: opacity 120ms ease;
}

.zn-daycell:hover .zn-add {
  opacity: 1;
}

.zn-event {
  appearance: none;
  font: inherit;
  color: inherit;
  text-align: left;
  width: 100%;
  border: 0;
  border-radius: 8px;
  padding: 6px 8px;
  cursor: pointer;
  border-left: 3px solid var(--zn-brand);
  background: color-mix(in srgb, var(--card-fg-color, #888) 7%, transparent);
  transition: background 120ms ease;
}

.zn-event:hover {
  background: color-mix(in srgb, var(--zn-brand) 14%, transparent);
}

.zn-event--remote {
  border-left-style: dashed;
  border-left-color: var(--zn-muted);
  opacity: 0.75;
}
`

/**
 * Adds the tool's stylesheet to the document, once per page.
 *
 * @public
 */
export function ensureZernioStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return

  const element = document.createElement('style')
  element.id = STYLE_ID
  element.textContent = CSS
  document.head.appendChild(element)
}
