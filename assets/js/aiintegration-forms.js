/**
 * AI Integration - Form Helpers
 * Enhanced: Trigger helper with Zabbix API host/item resolution
 *           Host helper with full health dashboard (problems, incidents, metrics, health score)
 */
(function() {
    'use strict';

    function waitForDependencies(callback) {
        if (typeof window.AIIntegrationCore !== 'undefined' && typeof window.AIIntegrationInit !== 'undefined') {
            callback();
        } else {
            setTimeout(() => waitForDependencies(callback), 100);
        }
    }

    function init() {
        const Core = window.AIIntegrationCore;
        const Init = window.AIIntegrationInit;

        Core.loadSettings().then(settings => {
            Init.registerHandler('triggers', (dialog) => {
                if (settings.quick_actions.triggers) {
                    injectTriggerHelper(dialog, settings);
                }
            });

            Init.registerHandler('hosts', (dialog) => {
                if (settings.quick_actions.hosts) {
                    injectHostHelper(dialog, settings);
                }
            });
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Zabbix API helper (shared by trigger + host sections)
    // ─────────────────────────────────────────────────────────────────────────

    function callZabbixApi(method, params) {
        return fetch('api_jsonrpc.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json-rpc' },
            credentials: 'same-origin',
            body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 })
        })
            .then(r => r.json())
            .then(d => (d && d.result ? d.result : null))
            .catch(() => null);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TRIGGERS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Inject AI helper button into the Trigger form dialog.
     */
    function injectTriggerHelper(dialog, settings) {
        const expressionField = dialog.querySelector('textarea[name="expression"]') ||
            dialog.querySelector('input[name="expression"]');
        if (!expressionField) return;
        if (dialog.querySelector('.aiintegration-trigger-helper')) return;

        const helperBtn = document.createElement('button');
        helperBtn.type = 'button';
        helperBtn.className = 'aiintegration-trigger-helper';
        helperBtn.innerHTML = '✨ Generate Trigger with AI';
        helperBtn.style.cssText = 'margin-top:8px;padding:8px 16px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;';

        helperBtn.addEventListener('click', () => {
            showTriggerGeneratorModal(dialog, expressionField, settings);
        });

        expressionField.parentNode.insertBefore(helperBtn, expressionField.nextSibling);
    }

    /**
     * Try to resolve the host currently selected in the trigger dialog form.
     * Returns { hostid, hostname } or null.
     */
    async function resolveHostFromContext(dialog) {
        // Method 1: hidden hostid input in form
        const hostidInput = dialog.querySelector('input[name="hostid"]') ||
            dialog.querySelector('input[id*="hostid"]');
        if (hostidInput && hostidInput.value) {
            const hostid = hostidInput.value;
            const hosts = await callZabbixApi('host.get', {
                hostids: [hostid],
                output: ['hostid', 'host', 'name']
            });
            if (hosts && hosts.length > 0) {
                return { hostid, hostname: hosts[0].name || hosts[0].host };
            }
        }

        // Method 2: host name visible in dialog header or breadcrumb
        const breadcrumb = dialog.querySelector('.overlay-dialogue-header');
        if (breadcrumb) {
            const match = breadcrumb.textContent.match(/host[:\s]+(.+?)(?:\s|$)/i);
            if (match) {
                const found = await callZabbixApi('host.get', {
                    search: { name: match[1].trim() },
                    output: ['hostid', 'host', 'name'],
                    limit: 1
                });
                if (found && found.length > 0) {
                    return { hostid: found[0].hostid, hostname: found[0].name || found[0].host };
                }
            }
        }

        return null;
    }

    /**
     * Fetch items for a given host to provide as context for trigger generation.
     */
    function fetchHostItemsForTrigger(hostid) {
        return callZabbixApi('item.get', {
            hostids: [hostid],
            output: ['itemid', 'name', 'key_', 'units', 'value_type', 'lastvalue'],
            filter: { status: 0 },
            sortfield: 'name',
            limit: 30
        });
    }

    /**
     * Show the AI trigger generator modal.
     */
    async function showTriggerGeneratorModal(dialog, expressionField, settings) {
        const Core = window.AIIntegrationCore;

        const content = document.createElement('div');

        // Loading state while resolving host
        content.innerHTML = `<div style="text-align:center;padding:20px;color:#6b7280;">⏳ Resolving host context…</div>`;

        const providerSelect = createProviderSelect(settings);
        const modal = Core.openModal('✨ AI Trigger Generator', content, [], { headerExtra: providerSelect });

        // Resolve host context
        let hostContext = null;
        let hostItems = null;
        try {
            hostContext = await resolveHostFromContext(dialog);
            if (hostContext) {
                hostItems = await fetchHostItemsForTrigger(hostContext.hostid);
            }
        } catch (e) {
            console.warn('AI Integration: Could not resolve host', e);
        }

        // Build modal content
        content.innerHTML = '';

        // Info box
        const infoBox = document.createElement('div');
        infoBox.style.cssText = 'background:#f0f7ff;padding:12px;border-radius:6px;margin-bottom:16px;font-size:13px;';
        infoBox.innerHTML = '💡 Describe what you want to monitor in plain English and AI will generate the Zabbix trigger expression.';
        if (hostContext) {
            infoBox.innerHTML += ` <strong>Host detected: ${Core.escapeHtml(hostContext.hostname)}</strong>`;
        }
        content.appendChild(infoBox);

        // Description field
        const descField = document.createElement('div');
        descField.className = 'aiintegration-field';
        descField.innerHTML = '<label>What do you want to monitor?</label>';
        const descTextarea = document.createElement('textarea');
        descTextarea.id = 'trigger_description';
        descTextarea.rows = 4;
        descTextarea.style.cssText = 'width:100%;box-sizing:border-box;';
        descTextarea.placeholder = 'Example: Alert me when CPU usage is above 80% for more than 5 minutes';
        descField.appendChild(descTextarea);
        content.appendChild(descField);

        // Optional extra context
        const ctxField = document.createElement('div');
        ctxField.className = 'aiintegration-field';
        ctxField.innerHTML = '<label>Additional Context (optional):</label>';
        const ctxTextarea = document.createElement('textarea');
        ctxTextarea.id = 'trigger_context';
        ctxTextarea.rows = 2;
        ctxTextarea.style.cssText = 'width:100%;box-sizing:border-box;';
        ctxTextarea.placeholder = 'Severity level, business hours, thresholds…';
        ctxField.appendChild(ctxTextarea);
        content.appendChild(ctxField);

        // Show available items if host resolved
        if (hostItems && hostItems.length > 0) {
            const itemsDetails = document.createElement('details');
            itemsDetails.style.marginBottom = '12px';
            const itemsSummary = document.createElement('summary');
            itemsSummary.style.cssText = 'cursor:pointer;font-size:13px;color:#6b7280;margin-bottom:6px;';
            itemsSummary.textContent = `📋 ${hostItems.length} available items on this host (click to see)`;
            itemsDetails.appendChild(itemsSummary);
            const itemsList = document.createElement('div');
            itemsList.style.cssText = 'font-size:12px;font-family:monospace;background:#f9fafb;padding:8px;border-radius:4px;max-height:150px;overflow-y:auto;';
            itemsList.textContent = hostItems.map(i => `${i.name} [${i.key_}]${i.lastvalue ? ' = ' + i.lastvalue + (i.units || '') : ''}`).join('\n');
            itemsDetails.appendChild(itemsList);
            content.appendChild(itemsDetails);
        }

        // Response area
        const responseDiv = document.createElement('div');
        responseDiv.id = 'ai_response_area';
        responseDiv.style.display = 'none';
        content.appendChild(responseDiv);

        modal.setActions([
            {
                label: 'Generate',
                className: 'aiintegration-btn aiintegration-btn-primary',
                onClick: (close, btn) => {
                    const description = document.getElementById('trigger_description').value.trim();
                    const extra = document.getElementById('trigger_context').value.trim();
                    const provider = providerSelect.value;

                    if (!description) {
                        showFormError('ai_response_area', 'Please describe what you want to monitor.');
                        return;
                    }

                    btn.disabled = true;
                    btn.innerHTML = '<span class="aiintegration-loading"></span> Generating…';

                    // Build rich prompt
                    let question = `Generate a Zabbix trigger expression for the following requirement:\n\n${description}`;
                    if (extra) question += `\n\nAdditional context: ${extra}`;
                    if (hostContext) question += `\n\nHost: ${hostContext.hostname}`;
                    if (hostItems && hostItems.length > 0) {
                        question += `\n\nAvailable items on this host:\n`;
                        question += hostItems.slice(0, 20).map(i => `- ${i.name} [key: ${i.key_}]${i.units ? ' (' + i.units + ')' : ''}`).join('\n');
                    }
                    question += `\n\nProvide ONLY the Zabbix trigger expression in proper syntax. Use the exact item keys listed above where applicable.`;

                    const ctx = {
                        type: 'trigger_generation',
                        host: hostContext,
                        items: hostItems ? hostItems.slice(0, 10) : []
                    };

                    Core.callAI(question, ctx, provider)
                        .then(data => {
                            showTriggerResponse('ai_response_area', data.response, expressionField, modal);
                            btn.disabled = false;
                            btn.textContent = 'Generate';
                        })
                        .catch(err => {
                            showFormError('ai_response_area', err.message);
                            btn.disabled = false;
                            btn.textContent = 'Generate';
                        });
                }
            },
            {
                label: 'Close',
                className: 'aiintegration-btn aiintegration-btn-secondary',
                onClick: (close) => close()
            }
        ]);
    }

    function showTriggerResponse(areaId, text, expressionField, modal) {
        const Core = window.AIIntegrationCore;
        const area = document.getElementById(areaId);
        if (!area) return;
        area.style.display = 'block';
        area.innerHTML = '';

        const responseDiv = document.createElement('div');
        responseDiv.className = 'aiintegration-response';
        responseDiv.innerHTML = Core.renderText(text);
        area.appendChild(responseDiv);

        const useBtn = document.createElement('button');
        useBtn.type = 'button';
        useBtn.className = 'aiintegration-btn aiintegration-btn-primary';
        useBtn.style.marginTop = '10px';
        useBtn.textContent = '✓ Use This Expression';
        useBtn.addEventListener('click', () => {
            const expression = extractTriggerExpression(text);
            if (expressionField) {
                expressionField.value = expression;
                expressionField.dispatchEvent(new Event('change', { bubbles: true }));
                expressionField.dispatchEvent(new Event('input', { bubbles: true }));
            }
            modal.close();
        });
        area.appendChild(useBtn);
    }

    function extractTriggerExpression(text) {
        // Try to find a trigger expression pattern {host:key.func()} > value
        const fullExpr = text.match(/\{[^}]+:[^}]+\.[^}]+\([^)]*\)\s*[><=!]+\s*[\d.]+(?:\s+and\s+.+)?/i);
        if (fullExpr) return fullExpr[0].trim();
        // Fallback: just return trimmed text
        return text.trim();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HOSTS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Inject AI helper button into the Host form dialog.
     */
    function injectHostHelper(dialog, settings) {
        const formBody = dialog.querySelector('.overlay-dialogue-body') || dialog;
        if (dialog.querySelector('.aiintegration-host-helper')) return;

        const helperSection = document.createElement('div');
        helperSection.className = 'aiintegration-host-helper';
        helperSection.style.cssText = 'margin:0 0 16px;padding:12px 16px;background:linear-gradient(135deg,#667eea11,#764ba211);border:1px solid #e5e7eb;border-radius:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;';

        const label = document.createElement('span');
        label.style.cssText = 'font-weight:600;font-size:13px;color:#374151;';
        label.textContent = '🤖 AI Analysis:';
        helperSection.appendChild(label);

        const actions = [
            { label: '🏥 Host Health', action: 'health' },
            { label: '📊 Metrics Summary', action: 'metrics' },
            { label: '💡 Optimization Tips', action: 'optimize' }
        ];

        actions.forEach(a => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = a.label;
            btn.style.cssText = 'padding:6px 12px;background:white;border:1px solid #d1d5db;border-radius:4px;cursor:pointer;font-size:13px;transition:all 0.2s;';
            btn.addEventListener('click', () => showHostAssistantModal(dialog, a.action, settings));
            helperSection.appendChild(btn);
        });

        formBody.insertBefore(helperSection, formBody.firstChild);
    }

    /**
     * Resolve host ID and name from the host dialog form.
     */
    async function resolveHostFromDialog(dialog) {
        // Hidden hostid field
        const hiddenHostid = dialog.querySelector('input[name="hostid"]') ||
            dialog.querySelector('input[id="hostid"]');
        if (hiddenHostid && hiddenHostid.value) {
            return { hostid: hiddenHostid.value };
        }

        // URL param
        const urlMatch = window.location.href.match(/hostid=(\d+)/);
        if (urlMatch) {
            return { hostid: urlMatch[1] };
        }

        // Host name field in form
        const nameInput = dialog.querySelector('input[name="host"]') ||
            dialog.querySelector('input[id="host"]');
        if (nameInput && nameInput.value.trim()) {
            const found = await callZabbixApi('host.get', {
                search: { host: nameInput.value.trim() },
                output: ['hostid', 'host', 'name'],
                limit: 1
            });
            if (found && found.length > 0) return { hostid: found[0].hostid };
        }

        return null;
    }

    // ── Zabbix API data fetchers for host health ──

    function fetchHostDetails(hostid) {
        return callZabbixApi('host.get', {
            hostids: [hostid],
            output: ['hostid', 'host', 'name', 'description', 'status'],
            selectGroups: ['name'],
            selectInterfaces: ['ip', 'dns', 'port', 'type']
        }).then(r => (r && r.length > 0 ? r[0] : null));
    }

    function fetchHostActiveProblems(hostid) {
        return callZabbixApi('problem.get', {
            hostids: [hostid],
            output: ['eventid', 'name', 'severity', 'clock', 'acknowledged'],
            selectAcknowledges: 'count',
            sortfield: ['severity', 'clock'],
            sortorder: 'DESC'
        });
    }

    function fetchHostTriggers(hostid) {
        return callZabbixApi('trigger.get', {
            hostids: [hostid],
            output: ['triggerid', 'description', 'priority', 'status', 'value', 'lastchange'],
            filter: { status: 0 },       // only enabled
            sortfield: ['priority', 'lastchange'],
            sortorder: 'DESC',
            limit: 20
        });
    }

    function fetchHostMetrics(hostid) {
        return callZabbixApi('item.get', {
            hostids: [hostid],
            output: ['itemid', 'name', 'key_', 'lastvalue', 'units', 'lastclock', 'state', 'value_type'],
            filter: { status: 0, state: 0 },
            sortfield: 'lastclock',
            sortorder: 'DESC',
            limit: 25
        });
    }

    function fetchHostTopIncidents(hostid) {
        const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 3600;
        return callZabbixApi('event.get', {
            hostids: [hostid],
            source: 0,
            object: 0,
            value: 1,       // problems only
            time_from: thirtyDaysAgo,
            output: ['eventid', 'name', 'severity', 'clock', 'r_clock'],
            sortfield: ['severity', 'clock'],
            sortorder: 'DESC',
            limit: 20
        });
    }

    /** Compute a 0-100 health score based on active problem severities. */
    function computeHealthScore(problems) {
        if (!problems || problems.length === 0) return 100;

        // Severity weights: 0=NC, 1=Info, 2=Warn, 3=Average, 4=High, 5=Disaster
        const weights = [0, 1, 3, 6, 12, 25];
        const totalPenalty = problems.reduce((acc, p) => {
            const sev = parseInt(p.severity, 10) || 0;
            return acc + (weights[sev] || 0);
        }, 0);

        const score = Math.max(0, 100 - totalPenalty);
        return Math.round(score);
    }

    function getSeverityName(sev) {
        const names = ['Not classified', 'Information', 'Warning', 'Average', 'High', 'Disaster'];
        return names[parseInt(sev, 10)] || 'Unknown';
    }

    function getSeverityColor(sev) {
        const colors = ['#6b7280', '#3b82f6', '#f59e0b', '#f97316', '#ef4444', '#7c3aed'];
        return colors[parseInt(sev, 10)] || '#6b7280';
    }

    /**
     * Show the full host health dashboard modal.
     */
    async function showHostAssistantModal(dialog, action, settings) {
        const Core = window.AIIntegrationCore;

        const content = document.createElement('div');
        content.innerHTML = `<div style="text-align:center;padding:30px;color:#6b7280;">⏳ Loading host data…</div>`;

        const providerSelect = createProviderSelect(settings);

        const titles = {
            health: '🏥 Host Health Dashboard',
            metrics: '📊 Metrics Summary',
            optimize: '💡 Optimization Tips'
        };

        const modal = Core.openModal(titles[action] || '🤖 AI Host Assistant', content, [], { headerExtra: providerSelect });

        // Resolve host
        const hostRef = await resolveHostFromDialog(dialog).catch(() => null);
        if (!hostRef) {
            content.innerHTML = `<div class="aiintegration-error">Could not determine the host. Please save the host first, then re-open for AI analysis.</div>`;
            modal.setActions([{ label: 'Close', className: 'aiintegration-btn aiintegration-btn-secondary', onClick: c => c() }]);
            return;
        }

        // Fetch all data in parallel
        const [hostDetails, problems, triggers, metrics, incidents] = await Promise.all([
            fetchHostDetails(hostRef.hostid),
            fetchHostActiveProblems(hostRef.hostid),
            fetchHostTriggers(hostRef.hostid),
            fetchHostMetrics(hostRef.hostid),
            fetchHostTopIncidents(hostRef.hostid)
        ]).catch(() => [null, [], [], [], []]);

        const healthScore = computeHealthScore(problems || []);
        const hostname = hostDetails ? (hostDetails.name || hostDetails.host) : 'Unknown';

        // ── Build rich context ──
        const enrichedContext = {
            host: {
                hostid: hostRef.hostid,
                name: hostname,
                status: hostDetails?.status === '0' ? 'Enabled' : 'Disabled',
                groups: hostDetails?.groups?.map(g => g.name) || [],
                interfaces: hostDetails?.interfaces || []
            },
            health_score: healthScore,
            active_problems: {
                total: (problems || []).length,
                by_severity: buildSeverityCount(problems || []),
                list: (problems || []).slice(0, 10).map(p => ({
                    name: p.name,
                    severity: getSeverityName(p.severity),
                    time: new Date(parseInt(p.clock, 10) * 1000).toISOString(),
                    acknowledged: p.acknowledged === '1'
                }))
            },
            triggers_summary: {
                total: (triggers || []).length,
                firing: (triggers || []).filter(t => t.value === '1').length,
                by_priority: buildSeverityCount(triggers || [], 'priority')
            },
            recent_metrics: (metrics || []).slice(0, 15).map(i => ({
                name: i.name,
                key: i.key_,
                last_value: i.lastvalue,
                units: i.units
            })),
            incidents_30d: {
                total: (incidents || []).length,
                by_severity: buildSeverityCount(incidents || [])
            }
        };

        // ── Render modal ──
        content.innerHTML = '';

        // Health score badge
        const scoreColor = healthScore >= 80 ? '#166534' : healthScore >= 50 ? '#92400e' : '#991b1b';
        const scoreBg    = healthScore >= 80 ? '#f0fdf4' : healthScore >= 50 ? '#fffbeb' : '#fef2f2';
        const scoreHdr = document.createElement('div');
        scoreHdr.style.cssText = `display:flex;align-items:center;gap:16px;padding:12px 16px;background:${scoreBg};border-radius:6px;margin-bottom:16px;`;
        scoreHdr.innerHTML = `
            <div style="font-size:36px;font-weight:800;color:${scoreColor};">${healthScore}<span style="font-size:16px;">/100</span></div>
            <div>
                <div style="font-weight:700;color:${scoreColor};font-size:15px;">Health Score – ${Core.escapeHtml(hostname)}</div>
                <div style="font-size:13px;color:#6b7280;">${(problems || []).length} active problem(s) · ${(incidents || []).length} incident(s) in 30d</div>
            </div>`;
        content.appendChild(scoreHdr);

        // Problems by severity
        if ((problems || []).length > 0) {
            const probSection = document.createElement('div');
            probSection.style.marginBottom = '12px';
            probSection.innerHTML = '<strong style="font-size:13px;">Active Problems by Severity</strong>';
            const sevDiv = document.createElement('div');
            sevDiv.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;';
            const sevCounts = buildSeverityCount(problems);
            Object.entries(sevCounts).forEach(([sev, count]) => {
                const badge = document.createElement('span');
                badge.style.cssText = `background:${getSeverityColor(sev)};color:white;padding:3px 10px;border-radius:10px;font-size:12px;font-weight:600;`;
                badge.textContent = `${getSeverityName(sev)}: ${count}`;
                sevDiv.appendChild(badge);
            });
            probSection.appendChild(sevDiv);
            content.appendChild(probSection);
        }

        // Top problems list
        if ((problems || []).length > 0) {
            const table = document.createElement('table');
            table.className = 'aiintegration-summary-table';
            table.style.marginBottom = '12px';
            table.innerHTML = `<tr style="background:#f9fafb;"><td><strong>Problem</strong></td><td><strong>Severity</strong></td><td><strong>ACK</strong></td></tr>` +
                (problems || []).slice(0, 6).map(p =>
                    `<tr><td>${Core.escapeHtml(p.name)}</td>` +
                    `<td><span style="color:${getSeverityColor(p.severity)};font-weight:600;">${getSeverityName(p.severity)}</span></td>` +
                    `<td>${p.acknowledged === '1' ? '✓' : '–'}</td></tr>`
                ).join('');
            content.appendChild(table);
        } else {
            const noProb = document.createElement('div');
            noProb.style.cssText = 'background:#f0fdf4;color:#166534;padding:8px 12px;border-radius:4px;margin-bottom:12px;font-size:13px;';
            noProb.textContent = '✓ No active problems';
            content.appendChild(noProb);
        }

        // Key metrics
        if ((metrics || []).length > 0) {
            const metSection = document.createElement('details');
            metSection.style.marginBottom = '12px';
            const metSum = document.createElement('summary');
            metSum.style.cssText = 'cursor:pointer;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;';
            metSum.textContent = `📈 Recent Metrics (${metrics.length})`;
            metSection.appendChild(metSum);
            const metTable = document.createElement('table');
            metTable.className = 'aiintegration-summary-table';
            metTable.innerHTML = (metrics || []).slice(0, 10).map(i =>
                `<tr><td>${Core.escapeHtml(i.name)}</td><td>${Core.escapeHtml(i.lastvalue || 'N/A')}${i.units ? ' ' + Core.escapeHtml(i.units) : ''}</td></tr>`
            ).join('');
            metSection.appendChild(metTable);
            content.appendChild(metSection);
        }

        // Custom question
        const questionField = document.createElement('div');
        questionField.className = 'aiintegration-field';
        questionField.innerHTML = '<label>Ask AI:</label>';
        const questionTextarea = document.createElement('textarea');
        questionTextarea.id = 'host_question';
        questionTextarea.rows = 4;
        questionTextarea.style.cssText = 'width:100%;box-sizing:border-box;';
        questionTextarea.value = buildDefaultHostQuestion(action, hostname, enrichedContext);
        questionField.appendChild(questionTextarea);
        content.appendChild(questionField);

        // Super Admin context editor
        if (settings.is_super_admin) {
            const details = document.createElement('details');
            details.className = 'aiintegration-context-toggle';
            const summary = document.createElement('summary');
            summary.textContent = '🔧 Context JSON (Super Admin)';
            details.appendChild(summary);
            const ctxArea = document.createElement('textarea');
            ctxArea.id = 'host_context_json';
            ctxArea.rows = 12;
            ctxArea.style.cssText = 'width:100%;box-sizing:border-box;font-family:monospace;font-size:12px;margin-top:8px;';
            ctxArea.value = JSON.stringify(enrichedContext, null, 2);
            details.appendChild(ctxArea);
            content.appendChild(details);
        }

        // Response area
        const responseDiv = document.createElement('div');
        responseDiv.id = 'host_response_area';
        responseDiv.style.display = 'none';
        content.appendChild(responseDiv);

        modal.setActions([
            {
                label: 'Analyze',
                className: 'aiintegration-btn aiintegration-btn-primary',
                onClick: (close, btn) => {
                    const question = document.getElementById('host_question').value;
                    const provider = providerSelect.value;

                    let ctx = enrichedContext;
                    if (settings.is_super_admin) {
                        try {
                            ctx = JSON.parse(document.getElementById('host_context_json').value || '{}');
                        } catch (e) {
                            showFormError('host_response_area', 'Invalid JSON in context.');
                            return;
                        }
                    }

                    btn.disabled = true;
                    btn.innerHTML = '<span class="aiintegration-loading"></span> Analyzing…';

                    Core.callAI(question, ctx, provider)
                        .then(data => {
                            const ra = document.getElementById('host_response_area');
                            ra.style.display = 'block';
                            ra.innerHTML = '<div class="aiintegration-response">' + Core.renderText(data.response || '') + '</div>';
                            btn.disabled = false;
                            btn.textContent = 'Analyze';
                        })
                        .catch(err => {
                            showFormError('host_response_area', err.message);
                            btn.disabled = false;
                            btn.textContent = 'Analyze';
                        });
                }
            },
            {
                label: 'Close',
                className: 'aiintegration-btn aiintegration-btn-secondary',
                onClick: (close) => close()
            }
        ]);
    }

    function buildSeverityCount(items, field) {
        field = field || 'severity';
        const counts = {};
        (items || []).forEach(item => {
            const s = item[field] || '0';
            counts[s] = (counts[s] || 0) + 1;
        });
        return counts;
    }

    function buildDefaultHostQuestion(action, hostname, ctx) {
        const probs = ctx.active_problems;
        const score = ctx.health_score;

        const baseInfo = [
            `Host: ${hostname}`,
            `Health score: ${score}/100`,
            `Active problems: ${probs.total}`,
            `Incidents (30d): ${ctx.incidents_30d.total}`,
            `Firing triggers: ${ctx.triggers_summary.firing}/${ctx.triggers_summary.total}`
        ].join('\n');

        const prompts = {
            health: `Perform a comprehensive health analysis of this Zabbix host:\n\n${baseInfo}\n\nPlease:\n1. Interpret the health score and active problems\n2. Identify the most critical issues requiring immediate attention\n3. Analyze the incident frequency over 30 days\n4. Provide a prioritized action plan\n5. Suggest preventive measures`,
            metrics: `Analyze the metrics and performance indicators of this Zabbix host:\n\n${baseInfo}\n\nKey metrics:\n${ctx.recent_metrics.slice(0, 10).map(m => `- ${m.name}: ${m.last_value || 'N/A'}${m.units ? ' ' + m.units : ''}`).join('\n')}\n\nPlease:\n1. Assess whether the current metric values are within normal ranges\n2. Identify any metrics that may indicate performance issues\n3. Suggest additional metrics that should be monitored\n4. Provide optimization recommendations`,
            optimize: `Provide optimization recommendations for this Zabbix host:\n\n${baseInfo}\n\nPlease suggest:\n1. Monitoring configuration improvements\n2. Alert threshold optimizations to reduce noise\n3. Missing monitors for this type of host\n4. Best practices for long-term stability\n5. Performance tuning recommendations`
        };

        return prompts[action] || prompts.health;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Shared helpers
    // ─────────────────────────────────────────────────────────────────────────

    function createProviderSelect(settings) {
        const select = document.createElement('select');
        select.id = 'provider_select';
        select.style.cssText = 'font-size:13px;padding:4px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.9);color:#1f1f1f;';

        if (!settings || !settings.providers || settings.providers.length === 0) {
            const opt = document.createElement('option');
            opt.value = 'openai';
            opt.textContent = 'No providers';
            select.appendChild(opt);
            select.disabled = true;
            return select;
        }

        settings.providers.forEach(provider => {
            const opt = document.createElement('option');
            opt.value = provider.name;   // use provider.name (the key), not provider.id
            opt.textContent = provider.name + (provider.model ? ' – ' + provider.model : '');
            if (provider.name === settings.default_provider) opt.selected = true;
            select.appendChild(opt);
        });

        return select;
    }

    function showFormError(areaId, message) {
        const Core = window.AIIntegrationCore;
        const area = document.getElementById(areaId);
        if (!area) return;
        area.style.display = 'block';
        area.innerHTML = `<div class="aiintegration-error">${Core.escapeHtml(message)}</div>`;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Bootstrap
    // ─────────────────────────────────────────────────────────────────────────

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => waitForDependencies(init));
    } else {
        waitForDependencies(init);
    }
})();
