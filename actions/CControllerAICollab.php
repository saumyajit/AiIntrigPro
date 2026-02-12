<?php

namespace Modules\AIIntegration\Actions;

use CController;
use CControllerResponseData;
use Modules\AIIntegration\ConfigStorage;
use Modules\AIIntegration\AIProviderHelper;

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
        return $this->getUserType() >= USER_TYPE_SUPER_ADMIN;
    }
    
    protected function doAction(): void {
        // Load AI config from file
        $config = ConfigStorage::load();
        
        // Handle clear history
        if ($this->hasInput('clear')) {
            $_SESSION['ai_chat_history'] = [];
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
                header('Content-Type: application/json');
                echo json_encode([
                    'success' => false,
                    'error' => _('Selected AI provider (' . $provider . ') is not configured. Please configure it in Administration > AI Integration.')
                ]);
                exit;
            } elseif (empty($config[$provider]['api_key'])) {
                header('Content-Type: application/json');
                echo json_encode([
                    'success' => false,
                    'error' => _('API Key not set for ' . $provider . '. Please configure it in Administration > AI Integration first.')
                ]);
                exit;
            } else {
                // Send message to AI using shared helper
                $ai_response = AIProviderHelper::sendToAI($provider, $config[$provider], $message);
                
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
                    
                    header('Content-Type: application/json');
                    echo json_encode([
                        'success' => true,
                        'message' => $ai_response['message']
                    ]);
                    exit;
                } else {
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
}
