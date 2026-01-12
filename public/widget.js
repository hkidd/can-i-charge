(function() {
    'use strict';

    const API_BASE = 'https://canicharge.com';
    const WIDGET_VERSION = '1.0.0';

    // Grade color mapping
    function getGradeColor(grade) {
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
            primaryColor: element.dataset.primaryColor || '#2563eb',
            backgroundColor: element.dataset.backgroundColor || '',
            textColor: element.dataset.textColor || '',
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
                <div style="color: #ef4444;">${message}</div>
            </div>
        `;
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
                ">${data.grade}</span>
                <span style="font-weight: 600;">EV Ready: ${data.score}</span>
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
        if (config.showBreakdown) {
            const items = [
                { label: 'Nearby Chargers', value: data.breakdown.nearby_chargers, max: 40 },
                { label: 'Fast Charging', value: data.breakdown.fast_charging, max: 25 },
                { label: 'Network Diversity', value: data.breakdown.network_diversity, max: 20 },
                { label: 'Charging Density', value: data.breakdown.charging_density, max: 15 },
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
                                <span>${item.value}/${item.max}</span>
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
                    ">${data.grade}</div>
                    <div>
                        <div style="font-size: 32px; font-weight: 700; line-height: 1;">${data.score}</div>
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
                    Better than <strong>${data.percentile}%</strong> of US locations
                </div>

                <div style="font-size: 13px; margin-bottom: 16px;">
                    <div style="margin-bottom: 6px;">
                        <span style="font-weight: 600;">${data.chargers.within_5_miles} chargers</span>
                        <span style="opacity: 0.7;"> within 5 miles</span>
                        ${data.chargers.dcfast_count > 0 ? `<span style="opacity: 0.7;"> (${data.chargers.dcfast_count} fast)</span>` : ''}
                    </div>
                    ${data.chargers.nearest ? `
                        <div style="opacity: 0.7;">
                            Nearest: <span style="font-weight: 500; opacity: 1;">${nearestDistance}</span>
                            ${data.chargers.nearest.name ? `<span> — ${data.chargers.nearest.name}</span>` : ''}
                        </div>
                    ` : ''}
                </div>

                ${breakdownHtml}

                <div style="font-size: 12px; opacity: 0.6; ${config.showBranding ? 'margin-bottom: 12px;' : ''}">
                    ${data.location}
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

        const response = await fetch(url);
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
        } catch (err) {
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
