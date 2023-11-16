import { test, expect } from './rancher-test'
import { Chart, RancherAppsPage } from './pages/rancher-apps.page'
import { TelemetryPage } from './pages/telemetry.page'

const otelChart: Chart = { title: 'opentelemetry-operator', name: 'opentelemetry-operator', namespace: 'open-telemetry', check: 'opentelemetry-operator' }
const jaegerChart: Chart = { title: 'Jaeger Operator', namespace: 'jaeger', check: 'jaeger-operator' }
const monitoringChart: Chart = { title: 'Monitoring', check: 'rancher-monitoring' }

/**
 * Expect timeout has to be increased after telemetry installation on local cluster
 */
test('Install OpenTelemetry', async({ page, nav }) => {
  const apps = new RancherAppsPage(page)
  const telPage = new TelemetryPage(page)

  // Otel is not installed
  for (const tab of ['Tracing', 'Metrics'] as const) {
    await nav.pserver('default', tab)
    await telPage.toBeIncomplete('otel')
    await expect(telPage.configBtn).toBeDisabled()
  }
  // Install OpenTelemetry
  await apps.addRepository('open-telemetry', 'https://open-telemetry.github.io/opentelemetry-helm-charts')
  await apps.installChart(otelChart)
  // Otel is installed
  for (const tab of ['Tracing', 'Metrics'] as const) {
    await nav.pserver('default', tab)
    await telPage.toBeComplete('otel')
  }
})

test.describe('Tracing', () => {
  let apps: RancherAppsPage
  let telPage: TelemetryPage

  test.beforeEach(async({ nav, page }) => {
    apps = new RancherAppsPage(page)
    telPage = new TelemetryPage(page)
    await nav.pserver('default', 'Tracing')
  })

  test('Install Jaeger', async({ nav }) => {
    // Jaeger is not installed
    await telPage.toBeIncomplete('jaeger')
    await expect(telPage.configBtn).toBeDisabled()
    // Install Jaeger
    await apps.installChart(jaegerChart, {
      yamlPatch: (y) => {
        y.jaeger.create = true
        y.rbac.clusterRole = true
      }
    })
    // Jaeger is installed
    await nav.pserver('default', 'Tracing')
    await telPage.toBeComplete('jaeger')
  })

  test('Enable tracing', async({ ui, shell }) => {
    await telPage.toBeIncomplete('config')
    await telPage.configBtn.click()
    await apps.updateApp('rancher-kubewarden-controller', {
      navigate : false,
      questions: async() => {
        await ui.tab('Telemetry').click()
        await ui.checkbox('Enable Tracing').check()
        await ui.input('Jaeger endpoint configuration').fill('jaeger-operator-jaeger-collector.jaeger.svc.cluster.local:4317')
        await ui.checkbox('Jaeger endpoint insecure TLS configuration').check()
      }
    })
    // Wait until kubewarden controller restarts policyserver
    const now = new Date().toISOString()
    await shell.retry(`k logs -l app=kubewarden-policy-server-default -n cattle-kubewarden-system -c otc-container --since-time ${now} | grep -F "Everything is ready."`)
  })

  test('Check traces are visible', async({ ui, nav, shell }) => {
    const logline = ui.getRow('tracing-privpod').row.first()

    // Create trace log line
    await nav.cluster('local')
    await shell.privpod({ name: 'tracing-privpod' })
    // Check logs on policy server
    await nav.pserver('default', 'Tracing')
    await expect(logline).toBeVisible()
    // Check logs on the (recommended) policy
    await nav.capolicy('no-privileged-pod', 'Tracing')
    await expect(logline).toBeVisible()
  })
})

test.describe('Metrics', () => {
  let apps: RancherAppsPage
  let telPage: TelemetryPage

  test.beforeEach(async({ nav, page }) => {
    apps = new RancherAppsPage(page)
    telPage = new TelemetryPage(page)
    await nav.pserver('default', 'Metrics')
  })

  test('Install Monitoring', async({ nav }) => {
    // Monitoring is not installed
    await telPage.toBeIncomplete('monitoring')
    await expect(telPage.configBtn).toBeDisabled()
    // Install Monitoring
    await telPage.monitoringBtn.click()
    await apps.installChart(monitoringChart, {
      navigate : false,
      timeout  : 7 * 60_000,
      yamlPatch: `{"prometheus": {"additionalServiceMonitors": [{
             "name": "kubewarden",
             "selector": {"matchLabels": {"app": "kubewarden-policy-server-default"}},
             "namespaceSelector": {"matchNames": ["cattle-kubewarden-system"]},
             "endpoints": [{"port": "metrics","interval": "10s"}]
            }]}}`
    })
    // Monitoring is installed
    await nav.pserver('default', 'Metrics')
    await telPage.toBeComplete('monitoring')
  })

  test('Create Grafana ConfigMaps', async() => {
    // ConfigMaps are not created
    await telPage.toBeIncomplete('configmap')
    await expect(telPage.configBtn).toBeDisabled()
    // Create configmaps
    await telPage.configmapBtn.click()
    await telPage.toBeComplete('configmap')
  })

  test('Enable metrics', async({ ui, shell }) => {
    await telPage.toBeIncomplete('config')
    await telPage.configBtn.click()
    await apps.updateApp('rancher-kubewarden-controller', {
      navigate : false,
      questions: async() => {
        await ui.tab('Telemetry').click()
        await ui.checkbox('Enable Metrics').check()
      }
    })
    // Wait until kubewarden controller restarts policyserver
    const now = new Date().toISOString()
    await shell.retry(`k logs -l app=kubewarden-policy-server-default -n cattle-kubewarden-system -c otc-container --since-time ${now} | grep -F "Everything is ready."`)
  })

  test('Check metrics are visible', async({ page, nav }) => {
    await nav.pserver('default', 'Metrics')
    await expect(page.frameLocator('iframe')
      .getByLabel('Request accepted with no mutation percentage panel')
      .locator('div:text-matches("[1-9][0-9.]+%")')).toBeVisible({ timeout: 7 * 60_000 })
  })
})
