(function() {
    'use strict';

    const scriptUrl = document.currentScript && document.currentScript.src;
    const API_BASE = scriptUrl ? new URL(scriptUrl).origin : 'https://canicharge.com';
    const WIDGET_VERSION = '1.0.0';

    function escapeHtml(value) {
        const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return String(value == null ? '' : value).replace(/[&<>"']/g, character => entities[character]);
    }

    function colorValue(value, fallback) {
        // Widget color options use hex colors, never arbitrary HTML or CSS.
        return /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value || '')
            ? value : fallback;
    }

    // Grade color mapping
    function getGradeColor(grade) {
        if (grade === 'Unrated') return '#64748b';
        if (grade.startsWith('A')) return '#22c55e';
        if (grade.startsWith('B')) return '#84cc16';
        if (grade.startsWith('C')) return '#eab308';
        if (grade.startsWith('D')) return '#f97316';
        return '#ef4444';
    }

    // Parse config from data attributes
    function parseConfig(element) {
        return {
            address: element.dataset.address || '',
            zip: element.dataset.zip || '',
            county: element.dataset.county || '',
            state: element.dataset.state || '',
            lat: element.dataset.lat ? parseFloat(element.dataset.lat) : null,
            lng: element.dataset.lng ? parseFloat(element.dataset.lng) : null,
            apiKey: element.dataset.apiKey || '',
            theme: element.dataset.theme || 'light',
            primaryColor: colorValue(element.dataset.primaryColor, '#2563eb'),
            backgroundColor: colorValue(element.dataset.backgroundColor, ''),
            textColor: colorValue(element.dataset.textColor, ''),
            size: element.dataset.size || 'standard',
            showBranding: element.dataset.showBranding !== 'false',
            showBreakdown: element.dataset.showBreakdown === 'true',
            borderRadius: element.dataset.borderRadius ? parseInt(element.dataset.borderRadius) : 12,
        };
    }

    // Get theme styles
    function getThemeStyles(config) {
        if (config.theme === 'custom') {
            return {
                background: config.backgroundColor || '#ffffff',
                color: config.textColor || '#1f2937',
                primary: config.primaryColor,
                muted: config.theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                border: config.theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            };
        }
        if (config.theme === 'dark') {
            return {
                background: '#1f2937',
                color: '#f9fafb',
                primary: config.primaryColor,
                muted: 'rgba(255,255,255,0.1)',
                border: 'rgba(255,255,255,0.1)',
            };
        }
        return {
            background: '#ffffff',
            color: '#1f2937',
            primary: config.primaryColor,
            muted: 'rgba(0,0,0,0.05)',
            border: 'rgba(0,0,0,0.1)',
        };
    }

    // Render loading state
    function renderLoading(container, config) {
        const theme = getThemeStyles(config);
        container.innerHTML = `
            <div style="
                padding: 20px;
                background: ${theme.background};
                color: ${theme.color};
                border-radius: ${config.borderRadius}px;
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
                font-family: system-ui, -apple-system, sans-serif;
                text-align: center;
            ">
                <div style="color: #9ca3af;">Loading EV Score...</div>
            </div>
        `;
    }

    // Render error state
    function renderError(container, config, message) {
        const theme = getThemeStyles(config);
        container.innerHTML = `
            <div style="
                padding: 20px;
                background: ${theme.background};
                color: ${theme.color};
                border-radius: ${config.borderRadius}px;
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
                font-family: system-ui, -apple-system, sans-serif;
                text-align: center;
            ">
                <div style="color: #ef4444;">${escapeHtml(message)}</div>
            </div>
        `;
    }

    function renderCapacityNotice(data) {
        return data.data_quality?.message
            ? `<div role="note" style="flex-basis:100%;font-size:12px;line-height:1.5;opacity:0.75;margin:12px 0;">${escapeHtml(data.data_quality.message)}</div>`
            : '';
    }

    // Render compact widget
    function renderCompact(container, config, data) {
        const theme = getThemeStyles(config);
        const gradeColor = getGradeColor(data.grade);

        container.innerHTML = `
            <div style="
                display: inline-flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
                max-width: 340px;
                padding: 8px 12px;
                background: ${theme.background};
                color: ${theme.color};
                border-radius: ${config.borderRadius}px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                font-family: system-ui, -apple-system, sans-serif;
                font-size: 14px;
            ">
                <span style="
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    background: ${gradeColor};
                    color: #fff;
                    font-weight: 700;
                    font-size: 12px;
                ">${escapeHtml(data.grade)}</span>
                <span style="font-weight: 600;">EV Ready: ${escapeHtml(data.score ?? 'Unrated')}</span>
                ${data.evidence ? `<div style="flex-basis:100%;font-size:11px;line-height:1.5;">Modeled demand coverage · ${escapeHtml(data.evidence.registration_year)} fleet${data.evidence.fleet_basis === 'population_estimate' ? ' · local estimate' : ''}</div>` : ''}
                ${renderCapacityNotice(data)}
            </div>
        `;
    }

    // Render standard/detailed widget
    function renderStandard(container, config, data) {
        const theme = getThemeStyles(config);
        const gradeColor = getGradeColor(data.grade);
        const width = config.size === 'detailed' ? '320px' : '280px';
        const nearestDistance = data.nearest_charger_miles !== null
            ? data.nearest_charger_miles.toFixed(1) + ' mi'
            : 'N/A';

        let breakdownHtml = '';
        if (config.showBreakdown && data.breakdown) {
            const items = [
                { label: 'Level 2 Target', value: data.breakdown.nearby_chargers, max: 85 },
                { label: 'Fast Charging Target', value: data.breakdown.fast_charging, max: 15 },
            ];

            breakdownHtml = `
                <div style="border-top: 1px solid ${theme.border}; padding-top: 16px; margin-bottom: 16px;">
                    <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; opacity: 0.7;">
                        SCORE BREAKDOWN
                    </div>
                    ${items.map(item => `
                        <div style="margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
                                <span>${item.label}</span>
                                <span>${escapeHtml(item.value)}/${item.max}</span>
                            </div>
                            <div style="height: 4px; background: ${theme.muted}; border-radius: 2px;">
                                <div style="
                                    height: 100%;
                                    width: ${(item.value / item.max) * 100}%;
                                    background: ${theme.primary};
                                    border-radius: 2px;
                                "></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        let brandingHtml = '';
        if (config.showBranding) {
            brandingHtml = `
                <div style="
                    border-top: 1px solid ${theme.border};
                    padding-top: 12px;
                    font-size: 11px;
                    opacity: 0.5;
                ">
                    Powered by <a href="https://canicharge.com" target="_blank" rel="noopener noreferrer" style="color: ${theme.primary}; text-decoration: none;">CanICharge</a>
                </div>
            `;
        }

        container.innerHTML = `
            <div style="
                width: ${width};
                padding: 20px;
                background: ${theme.background};
                color: ${theme.color};
                border-radius: ${config.borderRadius}px;
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
                font-family: system-ui, -apple-system, sans-serif;
            ">
                <div style="margin-bottom: 16px; font-size: 13px; font-weight: 500; opacity: 0.7;">
                    EV Readiness Score
                </div>

                <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
                    <div style="
                        width: 64px;
                        height: 64px;
                        border-radius: 12px;
                        background: ${gradeColor};
                        color: #fff;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 28px;
                        font-weight: 700;
                    ">${escapeHtml(data.grade)}</div>
                    <div>
                        <div style="font-size: 32px; font-weight: 700; line-height: 1;">${escapeHtml(data.score ?? 'Unrated')}</div>
                        <div style="font-size: 13px; opacity: 0.7; margin-top: 4px;">out of 100</div>
                    </div>
                </div>

                <div style="
                    padding: 10px 12px;
                    background: ${theme.muted};
                    border-radius: 8px;
                    font-size: 13px;
                    margin-bottom: 16px;
                ">
                    ${escapeHtml(data.evidence?.summary || 'Estimated public charging provision.')}<br><a href="${API_BASE}/methodology">How this score works</a>
                </div>

                ${renderCapacityNotice(data)}
                <div style="font-size: 13px; margin-bottom: 16px;">
                    <div style="margin-bottom: 6px;">
                        <span style="font-weight: 600;">${escapeHtml(data.chargers.within_5_miles)} chargers</span>
                        <span style="opacity: 0.7;"> within 5 miles</span>
                        ${data.chargers.dcfast_within_5_miles > 0 ? `<span style="opacity: 0.7;"> (${escapeHtml(data.chargers.dcfast_within_5_miles)} fast)</span>` : ''}
                    </div>
                    ${data.chargers.nearest ? `
                        <div style="opacity: 0.7;">
                            Nearest: <span style="font-weight: 500; opacity: 1;">${nearestDistance}</span>
                            ${data.chargers.nearest.name ? `<span> — ${escapeHtml(data.chargers.nearest.name)}</span>` : ''}
                        </div>
                    ` : ''}
                </div>

                ${data.evidence ? `<p style="font-size:11px;line-height:1.5;opacity:.7;">${escapeHtml(data.evidence.limitations)}</p>` : ''}
                ${breakdownHtml}

                <div style="font-size: 12px; opacity: 0.6; ${config.showBranding ? 'margin-bottom: 12px;' : ''}">
                    ${escapeHtml(data.location)}
                </div>

                ${brandingHtml}
            </div>
        `;
    }

    // Fetch score data
    async function fetchScore(config) {
        const params = new URLSearchParams();
        if (config.address) params.set('address', config.address);
        if (config.zip) params.set('zip', config.zip);
        if (config.county) params.set('county', config.county);
        if (config.state) params.set('state', config.state);
        if (config.lat) params.set('lat', config.lat.toString());
        if (config.lng) params.set('lng', config.lng.toString());

        const url = window.location.hostname === 'localhost'
            ? `/api/ev-score?${params.toString()}`
            : `${API_BASE}/api/ev-score?${params.toString()}`;

        const response = await fetch(url, {
            headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}
        });
        if (!response.ok) throw new Error('Failed to fetch score');
        return response.json();
    }

    // Initialize a single widget
    async function initWidget(element) {
        const config = parseConfig(element);

        // Validate location is provided
        if (!config.address && !config.zip && !config.state && !config.lat) {
            renderError(element, config, 'Location required');
            return;
        }

        renderLoading(element, config);

        try {
            const data = await fetchScore(config);

            if (config.size === 'compact') {
                renderCompact(element, config, data);
            } else {
                renderStandard(element, config, data);
            }
        } catch {
            renderError(element, config, 'Failed to load score');
        }
    }

    // Initialize all widgets on page
    function initAllWidgets() {
        const widgets = document.querySelectorAll('[data-canicharge]');
        widgets.forEach(initWidget);
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAllWidgets);
    } else {
        initAllWidgets();
    }

    // Expose for manual initialization
    window.CanICharge = {
        version: WIDGET_VERSION,
        init: initAllWidgets,
        initWidget: initWidget,
    };
})();
