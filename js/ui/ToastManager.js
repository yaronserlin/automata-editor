/**
 * Small, non-blocking notifications ("Saved", "Loaded", load errors) shown at
 * the bottom of the screen. Replaces the browser's blocking alert() popups.
 * Toasts are announced to screen readers through their own live region.
 */
export class ToastManager {
    static DEFAULT_DURATION_MS = 3000;
    static ERROR_DURATION_MS = 6000;

    /**
     * @param {HTMLElement} containerElement - An empty element to hold the toasts.
     */
    constructor(containerElement) {
        this.containerElement = containerElement;
        this.containerElement.setAttribute('role', 'status');
        this.containerElement.setAttribute('aria-live', 'polite');
    }

    /**
     * @param {string} message - Plain text; it is never parsed as HTML.
     * @param {{type?: 'success'|'error'|'info', duration?: number, action?: {label: string, onClick: () => void}}} [options]
     * @returns {() => void} A function that dismisses this toast early.
     */
    show(message, options = {}) {
        const type = options.type ?? 'info';
        const duration = options.duration ?? (type === 'error' ? ToastManager.ERROR_DURATION_MS : ToastManager.DEFAULT_DURATION_MS);

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        if (type === 'error') toast.setAttribute('role', 'alert');

        const icon = document.createElement('span');
        icon.className = 'toast-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = type === 'success' ? '✓' : type === 'error' ? '!' : 'i';
        toast.appendChild(icon);

        const text = document.createElement('span');
        text.className = 'toast-message';
        text.textContent = message;
        toast.appendChild(text);

        let timeoutId = null;
        const dismiss = () => {
            window.clearTimeout(timeoutId);
            toast.classList.add('toast-leaving');
            window.setTimeout(() => toast.remove(), 200);
        };

        if (options.action) {
            const actionButton = document.createElement('button');
            actionButton.type = 'button';
            actionButton.className = 'toast-action';
            actionButton.textContent = options.action.label;
            actionButton.addEventListener('click', () => {
                options.action.onClick();
                dismiss();
            });
            toast.appendChild(actionButton);
        }

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'toast-close';
        closeButton.setAttribute('aria-label', 'Dismiss notification');
        closeButton.textContent = '×';
        closeButton.addEventListener('click', dismiss);
        toast.appendChild(closeButton);

        this.containerElement.appendChild(toast);
        while (this.containerElement.children.length > 3) this.containerElement.firstElementChild.remove();

        timeoutId = window.setTimeout(dismiss, duration);
        toast.addEventListener('mouseenter', () => window.clearTimeout(timeoutId));
        toast.addEventListener('mouseleave', () => {
            timeoutId = window.setTimeout(dismiss, duration);
        });
        return dismiss;
    }
}
