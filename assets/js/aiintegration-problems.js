/**
 * AI Integration - Problems Page
 * SIMPLIFIED VERSION
 */
(function() {
    'use strict';
    
    let settings = null;
    let injected = false;
    
    function init() {
        console.log('AI Integration Problems: Starting init');
        
        window.AIIntegrationCore.loadSettings().then(s => {
            settings = s;
            console.log('AI Integration Problems: Settings loaded', settings);
            
            if (!settings.quick_actions || !settings.quick_actions.problems) {
                console.log('AI Integration Problems: Disabled');
                return;
            }
            
            // Inject after delay
            setTimeout(injectButtons, 2000);
        });
    }
    
    function injectButtons() {
        if (injected) return;
        
        const table = document.querySelector('table.list-table');
        if (!table) {
            console.log('AI Integration Problems: Table not found');
            return;
        }
        
        console.log('AI Integration Problems: Injecting buttons');
        
        // Add header
        const thead = table.querySelector('thead tr');
        if (thead && !thead.querySelector('.ai-header')) {
            const th = document.createElement('th');
            th.className = 'ai-header';
            th.textContent = 'IA';
            th.style.width = '50px';
            thead.appendChild(th);
        }
        
        // Add buttons
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            if (row.querySelector('.ai-btn')) return;
            
            const td = document.createElement('td');
            td.style.textAlign = 'center';
            
            const btn = document.createElement('button');
            btn.className = 'ai-btn';
            btn.innerHTML = '✨';
            btn.style.cssText = 'background: linear-gradient(135deg, #a855f7, #6366f1); color: white; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 16px;';
            btn.title = 'Analyze with AI';
            btn.onclick = (e) => {
                e.stopPropagation();
                handleClick(row);
            };
            
            td.appendChild(btn);
            row.appendChild(td);
        });
        
        injected = true;
        console.log('AI Integration Problems: Injected ' + rows.length + ' buttons');
    }
    
    function handleClick(row) {
        console.log('AI Integration Problems: Button clicked');
        
        const cells = row.querySelectorAll('td');
        const problemLink = row.querySelector('a[href*="trigger"]');
        const hostLink = row.querySelector('a[href*="host"]');
        
        const data = {
            problem: problemLink ? problemLink.textContent.trim() : 'Unknown',
            host: hostLink ? hostLink.textContent.trim() : 'Unknown',
            severity: cells[1] ? cells[1].textContent.trim() : 'N/A',
            time: cells[0] ? cells[0].textContent.trim() : 'N/A'
        };
        
        console.log('AI Integration Problems: Extracted data', data);
        showModal(data);
    }
    
    function showModal(data) {
        const content = document.createElement('div');
        
        content.innerHTML = `
            <table style="width: 100%; margin-bottom: 20px; border-collapse: collapse;">
                <tr><td style="padding: 8px; font-weight: bold; width: 120px;">Problem:</td><td style="padding: 8px;">${data.problem}</td></tr>
                <tr><td style="padding: 8px; font-weight: bold;">Host:</td><td style="padding: 8px;">${data.host}</td></tr>
                <tr><td style="padding: 8px; font-weight: bold;">Severity:</td><td style="padding: 8px;">${data.severity}</td></tr>
            </table>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Ask AI:</label>
                <textarea id="ai_question" rows="4" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">Analyze this problem and suggest possible causes:

Problem: ${data.problem}
Host: ${data.host}
Severity: ${data.severity}</textarea>
            </div>
            <div id="ai_response" style="display: none;"></div>
        `;
        
        const providerSelect = document.createElement('select');
        providerSelect.style.cssText = 'background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; padding: 5px 10px; border-radius: 4px;';
        
        if (settings && settings.providers) {
            settings.providers.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.name;
                providerSelect.appendChild(opt);
            });
            providerSelect.value = settings.default_provider || 'github';
        }
        
        const modal = window.AIIntegrationCore.openModal(
            '✨ AI Problem Analysis',
            content,
            [],
            {headerExtra: providerSelect}
        );
        
        modal.setActions([
            {
                label: 'Analyze',
                className: 'aiintegration-btn aiintegration-btn-primary',
                onClick: (close, btn) => {
                    const question = document.getElementById('ai_question').value;
                    const provider = providerSelect.value;
                    
                    btn.disabled = true;
                    btn.textContent = 'Analyzing...';
                    
                    window.AIIntegrationCore.callAI(question, data, provider)
                        .then(result => {
                            const resp = document.getElementById('ai_response');
                            resp.style.display = 'block';
                            resp.style.cssText = 'padding: 15px; background: #f0f7ff; border-radius: 6px; margin-top: 15px; white-space: pre-wrap;';
                            resp.textContent = result.response;
                            btn.disabled = false;
                            btn.textContent = 'Analyze';
                        })
                        .catch(err => {
                            const resp = document.getElementById('ai_response');
                            resp.style.display = 'block';
                            resp.style.cssText = 'padding: 15px; background: #fee; border-radius: 6px; margin-top: 15px; color: red;';
                            resp.textContent = 'Error: ' + err.message;
                            btn.disabled = false;
                            btn.textContent = 'Analyze';
                        });
                }
            },
            {
                label: 'Close',
                className: 'aiintegration-btn aiintegration-btn-secondary',
                onClick: (close) => close()
            }
        ]);
    }
    
    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
