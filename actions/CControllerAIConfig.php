<?php

namespace Modules\AIIntegration\Actions;

use CController;
use CControllerResponseData;
use Exception;
use Modules\AIIntegration\ConfigStorage;

class CControllerAIConfig extends CController {

	protected function init(): void {
		$this->disableCsrfValidation();
	}

	protected function checkInput(): bool {
		$fields = [
			// Only static/known fields declared here.
			// Dynamic provider fields ({provider}_{field}) are read directly from
			// $_POST in doAction() — so adding a new provider needs zero changes here.
			'provider'         => 'string',
			'default_provider' => 'string',
			'qa_problems'      => 'string',
			'qa_items'         => 'string',
			'qa_triggers'      => 'string',
			'qa_hosts'         => 'string',
			// Generic fields for the Test Connection action
			'api_endpoint'     => 'string',
			'api_key'          => 'string',
			'default_model'    => 'string',
			'temperature'      => 'string',
			'max_tokens'       => 'string',
			'save'             => 'in 1',
			'test'             => 'in 1',
			'debug'            => 'in 1',
		];

		$ret = $this->validateInput($fields);
		
		return $ret;
	}

	protected function checkPermissions(): bool {
		return $this->getUserType() >= USER_TYPE_SUPER_ADMIN;
	}

	protected function doAction(): void {
		// Load config from file instead of session
		$config = ConfigStorage::load();

		$data = [
			'provider' => $this->getInput('provider', 'openai'),
			'config' => $config,
			'message' => null,
			'message_type' => null
		];

		// Handle DEBUG (for troubleshooting)
		if ($this->hasInput('debug')) {
			$module_dir = dirname(__DIR__);
			$data_dir = $module_dir . '/data';
			$config_file = $data_dir . '/config.json';
			
			$debug_info = [
				'module_dir' => $module_dir,
				'data_dir' => $data_dir,
				'config_file' => $config_file,
				'data_dir_exists' => is_dir($data_dir),
				'data_dir_writable' => is_writable($data_dir),
				'config_exists' => file_exists($config_file),
				'config_writable' => file_exists($config_file) ? is_writable($config_file) : 'N/A',
				'php_user' => get_current_user(),
				'data_dir_perms' => is_dir($data_dir) ? substr(sprintf('%o', fileperms($data_dir)), -4) : 'N/A',
			];
			
			if (file_exists($config_file)) {
				$debug_info['config_perms'] = substr(sprintf('%o', fileperms($config_file)), -4);
			}
			
			header('Content-Type: application/json');
			echo json_encode($debug_info, JSON_PRETTY_PRINT);
			exit;
		}

		// Handle SAVE
		if ($this->hasInput('save')) {
			$providers = ['openai', 'github', 'anthropic', 'gemini', 'deepseek', 'mistral', 'groq', 'custom'];

			// Read every provider's fields from $_POST by prefixed name.
			// $_POST is NOT modified by validateInput() so this is always safe.
			// New providers only need adding to $providers above — nothing else.
			foreach ($providers as $p) {
				$get = static function (string $key, string $default = '') use ($p): string {
					$v = $_POST[$p . '_' . $key] ?? null;
					return $v !== null ? trim(strip_tags((string) $v)) : $default;
				};
				$config[$p] = [
					'api_endpoint'  => $get('api_endpoint',  $config[$p]['api_endpoint']  ?? ''),
					'api_key'       => $get('api_key',       $config[$p]['api_key']       ?? ''),
					'default_model' => $get('default_model', $config[$p]['default_model'] ?? ''),
					'temperature'   => $get('temperature',   $config[$p]['temperature']   ?? '0.7'),
					'max_tokens'    => $get('max_tokens',    $config[$p]['max_tokens']    ?? '1000'),
					'enabled'       => (($_POST[$p . '_enabled'] ?? '0') === '1'),
				];
			}

			// General settings
			$config['default_provider'] = trim(strip_tags((string) ($_POST['default_provider'] ?? $config['default_provider'] ?? 'openai')));
			$config['quick_actions'] = [
				'problems' => (($_POST['qa_problems'] ?? '0') === '1'),
				'items'    => (($_POST['qa_items']    ?? '0') === '1'),
				'triggers' => (($_POST['qa_triggers'] ?? '0') === '1'),
				'hosts'    => (($_POST['qa_hosts']    ?? '0') === '1'),
			];

			// Save to file
			$saved = ConfigStorage::save($config);

			// Debug logging
			// error_log("AI Integration Save - All providers, Success: " . ($saved ? 'yes' : 'no'));
			error_log("AI Integration Save - Provider: $provider, Success: " . ($saved ? 'yes' : 'no'));
			
			// Return JSON response
			header('Content-Type: application/json');
			if ($saved) {
				echo json_encode([
					'success' => true,
					'message' => _('Configuration saved successfully!')
				]);
			} else {
				// Get more details about the failure
				$data_dir = dirname(__DIR__) . '/data';
				$config_file = $data_dir . '/config.json';
				
				$error_details = [];
				$error_details[] = 'Data dir exists: ' . (is_dir($data_dir) ? 'yes' : 'no');
				$error_details[] = 'Data dir writable: ' . (is_writable($data_dir) ? 'yes' : 'no');
				$error_details[] = 'Config exists: ' . (file_exists($config_file) ? 'yes' : 'no');
				if (file_exists($config_file)) {
					$error_details[] = 'Config writable: ' . (is_writable($config_file) ? 'yes' : 'no');
				}
				
				error_log("AI Integration Save Failed - " . implode(', ', $error_details));
				
				echo json_encode([
					'success' => false,
					'message' => _('Failed to save configuration. Check permissions on data directory and PHP error log.')
				]);
			}
			exit;
		}

		// Handle TEST
		if ($this->hasInput('test')) {
			$provider = $this->getInput('provider', 'openai');
			$endpoint = $this->getInput('api_endpoint', '');
			$api_key = $this->getInput('api_key', '');
			$model = $this->getInput('default_model', '');
			
			$test_result = $this->testAIConnection($provider, $endpoint, $api_key, $model);
			
			// Return JSON response
			header('Content-Type: application/json');
			echo json_encode($test_result);
			exit;
		}

		$response = new CControllerResponseData($data);
		$response->setTitle(_('AI Integration'));
		$this->setResponse($response);
	}

	private function testAIConnection(string $provider, string $endpoint, string $api_key, string $model = ''): array {
		if (empty($api_key)) {
			return [
				'success' => false,
				'message' => _('API Key is required for testing')
			];
		}
	
		try {
			$ch = curl_init();
			
			// Set up headers based on provider
			$headers = ['Content-Type: application/json'];
			
			switch ($provider) {
				case 'anthropic':
					$headers[] = 'x-api-key: ' . $api_key;
					$headers[] = 'anthropic-version: 2023-06-01';
					$test_data = json_encode([
						'model' => ($model ?: 'claude-3-haiku-20240307'),
						'max_tokens' => 10,
						'messages' => [
							['role' => 'user', 'content' => 'test']
						]
					]);
					break;
				
				case 'gemini':
					$endpoint = $endpoint . '/gemini-pro:generateContent?key=' . $api_key;
					$test_data = json_encode([
						'contents' => [
							['parts' => [['text' => 'test']]]
						]
					]);
					break;
				
				case 'github':
					$headers[] = 'Authorization: Bearer ' . $api_key;
					$test_data = json_encode([
						'model' => ($model ?: 'gpt-4o-mini'),
						'messages' => [
							['role' => 'user', 'content' => 'test']
						],
						'max_tokens' => 10
					]);
					break;
				
				case 'deepseek':
					$headers[] = 'Authorization: Bearer ' . $api_key;
					$test_data = json_encode([
						'model' => ($model ?: 'deepseek-chat'),
						'messages' => [
							['role' => 'user', 'content' => 'test']
						],
						'max_tokens' => 10
					]);
					break;
				
				case 'mistral':
					$headers[] = 'Authorization: Bearer ' . $api_key;
					$test_data = json_encode([
						'model' => ($model ?: 'mistral-large-latest'),
						'messages' => [
							['role' => 'user', 'content' => 'test']
						],
						'max_tokens' => 10
					]);
					break;
				
				case 'groq':
					$headers[] = 'Authorization: Bearer ' . $api_key;
					$test_data = json_encode([
						'model' => ($model ?: 'llama3-70b-8192'),
						'messages' => [
							['role' => 'user', 'content' => 'test']
						],
						'max_tokens' => 10
					]);
					break;
				
				case 'custom':
					$headers[] = 'Authorization: Bearer ' . $api_key;
					$test_data = json_encode([
						'model' => ($model ?: 'gpt-3.5-turbo'),
						'messages' => [
							['role' => 'user', 'content' => 'test']
						],
						'max_tokens' => 10
					]);
					break;
				
				default: // openai
					$headers[] = 'Authorization: Bearer ' . $api_key;
					$test_data = json_encode([
						'model' => ($model ?: 'gpt-3.5-turbo'),
						'messages' => [
							['role' => 'user', 'content' => 'test']
						],
						'max_tokens' => 10
					]);
			}
			
			// Set URL once for all providers
			curl_setopt($ch, CURLOPT_URL, $endpoint);
			curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
			curl_setopt($ch, CURLOPT_POST, true);
			curl_setopt($ch, CURLOPT_POSTFIELDS, $test_data);
			curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
			curl_setopt($ch, CURLOPT_TIMEOUT, 10);
			
			$response = curl_exec($ch);
			$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
			curl_close($ch);
			
			if ($http_code >= 200 && $http_code < 300) {
				return [
					'success' => true,
					'message' => _('Connection successful! (HTTP ' . $http_code . ')')
				];
			} else {
				return [
					'success' => false,
					'message' => _('Connection failed with HTTP ' . $http_code . ' - ' . substr($response, 0, 200))
				];
			}
		} catch (Exception $e) {
			return [
				'success' => false,
				'message' => _('Connection failed: ') . $e->getMessage()
			];
		}
	}
}
