import { useEffect, useMemo, useState } from 'react';
import './BDDirectory.css';

// Same pattern DistrictMap.jsx uses for district-data.csv: a static file
// under public/data/, exported by hand from the Brain (Azure SQL) via the
// VS Code mssql extension's "Save Results As JSON" on dbo.vw_Clients.
// No live database connection from the browser — see the project notes on
// why that's never safe. This is v1: refresh the export and re-save this
// file whenever the Brain's client data changes; a live/authenticated
// version is a later step.
const DATA_URL = '/data/bd-clients.json';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

function formatValue(v) {
  if (v == null) return null;
  return currency.format(v);
}

function siteLabel(url) {
  if (!url) return null;
  const match = url.match(/\/sites\/([^/]+)/i);
  return match ? match[1] : 'SharePoint site';
}

export default function BDDirectory() {
  const [clients, setClients] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [query, setQuery] = useState('');
  const [marketFilter, setMarketFilter] = useState('All');
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(DATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setClients(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const markets = useMemo(() => {
    if (!clients) return [];
    return Array.from(new Set(clients.map((c) => c.Market).filter(Boolean))).sort();
  }, [clients]);

  const filtered = useMemo(() => {
    if (!clients) return [];
    const q = query.trim().toLowerCase();
    return clients
      .filter((c) => (showPast ? true : c.RelationshipStatus !== 'Past'))
      .filter((c) => marketFilter === 'All' || c.Market === marketFilter)
      .filter((c) => {
        if (!q) return true;
        return (
          c.ClientName?.toLowerCase().includes(q) ||
          c.CountyName?.toLowerCase().includes(q) ||
          c.TeamLead?.toLowerCase().includes(q) ||
          c.IntermediateUnit?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.ClientName.localeCompare(b.ClientName));
  }, [clients, query, marketFilter, showPast]);

  const stats = useMemo(() => {
    const totalValue = filtered.reduce((sum, c) => sum + (c.OurConstructionValue || 0), 0);
    const totalProjects = filtered.reduce((sum, c) => sum + (c.OurProjectCount || 0), 0);
    return { count: filtered.length, totalValue, totalProjects };
  }, [filtered]);

  return (
    <div className="bd-directory">
      <header className="bd-header">
        <div>
          <div className="bd-eyebrow">Business Development</div>
          <h1>Client Directory</h1>
        </div>
        <div className="bd-stats">
          <div className="bd-stat">
            <div className="bd-stat-value">{stats.count}</div>
            <div className="bd-stat-label">Clients shown</div>
          </div>
          <div className="bd-stat">
            <div className="bd-stat-value">{stats.totalProjects}</div>
            <div className="bd-stat-label">Our projects</div>
          </div>
          <div className="bd-stat">
            <div className="bd-stat-value">{formatValue(stats.totalValue) || '—'}</div>
            <div className="bd-stat-label">Tracked construction value</div>
          </div>
        </div>
      </header>

      <div className="bd-controls">
        <input
          type="text"
          className="bd-search"
          placeholder="Search clients, county, team lead…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="bd-select"
          value={marketFilter}
          onChange={(e) => setMarketFilter(e.target.value)}
        >
          <option value="All">All markets</option>
          {markets.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <label className="bd-toggle">
          <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
          Include past clients
        </label>
      </div>

      {loadError ? (
        <div className="bd-error">Couldn&apos;t load bd-clients.json: {loadError}</div>
      ) : !clients ? (
        <div className="bd-loading">Loading client data…</div>
      ) : (
        <div className="bd-table">
          <div className="bd-row bd-row-head">
            <div className="bd-col-name">Client</div>
            <div className="bd-col-geo">County / IU</div>
            <div className="bd-col-lead">Team Lead</div>
            <div className="bd-col-links">Links</div>
            <div className="bd-col-metric">Our Work</div>
          </div>
          {filtered.map((c) => (
            <div className="bd-row" key={c.AUN}>
              <div className="bd-col-name">
                <div className="bd-client-name">{c.ClientName}</div>
                <div className="bd-client-meta">
                  {c.EntityType}
                  {c.RelationshipStatus === 'Past' ? <span className="bd-badge-past">Past</span> : null}
                </div>
              </div>
              <div className="bd-col-geo">
                {c.CountyName ? `${c.CountyName} County` : c.StateCode || '—'}
                {c.IntermediateUnit ? <div className="bd-sub">{c.IntermediateUnit}</div> : null}
              </div>
              <div className="bd-col-lead">
                {c.TeamLead || <span className="bd-empty">Unassigned</span>}
                {c.TeamLeadEmail ? (
                  <a className="bd-email" href={`mailto:${c.TeamLeadEmail}`}>
                    {c.TeamLeadEmail}
                  </a>
                ) : null}
              </div>
              <div className="bd-col-links">
                {c.ClientSiteUrl ? (
                  <a className="bd-link" href={c.ClientSiteUrl} target="_blank" rel="noopener noreferrer">
                    {siteLabel(c.ClientSiteUrl)}
                  </a>
                ) : null}
                {c.Website ? (
                  <a
                    className="bd-link bd-link-site"
                    href={`https://${c.Website.replace(/^https?:\/\//, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {c.Website.replace(/^https?:\/\//, '')}
                  </a>
                ) : null}
              </div>
              <div className="bd-col-metric">
                {c.OurProjectCount ? (
                  <>
                    <div className="bd-metric-value">{c.OurProjectCount}</div>
                    <div className="bd-metric-label">{formatValue(c.OurConstructionValue) || 'project' + (c.OurProjectCount === 1 ? '' : 's')}</div>
                  </>
                ) : (
                  <span className="bd-empty">No projects yet</span>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 ? <div className="bd-empty-state">No clients match that search.</div> : null}
        </div>
      )}
    </div>
  );
}
