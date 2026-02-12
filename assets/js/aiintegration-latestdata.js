/**
 * AI Integration - Latest Data Page
 * FINAL VERSION
 */
(function() {
    'use strict';
    
    let settings = null;
    let injected = false;
    
    function init() {
        console.log('AI Integration Latest Data: Init');
        
        window.AIIntegrationCore.loadSettings().then(s => {
            settings = s;
            
            if (!settings.quick_actions || !settings.quick_actions.items) {
                console.log('AI Integration Latest Data: Disabled');
                return;
            }
            
            setTimeout(injectButtons, 2000);
        });
    }
    
    function injectButtons() {
        if (injected) return;
        
        // Find the actual data table (not the filter)
        const tables = document.querySelectorAll('table.list-table');
        let dataTable = null;
        
        for (const table of tables) {
            // Skip if it's in the filter section
            if (table.closest('.filter-forms') || table.closest('.filter-container')) {
                continue;
            }
            // Check if it has data rows
            const firstRow = table.querySelector('tbody tr');
            if (firstRow && firstRow.querySelectorAll('td').length > 3) {
                dataTable = table;
                break;
            }
        }
        
        if (!dataTable) {
            console.log('AI Integration Latest Data: Table not found');
            return;
        }
        
        console.log('AI Integration Latest Data: Injecting');
        
        // Add header
        const thead = dataTable.querySelector('thead tr');
        if (thead && !thead.querySelector('.ai-header')) {
            const th = document.createElement('th');
            th.className = 'ai-header';
            th.textContent = 'IA';
            th.style.cssText = 'width: 50px; text-align: center;';
            thead.appendChild(th);
        }
        
        // Add buttons
        const rows = dataTable.querySelectorAll('tbody tr');
        rows.forEach(row => {
            if (row.querySelector('.ai-btn')) return;
            
            const td = document.createElement('td');
            td.className = 'ai-td';
            td.style.cssText = 'text-align: center; vertical-align: middle;';
            
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ai-btn';
            btn.innerHTML = '✨';
            btn.style.cssText = 'background: linear-gradient(135deg, #10b981, #3b82f6); color: white; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 16px;';
            btn.title = 'Analyze with AI';
            
            btn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                handleClick(row);
                return false;
            };
            
            td.onclick = function(e) {
                e.stopPropagation();
            };
            
            td.appendChild(btn);
            row.appendChild(td);
        });
        
        injected = true;
        console.log('AI Integration Latest Data: Done');
    }
    
    function handleClick(row) {
        console.log('AI Integration Latest Data: Clicked');
        
        const hostLink = row.querySelector('a[href*="hostid"]');
        const nameLink = row.querySelector('a[href*="itemid"]') || row.querySelector('td:nth-child(2) a');
        
        const cells = Array.from(row.querySelectorAll('td'));
        
        const data = {
            host: hostLink ? hostLink.textContent.trim() : 'N/A',
            name: nameLink ? nameLink.textContent.trim() : (cells[1] ? cells[1].textContent.trim() : 'N/A'),
            lastCheck: cells[2] ? cells[2].textContent.trim() : 'N/A',
            lastValue: cells[3] ? cells[3].textContent.trim() : 'N/A',
            change: cells[4] ? cells[4].textContent.trim() : 'N/A'
        };
        
        console.log('AI Integration Latest Data: Extracted:', data);
        showModal(data);
    }
    
    function showModal(data) {
        const content = document.createElement('div');
        
        content.innerHTML = `
            <table style="width: 100%; margin-bottom: 20px; border-collapse: collapse;">
                <tr><td style="padding: 8px; font-weight: bold; width: 120px;">Host:</td><td style="padding: 8px;">${escapeHtml(data.host)}</td></tr>
                <tr><td style="padding: 8px; font-weight: bold;">Item:</td><td style="padding: 8px;">${escapeHtml(data.name)}</td></tr>
                <tr><td style="padding: 8px; font-weight: bold;">Last Value:</td><td style="padding: 8px;">${escapeHtml(data.lastValue)}</td></tr>
                <tr><td style="padding: 8px; font-weight: bold;">Change:</td><td style="padding: 8px;">${escapeHtml(data.change)}</td></tr>
            </table>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Ask AI:</label>
                <textarea id="ai_question" rows="4" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 13px;">Analyze this monitoring item:

Item: ${data.name}
Host: ${data.host}
Current Value: ${data.lastValue}
Change: ${data.change}

Is this value normal? Are there any anomalies or concerns?</textarea>
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
            '📊 AI Item Analysis',
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
                            resp.style.cssText = 'padding: 15px; background: #f0f7ff; border-radius: 6px; margin-top: 15px; white-space: pre-wrap; font-family: system-ui; line-height: 1.6;';
                            resp.textContent = result.response;
                            btn.disabled = false;
                            btn.textContent = 'Analyze Again';
                        })
                        .catch(err => {
                            const resp = document.getElementById('ai_response');
                            resp.style.display = 'block';
                            resp.style.cssText = 'padding: 15px; background: #fee; border: 1px solid #fcc; border-radius: 6px; margin-top: 15px; color: #c00;';
                            resp.textContent = 'Error: ' + err.message;
                            btn.disabled = false;
                            btn.textContent = 'Retry';
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
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
