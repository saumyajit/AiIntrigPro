/**
 * AI Integration - Problems Page
 * FINAL FIXED VERSION
 */
(function() {
    'use strict';
    
    let settings = null;
    let injected = false;
    
    function init() {
        console.log('AI Integration Problems: Init');
        
        window.AIIntegrationCore.loadSettings().then(s => {
            settings = s;
            
            if (!settings.quick_actions || !settings.quick_actions.problems) {
                console.log('AI Integration Problems: Disabled');
                return;
            }
            
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
        
        console.log('AI Integration Problems: Injecting');
        
        // Add header
        const thead = table.querySelector('thead tr');
        if (thead && !thead.querySelector('.ai-header')) {
            const th = document.createElement('th');
            th.className = 'ai-header';
            th.textContent = 'IA';
            th.style.cssText = 'width: 50px; text-align: center;';
            thead.appendChild(th);
        }
        
        // Add buttons
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            if (row.querySelector('.ai-btn')) return;
            
            const td = document.createElement('td');
            td.className = 'ai-td';
            td.style.cssText = 'text-align: center; vertical-align: middle;';
            
            const btn = document.createElement('button');
            btn.type = 'button'; // Important!
            btn.className = 'ai-btn';
            btn.innerHTML = '✨';
            btn.style.cssText = 'background: linear-gradient(135deg, #a855f7, #6366f1); color: white; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 16px;';
            btn.title = 'Analyze with AI';
            
            // Prevent row click
            btn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                handleClick(row);
                return false;
            };
            
            // Also prevent on td
            td.onclick = function(e) {
                e.stopPropagation();
            };
            
            td.appendChild(btn);
            row.appendChild(td);
        });
        
        injected = true;
        console.log('AI Integration Problems: Done, injected ' + rows.length);
    }
    
    function handleClick(row) {
        console.log('AI Integration Problems: Clicked');
        
        // Find specific elements by href patterns
        const problemLink = row.querySelector('a[href*="triggerids"]') || 
                           row.querySelector('td:nth-child(6) a') ||
                           row.querySelector('a.link-action');
        
        const hostLink = row.querySelector('a[href*="hostid"]') ||
                        row.querySelector('td:nth-child(5) a');
        
        // Get severity badge
        const severityCell = row.querySelector('td[class*="severity"]') || 
                            row.querySelector('td:nth-child(2)');
        const severityText = severityCell ? severityCell.textContent.trim() : 'N/A';
        
        // Get time from first cell
        const timeCell = row.querySelector('td:first-child');
        const timeText = timeCell ? timeCell.textContent.trim() : 'N/A';
        
        // Get duration (usually one of the last cells before actions)
        const cells = Array.from(row.querySelectorAll('td'));
        const durationCell = cells[cells.length - 4] || cells[cells.length - 3];
        const durationText = durationCell ? durationCell.textContent.trim() : 'N/A';
        
        const data = {
            problem: problemLink ? problemLink.textContent.trim() : 'No problem name found',
            host: hostLink ? hostLink.textContent.trim() : 'No host found',
            severity: severityText,
            time: timeText,
            duration: durationText
        };
        
        console.log('AI Integration Problems: Extracted:', data);
        
        // Validate we got actual data
        if (data.problem.includes('PM') || data.problem.includes('AM') || data.problem.length < 5) {
            data.problem = 'Problem name could not be extracted';
        }
        
        if (data.host.includes('PM') || data.host.includes('AM') || data.host.length < 3) {
            data.host = 'Host name could not be extracted';
        }
        
        showModal(data);
    }
    
    function showModal(data) {
        const content = document.createElement('div');
        
        content.innerHTML = `
            <table style="width: 100%; margin-bottom: 20px; border-collapse: collapse;">
                <tr><td style="padding: 8px; font-weight: bold; width: 120px;">Problem:</td><td style="padding: 8px;">${escapeHtml(data.problem)}</td></tr>
                <tr><td style="padding: 8px; font-weight: bold;">Host:</td><td style="padding: 8px;">${escapeHtml(data.host)}</td></tr>
                <tr><td style="padding: 8px; font-weight: bold;">Severity:</td><td style="padding: 8px;">${escapeHtml(data.severity)}</td></tr>
                <tr><td style="padding: 8px; font-weight: bold;">Duration:</td><td style="padding: 8px;">${escapeHtml(data.duration)}</td></tr>
            </table>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Ask AI:</label>
                <textarea id="ai_question" rows="5" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 13px;">Analyze this problem and suggest possible causes and remediation steps:

Problem: ${data.problem}
Host: ${data.host}
Severity: ${data.severity}
Duration: ${data.duration}

What could be causing this issue and how can it be resolved?</textarea>
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
                    
                    if (!question.trim()) {
                        alert('Please enter a question');
                        return;
                    }
                    
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
                            resp.style.cssText = 'padding: 15px; background: #fee; border: 1px solid #fcc; border-radius: 6px; margin-top: 15px; color: #c00; white-space: pre-wrap;';
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
    
    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
