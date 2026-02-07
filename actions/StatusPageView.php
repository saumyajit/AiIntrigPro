<?php
namespace Modules\StatusPage\Actions;

use CController;
use CControllerResponseData;
use CControllerResponseFatal;
use CRoleHelper;
use CMessageHelper;
use API;

class StatusPageView extends CController {

    protected function init(): void {
        $this->disableCsrfValidation();
    }

    protected function checkInput(): bool {
        $fields = [
            'icon_size' => 'in 20,25,30,35,40',
            'spacing' => 'in normal,compact,ultra-compact',
            'filter_alerts' => 'in 0,1',
            'search' => 'string',
            'refresh' => 'in 0,1',
            // Filter fields
            'filter_severities' => 'array',
            'filter_tags' => 'array',
            'filter_alert_name' => 'string',
            'filter_logic' => 'in AND,OR'
        ];

        $ret = $this->validateInput($fields);
        
        if (!$ret) {
            $this->setResponse(new CControllerResponseFatal());
        }

        return $ret;
    }

    protected function checkPermissions(): bool {
        return $this->getUserType() >= USER_TYPE_ZABBIX_USER;
    }

    protected function doAction(): void {
        // Get user preferences
        $icon_size = $this->getInput('icon_size', '30');
        $spacing = $this->getInput('spacing', 'normal');
        $filter_alerts = $this->hasInput('filter_alerts') ? (bool)$this->getInput('filter_alerts') : false;
        $search = $this->getInput('search', '');
        $refresh = $this->hasInput('refresh') ? (bool)$this->getInput('refresh') : false;
        
        // Filters
        $filter_severities = $this->getInput('filter_severities', []);
        $filter_tags = $this->getInput('filter_tags', []);
        $filter_alert_name = $this->getInput('filter_alert_name', '');
        $filter_logic = $this->getInput('filter_logic', 'OR');

        try {
            // 1. Fetch host groups starting with "CUSTOMER/"
            $all_host_groups = API::HostGroup()->get([
                'output' => ['groupid', 'name'],
                'preservekeys' => true
            ]);

            // Filter groups that start with "CUSTOMER/"
            $customer_groups = [];
            foreach ($all_host_groups as $groupid => $group) {
                if (strpos($group['name'], 'CUSTOMER/') === 0) {
                    $customer_groups[$groupid] = $group;
                }
            }

            // 2. Fetch hosts for these groups
            $hosts = API::Host()->get([
                'output' => ['hostid', 'host', 'name', 'status'],
                'groupids' => array_keys($customer_groups),
                'selectHostGroups' => ['groupid'],
                'monitored_hosts' => true,
                'preservekeys' => true
            ]);

            // 3. Fetch ALL active triggers with tags (we'll filter groups, not triggers)
            $all_triggers = API::Trigger()->get([
                'output' => ['triggerid', 'description', 'priority', 'value'],
                'selectHosts' => ['hostid'],
                'selectTags' => ['tag', 'value'],
                'filter' => ['value' => TRIGGER_VALUE_TRUE],
                'monitored' => true,
                'preservekeys' => true
            ]);

            // Collect all unique tags with frequency count for "popular tags"
            $all_tags = [];
            $tag_frequency = [];
            
            foreach ($all_triggers as $trigger) {
                if (!empty($trigger['tags'])) {
                    foreach ($trigger['tags'] as $tag) {
                        $tag_key = $tag['tag'] . (empty($tag['value']) ? '' : ': ' . $tag['value']);
                        
                        if (!isset($all_tags[$tag_key])) {
                            $all_tags[$tag_key] = [
                                'tag' => $tag['tag'],
                                'value' => $tag['value'] ?? '',
                                'display' => $tag_key
                            ];
                            $tag_frequency[$tag_key] = 0;
                        }
                        $tag_frequency[$tag_key]++;
                    }
                }
            }
            
            // Sort tags by frequency (most popular first)
            arsort($tag_frequency);
            $popular_tags = array_slice(array_keys($tag_frequency), 0, 10); // Top 10 popular tags

            // Map triggers to host groups (no filtering at trigger level)
            $group_triggers = [];
            foreach ($all_triggers as $trigger) {
                foreach ($trigger['hosts'] as $trigger_host) {
                    $hostid = $trigger_host['hostid'];
                    
                    if (isset($hosts[$hostid])) {
                        $host = $hosts[$hostid];
                        foreach ($host['hostgroups'] as $hg) {
                            $groupid = $hg['groupid'];
                            if (isset($customer_groups[$groupid])) {
                                if (!isset($group_triggers[$groupid])) {
                                    $group_triggers[$groupid] = [];
                                }
                                $group_triggers[$groupid][] = $trigger;
                            }
                        }
                    }
                }
            }

            // 4. Build group data and apply PROPER OR/AND logic at GROUP level
            $groups_data = [];
            $statistics = [
                'total_groups' => count($customer_groups),
                'healthy_groups' => 0,
                'groups_with_alerts' => 0,
                'total_alerts' => 0,
                'critical_alerts' => 0,
                'high_alerts' => 0,
                'average_alerts' => 0,
                'warning_alerts' => 0,
                'info_alerts' => 0,
                'filtered_groups' => 0
            ];

            $has_active_filters = !empty($filter_severities) || !empty($filter_tags) || !empty($filter_alert_name);

            foreach ($customer_groups as $groupid => $group) {
                $alert_count = 0;
                $highest_severity = 0;
                $severity_counts = [
                    TRIGGER_SEVERITY_DISASTER => 0,
                    TRIGGER_SEVERITY_HIGH => 0,
                    TRIGGER_SEVERITY_AVERAGE => 0,
                    TRIGGER_SEVERITY_WARNING => 0,
                    TRIGGER_SEVERITY_INFORMATION => 0,
                    TRIGGER_SEVERITY_NOT_CLASSIFIED => 0
                ];
                $alert_details = [];
                $group_tags = [];
                
                // Flags for OR/AND logic
                $matches_severity = false;
                $matches_tag = false;
                $matches_name = false;

                if (isset($group_triggers[$groupid])) {
                    $seen_triggers = [];
                    
                    foreach ($group_triggers[$groupid] as $trigger) {
                        // Avoid counting same trigger multiple times
                        if (isset($seen_triggers[$trigger['triggerid']])) {
                            continue;
                        }
                        $seen_triggers[$trigger['triggerid']] = true;

                        $alert_count++;
                        $priority = (int)$trigger['priority'];
                        
                        if ($priority > $highest_severity) {
                            $highest_severity = $priority;
                        }
                        
                        $severity_counts[$priority]++;
                        
                        // Collect tags
                        if (!empty($trigger['tags'])) {
                            foreach ($trigger['tags'] as $tag) {
                                $tag_display = $tag['tag'] . (empty($tag['value']) ? '' : ': ' . $tag['value']);
                                $group_tags[$tag_display] = true;
                            }
                        }
                        
                        // Store alert details
                        $alert_details[] = [
                            'description' => $trigger['description'],
                            'priority' => $priority,
                            'priority_name' => $this->getSeverityName($priority),
                            'tags' => $trigger['tags'] ?? []
                        ];

                        // Update statistics
                        switch ($priority) {
                            case TRIGGER_SEVERITY_DISASTER:
                                $statistics['critical_alerts']++;
                                break;
                            case TRIGGER_SEVERITY_HIGH:
                                $statistics['high_alerts']++;
                                break;
                            case TRIGGER_SEVERITY_AVERAGE:
                                $statistics['average_alerts']++;
                                break;
                            case TRIGGER_SEVERITY_WARNING:
                                $statistics['warning_alerts']++;
                                break;
                            default:
                                $statistics['info_alerts']++;
                                break;
                        }
                        
                        // Check if this trigger matches any filter criteria (for OR/AND logic)
                        if ($has_active_filters) {
                            // Check severity match
                            if (!empty($filter_severities) && in_array((string)$priority, $filter_severities)) {
                                $matches_severity = true;
                            }
                            
                            // Check tag match
                            if (!empty($filter_tags) && !empty($trigger['tags'])) {
                                foreach ($trigger['tags'] as $trigger_tag) {
                                    $trigger_tag_key = $trigger_tag['tag'] . (empty($trigger_tag['value']) ? '' : ': ' . $trigger_tag['value']);
                                    if (in_array($trigger_tag_key, $filter_tags)) {
                                        $matches_tag = true;
                                        break;
                                    }
                                }
                            }
                            
                            // Check name match
                            if (!empty($filter_alert_name) && stripos($trigger['description'], $filter_alert_name) !== false) {
                                $matches_name = true;
                            }
                        }
                    }
                }

                $is_healthy = $alert_count === 0;
                
                if ($is_healthy) {
                    $statistics['healthy_groups']++;
                } else {
                    $statistics['groups_with_alerts']++;
                    $statistics['total_alerts'] += $alert_count;
                }

                // Apply filter logic at GROUP level
                $include_group = true;
                
                if ($has_active_filters) {
                    if ($filter_logic === 'OR') {
                        // OR: Include if matches ANY filter
                        $include_group = false; // Start with false
                        
                        if (!empty($filter_severities) && $matches_severity) {
                            $include_group = true;
                        }
                        if (!empty($filter_tags) && $matches_tag) {
                            $include_group = true;
                        }
                        if (!empty($filter_alert_name) && $matches_name) {
                            $include_group = true;
                        }
                        
                        // If no specific filters set, show groups with alerts
                        if (empty($filter_severities) && empty($filter_tags) && empty($filter_alert_name)) {
                            $include_group = !$is_healthy;
                        }
                        
                    } else {
                        // AND: Include only if matches ALL filters
                        $include_group = true; // Start with true
                        
                        if (!empty($filter_severities) && !$matches_severity) {
                            $include_group = false;
                        }
                        if (!empty($filter_tags) && !$matches_tag) {
                            $include_group = false;
                        }
                        if (!empty($filter_alert_name) && !$matches_name) {
                            $include_group = false;
                        }
                    }
                    
                    // Skip healthy groups when filters are active
                    if ($is_healthy) {
                        $include_group = false;
                    }
                }

                if ($include_group || !$has_active_filters) {
                    $groups_data[] = [
                        'groupid' => $groupid,
                        'name' => $group['name'],
                        'short_name' => str_replace('CUSTOMER/', '', $group['name']),
                        'alert_count' => $alert_count,
                        'is_healthy' => $is_healthy,
                        'highest_severity' => $highest_severity,
                        'severity_counts' => $severity_counts,
                        'alert_details' => $alert_details,
                        'tags' => array_keys($group_tags)
                    ];
                }
            }

            // Apply "show only groups with alerts" filter
            if ($filter_alerts && !$has_active_filters) {
                $groups_data = array_filter($groups_data, function($group) {
                    return !$group['is_healthy'];
                });
            }

            // Apply search filter
            if (!empty($search)) {
                $search_lower = mb_strtolower($search);
                $groups_data = array_filter($groups_data, function($group) use ($search_lower) {
                    return strpos(mb_strtolower($group['name']), $search_lower) !== false;
                });
            }

            $statistics['filtered_groups'] = count($groups_data);

            // Sort by alert count (descending) then by name
            usort($groups_data, function($a, $b) {
                if ($a['alert_count'] != $b['alert_count']) {
                    return $b['alert_count'] - $a['alert_count'];
                }
                return strcmp($a['name'], $b['name']);
            });

            // Calculate health percentage
            $statistics['health_percentage'] = $statistics['total_groups'] > 0 
                ? round(($statistics['healthy_groups'] / $statistics['total_groups']) * 100, 1)
                : 0;

            // Prepare response data
            $data = [
                'statistics' => $statistics,
                'groups' => $groups_data,
                'all_tags' => array_values($all_tags),
                'popular_tags' => $popular_tags,
                'icon_size' => $icon_size,
                'spacing' => $spacing,
                'filter_alerts' => $filter_alerts,
                'search' => $search,
                'filter_severities' => $filter_severities,
                'filter_tags' => $filter_tags,
                'filter_alert_name' => $filter_alert_name,
                'filter_logic' => $filter_logic,
                'refresh' => $refresh,
                'error' => null
            ];

            if ($refresh) {
                CMessageHelper::setSuccessTitle(_('Status page refreshed successfully'));
            }

        } catch (\Exception $e) {
            // Error handling
            $data = [
                'statistics' => [
                    'total_groups' => 0,
                    'healthy_groups' => 0,
                    'groups_with_alerts' => 0,
                    'total_alerts' => 0,
                    'critical_alerts' => 0,
                    'high_alerts' => 0,
                    'average_alerts' => 0,
                    'warning_alerts' => 0,
                    'info_alerts' => 0,
                    'health_percentage' => 0,
                    'filtered_groups' => 0
                ],
                'groups' => [],
                'all_tags' => [],
                'popular_tags' => [],
                'icon_size' => $icon_size,
                'spacing' => $spacing,
                'filter_alerts' => $filter_alerts,
                'search' => $search,
                'filter_severities' => $filter_severities,
                'filter_tags' => $filter_tags,
                'filter_alert_name' => $filter_alert_name,
                'filter_logic' => $filter_logic,
                'refresh' => $refresh,
                'error' => $e->getMessage()
            ];
            
            CMessageHelper::setErrorTitle(_('Failed to fetch data: ') . $e->getMessage());
        }

        $response = new CControllerResponseData($data);
        $response->setTitle(_('Status Page'));
        $this->setResponse($response);
    }

    private function getSeverityName($severity) {
        $names = [
            TRIGGER_SEVERITY_NOT_CLASSIFIED => _('Not classified'),
            TRIGGER_SEVERITY_INFORMATION => _('Information'),
            TRIGGER_SEVERITY_WARNING => _('Warning'),
            TRIGGER_SEVERITY_AVERAGE => _('Average'),
            TRIGGER_SEVERITY_HIGH => _('High'),
            TRIGGER_SEVERITY_DISASTER => _('Disaster')
        ];
        return $names[$severity] ?? _('Unknown');
    }
}
