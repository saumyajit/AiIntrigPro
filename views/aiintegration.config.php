<?php

// Custom CSS with additional styles for General Settings
$custom_css = '
<style>
.ai-config-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 20px;
    border-radius: 4px;
    margin-bottom: 20px;
    color: white;
    text-align: center;
}

.ai-config-header h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
}

.ai-config-header p {
    margin: 5px 0 0 0;
    opacity: 0.9;
    font-size: 14px;
}

.provider-tabs .tabs-container {
    background: white;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.ai-info-box {
    background: #f0f7ff;
    border-left: 4px solid #2196F3;
    padding: 12px 16px;
    margin: 15px 0;
    border-radius: 4px;
}

.ai-info-box.success {
    background: #f0fdf4;
    border-left-color: #10b981;
}

.ai-info-box.warning {
    background: #fffbeb;
    border-left-color: #f59e0b;
}

.ai-info-box.error {
    background: #fef2f2;
    border-left-color: #ef4444;
}

.ai-provider-icon {
    width: 24px;
    height: 24px;
    display: inline-block;
    vertical-align: middle;
    margin-right: 8px;
}

.ai-field-help {
    font-size: 12px;
    color: #666;
    margin-top: 4px;
    display: block;
}

.ai-test-result {
    margin-top: 15px;
    padding: 12px;
    border-radius: 4px;
    display: none;
}

.ai-test-result.show {
    display: block;
}

.ai-button-group {
    display: flex;
    gap: 10px;
    margin-top: 20px;
}

.form-grid .form-field input[type="text"],
.form-grid .form-field input[type="password"],
.form-grid .form-field select {
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 8px 12px;
}

.form-grid .form-field input[type="text"]:focus,
.form-grid .form-field input[type="password"]:focus,
.form-grid .form-field select:focus {
    border-color: #667eea;
    outline: none;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.general-settings-section {
    background: white;
    padding: 20px;
    border-radius: 4px;
    margin-bottom: 20px;
}

.general-settings-section h3 {
    margin-top: 0;
    margin-bottom: 15px;
    color: #374151;
    font-size: 18px;
    font-weight: 600;
    border-bottom: 2px solid #e5e7eb;
    padding-bottom: 10px;
}

.general-settings-description {
    color: #6b7280;
    font-size: 14px;
    margin-bottom: 15px;
}

.checkbox-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 10px;
}

.checkbox-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-radius: 4px;
    transition: background 0.2s;
}

.checkbox-item:hover {
    background: #f9fafb;
}

.checkbox-item label {
    margin: 0;
    cursor: pointer;
    font-size: 14px;
}

.checkbox-label-description {
    color: #6b7280;
    font-size: 12px;
}

.enabled-badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    margin-left: 8px;
}

.enabled-badge.yes {
    background: #d1fae5;
    color: #065f46;
}

.enabled-badge.no {
    background: #fee2e2;
    color: #991b1b;
}
</style>
';

// Helper function to create provider form fields
function createProviderForm($provider, $config) {
    $provider_names = [
        'openai' => 'OpenAI',
        'github' => 'GitHub Models',
        'anthropic' => 'Anthropic (Claude)',
        'gemini' => 'Google Gemini',
        'deepseek' => 'DeepSeek',
        'mistral' => 'Mistral AI',
        'groq' => 'Groq',
        'custom' => 'Custom'
    ];
    
    $provider_info = [
        'openai' => _('GPT-4 and GPT-3.5 models for advanced language understanding'),
        'github' => _('Free AI models from GitHub Marketplace (gpt-4o-mini, Phi-3, etc.)'),
        'anthropic' => _('Claude models known for safety and helpfulness'),
        'gemini' => _('Google\'s powerful multimodal AI models'),
        'deepseek' => _('Cost-effective AI with strong reasoning capabilities'),
        'mistral' => _('High-performance open and commercial models'),
        'groq' => _('Ultra-fast inference with LLaMA, Mixtral, Gemma models'),
        'custom' => _('Use any OpenAI-compatible or custom AI endpoint')
    ];
    
    // Ensure provider exists in config
    if (!isset($config[$provider])) {
        $config[$provider] = [
            'api_endpoint' => '',
            'default_model' => '',
            'temperature' => '0.7',
            'max_tokens' => '1000',
            'api_key' => '',
            'enabled' => false
        ];
    }
    
    // Set defaults based on provider if endpoint is empty
    if (empty($config[$provider]['api_endpoint'])) {
        switch ($provider) {
            case 'github':
                $config[$provider]['api_endpoint'] = 'https://models.inference.ai.azure.com/chat/completions';
                $config[$provider]['default_model'] = 'gpt-4o-mini';
                break;
            case 'openai':
                $config[$provider]['api_endpoint'] = 'https://api.openai.com/v1/chat/completions';
                $config[$provider]['default_model'] = 'gpt-4o';
                break;
            case 'anthropic':
                $config[$provider]['api_endpoint'] = 'https://api.anthropic.com/v1/messages';
                $config[$provider]['default_model'] = 'claude-sonnet-4-20250514';
                break;
            case 'gemini':
                $config[$provider]['api_endpoint'] = 'https://generativelanguage.googleapis.com/v1beta/models';
                $config[$provider]['default_model'] = 'gemini-pro';
                break;
            case 'deepseek':
                $config[$provider]['api_endpoint'] = 'https://api.deepseek.com/v1/chat/completions';
                $config[$provider]['default_model'] = 'deepseek-chat';
                break;
            case 'mistral':
                $config[$provider]['api_endpoint'] = 'https://api.mistral.ai/v1/chat/completions';
                $config[$provider]['default_model'] = 'mistral-large-latest';
                break;
            case 'groq':
                $config[$provider]['api_endpoint'] = 'https://api.groq.com/openai/v1/chat/completions';
                $config[$provider]['default_model'] = 'llama3-70b-8192';
                break;
        }
    }
    
    $is_enabled = !empty($config[$provider]['enabled']);
    
    $info_box = (new CDiv())
        ->addClass('ai-info-box')
        ->addItem(new CTag('strong', true, '💡 ' . _('About ') . $provider_names[$provider]))
        ->addItem(new CTag('br'))
        ->addItem($provider_info[$provider] ?? '');
    
    $form = (new CFormGrid())
        ->addItem([
            new CLabel(_('Enable Provider'), $provider . '_enabled'),
            new CFormField([
                (new CCheckBox($provider . '_enabled', '1'))
                    ->setChecked($is_enabled)
                    ->setAttribute('data-provider', $provider)
                    ->addClass('provider-enabled-checkbox'),
                (new CTag('span', true, _('Enable this provider for use in AI Collab and Quick Actions')))
                    ->addClass('ai-field-help')
            ])
        ])
        ->addItem([
            new CLabel(_('API Endpoint'), $provider . '_api_endpoint'),
            new CFormField([
                (new CTextBox($provider . '_api_endpoint', $config[$provider]['api_endpoint']))
                    ->setWidth(ZBX_TEXTAREA_STANDARD_WIDTH)
                    ->setAttribute('data-provider', $provider)
                    ->setAttribute('placeholder', 'https://api.example.com/...')
                    ->addClass('provider-field'),
                (new CTag('span', true, _('The base URL for API requests')))
                    ->addClass('ai-field-help')
            ])
        ])
        ->addItem([
            new CLabel(_('API Key'), $provider . '_api_key'),
            new CFormField([
                (new CTextBox($provider . '_api_key', $config[$provider]['api_key']))
                    ->setWidth(ZBX_TEXTAREA_BIG_WIDTH)
                    ->setAttribute('type', 'password')
                    ->setAttribute('data-provider', $provider)
                    ->setAttribute('placeholder', _('Enter your API key'))
                    ->addClass('provider-field'),
                (new CTag('span', true, _('Keep your API key secure and never share it')))
                    ->addClass('ai-field-help')
            ])
        ])
        ->addItem([
            new CLabel(_('Default Model'), $provider . '_default_model'),
            new CFormField([
                (new CTextBox($provider . '_default_model', $config[$provider]['default_model']))
                    ->setWidth(ZBX_TEXTAREA_MEDIUM_WIDTH)
                    ->setAttribute('data-provider', $provider)
                    ->setAttribute('placeholder', 'gpt-4o')
                    ->addClass('provider-field'),
                (new CTag('span', true, _('Model to use for requests (e.g., gpt-4o, claude-3-5-sonnet)')))
                    ->addClass('ai-field-help')
            ])
        ])
        ->addItem([
            new CLabel(_('Temperature'), $provider . '_temperature'),
            new CFormField([
                (new CTextBox($provider . '_temperature', $config[$provider]['temperature']))
                    ->setWidth(ZBX_TEXTAREA_TINY_WIDTH)
                    ->setAttribute('data-provider', $provider)
                    ->setAttribute('placeholder', '0.7')
                    ->addClass('provider-field'),
                (new CTag('span', true, _('Creativity level: 0 (focused) to 1 (creative)')))
                    ->addClass('ai-field-help')
            ])
        ])
        ->addItem([
            new CLabel(_('Max Tokens'), $provider . '_max_tokens'),
            new CFormField([
                (new CTextBox($provider . '_max_tokens', $config[$provider]['max_tokens']))
                    ->setWidth(ZBX_TEXTAREA_TINY_WIDTH)
                    ->setAttribute('data-provider', $provider)
                    ->setAttribute('placeholder', '1000')
                    ->addClass('provider-field'),
                (new CTag('span', true, _('Maximum length of AI response')))
                    ->addClass('ai-field-help')
            ])
        ]);
    
    return (new CDiv())
        ->addItem($info_box)
        ->addItem($form);
}

// Helper function to create General Settings tab
function createGeneralSettingsTab($config) {
    $default_provider = $config['default_provider'] ?? 'openai';
    $quick_actions = $config['quick_actions'] ?? [
        'problems' => true,
        'triggers' => true,
        'items' => true,
        'hosts' => true
    ];
    
    // Get enabled providers for the dropdown
    $enabled_providers = [];
    $provider_keys = ['openai', 'github', 'anthropic', 'gemini', 'deepseek', 'mistral', 'groq', 'custom'];
    
    $provider_labels = [
        'openai' => 'OpenAI',
        'github' => 'GitHub Models',
        'anthropic' => 'Anthropic (Claude)',
        'gemini' => 'Google Gemini',
        'deepseek' => 'DeepSeek',
        'mistral' => 'Mistral AI',
        'groq' => 'Groq',
        'custom' => 'Custom'
    ];
    
    foreach ($provider_keys as $provider) {
        if (isset($config[$provider]) && !empty($config[$provider]['enabled'])) {
            $enabled_providers[] = $provider;
        }
    }
    
    // If no providers enabled, show all
    if (empty($enabled_providers)) {
        $enabled_providers = $provider_keys;
    }
    
    $container = new CDiv();
    
    // Info box
    $info_box = (new CDiv())
        ->addClass('ai-info-box')
        ->addItem(new CTag('strong', true, '⚙️ ' . _('General Settings')))
        ->addItem(new CTag('br'))
        ->addItem(_('Configure default AI provider and enable/disable Quick Actions on monitoring pages'));
    
    $container->addItem($info_box);
    
    // Default Provider Section
    $default_provider_section = (new CDiv())
        ->addClass('general-settings-section');
    
    $default_provider_section->addItem(new CTag('h3', true, _('Default AI Provider')));
    
    // Create CSelect with proper CSelectOption objects
    $provider_select = new CSelect('default_provider');
    
    foreach ($enabled_providers as $provider) {
        $provider_select->addOption(
            new CSelectOption($provider, $provider_labels[$provider])
        );
    }
    
    $provider_select->setValue($default_provider);
    $provider_select->setWidth(ZBX_TEXTAREA_MEDIUM_WIDTH);
    
    $default_provider_form = (new CFormGrid())
        ->addItem([
            new CLabel(_('Default Provider'), 'default_provider'),
            new CFormField([
                $provider_select,
                (new CTag('span', true, _('This provider will be used by default in Quick Actions and AI Collab')))
                    ->addClass('ai-field-help')
            ])
        ]);
    
    $default_provider_section->addItem($default_provider_form);
    $container->addItem($default_provider_section);
    
    // Quick Actions Section
    $quick_actions_section = (new CDiv())
        ->addClass('general-settings-section');
    
    $quick_actions_section->addItem(new CTag('h3', true, _('Quick Actions')));
    
    $description = (new CDiv(_('Enable AI-powered quick actions on monitoring pages. These add contextual AI analysis buttons to Problems, Latest Data, Triggers, and Hosts.')))
        ->addClass('general-settings-description');
    
    $quick_actions_section->addItem($description);
    
    $checkbox_group = new CDiv();
    $checkbox_group->addClass('checkbox-group');
    
    $qa_options = [
        'problems' => ['label' => _('Problems Page'), 'description' => _('Add AI analysis button to each problem with enriched context')],
        'items' => ['label' => _('Latest Data Page'), 'description' => _('Add anomaly detection and statistical analysis for items')],
        'triggers' => ['label' => _('Triggers Form'), 'description' => _('Enable natural language trigger generation')],
        'hosts' => ['label' => _('Hosts Form'), 'description' => _('Add host health dashboard and AI insights')]
    ];
    
    foreach ($qa_options as $key => $option) {
        $checkbox_item = new CDiv();
        $checkbox_item->addClass('checkbox-item');
        
        $checkbox = (new CCheckBox('qa_' . $key, '1'))
            ->setChecked(!empty($quick_actions[$key]))
            ->setId('qa_' . $key);
        
        $label_content = [
            new CTag('strong', true, $option['label']),
            new CTag('br'),
            (new CTag('span', true, $option['description']))->addClass('checkbox-label-description')
        ];
        
        $label = new CLabel($label_content, 'qa_' . $key);
        
        $checkbox_item->addItem($checkbox);
        $checkbox_item->addItem($label);
        
        $checkbox_group->addItem($checkbox_item);
    }
    
    $quick_actions_section->addItem($checkbox_group);
    $container->addItem($quick_actions_section);
    
    return $container;
}

// Header section
$header = (new CDiv())
    ->addClass('ai-config-header')
    ->addItem(new CTag('h2', true, '🤖 ' . _('AI Integration Configuration')))
    ->addItem(new CTag('p', true, _('Configure AI providers and enable intelligent monitoring capabilities')));

// Provider tabs
$provider_tabs = new CTabView();

// Add General Settings tab FIRST
$provider_tabs->addTab('general', '⚙️ ' . _('General Settings'), createGeneralSettingsTab($data['config']));

// Add provider tabs
$provider_tabs->addTab('openai', '⚡ OpenAI', createProviderForm('openai', $data['config']));
$provider_tabs->addTab('github', '🐙 GitHub', createProviderForm('github', $data['config']));
$provider_tabs->addTab('anthropic', '🧠 Anthropic', createProviderForm('anthropic', $data['config']));
$provider_tabs->addTab('gemini', '🔷 Gemini', createProviderForm('gemini', $data['config']));
$provider_tabs->addTab('deepseek', '🔮 DeepSeek', createProviderForm('deepseek', $data['config']));
$provider_tabs->addTab('mistral', '🌪️ Mistral', createProviderForm('mistral', $data['config']));
$provider_tabs->addTab('groq', '⚡ Groq', createProviderForm('groq', $data['config']));
$provider_tabs->addTab('custom', '🛠️ Custom', createProviderForm('custom', $data['config']));

// Set active tab (default to general)
$provider_tabs->setSelected(0);

// Test result div
$test_result_div = (new CDiv())
    ->setId('test_result')
    ->addClass('ai-test-result');

// Main form
$form = (new CForm())
    ->setId('ai_config_form')
    ->setName('ai_config')
    ->addItem((new CInput('hidden', 'provider', $data['provider'] ?? 'openai'))->setId('provider'))
    ->addItem((new CInput('hidden', 'api_endpoint', ''))->setId('api_endpoint'))
    ->addItem((new CInput('hidden', 'api_key', ''))->setId('api_key'))
    ->addItem((new CInput('hidden', 'default_model', ''))->setId('default_model'))
    ->addItem((new CInput('hidden', 'temperature', ''))->setId('temperature'))
    ->addItem((new CInput('hidden', 'max_tokens', ''))->setId('max_tokens'))
    ->addItem((new CInput('hidden', 'enabled', ''))->setId('enabled'))
    ->addItem($provider_tabs)
    ->addItem($test_result_div);

// Form buttons
$button_list = (new CDiv())
    ->addClass('ai-button-group')
    ->addItem(new CSubmit('save', '💾 ' . _('Save Configuration')))
    ->addItem((new CButton('test', '🔌 ' . _('Test Connection')))->addClass(ZBX_STYLE_BTN_ALT))
    ->addItem((new CButton('cancel', _('Cancel')))->addClass(ZBX_STYLE_BTN_ALT));

$form->addItem($button_list);

// Create page
$page = new CHtmlPage();
$page->setTitle('');

// Output custom CSS
echo $custom_css;

$page->addItem($header);

// Show message if exists
if ($data['message']) {
    $message_type = ($data['message_type'] === 'success') ? 'success' : 'error';
    $icon = ($data['message_type'] === 'success') ? '✅ ' : '❌ ';
    
    $message_box = (new CDiv($icon . $data['message']))
        ->addClass('ai-info-box')
        ->addClass($message_type);
    
    $page->addItem($message_box);
}

$page->addItem($form);

// JavaScript for handling tab changes, save, and test
?>
<script>
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('ai_config_form');
    const providerInput = document.getElementById('provider');
    const tabButtons = document.querySelectorAll('.tabs-nav button');
    
    // Track current tab
    let currentTab = 'general';
    
    // Handle tab changes
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabId = this.getAttribute('data-target');
            if (tabId) {
                currentTab = tabId;
                providerInput.value = tabId;
            }
        });
    });
    
    // Handle Save button
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (currentTab === 'general') {
            saveGeneralSettings();
        } else {
            saveProviderConfig(currentTab);
        }
    });
    
    // Handle Test button
    const testBtn = document.querySelector('button[name="test"]');
    if (testBtn) {
        testBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (currentTab !== 'general') {
                testConnection(currentTab);
            }
        });
    }
    
    // Save provider configuration
    function saveProviderConfig(provider) {
        const endpoint = document.querySelector(`input[name="${provider}_api_endpoint"]`)?.value || '';
        const apiKey = document.querySelector(`input[name="${provider}_api_key"]`)?.value || '';
        const model = document.querySelector(`input[name="${provider}_default_model"]`)?.value || '';
        const temperature = document.querySelector(`input[name="${provider}_temperature"]`)?.value || '0.7';
        const maxTokens = document.querySelector(`input[name="${provider}_max_tokens"]`)?.value || '1000';
        const enabled = document.querySelector(`input[name="${provider}_enabled"]`)?.checked ? '1' : '';
        
        const formData = new URLSearchParams();
        formData.append('provider', provider);
        formData.append('api_endpoint', endpoint);
        formData.append('api_key', apiKey);
        formData.append('default_model', model);
        formData.append('temperature', temperature);
        formData.append('max_tokens', maxTokens);
        if (enabled) formData.append('enabled', enabled);
        formData.append('save', '1');
        
        showMessage('Saving...', 'info');
        
        fetch('zabbix.php?action=aiintegration.config', {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: formData.toString()
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showMessage(data.message, 'success');
            } else {
                showMessage(data.message || 'Save failed', 'error');
            }
        })
        .catch(error => {
            showMessage('Network error: ' + error.message, 'error');
        });
    }
    
    // Save general settings
    function saveGeneralSettings() {
        const defaultProvider = document.querySelector('select[name="default_provider"]')?.value || 'openai';
        const qaProblems = document.getElementById('qa_problems')?.checked ? '1' : '';
        const qaItems = document.getElementById('qa_items')?.checked ? '1' : '';
        const qaTriggers = document.getElementById('qa_triggers')?.checked ? '1' : '';
        const qaHosts = document.getElementById('qa_hosts')?.checked ? '1' : '';
        
        const formData = new URLSearchParams();
        formData.append('default_provider', defaultProvider);
        if (qaProblems) formData.append('qa_problems', qaProblems);
        if (qaItems) formData.append('qa_items', qaItems);
        if (qaTriggers) formData.append('qa_triggers', qaTriggers);
        if (qaHosts) formData.append('qa_hosts', qaHosts);
        formData.append('save_general', '1');
        
        showMessage('Saving...', 'info');
        
        fetch('zabbix.php?action=aiintegration.config', {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: formData.toString()
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showMessage(data.message, 'success');
            } else {
                showMessage(data.message || 'Save failed', 'error');
            }
        })
        .catch(error => {
            showMessage('Network error: ' + error.message, 'error');
        });
    }
    
    // Test connection
    function testConnection(provider) {
        const endpoint = document.querySelector(`input[name="${provider}_api_endpoint"]`)?.value || '';
        const apiKey = document.querySelector(`input[name="${provider}_api_key"]`)?.value || '';
        
        if (!apiKey) {
            showMessage('Please enter an API key first', 'error');
            return;
        }
        
        const formData = new URLSearchParams();
        formData.append('provider', provider);
        formData.append('api_endpoint', endpoint);
        formData.append('api_key', apiKey);
        formData.append('test', '1');
        
        showMessage('Testing connection...', 'info');
        
        fetch('zabbix.php?action=aiintegration.config', {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: formData.toString()
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showMessage(data.message, 'success');
            } else {
                showMessage(data.message || 'Test failed', 'error');
            }
        })
        .catch(error => {
            showMessage('Network error: ' + error.message, 'error');
        });
    }
    
    // Show message
    function showMessage(message, type) {
        const testResult = document.getElementById('test_result');
        testResult.textContent = message;
        testResult.className = 'ai-test-result ai-info-box show ' + type;
        
        setTimeout(() => {
            testResult.classList.remove('show');
        }, 5000);
    }
});
</script>

<?php
$page->show();
?>
