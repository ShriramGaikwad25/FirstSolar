"use client";

import React, { useEffect, useRef } from "react";
import ValidationsPanel from "./ValidationsPanel";

const TABBAR_HTML = `
<div class="tabbar">
  <button type="button" class="nav-item active" data-view="overview"><span class="nav-icon icon-overview">◫</span>Overview</button>
  <button type="button" class="nav-item" data-view="naming"><span class="nav-icon icon-naming">Aa</span>Validations</button>
  <button type="button" class="nav-item" data-view="vaults"><span class="nav-icon icon-vaults">▣</span>Vault Management</button>
</div>
`;

const OVERVIEW_HTML = `
<div class="page-header">
  <div>
    <h2>Global AD Configuration</h2>
    <p>Manage enterprise-wide AD domain onboarding, routing, naming and vault references from one centralized control plane.</p>
  </div>
  <div class="actions">
    <button class="btn" onclick="openModal('bulkInviteModal')">Send Bulk Invites</button>
    <button class="btn primary" onclick="openModal('addDomainModal')">Add AD Domain</button>
  </div>
</div>

<div class="grid-4">
  <div class="card metric"><div class="label">Registered Domains</div><div class="value">3</div></div>
  <div class="card metric"><div class="label">Active Connectors</div><div class="value">2</div></div>
  <div class="card metric"><div class="label">Pending Setup</div><div class="value">1</div><div class="meta"><span class="dot" style="background:#b7791f"></span>Invitation sent</div></div>
  <div class="card metric"><div class="label">Attention Required</div><div class="value">0</div><div class="meta"><span class="dot" style="background:#c33c54"></span>No errors or upgrades pending</div></div>
</div>

<div class="section card section-card">
  <div class="section-title">
    <div><h3>AD Domain Estate</h3><p>Operational view across registered domain connectors</p></div>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Connector Name</th><th>Domain</th><th>Admin</th><th>Region</th><th>Status</th><th>Vault</th><th>Version</th></tr></thead>
      <tbody id="overviewDomainRows"></tbody>
    </table>
  </div>
</div>

<div class="section card section-card" id="globalSettingsCard">
  <div class="section-title">
    <div><h3>Global Settings</h3><p>Local admins have the ability to override these settings</p></div>
    <button type="button" class="btn" id="globalSettingsEditBtn" onclick="toggleGlobalSettingsEdit()">Edit</button>
  </div>
  <div class="settings-grid">
    <div class="setting-item"><span class="setting-label">Port</span><input type="text" class="setting-input" value="636" disabled></div>
    <div class="setting-item"><span class="setting-label">SSL enabled</span><label class="toggle-switch"><input type="checkbox" checked disabled onchange="toast('SSL enabled: '+(this.checked?'Yes':'No'))"><span class="toggle-slider"></span></label></div>
    <div class="setting-item"><span class="setting-label">Delete account on delete request</span><label class="toggle-switch"><input type="checkbox" disabled onchange="toast('Delete account on delete request: '+(this.checked?'Yes':'No'))"><span class="toggle-slider"></span></label></div>
    <div class="setting-item"><span class="setting-label">Revoke membership</span><label class="toggle-switch"><input type="checkbox" checked disabled onchange="toast('Revoke membership: '+(this.checked?'Yes':'No'))"><span class="toggle-slider"></span></label></div>
    <div class="setting-item"><span class="setting-label">Primary Identity Attribute</span><input type="text" class="setting-input" value="samaccountname" disabled></div>
  </div>
</div>
`;

const VAULTS_HTML = `
<div class="page-header">
  <div><h2>Vault Management</h2><p>Allow delegated domain administrators to register one vault per domain while providing centralized visibility and validation status to the IAM team.</p></div>
  <div class="actions"><button class="btn" onclick="toast('Vault report exported')">Export</button><button class="btn primary" onclick="openModal('addVaultModal')">Register Vault</button></div>
</div>
<div class="grid-4">
  <div class="card metric"><div class="label">Registered Vaults</div><div class="value">1</div><div class="meta">US domain</div></div>
  <div class="card metric"><div class="label">Validated</div><div class="value">1</div><div class="meta">Runtime credential access confirmed</div></div>
  <div class="card metric"><div class="label">Validation Failed</div><div class="value">0</div><div class="meta">No validation issues</div></div>
  <div class="card metric"><div class="label">Unregistered</div><div class="value">0</div><div class="meta">All domains covered</div></div>
</div>
<div class="section card section-card">
  <div class="section-title"><div><h3>Vault Registry</h3><p>Secret values are never stored or displayed in KeyForge</p></div></div>
  <div class="table-wrap"><table><thead><tr><th>Vault Name</th><th>Provider</th><th>Domains</th><th>Owner</th><th>Secret Reference</th><th>Status</th><th>Last Validated</th><th>Actions</th></tr></thead><tbody id="vaultRows"></tbody></table></div>
</div>
`;

const TAIL_HTML = `
<div class="drawer-backdrop" id="drawerBackdrop" onclick="closeDrawer()"></div>
<aside class="drawer" id="drawer">
  <div class="drawer-head"><div><h3 id="drawerTitle">Domain Details</h3><p id="drawerSubtitle">Connector summary and operations</p></div><button class="close" onclick="closeDrawer()">✕</button></div>
  <div class="drawer-body" id="drawerBody"></div>
</aside>

<div class="modal-backdrop" id="addDomainModal">
  <div class="modal"><div class="modal-head"><h3>Add AD Domain</h3><button class="close" onclick="closeModal('addDomainModal')">✕</button></div><div class="modal-body"><div class="form-grid"><div class="field full-width"><label>Application Name</label><input id="newDomainName" placeholder="e.g. apac.company.local"></div><div class="field"><label>Domain administrator</label><input id="newAdminName" placeholder="Full name"></div><div class="field"><label>Administrator email</label><input id="newAdminEmail" placeholder="name@company.com"></div><div class="field"><label>Region</label><input id="newCountry" placeholder="Region value"></div><div class="field"><label>Onboarding action</label><select id="newOnboardingAction"><option>Send invitation</option><option>Create connector directly</option></select></div></div></div><div class="modal-foot"><button class="btn" onclick="closeModal('addDomainModal')">Cancel</button><button class="btn primary" onclick="addDomain()">Add Domain</button></div></div>
</div>

<div class="modal-backdrop" id="bulkInviteModal">
  <div class="modal"><div class="modal-head"><h3>Send Bulk Invitations</h3><button class="close" onclick="closeModal('bulkInviteModal')">✕</button></div><div class="modal-body"><p style="font-size:12px;color:var(--muted);line-height:1.6;margin-top:0">Send onboarding invitations to domain administrators for all selected draft or pending domains.</p><div class="bulk-file-card">
        <div class="bulk-file-row">
          <div class="bulk-file-icon template"><span>⬇</span></div>
          <div class="bulk-file-text"><strong>Bulk invite template</strong><span>Download the sample file and fill in your invitation list</span></div>
          <a class="btn small" href="/global-ad-config-management/bulk-invite-sample.xlsx" download>Download</a>
        </div>
        <div class="bulk-file-divider"></div>
        <div class="bulk-file-row">
          <div class="bulk-file-icon upload"><span>⬆</span></div>
          <div class="bulk-file-text"><strong>Upload filled file</strong><span id="bulkInviteFileName">No file chosen</span></div>
          <input type="file" id="bulkInviteFile" accept=".xlsx,.xls,.csv" style="display:none" onchange="handleBulkInviteFile(this)">
          <button class="btn small" onclick="document.getElementById('bulkInviteFile').click()">Choose File</button>
        </div>
      </div><div id="bulkInviteResult" class="test-result" style="display:none"></div></div><div class="modal-foot"><button class="btn" onclick="closeModal('bulkInviteModal')">Cancel</button><button class="btn primary" onclick="sendBulkInvites()">Send Invitations</button></div></div>
</div>


<div class="modal-backdrop" id="addVaultModal">
  <div class="modal"><div class="modal-head"><h3>Register Vault</h3><button class="close" onclick="closeModal('addVaultModal')">✕</button></div><div class="modal-body"><div class="form-grid"><div class="field"><label>Vault name</label><input placeholder="Friendly name"></div><div class="field"><label>Provider</label><select><option>OCI Vault</option><option>CyberArk</option><option>HashiCorp Vault</option><option>Azure Key Vault</option></select></div><div class="field"><label>Associated domain</label><select><option>br.corp.local</option><option>de.corp.local</option><option>us.corp.local</option></select></div><div class="field"><label>Secret reference/path</label><input placeholder="vault/path/secret"></div></div></div><div class="modal-foot"><button class="btn" onclick="closeModal('addVaultModal')">Cancel</button><button class="btn primary" onclick="closeModal('addVaultModal');toast('Vault registration saved')">Register &amp; Validate</button></div></div>
</div>

<div class="toast" id="toast"></div>
`;

export default function GlobalAdConfigManagementPage() {
  const tailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/global-ad-config-management/styles.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = `/global-ad-config-management/app.js?v=${Date.now()}`;
    document.body.appendChild(script);

    return () => {
      document.head.removeChild(link);
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="flex flex-col w-full gadcm">
      <div dangerouslySetInnerHTML={{ __html: TABBAR_HTML }} />
      <section className="content">
        <div className="view active" id="overview" dangerouslySetInnerHTML={{ __html: OVERVIEW_HTML }} />
        <div className="view" id="naming">
          <ValidationsPanel />
        </div>
        <div className="view" id="vaults" dangerouslySetInnerHTML={{ __html: VAULTS_HTML }} />
      </section>
      <div ref={tailRef} dangerouslySetInnerHTML={{ __html: TAIL_HTML }} />
    </div>
  );
}
