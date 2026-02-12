<?php

namespace Modules\AIIntegration;

use Zabbix\Core\CModule;
use APP;
use CMenuItem;

class Module extends CModule {

	public function init(): void {
		APP::Component()->get('menu.main')
			->findOrAdd(_('Administration'))
			->getSubmenu()
			->insertAfter(_('General'),
				(new CMenuItem(_('AI Integration')))
					->setAction('aiintegration.config')
			);
		APP::Component()->get('menu.main')
		    ->findOrAdd(_('Monitoring'))
  			->getSubmenu()
    		->insertAfter(_('Maps'),
        		(new CMenuItem(_('AI Collab')))
            		->setAction('aiintegration.collab')
    		);
	}
}
