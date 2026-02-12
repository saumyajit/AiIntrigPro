/**
 * AI Integration Initialization
 * Sets up MutationObserver to detect form dialogs and inject AI features
 */
(function() {
    'use strict';
    
    function waitForCore(callback) {
        if (typeof window.AIIntegrationCore !== 'undefined') {
            callback();
        } else {
            setTimeout(() => waitForCore(callback), 100);
        }
    }
    
    const INJECTION_POINTS = [
        {
            name: 'trigger-modal',
            selector: '.overlay-dialogue',
            validate: (node) => {
                const header = node.querySelector('.overlay-dialogue-header');
                const text = header ? header.textContent.toLowerCase() : '';
                return text.includes('trigger') || !!node.querySelector('form[name="triggersForm"]');
            },
            handler: 'triggers'
        },
        {
            name: 'item-modal',
            selector: '.overlay-dialogue',
            validate: (node) => {
                const header = node.querySelector('.overlay-dialogue-header');
                const text = header ? header.textContent.toLowerCase() : '';
                return (text.includes('item') && !text.includes('trigger')) || !!node.querySelector('form[name="itemForm"]');
            },
            handler: 'items'
        },
        {
            name: 'host-modal',
            selector: '.overlay-dialogue',
            validate: (node) => {
                const header = node.querySelector('.overlay-dialogue-header');
                const text = header ? header.textContent.toLowerCase() : '';
                return (text.includes('host') && !text.includes('item') && !text.includes('trigger'))
                    || !!node.querySelector('form[name="hostForm"]')
                    || !!node.querySelector('#host');
            },
            handler: 'hosts'
        }
    ];
    
    const handlers = {};
    
    function registerHandler(name, handler) {
        handlers[name] = handler;
    }
    
    function handleMutations(mutations) {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (!node || node.nodeType !== 1) {
                    return;
                }
                
                INJECTION_POINTS.forEach((point) => {
                    let target = null;
                    
                    if (node.matches && node.matches(point.selector)) {
                        target = node;
                    } else if (node.querySelector) {
                        target = node.querySelector(point.selector);
                    }
                    
                    if (!target) {
                        return;
                    }
                    
                    let attempts = 0;
                    const tryValidate = () => {
                        if (attempts > 15) {
                            return;
                        }
                        
                        attempts += 1;
                        
                        if (!point.validate(target)) {
                            setTimeout(tryValidate, 120);
                            return;
                        }
                        
                        const handler = handlers[point.handler];
                        if (typeof handler === 'function') {
                            handler(target);
                        }
                    };
                    
                    tryValidate();
                });
            });
        });
    }
    
    function initObserver() {
        const observer = new MutationObserver(handleMutations);
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    function init() {
        waitForCore(() => {
            window.AIIntegrationInit = {
                registerHandler,
                injectionPoints: INJECTION_POINTS
            };
            
            initObserver();
        });
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
