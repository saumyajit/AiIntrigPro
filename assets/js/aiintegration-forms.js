/**
 * AI Integration - Form Helpers
 * Adds AI assistance to Triggers and Hosts forms
 */
(function() {
    'use strict';
    
    function waitForDependencies(callback) {
        if (typeof window.AIIntegrationCore !== 'undefined' && typeof window.AIIntegrationInit !== 'undefined') {
            callback();
        } else {
            setTimeout(() => waitForDependencies(callback), 100);
        }
    }
    
    function init() {
        const Core = window.AIIntegrationCore;
        const Init = window.AIIntegrationInit;
        
        // Load settings first
        Core.loadSettings().then(settings => {
            // Register handlers for form injections
            Init.registerHandler('triggers', (dialog) => {
                if (settings.quick_actions.triggers) {
                    injectTriggerHelper(dialog, settings);
                }
            });
            
            Init.registerHandler('hosts', (dialog) => {
                if (settings.quick_actions.hosts) {
                    injectHostHelper(dialog, settings);
                }
            });
        });
    }
    
    /**
     * Inject AI helper button into Trigger form
     */
    function injectTriggerHelper(dialog, settings) {
        const Core = window.AIIntegrationCore;
        
        // Find the expression field
        const expressionField = dialog.querySelector('textarea[name="expression"]') || 
                                dialog.querySelector('input[name="expression"]');
        
        if (!expressionField) return;
        
        // Check if already injected
        if (dialog.querySelector('.aiintegration-trigger-helper')) return;
        
        // Create AI helper button
        const helperBtn = document.createElement('button');
        helperBtn.type = 'button';
        helperBtn.className = 'aiintegration-trigger-helper';
        helperBtn.innerHTML = '✨ Generate Trigger with AI';
        helperBtn.style.cssText = 'margin-top: 8px; padding: 8px 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;';
        
        helperBtn.addEventListener('click', () => {
            showTriggerGeneratorModal(expressionField, settings);
        });
        
        // Insert after expression field
        expressionField.parentNode.insertBefore(helperBtn, expressionField.nextSibling);
    }
    
    /**
     * Show trigger generator modal
     */
    function showTriggerGeneratorModal(expressionField, settings) {
        const Core = window.AIIntegrationCore;
        
        const content = document.createElement('div');
        
        // Info box
        const infoBox = document.createElement('div');
        infoBox.className = 'aiintegration-field';
        infoBox.innerHTML = `
            <p style="background: #f0f7ff; padding: 12px; border-radius: 6px; margin-bottom: 16px;">
                💡 Describe what you want to monitor in plain English, and AI will generate the trigger expression for you.
            </p>
        `;
        content.appendChild(infoBox);
        
        // Description field
        const descField = document.createElement('div');
        descField.className = 'aiintegration-field';
        descField.innerHTML = `
            <label>What do you want to monitor?</label>
            <textarea id="trigger_description" rows="4" placeholder="Example: Alert me when CPU usage is above 80% for more than 5 minutes"></textarea>
        `;
        content.appendChild(descField);
        
        // Context field (optional)
        const contextField = document.createElement('div');
        contextField.className = 'aiintegration-field';
        contextField.innerHTML = `
            <label>Additional Context (optional):</label>
            <textarea id="trigger_context" rows="2" placeholder="Host type, item names, severity level, etc."></textarea>
        `;
        content.appendChild(contextField);
        
        // Response area
        const responseDiv = document.createElement('div');
        responseDiv.id = 'ai_response_area';
        responseDiv.style.display = 'none';
        content.appendChild(responseDiv);
        
        // Provider selector
        const providerSelect = createProviderSelect(settings);
        
        const modal = Core.openModal(
            '✨ AI Trigger Generator',
            content,
            [],
            { headerExtra: providerSelect }
        );
        
        modal.setActions([
            {
                label: 'Generate',
                className: 'aiintegration-btn aiintegration-btn-primary',
                onClick: (close, btn) => {
                    const description = document.getElementById('trigger_description').value;
                    const context = document.getElementById('trigger_context').value;
                    const provider = providerSelect.value;
                    
                    if (!description) {
                        showError('Please describe what you want to monitor');
                        return;
                    }
                    
                    btn.disabled = true;
                    btn.innerHTML = '<span class="aiintegration-loading"></span> Generating...';
                    
                    const question = `Generate a Zabbix trigger expression for the following requirement:\n\n${description}\n\nContext: ${context}\n\nProvide ONLY the trigger expression in Zabbix format. Be specific and use proper syntax.`;
                    
                    Core.callAI(question, { type: 'trigger_generation' }, provider)
                        .then(data => {
                            showResponse(data.response, expressionField);
                            btn.disabled = false;
                            btn.textContent = 'Generate';
                        })
                        .catch(err => {
                            showError(err.message);
                            btn.disabled = false;
                            btn.textContent = 'Generate';
                        });
                }
            },
            {
                label: 'Close',
                className: 'aiintegration-btn aiintegration-btn-secondary',
                onClick: (close) => close()
            }
        ]);
        
        function showResponse(text, targetField) {
            const responseArea = document.getElementById('ai_response_area');
            responseArea.style.display = 'block';
            
            const responseContent = document.createElement('div');
            responseContent.className = 'aiintegration-response';
            responseContent.textContent = text;
            
            const useBtn = document.createElement('button');
            useBtn.type = 'button';
            useBtn.textContent = '✓ Use This Expression';
            useBtn.className = 'aiintegration-btn aiintegration-btn-primary';
            useBtn.style.marginTop = '12px';
            useBtn.addEventListener('click', () => {
                // Extract expression from response
                const expression = extractExpression(text);
                if (targetField) {
                    targetField.value = expression;
                    targetField.dispatchEvent(new Event('change', { bubbles: true }));
                }
                modal.close();
            });
            
            responseArea.innerHTML = '';
            responseArea.appendChild(responseContent);
            responseArea.appendChild(useBtn);
        }
        
        function showError(message) {
            const responseArea = document.getElementById('ai_response_area');
            responseArea.style.display = 'block';
            responseArea.innerHTML = `<div class="aiintegration-error">${Core.escapeHtml(message)}</div>`;
        }
        
        function extractExpression(text) {
            // Try to extract trigger expression from AI response
            // Look for patterns like {host:item.func(param)}
            const match = text.match(/\{[^}]+\}/g);
            if (match && match.length > 0) {
                return match[0];
            }
            // Return full text if no pattern found
            return text.trim();
        }
    }
    
    /**
     * Inject AI helper button into Host form
     */
    function injectHostHelper(dialog, settings) {
        const Core = window.AIIntegrationCore;
        
        // Find a suitable place in the form
        const formBody = dialog.querySelector('.overlay-dialogue-body') || dialog;
        
        // Check if already injected
        if (dialog.querySelector('.aiintegration-host-helper')) return;
        
        // Create AI helper section
        const helperSection = document.createElement('div');
        helperSection.className = 'aiintegration-host-helper';
        helperSection.style.cssText = 'margin: 16px 0; padding: 12px; background: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb;';
        
        const helperTitle = document.createElement('div');
        helperTitle.innerHTML = '<strong>🤖 AI Assistant</strong>';
        helperTitle.style.marginBottom = '8px';
        helperSection.appendChild(helperTitle);
        
        const helperButtons = document.createElement('div');
        helperButtons.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';
        
        const buttons = [
            { label: '📋 Generate Host Config', action: 'config' },
            { label: '🔍 Health Check', action: 'health' },
            { label: '💡 Optimization Tips', action: 'optimize' }
        ];
        
        buttons.forEach(btnConfig => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = btnConfig.label;
            btn.style.cssText = 'padding: 6px 12px; background: white; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer; font-size: 13px;';
            btn.addEventListener('click', () => {
                showHostAssistantModal(btnConfig.action, settings);
            });
            helperButtons.appendChild(btn);
        });
        
        helperSection.appendChild(helperButtons);
        
        // Insert at top of form body
        formBody.insertBefore(helperSection, formBody.firstChild);
    }
    
    /**
     * Show host assistant modal
     */
    function showHostAssistantModal(action, settings) {
        const Core = window.AIIntegrationCore;
        
        const titles = {
            config: '📋 Generate Host Configuration',
            health: '🔍 Host Health Check',
            optimize: '💡 Host Optimization Tips'
        };
        
        const content = document.createElement('div');
        
        const descField = document.createElement('div');
        descField.className = 'aiintegration-field';
        descField.innerHTML = `
            <label>Describe your host or requirements:</label>
            <textarea id="host_description" rows="4" placeholder="Example: Linux web server running Apache and MySQL"></textarea>
        `;
        content.appendChild(descField);
        
        const responseDiv = document.createElement('div');
        responseDiv.id = 'ai_response_area';
        responseDiv.style.display = 'none';
        content.appendChild(responseDiv);
        
        const providerSelect = createProviderSelect(settings);
        
        const modal = Core.openModal(
            titles[action] || 'AI Host Assistant',
            content,
            [],
            { headerExtra: providerSelect }
        );
        
        modal.setActions([
            {
                label: 'Generate',
                className: 'aiintegration-btn aiintegration-btn-primary',
                onClick: (close, btn) => {
                    const description = document.getElementById('host_description').value;
                    const provider = providerSelect.value;
                    
                    if (!description) {
                        showError('Please describe your host');
                        return;
                    }
                    
                    btn.disabled = true;
                    btn.innerHTML = '<span class="aiintegration-loading"></span> Analyzing...';
                    
                    const questions = {
                        config: `Generate a recommended monitoring configuration for this host:\n\n${description}\n\nInclude suggested items, triggers, and intervals.`,
                        health: `Analyze the health and provide recommendations for this host:\n\n${description}\n\nIdentify potential issues and monitoring gaps.`,
                        optimize: `Provide optimization tips for monitoring this host:\n\n${description}\n\nSuggest ways to improve monitoring efficiency and reduce noise.`
                    };
                    
                    Core.callAI(questions[action], { type: 'host_assistant' }, provider)
                        .then(data => {
                            showResponse(data.response);
                            btn.disabled = false;
                            btn.textContent = 'Generate';
                        })
                        .catch(err => {
                            showError(err.message);
                            btn.disabled = false;
                            btn.textContent = 'Generate';
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
    
    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => waitForDependencies(init));
    } else {
        waitForDependencies(init);
    }
})();
