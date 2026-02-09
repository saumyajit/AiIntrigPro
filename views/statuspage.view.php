<?php
// Get data from controller
$statistics = $data['statistics'] ?? [];
$regional_stats = $data['regional_stats'] ?? [];
$groups = $data['groups'] ?? [];
$all_tags = $data['all_tags'] ?? [];
$popular_tags = $data['popular_tags'] ?? [];
$icon_size = $data['icon_size'] ?? '30';
$spacing = $data['spacing'] ?? 'normal';
$filter_alerts = $data['filter_alerts'] ?? false;
$search = $data['search'] ?? '';
$filter_severities = $data['filter_severities'] ?? [];
$filter_tags = $data['filter_tags'] ?? [];
$filter_alert_name = $data['filter_alert_name'] ?? '';
$filter_logic = $data['filter_logic'] ?? 'OR';
$filter_time_range = $data['filter_time_range'] ?? '';
$filter_time_from = $data['filter_time_from'] ?? '';
$filter_time_to = $data['filter_time_to'] ?? '';
$error = $data['error'] ?? null;

// Spacing values
$spacing_map = [
    'normal' => '8px',
    'compact' => '4px',
    'ultra-compact' => '2px'
];
$gap = $spacing_map[$spacing] ?? '8px';

// Check if filters are active
$has_active_filters = !empty($filter_severities) || !empty($filter_tags) || !empty($filter_alert_name) || !empty($filter_time_range);

// Encode data for JavaScript
$all_tags_json = json_encode(array_column($all_tags, 'display'));
$popular_tags_json = json_encode($popular_tags);
$selected_tags_json = json_encode($filter_tags);
?>

<!DOCTYPE html>
<html>
<head>
    <!-- Chart.js CDN -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        * { box-sizing: border-box; }

        .status-page-wrapper {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            padding: 6px;
            background: #f5f7fa;
            min-height: 100vh;
        }

        /* Header with Legend */
        .page-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 8px;
            border-radius: 12px;
            margin-bottom: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        .page-header h1 {
            margin: 0 0 8px 0;
			text-align: center;
			font-family: "Trebuchet MS", "Lucida Grande", "Lucida Sans Unicode", "Lucida Sans", Tahoma, sans-serif;
            font-size: 30px;
            font-weight: 600;
			line-height: 1.2em;
            text-align: center;
        }

        .page-subtitle {
            font-size: 18px;
			text-align: center;
			font-family: "Trebuchet MS", "Lucida Grande", "Lucida Sans Unicode", "Lucida Sans", Tahoma, sans-serif;
            opacity: 0.95;
            margin: 0 0 15px 0;
            text-align: center;
        }

        .header-legend {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 25px;
            flex-wrap: wrap;
            padding-top: 6px;
            border-top: 1px solid rgba(255,255,255,0.2);
            font-size: 14px;
        }

        .header-legend-label {
            font-weight: 600;
            margin-right: 5px;
        }

        .header-legend-item {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .header-legend-dot {
            width: 14px;
            height: 14px;
            border-radius: 50%;
        }

        .legend-healthy { background: #4caf50; }
        .legend-warning { background: #fbc02d; }
        .legend-average { background: #f57c00; }
        .legend-high { background: #f44336; }
        .legend-disaster { background: #d32f2f; }

        /* Controls Section */
        .controls-section {
            background: white;
            padding: 6px;
            border-radius: 8px;
            margin-bottom: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        .controls-row {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
            align-items: center;
        }

        .control-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .control-group label {
            font-weight: 600;
            font-size: 17px;
            color: #495057;
            white-space: nowrap;
        }

        .control-input {
            padding: 2px 11px;
            border: 1px solid #ced4da;
            border-radius: 6px;
            background: white;
            font-size: 13px;
            min-width: 130px;
            transition: border-color 0.2s;
        }

        .control-input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .search-input {
            min-width: 250px;
        }

        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }

        .btn-primary {
            background: #667eea;
            color: white;
        }

        .btn-primary:hover {
            background: #5568d3;
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
        }

        .btn-secondary {
            background: #6c757d;
            color: white;
        }

        .btn-secondary:hover {
            background: #5a6268;
        }

        .btn-outline {
            background: white;
            color: #667eea;
            border: 2px solid #667eea;
        }

        .btn-outline:hover {
            background: #667eea;
            color: white;
        }

        /* Advanced Filters */
        .advanced-filters {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            margin-bottom: 10px;
            overflow: hidden;
        }

        .filter-header {
            padding: 8px 20px;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-bottom: 1px solid #dee2e6;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            user-select: none;
        }

        .filter-header:hover {
            background: linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%);
        }

        .filter-header-left {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .filter-title {
            font-size: 18px;
            font-weight: 700;
            color: #333;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .filter-badge {
            background: #667eea;
            color: white;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: 600;
        }

        .filter-toggle {
            font-size: 18px;
            transition: transform 0.3s;
        }

        .filter-toggle.collapsed {
            transform: rotate(-90deg);
        }

        .filter-body {
            padding: 20px;
            display: none;
        }

        .filter-body.expanded {
            display: block;
        }

        .filter-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 15px;
        }

        .filter-field {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .filter-label {
            font-weight: 600;
            font-size: 18px;
            color: #495057;
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .filter-input {
            padding: 10px 12px;
            border: 1px solid #ced4da;
            border-radius: 6px;
            background: white;
            font-size: 13px;
            transition: border-color 0.2s;
        }

        .filter-input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        /* Time Range Filter */
        .time-range-section {
            background: white;
            border: 1px solid #ced4da;
            border-radius: 6px;
            padding: 10px;
        }

        .time-presets {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 15px;
        }

        .time-preset-btn {
            padding: 8px 12px;
            background: #eff1f3;
            border: 2px solid #dee2e6;
            border-radius: 6px;
            font-size: 13px;
			font-family: "Trebuchet MS", "Lucida Grande", "Lucida Sans Unicode", "Lucida Sans", Tahoma, sans-serif;
            font-weight: 500;
			color: black;
            cursor: pointer;
            transition: all 0.2s;
            text-align: center;
			line-height: 5px;
        }

        .time-preset-btn:hover {
            border-color: #667eea;
            background: #667eea;
        }

        .time-preset-btn.active {
            background: #667eea;
            color: black;
            border-color: #667eea;
        }

        .custom-range-section {
            padding-top: 15px;
            border-top: 1px solid #e0e0e0;
            display: none;
        }

        .custom-range-section.active {
            display: block;
        }

        .custom-range-label {
            font-weight: 600;
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 10px;
        }

        .custom-range-inputs {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }

        .datetime-group {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }

        .datetime-label {
            font-size: 12px;
            font-weight: 600;
            color: #495057;
        }

        .datetime-input {
            padding: 8px 10px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            font-size: 13px;
        }

        /* Severity Grid (2x2) */
        .severity-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            background: white;
            border: 1px solid #ced4da;
            border-radius: 6px;
            padding: 10px;
        }

        .severity-option {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 1px;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.2s;
        }

        .severity-option:hover {
            background: #f0f0f0;
        }

        .severity-option input[type="checkbox"] {
            width: 16px;
            height: 16px;
            cursor: pointer;
        }

        .severity-option label {
            cursor: pointer;
            flex: 1;
            font-size: 16px;
            color: #495057;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .severity-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
        }

        .severity-disaster { background: #d32f2f; }
        .severity-high { background: #f44336; }
        .severity-average { background: #f57c00; }
        .severity-warning { background: #fbc02d; }

        /* Tag Autocomplete */
        .tag-autocomplete-container {
            position: relative;
        }

        .tag-input-wrapper {
            background: white;
            border: 1px solid #ced4da;
            border-radius: 6px;
            padding: 8px;
            min-height: 80px;
            max-height: 200px;
            overflow-y: auto;
        }

        .tag-input-wrapper:focus-within {
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .selected-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-bottom: 6px;
        }

        .tag-chip {
            background: #667eea;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .tag-chip-remove {
            background: rgba(255,255,255,0.3);
            border: none;
            color: white;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            line-height: 1;
            transition: background 0.2s;
        }

        .tag-chip-remove:hover {
            background: rgba(255,255,255,0.5);
        }

        .tag-input {
            border: none;
            outline: none;
            padding: 6px;
            font-size: 13px;
            min-width: 200px;
            width: 100%;
        }

        .tag-suggestions {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #ced4da;
            border-radius: 6px;
            margin-top: 4px;
            max-height: 250px;
            overflow-y: auto;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: none;
        }

        .tag-suggestions.visible {
            display: block;
        }

        .tag-suggestions-section {
            border-bottom: 1px solid #e0e0e0;
        }

        .tag-suggestions-section:last-child {
            border-bottom: none;
        }

        .tag-suggestions-header {
            padding: 8px 12px;
            background: #f8f9fa;
            font-weight: 600;
            font-size: 11px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .tag-suggestion-item {
            padding: 10px 12px;
            cursor: pointer;
            transition: background 0.2s;
            font-size: 13px;
            color: #495057;
        }

        .tag-suggestion-item:hover {
            background: #f0f0f0;
        }

        .tag-suggestion-item.selected {
            background: #e7f0ff;
        }

        .tag-suggestion-popular {
            color: #667eea;
            font-weight: 600;
        }

        .tag-suggestion-recent {
            color: #28a745;
        }

        .logic-selector {
            display: flex;
            gap: 10px;
            align-items: center;
            background: white;
            padding: 4px 12px;
            border-radius: 6px;
            border: 1px solid #ced4da;
        }

        .logic-option {
            display: flex;
            align-items: center;
            gap: 5px;
            cursor: pointer;
        }

        .logic-option input[type="radio"] {
            cursor: pointer;
        }

        .filter-actions {
            display: flex;
            gap: 10px;
            padding-top: 15px;
            border-top: 1px solid #dee2e6;
        }

        /* Statistics - ENHANCED: Compact single-row layout */
        .statistics-section {
            background: white;
            padding: 8px;
            border-radius: 8px;
            margin-bottom: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        .stats-grid-compact {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 12px;
        }

        .stat-card {
            text-align: center;
            padding: 12px;
            background: linear-gradient(135deg, #f5f7fa 0%, #e8eef3 100%);
            border-radius: 8px;
            border: 2px solid #e0e0e0;
            transition: transform 0.2s;
        }

        .stat-card:hover {
            transform: translateY(-2px);
        }

        .stat-value {
            font-size: 24px;
            font-weight: 700;
            color: #333;
            margin-bottom: 3px;
        }

        .stat-label {
            font-size: 14px;
            font-weight: 600;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        /* Status Page - ENHANCED: New 2-column layout */
        .status-page-section {
            background: white;
            padding: 10px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        .status-with-regional {
            display: grid;
            grid-template-columns: 4fr 1fr;
            gap: 20px;
        }

        .status-grid-container {
            background: linear-gradient(135deg, #f5f7fa 0%, #e8eef3 100%);
            padding: 20px;
            border-radius: 8px;
            min-height: 400px;
            max-height: 800px;
            overflow-y: auto;
        }

        .status-grid {
            display: flex;
            flex-wrap: wrap;
            gap: <?= $gap ?>;
            justify-content: center;
            align-items: flex-start;
        }

        .status-circle {
            width: <?= $icon_size ?>px;
            height: <?= $icon_size ?>px;
            border-radius: 50%;
            cursor: pointer;
            position: relative;
            transition: all 0.2s ease;
            flex-shrink: 0;
        }

        .status-circle:hover {
            transform: scale(1.3);
            z-index: 100;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        /* Status Colors */
        .status-healthy { background: #4caf50; }
        .status-warning { background: #fbc02d; }
        .status-average { background: #f57c00; }
        .status-high { background: #f44336; }
        .status-disaster { background: #d32f2f; }

        /* Alert Badge - ENHANCED: Support up to 999 */
        .alert-badge {
            position: absolute;
            top: -3px;
            right: -3px;
            background: rgba(255, 255, 255, 0.95);
            color: #333;
            border-radius: 8px;
            padding: 1px 5px;
            font-size: 10px;
            font-weight: bold;
            min-width: 16px;
            text-align: center;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
            z-index: 2;
            line-height: 1.4;
        }

        /* ENHANCED: Regional Chart Sidebar */
        .regional-chart-sidebar {
            background: linear-gradient(135deg, #f5f7fa 0%, #e8eef3 100%);
            border-radius: 8px;
            border: 2px solid #e0e0e0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            min-height: 400px;
            position: sticky;
            top: 20px;
        }

        .regional-chart-title {
            font-size: 15px;
            font-weight: 700;
            color: #333;
            text-align: center;
            margin-bottom: 15px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
        }

        .chart-wrapper {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            padding: 10px;
        }

        #regionalChart {
            max-height: 320px;
            cursor: pointer;
        }

        .region-filter-hint {
            text-align: center;
            font-size: 11px;
            color: #666;
            margin-top: 10px;
            padding: 8px;
            background: rgba(255,255,255,0.5);
            border-radius: 4px;
        }

        /* Tooltip */
        .status-tooltip {
            position: fixed;
            background: white;
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
            z-index: 10000;
            max-width: 350px;
            border: 2px solid #e0e0e0;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.15s ease;
            pointer-events: none;
            font-size: 13px;
        }

        .status-tooltip.visible {
            opacity: 1;
            visibility: visible;
        }

        .tooltip-header {
            font-size: 15px;
            font-weight: 700;
            margin-bottom: 10px;
            color: #333;
            padding-bottom: 8px;
            border-bottom: 2px solid #e0e0e0;
        }

        .tooltip-status-ok {
            color: #4caf50;
            font-weight: 600;
            padding: 10px;
            text-align: center;
            font-size: 14px;
        }

        .tooltip-alerts {
            margin-top: 8px;
        }

        .tooltip-alert-summary {
            font-weight: 600;
            color: #333;
            margin-bottom: 6px;
        }

        .tooltip-severity-list {
            font-size: 12px;
            color: #666;
            line-height: 1.6;
        }

        .severity-item {
            display: flex;
            justify-content: space-between;
            padding: 3px 0;
        }

        .severity-disaster-text { color: #d32f2f; font-weight: 600; }
        .severity-high-text { color: #f44336; font-weight: 600; }
        .severity-average-text { color: #f57c00; font-weight: 600; }
        .severity-warning-text { color: #fbc02d; font-weight: 600; }

        /* Empty State */
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #6c757d;
        }

        .empty-state-icon {
            font-size: 64px;
            margin-bottom: 15px;
            opacity: 0.3;
        }

        .empty-state-text {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 5px;
        }

        .empty-state-subtext {
            font-size: 13px;
            color: #adb5bd;
        }

        /* Alert Message */
        .alert-message {
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 15px;
            border-left: 4px solid;
        }

        .alert-error {
            background: #f8d7da;
            border-color: #dc3545;
            color: #721c24;
        }

        /* Loading Overlay */
        .loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            flex-direction: column;
        }

        .loading-overlay.active {
            display: flex;
        }

        .spinner {
            width: 50px;
            height: 50px;
            border: 5px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top-color: #667eea;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .loading-text {
            color: white;
            margin-top: 20px;
            font-size: 16px;
            font-weight: 600;
        }

        /* Responsive */
        @media (max-width: 1200px) {
            .status-with-regional {
                grid-template-columns: 2fr 1fr;
            }
        }

        @media (max-width: 768px) {
            .controls-row {
                flex-direction: column;
                align-items: stretch;
            }

            .control-group {
                flex-direction: column;
                align-items: stretch;
            }

            .stats-grid-compact {
                grid-template-columns: repeat(3, 1fr);
            }

            .status-with-regional {
                grid-template-columns: 1fr;
            }

            .regional-chart-sidebar {
                position: static;
                min-height: 300px;
            }

            .search-input {
                min-width: 100%;
            }

            .filter-grid {
                grid-template-columns: 1fr;
            }

            .severity-grid {
                grid-template-columns: 1fr;
            }

            .time-presets {
                grid-template-columns: repeat(2, 1fr);
            }

            .custom-range-inputs {
                grid-template-columns: 1fr;
            }

            .header-legend {
                font-size: 11px;
                gap: 15px;
            }
        }

		/* Regional Chart Sidebar - Space Optimized */
		.regional-chart-sidebar {
			background: linear-gradient(135deg, #f5f7fa 0%, #e8eef3 100%);
			border-radius: 8px;
			border: 2px solid #e0e0e0;
			padding: 15px;
			display: flex;
			flex-direction: column;
			min-height: 400px;
			max-height: 800px;
			position: sticky;
			top: 20px;
		}

		.regional-chart-title {
			font-size: 14px;
			font-weight: 700;
			color: #333;
			text-align: center;
			margin-bottom: 12px;
			text-transform: uppercase;
			letter-spacing: 0.8px;
			padding-bottom: 10px;
			border-bottom: 2px solid #dee2e6;
		}

		.regional-chart-content {
			flex: 1;
			display: flex;
			flex-direction: column;
			overflow-y: auto;
		}

		.chart-canvas-wrapper {
			position: relative;
			width: 100%;
			padding: 10px;
			display: flex;
			align-items: center;
			justify-content: center;
		}

		#regionalChart {
			max-width: 100%;
			max-height: 280px;
			cursor: pointer;
		}

		/* Center Content for Donut Chart */
		.chart-center-content {
			position: absolute;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			text-align: center;
			pointer-events: none;
		}

		.chart-center-value {
			font-size: 36px;
			font-weight: 700;
			color: #333;
			line-height: 1;
		}

		.chart-center-label {
			font-size: 11px;
			color: #666;
			margin-top: 4px;
			text-transform: uppercase;
			letter-spacing: 0.5px;
		}

		/* Regional Stats List */
		.regional-stats-list {
			margin-top: 15px;
			padding-top: 15px;
			border-top: 2px solid #dee2e6;
		}

		.regional-stat-item {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 10px 12px;
			margin-bottom: 8px;
			background: white;
			border-radius: 6px;
			border-left: 4px solid;
			transition: all 0.2s;
			cursor: pointer;
		}

		.regional-stat-item:hover {
			transform: translateX(3px);
			box-shadow: 0 2px 8px rgba(0,0,0,0.1);
		}

		.regional-stat-item.filtered {
			background: #e8f4fd;
			box-shadow: 0 2px 8px rgba(52, 152, 219, 0.3);
		}

		.regional-stat-left {
			display: flex;
			align-items: center;
			gap: 10px;
		}

		.regional-stat-color {
			width: 12px;
			height: 12px;
			border-radius: 50%;
			flex-shrink: 0;
		}

		.regional-stat-name {
			font-weight: 600;
			font-size: 13px;
			color: #333;
		}

		.regional-stat-right {
			display: flex;
			flex-direction: column;
			align-items: flex-end;
			gap: 2px;
		}

		.regional-stat-total {
			font-weight: 700;
			font-size: 16px;
			color: #333;
		}

		.regional-stat-breakdown {
			font-size: 10px;
			color: #666;
		}

		.region-filter-hint {
			text-align: center;
			font-size: 10px;
			color: #666;
			margin-top: 12px;
			padding: 8px;
			background: rgba(255,255,255,0.6);
			border-radius: 4px;
		}

		/* Color coding for regions */
		.region-us { border-left-color: #e74c3c; }
		.region-eu { border-left-color: #3498db; }
		.region-asia { border-left-color: #2ecc71; }
		.region-aus { border-left-color: #f39c12; }
		.region-dallas { border-left-color: #9b59b6; }
		.region-kansas { border-left-color: #e67e22; }
		.region-slough { border-left-color: #1abc9c; }
		.region-frankfurt { border-left-color: #34495e; }
		.region-other { border-left-color: #95a5a6; }

		/* Active filter banner */
		.region-filter-active {
			background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
			color: white;
			padding: 10px 12px;
			border-radius: 6px;
			margin-bottom: 12px;
			display: none;
			align-items: center;
			justify-content: space-between;
			animation: slideDown 0.3s ease;
		}

		.region-filter-active.visible {
			display: flex;
		}

		@keyframes slideDown {
			from {
				opacity: 0;
				transform: translateY(-10px);
			}
			to {
				opacity: 1;
				transform: translateY(0);
			}
		}

		.filter-active-text {
			display: flex;
			align-items: center;
			gap: 8px;
			font-size: 13px;
			font-weight: 600;
		}

		.filter-active-region {
			font-weight: 700;
			font-size: 14px;
		}

		.filter-clear-btn {
			background: rgba(255, 255, 255, 0.2);
			border: 1px solid rgba(255, 255, 255, 0.4);
			color: white;
			padding: 5px 12px;
			border-radius: 4px;
			font-size: 12px;
			font-weight: 600;
			cursor: pointer;
			transition: all 0.2s;
		}

		.filter-clear-btn:hover {
			background: rgba(255, 255, 255, 0.3);
			transform: scale(1.05);
		}

		/* Update hint to show clear instruction */
		.region-filter-hint.with-filter {
			background: #fff3cd;
			color: #856404;
			border: 1px solid #ffc107;
			font-weight: 600;
		}
		
		/* ========== TOP 10 GROUPS BY ALERTS ========== */
		.top-groups-list {
			margin-top: 15px;
			padding-top: 15px;
			border-top: 2px solid #dee2e6;
			max-height: 300px;
			overflow-y: auto;
		}
		
		.top-groups-title {
			font-size: 13px;
			font-weight: 700;
			color: #333;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			margin-bottom: 12px;
			padding-bottom: 8px;
			border-bottom: 1px solid #e0e0e0;
			text-align: center;
		}
		
		.top-group-item {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 10px 12px;
			margin-bottom: 6px;
			background: white;
			border-radius: 6px;
			border-left: 4px solid;
			transition: all 0.2s;
			font-size: 12px;
		}
		
		.top-group-item:hover {
			transform: translateX(3px);
			box-shadow: 0 2px 8px rgba(0,0,0,0.1);
		}
		
		.top-group-left {
			display: flex;
			align-items: center;
			gap: 8px;
			flex: 1;
			min-width: 0;
		}
		
		.top-group-rank {
			font-weight: 700;
			font-size: 14px;
			color: #666;
			min-width: 20px;
		}
		
		.top-group-name {
			font-weight: 600;
			font-size: 12px;
			color: #333;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		
		.top-group-right {
			display: flex;
			align-items: center;
			gap: 8px;
		}
		
		.top-group-region-badge {
			font-size: 10px;
			padding: 2px 6px;
			border-radius: 3px;
			font-weight: 600;
			color: white;
		}
		
		.top-group-count {
			font-weight: 700;
			font-size: 14px;
			color: #333;
			background: rgba(0,0,0,0.05);
			padding: 4px 8px;
			border-radius: 4px;
			min-width: 35px;
			text-align: center;
		}
		
		/* Severity border colors */
		.severity-border-disaster { border-left-color: #d32f2f; }
		.severity-border-high { border-left-color: #f44336; }
		.severity-border-average { border-left-color: #f57c00; }
		.severity-border-warning { border-left-color: #fbc02d; }
		
		/* Region badge colors */
		.region-badge-us { background: #e74c3c; }
		.region-badge-eu { background: #3498db; }
		.region-badge-asia { background: #2ecc71; }
		.region-badge-aus { background: #f39c12; }
		.region-badge-dallas { background: #9b59b6; }
		.region-badge-kansas { background: #e67e22; }
		.region-badge-slough { background: #1abc9c; }
		.region-badge-frankfurt { background: #34495e; }
		.region-badge-other { background: #95a5a6; }
		
		/* Empty state */
		.top-groups-empty {
			text-align: center;
			padding: 20px;
			color: #999;
			font-size: 12px;
			font-style: italic;
		}
		
		/* Scrollbar styling */
		.top-groups-list::-webkit-scrollbar {
			width: 6px;
		}
		
		.top-groups-list::-webkit-scrollbar-track {
			background: #f1f1f1;
			border-radius: 3px;
		}
		
		.top-groups-list::-webkit-scrollbar-thumb {
			background: #888;
			border-radius: 3px;
		}
		
		.top-groups-list::-webkit-scrollbar-thumb:hover {
			background: #555;
		}
		
		/* Responsive */
		@media (max-width: 768px) {
			.top-groups-list {
				max-height: 200px;
			}
			
			.top-group-name {
				max-width: 120px;
			}
		}
    </style>
</head>
<body>
    <div class="status-page-wrapper">
        <!-- Header with Legend -->
        <div class="page-header">
            <h1><?= _('Status Dashboard') ?></h1>
            <p class="page-subtitle"><?= _('Visual overview of customer host groups') ?></p>

            <div class="header-legend">
                <span class="header-legend-label"><?= _('Legend:') ?></span>
                <div class="header-legend-item">
                    <span class="header-legend-dot legend-healthy"></span>
                    <span><?= _('Healthy') ?></span>
                </div>
                <div class="header-legend-item">
                    <span class="header-legend-dot legend-warning"></span>
                    <span><?= _('Low') ?></span>
                </div>
                <div class="header-legend-item">
                    <span class="header-legend-dot legend-average"></span>
                    <span><?= _('Medium') ?></span>
                </div>
                <div class="header-legend-item">
                    <span class="header-legend-dot legend-high"></span>
                    <span><?= _('High') ?></span>
                </div>
                <div class="header-legend-item">
                    <span class="header-legend-dot legend-disaster"></span>
                    <span><?= _('Critical') ?></span>
                </div>
                <div class="header-legend-item">
                    <span style="display: inline-block; width: 18px; height: 14px; border-radius: 6px; background: rgba(255,255,255,0.95); color: #333; text-align: center; font-size: 9px; line-height: 14px; font-weight: bold; border: 1px solid rgba(255,255,255,0.5);">2</span>
                    <span><?= _('Alert count') ?></span>
                </div>
            </div>
        </div>

        <!-- Main Controls -->
        <div class="controls-section">
            <form method="GET" action="zabbix.php" id="mainForm">
                <input type="hidden" name="action" value="status.page">

                <div class="controls-row">
                    <div class="control-group">
                        <label for="search"><?= _('Search Groups:') ?></label>
                        <input type="text"
                               id="search"
                               name="search"
                               class="control-input search-input"
                               placeholder="<?= _('Search host groups...') ?>"
                               value="<?= htmlspecialchars($search) ?>">
                    </div>

                    <div class="control-group">
                        <label for="icon_size"><?= _('Icon Size:') ?></label>
                        <select name="icon_size" id="icon_size" class="control-input">
                            <option value="20" <?= $icon_size === '20' ? 'selected' : '' ?>>Tiny (20px)</option>
                            <option value="25" <?= $icon_size === '25' ? 'selected' : '' ?>>Small (25px)</option>
                            <option value="30" <?= $icon_size === '30' ? 'selected' : '' ?>>Medium (30px)</option>
                            <option value="35" <?= $icon_size === '35' ? 'selected' : '' ?>>Large (35px)</option>
                            <option value="40" <?= $icon_size === '40' ? 'selected' : '' ?>>X-Large (40px)</option>
                        </select>
                    </div>

                    <div class="control-group">
                        <label for="spacing"><?= _('Spacing:') ?></label>
                        <select name="spacing" id="spacing" class="control-input">
                            <option value="normal" <?= $spacing === 'normal' ? 'selected' : '' ?>>Normal</option>
                            <option value="compact" <?= $spacing === 'compact' ? 'selected' : '' ?>>Compact</option>
                            <option value="ultra-compact" <?= $spacing === 'ultra-compact' ? 'selected' : '' ?>>Ultra Compact</option>
                        </select>
                    </div>

                    <button type="submit" class="btn btn-primary">
                        <span>⚡</span>
                        <?= _('Apply') ?>
                    </button>

                    <button type="button" class="btn btn-secondary" id="refreshBtn">
                        <span>🔄</span>
                        <?= _('Refresh') ?>
                    </button>
                </div>
            </form>
        </div>

        <!-- Advanced Filters -->
        <div class="advanced-filters">
            <div class="filter-header" id="filterHeader">
                <div class="filter-header-left">
                    <span class="filter-toggle <?= $has_active_filters ? '' : 'collapsed' ?>" id="filterToggle">▼</span>
                    <div class="filter-title">
                        <span>🔍 <?= _('Advanced Filters') ?></span>
                        <?php if ($has_active_filters): ?>
                            <span class="filter-badge"><?= _('Active') ?></span>
                        <?php endif; ?>
                    </div>
                </div>
                <span style="font-size: 12px; color: #666;">
                    <?= $has_active_filters ? _('Click to collapse') : _('Click to expand') ?>
                </span>
            </div>

            <div class="filter-body <?= $has_active_filters ? 'expanded' : '' ?>" id="filterBody">
                <form method="GET" action="zabbix.php" id="filterForm">
                    <input type="hidden" name="action" value="status.page">
                    <input type="hidden" name="icon_size" value="<?= htmlspecialchars($icon_size) ?>">
                    <input type="hidden" name="spacing" value="<?= htmlspecialchars($spacing) ?>">
                    <input type="hidden" name="search" value="<?= htmlspecialchars($search) ?>">
                    <input type="hidden" name="filter_time_range" id="filterTimeRange" value="<?= htmlspecialchars($filter_time_range) ?>">

                    <div class="filter-grid">
                        <!-- Time Range Filter -->
                        <div class="filter-field">
                            <label class="filter-label">
                                ⏰ <?= _('Time Range') ?>
                            </label>
                            <div class="time-range-section">
                                <div class="time-presets">
                                    <button type="button" class="time-preset-btn <?= $filter_time_range === '1h' ? 'active' : '' ?>" data-range="1h">1 <?= _('Hour') ?></button>
                                    <button type="button" class="time-preset-btn <?= $filter_time_range === '3h' ? 'active' : '' ?>" data-range="3h">3 <?= _('Hours') ?></button>
                                    <button type="button" class="time-preset-btn <?= $filter_time_range === '6h' ? 'active' : '' ?>" data-range="6h">6 <?= _('Hours') ?></button>
                                    <button type="button" class="time-preset-btn <?= $filter_time_range === '12h' ? 'active' : '' ?>" data-range="12h">12 <?= _('Hours') ?></button>
                                    <button type="button" class="time-preset-btn <?= $filter_time_range === '24h' ? 'active' : '' ?>" data-range="24h">24 <?= _('Hours') ?></button>
                                    <button type="button" class="time-preset-btn <?= $filter_time_range === '3d' ? 'active' : '' ?>" data-range="3d">3 <?= _('Days') ?></button>
                                    <button type="button" class="time-preset-btn <?= $filter_time_range === '7d' ? 'active' : '' ?>" data-range="7d">7 <?= _('Days') ?></button>
                                    <button type="button" class="time-preset-btn <?= $filter_time_range === '15d' ? 'active' : '' ?>" data-range="15d">15 <?= _('Days') ?></button>
                                    <button type="button" class="time-preset-btn <?= $filter_time_range === '30d' ? 'active' : '' ?>" data-range="30d">30 <?= _('Days') ?></button>
                                </div>

                                <button type="button" class="time-preset-btn <?= $filter_time_range === 'custom' ? 'active' : '' ?>" data-range="custom" id="customRangeBtn" style="width: 100%;">
                                    🕐 <?= _('Custom Range') ?>
                                </button>

                                <div class="custom-range-section <?= $filter_time_range === 'custom' ? 'active' : '' ?>" id="customRangeSection">
                                    <div class="custom-range-label"><?= _('Custom Time Range') ?></div>
                                    <div class="custom-range-inputs">
                                        <div class="datetime-group">
                                            <label class="datetime-label"><?= _('From') ?></label>
                                            <input type="datetime-local"
                                                   name="filter_time_from"
                                                   id="filterTimeFrom"
                                                   class="datetime-input"
                                                   value="<?= htmlspecialchars($filter_time_from) ?>">
                                        </div>
                                        <div class="datetime-group">
                                            <label class="datetime-label"><?= _('To') ?></label>
                                            <input type="datetime-local"
                                                   name="filter_time_to"
                                                   id="filterTimeTo"
                                                   class="datetime-input"
                                                   value="<?= htmlspecialchars($filter_time_to) ?>">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Alert Severity Filter (2x2 Grid) -->
                        <div class="filter-field">
                            <label class="filter-label">
                                ⚠️ <?= _('Alert Severity') ?>
                            </label>
                            <div class="severity-grid">
                                <?php
                                $severities = [
                                    TRIGGER_SEVERITY_DISASTER => ['name' => _('Critical'), 'class' => 'disaster'],
                                    TRIGGER_SEVERITY_HIGH => ['name' => _('High'), 'class' => 'high'],
                                    TRIGGER_SEVERITY_AVERAGE => ['name' => _('Medium'), 'class' => 'average'],
                                    TRIGGER_SEVERITY_WARNING => ['name' => _('Low'), 'class' => 'warning']
                                ];
                                foreach ($severities as $sev_value => $sev_info):
                                    $checked = in_array((string)$sev_value, $filter_severities);
                                ?>
                                <div class="severity-option">
                                    <input type="checkbox"
                                           name="filter_severities[]"
                                           value="<?= $sev_value ?>"
                                           id="sev_<?= $sev_value ?>"
                                           <?= $checked ? 'checked' : '' ?>>
                                    <label for="sev_<?= $sev_value ?>">
                                        <span class="severity-dot severity-<?= $sev_info['class'] ?>"></span>
                                        <?= $sev_info['name'] ?>
                                    </label>
                                </div>
                                <?php endforeach; ?>
                            </div>
                        </div>

                        <!-- Alert Tags Filter (Autocomplete) -->
                        <div class="filter-field">
                            <label class="filter-label">
                                🏷️ <?= _('Alert Tags') ?>
                            </label>
                            <div class="tag-autocomplete-container">
                                <div class="tag-input-wrapper">
                                    <div class="selected-tags" id="selectedTags"></div>
                                    <input type="text"
                                           id="tagInput"
                                           class="tag-input"
                                           placeholder="<?= _('Type to search tags...') ?>"
                                           autocomplete="off">
                                </div>
                                <div class="tag-suggestions" id="tagSuggestions"></div>
                            </div>
                        </div>

                        <!-- Alert Name Filter -->
                        <div class="filter-field">
                            <label class="filter-label" for="filter_alert_name">
                                📝 <?= _('Alert Name (contains)') ?>
                            </label>
                            <input type="text"
                                   id="filter_alert_name"
                                   name="filter_alert_name"
                                   class="filter-input"
                                   placeholder="<?= _('Search in alert descriptions...') ?>"
                                   value="<?= htmlspecialchars($filter_alert_name) ?>">
                        </div>
                    </div>

                    <div class="filter-actions">
                        <div class="logic-selector">
                            <span style="font-weight: 600; font-size: 16px; color: #495057;"><?= _('Filter Logic:') ?></span>
                            <div class="logic-option">
                                <input type="radio"
                                       name="filter_logic"
                                       value="OR"
                                       id="logic_or"
                                       <?= $filter_logic === 'OR' ? 'checked' : '' ?>>
                                <label for="logic_or" style="cursor: pointer; font-size: 15px;">OR (any match)</label>
                            </div>
                            <div class="logic-option">
                                <input type="radio"
                                       name="filter_logic"
                                       value="AND"
                                       id="logic_and"
                                       <?= $filter_logic === 'AND' ? 'checked' : '' ?>>
                                <label for="logic_and" style="cursor: pointer; font-size: 15px;">AND (all match)</label>
                            </div>
                        </div>

                        <button type="submit" class="btn btn-primary">
                            <span>✓</span>
                            <?= _('Apply Filters') ?>
                        </button>

                        <button type="button" class="btn btn-outline" id="clearFilters">
                            <span>✕</span>
                            <?= _('Clear All') ?>
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- ENHANCED: Compact Statistics (Single Row, No Regional Chart) -->
        <div class="statistics-section">
            <div class="stats-grid-compact">
                <div class="stat-card">
                    <div class="stat-value"><?= $statistics['total_groups'] ?></div>
                    <div class="stat-label"><?= _('Customer Group') ?></div>
                </div>
                <div class="stat-card">
                    <div class="stat-value"><?= $statistics['healthy_groups'] ?></div>
                    <div class="stat-label"><?= _('Healthy') ?></div>
                </div>
                <div class="stat-card">
                    <div class="stat-value"><?= $statistics['groups_with_alerts'] ?></div>
                    <div class="stat-label"><?= _('With Alerts') ?></div>
                </div>
                <div class="stat-card">
                    <div class="stat-value"><?= $statistics['filtered_groups'] ?></div>
                    <div class="stat-label"><?= _('Showing') ?></div>
                </div>
                <div class="stat-card">
                    <div class="stat-value"><?= $statistics['total_alerts'] ?></div>
                    <div class="stat-label"><?= _('Total Alerts') ?></div>
                </div>
                <div class="stat-card">
                    <div class="stat-value"><?= $statistics['health_percentage'] ?>%</div>
                    <div class="stat-label"><?= _('Health') ?></div>
                </div>
            </div>
        </div>

        <!-- Error Message -->
        <?php if ($error): ?>
            <div class="alert-message alert-error">
                <strong><?= _('Error:') ?></strong> <?= htmlspecialchars($error) ?>
            </div>
        <?php endif; ?>

        <!-- ENHANCED: Status Page with Regional Distribution on Right Side -->
        <div class="status-page-section">
            <div class="status-with-regional">
                <!-- Status Grid (Left Side - 75%) -->
                <div class="status-grid-container">
                    <?php if (!empty($groups)): ?>
                        <div class="status-grid">
                            <?php foreach ($groups as $group): ?>
                                <?php
                                $status_class = 'status-healthy';
                                if (!$group['is_healthy']) {
                                    switch ($group['highest_severity']) {
                                        case TRIGGER_SEVERITY_DISASTER:
                                            $status_class = 'status-disaster';
                                            break;
                                        case TRIGGER_SEVERITY_HIGH:
                                            $status_class = 'status-high';
                                            break;
                                        case TRIGGER_SEVERITY_AVERAGE:
                                            $status_class = 'status-average';
                                            break;
                                        default:
                                            $status_class = 'status-warning';
                                            break;
                                    }
                                }

                                $tooltip_data = [
                                    'name' => $group['short_name'],
                                    'alertCount' => $group['alert_count'],
                                    'isHealthy' => $group['is_healthy'],
                                    'severityCounts' => $group['severity_counts']
                                ];
                                ?>
                                <div class="status-circle <?= $status_class ?>"
                                     data-groupid="<?= $group['groupid'] ?>"
                                     data-tooltip="<?= htmlspecialchars(json_encode($tooltip_data, JSON_HEX_QUOT | JSON_HEX_APOS), ENT_QUOTES, 'UTF-8') ?>"
                                     data-region="<?= $group['region'] ?>">
                                    <?php if ($group['alert_count'] > 0 && $icon_size >= 25): ?>
                                        <div class="alert-badge">
                                            <?= $group['alert_count'] > 999 ? '999+' : $group['alert_count'] ?>
                                        </div>
                                    <?php endif; ?>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    <?php else: ?>
                        <div class="empty-state">
                            <div class="empty-state-icon">📊</div>
                            <div class="empty-state-text"><?= _('No host groups found') ?></div>
                            <div class="empty-state-subtext">
                                <?= $has_active_filters ? _('Try adjusting your filters') : _('No CUSTOMER/ groups available') ?>
                            </div>
                        </div>
                    <?php endif; ?>
                </div>

                <!-- ENHANCED: Regional Distribution Chart (Right Side - 25%) -->
				<div class="regional-chart-sidebar">
					<div class="regional-chart-title">📍 Regional Distribution</div>

					<!-- Active Filter Banner (Hidden by default) -->
					<div class="region-filter-active" id="regionFilterActive">
						<div class="filter-active-text">
							<span>🔍 Filtering:</span>
							<span class="filter-active-region" id="filterActiveRegion"></span>
						</div>
						<button class="filter-clear-btn" id="clearFilterBtn">
							✕ Clear
						</button>
					</div>

					<div class="regional-chart-content">
						<!-- Donut Chart -->
						<div class="chart-canvas-wrapper">
							<canvas id="regionalChart"></canvas>
							<div class="chart-center-content">
								<div class="chart-center-value" id="chartCenterValue">0</div>
								<div class="chart-center-label">Customer</div>
							</div>
						</div>

						<!-- Regional Stats List -->
						<div class="regional-stats-list" id="regionalStatsList"></div>
					</div>
					
					<div class="top-groups-list">
						<div class="top-groups-title">🔥 Top 10 Customer by Alerts</div>
						<?php
						// Process existing $groups data to get top 10 by alerts
						$groups_with_alerts = array_filter($groups, function($group) {
							return !$group['is_healthy'] && $group['alert_count'] > 0;
						});
						
						// Sort by alert count descending
						usort($groups_with_alerts, function($a, $b) {
							return $b['alert_count'] - $a['alert_count'];
						});
						
						// Take top 10
						$top_10_groups = array_slice($groups_with_alerts, 0, 10);
						?>
						
						<?php if (!empty($top_10_groups)): ?>
							<?php foreach ($top_10_groups as $index => $group): 
								// Determine severity class
								$severity_class = 'severity-border-warning';
								if ($group['highest_severity'] == TRIGGER_SEVERITY_DISASTER) {
									$severity_class = 'severity-border-disaster';
								} elseif ($group['highest_severity'] == TRIGGER_SEVERITY_HIGH) {
									$severity_class = 'severity-border-high';
								} elseif ($group['highest_severity'] == TRIGGER_SEVERITY_AVERAGE) {
									$severity_class = 'severity-border-average';
								}
								
								// Region badge class
								$region_badge_class = 'region-badge-' . strtolower($group['region']);
							?>
							<div class="top-group-item <?= $severity_class ?>">
								<div class="top-group-left">
									<span class="top-group-rank"><?= $index + 1 ?></span>
									<span class="top-group-name" title="<?= htmlspecialchars($group['short_name']) ?>">
										<?= htmlspecialchars($group['short_name']) ?>
									</span>
								</div>
								<div class="top-group-right">
									<span class="top-group-region-badge <?= $region_badge_class ?>">
										<?= htmlspecialchars($group['region']) ?>
									</span>
									<span class="top-group-count"><?= $group['alert_count'] ?></span>
								</div>
							</div>
							<?php endforeach; ?>
						<?php else: ?>
							<div class="top-groups-empty">
								✅ No groups with alerts
							</div>
						<?php endif; ?>
					</div>
				</div>				
            </div>
        </div>

        <!-- Tooltip -->
        <div class="status-tooltip" id="tooltip"></div>

        <!-- Loading Overlay -->
        <div class="loading-overlay" id="loadingOverlay">
            <div class="spinner"></div>
            <div class="loading-text"><?= _('Loading...') ?></div>
        </div>
    </div>

    <script>
        (function() {
            'use strict';

            // Data from PHP
            const allTags = <?= $all_tags_json ?>;
            const popularTags = <?= $popular_tags_json ?>;
            const selectedTagsInitial = <?= $selected_tags_json ?>;

            // Tag autocomplete functionality
            let selectedTags = [...selectedTagsInitial];
            let recentTags = JSON.parse(localStorage.getItem('zabbix_status_recent_tags') || '[]');

            const tagInput = document.getElementById('tagInput');
            const selectedTagsContainer = document.getElementById('selectedTags');
            const tagSuggestions = document.getElementById('tagSuggestions');

            // Initialize
            renderSelectedTags();

            // Tag input events
            tagInput.addEventListener('input', function(e) {
                const searchTerm = e.target.value.toLowerCase();
                if (searchTerm.length === 0) {
                    showDefaultSuggestions();
                } else {
                    const filtered = allTags.filter(tag =>
                        tag.toLowerCase().includes(searchTerm) && !selectedTags.includes(tag)
                    );
                    showSuggestions(filtered, searchTerm);
                }
            });

            tagInput.addEventListener('focus', function() {
                if (tagInput.value.length === 0) {
                    showDefaultSuggestions();
                }
            });

            tagInput.addEventListener('blur', function() {
                setTimeout(() => hideSuggestions(), 200);
            });

            function showDefaultSuggestions() {
                let html = '';

                // Recent tags
                if (recentTags.length > 0) {
                    const recentAvailable = recentTags.filter(tag => !selectedTags.includes(tag)).slice(0, 5);
                    if (recentAvailable.length > 0) {
                        html += '<div class="tag-suggestions-section">';
                        html += '<div class="tag-suggestions-header">Recently Used</div>';
                        recentAvailable.forEach(tag => {
                            html += `<div class="tag-suggestion-item tag-suggestion-recent" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</div>`;
                        });
                        html += '</div>';
                    }
                }

                // Popular tags
                if (popularTags.length > 0) {
                    const popularAvailable = popularTags.filter(tag => !selectedTags.includes(tag)).slice(0, 10);
                    if (popularAvailable.length > 0) {
                        html += '<div class="tag-suggestions-section">';
                        html += '<div class="tag-suggestions-header">Popular Tags</div>';
                        popularAvailable.forEach(tag => {
                            html += `<div class="tag-suggestion-item tag-suggestion-popular" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</div>`;
                        });
                        html += '</div>';
                    }
                }

                if (html) {
                    tagSuggestions.innerHTML = html;
                    tagSuggestions.classList.add('visible');
                    bindSuggestionClicks();
                }
            }

            function showSuggestions(tags, searchTerm) {
                if (tags.length === 0) {
                    hideSuggestions();
                    return;
                }

                let html = '<div class="tag-suggestions-section">';
                html += `<div class="tag-suggestions-header">Matching Tags (${tags.length})</div>`;
                tags.slice(0, 50).forEach(tag => {
                    html += `<div class="tag-suggestion-item" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</div>`;
                });
                if (tags.length > 50) {
                    html += `<div class="tag-suggestion-item" style="text-align:center; color:#999; font-style:italic;">${tags.length - 50} more...</div>`;
                }
                html += '</div>';

                tagSuggestions.innerHTML = html;
                tagSuggestions.classList.add('visible');
                bindSuggestionClicks();
            }

            function hideSuggestions() {
                tagSuggestions.classList.remove('visible');
            }

            function bindSuggestionClicks() {
                document.querySelectorAll('.tag-suggestion-item[data-tag]').forEach(item => {
                    item.addEventListener('mousedown', function(e) {
                        e.preventDefault();
                        const tag = this.dataset.tag;
                        addTag(tag);
                    });
                });
            }

            function addTag(tag) {
                if (!selectedTags.includes(tag)) {
                    selectedTags.push(tag);

                    // Update recent tags
                    recentTags = recentTags.filter(t => t !== tag);
                    recentTags.unshift(tag);
                    recentTags = recentTags.slice(0, 10);
                    localStorage.setItem('zabbix_status_recent_tags', JSON.stringify(recentTags));

                    renderSelectedTags();
                    tagInput.value = '';
                    hideSuggestions();
                    tagInput.focus();
                }
            }

            function removeTag(tag) {
                selectedTags = selectedTags.filter(t => t !== tag);
                renderSelectedTags();
            }

            function renderSelectedTags() {
                // Render chips
                let html = '';
                selectedTags.forEach(tag => {
                    html += `<div class="tag-chip">
                        <span>${escapeHtml(tag)}</span>
                        <button type="button" class="tag-chip-remove" data-tag="${escapeHtml(tag)}">×</button>
                    </div>`;
                });
                selectedTagsContainer.innerHTML = html;

                // Bind remove buttons
                document.querySelectorAll('.tag-chip-remove').forEach(btn => {
                    btn.addEventListener('click', function() {
                        removeTag(this.dataset.tag);
                    });
                });

                // Update hidden inputs
                const form = document.getElementById('filterForm');
                form.querySelectorAll('input[name="filter_tags[]"]').forEach(input => input.remove());
                selectedTags.forEach(tag => {
                    const input = document.createElement('input');
                    input.type = 'hidden';
                    input.name = 'filter_tags[]';
                    input.value = tag;
                    form.appendChild(input);
                });
            }

            // Time range preset buttons
            document.querySelectorAll('.time-preset-btn[data-range]').forEach(btn => {
                btn.addEventListener('click', function() {
                    const range = this.dataset.range;

                    // Remove active from all
                    document.querySelectorAll('.time-preset-btn').forEach(b => b.classList.remove('active'));

                    // Add active to clicked
                    this.classList.add('active');

                    // Update hidden field
                    document.getElementById('filterTimeRange').value = range;

                    // Show/hide custom range
                    if (range === 'custom') {
                        document.getElementById('customRangeSection').classList.add('active');
                    } else {
                        document.getElementById('customRangeSection').classList.remove('active');
                    }
                });
            });

            // Filter panel toggle
            const filterHeader = document.getElementById('filterHeader');
            const filterBody = document.getElementById('filterBody');
            const filterToggle = document.getElementById('filterToggle');

            filterHeader.addEventListener('click', function() {
                filterBody.classList.toggle('expanded');
                filterToggle.classList.toggle('collapsed');
            });

            // Tooltip handling
            const tooltip = document.getElementById('tooltip');
            let currentCircle = null;

            document.querySelectorAll('.status-circle').forEach(circle => {
                circle.addEventListener('mouseenter', function(e) {
                    showTooltip(e, this);
                });

                circle.addEventListener('mouseleave', function() {
                    hideTooltip();
                });

                circle.addEventListener('mousemove', function(e) {
                    updateTooltipPosition(e);
                });

                circle.addEventListener('click', function() {
                    const groupid = this.dataset.groupid;
                    if (groupid) {
                        window.open(`zabbix.php?action=hostgroup.edit&groupid=${groupid}`, '_blank');
                    }
                });
            });

            function showTooltip(event, circle) {
                currentCircle = circle;
                const data = JSON.parse(circle.dataset.tooltip);

                let html = `<div class="tooltip-header">${escapeHtml(data.name)}</div>`;

                if (data.isHealthy) {
                    html += '<div class="tooltip-status-ok">✓ No active alerts</div>';
                } else {
                    html += '<div class="tooltip-alerts">';
                    html += `<div class="tooltip-alert-summary">Active Alerts: ${data.alertCount}</div>`;
                    html += '<div class="tooltip-severity-list">';

                    if (data.severityCounts[5] > 0) {
                        html += `<div class="severity-item"><span class="severity-disaster-text">● Critical</span> <span>${data.severityCounts[5]}</span></div>`;
                    }
                    if (data.severityCounts[4] > 0) {
                        html += `<div class="severity-item"><span class="severity-high-text">● High</span> <span>${data.severityCounts[4]}</span></div>`;
                    }
                    if (data.severityCounts[3] > 0) {
                        html += `<div class="severity-item"><span class="severity-average-text">● Medium</span> <span>${data.severityCounts[3]}</span></div>`;
                    }
                    if (data.severityCounts[2] > 0) {
                        html += `<div class="severity-item"><span class="severity-warning-text">● Low</span> <span>${data.severityCounts[2]}</span></div>`;
                    }

                    html += '</div></div>';
                }

                tooltip.innerHTML = html;
                tooltip.classList.add('visible');
                updateTooltipPosition(event);
            }

            function hideTooltip() {
                tooltip.classList.remove('visible');
                currentCircle = null;
            }

            function updateTooltipPosition(event) {
                if (!currentCircle) return;

                const offset = 15;
                let left = event.pageX + offset;
                let top = event.pageY + offset;

                const tooltipRect = tooltip.getBoundingClientRect();

                // Prevent overflow right
                if (left + tooltipRect.width > window.innerWidth) {
                    left = event.pageX - tooltipRect.width - offset;
                }

                // Prevent overflow bottom
                if (top + tooltipRect.height > window.innerHeight + window.scrollY) {
                    top = event.pageY - tooltipRect.height - offset;
                }

                tooltip.style.left = left + 'px';
                tooltip.style.top = top + 'px';
            }

            function escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }

            // Refresh button
            document.getElementById('refreshBtn').addEventListener('click', function(e) {
                e.preventDefault();
                document.getElementById('loadingOverlay').classList.add('active');
                const currentUrl = new URL(window.location.href);
                currentUrl.searchParams.set('refresh', '1');
                window.location.href = currentUrl.toString();
            });

            // Clear filters button
            document.getElementById('clearFilters').addEventListener('click', function(e) {
                e.preventDefault();
                window.location.href = 'zabbix.php?action=status.page';
            });

            // Auto-submit on select change
            document.getElementById('icon_size').addEventListener('change', function() {
                document.getElementById('mainForm').submit();
            });

            document.getElementById('spacing').addEventListener('change', function() {
                document.getElementById('mainForm').submit();
            });

            // Keyboard shortcuts
            document.addEventListener('keydown', function(e) {
                if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                    e.preventDefault();
                    document.getElementById('refreshBtn').click();
                }
            });

            // ENHANCED: Regional Distribution Pie Chart
			// Enhanced Regional Distribution Chart
			const regionalData = <?= json_encode($regional_stats) ?>;
			const regions = ['US', 'EU', 'Asia', 'Aus', 'Dallas', 'Kansas', 'Slough', 'Frankfurt', 'Other'];

			// Color scheme
			const regionColors = {
				'US': '#e74c3c',           // Red
				'EU': '#3498db',           // Blue
				'Asia': '#2ecc71',         // Green
				'Aus': '#f39c12',          // Orange
				'Dallas': '#9b59b6',       // Purple
				'Kansas': '#e67e22',       // Dark Orange
				'Slough': '#1abc9c',       // Teal
				'Frankfurt': '#34495e',    // Dark Gray
				'Other': '#95a5a6'         // Gray
			};

			const regionLabels = {
				'US': '🇺🇸 United States',
				'EU': '🇪🇺 Europe',
				'Asia': '🌏 Asia',
				'Aus': '🇦🇺 Australia',
				'Dallas': '🏙️ Dallas',
				'Kansas': '🌾 Kansas',
				'Slough': '🇬🇧 Slough',
				'Frankfurt': '🇩🇪 Frankfurt',
				'Other': '🌐 Other'
			};

			const chartData = {
				labels: [],
				datasets: [{
					data: [],
					backgroundColor: [],
					borderColor: '#ffffff',
					borderWidth: 3,
					hoverBorderWidth: 5,
					hoverOffset: 12
				}]
			};

			// Build chart data
			let hasData = false;
			regions.forEach(region => {
				if (regionalData[region] && regionalData[region].total > 0) {
					hasData = true;
					chartData.labels.push(region);
					chartData.datasets[0].data.push(regionalData[region].total);
					chartData.datasets[0].backgroundColor.push(regionColors[region]);
				}
			});

			// Create chart only if we have data
			if (hasData) {
				const ctx = document.getElementById('regionalChart').getContext('2d');

				const regionalChart = new Chart(ctx, {
					type: 'doughnut',
					data: chartData,
					options: {
						responsive: true,
						maintainAspectRatio: true,
						cutout: '68%',
						plugins: {
							legend: {
								display: false
							},
							tooltip: {
								backgroundColor: 'rgba(0, 0, 0, 0.9)',
								titleFont: { size: 15, weight: 'bold' },
								bodyFont: { size: 13 },
								padding: 15,
								cornerRadius: 8,
								displayColors: true,
								callbacks: {
									title: function(context) {
										return regionLabels[context[0].label];
									},
									label: function(context) {
										const region = context.label;
										const total = context.parsed;
										const healthy = regionalData[region].healthy;
										const alerts = regionalData[region].alerts;
										const percentage = ((total / <?= $statistics['total_groups'] ?>) * 100).toFixed(1);

										return [
											`Total: ${total} groups (${percentage}%)`,
											``,
											`✓ Healthy: ${healthy}`,
											`⚠ With Alerts: ${alerts}`
										];
									}
								}
							}
						},
						onClick: function(event, elements) {
							if (elements.length > 0) {
								const index = elements[0].index;
								const region = chartData.labels[index];
								filterByRegion(region);
							}
						},
						// ADDITION: Double-click to clear filter
						onDoubleClick: function() {
							clearRegionFilter();
						},
						animation: {
							animateRotate: true,
							animateScale: true,
							duration: 800
						}
					}
				});

				// Update center value
				const totalGroups = chartData.datasets[0].data.reduce((a, b) => a + b, 0);
				document.getElementById('chartCenterValue').textContent = totalGroups;

				// Build regional stats list
				buildRegionalStatsList();

				// ADDITION: Clear filter button event
				document.getElementById('clearFilterBtn').addEventListener('click', function(e) {
					e.stopPropagation();
					clearRegionFilter();
				});
			}

			function buildRegionalStatsList() {
				const listContainer = document.getElementById('regionalStatsList');
				let html = '';

				regions.forEach(region => {
					if (regionalData[region] && regionalData[region].total > 0) {
						const total = regionalData[region].total;
						const healthy = regionalData[region].healthy;
						const alerts = regionalData[region].alerts;
						const color = regionColors[region];
						const regionClass = `region-${region.toLowerCase()}`;

						html += `
							<div class="regional-stat-item ${regionClass}" data-region="${region}">
								<div class="regional-stat-left">
									<div class="regional-stat-color" style="background: ${color};"></div>
									<div class="regional-stat-name">${regionLabels[region]}</div>
								</div>
								<div class="regional-stat-right">
									<div class="regional-stat-total">${total}</div>
									<div class="regional-stat-breakdown">${healthy}H / ${alerts}A</div>
								</div>
							</div>
						`;
					}
				});

				listContainer.innerHTML = html;

				// Add click handlers
				document.querySelectorAll('.regional-stat-item').forEach(item => {
					item.addEventListener('click', function() {
						const region = this.dataset.region;
						filterByRegion(region);
					});
				});
			}

			// ENHANCED: Filter by region with clear functionality
			let currentRegionFilter = null;

			function filterByRegion(region) {
				if (currentRegionFilter === region) {
					// Click same region - clear filter
					clearRegionFilter();
				} else {
					// Apply new filter
					currentRegionFilter = region;
					applyRegionFilter(region);
					updateFilterUI(region);
				}
			}

			function applyRegionFilter(region) {
				const circles = document.querySelectorAll('.status-circle');
				const statItems = document.querySelectorAll('.regional-stat-item');

				circles.forEach(circle => {
					if (circle.dataset.region === region) {
						circle.style.display = '';
					} else {
						circle.style.display = 'none';
					}
				});

				statItems.forEach(item => {
					if (item.dataset.region === region) {
						item.classList.add('filtered');
					} else {
						item.classList.remove('filtered');
					}
				});
			}

			function clearRegionFilter() {
				currentRegionFilter = null;

				// Show all circles
				const circles = document.querySelectorAll('.status-circle');
				circles.forEach(circle => {
					circle.style.display = '';
				});

				// Remove filtered class from all stat items
				const statItems = document.querySelectorAll('.regional-stat-item');
				statItems.forEach(item => {
					item.classList.remove('filtered');
				});

				// Hide filter banner
				const filterActive = document.getElementById('regionFilterActive');
				filterActive.classList.remove('visible');

				// Reset hint text
				const filterHint = document.getElementById('regionFilterHint');
				filterHint.textContent = '💡 Click to filter by region';
				filterHint.classList.remove('with-filter');
			}

			function updateFilterUI(region) {
				// Show filter banner
				const filterActive = document.getElementById('regionFilterActive');
				const filterActiveRegion = document.getElementById('filterActiveRegion');

				filterActiveRegion.textContent = regionLabels[region];
				filterActive.classList.add('visible');

				// Update hint text
				const filterHint = document.getElementById('regionFilterHint');
				filterHint.innerHTML = '💡 Click same region or <strong>Clear</strong> button to show all';
				filterHint.classList.add('with-filter');
			}

        })();
    </script>
</body>
</html>
