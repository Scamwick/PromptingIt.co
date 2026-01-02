/**
 * Global HTML Sanitization Utility
 * Enforces XSS-safe rendering everywhere
 */
function setSafeHTML(element, dirtyHTML) {
    if (!element) return;
    element.innerHTML = DOMPurify.sanitize(dirtyHTML, {
        USE_PROFILES: { html: true },
        ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'data-*'],
    });
}

/**
 * Optional helper if you already assign innerHTML directly
 */
function sanitizeHTML(dirtyHTML) {
    return DOMPurify.sanitize(dirtyHTML, {
        USE_PROFILES: { html: true }
    });
}
