import { useState, useEffect } from 'react'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, RadialBarChart, RadialBar, Legend,
} from 'recharts'
import {
  LayoutDashboard, CheckSquare, FolderKanban, CalendarDays,
  AlertTriangle, Clock, ChevronDown, ChevronRight, ExternalLink,
  Zap, Target, Users, RefreshCw,
} from 'lucide-react'

// ── Theme ────────────────────────────────────────────────────────────────────

const ORANGE = '#f97316'
const ORANGE_LIGHT = '#fdba74'
const ORANGE_DARK = '#c2410c'
const SLATE = { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 400: '#94a3b8', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a' }

const CHART_COLORS = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#eab308', '#ef4444', '#06b6d4', '#ec4899']

const STATUS_COLORS = {
  'Not Started': SLATE[400], 'To Do': SLATE[400], 'Next Up': '#3b82f6',
  'In Progress': ORANGE, 'Waiting': '#eab308', 'Blocked': '#ef4444',
  'Done': '#22c55e', 'Complete': '#22c55e', 'Canceled': SLATE[400],
}

const PRIORITY_COLORS = { 'P1': '#ef4444', 'P2': '#f97316', 'P3': '#eab308', 'P4': '#94a3b8', 'p1': '#ef4444', 'p2': '#f97316', 'p3': '#eab308', 'p4': '#94a3b8' }

const HEALTH_COLORS = { 'On Track': '#22c55e', 'At Risk': '#eab308', 'Off Track': '#ef4444' }

// ── Helpers ──────────────────────────────────────────────────────────────────

function countBy(arr, key) {
  const counts = {}
  arr.forEach(item => {
    const val = typeof key === 'function' ? key(item) : item[key]
    if (val) counts[val] = (counts[val] || 0) + 1
  })
  return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

const priorityOrder = { P1: 0, P2: 1, P3: 2, P4: 3, p1: 0, p2: 1, p3: 2, p4: 3 }
function sortByPriority(arr) {
  return [...arr].sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9))
}

// ── Small Components ─────────────────────────────────────────────────────────

function PriorityBadge({ priority }) {
  if (!priority) return null
  const p = priority.toUpperCase()
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      fontSize: 11, fontWeight: 700, color: '#fff',
      background: PRIORITY_COLORS[priority] || SLATE[400],
    }}>{p}</span>
  )
}

function StatusBadge({ status }) {
  if (!status) return null
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 12,
      fontSize: 11, fontWeight: 600,
      color: STATUS_COLORS[status] || SLATE[600],
      border: `1px solid ${STATUS_COLORS[status] || SLATE[400]}`,
      background: `${STATUS_COLORS[status] || SLATE[400]}18`,
    }}>{status}</span>
  )
}

function SourceTag({ source }) {
  const colors = { todoist: '#ef4444', notion: '#000' }
  return (
    <span style={{
      display: 'inline-block', padding: '1px 6px', borderRadius: 3,
      fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
      color: '#fff', background: colors[source] || SLATE[600],
    }}>{source}</span>
  )
}

function HealthDot({ health }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: HEALTH_COLORS[health] || SLATE[400], marginRight: 6,
    }} />
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: SLATE[800], color: '#fff', padding: '8px 12px',
      borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,.3)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>{p.name}: {p.value}</div>
      ))}
    </div>
  )
}

// ── Card wrapper ─────────────────────────────────────────────────────────────

function Card({ title, badge, children, style }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 24,
      boxShadow: '0 1px 3px rgba(0,0,0,.08)', ...style,
    }}>
      {title && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: SLATE[800] }}>{title}</h3>
          {badge}
        </div>
      )}
      {children}
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ icon, label, value, sub, color }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 20,
      boxShadow: '0 1px 3px rgba(0,0,0,.08)',
      borderLeft: `4px solid ${color || ORANGE}`,
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: `${color || ORANGE}15`, display: 'flex',
        alignItems: 'center', justifyContent: 'center', color: color || ORANGE,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 700, color: SLATE[900] }}>{value}</div>
        <div style={{ fontSize: 12, color: SLATE[600], fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: SLATE[400], marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ── OVERVIEW TAB ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function OverviewTab({ data }) {
  const { todoist, notion } = data
  const allTasks = [
    ...todoist.tasks.filter(t => !t.checked).map(t => ({ ...t, source: 'todoist', title: t.content })),
    ...notion.tasks.map(t => ({ ...t, source: 'notion', title: t.title })),
  ]
  const activeTasks = allTasks.length
  const highPriority = allTasks.filter(t => t.priority === 'p1' || t.priority === 'P1' || t.priority === 'p2' || t.priority === 'P2').length
  const blockedCount = notion.tasks.filter(t => t.blocked).length
  const projectCount = notion.projects.length

  const statusData = countBy(notion.tasks, 'status')
  const priorityData = countBy(allTasks, t => (t.priority || 'p4').toUpperCase())
  const effortData = countBy(notion.tasks.filter(t => t.effort), 'effort')
  const contextCounts = {}
  notion.tasks.forEach(t => (t.context || []).forEach(c => { contextCounts[c] = (contextCounts[c] || 0) + 1 }))
  const contextData = Object.entries(contextCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  const healthData = countBy(notion.projects.filter(p => p.health), 'health')

  const topTasks = sortByPriority(allTasks.filter(t => {
    const p = (t.priority || '').toLowerCase()
    return p === 'p1' || p === 'p2'
  })).slice(0, 8)

  return (
    <div>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KPICard icon={<CheckSquare size={22} />} label="Active Tasks" value={activeTasks} sub={`${todoist.tasks.filter(t => !t.checked).length} Todoist + ${notion.tasks.length} Notion`} color={ORANGE} />
        <KPICard icon={<AlertTriangle size={22} />} label="High Priority" value={highPriority} sub="P1 & P2 items" color="#ef4444" />
        <KPICard icon={<Zap size={22} />} label="Blocked" value={blockedCount} sub="Needs attention" color="#eab308" />
        <KPICard icon={<FolderKanban size={22} />} label="Active Projects" value={projectCount} sub={`${notion.projects.filter(p => p.weeklyFocus).length} weekly focus`} color="#3b82f6" />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
        {/* Status pie */}
        <Card title="Task Status (Notion)">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name} (${value})`} labelLine={false}>
                {statusData.map((_, i) => <Cell key={i} fill={STATUS_COLORS[statusData[i].name] || CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Priority bar */}
        <Card title="Priority Distribution">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={priorityData} barSize={32}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {priorityData.map((d, i) => <Cell key={i} fill={PRIORITY_COLORS[d.name] || CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Effort bar */}
        <Card title="Effort Breakdown">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={effortData} barSize={32}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {effortData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {/* Context pie */}
        <Card title="Context Tags">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={contextData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                {contextData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Project health */}
        <Card title="Project Health">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={healthData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                {healthData.map((d, i) => <Cell key={i} fill={HEALTH_COLORS[d.name] || CHART_COLORS[i]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* High priority list */}
        <Card title="High Priority Tasks" badge={<span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>{topTasks.length} items</span>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topTasks.map((t, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 8, background: SLATE[50],
              }}>
                <PriorityBadge priority={t.priority} />
                <span style={{ fontSize: 13, flex: 1 }}>{t.title}</span>
                <SourceTag source={t.source} />
              </div>
            ))}
            {topTasks.length === 0 && <div style={{ color: SLATE[400], fontSize: 13 }}>No high priority tasks</div>}
          </div>
        </Card>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ── TASKS TAB ────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function TodoistTaskItem({ task, subtasks }) {
  const [open, setOpen] = useState(false)
  const hasChildren = subtasks.length > 0
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px', borderRadius: 8, background: '#fff',
        border: `1px solid ${SLATE[200]}`, cursor: hasChildren ? 'pointer' : 'default',
      }} onClick={() => hasChildren && setOpen(!open)}>
        {hasChildren ? (open ? <ChevronDown size={14} color={SLATE[400]} /> : <ChevronRight size={14} color={SLATE[400]} />) : <div style={{ width: 14 }} />}
        <PriorityBadge priority={task.priority} />
        <span style={{ flex: 1, fontSize: 13, textDecoration: task.checked ? 'line-through' : 'none', color: task.checked ? SLATE[400] : SLATE[800] }}>{task.content}</span>
        {task.due && <span style={{ fontSize: 11, color: SLATE[400] }}>{task.due.date}</span>}
        {task.labels?.length > 0 && task.labels.map((l, i) => (
          <span key={i} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: `${ORANGE}20`, color: ORANGE_DARK, fontWeight: 600 }}>{l}</span>
        ))}
      </div>
      {open && subtasks.map((st, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px 8px 42px', borderRadius: 6, background: SLATE[50],
          marginTop: 2, marginLeft: 16,
        }}>
          <PriorityBadge priority={st.priority} />
          <span style={{ flex: 1, fontSize: 12, color: st.checked ? SLATE[400] : SLATE[700] }}>{st.content}</span>
          {st.due && <span style={{ fontSize: 11, color: SLATE[400] }}>{st.due.date}</span>}
        </div>
      ))}
    </div>
  )
}

function TasksTab({ data }) {
  const { todoist, notion } = data
  const sectionMap = {}
  todoist.sections.forEach(s => { sectionMap[s.id] = s.name })

  // Group todoist tasks: top-level vs subtasks
  const topLevel = todoist.tasks.filter(t => !t.parentId)
  const subtaskMap = {}
  todoist.tasks.filter(t => t.parentId).forEach(t => {
    if (!subtaskMap[t.parentId]) subtaskMap[t.parentId] = []
    subtaskMap[t.parentId].push(t)
  })

  // Group by section
  const grouped = {}
  topLevel.forEach(t => {
    const sec = sectionMap[t.sectionId] || 'Unsectioned'
    if (!grouped[sec]) grouped[sec] = []
    grouped[sec].push(t)
  })

  const notionSorted = sortByPriority(notion.tasks)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      {/* Todoist */}
      <Card title="Todoist Tasks" badge={<span style={{ fontSize: 12, color: SLATE[400] }}>{todoist.tasks.length} total</span>}>
        {Object.entries(grouped).map(([section, tasks]) => (
          <div key={section} style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
              color: ORANGE, marginBottom: 8, paddingBottom: 4,
              borderBottom: `2px solid ${ORANGE}30`,
            }}>{section}</div>
            {sortByPriority(tasks).map(t => (
              <TodoistTaskItem key={t.id} task={t} subtasks={subtaskMap[t.id] || []} />
            ))}
          </div>
        ))}
      </Card>

      {/* Notion */}
      <Card title="Notion Tasks" badge={<span style={{ fontSize: 12, color: SLATE[400] }}>{notion.tasks.length} tasks</span>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {notionSorted.map((t, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', borderRadius: 8,
              background: t.blocked ? '#fef2f220' : '#fff',
              border: `1px solid ${t.blocked ? '#ef444440' : SLATE[200]}`,
            }}>
              <PriorityBadge priority={t.priority} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{t.title}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  <StatusBadge status={t.status} />
                  {t.effort && <span style={{ fontSize: 10, color: SLATE[400] }}>Effort: {t.effort}</span>}
                  {t.energy && <span style={{ fontSize: 10, color: SLATE[400] }}>Energy: {t.energy}</span>}
                  {t.blocked && <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 700 }}>BLOCKED</span>}
                  {t.aiDelegated && <span style={{ fontSize: 10, color: '#a855f7', fontWeight: 600 }}>AI</span>}
                  {(t.context || []).map((c, j) => (
                    <span key={j} style={{ fontSize: 10, padding: '0 5px', borderRadius: 3, background: `${ORANGE}15`, color: ORANGE_DARK }}>{c}</span>
                  ))}
                </div>
              </div>
              {t.deadline && <span style={{ fontSize: 11, color: SLATE[400] }}>{t.deadline}</span>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ── PROJECTS TAB ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function ProjectsTab({ data }) {
  const projects = sortByPriority(data.notion.projects)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
      {projects.map((p, i) => (
        <div key={i} style={{
          background: '#fff', borderRadius: 12, padding: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,.08)',
          borderTop: `3px solid ${HEALTH_COLORS[p.health] || ORANGE}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: SLATE[800], marginBottom: 4 }}>{p.name}</h4>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <StatusBadge status={p.status} />
                <PriorityBadge priority={p.priority} />
                {p.weeklyFocus && (
                  <span style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 3,
                    background: `${ORANGE}20`, color: ORANGE_DARK, fontWeight: 700,
                  }}>WEEKLY FOCUS</span>
                )}
              </div>
            </div>
            {p.health && (
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: HEALTH_COLORS[p.health] || SLATE[400] }}>
                <HealthDot health={p.health} />{p.health}
              </div>
            )}
          </div>

          {p.outcome && (
            <div style={{ fontSize: 12, color: SLATE[600], marginBottom: 8 }}>
              <strong>Outcome:</strong> {p.outcome}
            </div>
          )}
          {p.successMetric && (
            <div style={{ fontSize: 12, color: SLATE[600], marginBottom: 8 }}>
              <strong>Success Metric:</strong> {p.successMetric}
            </div>
          )}

          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: SLATE[400], marginTop: 12 }}>
            {p.startDate && <span>Start: {p.startDate}</span>}
            {p.targetDate && <span>Target: {p.targetDate}</span>}
            {p.automationReady && <span style={{ color: '#22c55e', fontWeight: 600 }}>Automation Ready</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ── MEETINGS TAB ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function MeetingsTab({ data }) {
  const meetings = data.notion.meetings
  const typeData = countBy(meetings.filter(m => m.type), 'type')

  return (
    <div>
      {/* Meeting type chart */}
      <Card title="Meetings by Type" style={{ marginBottom: 24 }}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={typeData} barSize={36}>
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {typeData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Meeting list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {meetings.map((m, i) => (
          <div key={i} style={{
            background: '#fff', borderRadius: 10, padding: 16,
            boxShadow: '0 1px 3px rgba(0,0,0,.08)',
            borderLeft: `4px solid ${CHART_COLORS[typeData.findIndex(t => t.name === m.type) % CHART_COLORS.length] || ORANGE}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600 }}>{m.title}</h4>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {m.type && (
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 12,
                    background: `${ORANGE}15`, color: ORANGE_DARK, fontWeight: 600,
                  }}>{m.type}</span>
                )}
                {m.date && <span style={{ fontSize: 11, color: SLATE[400] }}>{m.date}</span>}
              </div>
            </div>
            {m.decisions && (
              <div style={{ fontSize: 12, color: SLATE[600], marginBottom: 4 }}>
                <strong style={{ color: SLATE[800] }}>Decisions:</strong> {m.decisions}
              </div>
            )}
            {m.nextActions && (
              <div style={{ fontSize: 12, color: SLATE[600] }}>
                <strong style={{ color: ORANGE_DARK }}>Next Actions:</strong> {m.nextActions}
              </div>
            )}
          </div>
        ))}
        {meetings.length === 0 && (
          <div style={{ textAlign: 'center', color: SLATE[400], padding: 40 }}>No meetings in the last 30 days</div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ── MAIN APP ─────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'meetings', label: 'Meetings', icon: CalendarDays },
]

export default function App() {
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('overview')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`./data.json?t=${Date.now()}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12 }}>
      <RefreshCw size={32} color={ORANGE} style={{ animation: 'spin 1s linear infinite' }} />
      <div style={{ color: SLATE[600], fontSize: 14 }}>Loading dashboard...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12 }}>
      <AlertTriangle size={32} color="#ef4444" />
      <div style={{ color: '#ef4444', fontSize: 14 }}>Failed to load data: {error}</div>
    </div>
  )

  const lastUpdated = data.lastUpdated
    ? formatDistanceToNow(parseISO(data.lastUpdated), { addSuffix: true })
    : 'unknown'

  return (
    <div style={{ minHeight: '100vh', background: SLATE[100] }}>
      {/* Header */}
      <header style={{
        background: `linear-gradient(135deg, ${SLATE[900]}, ${SLATE[800]})`,
        padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            fontSize: 24, fontWeight: 800, letterSpacing: -1,
            background: `linear-gradient(135deg, ${ORANGE}, ${ORANGE_LIGHT})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>SAM</div>
          <div>
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>Strategic Asset Management</div>
            <div style={{ color: SLATE[400], fontSize: 12 }}>Executive Dashboard</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ color: SLATE[400], fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={14} />
            Updated {lastUpdated}
          </div>
          <div style={{
            background: `${ORANGE}20`, color: ORANGE, padding: '4px 12px',
            borderRadius: 8, fontSize: 12, fontWeight: 600,
          }}>Luke's View</div>
        </div>
      </header>

      {/* Tab bar */}
      <nav style={{
        background: '#fff', borderBottom: `1px solid ${SLATE[200]}`,
        padding: '0 32px', display: 'flex', gap: 4,
      }}>
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '12px 20px', background: 'none', border: 'none',
              borderBottom: `2px solid ${active ? ORANGE : 'transparent'}`,
              color: active ? ORANGE : SLATE[600],
              fontWeight: active ? 600 : 400, fontSize: 13,
              cursor: 'pointer', transition: 'all .15s',
            }}>
              <Icon size={16} />
              {t.label}
            </button>
          )
        })}
      </nav>

      {/* Content */}
      <main style={{ padding: 32, maxWidth: 1400, margin: '0 auto' }}>
        {tab === 'overview' && <OverviewTab data={data} />}
        {tab === 'tasks' && <TasksTab data={data} />}
        {tab === 'projects' && <ProjectsTab data={data} />}
        {tab === 'meetings' && <MeetingsTab data={data} />}
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: 'center', padding: '16px 32px',
        color: SLATE[400], fontSize: 11,
        borderTop: `1px solid ${SLATE[200]}`,
      }}>
        SAM Executive Dashboard &middot; Data from Todoist + Notion &middot; Auto-refreshes every 15 min
      </footer>
    </div>
  )
}
