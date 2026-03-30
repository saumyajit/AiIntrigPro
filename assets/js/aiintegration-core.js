/**
 * AI Integration Core Library
 */
window.AIIntegrationCore = (function() {
    'use strict';

    let settingsCache = null;

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
                return {
                    providers: [{ name: 'github', model: 'gpt-4o-mini' }],
                    default_provider: 'github',
                    quick_actions: { problems: true, items: true, triggers: true, hosts: true }
                };
            });
    }

    function callAI(question, context, provider) {
        console.log('AI Integration: Calling AI', { question, context, provider });

        return fetch('zabbix.php?action=aiintegration.query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: question,
                context:  context  || {},
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

    function openModal(title, content, actions, options) {
        const overlay = document.createElement('div');
        overlay.className = 'aiintegration-modal-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.className = 'aiintegration-modal';
        modal.style.cssText = 'background:white;border-radius:8px;width:90%;max-width:700px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,0.3);';

        const header = document.createElement('div');
        header.style.cssText = 'padding:16px 20px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;display:flex;align-items:center;gap:10px;border-radius:8px 8px 0 0;';

        const titleEl = document.createElement('h3');
        titleEl.style.cssText = 'margin:0;color:#ffffff;font-size:16px;font-family:"Trebuchet MS";font-weight:600;white-space:nowrap;';
        titleEl.textContent = title;
        header.appendChild(titleEl);

        // Spacer pushes everything after it to the right
        const spacer = document.createElement('div');
        spacer.style.cssText = 'flex:1;';
        header.appendChild(spacer);

        if (options && options.headerExtra) {
            options.headerExtra.style.flexShrink = '0';
            header.appendChild(options.headerExtra);
        }

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = 'background:rgba(255,255,255,0.15);border:none;color:white;font-size:24px;cursor:pointer;padding:0;width:32px;height:32px;line-height:1;border-radius:4px;flex-shrink:0;transition:background 0.2s;';
        closeBtn.onmouseenter = () => closeBtn.style.background = 'rgba(255,255,255,0.3)';
        closeBtn.onmouseleave = () => closeBtn.style.background = 'rgba(255,255,255,0.15)';
        closeBtn.onclick = () => closeModal();
        header.appendChild(closeBtn);

        const body = document.createElement('div');
        body.style.cssText = 'padding:20px;overflow-y:auto;flex:1;';
        body.appendChild(content);

        const footer = document.createElement('div');
        footer.style.cssText = 'padding:20px;border-top:1px solid #e5e7eb;display:flex;gap:10px;justify-content:flex-end;';

        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(footer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        function closeModal() { overlay.remove(); }

        const modalAPI = {
            close: closeModal,
            setActions: function(actionList) {
                footer.innerHTML = '';
                actionList.forEach(action => {
                    const btn = document.createElement('button');
                    btn.textContent = action.label;
                    btn.className = action.className || 'aiintegration-btn';
                    btn.style.cssText = 'border:none;border-radius:6px;cursor:pointer;font-size:14px;';
                    if (action.className && action.className.includes('primary')) {
                        btn.style.background = 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)';
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

        overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };

        return modalAPI;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Render AI response text with lightweight Markdown formatting.
     * No external libraries required.
     * Handles: fenced code blocks, inline code, headers (#/##/###),
     *          bold (**), italic (*), ordered/unordered lists, line breaks.
     *
     * @param  {string} text  Raw AI response
     * @return {string}       Safe HTML string
     */
    function renderText(text) {
        if (!text) return '';

        // ── 1. Split out fenced code blocks so inner content is never mangled ──
        var segments = [];
        var codeBlockRe = /```(\w*)\n?([\s\S]*?)```/g;
        var last = 0, m;

        while ((m = codeBlockRe.exec(text)) !== null) {
            if (m.index > last) {
                segments.push({ type: 'text', raw: text.slice(last, m.index) });
            }
            segments.push({ type: 'code', lang: m[1] || 'text', raw: m[2] });
            last = m.index + m[0].length;
        }
        if (last < text.length) {
            segments.push({ type: 'text', raw: text.slice(last) });
        }
        if (segments.length === 0) {
            segments.push({ type: 'text', raw: text });
        }

        // ── 2. Render each segment ────────────────────────────────────────────
        var html = '';

        segments.forEach(function(seg) {
            if (seg.type === 'code') {
                html +=
                    '<pre style="background:#1e293b;color:#e2e8f0;padding:12px 16px;' +
                    'border-radius:6px;overflow-x:auto;margin:8px 0;font-size:13px;line-height:1.5;">' +
                    '<code>' + escapeHtml(seg.raw.trim()) + '</code></pre>';
                return;
            }

            var t = seg.raw;

            // Escape HTML entities in prose
            t = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            // Inline code
            t = t.replace(/`([^`\n]+)`/g,
                '<code style="background:rgba(0,0,0,0.07);padding:2px 5px;border-radius:3px;font-family:monospace;font-size:0.9em;">$1</code>');

            // ATX headers
            t = t.replace(/^### (.+)$/gm, '<h4 style="margin:10px 0 4px;font-size:14px;font-weight:700;color:#374151;">$1</h4>');
            t = t.replace(/^## (.+)$/gm,  '<h3 style="margin:12px 0 6px;font-size:15px;font-weight:700;color:#1f2937;">$1</h3>');
            t = t.replace(/^# (.+)$/gm,   '<h2 style="margin:14px 0 6px;font-size:16px;font-weight:700;color:#111827;">$1</h2>');

            // Bold + italic
            t = t.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
            t = t.replace(/\*\*(.+?)\*\*/g,      '<strong>$1</strong>');
            t = t.replace(/\*([^*\n]+)\*/g,       '<em>$1</em>');

            // Unordered lists (lines starting with "- " or "* ")
            t = t.replace(/((?:^[ \t]*[-*] [^\n]+(?:\n|$))+)/gm, function(block) {
                var items = block.split('\n')
                    .filter(function(l) { return l.trim(); })
                    .map(function(l)  { return '<li style="margin:3px 0;">' + l.replace(/^[ \t]*[-*] /, '') + '</li>'; })
                    .join('');
                return '<ul style="margin:6px 0;padding-left:20px;">' + items + '</ul>';
            });

            // Ordered lists
            t = t.replace(/((?:^[ \t]*\d+\. [^\n]+(?:\n|$))+)/gm, function(block) {
                var items = block.split('\n')
                    .filter(function(l) { return l.trim(); })
                    .map(function(l)  { return '<li style="margin:3px 0;">' + l.replace(/^[ \t]*\d+\. /, '') + '</li>'; })
                    .join('');
                return '<ol style="margin:6px 0;padding-left:20px;">' + items + '</ol>';
            });

            // Paragraph breaks and single line breaks
            t = t.replace(/\n{2,}/g, '</p><p style="margin:6px 0;">');
            t = t.replace(/\n/g, '<br>');

            html += '<p style="margin:4px 0;">' + t + '</p>';
        });

        return html;
    }

    return {
        loadSettings,
        callAI,
        openModal,
        escapeHtml,
        renderText
    };
})();

console.log('AI Integration Core: Loaded');
