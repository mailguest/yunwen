export async function initOtel(): Promise<void> {
  if ((process.env.OTEL_ENABLE || '').toLowerCase() !== 'true') return
  try {
    const { NodeSDK } = await import('@opentelemetry/sdk-node')
    const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node')
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http')
    const exporter = new OTLPTraceExporter({ url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces' })
    const sdk = new NodeSDK({ traceExporter: exporter, instrumentations: [getNodeAutoInstrumentations()] })
    await sdk.start()
  } catch {}
}
