<?php

namespace Modules\AIIntegration\Actions;

use CController;
use Modules\AIIntegration\ConfigStorage;

/**
 * Provider settings endpoint for frontend
 * Returns only ENABLED providers + default provider + quick actions settings
 */
class CControllerAIProviders extends CController {
    
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
            
            $config = ConfigStorage::load();
            
            $provider_names = [
                'openai' => 'OpenAI',
                'github' => 'GitHub Models',
                'anthropic' => 'Anthropic (Claude)',
                'gemini' => 'Google Gemini',
                'deepseek' => 'DeepSeek',
                'mistral' => 'Mistral AI',
                'groq' => 'Groq',
                'custom' => 'Custom'
            ];
            
            // Filter only ENABLED providers
            $enabled_providers = [];
            foreach (['openai', 'github', 'anthropic', 'gemini', 'deepseek', 'mistral', 'groq', 'custom'] as $provider) {
                if (!empty($config[$provider]['enabled'])) {
                    $enabled_providers[] = [
                        'id' => $provider,
                        'name' => $provider_names[$provider]
                    ];
                }
            }
            
            // If NO providers enabled, return default (OpenAI) to avoid breaking
            if (empty($enabled_providers)) {
                $enabled_providers[] = [
                    'id' => 'openai',
                    'name' => 'OpenAI'
                ];
            }
            
            $response = [
                'success' => true,
                'providers' => $enabled_providers,
                'default_provider' => $config['default_provider'] ?? 'openai',
                'quick_actions' => $config['quick_actions'] ?? [
                    'problems' => true,
                    'triggers' => true,
                    'items' => true,
                    'hosts' => true
                ],
                'is_super_admin' => $this->getUserType() >= USER_TYPE_SUPER_ADMIN
            ];
            
            header('Content-Type: application/json');
            http_response_code(200);
            echo json_encode($response);
            exit;
            
        } catch (\Exception $e) {
            error_log('AI Integration Providers Error: ' . $e->getMessage());
            
            header('Content-Type: application/json');
            http_response_code(200);
            echo json_encode([
                'success' => false,
                'error' => $e->getMessage(),
                'providers' => [],
                'default_provider' => 'openai',
                'quick_actions' => [
                    'problems' => true,
                    'triggers' => true,
                    'items' => true,
                    'hosts' => true
                ]
            ]);
            exit;
        }
    }
}
