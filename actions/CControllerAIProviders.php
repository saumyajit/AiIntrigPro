<?php

namespace Modules\AIIntegration\Actions;

use CController;
use CControllerResponseData;
use Modules\AIIntegration\ConfigStorage;

/**
 * Returns enabled providers and settings for frontend JavaScript
 * Used by quick action modals to populate provider dropdown
 */
class CControllerAIProviders extends CController {

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
            $enabled_providers = ConfigStorage::getEnabledProviders();
            $default_provider = ConfigStorage::getDefaultProvider();
            $quick_actions = ConfigStorage::getQuickActions();

            // Check if current user is Super Admin for context viewing
            $is_super_admin = $this->getUserType() >= USER_TYPE_SUPER_ADMIN;

            echo json_encode([
                'success' => true,
                'providers' => $enabled_providers,
                'default_provider' => $default_provider,
                'quick_actions' => $quick_actions,
                'is_super_admin' => $is_super_admin
            ], JSON_UNESCAPED_UNICODE);

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
