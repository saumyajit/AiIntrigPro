/**
 * AI Integration - Problems Page Enhancement
 * Adds sparkle buttons to problems table for AI analysis
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
            if (!settings.quick_actions.problems) {
                console.log('AI Integration: Problems quick actions disabled');
                return;
            }
            
            if (!settings.providers || settings.providers.length === 0) {
                console.log('AI Integration: No providers enabled');
                return;
            }
            
            injectProblemsButtons(settings);
        });
    }
    
    function injectProblemsButtons(settings) {
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
            btn.addEventListener('click', () => handleProblemAnalysis(row, settings));
            
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
    
    function handleProblemAnalysis(row, settings) {
        const Core = window.AIIntegrationCore;
        
        // Extract problem data
        const problemData = extractProblemData(row);
        
        // Show modal
        showAnalysisModal(problemData, settings);
    }
    
    function extractProblemData(row) {
        const cells = row.querySelectorAll('td');
        
        return {
            time: cells[0]?.textContent.trim() || '',
            severity: cells[1]?.textContent.trim() || '',
            problem: cells[3]?.textContent.trim() || '',
            host: cells[5]?.textContent.trim() || '',
            duration: cells[6]?.textContent.trim() || ''
        };
    }
    
    function showAnalysisModal(problemData, settings) {
        const Core = window.AIIntegrationCore;
        
        const content = document.createElement('div');
        
        // Summary table
        const summaryTable = document.createElement('table');
        summaryTable.className = 'aiintegration-summary-table';
        summaryTable.innerHTML = `
            <tr><td>Problem:</td><td>${Core.escapeHtml(problemData.problem)}</td></tr>
            <tr><td>Host:</td><td>${Core.escapeHtml(problemData.host)}</td></tr>
            <tr><td>Severity:</td><td>${Core.escapeHtml(problemData.severity)}</td></tr>
            <tr><td>Duration:</td><td>${Core.escapeHtml(problemData.duration)}</td></tr>
        `;
        content.appendChild(summaryTable);
        
        // Question field
        const questionField = document.createElement('div');
        questionField.className = 'aiintegration-field';
        questionField.innerHTML = `
            <label>Ask AI:</label>
            <textarea id="ai_question" placeholder="What could be causing this issue?">${getDefaultQuestion(problemData)}</textarea>
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
            '✨ AI Problem Analysis',
            content,
            [],
            { headerExtra: providerSelect }
        );
        
        // Set actions
        modal.setActions([
            {
                label: 'Analyze',
                className: 'aiintegration-btn aiintegration-btn-primary',
                onClick: (close, btn) => {
                    const question = document.getElementById('ai_question').value;
                    const provider = providerSelect.value;
                    
                    if (!question) return;
                    
                    btn.disabled = true;
                    btn.innerHTML = '<span class="aiintegration-loading"></span> Analyzing...';
                    
                    Core.callAI(question, { problem: problemData }, provider)
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
    
    function getDefaultQuestion(problemData) {
        return `Analyze this problem and suggest possible causes and remediation steps:\n\nProblem: ${problemData.problem}\nHost: ${problemData.host}\nSeverity: ${problemData.severity}`;
    }
    
    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => waitForDependencies(init));
    } else {
        waitForDependencies(init);
    }
})();
