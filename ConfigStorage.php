<?php

namespace Modules\AIIntegration;

class ConfigStorage {
    
    private static function getConfigPath() {
        // Store in module's data directory
        return __DIR__ . '/data/config.json';
    }
    
    /**
     * Get configuration from file
     */
    public static function load() {
        $config_file = self::getConfigPath();
        
        if (file_exists($config_file)) {
            $json = file_get_contents($config_file);
            $config = json_decode($json, true);
            if ($config) {
                return $config;
            }
        }
        
        // Return default config if file doesn't exist
        return self::getDefaultConfig();
    }
    
    /**
     * Save configuration to file
     */
    public static function save($config) {
        $config_file = self::getConfigPath();
        
        // Ensure data directory exists
        $dir = dirname($config_file);
        if (!is_dir($dir)) {
            if (!mkdir($dir, 0755, true)) {
                error_log("AI Integration: Failed to create data directory: $dir");
                return false;
            }
        }
        
        // Write config as pretty JSON
        $json = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        $result = file_put_contents($config_file, $json);
        
        if ($result === false) {
            error_log("AI Integration: Failed to write config file: $config_file");
            return false;
        }
        
        // Set proper permissions
        chmod($config_file, 0644);
        
        return true;
    }
    
    /**
     * Get default configuration
     */
    public static function getDefaultConfig() {
        return [
            'openai' => [
                'api_endpoint' => 'https://api.openai.com/v1/chat/completions',
                'default_model' => 'gpt-4o',
                'temperature' => '0.7',
                'max_tokens' => '1000',
                'api_key' => ''
            ],
            'anthropic' => [
                'api_endpoint' => 'https://api.anthropic.com/v1/messages',
                'default_model' => 'claude-sonnet-4-20250514',
                'temperature' => '0.7',
                'max_tokens' => '1000',
                'api_key' => ''
            ],
            'google' => [
                'api_endpoint' => 'https://generativelanguage.googleapis.com/v1beta/models',
                'default_model' => 'gemini-pro',
                'temperature' => '0.7',
                'max_tokens' => '1000',
                'api_key' => ''
            ],
            'deepseek' => [
                'api_endpoint' => 'https://api.deepseek.com/v1/chat/completions',
                'default_model' => 'deepseek-chat',
                'temperature' => '0.7',
                'max_tokens' => '1000',
                'api_key' => ''
            ]
        ];
    }
}
