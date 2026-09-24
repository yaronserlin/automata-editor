/**
 * Accessibility menu: text size, high contrast and link underlining.
 * Preferences persist in localStorage and apply to the whole document.
 * The editor aims to conform to WCAG 2.0 AA (IS 5568); this menu is an added
 * convenience, not a substitute for an accessible app.
 *
 * Usage: `new AccessibilityMenu(document).mount()`.
 * - If the page has a `#a11y-button` (index.html puts it in the header
 *   toolbar), that button opens the panel, so nothing floats over the canvas
 *   or the zoom / undo controls.
 * - Otherwise (legal.html) a small floating button is added bottom-right.
 */

export const STORAGE_KEY = 'automata-editor:a11y';
export const FONT_STEPS = [100, 110, 125, 150];
export const DEFAULT_PREFS = Object.freeze({ fontStep: 0, highContrast: false, underlineLinks: false });

/**
 * Reads saved preferences, falling back to defaults on missing or bad data.
 * @param {Pick<Storage, 'getItem'> | null | undefined} storage
 * @returns {{fontStep: number, highContrast: boolean, underlineLinks: boolean}}
 */
export function loadPrefs(storage) {
    try {
        const saved = JSON.parse(storage?.getItem(STORAGE_KEY) || '{}');
        const prefs = { ...DEFAULT_PREFS, ...(saved && typeof saved === 'object' ? saved : {}) };
        const step = Number(prefs.fontStep);
        prefs.fontStep = Number.isInteger(step) ? Math.min(Math.max(step, 0), FONT_STEPS.length - 1) : 0;
        prefs.highContrast = prefs.highContrast === true;
        prefs.underlineLinks = prefs.underlineLinks === true;
        return prefs;
    } catch {
        return { ...DEFAULT_PREFS };
    }
}

/**
 * Applies preferences to the root element.
 * @param {{style: CSSStyleDeclaration | Record<string,string>, classList: DOMTokenList}} root
 * @param {{fontStep: number, highContrast: boolean, underlineLinks: boolean}} prefs
 */
export function applyPrefs(root, prefs) {
    root.style.fontSize = `${FONT_STEPS[prefs.fontStep] ?? 100}%`;
    root.classList.toggle('a11y-high-contrast', prefs.highContrast);
    root.classList.toggle('a11y-underline-links', prefs.underlineLinks);
}

/**
 * Where to put the panel so it stays on screen under (or above) its button.
 * @param {{top: number, bottom: number, right: number}} buttonRect
 * @param {{width: number, height: number}} panelSize
 * @param {{width: number, height: number}} viewport
 * @returns {{top: number, left: number}}
 */
export function panelPosition(buttonRect, panelSize, viewport) {
    const gap = 8;
    const margin = 8;
    let left = buttonRect.right - panelSize.width;
    left = Math.min(Math.max(left, margin), viewport.width - panelSize.width - margin);
    let top = buttonRect.bottom + gap;
    if (top + panelSize.height > viewport.height - margin) {
        top = Math.max(margin, buttonRect.top - gap - panelSize.height);
    }
    return { top, left };
}

export class AccessibilityMenu {
    /** @param {Document} doc */
    constructor(doc) {
        this.doc = doc;
        this.win = doc.defaultView;
        this.storage = null;
        try {
            this.storage = this.win.localStorage;
        } catch {
            this.storage = null;
        }
        this.prefs = loadPrefs(this.storage);
        this.panel = null;
        this.button = null;
    }

    mount() {
        applyPrefs(this.doc.documentElement, this.prefs);
        this.button = this.doc.getElementById('a11y-button') || this.createFloatingButton();
        this.button.setAttribute('aria-expanded', 'false');
        this.button.setAttribute('aria-controls', 'a11y-panel');
        this.panel = this.createPanel();
        this.doc.body.appendChild(this.panel);
        this.button.addEventListener('click', () => this.toggle());
        this.doc.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.close();
                this.button.focus();
            }
        });
        this.doc.addEventListener('pointerdown', (e) => {
            if (this.isOpen() && !this.panel.contains(e.target) && !this.button.contains(e.target)) this.close();
        });
        this.win.addEventListener('resize', () => { if (this.isOpen()) this.position(); });
        return this;
    }

    createFloatingButton() {
        const btn = this.doc.createElement('button');
        btn.type = 'button';
        btn.className = 'a11y-fab';
        btn.setAttribute('aria-label', 'Accessibility options');
        btn.title = 'Accessibility options';
        btn.innerHTML = ACCESSIBILITY_ICON;
        this.doc.body.appendChild(btn);
        return btn;
    }

    createPanel() {
        const panel = this.doc.createElement('div');
        panel.id = 'a11y-panel';
        panel.className = 'a11y-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Accessibility options');
        panel.hidden = true;
        panel.innerHTML = `
            <h2 class="a11y-panel-title">Accessibility</h2>
            <div class="a11y-row-label" id="a11y-size-label">Text size <span data-a11y="size-value"></span></div>
            <div class="a11y-size" role="group" aria-labelledby="a11y-size-label">
                <button type="button" data-a11y="smaller" aria-label="Decrease text size">A-</button>
                <button type="button" data-a11y="larger" aria-label="Increase text size">A+</button>
            </div>
            <label class="a11y-switch"><input type="checkbox" data-a11y="contrast"> High contrast</label>
            <label class="a11y-switch"><input type="checkbox" data-a11y="underline"> Underline links</label>
            <button type="button" class="a11y-reset" data-a11y="reset">Reset</button>`;
        // Keys pressed inside the panel belong to the panel, not the editor's
        // shortcuts (N = new state, Delete, ...). Escape still closes it.
        panel.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') e.stopPropagation();
        });
        const q = (name) => panel.querySelector(`[data-a11y="${name}"]`);
        q('smaller').addEventListener('click', () => this.update({ fontStep: Math.max(0, this.prefs.fontStep - 1) }));
        q('larger').addEventListener('click', () => this.update({ fontStep: Math.min(FONT_STEPS.length - 1, this.prefs.fontStep + 1) }));
        q('contrast').addEventListener('change', (e) => this.update({ highContrast: e.target.checked }));
        q('underline').addEventListener('change', (e) => this.update({ underlineLinks: e.target.checked }));
        q('reset').addEventListener('click', () => this.update({ ...DEFAULT_PREFS }));
        this.syncControls(panel);
        return panel;
    }

    syncControls(panel = this.panel) {
        const q = (name) => panel.querySelector(`[data-a11y="${name}"]`);
        q('size-value').textContent = `(${FONT_STEPS[this.prefs.fontStep]}%)`;
        q('smaller').disabled = this.prefs.fontStep === 0;
        q('larger').disabled = this.prefs.fontStep === FONT_STEPS.length - 1;
        q('contrast').checked = this.prefs.highContrast;
        q('underline').checked = this.prefs.underlineLinks;
    }

    update(patch) {
        this.prefs = { ...this.prefs, ...patch };
        applyPrefs(this.doc.documentElement, this.prefs);
        try {
            this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.prefs));
        } catch {
            // storage unavailable - preferences apply for this session only
        }
        this.syncControls();
        if (this.isOpen()) this.position();
        // Text size changes the layout; let the canvas re-measure.
        this.win.dispatchEvent(new this.win.Event('resize'));
    }

    isOpen() {
        return this.panel && !this.panel.hidden;
    }

    toggle() {
        if (this.isOpen()) this.close();
        else this.open();
    }

    open() {
        this.panel.hidden = false;
        this.button.setAttribute('aria-expanded', 'true');
        this.position();
        this.panel.querySelector('button:not([disabled]), input')?.focus();
    }

    close() {
        this.panel.hidden = true;
        this.button.setAttribute('aria-expanded', 'false');
    }

    position() {
        const { top, left } = panelPosition(
            this.button.getBoundingClientRect(),
            { width: this.panel.offsetWidth, height: this.panel.offsetHeight },
            { width: this.win.innerWidth, height: this.win.innerHeight }
        );
        this.panel.style.top = `${top}px`;
        this.panel.style.left = `${left}px`;
    }
}

export const ACCESSIBILITY_ICON = '<svg class="a11y-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="4" r="1.6"/><path d="M5 8.5l7 1.5 7-1.5M12 10v4.5M12 14.5l-3 6M12 14.5l3 6"/></svg>';
