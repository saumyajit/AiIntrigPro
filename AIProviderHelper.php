<?php

namespace Modules\AIIntegration;

/**
 * Shared helper for AI provider API calls
 * Used by both chat (CControllerAICollab) and quick actions (CControllerAIQuery)
 */
class AIProviderHelper {
    
    /**
     * Send message to AI provider and return response
     * 
     * @param string $provider Provider name (openai, anthropic, etc.)
     * @param array $config Provider configuration
     * @param string $message User message/question
     * @param array $context Optional context data for system prompt
     * @return array ['success' => bool, 'message' => string, 'error' => string]
     */
    public static function sendToAI(string $provider, array $config, string $message, array $context = []): array {
        try {
            $ch = curl_init();
            $headers = ['Content-Type: application/json'];
            
            // Build system prompt with context if provided
            $system_prompt = self::buildSystemPrompt($context);
            
            switch ($provider) {
                case 'anthropic':
                    return self::callAnthropic($ch, $config, $message, $system_prompt, $headers);
                    
                case 'gemini':
                    return self::callGemini($ch, $config, $message, $system_prompt, $headers);
                    
                case 'openai':
                case 'github':
                case 'deepseek':
                case 'mistral':
                case 'groq':
                case 'custom':
                default:
                    return self::callOpenAICompatible($ch, $config, $message, $system_prompt, $headers);
            }
            
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => _('Error: ') . $e->getMessage()
            ];
        }
    }
    
    /**
     * Build system prompt with optional context
     */
    private static function buildSystemPrompt(array $context = []): string {
        $prompt = 'You are a helpful AI assistant integrated with Zabbix monitoring system. ';
        $prompt .= 'Provide clear, actionable insights based on monitoring data.';
        
        if (!empty($context)) {
            $prompt .= "\n\nContext data:\n" . json_encode($context, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        }
        
        return $prompt;
    }
    
    /**
     * Call Anthropic Claude API
     */
    private static function callAnthropic($ch, array $config, string $message, string $system_prompt, array $headers): array {
        $headers[] = 'x-api-key: ' . $config['api_key'];
        $headers[] = 'anthropic-version: 2023-06-01';
        
        $data = json_encode([
            'model' => $config['default_model'],
            'max_tokens' => intval($config['max_tokens']),
            'temperature' => floatval($config['temperature']),
            'system' => $system_prompt,
            'messages' => [
                [
                    'role' => 'user',
                    'content' => $message
                ]
            ]
        ]);
        
        curl_setopt($ch, CURLOPT_URL, $config['api_endpoint']);
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
            $ai_message = $response_data['content'][0]['text'] ?? 'No response';
            
            return [
                'success' => true,
                'message' => $ai_message
            ];
        }
        
        return [
            'success' => false,
            'error' => _('AI API error: HTTP ') . $http_code . ' - ' . $response
        ];
    }
    
    /**
     * Call Google Gemini API
     */
    private static function callGemini($ch, array $config, string $message, string $system_prompt, array $headers): array {
        $endpoint = $config['api_endpoint'] . '/' . $config['default_model'] . ':generateContent?key=' . $config['api_key'];
        
        // Gemini combines system prompt with user message
        $combined_message = $system_prompt . "\n\nUser question: " . $message;
        
        $data = json_encode([
            'contents' => [
                [
                    'parts' => [
                        ['text' => $combined_message]
                    ]
                ]
            ],
            'generationConfig' => [
                'temperature' => floatval($config['temperature']),
                'maxOutputTokens' => intval($config['max_tokens'])
            ]
        ]);
        
        curl_setopt($ch, CURLOPT_URL, $endpoint);
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
            $ai_message = $response_data['candidates'][0]['content']['parts'][0]['text'] ?? 'No response';
            
            return [
                'success' => true,
                'message' => $ai_message
            ];
        }
        
        return [
            'success' => false,
            'error' => _('AI API error: HTTP ') . $http_code . ' - ' . $response
        ];
    }
    
    /**
     * Call OpenAI-compatible APIs (OpenAI, DeepSeek, GitHub, Mistral, Groq, Custom)
     */
    private static function callOpenAICompatible($ch, array $config, string $message, string $system_prompt, array $headers): array {
        $headers[] = 'Authorization: Bearer ' . $config['api_key'];
        
        $messages = [
            [
                'role' => 'system',
                'content' => $system_prompt
            ],
            [
                'role' => 'user',
                'content' => $message
            ]
        ];
        
        $data = json_encode([
            'model' => $config['default_model'],
            'messages' => $messages,
            'temperature' => floatval($config['temperature']),
            'max_tokens' => intval($config['max_tokens'])
        ]);
        
        curl_setopt($ch, CURLOPT_URL, $config['api_endpoint']);
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
            $ai_message = $response_data['choices'][0]['message']['content'] ?? 'No response';
            
            return [
                'success' => true,
                'message' => $ai_message
            ];
        }
        
        return [
            'success' => false,
            'error' => _('AI API error: HTTP ') . $http_code . ' - ' . $response
        ];
    }
}
