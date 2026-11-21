import { useEffect, useState } from 'react'
import { useApp } from '../store/AppContext'
import { ACTIVITIES, CHART_DATA, TEAM_PULSE } from '../data/mock'
import AreaChart from '../components/AreaChart'
import Avatar from '../components/Avatar'
import Icon from '../components/Icon'

const currency = (n) => '$' + Math.round(n).toLocaleString('en-US')
const number = (n) => Math.round(n).toLocaleString('en-US')

// Live stats simulation: numbers fluctuate periodically.
// In backend integration, this is replaced by WebSocket events.
function useLiveStats() {
  const [stats, setStats] = useState({ revenue: 48295, users: 5432, orders: 1248, conversion: 3.24 })
  const [updatedAt, setUpdatedAt] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setStats((s) => ({
        revenue: s.revenue + Math.round(Math.random() * 180),
        users: Math.max(0, s.users + Math.round((Math.random() - 0.4) * 12)),
        orders: s.orders + (Math.random() > 0.5 ? 1 : 0),
        conversion: Math.max(1, +(s.conversion + (Math.random() - 0.5) * 0.04).toFixed(2)),
      }))
      setUpdatedAt(new Date())
    }, 3500)
    return () => clearInterval(timer)
  }, [])

  return { stats, updatedAt }
}

export default function Dashboard() {
  const { can, toast } = useApp()
  const { stats, updatedAt } = useLiveStats()
  const [range, setRange] = useState('monthly')
  const data = CHART_DATA[range]
  const canWrite = can('dashboard', 'write')

  const time = updatedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <>
      {/* Page header */}
      <div className="page-head">
        <div>
          <h1>Business Control Center</h1>
          <p>Performance summary, operational health, and team activity in a single view.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => toast('Data exported (simulated).', 'info')}>
            <Icon name="download" /> Export
          </button>
          <button
            className="btn btn-primary"
            disabled={!canWrite}
            title={canWrite ? '' : 'You only have Read access to this module'}
            onClick={() => toast('New report created (simulated).')}
          >
            <Icon name="plus" /> Create Report
          </button>
        </div>
      </div>

      {/* KPI cards row — 4 columns matching reference */}
      <div className="dash-kpis">
        <div className="kpi-card">
          <div className="kpi-body">
            <span className="kpi-label">Active Users</span>
            <span className="kpi-value">{number(stats.users)}</span>
            <span className="kpi-delta delta-up">↑ 8.2% <span>since last month</span></span>
          </div>
          <div className="kpi-badge badge-green">
            <Icon name="users" />
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-body">
            <span className="kpi-label">Total Orders</span>
            <span className="kpi-value">{number(stats.orders)}</span>
            <span className="kpi-delta delta-up">↑ 13% <span>since last month</span></span>
          </div>
          <div className="kpi-badge badge-pink">
            <Icon name="package" />
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-body">
            <span className="kpi-label">Conversion Rate</span>
            <span className="kpi-value">{stats.conversion}%</span>
            <span className="kpi-delta delta-up">↑ 2.7% <span>since last month</span></span>
          </div>
          <div className="kpi-badge badge-blue">
            <Icon name="trend" />
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-body">
            <span className="kpi-label">Net Revenue</span>
            <span className="kpi-value">{currency(stats.revenue)}</span>
            <span className="kpi-delta delta-up">↑ 1.8% <span>since last month</span></span>
          </div>
          <div className="kpi-badge badge-amber">
            <Icon name="dollar" />
          </div>
        </div>
      </div>

      {/* Main two-column grid: left = chart + subkpis, right = team & activity */}
      <div className="dash-main-grid">
        {/* Left column */}
        <div className="dash-col-left">
          {/* Revenue chart card */}
          <section className="card card-pad">
            <div className="card-head">
              <div>
                <h3 className="card-title">Revenue Stream</h3>
                <p className="card-sub">In thousands USD (simulated)</p>
              </div>
              <div className="seg" role="group" aria-label="Time range">
                {[
                  ['daily', 'Daily'],
                  ['weekly', 'Weekly'],
                  ['monthly', 'Monthly'],
                ].map(([key, label]) => (
                  <button key={key} aria-pressed={range === key} onClick={() => setRange(key)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="legend">
              <span>
                <i style={{ background: 'var(--primary)' }} /> Revenue
              </span>
              <span>
                <i style={{ background: 'var(--info)' }} /> Subscriptions
              </span>
            </div>
            <AreaChart
              labels={data.labels}
              series={[
                { name: 'Revenue', color: 'var(--primary)', values: data.revenue },
                { name: 'Subscriptions', color: 'var(--info)', values: data.subscription },
              ]}
            />
          </section>

          {/* Sub-KPI row below chart */}
          <div className="kpis-subgrid">
            <div className="subkpi-item">
              <small>MRR</small>
              <strong>$128.4k</strong>
              <span className="delta delta-up" style={{ fontSize: '12px', fontWeight: 600 }}>+5.4%</span>
            </div>
            <div className="subkpi-item">
              <small>Monthly Churn</small>
              <strong>2.8%</strong>
              <span className="delta delta-down" style={{ fontSize: '12px', fontWeight: 600 }}>−0.3%</span>
            </div>
            <div className="subkpi-item">
              <small>NPS Score</small>
              <strong>62</strong>
              <span className="delta delta-up" style={{ fontSize: '12px', fontWeight: 600 }}>+4 pts</span>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="dash-col-right">
          {/* Team Pulse */}
          <section className="card card-pad">
            <div className="card-head">
              <h3 className="card-title">Team Pulse</h3>
              <span className="badge badge-teal">Live</span>
            </div>
            <div className="pulse-list">
              {TEAM_PULSE.map((p) => (
                <div key={p.label} className="list-row">
                  <span className="card-sub">{p.label}</span>
                  <strong>{p.value}</strong>
                </div>
              ))}
            </div>
          </section>

          {/* Recent Activity */}
          <section className="card card-pad">
            <div className="card-head">
              <h3 className="card-title">Recent Activity</h3>
              <div className="live">
                <i />
                <span className="live-text">Updated {time}</span>
              </div>
            </div>
            <div className="activity-list">
              {ACTIVITIES.map((a) => (
                <div key={a.id} className="activity">
                  <Avatar name={a.who} size="sm" />
                  <div>
                    <p>
                      <strong>{a.who}</strong> {a.what}
                    </p>
                    <small>{a.time}</small>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
