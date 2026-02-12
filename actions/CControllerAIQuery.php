<?php

namespace Modules\AIIntegration\Actions;

use CController;
use Modules\AIIntegration\ConfigStorage;

class CControllerAIQuery extends CController {
    
    protected function init(): void {
        $this->disableCsrfValidation();
    }
    
    protected function checkInput(): bool {
        return true;
    }
    
    protected function checkPermissions(): bool {
        return true; // Allow all authenticated users
    }
    
    protected function doAction(): void {
        // Ensure clean JSON output
        while (ob_get_level()) {
            ob_end_clean();
        }
        ob_start();
        
        try {
            // Get input
            $input = file_get_contents('php://input');
            $data = json_decode($input, true);
            
            error_log('AI Integration Query - Input: ' . print_r($data, true));
            
            $question = $data['question'] ?? '';
            $provider = $data['provider'] ?? '';
            $context = $data['context'] ?? [];
            
            if (empty($question)) {
                throw new \Exception('Question is required');
            }
            
            // Load config
            $config = ConfigStorage::load();
            
            // Fix provider
            if (empty($provider) || $provider === 'undefined') {
                $provider = $config['default_provider'] ?? 'github';
            }
            
            error_log("AI Integration Query - Using provider: $provider");
            
            if (!isset($config[$provider])) {
                throw new \Exception("Provider '$provider' not found in config");
            }
            
            $providerConfig = $config[$provider];
            
            if (empty($providerConfig['enabled'])) {
                throw new \Exception("Provider '$provider' is not enabled. Please enable it in settings.");
            }
            
            // Make API call
            $response = $this->callAPI($question, $context, $provider, $providerConfig);
            
            $result = [
                'success' => true,
                'response' => $response,
                'provider' => $provider
            ];
            
        } catch (\Exception $e) {
            error_log('AI Integration Query Error: ' . $e->getMessage());
            $result = [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
        
        // Clean output and send JSON
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode($result);
        exit;
    }
    
    private function callAPI($question, $context, $provider, $config) {
        $endpoint = $config['api_endpoint'];
        $apiKey = $config['api_key'];
        $model = $config['default_model'] ?? 'gpt-4o-mini';
        
        // Build prompt
        $prompt = $question;
        if ($context) {
            $prompt .= "\n\nContext: " . json_encode($context);
        }
        
        // Build request
        $headers = [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey
        ];
        
        $requestData = [
            'model' => $model,
            'messages' => [
                ['role' => 'user', 'content' => $prompt]
            ],
            'max_tokens' => (int)($config['max_tokens'] ?? 1000),
            'temperature' => (float)($config['temperature'] ?? 0.7)
        ];
        
        error_log('AI Integration - Calling API: ' . $endpoint);
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $endpoint);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($requestData));
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);
        
        if ($curlError) {
            throw new \Exception('API Error: ' . $curlError);
        }
        
        if ($httpCode !== 200) {
            throw new \Exception('API returned HTTP ' . $httpCode . ': ' . substr($response, 0, 200));
        }
        
        $responseData = json_decode($response, true);
        if (!$responseData) {
            throw new \Exception('Invalid API response');
        }
        
        // Extract message
        return $responseData['choices'][0]['message']['content'] ?? 'No response';
    }
}
