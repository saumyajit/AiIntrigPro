<?php

namespace Modules\AIIntegration\Actions;

use CController;
use Modules\AIIntegration\ConfigStorage;
use Modules\AIIntegration\AIProviderHelper;

/**
 * Handles Quick Action AI queries from the frontend.
 * Uses AIProviderHelper so that Anthropic, Gemini, and all other providers
 * are dispatched through the correct API format.
 */
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
            // Parse JSON body
            $input = file_get_contents('php://input');
            $data  = json_decode($input, true);

            error_log('AI Integration Query - Input: ' . print_r($data, true));

            $question = $data['question'] ?? '';
            $provider = $data['provider']  ?? '';
            $context  = $data['context']   ?? [];

            if (empty($question)) {
                throw new \Exception('Question is required');
            }

            // Load configuration
            $config = ConfigStorage::load();

            // Resolve provider
            if (empty($provider) || $provider === 'undefined') {
                $provider = $config['default_provider'] ?? 'openai';
            }

            error_log("AI Integration Query - Using provider: $provider");

            if (!isset($config[$provider])) {
                throw new \Exception("Provider '$provider' not found in config");
            }

            $providerConfig = $config[$provider];

            if (empty($providerConfig['enabled'])) {
                throw new \Exception("Provider '$provider' is not enabled. Please enable it in Administration → AI Integration.");
            }

            if (empty($providerConfig['api_key'])) {
                throw new \Exception("No API key configured for provider '$provider'.");
            }

            // Delegate to the shared helper which handles all provider types
            // (OpenAI-compatible, Anthropic, Gemini)
            $aiResult = AIProviderHelper::sendToAI($provider, $providerConfig, $question, $context);

            if (!$aiResult['success']) {
                throw new \Exception($aiResult['error'] ?? 'AI API call failed');
            }

            $result = [
                'success'  => true,
                'response' => $aiResult['message'],
                'provider' => $provider
            ];

        } catch (\Exception $e) {
            error_log('AI Integration Query Error: ' . $e->getMessage());
            $result = [
                'success' => false,
                'error'   => $e->getMessage()
            ];
        }

        // Clean buffer and send JSON
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode($result);
        exit;
    }
}
