import { getRequestDiagnostics } from './http'

export interface DiagnosticReport {
  timestamp: string
  environment: {
    apiUrl: string
    isDev: boolean
    NODE_ENV: string
  }
  requests: {
    total: number
    errors: number
    avgDuration: number
    lastRequests: Array<{
      id: number
      method: string
      url: string
      timestamp: number
      status?: number
      duration?: number
      error?: string
    }>
  }
}

export const generateDiagnosticReport = (): DiagnosticReport => {
  const diagnostics = getRequestDiagnostics()
  const apiUrl = import.meta.env.VITE_API_URL || '/api'

  return {
    timestamp: new Date().toISOString(),
    environment: {
      apiUrl,
      isDev: import.meta.env.DEV,
      NODE_ENV: import.meta.env.MODE,
    },
    requests: {
      total: diagnostics.totalRequests,
      errors: diagnostics.errors,
      avgDuration: diagnostics.avgDuration,
      lastRequests: diagnostics.lastRequests,
    },
  }
}

export const logDiagnostics = () => {
  const report = generateDiagnosticReport()
  console.group('🔍 API Diagnostics')
  console.log('Environment:', report.environment)
  console.log('Requests:', {
    total: report.requests.total,
    errors: report.requests.errors,
    avgDuration: `${report.requests.avgDuration}ms`,
  })
  console.table(report.requests.lastRequests)
  console.groupEnd()
  return report
}

if (typeof window !== 'undefined') {
  ;(window as any).__kg_diagnostics = logDiagnostics
  ;(window as any).__kg_report = generateDiagnosticReport
}
