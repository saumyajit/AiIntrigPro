/**
 * AI Integration - Latest Data Page Enhancement  
 * FIXED: Target actual data table, not filter
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
			
			if (!settings.quick_actions.problems) { // or .items for latestdata
				console.log('AI Integration: Quick actions disabled');
				return;
			}
			
			if (!settings.providers || settings.providers.length === 0) {
				console.log('AI Integration: No providers enabled');
				return;
			}
			
			console.log('AI Integration: Initialized with settings:', settings);
			
			// Initial injection
			setTimeout(injectProblemsButtons, 1000); // or injectLatestDataButtons
			
			// Re-inject ONLY on filter apply or pagination
			// Listen for Zabbix's custom events instead of MutationObserver
			document.addEventListener('zbx_table_updated', () => {
				console.log('AI Integration: Table updated, re-injecting');
				setTimeout(injectProblemsButtons, 500);
			});
			
			// Fallback: Single re-injection after 3 seconds (for initial page load)
			setTimeout(() => {
				if (injectionAttempts === 0) {
					injectProblemsButtons();
				}
			}, 3000);
		});
	}
    
    function injectLatestDataButtons() {
        // Find the ACTUAL data table (not the filter)
        // Look for table with data rows containing item info
        const table = document.querySelector('table.list-table.compact-view') ||
                     Array.from(document.querySelectorAll('table.list-table')).find(t => {
                         const firstRow = t.querySelector('tbody tr');
                         return firstRow && firstRow.querySelectorAll('td').length > 5;
                     });
        
        if (!table) {
            console.log('AI Integration: Latest Data table not found');
            return;
        }
        
        // Make sure we're not in the filter section
        if (table.closest('.filter-forms') || table.closest('.filter-container')) {
            console.log('AI Integration: Skipping filter table');
            return;
        }
        
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        
        // Add header
        const thead = table.querySelector('thead tr');
        if (thead && !thead.querySelector('.aiintegration-header')) {
            const th = document.createElement('th');
            th.className = 'aiintegration-header';
            th.textContent = 'IA';
            th.style.width = '50px';
            th.style.textAlign = 'center';
            thead.appendChild(th);
        }
        
        // Add buttons
        const rows = tbody.querySelectorAll('tr');
        let injected = 0;
        
        rows.forEach(row => {
            if (row.querySelector('.aiintegration-sparkle-btn')) return;
            
            const td = document.createElement('td');
            td.className = 'aiintegration-td';
            td.style.textAlign = 'center';
            
            const btn = createSparkleButton();
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleItemAnalysis(row);
            });
            
            td.appendChild(btn);
            row.appendChild(td);
            injected++;
        });
        
        if (injected > 0) {
            injectionAttempts++;
            console.log(`AI Integration: Injected ${injected} Latest Data buttons`);
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
                      fill="url(#sparkle-ld-${Date.now()})" stroke="#a855f7" stroke-width="1.5"/>
                <defs>
                    <linearGradient id="sparkle-ld-${Date.now()}" x1="2" y1="2" x2="22" y2="22">
                        <stop offset="0%" style="stop-color:#a855f7;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#6366f1;stop-opacity:1" />
                    </linearGradient>
                </defs>
            </svg>
        `;
        return btn;
    }
    
    function handleItemAnalysis(row) {
        if (!settings) {
            alert('Settings not loaded');
            return;
        }
        
        const itemData = extractItemData(row);
        console.log('AI Integration: Item data', itemData);
        showAnalysisModal(itemData);
    }
    
	function extractItemData(row) {
		const cells = Array.from(row.querySelectorAll('td'));
		
		console.log('AI Integration: Latest Data cell count:', cells.length);
		
		// Find host link
		const hostLink = row.querySelector('a[href*="hostid"]');
		const host = hostLink ? hostLink.textContent.trim() : 'N/A';
		
		// Find item name (usually second column or has a link)
		const nameLink = row.querySelector('a[href*="itemid"]') ||
						row.querySelector('a.link-alt');
		const name = nameLink ? nameLink.textContent.trim() : 
					(cells[1] ? cells[1].textContent.trim() : 'N/A');
		
		// Last check time (usually has time format)
		const lastCheckEl = cells.find(c => c.textContent.match(/\d{2}:\d{2}:\d{2}|\d+[smh]/));
		const lastCheck = lastCheckEl ? lastCheckEl.textContent.trim() : '';
		
		// Last value (usually bold or has value class)
		const lastValueEl = row.querySelector('.bold') || 
						row.querySelector('[class*="value"]') ||
						cells[cells.length - 3]; // Usually third from end
		const lastValue = lastValueEl ? lastValueEl.textContent.trim() : '';
		
		// Change (usually has +/- or percentage)
		const changeEl = cells.find(c => c.textContent.match(/[+\-]\d+|%/));
		const change = changeEl ? changeEl.textContent.trim() : '';
		
		const extracted = {
			host: host,
			name: name,
			lastCheck: lastCheck,
			lastValue: lastValue,
			change: change
		};
		
		console.log('AI Integration: Extracted item data:', extracted);
		return extracted;
	}
    
    function showAnalysisModal(itemData) {
        const Core = window.AIIntegrationCore;
        
        const content = document.createElement('div');
        
        const summaryTable = document.createElement('table');
        summaryTable.className = 'aiintegration-summary-table';
        summaryTable.innerHTML = `
            <tr><td>Host:</td><td>${Core.escapeHtml(itemData.host || 'N/A')}</td></tr>
            <tr><td>Item:</td><td>${Core.escapeHtml(itemData.name || 'N/A')}</td></tr>
            <tr><td>Last Value:</td><td>${Core.escapeHtml(itemData.lastValue || 'N/A')}</td></tr>
            <tr><td>Last Check:</td><td>${Core.escapeHtml(itemData.lastCheck || 'N/A')}</td></tr>
        `;
        content.appendChild(summaryTable);
        
        const questionField = document.createElement('div');
        questionField.className = 'aiintegration-field';
        questionField.innerHTML = `
            <label>Ask AI:</label>
            <textarea id="ai_question" rows="4" placeholder="Analyze this item...">Analyze this monitoring item: ${itemData.name} on ${itemData.host}. Current value: ${itemData.lastValue}. Is this normal?</textarea>
        `;
        content.appendChild(questionField);
        
        const responseDiv = document.createElement('div');
        responseDiv.id = 'ai_response_area';
        responseDiv.style.display = 'none';
        content.appendChild(responseDiv);
        
        const providerSelect = createProviderSelect();
        
        const modal = Core.openModal(
            '📊 AI Item Analysis',
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
                    
                    btn.disabled = true;
                    btn.innerHTML = '<span class="aiintegration-loading"></span> Analyzing...';
                    
                    Core.callAI(question, { item: itemData }, provider)
                        .then(data => {
                            const responseArea = document.getElementById('ai_response_area');
                            responseArea.style.display = 'block';
                            responseArea.innerHTML = `<div class="aiintegration-response">${Core.escapeHtml(data.response)}</div>`;
                            btn.disabled = false;
                            btn.textContent = 'Analyze';
                        })
                        .catch(err => {
                            const responseArea = document.getElementById('ai_response_area');
                            responseArea.style.display = 'block';
                            responseArea.innerHTML = `<div class="aiintegration-error">${Core.escapeHtml(err.message)}</div>`;
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
    
    function createProviderSelect() {
        const select = document.createElement('select');
        select.id = 'provider_select';
        
        if (!settings || !settings.providers || settings.providers.length === 0) {
            const option = document.createElement('option');
            option.value = 'openai';
            option.textContent = 'No providers';
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
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => waitForDependencies(init));
    } else {
        waitForDependencies(init);
    }
})();
