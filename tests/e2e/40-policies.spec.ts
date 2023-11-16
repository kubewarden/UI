import { test, expect } from './rancher-test'
import { PolicyServer, PolicyServersPage } from './pages/policyservers.page'
import { AdmissionPoliciesPage, ClusterAdmissionPoliciesPage, BasePolicyPage, Policy } from './pages/policies.page'
import { RancherUI } from './components/rancher-ui'

function isAP(polPage: BasePolicyPage) { return polPage instanceof AdmissionPoliciesPage }
function isCAP(polPage: BasePolicyPage) { return polPage instanceof ClusterAdmissionPoliciesPage }

const pMinimal: Policy = {
  title: 'Pod Privileged Policy',
  name :  'ppp-defaults',
}

async function checkPolicy(p: Policy, polPage: BasePolicyPage, ui: RancherUI) {
  await test.step(`Policy checks: ${p.name}`, async() => {
    // Check default values if unset
    p.mode ??= 'Protect'
    p.audit ??= 'On'
    p.server ??= 'default'
    p.namespace ??= 'default'
    p.module ??= (
      await polPage.open(p),
      await polPage.module.inputValue()
    )
    const row = ui.getRow(p.name)

    // Check overview page
    await polPage.goto()
    await expect(row.column('Mode')).toHaveText(p.mode)
    await expect(row.column('Policy Server')).toHaveText(p.server)
    test.info().annotations.push({ type: 'Feature', description: 'Policy title (module) should be visible' })
    test.info().annotations.push({ type: 'Feature', description: 'AdmissionPolicy namespace should be visible on overview page' })

    // Check details page
    await row.open()
    await expect(ui.page.getByText(new RegExp(`^\\s+${polPage.kind}:\\s+${p.name}`))).toBeVisible()
    await expect(ui.page.getByText('API Versions')).toBeVisible()

    // Check config page
    await ui.button('Config').click()
    await expect(polPage.name).toHaveValue(p.name)
    await expect(polPage.module).toHaveValue(p.module)
    await expect(polPage.mode(p.mode)).toBeChecked()
    await expect(polPage.audit(p.audit)).toBeChecked()
    await expect(polPage.server).toContainText(p.server)
    if (isAP(polPage)) {
      await expect(polPage.namespace).toContainText(p.namespace)
    }

    // Check edit config
    await polPage.goto()
    await row.action('Edit Config')
    await expect(polPage.name).toBeDisabled()
    await expect(polPage.module).toBeEnabled()
    await expect(polPage.modeGroup).toBeAllEnabled({ enabled: p.mode === 'Monitor' })
    await expect(polPage.auditGroup).toBeAllEnabled()
    test.info().annotations.push({ type: 'BUG', description: 'Policy server option should be disabled' })
    // await expect(polPage.server).toBeAllEnabled({enabled: false})
    if (isAP(polPage)) {
      await expect(polPage.namespace).toBeAllEnabled({ enabled: false })
    }

    // Check policy is active
    await expect(ui.page.locator('div.primaryheader').locator('span.badge-state')).toHaveText('Active', { timeout: 2 * 60_000 })
  })
}

const pageTypes = [AdmissionPoliciesPage, ClusterAdmissionPoliciesPage]

for (const PolicyPage of pageTypes) {
  const abbrName = PolicyPage.name.replace('Page', '').match(/[A-Z]/g)?.join('')

  test(`${abbrName}: Form fields`, async({ page, ui }) => {
    const polPage = new PolicyPage(page)
    const p: Policy = { title: 'Pod Privileged Policy', name: '' }

    await test.step('Missing required fields', async() => {
      const finishBtn = ui.button('Finish')
      await polPage.open(p)

      // Create without name
      await polPage.setName('')
      await finishBtn.click()
      await expect(page.locator('div.error').getByText('Required value: name')).toBeVisible()
      await finishBtn.waitFor({ timeout: 10_000 }) // button name changes back Error -> Finish
      await polPage.setName('name')

      // Try without module
      await polPage.setModule('')
      await expect(finishBtn).not.toBeEnabled()
      await polPage.setModule('module')
      await expect(finishBtn).toBeEnabled()
    })

    await test.step('Policy specific fields A/CA', async() => {
      // Open page and wait for the form
      await polPage.open(p)
      await expect(polPage.name).toBeVisible()
      // Check fields based on policy type
      await expect(polPage.namespace).toBeVisible({ visible: isAP(polPage) })
      await expect(ui.tab('Namespace Selector')).toBeVisible({ visible: isCAP(polPage) })
    })

    await test.step('Rules are disabled', async() => {
      await polPage.open(p)
      await polPage.selectTab('Rules')
      await expect(page.locator('section#rules')).toBeAllEnabled({ enabled: false })
    })
  })

  test(`${abbrName}: Default policy settings`, async({ page, ui }) => {
    const polPage = new PolicyPage(page)
    const row = await polPage.create(pMinimal)
    await checkPolicy(pMinimal, polPage, ui)
    await polPage.delete(row)
  })

  test(`${abbrName}: Custom policy settings`, async({ page, ui, shell }) => {
    const polPage = new PolicyPage(page)
    const ps: PolicyServer = { name: 'ps-custom' }
    const p: Policy = { ...pMinimal, mode: 'Monitor', audit: 'Off', server: ps.name, module: 'ghcr.io/kubewarden/policies/pod-privileged:v0.2.6' }

    // Create custom server
    const psPage = new PolicyServersPage(page)
    await psPage.create(ps)

    // Create custom namespace
    if (isAP(polPage)) {
      p.namespace = 'ns-custom'
      await shell.run(`k create ns ${p.namespace}`)
    }

    // Create and check policy
    const row = await polPage.create(p)
    await checkPolicy(p, polPage, ui)
    await shell.privpod({ ns: p.namespace })

    // Update to Protect mode
    await polPage.goto()
    await polPage.updateToProtect(row)
    await expect(row.column('Mode')).toHaveText('Protect')
    // Check protect mode
    test.info().annotations.push({ type: 'BUG', description: 'Policy should be pending (mode or state) until it starts in protect mode' })
    await shell.waitPolicyState(p, polPage.kind)
    await shell.privpod({ ns: p.namespace, status: 1 })

    // Delete custom PS & NS, policy is deleted too
    await psPage.delete(ps.name)
    await polPage.goto()
    await expect(page.getByRole('cell', { name: 'Status' })).toBeVisible()
    await expect(row.row).not.toBeVisible()
    if (isAP(polPage)) await shell.run(`k delete ns ${p.namespace}`)
  })
}
