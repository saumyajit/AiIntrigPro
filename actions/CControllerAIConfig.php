<?php

namespace Modules\AIIntegration\Actions;

use CController;
use CControllerResponseData;
use Modules\AIIntegration\ConfigStorage;

class CControllerAIConfig extends CController {
    
    protected function init(): void {
        $this->disableCsrfValidation();
    }
    
    protected function checkInput(): bool {
        return true;
    }
    
    protected function checkPermissions(): bool {
        return $this->getUserType() >= USER_TYPE_SUPER_ADMIN;
    }
    
    protected function doAction(): void {
        try {
            // Handle SAVE
            if ($this->hasInput('save') || isset($_POST['save'])) {
                $this->handleSave();
                return;
            }
            
            // Handle TEST
            if ($this->hasInput('test') || isset($_POST['test'])) {
                $this->handleTest();
                return;
            }
            
            // Load config and render page
            $config = ConfigStorage::load();
            
            $data = [
                'config' => $config,
                'message' => null,
                'message_type' => null
            ];
            
            $response = new CControllerResponseData($data);
            $response->setTitle(_('AI Integration'));
            $this->setResponse($response);
            
        } catch (\Exception $e) {
            error_log('AI Integration Error: ' . $e->getMessage());
            error_log('AI Integration Stack: ' . $e->getTraceAsString());
            
            header('Content-Type: application/json');
            echo json_encode([
                'success' => false,
                'message' => 'Error: ' . $e->getMessage()
            ]);
            exit;
        }
    }
    
    /**
     * Handle save - saves ALL settings at once
     */
    private function handleSave(): void {
        try {
            // Ensure no output before JSON
            ob_clean();
            
            $existing = ConfigStorage::load();
            
            // Build complete config
            $config = [
                'openai' => $this->buildProviderConfig('openai', $existing),
                'github' => $this->buildProviderConfig('github', $existing),
                'anthropic' => $this->buildProviderConfig('anthropic', $existing),
                'gemini' => $this->buildProviderConfig('gemini', $existing),
                'deepseek' => $this->buildProviderConfig('deepseek', $existing),
                'mistral' => $this->buildProviderConfig('mistral', $existing),
                'groq' => $this->buildProviderConfig('groq', $existing),
                'custom' => $this->buildProviderConfig('custom', $existing),
                'default_provider' => $_POST['default_provider'] ?? 'openai',
                'quick_actions' => [
                    'problems' => !empty($_POST['qa_problems']),
                    'triggers' => !empty($_POST['qa_triggers']),
                    'items' => !empty($_POST['qa_items']),
                    'hosts' => !empty($_POST['qa_hosts'])
                ]
            ];
            
            // Save
            $ok = ConfigStorage::save($config);
            
            // Send JSON response
            header('Content-Type: application/json');
            http_response_code(200);
            echo json_encode([
                'success' => $ok,
                'message' => $ok ? _('Configuration saved successfully!') : _('Failed to save configuration')
            ]);
            exit;
            
        } catch (\Exception $e) {
            error_log('AI Integration Save Error: ' . $e->getMessage());
            
            header('Content-Type: application/json');
            http_response_code(200);
            echo json_encode([
                'success' => false,
                'message' => 'Save error: ' . $e->getMessage()
            ]);
            exit;
        }
    }
    
    /**
     * Build provider config from POST data
     */
    private function buildProviderConfig(string $provider, array $existing): array {
        $api_key = trim($_POST[$provider . '_api_key'] ?? '');
        
        // If API key is empty or masked, keep existing
        if ($api_key === '' || $api_key === '********' || strpos($api_key, '*') !== false) {
            $api_key = $existing[$provider]['api_key'] ?? '';
        }
        
        return [
            'enabled' => !empty($_POST[$provider . '_enabled']),
            'api_endpoint' => trim($_POST[$provider . '_api_endpoint'] ?? ''),
            'api_key' => $api_key,
            'default_model' => trim($_POST[$provider . '_default_model'] ?? ''),
            'temperature' => trim($_POST[$provider . '_temperature'] ?? '0.7'),
            'max_tokens' => trim($_POST[$provider . '_max_tokens'] ?? '1000')
        ];
    }
    
    /**
     * Handle test connection
     */
    private function handleTest(): void {
        try {
            ob_clean();
            
            $provider = $_POST['provider'] ?? 'openai';
            $endpoint = $_POST['api_endpoint'] ?? '';
            $api_key = $_POST['api_key'] ?? '';
            
            if (empty($api_key)) {
                header('Content-Type: application/json');
                echo json_encode([
                    'success' => false,
                    'message' => _('API Key is required for testing')
                ]);
                exit;
            }
            
            $ch = curl_init();
            $headers = ['Content-Type: application/json'];
            
            if ($provider === 'anthropic') {
                $headers[] = 'x-api-key: ' . $api_key;
                $headers[] = 'anthropic-version: 2023-06-01';
            } elseif ($provider === 'gemini') {
                $endpoint = $endpoint . '/gemini-pro:generateContent?key=' . $api_key;
            } else {
                $headers[] = 'Authorization: Bearer ' . $api_key;
            }
            
            $test_data = json_encode([
                'model' => 'test',
                'messages' => [['role' => 'user', 'content' => 'test']],
                'max_tokens' => 10
            ]);
            
            curl_setopt($ch, CURLOPT_URL, $endpoint);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $test_data);
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);
            
            $response = curl_exec($ch);
            $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            
            header('Content-Type: application/json');
            if ($http_code >= 200 && $http_code < 300) {
                echo json_encode([
                    'success' => true,
                    'message' => _('Connection successful! (HTTP ' . $http_code . ')')
                ]);
            } else {
                echo json_encode([
                    'success' => false,
                    'message' => _('Connection failed: HTTP ' . $http_code)
                ]);
            }
            exit;
            
        } catch (\Exception $e) {
            header('Content-Type: application/json');
            echo json_encode([
                'success' => false,
                'message' => _('Test error: ') . $e->getMessage()
            ]);
            exit;
        }
    }
}
