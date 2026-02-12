/**
 * AI Integration Core Library
 * Provides shared utilities for modal management, API calls, and settings
 */
window.AIIntegrationCore = (function() {
    'use strict';
    
    const CONFIG = {
        apiEndpoint: 'zabbix.php?action=aiintegration.query',
        providersEndpoint: 'zabbix.php?action=aiintegration.providers',
        modalOverlayClass: 'aiintegration-modal-overlay'
    };
    
    let settingsCache = null;
    let settingsPromise = null;
    
    /**
     * Get current Zabbix theme
     */
    function getCurrentTheme() {
        const body = document.body;
        if (body && body.classList.contains('theme-dark')) {
            return 'dark';
        }
        
        const html = document.documentElement;
        if (html && (html.getAttribute('data-theme') === 'dark-theme' || html.getAttribute('theme') === 'dark-theme')) {
            return 'dark';
        }
        
        return 'light';
    }
    
    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }
    
    /**
     * Render text with newlines converted to <br>
     */
    function renderText(text) {
        return escapeHtml(text).replace(/\n/g, '<br>');
    }
    
    /**
     * Try to parse JSON from various formats
     */
    function tryParseJSON(text) {
        if (!text) return null;
        
        try {
            return JSON.parse(text);
        } catch (e) {
            // Try removing markdown code blocks
            const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
            try {
                return JSON.parse(cleaned);
            } catch (e) {
                // Try extracting JSON object
                const match = cleaned.match(/\{[\s\S]*\}/);
                if (match) {
                    try {
                        return JSON.parse(match[0]);
                    } catch (e) {
                        return null;
                    }
                }
                return null;
            }
        }
    }
    
    /**
     * Load settings from backend (cached)
     */
    function loadSettings(force) {
        if (settingsCache && !force) {
            return Promise.resolve(settingsCache);
        }
        
        if (settingsPromise) {
            return settingsPromise;
        }
        
        settingsPromise = fetch(CONFIG.providersEndpoint, { 
            credentials: 'same-origin' 
        })
        .then(response => response.json())
        .then(data => {
            if (!data || !data.success) {
                throw new Error(data && data.error ? data.error : 'Failed to load settings');
            }
            
            settingsCache = {
                providers: Array.isArray(data.providers) ? data.providers : [],
                default_provider: data.default_provider || 'openai',
                quick_actions: data.quick_actions || {
                    problems: true,
                    triggers: true,
                    items: true,
                    hosts: true
                },
                is_super_admin: data.is_super_admin || false
            };
            
            return settingsCache;
        })
        .catch(err => {
            console.error('AI Integration: Failed to load settings', err);
            // Return defaults on error
            settingsCache = {
                providers: [],
                default_provider: 'openai',
                quick_actions: {
                    problems: true,
                    triggers: true,
                    items: true,
                    hosts: true
                },
                is_super_admin: false
            };
            return settingsCache;
        })
        .finally(() => {
            settingsPromise = null;
        });
        
        return settingsPromise;
    }
    
    /**
     * Call AI with question and context
     */
    function callAI(question, context, provider) {
        const payload = {
            question: question,
            context: context || {}
        };
        
        if (provider) {
            payload.provider = provider;
        }
        
        return fetch(CONFIG.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            credentials: 'same-origin'
        })
        .then(response => response.json())
        .then(data => {
            if (data && data.success) {
                return data;
            }
            throw new Error((data && data.error) || 'AI request failed');
        });
    }
    
    /**
     * Open modal dialog
     */
    function openModal(title, content, actions, options) {
        options = options || {};
        
        const overlay = document.createElement('div');
        overlay.className = CONFIG.modalOverlayClass;
        
        if (getCurrentTheme() === 'dark') {
            overlay.setAttribute('theme', 'dark-theme');
        }
        
        const modal = document.createElement('div');
        modal.className = 'aiintegration-modal';
        
        // Header
        const header = document.createElement('div');
        header.className = 'aiintegration-modal-header';
        
        const titleEl = document.createElement('div');
        titleEl.className = 'aiintegration-modal-title';
        titleEl.textContent = title;
        header.appendChild(titleEl);
        
        // Header extras (like provider selector)
        if (options.headerExtra) {
            const extraWrapper = document.createElement('div');
            extraWrapper.className = 'aiintegration-modal-header-extra';
            if (options.headerExtra instanceof Node) {
                extraWrapper.appendChild(options.headerExtra);
            }
            header.appendChild(extraWrapper);
        }
        
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'aiintegration-modal-close';
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.innerHTML = '×';
        header.appendChild(closeBtn);
        
        // Body
        const body = document.createElement('div');
        body.className = 'aiintegration-modal-body';
        if (typeof content === 'string') {
            body.innerHTML = content;
        } else if (content instanceof Node) {
            body.appendChild(content);
        }
        
        // Footer
        const footer = document.createElement('div');
        footer.className = 'aiintegration-modal-footer';
        
        function close() {
            overlay.remove();
        }
        
        closeBtn.addEventListener('click', close);
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                close();
            }
        });
        
        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(footer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        setActions(footer, actions || [], close);
        
        return {
            overlay,
            body,
            footer,
            close,
            setContent: (newContent) => {
                body.innerHTML = '';
                if (typeof newContent === 'string') {
                    body.innerHTML = newContent;
                } else if (newContent instanceof Node) {
                    body.appendChild(newContent);
                }
            },
            setActions: (newActions) => setActions(footer, newActions || [], close)
        };
    }
    
    /**
     * Set modal footer actions
     */
    function setActions(footer, actions, close) {
        footer.innerHTML = '';
        
        const credits = document.createElement('span');
        credits.className = 'aiintegration-modal-credits';
        credits.textContent = 'Developed by MonZphere';
        footer.appendChild(credits);
        
        const actionsWrap = document.createElement('div');
        actionsWrap.className = 'aiintegration-modal-footer-actions';
        
        actions.forEach((action) => {
            const btn = document.createElement('button');
            btn.type = action.type || 'button';
            btn.textContent = action.label;
            btn.className = action.className || 'aiintegration-btn aiintegration-btn-secondary';
            btn.addEventListener('click', () => {
                if (action.onClick) {
                    action.onClick(close, btn);
                }
            });
            actionsWrap.appendChild(btn);
        });
        
        footer.appendChild(actionsWrap);
    }
    
    // Public API
    return {
        CONFIG,
        getCurrentTheme,
        escapeHtml,
        renderText,
        tryParseJSON,
        loadSettings,
        callAI,
        openModal
    };
})();
