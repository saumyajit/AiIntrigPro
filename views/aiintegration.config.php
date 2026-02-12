<?php
/**
 * @var CView $this
 * @var array $data
 */

$title = _('AI Integration Configuration');

// Add custom CSS using style tag in page
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
	.form-grid .form-field input[type="password"] {
		border: 1px solid #d1d5db;
		border-radius: 4px;
		padding: 8px 12px;
	}
	.form-grid .form-field input[type="text"]:focus,
	.form-grid .form-field input[type="password"]:focus {
		border-color: #667eea;
		outline: none;
		box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
	}
</style>';

// Header section
$header = (new CDiv())
	->addClass('ai-config-header')
	->addItem(new CTag('h2', true, '🤖 ' . _('AI Integration Configuration')))
	->addItem(new CTag('p', true, _('Configure AI providers to enable intelligent monitoring and analysis capabilities')));

// Provider tabs
$provider_tabs = new CTabView();

// Helper function to create form fields
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
		'mistral' => _('High-performance open and commercial models focused on efficiency and strong reasoning'),
		'groq' => _('Ultra-fast inference with LLaMA, Mixtral, Gemma models'),
		'custom' => _('Use any OpenAI-compatible or custom AI endpoint')
	];
	
	// Ensure provider exists in config, use defaults if not
	if (!isset($config[$provider])) {
		$config[$provider] = [
			'api_endpoint' => '',
			'default_model' => '',
			'temperature' => '0.7',
			'max_tokens' => '1000',
			'api_key' => ''
		];
		
		// Set defaults based on provider
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
			case 'custom':
				$config[$provider]['api_endpoint'] = '';
				$config[$provider]['default_model'] = '';
				break;
		}
	}
	
	$info_box = (new CDiv())
		->addClass('ai-info-box')
		->addItem(new CTag('strong', true, '💡 ' . _('About ') . $provider_names[$provider]))
		->addItem(new CTag('br'))
		->addItem($provider_info[$provider] ?? '');
	
	$form = (new CFormGrid())
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

// Add tabs for each provider
$provider_tabs->addTab('openai', '⚡ OpenAI', createProviderForm('openai', $data['config']));
$provider_tabs->addTab('github', '🐙 GitHub', createProviderForm('github', $data['config']));
$provider_tabs->addTab('anthropic', '🧠 Anthropic', createProviderForm('anthropic', $data['config']));
$provider_tabs->addTab('gemini', '🔷 Google Gemini', createProviderForm('gemini', $data['config']));
$provider_tabs->addTab('deepseek', '🔮 DeepSeek', createProviderForm('deepseek', $data['config']));
$provider_tabs->addTab('mistral', '🌪️ Mistral AI', createProviderForm('mistral', $data['config']));
$provider_tabs->addTab('groq', '⚡ Groq', createProviderForm('groq', $data['config']));
$provider_tabs->addTab('custom', '🛠️ Custom', createProviderForm('custom', $data['config']));

// Set active tab
$provider_tabs->setSelected($data['provider'] ?? 'openai');

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
	->addItem($provider_tabs)
	->addItem($test_result_div);

// Form buttons with better styling
$button_list = (new CDiv())
	->addClass('ai-button-group')
	->addItem(new CSubmit('save', '💾 ' . _('Save Configuration')))
	->addItem((new CButton('test', '🔌 ' . _('Test Connection')))->addClass(ZBX_STYLE_BTN_ALT))
	->addItem((new CButton('cancel', _('Cancel')))->addClass(ZBX_STYLE_BTN_ALT));

$form->addItem($button_list);

// Create page
$page = new CHtmlPage();
$page->setTitle(''); // Empty title to remove default header

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
$page->show();
?>

<script type="text/javascript">
jQuery(document).ready(function($) {
    'use strict';

    function getActiveProvider() {
        // Zabbix tabs use aria-controls
        var $activeTab = $('#tabs ul li.ui-tabs-active');

        if ($activeTab.length) {
            return $activeTab.attr('aria-controls');
        }

        // fallback
        return $('#provider').val() || 'openai';
    }

    function syncHiddenFields(provider) {
        $('#provider').val(provider);
        $('#api_endpoint').val($('#' + provider + '_api_endpoint').val());
        $('#api_key').val($('#' + provider + '_api_key').val());
        $('#default_model').val($('#' + provider + '_default_model').val());
        $('#temperature').val($('#' + provider + '_temperature').val());
        $('#max_tokens').val($('#' + provider + '_max_tokens').val());

        console.log('Synced hidden fields for provider:', provider);
    }

    // Initial sync
    var currentProvider = getActiveProvider();
    syncHiddenFields(currentProvider);

    // On tab change
    $(document).on('tabsactivate', '#tabs', function(event, ui) {
        var provider = ui.newTab.attr('aria-controls');
        if (provider) {
            syncHiddenFields(provider);
            $('#test_result').removeClass('show');
        }
    });

    // On any field change
    $(document).on('keyup change', '.provider-field', function() {
        var provider = getActiveProvider();
        syncHiddenFields(provider);
    });

    // Save
    $(document).on('click', 'input[name="save"], button[name="save"]', function(e) {
        e.preventDefault();

        var provider = getActiveProvider();
        syncHiddenFields(provider);

        var $saveBtn = $('input[name="save"]');
        $saveBtn.prop('disabled', true).val('💾 <?php echo _('Saving...'); ?>');

        $.ajax({
            url: window.location.href,
            type: 'POST',
            dataType: 'json',
            data: $('#ai_config_form').serialize() + '&save=1',
            success: function(response) {
                var $result = $('#test_result');

                if (response.success) {
                    $result.removeClass('error').addClass('ai-info-box success show')
                        .html('✅ ' + response.message);
                } else {
                    $result.removeClass('success').addClass('ai-info-box error show')
                        .html('❌ ' + response.message);
                }

                $saveBtn.prop('disabled', false).val('💾 <?php echo _('Save Configuration'); ?>');
            },
            error: function(xhr, status, error) {
                alert('❌ Save failed: ' + error);
                $saveBtn.prop('disabled', false).val('💾 <?php echo _('Save Configuration'); ?>');
            }
        });
    });

    // Test
    $(document).on('click', 'button[name="test"]', function(e) {
        e.preventDefault();

        var provider = getActiveProvider();
        syncHiddenFields(provider);

        var $button = $(this);
        var $result = $('#test_result');

        $button.prop('disabled', true).html('⏳ <?php echo _('Testing...'); ?>');
        $result.removeClass('show ai-info-box success error').html('');

        $.ajax({
            url: window.location.href,
            type: 'POST',
            dataType: 'json',
            data: $('#ai_config_form').serialize() + '&test=1',
            success: function(response) {
                if (response.success) {
                    $result.addClass('ai-info-box success show')
                        .html('✅ ' + response.message);
                } else {
                    $result.addClass('ai-info-box error show')
                        .html('❌ ' + response.message);
                }

                $button.prop('disabled', false).html('🔌 <?php echo _('Test Connection'); ?>');
            },
            error: function(xhr, status, error) {
                $result.addClass('ai-info-box error show')
                    .html('❌ Test failed: ' + error);

                $button.prop('disabled', false).html('🔌 <?php echo _('Test Connection'); ?>');
            }
        });
    });

    // Cancel
    $(document).on('click', 'button[name="cancel"]', function(e) {
        e.preventDefault();
        window.history.back();
    });

});
</script>
