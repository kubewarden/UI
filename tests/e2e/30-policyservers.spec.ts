import semver from 'semver'
import { test, expect } from './rancher/rancher-test'
import { PolicyServersPage, PolicyServer } from './pages/policyservers.page'
import { Policy, AdmissionPoliciesPage, ClusterAdmissionPoliciesPage } from './pages/policies.page'

const expect3m = expect.configure({ timeout: 3 * 60_000 })
const MODE = process.env.MODE

test('Policy Servers', async({ page, ui, nav }) => {
  const server: PolicyServer = { name: 'test-policyserver' }
  const policy: Policy = { title: 'Pod Privileged Policy', name: 'test-policy-podpriv', server: server.name }

  const psPage = new PolicyServersPage(page)
  const apPage = new AdmissionPoliciesPage(page)
  const capPage = new ClusterAdmissionPoliciesPage(page)

  const psRow = ui.tableRow(server.name)
  const apRow = ui.tableRow(policy.name, { group: 'AdmissionPolicy' })
  const capRow = ui.tableRow(policy.name, { group: 'ClusterAdmissionPolicy' })

  await test.step('Create resources', async() => {
    await psPage.create(server)
    await apPage.create(policy)
    await capPage.create(policy)
  })

  await test.step('Check Overview page', async() => {
    // PS is active and has 2 policies
    await nav.pserver()
    await expect3m(psRow.column('Status')).toHaveText('Active')
    await expect(psRow.column('Policies')).toHaveText('2')

    const defaultImage = (await ui.tableRow('default').column('Image').textContent())?.trim().split(':') || []
    const createdImage = (await psRow.column('Image').textContent())?.trim().split(':') || []
    const [dImg, dVer] = [defaultImage[0], defaultImage[1]]
    let [cImg, cVer] = [createdImage[0], createdImage[1]]
    const latestVer = '99.0.0'

    // Convert "latest" string to a valid version
    if (MODE === 'fleet' && cVer === 'latest') cVer = latestVer

    // Validate URLs
    expect(cImg).toEqual(dImg)
    expect(cImg).toContain('policy-server')

    // Validate semver
    expect(semver.valid(cVer)).not.toBeNull()
    expect(semver.valid(dVer)).not.toBeNull()

    if (MODE === 'fleet') {
      expect(semver.gte(cVer, dVer)).toBeTruthy()
      // Stable version could not be determined, using latest
      if (semver.gt(cVer, dVer)) {
        expect(semver.eq(cVer, latestVer)).toBeTruthy()
      }
    } else {
      expect(semver.eq(cVer, dVer)).toBeTruthy()
    }
  })

  await test.step('Check Details page', async() => {
    await psRow.open()
    await expect3m(apRow.column('Status')).toHaveText('Active')
    await expect3m(capRow.column('Status')).toHaveText('Active')
  })

  await test.step('Scale policy server', async() => {
    await nav.pserver()
    await psRow.action('Edit Config')
    await psPage.setReplicas(2)
    await ui.button('Save').click()
    await psRow.toHaveState('Updating')
    await psRow.toHaveState('Active')
  })

  await test.step('Delete policy server', async() => {
    await psRow.delete()
    await apPage.goto()
    await expect(page.locator('table.sortable-table')).toBeVisible()
    await expect(apRow.row).not.toBeVisible()
    await capPage.goto()
    await expect(page.locator('table.sortable-table')).toBeVisible()
    await expect(capRow.row).not.toBeVisible()
  })
})
