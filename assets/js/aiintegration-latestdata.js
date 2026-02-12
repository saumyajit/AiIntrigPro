/**
 * AI Integration - Latest Data Page Enhancement
 * Adds sparkle buttons for anomaly detection and statistical analysis
 */
(function() {
    'use strict';
    
    function waitForDependencies(callback) {
        if (typeof window.AIIntegrationCore !== 'undefined') {
            callback();
        } else {
            setTimeout(() => waitForDependencies(callback), 100);
        }
    }
    
    function init() {
        const Core = window.AIIntegrationCore;
        
        Core.loadSettings().then(settings => {
            if (!settings.quick_actions.items) {
                console.log('AI Integration: Latest Data quick actions disabled');
                return;
            }
            
            if (!settings.providers || settings.providers.length === 0) {
                console.log('AI Integration: No providers enabled');
                return;
            }
            
            injectLatestDataButtons(settings);
        });
    }
    
    function injectLatestDataButtons(settings) {
        const table = document.querySelector('table.list-table');
        if (!table) return;
        
        // Add IA column header
        const thead = table.querySelector('thead tr');
        if (thead && !thead.querySelector('.aiintegration-header')) {
            const th = document.createElement('th');
            th.className = 'aiintegration-header';
            th.textContent = 'IA';
            thead.appendChild(th);
        }
        
        // Add sparkle buttons to each row
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            if (row.querySelector('.aiintegration-sparkle-btn')) return;
            
            const td = document.createElement('td');
            td.style.textAlign = 'center';
            
            const btn = createSparkleButton();
            btn.addEventListener('click', () => handleItemAnalysis(row, settings));
            
            td.appendChild(btn);
            row.appendChild(td);
        });
    }
    
    function createSparkleButton() {
        const btn = document.createElement('button');
        btn.className = 'aiintegration-sparkle-btn';
        btn.title = 'Analyze with AI';
        btn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" 
                      fill="url(#sparkle-gradient)" stroke="url(#sparkle-gradient)" stroke-width="1.5"/>
                <defs>
                    <linearGradient id="sparkle-gradient" x1="2" y1="2" x2="22" y2="22">
                        <stop offset="0%" style="stop-color:#a855f7;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#6366f1;stop-opacity:1" />
                    </linearGradient>
                </defs>
            </svg>
        `;
        return btn;
    }
    
    function handleItemAnalysis(row, settings) {
        const itemData = extractItemData(row);
        showAnalysisModal(itemData, settings);
    }
    
    function extractItemData(row) {
        const cells = row.querySelectorAll('td');
        
        return {
            host: cells[0]?.textContent.trim() || '',
            name: cells[1]?.textContent.trim() || '',
            lastCheck: cells[2]?.textContent.trim() || '',
            lastValue: cells[3]?.textContent.trim() || '',
            change: cells[4]?.textContent.trim() || ''
        };
    }
    
    function showAnalysisModal(itemData, settings) {
        const Core = window.AIIntegrationCore;
        
        const content = document.createElement('div');
        
        // Summary table
        const summaryTable = document.createElement('table');
        summaryTable.className = 'aiintegration-summary-table';
        summaryTable.innerHTML = `
            <tr><td>Host:</td><td>${Core.escapeHtml(itemData.host)}</td></tr>
            <tr><td>Item:</td><td>${Core.escapeHtml(itemData.name)}</td></tr>
            <tr><td>Last Value:</td><td>${Core.escapeHtml(itemData.lastValue)}</td></tr>
            <tr><td>Last Check:</td><td>${Core.escapeHtml(itemData.lastCheck)}</td></tr>
            <tr><td>Change:</td><td>${Core.escapeHtml(itemData.change)}</td></tr>
        `;
        content.appendChild(summaryTable);
        
        // Analysis type selector
        const analysisTypeField = document.createElement('div');
        analysisTypeField.className = 'aiintegration-field';
        analysisTypeField.innerHTML = `
            <label>Analysis Type:</label>
            <select id="analysis_type">
                <option value="anomaly">Anomaly Detection</option>
                <option value="trend">Trend Analysis</option>
                <option value="forecast">Forecast Next Values</option>
                <option value="threshold">Threshold Recommendation</option>
                <option value="custom">Custom Question</option>
            </select>
        `;
        content.appendChild(analysisTypeField);
        
        // Custom question field (hidden by default)
        const questionField = document.createElement('div');
        questionField.className = 'aiintegration-field';
        questionField.style.display = 'none';
        questionField.innerHTML = `
            <label>Your Question:</label>
            <textarea id="ai_question" placeholder="Ask anything about this item..."></textarea>
        `;
        content.appendChild(questionField);
        
        // Response area
        const responseDiv = document.createElement('div');
        responseDiv.id = 'ai_response_area';
        responseDiv.style.display = 'none';
        content.appendChild(responseDiv);
        
        // Provider selector
        const providerSelect = createProviderSelect(settings);
        
        const modal = Core.openModal(
            '📊 AI Item Analysis',
            content,
            [],
            { headerExtra: providerSelect }
        );
        
        // Show/hide custom question based on analysis type
        const analysisTypeSelect = document.getElementById('analysis_type');
        analysisTypeSelect.addEventListener('change', () => {
            questionField.style.display = analysisTypeSelect.value === 'custom' ? 'block' : 'none';
        });
        
        // Set actions
        modal.setActions([
            {
                label: 'Analyze',
                className: 'aiintegration-btn aiintegration-btn-primary',
                onClick: (close, btn) => {
                    const analysisType = analysisTypeSelect.value;
                    const customQuestion = document.getElementById('ai_question').value;
                    const provider = providerSelect.value;
                    
                    const question = getQuestionForAnalysisType(analysisType, itemData, customQuestion);
                    
                    if (!question) {
                        showError('Please enter a question');
                        return;
                    }
                    
                    btn.disabled = true;
                    btn.innerHTML = '<span class="aiintegration-loading"></span> Analyzing...';
                    
                    Core.callAI(question, { item: itemData }, provider)
                        .then(data => {
                            showResponse(data.response);
                            btn.disabled = false;
                            btn.textContent = 'Analyze';
                        })
                        .catch(err => {
                            showError(err.message);
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
    
    function getQuestionForAnalysisType(type, itemData, customQuestion) {
        const templates = {
            anomaly: `Analyze this monitoring item for anomalies:\n\nHost: ${itemData.host}\nItem: ${itemData.name}\nCurrent Value: ${itemData.lastValue}\nChange: ${itemData.change}\n\nIs this value anomalous? What could cause this pattern?`,
            trend: `Analyze the trend for this item:\n\nHost: ${itemData.host}\nItem: ${itemData.name}\nCurrent Value: ${itemData.lastValue}\nChange: ${itemData.change}\n\nWhat trend do you see? Is this concerning?`,
            forecast: `Forecast future values for this item:\n\nHost: ${itemData.host}\nItem: ${itemData.name}\nCurrent Value: ${itemData.lastValue}\nChange: ${itemData.change}\n\nPredict the next values and potential thresholds to watch.`,
            threshold: `Recommend monitoring thresholds for this item:\n\nHost: ${itemData.host}\nItem: ${itemData.name}\nCurrent Value: ${itemData.lastValue}\n\nSuggest appropriate warning and critical thresholds.`,
            custom: customQuestion
        };
        
        return templates[type] || '';
    }
    
    function createProviderSelect(settings) {
        const select = document.createElement('select');
        select.id = 'provider_select';
        
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
    
    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => waitForDependencies(init));
    } else {
        waitForDependencies(init);
    }
})();
