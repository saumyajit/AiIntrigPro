<?php

namespace Modules\AIIntegration\Actions;

use CController;
use CControllerResponseData;
use CRoleHelper;
use Exception;
use Modules\AIIntegration\ConfigStorage;

class CControllerAICollab extends CController {

	protected function init(): void {
		$this->disableCsrfValidation();
	}

	protected function checkInput(): bool {
		$fields = [
			'message' => 'string',
			'provider' => 'string',
			'send' => 'in 1',
			'clear' => 'in 1'
		];

		$ret = $this->validateInput($fields);
		return $ret;
	}

	protected function checkPermissions(): bool {
		return $this->getUserType() >= USER_TYPE_ZABBIX_USER;
	}

	protected function doAction(): void {
		// Load AI config from file instead of session
		$config = ConfigStorage::load();
		
		// Handle clear history
		if ($this->hasInput('clear')) {
			$_SESSION['ai_chat_history'] = [];
			
			// Return JSON response instead of reloading
			header('Content-Type: application/json');
			echo json_encode(['success' => true]);
			exit;
		}
		
		// Initialize chat history
		if (!isset($_SESSION['ai_chat_history'])) {
			$_SESSION['ai_chat_history'] = [];
		}
		
		$data = [
			'config' => $config,
			'chat_history' => $_SESSION['ai_chat_history'],
			'response' => null,
			'error' => null
		];

		// Handle message submission
		if ($this->hasInput('send') && $this->hasInput('message')) {
			$message = $this->getInput('message');
			$provider = $this->getInput('provider', 'openai');
			
			if (!$config || !isset($config[$provider])) {
				// Return JSON error
				header('Content-Type: application/json');
				echo json_encode([
					'success' => false,
					'error' => _('Selected AI provider (' . $provider . ') is not configured. Please configure it in Administration > AI Integration.')
				]);
				exit;
			} elseif (empty($config[$provider]['api_key'])) {
				// Return JSON error
				header('Content-Type: application/json');
				echo json_encode([
					'success' => false,
					'error' => _('API Key not set for ' . $provider . '. Please configure it in Administration > AI Integration first.')
				]);
				exit;
			} else {
				// Send message to AI
				$ai_response = $this->sendToAI($provider, $config[$provider], $message);
				
				if ($ai_response['success']) {
					// Add to chat history
					$_SESSION['ai_chat_history'][] = [
						'role' => 'user',
						'content' => $message,
						'timestamp' => time()
					];
					$_SESSION['ai_chat_history'][] = [
						'role' => 'assistant',
						'content' => $ai_response['message'],
						'timestamp' => time()
					];
					
					// Return JSON success
					header('Content-Type: application/json');
					echo json_encode([
						'success' => true,
						'message' => $ai_response['message']
					]);
					exit;
				} else {
					// Return JSON error
					header('Content-Type: application/json');
					echo json_encode([
						'success' => false,
						'error' => $ai_response['error']
					]);
					exit;
				}
			}
		}

		$response = new CControllerResponseData($data);
		$response->setTitle(_('AI Collaboration'));
		$this->setResponse($response);
	}

	private function sendToAI(string $provider, array $config, string $message): array {
		try {
			$ch = curl_init();
			$headers = ['Content-Type: application/json'];
			
			switch ($provider) {
				case 'anthropic':
					$headers[] = 'x-api-key: ' . $config['api_key'];
					$headers[] = 'anthropic-version: 2023-06-01';
					$data = json_encode([
						'model' => $config['default_model'],
						'max_tokens' => intval($config['max_tokens']),
						'temperature' => floatval($config['temperature']),
						'messages' => [
							[
								'role' => 'user',
								'content' => $message
							]
						]
					]);
					break;
					
				case 'google':
					$endpoint = $config['api_endpoint'] . '/' . $config['default_model'] . ':generateContent?key=' . $config['api_key'];
					$data = json_encode([
						'contents' => [
							[
								'parts' => [
									['text' => $message]
								]
							]
						],
						'generationConfig' => [
							'temperature' => floatval($config['temperature']),
							'maxOutputTokens' => intval($config['max_tokens'])
						]
					]);
					curl_setopt($ch, CURLOPT_URL, $endpoint);
					break;
					
				default: // openai, deepseek, github, mistral, groq, custom (OpenAI-compatible)
					$headers[] = 'Authorization: Bearer ' . $config['api_key'];
					$data = json_encode([
						'model' => $config['default_model'],
						'messages' => [
							[
								'role' => 'user',
								'content' => $message
							]
						],
						'temperature' => floatval($config['temperature']),
						'max_tokens' => intval($config['max_tokens'])
					]);
					curl_setopt($ch, CURLOPT_URL, $config['api_endpoint']);
			}
			
			if ($provider !== 'google') {
				curl_setopt($ch, CURLOPT_URL, $config['api_endpoint']);
			}
			
			curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
			curl_setopt($ch, CURLOPT_POST, true);
			curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
			curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
			curl_setopt($ch, CURLOPT_TIMEOUT, 30);
			
			$response = curl_exec($ch);
			$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
			curl_close($ch);
			
			if ($http_code >= 200 && $http_code < 300) {
				$response_data = json_decode($response, true);
				
				// Extract message based on provider
				$ai_message = '';
				switch ($provider) {
					case 'anthropic':
						$ai_message = $response_data['content'][0]['text'] ?? 'No response';
						break;
					case 'google':
						$ai_message = $response_data['candidates'][0]['content']['parts'][0]['text'] ?? 'No response';
						break;
					default: // openai, deepseek
						$ai_message = $response_data['choices'][0]['message']['content'] ?? 'No response';
				}
				
				return [
					'success' => true,
					'message' => $ai_message
				];
			} else {
				return [
					'success' => false,
					'error' => _('AI API error: HTTP ') . $http_code . ' - ' . $response
				];
			}
		} catch (Exception $e) {
			return [
				'success' => false,
				'error' => _('Error: ') . $e->getMessage()
			];
		}
	}
}
