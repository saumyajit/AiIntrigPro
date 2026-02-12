<?php

namespace Modules\AIIntegration\Actions;

use CController;
use Modules\AIIntegration\ConfigStorage;
use Modules\AIIntegration\AIProviderHelper;

/**
 * Handles contextual AI queries from quick actions
 * Receives question + context, sends to AI provider, returns response
 */
class CControllerAIQuery extends CController {
    
    protected function init(): void {
        $this->disableCsrfValidation();
    }
    
    protected function checkInput(): bool {
        return true;
    }
    
    protected function checkPermissions(): bool {
        // Available to all authenticated users
        return $this->getUserType() >= USER_TYPE_ZABBIX_USER;
    }
    
    protected function doAction(): void {
        header('Content-Type: application/json; charset=utf-8');
        
        try {
            // Parse JSON input
            $raw = file_get_contents('php://input');
            $payload = json_decode($raw, true) ?: [];
            
            $question = trim($payload['question'] ?? '');
            $provider = trim($payload['provider'] ?? '');
            $context = $payload['context'] ?? [];
            
            // Validate input
            if ($question === '') {
                throw new \Exception('Question parameter is required.');
            }
            
            if (!is_array($context)) {
                $context = [];
            }
            
            // Load configuration
            $config = ConfigStorage::load();
            
            // Determine provider
            if ($provider === '') {
                $provider = $config['default_provider'] ?? 'openai';
            }
            
            // Validate provider
            if (!isset($config[$provider])) {
                throw new \Exception("Provider '{$provider}' is not configured.");
            }
            
            $provider_config = $config[$provider];
            
            // Check if provider is enabled
            if (empty($provider_config['enabled'])) {
                throw new \Exception("Provider '{$provider}' is not enabled. Please enable it in Administration > AI Integration.");
            }
            
            // Check API key
            if ($provider !== 'custom' && empty($provider_config['api_key'])) {
                throw new \Exception("API key not configured for provider '{$provider}'.");
            }
            
            // Send to AI
            $result = AIProviderHelper::sendToAI($provider, $provider_config, $question, $context);
            
            if ($result['success']) {
                echo json_encode([
                    'success' => true,
                    'provider' => $provider,
                    'response' => $result['message'],
                    'timestamp' => time()
                ], JSON_UNESCAPED_UNICODE);
            } else {
                throw new \Exception($result['error']);
            }
            
        } catch (\Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error' => $e->getMessage()
            ]);
        }
        
        exit;
    }
}
