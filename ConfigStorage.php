<?php

namespace Modules\AIIntegration;

/**
 * Configuration storage handler for AI Integration module
 * Stores provider configs, quick actions settings, and default provider
 */
class ConfigStorage {
    
    private static function getConfigPath(): string {
        return __DIR__ . '/data/config.json';
    }
    
    private static function getDataDir(): string {
        return __DIR__ . '/data';
    }
    
    /**
     * Load configuration from file
     * Returns merged config with defaults
     */
    public static function load(): array {
        $config_path = self::getConfigPath();
        
        // Default structure
        $defaults = [
            'openai' => [
                'api_endpoint' => 'https://api.openai.com/v1/chat/completions',
                'default_model' => 'gpt-4o',
                'temperature' => '0.7',
                'max_tokens' => '1000',
                'api_key' => '',
                'enabled' => false
            ],
            'github' => [
                'api_endpoint' => 'https://models.inference.ai.azure.com/chat/completions',
                'default_model' => 'gpt-4o-mini',
                'temperature' => '0.7',
                'max_tokens' => '1000',
                'api_key' => '',
                'enabled' => false
            ],
            'anthropic' => [
                'api_endpoint' => 'https://api.anthropic.com/v1/messages',
                'default_model' => 'claude-sonnet-4-20250514',
                'temperature' => '0.7',
                'max_tokens' => '1000',
                'api_key' => '',
                'enabled' => false
            ],
            'gemini' => [
                'api_endpoint' => 'https://generativelanguage.googleapis.com/v1beta/models',
                'default_model' => 'gemini-pro',
                'temperature' => '0.7',
                'max_tokens' => '1000',
                'api_key' => '',
                'enabled' => false
            ],
            'deepseek' => [
                'api_endpoint' => 'https://api.deepseek.com/v1/chat/completions',
                'default_model' => 'deepseek-chat',
                'temperature' => '0.7',
                'max_tokens' => '1000',
                'api_key' => '',
                'enabled' => false
            ],
            'mistral' => [
                'api_endpoint' => 'https://api.mistral.ai/v1/chat/completions',
                'default_model' => 'mistral-large-latest',
                'temperature' => '0.7',
                'max_tokens' => '1000',
                'api_key' => '',
                'enabled' => false
            ],
            'groq' => [
                'api_endpoint' => 'https://api.groq.com/openai/v1/chat/completions',
                'default_model' => 'llama3-70b-8192',
                'temperature' => '0.7',
                'max_tokens' => '1000',
                'api_key' => '',
                'enabled' => false
            ],
            'custom' => [
                'api_endpoint' => '',
                'default_model' => '',
                'temperature' => '0.7',
                'max_tokens' => '1000',
                'api_key' => '',
                'enabled' => false
            ],
            'default_provider' => 'openai',
            'quick_actions' => [
                'problems' => true,
                'triggers' => true,
                'items' => true,
                'hosts' => true
            ]
        ];
        
        if (!file_exists($config_path)) {
            return $defaults;
        }
        
        $json = file_get_contents($config_path);
        $config = json_decode($json, true);
        
        if (!is_array($config)) {
            return $defaults;
        }
        
        // Merge with defaults (preserve existing values, add new defaults)
        foreach ($defaults as $key => $value) {
            if (!isset($config[$key])) {
                $config[$key] = $value;
            } elseif (is_array($value) && is_array($config[$key])) {
                $config[$key] = array_merge($value, $config[$key]);
            }
        }
        
        return $config;
    }
    
    /**
     * Save configuration to file
     */
    public static function save(array $config): bool {
        $data_dir = self::getDataDir();
        $config_path = self::getConfigPath();
        
        // Ensure data directory exists
        if (!is_dir($data_dir)) {
            if (!@mkdir($data_dir, 0755, true)) {
                error_log("AI Integration: Failed to create data directory: $data_dir");
                return false;
            }
        }
        
        // Ensure data directory is writable
        if (!is_writable($data_dir)) {
            error_log("AI Integration: Data directory not writable: $data_dir");
            return false;
        }
        
        $json = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        
        if (@file_put_contents($config_path, $json) === false) {
            error_log("AI Integration: Failed to write config file: $config_path");
            return false;
        }
        
        // Set proper permissions on config file
        @chmod($config_path, 0644);
        
        return true;
    }
    
    /**
     * Get list of enabled providers with their configurations
     * Used by frontend for provider selection
     */
    public static function getEnabledProviders(): array {
        $config = self::load();
        $enabled = [];
        
        $provider_keys = ['openai', 'github', 'anthropic', 'gemini', 'deepseek', 'mistral', 'groq', 'custom'];
        
        foreach ($provider_keys as $provider) {
            if (isset($config[$provider]) && !empty($config[$provider]['enabled'])) {
                $enabled[] = [
                    'name' => $provider,
                    'model' => $config[$provider]['default_model'] ?? '',
                    'endpoint' => $config[$provider]['api_endpoint'] ?? '',
                    'has_api_key' => !empty($config[$provider]['api_key'])
                ];
            }
        }
        
        return $enabled;
    }
    
    /**
     * Get default provider name
     */
    public static function getDefaultProvider(): string {
        $config = self::load();
        return $config['default_provider'] ?? 'openai';
    }
    
    /**
     * Get quick actions settings
     */
    public static function getQuickActions(): array {
        $config = self::load();
        return $config['quick_actions'] ?? [
            'problems' => true,
            'triggers' => true,
            'items' => true,
            'hosts' => true
        ];
    }
}
