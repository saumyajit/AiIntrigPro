<?php

namespace Modules\AIIntegration\Actions;

use CController;
use Modules\AIIntegration\ConfigStorage;
use Modules\AIIntegration\AIProviderHelper;

/**
 * Handles Quick-Action AI queries from the frontend JS.
 *
 * Uses the shared AIProviderHelper so that every provider type
 * (Anthropic, Gemini, OpenAI-compatible) is dispatched correctly.
 * The original private callAPI() only used OpenAI format which broke
 * Anthropic and Gemini quick-actions.
 */
class CControllerAIQuery extends CController {

    protected function init(): void {
        $this->disableCsrfValidation();
    }

    protected function checkInput(): bool {
        return true;
    }

    protected function checkPermissions(): bool {
        return true; // all authenticated users
    }

    protected function doAction(): void {
        while (ob_get_level()) {
            ob_end_clean();
        }
        ob_start();

        $result = [];

        try {
            $input = (string) file_get_contents('php://input');
            $data  = json_decode($input, true);

            // Ensure $data is always an array even if JSON decode failed
            if (!is_array($data)) {
                $data = [];
            }

            error_log('AI Integration Query - Input: ' . print_r($data, true));

            $question = trim($data['question'] ?? '');
            $provider = trim($data['provider']  ?? '');
            $context  = is_array($data['context'] ?? null) ? $data['context'] : [];

            if ($question === '') {
                throw new \Exception('Question is required');
            }

            $config = ConfigStorage::load();

            // Fall back to default provider if none specified
            if ($provider === '' || $provider === 'undefined') {
                $provider = $config['default_provider'] ?? 'openai';
            }

            error_log("AI Integration Query - Using provider: $provider");

            if (!isset($config[$provider])) {
                throw new \Exception("Provider '$provider' not found in configuration.");
            }

            $providerConfig = $config[$provider];

            if (empty($providerConfig['enabled'])) {
                throw new \Exception(
                    "Provider '$provider' is not enabled. " .
                    "Please enable it in Administration → AI Integration."
                );
            }

            if (empty($providerConfig['api_key'])) {
                throw new \Exception(
                    "No API key configured for '$provider'. " .
                    "Please set it in Administration → AI Integration."
                );
            }

            // Dispatch through the shared helper — handles Anthropic, Gemini, and
            // all OpenAI-compatible providers with the correct request format.
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

        ob_clean();
        header('Content-Type: application/json');
        echo json_encode($result);
        exit;
    }
}
