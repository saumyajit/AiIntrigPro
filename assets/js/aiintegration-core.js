/**
 * AI Integration Core Library
 * SIMPLIFIED VERSION
 */
window.AIIntegrationCore = (function() {
    'use strict';
    
    let settingsCache = null;
    
    /**
     * Load settings from server
     */
    function loadSettings() {
        if (settingsCache) {
            return Promise.resolve(settingsCache);
        }
        
        return fetch('zabbix.php?action=aiintegration.providers')
            .then(response => response.json())
            .then(data => {
                console.log('AI Integration: Settings loaded', data);
                if (data.success) {
                    settingsCache = data;
                    return data;
                }
                throw new Error('Failed to load settings');
            })
            .catch(error => {
                console.error('AI Integration: Failed to load settings', error);
                // Return defaults
                return {
                    providers: [{id: 'github', name: 'GitHub Models'}],
                    default_provider: 'github',
                    quick_actions: {problems: true, items: true, triggers: true, hosts: true}
                };
            });
    }
    
    /**
     * Call AI API
     */
    function callAI(question, context, provider) {
        console.log('AI Integration: Calling AI', {question, context, provider});
        
        return fetch('zabbix.php?action=aiintegration.query', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                question: question,
                context: context || {},
                provider: provider || 'github'
            })
        })
        .then(response => {
            console.log('AI Integration: Response status', response.status);
            return response.text();
        })
        .then(text => {
            console.log('AI Integration: Response text', text.substring(0, 200));
            try {
                const data = JSON.parse(text);
                if (!data.success) {
                    throw new Error(data.error || 'API call failed');
                }
                return data;
            } catch (e) {
                console.error('AI Integration: JSON parse error', e, text);
                throw new Error('Invalid response from server: ' + text.substring(0, 100));
            }
        });
    }
    
    /**
     * Open modal
     */
    function openModal(title, content, actions, options) {
        const overlay = document.createElement('div');
        overlay.className = 'aiintegration-modal-overlay';
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;';
        
        const modal = document.createElement('div');
        modal.className = 'aiintegration-modal';
        modal.style.cssText = 'background: white; border-radius: 8px; width: 90%; max-width: 700px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 10px 40px rgba(0,0,0,0.3);';
        
        // Header
        const header = document.createElement('div');
        header.style.cssText = 'padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; display: flex; justify-content: space-between; align-items: center; border-radius: 8px 8px 0 0;';
        header.innerHTML = `<h3 style="margin: 0;">${escapeHtml(title)}</h3>`;
        
        if (options && options.headerExtra) {
            header.appendChild(options.headerExtra);
        }
        
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = 'background: none; border: none; color: white; font-size: 32px; cursor: pointer; padding: 0; width: 32px; height: 32px; line-height: 1;';
        closeBtn.onclick = () => closeModal();
        header.appendChild(closeBtn);
        
        // Body
        const body = document.createElement('div');
        body.style.cssText = 'padding: 20px; overflow-y: auto; flex: 1;';
        body.appendChild(content);
        
        // Footer
        const footer = document.createElement('div');
        footer.style.cssText = 'padding: 20px; border-top: 1px solid #e5e7eb; display: flex; gap: 10px; justify-content: flex-end;';
        
        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(footer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        function closeModal() {
            overlay.remove();
        }
        
        // Actions
        const modalAPI = {
            close: closeModal,
            setActions: function(actionList) {
                footer.innerHTML = '';
                actionList.forEach(action => {
                    const btn = document.createElement('button');
                    btn.textContent = action.label;
                    btn.className = action.className || 'aiintegration-btn';
                    btn.style.cssText = 'padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;';
                    if (action.className.includes('primary')) {
                        btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                        btn.style.color = 'white';
                    } else {
                        btn.style.background = '#f3f4f6';
                        btn.style.color = '#374151';
                    }
                    btn.onclick = () => action.onClick(closeModal, btn);
                    footer.appendChild(btn);
                });
            }
        };
        
        overlay.onclick = (e) => {
            if (e.target === overlay) closeModal();
        };
        
        return modalAPI;
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    return {
        loadSettings,
        callAI,
        openModal,
        escapeHtml
    };
})();

console.log('AI Integration Core: Loaded');
