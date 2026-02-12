<?php

namespace Modules\AIIntegration\Actions;

use CController;
use Modules\AIIntegration\ConfigStorage;

/**
 * AI Query Handler
 * Processes AI requests with provider support
 */
class CControllerAIQuery extends CController {
    
    protected function init(): void {
        $this->disableCsrfValidation();
    }
    
    protected function checkInput(): bool {
        return true;
    }
    
    protected function checkPermissions(): bool {
        return $this->checkAccess(CRoleHelper::UI_MONITORING_PROBLEMS) 
            || $this->checkAccess(CRoleHelper::UI_MONITORING_LATEST_DATA)
            || $this->getUserType() >= USER_TYPE_SUPER_ADMIN;
    }
    
    protected function doAction(): void {
        try {
            ob_clean();
            
            // Get JSON input
            $input = file_get_contents('php://input');
            $data = json_decode($input, true);
            
            if (!$data) {
                throw new \Exception('Invalid request data');
            }
            
            $question = $data['question'] ?? '';
            $context = $data['context'] ?? [];
            $provider = $data['provider'] ?? null;
            
            if (empty($question)) {
                throw new \Exception('Question is required');
            }
            
            // Load config
            $config = ConfigStorage::load();
            
            // Determine which provider to use
            if (!$provider || $provider === 'undefined' || $provider === 'null') {
                $provider = $config['default_provider'] ?? 'openai';
            }
            
            // Validate provider
            if (!isset($config[$provider])) {
                throw new \Exception("Provider '{$provider}' is not configured");
            }
            
            $providerConfig = $config[$provider];
            
            if (empty($providerConfig['enabled'])) {
                throw new \Exception("Provider '{$provider}' is not enabled");
            }
            
            if (empty($providerConfig['api_key'])) {
                throw new \Exception("Provider '{$provider}' has no API key configured");
            }
            
            // Make AI request
            $response = $this->callAI(
                $question,
                $context,
                $provider,
                $providerConfig
            );
            
            header('Content-Type: application/json');
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'response' => $response,
                'provider' => $provider
            ]);
            exit;
            
        } catch (\Exception $e) {
            error_log('AI Integration Query Error: ' . $e->getMessage());
            
            header('Content-Type: application/json');
            http_response_code(200);
            echo json_encode([
                'success' => false,
                'error' => $e->getMessage()
            ]);
            exit;
        }
    }
    
    /**
     * Call AI provider API
     */
    private function callAI(string $question, array $context, string $provider, array $config): string {
        $endpoint = $config['api_endpoint'];
        $api_key = $config['api_key'];
        $model = $config['default_model'];
        $temperature = (float)($config['temperature'] ?? 0.7);
        $max_tokens = (int)($config['max_tokens'] ?? 1000);
        
        // Build prompt with context
        $prompt = $question;
        if (!empty($context)) {
            $prompt .= "\n\nContext:\n" . json_encode($context, JSON_PRETTY_PRINT);
        }
        
        $ch = curl_init();
        $headers = ['Content-Type: application/json'];
        $request_data = [];
        
        switch ($provider) {
            case 'anthropic':
                $headers[] = 'x-api-key: ' . $api_key;
                $headers[] = 'anthropic-version: 2023-06-01';
                $request_data = [
                    'model' => $model,
                    'max_tokens' => $max_tokens,
                    'messages' => [
                        ['role' => 'user', 'content' => $prompt]
                    ]
                ];
                break;
                
            case 'gemini':
                $endpoint = $endpoint . '/' . $model . ':generateContent?key=' . $api_key;
                $request_data = [
                    'contents' => [
                        ['parts' => [['text' => $prompt]]]
                    ]
                ];
                break;
                
            default:
                // OpenAI-compatible (openai, github, deepseek, mistral, groq, custom)
                $headers[] = 'Authorization: Bearer ' . $api_key;
                $request_data = [
                    'model' => $model,
                    'messages' => [
                        ['role' => 'user', 'content' => $prompt]
                    ],
                    'temperature' => $temperature,
                    'max_tokens' => $max_tokens
                ];
        }
        
        curl_setopt($ch, CURLOPT_URL, $endpoint);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($request_data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        if ($error) {
            throw new \Exception('API request failed: ' . $error);
        }
        
        if ($http_code < 200 || $http_code >= 300) {
            throw new \Exception('API returned error: HTTP ' . $http_code . ' - ' . substr($response, 0, 200));
        }
        
        // Parse response
        $response_data = json_decode($response, true);
        if (!$response_data) {
            throw new \Exception('Failed to parse API response');
        }
        
        // Extract text based on provider
        return $this->extractResponse($response_data, $provider);
    }
    
    /**
     * Extract text from API response
     */
    private function extractResponse(array $data, string $provider): string {
        switch ($provider) {
            case 'anthropic':
                return $data['content'][0]['text'] ?? 'No response';
                
            case 'gemini':
                return $data['candidates'][0]['content']['parts'][0]['text'] ?? 'No response';
                
            default:
                // OpenAI-compatible
                return $data['choices'][0]['message']['content'] ?? 'No response';
        }
    }
}
