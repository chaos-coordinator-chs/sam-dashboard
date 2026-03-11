import { useState, useEffect, useRef, useCallback } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  LayoutDashboard, CheckSquare, FolderKanban, CalendarDays,
  AlertTriangle, Clock, ChevronDown, ChevronRight,
  Zap, RefreshCw, MessageCircle, Mic, MicOff, X, Send,
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
  'Ready to Work': '#06b6d4', 'Scheduled': '#8b5cf6', 'Inbox': SLATE[400],
  'Pending': '#eab308', 'Done': '#22c55e', 'Complete': '#22c55e', 'Canceled': SLATE[400],
}

const PRIORITY_COLORS = { P1: '#ef4444', P2: '#f97316', P3: '#eab308', P4: '#94a3b8', p1: '#ef4444', p2: '#f97316', p3: '#eab308', p4: '#94a3b8' }
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
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      fontSize: 11, fontWeight: 700, color: '#fff',
      background: PRIORITY_COLORS[priority] || SLATE[400],
    }}>{priority.toUpperCase()}</span>
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
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: HEALTH_COLORS[health] || SLATE[400], marginRight: 6 }} />
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: SLATE[800], color: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,.3)' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color }}>{p.name}: {p.value}</div>)}
    </div>
  )
}

function Card({ title, badge, children, style }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,.08)', ...style }}>
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

function KPICard({ icon, label, value, sub, color }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.08)',
      borderLeft: `4px solid ${color || ORANGE}`, display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: `${color || ORANGE}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color || ORANGE }}>{icon}</div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 700, color: SLATE[900] }}>{value}</div>
        <div style={{ fontSize: 12, color: SLATE[600], fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: SLATE[400], marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: SLATE[400] }}>
      <div style={{ fontSize: 14, marginBottom: 8 }}>{message}</div>
      <div style={{ fontSize: 12 }}>Items will appear here once tagged with <strong style={{ color: ORANGE }}>AI Agent = SAM</strong> in Notion.</div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ── AI ASSISTANT ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function buildContext(data) {
  const { todoist, notion } = data
  const todoistActive = todoist.tasks.filter(t => !t.checked)
  const lines = []

  lines.push(`DATA SNAPSHOT (last updated: ${data.lastUpdated})`)
  lines.push(`\n--- TODOIST TASKS (${todoistActive.length} active, SAM project) ---`)
  todoistActive.forEach(t => {
    const parts = [`"${t.content}"`, t.priority?.toUpperCase()]
    if (t.due) parts.push(`due: ${t.due.date}`)
    if (t.description) parts.push(`desc: ${t.description.slice(0, 100)}`)
    lines.push(`- ${parts.join(' | ')}`)
  })

  lines.push(`\n--- NOTION TASKS (${notion.tasks.length} active, Entity=SAM) ---`)
  notion.tasks.forEach(t => {
    const parts = [`"${t.title}"`, `status: ${t.status}`]
    if (t.priority) parts.push(t.priority)
    if (t.effort) parts.push(`effort: ${t.effort}`)
    if (t.blocked) parts.push('BLOCKED')
    if (t.deadline) parts.push(`deadline: ${t.deadline}`)
    if (t.context?.length) parts.push(`context: ${t.context.join(', ')}`)
    lines.push(`- ${parts.join(' | ')}`)
  })

  lines.push(`\n--- NOTION PROJECTS (${notion.projects.length} active, Entity=SAM) ---`)
  notion.projects.forEach(p => {
    const parts = [`"${p.name}"`, `status: ${p.status}`]
    if (p.priority) parts.push(p.priority)
    if (p.health) parts.push(`health: ${p.health}`)
    if (p.weeklyFocus) parts.push('WEEKLY FOCUS')
    if (p.targetDate) parts.push(`target: ${p.targetDate}`)
    if (p.outcome) parts.push(`outcome: ${p.outcome.slice(0, 80)}`)
    lines.push(`- ${parts.join(' | ')}`)
  })

  lines.push(`\n--- RECENT MEETINGS (${notion.meetings.length}, last 30 days) ---`)
  notion.meetings.forEach(m => {
    const parts = [`"${m.title}"`, m.date]
    if (m.type) parts.push(m.type)
    if (m.decisions) parts.push(`decisions: ${m.decisions.slice(0, 80)}`)
    if (m.nextActions) parts.push(`actions: ${m.nextActions.slice(0, 80)}`)
    lines.push(`- ${parts.join(' | ')}`)
  })

  return lines.join('\n')
}

function answerQuestion(question, data) {
  const q = question.toLowerCase()
  const { todoist, notion } = data
  const allTasks = [
    ...todoist.tasks.filter(t => !t.checked).map(t => ({ ...t, source: 'Todoist', title: t.content, status: t.checked ? 'Done' : 'Active' })),
    ...notion.tasks.map(t => ({ ...t, source: 'Notion' })),
  ]

  // High priority tasks
  if ((q.includes('high priority') || q.includes('p1') || q.includes('p2') || q.includes('urgent') || q.includes('important')) && (q.includes('task') || q.includes('working') || q.includes('doing'))) {
    const high = sortByPriority(allTasks.filter(t => {
      const p = (t.priority || '').toLowerCase()
      return p === 'p1' || p === 'p2'
    }))
    if (high.length === 0) return 'There are no high priority (P1/P2) tasks right now.'
    let answer = `**${high.length} high priority task${high.length > 1 ? 's' : ''}:**\n\n`
    high.forEach(t => {
      const badge = t.priority?.toUpperCase() || ''
      answer += `- **${badge}** ${t.title}`
      if (t.status && t.status !== 'Active') answer += ` _(${t.status})_`
      answer += ` [${t.source}]\n`
    })
    return answer
  }

  // Projects
  if (q.includes('project') && (q.includes('working') || q.includes('what') || q.includes('active') || q.includes('list') || q.includes('she'))) {
    const projects = notion.projects
    if (projects.length === 0) return 'No active SAM projects right now. Projects will appear once tagged with AI Agent = SAM in Notion.'
    let answer = `**${projects.length} active SAM project${projects.length > 1 ? 's' : ''}:**\n\n`
    sortByPriority(projects).forEach(p => {
      answer += `- **${p.name}**`
      if (p.status) answer += ` — ${p.status}`
      if (p.health) answer += ` (${p.health})`
      if (p.priority) answer += ` [${p.priority}]`
      if (p.weeklyFocus) answer += ' **[Weekly Focus]**'
      answer += '\n'
    })
    return answer
  }

  // Blocked tasks
  if (q.includes('blocked') || q.includes('stuck') || q.includes('blocker')) {
    const blocked = allTasks.filter(t => t.blocked)
    if (blocked.length === 0) return 'No tasks are currently blocked.'
    let answer = `**${blocked.length} blocked task${blocked.length > 1 ? 's' : ''}:**\n\n`
    blocked.forEach(t => { answer += `- ${t.title} _(${t.status})_ [${t.source}]\n` })
    return answer
  }

  // Overdue / due soon
  if (q.includes('overdue') || q.includes('due') || q.includes('deadline')) {
    const withDue = allTasks.filter(t => t.deadline || t.due)
    if (withDue.length === 0) return 'No tasks with upcoming deadlines right now.'
    let answer = `**Tasks with deadlines:**\n\n`
    withDue.forEach(t => {
      const date = t.deadline || t.due?.date || ''
      answer += `- ${t.title} — due **${date}** [${t.source}]\n`
    })
    return answer
  }

  // Meetings
  if (q.includes('meeting') || q.includes('met with') || q.includes('discussed')) {
    const meetings = notion.meetings
    if (meetings.length === 0) return 'No meetings recorded in the last 30 days.'
    let answer = `**${meetings.length} recent meeting${meetings.length > 1 ? 's' : ''}:**\n\n`
    meetings.slice(0, 8).forEach(m => {
      answer += `- **${m.title}** (${m.date || 'no date'})`
      if (m.type) answer += ` — ${m.type}`
      answer += '\n'
      if (m.nextActions) answer += `  _Next actions: ${m.nextActions.slice(0, 120)}_\n`
    })
    return answer
  }

  // Status / what's happening / summary / pulse
  if (q.includes('status') || q.includes('summary') || q.includes('pulse') || q.includes('overview') || q.includes('what\'s happening') || q.includes('update')) {
    const todoistActive = todoist.tasks.filter(t => !t.checked).length
    const notionCount = notion.tasks.length
    const projectCount = notion.projects.length
    const highP = allTasks.filter(t => { const p = (t.priority || '').toLowerCase(); return p === 'p1' || p === 'p2' }).length
    const blockedC = allTasks.filter(t => t.blocked).length
    const inProg = allTasks.filter(t => (t.status || '').toLowerCase().includes('progress')).length

    let answer = `**SAM Pulse Check:**\n\n`
    answer += `- **${todoistActive + notionCount}** active tasks (${todoistActive} Todoist + ${notionCount} Notion)\n`
    answer += `- **${highP}** high priority (P1/P2)\n`
    answer += `- **${inProg}** in progress\n`
    answer += `- **${blockedC}** blocked\n`
    answer += `- **${projectCount}** active projects\n`
    answer += `- **${notion.meetings.length}** meetings in last 30 days\n`
    if (notion.projects.filter(p => p.weeklyFocus).length > 0) {
      answer += `\n**Weekly Focus:** ${notion.projects.filter(p => p.weeklyFocus).map(p => p.name).join(', ')}`
    }
    return answer
  }

  // How many tasks
  if (q.includes('how many') && q.includes('task')) {
    const todoistActive = todoist.tasks.filter(t => !t.checked).length
    return `Steph has **${todoistActive + notion.tasks.length}** active SAM tasks: ${todoistActive} in Todoist and ${notion.tasks.length} in Notion.`
  }

  // In progress
  if (q.includes('in progress') || q.includes('currently working') || q.includes('right now') || q.includes('working on')) {
    const inProgress = allTasks.filter(t => {
      const s = (t.status || '').toLowerCase()
      return s.includes('progress') || s === 'active'
    })
    // For Todoist, all unchecked tasks are "active"
    const todoistActive = todoist.tasks.filter(t => !t.checked)
    if (inProgress.length === 0 && todoistActive.length === 0) return 'No tasks explicitly marked as in-progress right now.'

    let answer = ''
    if (inProgress.length > 0) {
      answer += `**${inProgress.length} task${inProgress.length > 1 ? 's' : ''} in progress (Notion):**\n\n`
      inProgress.forEach(t => {
        answer += `- ${t.title}`
        if (t.priority) answer += ` [${t.priority.toUpperCase()}]`
        answer += '\n'
      })
    }
    if (todoistActive.length > 0) {
      answer += `\n**${todoistActive.length} active Todoist task${todoistActive.length > 1 ? 's' : ''} (SAM project):**\n\n`
      sortByPriority(todoistActive).slice(0, 10).forEach(t => {
        answer += `- ${t.content} [${t.priority?.toUpperCase() || 'P4'}]\n`
      })
      if (todoistActive.length > 10) answer += `\n_...and ${todoistActive.length - 10} more_`
    }
    return answer
  }

  // Fallback
  return `I can answer questions about Steph's SAM work. Try asking:\n\n- "What are the high priority tasks?"\n- "What projects is she working on?"\n- "What's the current status?"\n- "Are there any blocked tasks?"\n- "What meetings happened recently?"\n- "What is she currently working on?"`
}

function AIAssistant({ data }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi Luke! Ask me anything about Steph\'s SAM work. You can type or use voice.' }
  ])
  const [input, setInput] = useState('')
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus()
  }, [isOpen])

  const handleSubmit = useCallback((text) => {
    if (!text.trim()) return
    const userMsg = { role: 'user', text: text.trim() }
    const answer = answerQuestion(text.trim(), data)
    setMessages(prev => [...prev, userMsg, { role: 'assistant', text: answer }])
    setInput('')
  }, [data])

  const toggleVoice = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Voice recognition is not supported in this browser. Please type your question instead.' }])
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setInput(transcript)
      handleSubmit(transcript)
      setIsListening(false)
    }
    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [isListening, handleSubmit])

  // Render markdown-ish text (bold, italic, bullets)
  function renderMarkdown(text) {
    const lines = text.split('\n')
    return lines.map((line, i) => {
      // Convert **bold** and _italic_
      let html = line
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/_(.+?)_/g, '<em style="color:' + SLATE[400] + '">$1</em>')
      if (line.startsWith('- ')) {
        html = html.slice(2)
        return <div key={i} style={{ paddingLeft: 12, marginBottom: 3, fontSize: 13, lineHeight: 1.5 }}>
          <span style={{ color: ORANGE, marginRight: 6 }}>&#8226;</span>
          <span dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      }
      if (line.trim() === '') return <div key={i} style={{ height: 6 }} />
      return <div key={i} style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 2 }} dangerouslySetInnerHTML={{ __html: html }} />
    })
  }

  return (
    <>
      {/* Floating button */}
      <button onClick={() => setIsOpen(!isOpen)} style={{
        position: 'fixed', bottom: 24, right: 24, width: 56, height: 56,
        borderRadius: '50%', border: 'none', cursor: 'pointer',
        background: `linear-gradient(135deg, ${ORANGE}, ${ORANGE_DARK})`,
        color: '#fff', boxShadow: '0 4px 20px rgba(249,115,22,.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'transform .2s', zIndex: 1000,
        transform: isOpen ? 'scale(0.9)' : 'scale(1)',
      }}>
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Chat popup */}
      {isOpen && (
        <div style={{
          position: 'fixed', bottom: 92, right: 24, width: 420, maxHeight: '70vh',
          borderRadius: 16, overflow: 'hidden', zIndex: 1000,
          boxShadow: '0 12px 48px rgba(0,0,0,.2)', display: 'flex', flexDirection: 'column',
          background: '#fff', border: `1px solid ${SLATE[200]}`,
        }}>
          {/* Header */}
          <div style={{
            background: `linear-gradient(135deg, ${SLATE[900]}, ${SLATE[800]})`,
            padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `${ORANGE}30`, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <MessageCircle size={18} color={ORANGE} />
            </div>
            <div>
              <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>SAM Assistant</div>
              <div style={{ color: SLATE[400], fontSize: 11 }}>Ask about Steph's SAM work</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, maxHeight: '50vh' }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                marginBottom: 12, display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '85%', padding: '10px 14px', borderRadius: 12,
                  background: m.role === 'user' ? ORANGE : SLATE[50],
                  color: m.role === 'user' ? '#fff' : SLATE[800],
                  fontSize: 13, lineHeight: 1.5,
                  borderBottomRightRadius: m.role === 'user' ? 4 : 12,
                  borderBottomLeftRadius: m.role === 'user' ? 12 : 4,
                }}>
                  {m.role === 'user' ? m.text : renderMarkdown(m.text)}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '12px 16px', borderTop: `1px solid ${SLATE[200]}`,
            display: 'flex', gap: 8, alignItems: 'center', background: '#fff',
          }}>
            <button onClick={toggleVoice} style={{
              width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: isListening ? '#ef4444' : SLATE[100], color: isListening ? '#fff' : SLATE[600],
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: isListening ? 'pulse 1.5s infinite' : 'none',
            }}>
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit(input)}
              placeholder={isListening ? 'Listening...' : 'Ask about SAM work...'}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8,
                border: `1px solid ${isListening ? '#ef4444' : SLATE[200]}`,
                fontSize: 13, outline: 'none',
                background: isListening ? '#fef2f2' : '#fff',
              }}
            />
            <button onClick={() => handleSubmit(input)} style={{
              width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: input.trim() ? ORANGE : SLATE[200],
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,.4); }
          50% { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
        }
      `}</style>
    </>
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
  const highPriority = allTasks.filter(t => { const p = (t.priority || '').toLowerCase(); return p === 'p1' || p === 'p2' }).length
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
        <Card title="Task Status (Notion)">
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart><Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name} (${value})`} labelLine={false}>
                {statusData.map((_, i) => <Cell key={i} fill={STATUS_COLORS[statusData[i].name] || CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie><Tooltip content={<CustomTooltip />} /></PieChart>
            </ResponsiveContainer>
          ) : <EmptyState message="No Notion tasks yet" />}
        </Card>

        <Card title="Priority Distribution">
          {priorityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={priorityData} barSize={32}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>{priorityData.map((d, i) => <Cell key={i} fill={PRIORITY_COLORS[d.name] || CHART_COLORS[i]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState message="No task data" />}
        </Card>

        <Card title="Effort Breakdown">
          {effortData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={effortData} barSize={32}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>{effortData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState message="No effort data" />}
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <Card title="Context Tags">
          {contextData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart><Pie data={contextData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                {contextData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie><Tooltip content={<CustomTooltip />} /></PieChart>
            </ResponsiveContainer>
          ) : <EmptyState message="No context tags" />}
        </Card>

        <Card title="Project Health">
          {healthData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart><Pie data={healthData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                {healthData.map((d, i) => <Cell key={i} fill={HEALTH_COLORS[d.name] || CHART_COLORS[i]} />)}
              </Pie><Tooltip content={<CustomTooltip />} /></PieChart>
            </ResponsiveContainer>
          ) : <EmptyState message="No project health data" />}
        </Card>

        <Card title="High Priority Tasks" badge={<span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>{topTasks.length} items</span>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topTasks.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: SLATE[50] }}>
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
          padding: '8px 14px 8px 42px', borderRadius: 6, background: SLATE[50], marginTop: 2, marginLeft: 16,
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

  const topLevel = todoist.tasks.filter(t => !t.parentId)
  const subtaskMap = {}
  todoist.tasks.filter(t => t.parentId).forEach(t => {
    if (!subtaskMap[t.parentId]) subtaskMap[t.parentId] = []
    subtaskMap[t.parentId].push(t)
  })

  const grouped = {}
  topLevel.forEach(t => {
    const sec = sectionMap[t.sectionId] || 'Unsectioned'
    if (!grouped[sec]) grouped[sec] = []
    grouped[sec].push(t)
  })

  const notionSorted = sortByPriority(notion.tasks)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      <Card title="Todoist Tasks" badge={<span style={{ fontSize: 12, color: SLATE[400] }}>{todoist.tasks.length} total</span>}>
        {Object.entries(grouped).map(([section, tasks]) => (
          <div key={section} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: ORANGE, marginBottom: 8, paddingBottom: 4, borderBottom: `2px solid ${ORANGE}30` }}>{section}</div>
            {sortByPriority(tasks).map(t => <TodoistTaskItem key={t.id} task={t} subtasks={subtaskMap[t.id] || []} />)}
          </div>
        ))}
      </Card>

      <Card title="Notion Tasks" badge={<span style={{ fontSize: 12, color: SLATE[400] }}>{notion.tasks.length} tasks</span>}>
        {notionSorted.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {notionSorted.map((t, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8,
                background: t.blocked ? '#fef2f220' : '#fff', border: `1px solid ${t.blocked ? '#ef444440' : SLATE[200]}`,
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
        ) : <EmptyState message="No SAM-tagged Notion tasks" />}
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ── PROJECTS TAB ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function ProjectsTab({ data }) {
  const projects = sortByPriority(data.notion.projects)

  if (projects.length === 0) return <Card><EmptyState message="No SAM-tagged projects" /></Card>

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
                {p.weeklyFocus && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: `${ORANGE}20`, color: ORANGE_DARK, fontWeight: 700 }}>WEEKLY FOCUS</span>}
              </div>
            </div>
            {p.health && <div style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: HEALTH_COLORS[p.health] || SLATE[400] }}><HealthDot health={p.health} />{p.health}</div>}
          </div>
          {p.outcome && <div style={{ fontSize: 12, color: SLATE[600], marginBottom: 8 }}><strong>Outcome:</strong> {p.outcome}</div>}
          {p.successMetric && <div style={{ fontSize: 12, color: SLATE[600], marginBottom: 8 }}><strong>Success Metric:</strong> {p.successMetric}</div>}
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
      <Card title="Meetings by Type" style={{ marginBottom: 24 }}>
        {typeData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={typeData} barSize={36}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>{typeData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyState message="No meeting type data" />}
      </Card>

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
                {m.type && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, background: `${ORANGE}15`, color: ORANGE_DARK, fontWeight: 600 }}>{m.type}</span>}
                {m.date && <span style={{ fontSize: 11, color: SLATE[400] }}>{m.date}</span>}
              </div>
            </div>
            {m.decisions && <div style={{ fontSize: 12, color: SLATE[600], marginBottom: 4 }}><strong style={{ color: SLATE[800] }}>Decisions:</strong> {m.decisions}</div>}
            {m.nextActions && <div style={{ fontSize: 12, color: SLATE[600] }}><strong style={{ color: ORANGE_DARK }}>Next Actions:</strong> {m.nextActions}</div>}
          </div>
        ))}
        {meetings.length === 0 && <div style={{ textAlign: 'center', color: SLATE[400], padding: 40 }}>No meetings in the last 30 days</div>}
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

  const lastUpdated = data.lastUpdated ? formatDistanceToNow(parseISO(data.lastUpdated), { addSuffix: true }) : 'unknown'

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
            <div style={{ color: SLATE[400], fontSize: 12 }}>Steph's Work Pulse</div>
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
        SAM &middot; Steph's Work Pulse &middot; Data from Todoist + Notion &middot; Auto-refreshes every 15 min
      </footer>

      {/* AI Assistant */}
      <AIAssistant data={data} />
    </div>
  )
}
