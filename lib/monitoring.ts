export interface RefreshMetrics {
    timestamp: string
    duration_seconds: number
    stations_fetched: number
    stations_inserted: number
    states_generated: number
    success: boolean
    error_message?: string
}

export async function logRefreshMetrics(
    metrics: RefreshMetrics
): Promise<void> {
    // In production, you'd send this to a monitoring service
    // For now, just console log
    console.log('Refresh Metrics:', JSON.stringify(metrics, null, 2))

    // TODO: Send to monitoring service (Sentry, Datadog, etc.)
    // await fetch('https://your-monitoring-service.com/metrics', {
    //   method: 'POST',
    //   body: JSON.stringify(metrics)
    // });
}

export function createErrorAlert(error: Error): void {
    // In production, send alerts for failures
    console.error('ALERT: Data refresh failed:', error)

    // TODO: Send to alert service (PagerDuty, Slack, email)
    // await fetch('https://hooks.slack.com/your-webhook', {
    //   method: 'POST',
    //   body: JSON.stringify({ text: `Data refresh failed: ${error.message}` })
    // });
}
