/**
 * AI Integration - Problems Page Enhancement
 * FIXED: Proper table detection, persistent buttons, correct provider loading
 */
(function() {
    'use strict';
    
    let settings = null;
    let injectionAttempts = 0;
    const MAX_ATTEMPTS = 20;
    
    function waitForDependencies(callback) {
        if (typeof window.AIIntegrationCore !== 'undefined') {
            callback();
        } else {
            setTimeout(() => waitForDependencies(callback), 100);
        }
    }
    
    function init() {
        const Core = window.AIIntegrationCore;
        
        Core.loadSettings().then(loadedSettings => {
            settings = loadedSettings;
            
            if (!settings.quick_actions.problems) {
                console.log('AI Integration: Problems quick actions disabled');
                return;
            }
            
            if (!settings.providers || settings.providers.length === 0) {
                console.log('AI Integration: No providers enabled');
                return;
            }
            
            console.log('AI Integration: Problems page initialized', settings);
            
            // Initial injection
            injectProblemsButtons();
            
            // Re-inject on any DOM changes (Zabbix updates table dynamically)
            const observer = new MutationObserver(() => {
                if (injectionAttempts < MAX_ATTEMPTS) {
                    setTimeout(injectProblemsButtons, 500);
                }
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        });
    }
    
    function injectProblemsButtons() {
        // Look for the actual problems table (not filter)
        const table = document.querySelector('table.list-table[data-table-name="problems"]') ||
                     document.querySelector('form[name="problem"] table.list-table') ||
                     document.querySelector('.list-table tbody tr[data-problemid]')?.closest('table');
        
        if (!table) {
            console.log('AI Integration: Problems table not found');
            return;
        }
        
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        
        // Add header if not exists
        const thead = table.querySelector('thead tr');
        if (thead && !thead.querySelector('.aiintegration-header')) {
            const th = document.createElement('th');
            th.className = 'aiintegration-header';
            th.textContent = 'IA';
            th.style.width = '50px';
            th.style.textAlign = 'center';
            thead.appendChild(th);
        }
        
        // Add buttons to each row
        const rows = tbody.querySelectorAll('tr');
        let injected = 0;
        
        rows.forEach(row => {
            // Skip if already has button
            if (row.querySelector('.aiintegration-sparkle-btn')) return;
            
            const td = document.createElement('td');
            td.className = 'aiintegration-td';
            td.style.textAlign = 'center';
            td.style.verticalAlign = 'middle';
            
            const btn = createSparkleButton();
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleProblemAnalysis(row);
            });
            
            td.appendChild(btn);
            row.appendChild(td);
            injected++;
        });
        
        if (injected > 0) {
            injectionAttempts++;
            console.log(`AI Integration: Injected ${injected} buttons (attempt ${injectionAttempts})`);
        }
    }
    
    function createSparkleButton() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'aiintegration-sparkle-btn btn-icon';
        btn.title = 'Analyze with AI';
        btn.style.cssText = 'background: none; border: none; cursor: pointer; padding: 4px;';
        btn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" 
                      fill="url(#sparkle-gradient-${Date.now()})" stroke="#a855f7" stroke-width="1.5"/>
                <defs>
                    <linearGradient id="sparkle-gradient-${Date.now()}" x1="2" y1="2" x2="22" y2="22">
                        <stop offset="0%" style="stop-color:#a855f7;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#6366f1;stop-opacity:1" />
                    </linearGradient>
                </defs>
            </svg>
        `;
        return btn;
    }
    
    function handleProblemAnalysis(row) {
        if (!settings) {
            alert('Settings not loaded. Please refresh the page.');
            return;
        }
        
        const problemData = extractProblemData(row);
        console.log('AI Integration: Problem data extracted', problemData);
        showAnalysisModal(problemData);
    }
    
	function extractProblemData(row) {
		const cells = Array.from(row.querySelectorAll('td'));
		
		// Debug: log cell contents
		console.log('AI Integration: Cell count:', cells.length);
		cells.forEach((cell, idx) => {
			console.log(`Cell ${idx}:`, cell.textContent.trim().substring(0, 50));
		});
		
		// Find problem name (usually has a link to trigger)
		const problemLink = row.querySelector('a[href*="triggerids"]') || 
						row.querySelector('a.link-action');
		const problem = problemLink ? problemLink.textContent.trim() : '';
		
		// Find host name (usually has a link to host)
		const hostLink = row.querySelector('a[href*="hostid"]');
		const host = hostLink ? hostLink.textContent.trim() : '';
		
		// Find severity (usually has a badge or class)
		const severityEl = row.querySelector('.problem-severity-badge') ||
						row.querySelector('[class*="severity"]') ||
						cells.find(c => c.textContent.match(/Not classified|Information|Warning|Average|High|Disaster/i));
		const severity = severityEl ? severityEl.textContent.trim() : '';
		
		// Time is usually first or second cell
		const timeEl = cells.find(c => c.textContent.match(/\d{4}-\d{2}-\d{2}|\d+[smhd]/));
		const time = timeEl ? timeEl.textContent.trim() : '';
		
		// Duration is usually near the end
		const durationEl = cells.find(c => c.textContent.match(/\d+[smhd]/) && c !== timeEl);
		const duration = durationEl ? durationEl.textContent.trim() : '';
		
		const extracted = {
			time: time,
			severity: severity,
			problem: problem,
			host: host,
			duration: duration
		};
		
		console.log('AI Integration: Extracted problem data:', extracted);
		return extracted;
	}
    
    function showAnalysisModal(problemData) {
        const Core = window.AIIntegrationCore;
        
        const content = document.createElement('div');
        
        // Summary
        const summaryTable = document.createElement('table');
        summaryTable.className = 'aiintegration-summary-table';
        summaryTable.innerHTML = `
            <tr><td>Problem:</td><td>${Core.escapeHtml(problemData.problem || 'N/A')}</td></tr>
            <tr><td>Host:</td><td>${Core.escapeHtml(problemData.host || 'N/A')}</td></tr>
            <tr><td>Severity:</td><td>${Core.escapeHtml(problemData.severity || 'N/A')}</td></tr>
            <tr><td>Duration:</td><td>${Core.escapeHtml(problemData.duration || 'N/A')}</td></tr>
        `;
        content.appendChild(summaryTable);
        
        // Question field
        const questionField = document.createElement('div');
        questionField.className = 'aiintegration-field';
        questionField.innerHTML = `
            <label>Ask AI:</label>
            <textarea id="ai_question" rows="4" placeholder="What could be causing this issue?">${getDefaultQuestion(problemData)}</textarea>
        `;
        content.appendChild(questionField);
        
        // Response area
        const responseDiv = document.createElement('div');
        responseDiv.id = 'ai_response_area';
        responseDiv.style.display = 'none';
        content.appendChild(responseDiv);
        
        // Provider selector
        const providerSelect = createProviderSelect();
        
        const modal = Core.openModal(
            '✨ AI Problem Analysis',
            content,
            [],
            { headerExtra: providerSelect }
        );
        
        modal.setActions([
            {
                label: 'Analyze',
                className: 'aiintegration-btn aiintegration-btn-primary',
                onClick: (close, btn) => {
                    const question = document.getElementById('ai_question').value;
                    const provider = providerSelect.value;
                    
                    if (!question) {
                        showError('Please enter a question');
                        return;
                    }
                    
                    btn.disabled = true;
                    btn.innerHTML = '<span class="aiintegration-loading"></span> Analyzing...';
                    
                    Core.callAI(question, { problem: problemData }, provider)
                        .then(data => {
                            showResponse(data.response);
                            btn.disabled = false;
                            btn.textContent = 'Analyze';
                        })
                        .catch(err => {
                            showError(err.message || 'Analysis failed');
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
        
        function showResponse(text) {
            const responseArea = document.getElementById('ai_response_area');
            responseArea.style.display = 'block';
            responseArea.innerHTML = `<div class="aiintegration-response">${Core.escapeHtml(text)}</div>`;
        }
        
        function showError(message) {
            const responseArea = document.getElementById('ai_response_area');
            responseArea.style.display = 'block';
            responseArea.innerHTML = `<div class="aiintegration-error">${Core.escapeHtml(message)}</div>`;
        }
    }
    
    function createProviderSelect() {
        const select = document.createElement('select');
        select.id = 'provider_select';
        
        if (!settings || !settings.providers || settings.providers.length === 0) {
            const option = document.createElement('option');
            option.value = 'openai';
            option.textContent = 'No providers configured';
            select.appendChild(option);
            select.disabled = true;
            return select;
        }
        
        settings.providers.forEach(provider => {
            const option = document.createElement('option');
            option.value = provider.id;
            option.textContent = provider.name;
            if (provider.id === settings.default_provider) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        
        return select;
    }
    
    function getDefaultQuestion(problemData) {
        if (!problemData.problem) {
            return 'Analyze this problem and suggest possible causes and remediation steps.';
        }
        return `Analyze this problem and suggest possible causes and remediation steps:\n\nProblem: ${problemData.problem}\nHost: ${problemData.host}\nSeverity: ${problemData.severity}`;
    }
    
    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => waitForDependencies(init));
    } else {
        waitForDependencies(init);
    }
})();
