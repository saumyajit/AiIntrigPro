<?php
/**
 * @var CView $this
 * @var array $data
 */

$title = _('AI Collaboration');

// Add enhanced CSS with markdown support
$custom_css = '
<style>
	.ai-collab-header {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		padding: 20px;
		border-radius: 8px;
		margin-bottom: 20px;
		color: white;
		text-align: center;
		box-shadow: 0 4px 6px rgba(0,0,0,0.1);
	}
	.ai-collab-header h2 {
		margin: 0;
		font-size: 24px;
		font-weight: 600;
	}
	.ai-collab-header p {
		margin: 5px 0 0 0;
		opacity: 0.9;
		font-size: 14px;
	}
	
	/* Chat Container */
	.chat-container {
		height: 500px;
		overflow-y: auto;
		border: 2px solid #e5e7eb;
		border-radius: 12px;
		padding: 20px;
		background: linear-gradient(to bottom, #f9fafb 0%, #ffffff 100%);
		margin: 15px 0;
		scroll-behavior: smooth;
		box-shadow: inset 0 2px 4px rgba(0,0,0,0.06);
	}
	
	/* Message Styling */
	.chat-message {
		margin-bottom: 20px;
		display: flex;
		animation: slideIn 0.4s ease-out;
	}
	@keyframes slideIn {
		from { opacity: 0; transform: translateY(15px); }
		to { opacity: 1; transform: translateY(0); }
	}
	.chat-message.user { justify-content: flex-end; }
	.chat-message.assistant { justify-content: flex-start; }
	
	.message-bubble {
		max-width: 75%;
		padding: 14px 18px;
		border-radius: 16px;
		box-shadow: 0 2px 8px rgba(0,0,0,0.08);
		position: relative;
	}
	.chat-message.user .message-bubble {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border-bottom-right-radius: 4px;
	}
	.chat-message.assistant .message-bubble {
		background: white;
		color: #1f2937;
		border-bottom-left-radius: 4px;
		border: 1px solid #e5e7eb;
	}
	
	.message-header {
		font-weight: 600;
		font-size: 13px;
		margin-bottom: 8px;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.message-content {
		line-height: 1.7;
		word-wrap: break-word;
	}
	/* User (sent) messages */
	.chat-message.user .message-content {
		font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
		font-size: 14px;
	}
	
	/* Assistant (received) messages */
	.chat-message.assistant .message-content {
		font-family: "Trebuchet MS", Arial, sans-serif;
		font-size: 14px;
	}	
	.message-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 8px;
		font-size: 11px;
		opacity: 0.7;
	}
	.message-time {
		font-size: 11px;
	}
	.message-actions {
		display: flex;
		gap: 8px;
		opacity: 0;
		transition: opacity 0.2s;
	}
	.chat-message:hover .message-actions {
		opacity: 1;
	}
	.message-action-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 4px 8px;
		border-radius: 4px;
		transition: background 0.2s;
		font-size: 12px;
	}
	.chat-message.user .message-action-btn:hover {
		background: rgba(255,255,255,0.2);
	}
	.chat-message.assistant .message-action-btn:hover {
		background: rgba(0,0,0,0.05);
	}
	
	/* Markdown Styling */
	.message-content p {
		margin: 8px 0;
	}
	.message-content p:first-child {
		margin-top: 0;
	}
	.message-content p:last-child {
		margin-bottom: 0;
	}
	.message-content strong {
		font-weight: 600;
	}
	.message-content em {
		font-style: italic;
	}
	.message-content code {
		background: rgba(0,0,0,0.06);
		padding: 2px 6px;
		border-radius: 4px;
		font-family: "Courier New", monospace;
		font-size: 0.9em;
	}
	.chat-message.user .message-content code {
		background: rgba(255,255,255,0.2);
	}
	.message-content pre {
		background: #1e293b;
		color: #e2e8f0;
		padding: 12px;
		border-radius: 8px;
		overflow-x: auto;
		margin: 10px 0;
		position: relative;
	}
	.message-content pre code {
		background: none;
		padding: 0;
		color: inherit;
	}
	.code-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 12px;
		background: #0f172a;
		border-radius: 8px 8px 0 0;
		margin: 10px 0 0 0;
	}
	.code-language {
		color: #94a3b8;
		font-size: 12px;
		font-weight: 500;
	}
	.copy-code-btn {
		background: #334155;
		color: #e2e8f0;
		border: none;
		padding: 4px 12px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		transition: background 0.2s;
	}
	.copy-code-btn:hover {
		background: #475569;
	}
	.copy-code-btn.copied {
		background: #10b981;
	}
	.message-content ul, .message-content ol {
		margin: 8px 0;
		padding-left: 24px;
	}
	.message-content li {
		margin: 4px 0;
	}
	.message-content a {
		color: #2563eb;
		text-decoration: underline;
	}
	.chat-message.user .message-content a {
		color: #bfdbfe;
	}
	.message-content blockquote {
		border-left: 3px solid #e5e7eb;
		padding-left: 12px;
		margin: 8px 0;
		color: #6b7280;
	}
	
	/* Input Area */
	.input-section {
		background: white;
		border: 2px solid #e5e7eb;
		border-radius: 12px;
		padding: 16px;
		box-shadow: 0 2px 8px rgba(0,0,0,0.06);
	}
	.chat-input-container {
		position: relative;
		margin-bottom: 12px;
	}
	.chat-input-container textarea {
		border: 2px solid #e5e7eb;
		border-radius: 10px;
		padding: 12px 16px;
		resize: both;
		min-width: 1250px;
		max-width: 100%;
		min-height: 80px;
		max-height: 300px;
		transition: all 0.2s;
		font-size: 14px;
		line-height: 1.5;
	}
	.chat-input-container textarea:focus {
		border-color: #667eea;
		outline: none;
		box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
	}
	
	/* Buttons */
	.chat-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.action-buttons-left {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.action-buttons-right {
		display: flex;
		gap: 8px;
	}
	.quick-action-btn {
		padding: 6px 12px;
		border: 1px solid #e5e7eb;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border-radius: 6px;
		cursor: pointer;
		font-size: 12px;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		gap: 4px;
	}
/*
	.quick-action-btn:hover {
		background: #f3f4f6;
		border-color: #d1d5db;
	}
*/
	.send-btn {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border: none;
		padding: 20px px;
		border-radius: 8px;
		cursor: pointer;
		font-weight: 600;
		transition: transform 0.2s;
		box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
	}
/*
	.send-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
	}
*/
	.send-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
	}
	
	/* Provider Selector */
	.provider-section {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		background: white;
		border-radius: 10px;
		box-shadow: 0 2px 8px rgba(0,0,0,0.06);
		margin-bottom: 16px;
		border: 1px solid #e5e7eb;
	}
	.provider-selector-wrapper {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.provider-selector-wrapper label {
		font-weight: 600;
		color: #374151;
		font-size: 14px;
	}
	.provider-selector-wrapper select {
		border: 1px solid #d1d5db;
		border-radius: 8px;
		padding: 8px 36px 8px 12px;
		font-size: 14px;
		cursor: pointer;
		transition: border-color 0.2s;
	}
	.provider-selector-wrapper select:focus {
		border-color: #667eea;
		outline: none;
	}
	.export-btn {
		padding: 2px px;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		cursor: pointer;
		font-size: 13px;
		transition: all 0.2s;
	}
/*
	.export-btn:hover {
		background: #f9fafb;
		border-color: #9ca3af;
	}
*/
	/* Empty State */
	.empty-chat {
		text-align: center;
		padding: 80px 20px;
		color: #6b7280;
	}
	.empty-chat-icon {
		font-size: 72px;
		margin-bottom: 24px;
		opacity: 0.4;
		animation: float 3s ease-in-out infinite;
	}
	@keyframes float {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(-10px); }
	}
	.empty-chat-text {
		font-size: 18px;
		margin-bottom: 12px;
		font-weight: 500;
	}
	.empty-chat-hint {
		font-size: 14px;
		color: #9ca3af;
		margin-bottom: 24px;
	}
	.suggested-prompts {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		justify-content: center;
		margin-top: 20px;
		max-width: 600px;
		margin-left: auto;
		margin-right: auto;
	}
	.prompt-suggestion {
		padding: 8px 16px;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 20px;
		cursor: pointer;
		font-size: 13px;
		transition: all 0.2s;
	}
	.prompt-suggestion:hover {
		background: #667eea;
		color: white;
		border-color: #667eea;
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(102, 126, 234, 0.2);
	}
	
	/* Typing Indicator */
	.typing-indicator {
		display: none;
		padding: 12px 16px;
		background: white;
		border-radius: 16px;
		border: 1px solid #e5e7eb;
		max-width: 70%;
		margin-bottom: 16px;
		box-shadow: 0 2px 8px rgba(0,0,0,0.08);
	}
	.typing-indicator.show {
		display: block;
		animation: slideIn 0.3s ease-out;
	}
	.typing-indicator span {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #667eea;
		margin: 0 3px;
		animation: bounce 1.4s infinite;
	}
	.typing-indicator span:nth-child(2) {
		animation-delay: 0.2s;
	}
	.typing-indicator span:nth-child(3) {
		animation-delay: 0.4s;
	}
	@keyframes bounce {
		0%, 60%, 100% { transform: translateY(0); }
		30% { transform: translateY(-8px); }
	}
	
	/* Token Usage */
	.token-usage {
		font-size: 11px;
		color: #6b7280;
		padding: 4px 8px;
		background: rgba(0,0,0,0.05);
		border-radius: 4px;
	}
	.chat-message.user .token-usage {
		background: rgba(255,255,255,0.2);
		color: rgba(255,255,255,0.9);
	}
	
	/* Alert Messages */
	.ai-alert {
		position: sticky;
		top: 10px;
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 12px 16px;
		border-radius: 8px;
		margin-bottom: 15px;
		animation: slideIn 0.3s ease-out;
		box-shadow: 0 4px 12px rgba(0,0,0,0.1);
	}
	.ai-alert.success {
		background: #ecfdf5;
		border-left: 4px solid #10b981;
		color: #065f46;
	}
	.ai-alert.error {
		background: #fef2f2;
		border-left: 4px solid #ef4444;
		color: #7f1d1d;
	}
	.ai-alert .close-btn {
		cursor: pointer;
		font-weight: bold;
		font-size: 18px;
		opacity: 0.6;
		line-height: 1;
	}
	.ai-alert .close-btn:hover {
		opacity: 1;
	}
	
	/* Scrollbar Styling */
	.chat-container::-webkit-scrollbar {
		width: 8px;
	}
	.chat-container::-webkit-scrollbar-track {
		background: #f1f5f9;
		border-radius: 10px;
	}
	.chat-container::-webkit-scrollbar-thumb {
		background: #cbd5e1;
		border-radius: 10px;
	}
	.chat-container::-webkit-scrollbar-thumb:hover {
		background: #94a3b8;
	}
</style>';

// Link to markdown parsing library
echo '<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>';
echo '<script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js"></script>';

echo $custom_css;

// Header
$header = (new CDiv())
	->addClass('ai-collab-header')
	->addItem(new CTag('h2', true, '💬 ' . _('AI Collaboration')))
	->addItem(new CTag('p', true, _('An AI-powered assistant for Zabbix that explains alerts, analyzes monitored data, provides remediation guidance, and delivers configuration insights and reports for hosts and infrastructure.')));

// Check if AI is configured
if (!$data['config']) {
	$widget = (new CHtmlPage())
		->setTitle('')
		->addItem($header)
		->addItem(
			(new CDiv())
				->addClass('ai-alert error')
				->addItem('⚠️ ' . _('AI Integration is not configured. Please configure it in Administration > AI Integration.'))
		);
	$widget->show();
	return;
}

// Provider section with export
$provider_section = (new CDiv())
	->addClass('provider-section')
	->addItem(
		(new CDiv())
			->addClass('provider-selector-wrapper')
			->addItem(new CTag('label', true, '🤖 ' . _('AI Provider:')))
			->addItem(
				(new CSelect('provider'))
					->setId('provider_select')
					->addOptions(CSelect::createOptionsFromArray([
						'openai' => _('OpenAI (GPT)'),
						'github' => _('GitHub Models'),
						'anthropic' => _('Anthropic (Claude)'),
						'google' => _('Google Gemini'),
						'deepseek' => _('DeepSeek'),
						'mistral' => _('Mistral AI'),
						'groq' => _('Groq'),
						'custom' => _('Custom')
					]))
					->setValue('openai')
			)
	)
	->addItem(
		(new CButton('export', '📥 ' . _('Export Chat')))
			->addClass('export-btn')
			->setAttribute('title', _('Export conversation as text'))
	);

// Chat container
$chat_container = (new CDiv())
	->setId('chat_container')
	->addClass('chat-container');

// Add existing chat history or empty state with suggestions
if (!empty($data['chat_history'])) {
	foreach ($data['chat_history'] as $msg) {
		$role_class = ($msg['role'] === 'user') ? 'user' : 'assistant';
		$role_label = ($msg['role'] === 'user') ? _('You') : _('AI Assistant');
		$icon = ($msg['role'] === 'user') ? '👤' : '🤖';
		$time = date('H:i', $msg['timestamp']);
		
		$message_bubble = (new CDiv())
			->addClass('message-bubble')
			->addItem(
				(new CDiv($icon . ' ' . $role_label))
					->addClass('message-header')
			)
			->addItem(
				(new CDiv())
					->addClass('message-content')
					->setAttribute('data-raw-content', htmlspecialchars($msg['content']))
					->addItem(nl2br(htmlspecialchars($msg['content'])))
			)
			->addItem(
				(new CDiv())
					->addClass('message-footer')
					->addItem((new CDiv($time))->addClass('message-time'))
					->addItem(
						(new CDiv())
							->addClass('message-actions')
							->addItem(
								(new CButton('copy', '📋'))
									->addClass('message-action-btn copy-msg')
									->setAttribute('type', 'button')
									->setAttribute('title', _('Copy'))
							)
					)
			);
		
		$chat_container->addItem(
			(new CDiv($message_bubble))
				->addClass('chat-message')
				->addClass($role_class)
		);
	}
} else {
	// Empty state with suggestions
	$suggestions_container = (new CDiv())->addClass('suggested-prompts');
	
	$suggestions = [
		_('Explain this error message'),
		_('Analyze server metrics'),
		_('Suggest monitoring improvements'),
		_('Help with alert configuration'),
		_('Optimize trigger expressions')
	];
	
	foreach ($suggestions as $suggestion) {
		$suggestions_container->addItem(
			(new CDiv($suggestion))
				->addClass('prompt-suggestion')
				->setAttribute('data-prompt', $suggestion)
		);
	}
	
	$chat_container->addItem(
		(new CDiv())
			->addClass('empty-chat')
			->addItem((new CDiv('💬'))->addClass('empty-chat-icon'))
			->addItem((new CDiv(_('Start a new conversation')))->addClass('empty-chat-text'))
			->addItem((new CDiv(_('Ask me anything about monitoring, alerts, or system analysis')))->addClass('empty-chat-hint'))
			->addItem($suggestions_container)
	);
}

// Typing indicator
$typing_indicator = (new CDiv())
	->setId('typing_indicator')
	->addClass('typing-indicator')
	->addItem(new CTag('span'))
	->addItem(new CTag('span'))
	->addItem(new CTag('span'));

$chat_container->addItem($typing_indicator);

// Input section
$input_section = (new CDiv())
	->addClass('input-section');

$message_input = (new CTextArea('message', ''))
	->setId('message_input')
	->setWidth(ZBX_TEXTAREA_BIG_WIDTH)
	->setAttribute('rows', 3)
	->setAttribute('placeholder', _('Type your message here... (Press Enter to send, Shift+Enter for new line)'));

$input_section->addItem(
	(new CDiv())
		->addClass('chat-input-container')
		->addItem($message_input)
);

// Action buttons properly structured
$action_buttons_left = (new CDiv())
	->addClass('action-buttons-left')
	->addItem(
		(new CButton('summarize', '📝 ' . _('Summarize')))
			->addClass('quick-action-btn')
			->setAttribute('type', 'button')
			->setAttribute('data-action', 'summarize')
	)
	->addItem(
		(new CButton('explain', '💡 ' . _('Explain')))
			->addClass('quick-action-btn')
			->setAttribute('type', 'button')
			->setAttribute('data-action', 'explain')
	)
	->addItem(
		(new CButton('improve', '✨ ' . _('Improve')))
			->addClass('quick-action-btn')
			->setAttribute('type', 'button')
			->setAttribute('data-action', 'improve')
	);

$action_buttons_right = (new CDiv())
	->addClass('action-buttons-right')
	->addItem(
		(new CSubmit('send', '🚀 ' . _('Send Message')))
			->addClass('send-btn')
			->setId('send-btn')
	)	
	->addItem(
		(new CButton('clear', '🗑️ ' . _('Clear History')))
			->addClass('export-btn')
			->setAttribute('type', 'button')
			->setId('clear-btn')
	);

$input_section->addItem(
	(new CDiv())
		->addClass('chat-actions')
		->addItem($action_buttons_left)
		->addItem($action_buttons_right)
);

// Form
$form = (new CForm())
	->setId('ai_chat_form')
	->setName('ai_chat')
	->addItem($provider_section)
	->addItem($chat_container)
	->addItem($input_section);

// Create page
$page = new CHtmlPage();
$page->setTitle('');
$page->addItem($header);

if (isset($data['error'])) {
	$page->addItem(
		(new CDiv())
			->addClass('ai-alert error')
			->addItem('❌ ' . $data['error'])
			->addItem(
				(new CSpan('×'))
					->addClass('close-btn')
					->setAttribute('onclick', 'this.parentElement.remove();')
			)
	);
}

$page->addItem($form);
$page->show();
?>

<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js"></script>

<script type="text/javascript">
jQuery(document).ready(function($) {
	'use strict';

	// Markdown configuration
	if (typeof marked !== 'undefined') {
		marked.setOptions({
			breaks: true,
			gfm: true,
			highlight: function(code, lang) {
				return code; // Basic for now, can add syntax highlighting later
			}
		});
	}

	// Utility Functions
	function scrollToBottom(animated = true) {
		var $container = $('#chat_container');
		if ($container.length) {
			if (animated) {
				$container.animate({
					scrollTop: $container[0].scrollHeight
				}, 400);
			} else {
				$container.scrollTop($container[0].scrollHeight);
			}
		}
	}

	function formatMarkdown(text) {
		if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
			return text.replace(/\n/g, '<br>');
		}
		
		try {
			// Process code blocks specially
			text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, function(match, lang, code) {
				lang = lang || 'text';
				var codeId = 'code_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
				return '<div class="code-block">' +
					'<div class="code-header">' +
					'<span class="code-language">' + lang + '</span>' +
					'<button class="copy-code-btn" data-code-id="' + codeId + '">📋 Copy</button>' +
					'</div>' +
					'<pre><code id="' + codeId + '">' + escapeHtml(code.trim()) + '</code></pre>' +
					'</div>';
			});
			
			var html = marked.parse(text);
			return DOMPurify.sanitize(html);
		} catch (e) {
			console.error('Markdown parsing error:', e);
			return text.replace(/\n/g, '<br>');
		}
	}

	function escapeHtml(text) {
		var map = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#039;'
		};
		return text.replace(/[&<>"']/g, function(m) { return map[m]; });
	}

	function getCurrentTime() {
		var now = new Date();
		return now.toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'});
	}

	function addMessage(role, content, showTokens = false) {
		$('.empty-chat').remove();
		
		var roleClass = role === 'user' ? 'user' : 'assistant';
		var roleLabel = role === 'user' ? '<?php echo _('You'); ?>' : '<?php echo _('AI Assistant'); ?>';
		var icon = role === 'user' ? '👤' : '🤖';
		var time = getCurrentTime();
		var messageId = 'msg_' + Date.now();
		
		var messageHtml = 
			'<div class="chat-message ' + roleClass + '" id="' + messageId + '">' +
				'<div class="message-bubble">' +
					'<div class="message-header">' + icon + ' ' + roleLabel + '</div>' +
					'<div class="message-content">' + formatMarkdown(content) + '</div>' +
					'<div class="message-footer">' +
						'<div class="message-time">' + time + '</div>' +
						'<div class="message-actions">' +
							'<button class="message-action-btn copy-msg" title="<?php echo _('Copy'); ?>">📋</button>' +
						'</div>' +
					'</div>' +
				'</div>' +
			'</div>';
		
		$('#typing_indicator').before(messageHtml);
		scrollToBottom();
		
		return messageId;
	}

	function copyToClipboard(text) {
		if (navigator.clipboard) {
			navigator.clipboard.writeText(text).then(function() {
				showNotification('✅ <?php echo _('Copied to clipboard'); ?>', 'success');
			}).catch(function() {
				fallbackCopy(text);
			});
		} else {
			fallbackCopy(text);
		}
	}

	function fallbackCopy(text) {
		var $temp = $('<textarea>');
		$('body').append($temp);
		$temp.val(text).select();
		document.execCommand('copy');
		$temp.remove();
		showNotification('✅ <?php echo _('Copied to clipboard'); ?>', 'success');
	}

	function showNotification(message, type) {
		var $alert = $('<div class="ai-alert ' + type + '">' + message + '</div>');
		$('.ai-collab-header').after($alert);
		setTimeout(function() {
			$alert.fadeOut(function() { $(this).remove(); });
		}, 3000);
	}

	function exportChat() {
		var messages = [];
		$('.chat-message').each(function() {
			var $msg = $(this);
			var role = $msg.hasClass('user') ? 'You' : 'AI Assistant';
			var content = $msg.find('.message-content').text().trim();
			var time = $msg.find('.message-time').text().trim();
			messages.push(time + ' - ' + role + ':\n' + content + '\n');
		});
		
		if (messages.length === 0) {
			alert('<?php echo _('No messages to export'); ?>');
			return;
		}
		
		var text = '=== AI Collaboration Chat Export ===\n\n' + messages.join('\n---\n\n');
		var blob = new Blob([text], { type: 'text/plain' });
		var url = URL.createObjectURL(blob);
		var a = document.createElement('a');
		a.href = url;
		a.download = 'ai-chat-' + new Date().toISOString().slice(0,10) + '.txt';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		
		showNotification('✅ <?php echo _('Chat exported successfully'); ?>', 'success');
	}

	// Initial scroll
	scrollToBottom(false);

	// Suggested prompt clicks
	$(document).on('click', '.prompt-suggestion', function() {
		var prompt = $(this).data('prompt');
		$('#message_input').val(prompt).focus();
	});

	// Copy message
	$(document).on('click', '.copy-msg', function() {
		var $bubble = $(this).closest('.message-bubble');
		var text = $bubble.find('.message-content').text();
		copyToClipboard(text);
	});

	// Copy code block
	$(document).on('click', '.copy-code-btn', function() {
		var $btn = $(this);
		var codeId = $btn.data('code-id');
		var code = $('#' + codeId).text();
		
		copyToClipboard(code);
		
		$btn.text('✅ Copied!').addClass('copied');
		setTimeout(function() {
			$btn.text('📋 Copy').removeClass('copied');
		}, 2000);
	});

	// Quick actions
	$(document).on('click', '.quick-action-btn', function() {
		var action = $(this).data('action');
		var lastMessage = $('.chat-message.assistant:last .message-content').text().trim();
		
		if (!lastMessage) {
			alert('<?php echo _('No previous message to process'); ?>');
			return;
		}
		
		var prompts = {
			'summarize': '<?php echo _('Summarize the above in 2-3 sentences'); ?>',
			'explain': '<?php echo _('Explain the above in simpler terms'); ?>',
			'improve': '<?php echo _('Provide suggestions to improve this'); ?>'
		};
		
		$('#message_input').val(prompts[action]).focus();
	});

	// Export chat
	$(document).on('click', '#export-btn, button[name="export"]', function(e) {
		e.preventDefault();
		exportChat();
	});

	// Clear history
	$(document).on('click', '#clear-btn', function(e) {
		e.preventDefault();
		
		if (!confirm('<?php echo _('Are you sure you want to clear the chat history?'); ?>')) {
			return;
		}
		
		$.ajax({
			url: window.location.href,
			type: 'POST',
			dataType: 'json',
			data: { clear: '1' },
			success: function() {
				window.location.reload();
			},
			error: function(xhr, status, error) {
				alert('<?php echo _('Error clearing history'); ?>: ' + error);
			}
		});
	});

	// Send message
	$('#ai_chat_form').on('submit', function(e) {
		e.preventDefault();
		
		var message = $('#message_input').val().trim();
		var provider = $('#provider_select').val();
		
		if (!message) {
			$('#message_input').focus();
			return false;
		}
		
		var $sendBtn = $('#send-btn');
		$sendBtn.prop('disabled', true).html('⏳ <?php echo _('Sending...'); ?>');
		
		// Add user message
		addMessage('user', message, true);
		$('#message_input').val('').focus();
		
		// Show typing indicator
		$('#typing_indicator').addClass('show');
		scrollToBottom();
		
		$.ajax({
			url: window.location.href,
			type: 'POST',
			dataType: 'json',
			data: {
				message: message,
				provider: provider,
				send: '1'
			},
			success: function(response) {
				$('#typing_indicator').removeClass('show');
				
				if (response.success) {
					// Add AI response with markdown
					addMessage('assistant', response.message, true);
				} else {
					showNotification('❌ ' + response.error, 'error');
				}
				
				$sendBtn.prop('disabled', false).html('🚀 <?php echo _('Send Message'); ?>');
			},
			error: function(xhr, status, error) {
				$('#typing_indicator').removeClass('show');
				showNotification('❌ <?php echo _('Error sending message'); ?>: ' + error, 'error');
				$sendBtn.prop('disabled', false).html('🚀 <?php echo _('Send Message'); ?>');
			}
		});
		
		return false;
	});

	// Keyboard shortcuts
	$('#message_input').on('keydown', function(e) {
		// Enter to send (without Shift)
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			$('#ai_chat_form').submit();
		}
		
		// Ctrl/Cmd + K to focus
		if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
			e.preventDefault();
			$(this).focus();
		}
	});

	// Auto-resize textarea
	$('#message_input').on('input', function() {
		this.style.height = 'auto';
		this.style.height = Math.min(this.scrollHeight, 200) + 'px';
	});

	// Process existing messages to markdown
	setTimeout(function() {
		$('.message-content[data-raw-content]').each(function() {
			var $this = $(this);
			var raw = $this.attr('data-raw-content');
			$this.html(formatMarkdown(raw));
		});
	}, 100);
});
</script>
