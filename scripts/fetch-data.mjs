#!/usr/bin/env node
/**
 * Fetches SAM data from Todoist + Notion APIs and writes public/data.json
 * Run via: node scripts/fetch-data.mjs
 * Requires env vars: TODOIST_API_TOKEN, NOTION_API_TOKEN
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'public', 'data.json');

const TODOIST_TOKEN = process.env.TODOIST_API_TOKEN;
const NOTION_TOKEN = process.env.NOTION_API_TOKEN;
const TODOIST_PROJECT_ID = '6cwpf8hc6mJmFQM7';

// Notion database IDs
const NOTION_TASKS_DB = '05d28224badc435bb8faf6ac176bdfa0';
const NOTION_PROJECTS_DB = 'f4b9b358c4b84e839dcb7ca39a58eeb3';
const NOTION_MEETINGS_DB = 'ffff839aaedd4211aa5086c64f09a19c';

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${url} → ${res.status} ${res.statusText}`);
  return res.json();
}

// ── Todoist ──────────────────────────────────────────────────────────────────

async function fetchTodoist() {
  const headers = { Authorization: `Bearer ${TODOIST_TOKEN}` };

  const [tasksRes, sectionsRes] = await Promise.all([
    fetchJSON(`https://api.todoist.com/api/v1/tasks?project_id=${TODOIST_PROJECT_ID}`, { headers }),
    fetchJSON(`https://api.todoist.com/api/v1/sections?project_id=${TODOIST_PROJECT_ID}`, { headers }),
  ]);

  // API v1 wraps results: { results: [...], next_cursor }
  const tasks = tasksRes.results || tasksRes;
  const sections = sectionsRes.results || sectionsRes;

  return {
    sections: sections.map(s => ({ id: s.id, name: s.name })),
    tasks: tasks.map(t => ({
      id: t.id,
      content: t.content,
      description: t.description || undefined,
      priority: `p${5 - t.priority}`,   // Todoist API: 4=urgent → we want p1
      projectId: t.project_id,
      sectionId: t.section_id || undefined,
      parentId: t.parent_id || undefined,
      labels: t.labels,
      due: t.due ? { date: t.due.date, isRecurring: t.due.is_recurring } : null,
      checked: t.checked,
    })),
  };
}

// ── Notion helpers ──────────────────────────────────────────────────────────

const notionHeaders = {
  Authorization: `Bearer ${NOTION_TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

async function queryNotion(dbId, filter) {
  const body = { page_size: 100 };
  if (filter) body.filter = filter;
  const data = await fetchJSON(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: 'POST',
    headers: notionHeaders,
    body: JSON.stringify(body),
  });
  return data.results;
}

function prop(page, name, type) {
  const p = page.properties[name];
  if (!p) return null;
  switch (type || p.type) {
    case 'title': return p.title?.map(t => t.plain_text).join('') || '';
    case 'rich_text': return p.rich_text?.map(t => t.plain_text).join('') || '';
    case 'select': return p.select?.name || null;
    case 'multi_select': return p.multi_select?.map(s => s.name) || [];
    case 'number': return p.number;
    case 'checkbox': return p.checkbox;
    case 'date': return p.date?.start || null;
    case 'people': return p.people?.map(u => u.name || u.id) || [];
    case 'created_time': return p.created_time;
    case 'status': return p.status?.name || null;
    default: return null;
  }
}

// ── Notion: Tasks ───────────────────────────────────────────────────────────

async function fetchNotionTasks() {
  const pages = await queryNotion(NOTION_TASKS_DB, {
    and: [
      { property: 'Status', select: { does_not_equal: 'Done' } },
      { property: 'Status', select: { does_not_equal: 'Canceled' } },
    ],
  });

  return pages.map(p => ({
    title: prop(p, 'Task', 'title') || '',
    status: prop(p, 'Status', 'select') || '',
    priority: prop(p, 'Priority', 'select') || null,
    effort: prop(p, 'Effort', 'select') || null,
    energy: prop(p, 'Energy', 'select') || null,
    context: prop(p, 'Context', 'multi_select') || [],
    deadline: prop(p, 'Deadline', 'date') || null,
    dateWorked: prop(p, 'Date Worked', 'date') || null,
    delegate: prop(p, 'Delegate', 'select') || null,
    blocked: prop(p, 'Blocked', 'checkbox') || false,
    aiDelegated: prop(p, 'AI Delegated?', 'checkbox') || false,
    recurring: prop(p, 'Recurring', 'select') || 'None',
    created: prop(p, 'Created', 'created_time') || null,
  }));
}

// ── Notion: Projects ────────────────────────────────────────────────────────

async function fetchNotionProjects() {
  const pages = await queryNotion(NOTION_PROJECTS_DB, {
    and: [
      { property: 'Status', select: { does_not_equal: 'Complete' } },
      { property: 'Status', select: { does_not_equal: 'Canceled' } },
    ],
  });

  return pages.map(p => ({
    name: prop(p, 'Name', 'title') || '',
    status: prop(p, 'Status', 'select') || '',
    priority: prop(p, 'Priority', 'select') || null,
    health: prop(p, 'Health', 'select') || null,
    weeklyFocus: prop(p, 'Weekly Focus', 'checkbox') || false,
    startDate: prop(p, 'Start Date', 'date') || null,
    targetDate: prop(p, 'Target Date', 'date') || null,
    outcome: prop(p, 'Outcome', 'rich_text') || '',
    successMetric: prop(p, 'Success Metric', 'rich_text') || '',
    automationReady: prop(p, 'Automation Ready', 'checkbox') || false,
  }));
}

// ── Notion: Meetings ────────────────────────────────────────────────────────

async function fetchNotionMeetings() {
  // Meetings DB has no AI Agent filter — fetch recent meetings (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const pages = await queryNotion(NOTION_MEETINGS_DB, {
    and: [
      { property: 'Date', date: { on_or_after: thirtyDaysAgo } },
    ],
  });

  return pages.map(p => ({
    title: prop(p, 'Title', 'title') || '',
    type: prop(p, 'Type', 'select') || null,
    date: prop(p, 'Date', 'date') || null,
    decisions: prop(p, 'Decisions', 'rich_text') || '',
    nextActions: prop(p, 'Next Actions', 'rich_text') || '',
  })).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!TODOIST_TOKEN) throw new Error('Missing TODOIST_API_TOKEN');
  if (!NOTION_TOKEN) throw new Error('Missing NOTION_API_TOKEN');

  console.log('Fetching Todoist data...');
  const todoist = await fetchTodoist();
  console.log(`  ${todoist.tasks.length} tasks, ${todoist.sections.length} sections`);

  console.log('Fetching Notion tasks...');
  const notionTasks = await fetchNotionTasks();
  console.log(`  ${notionTasks.length} tasks`);

  console.log('Fetching Notion projects...');
  const notionProjects = await fetchNotionProjects();
  console.log(`  ${notionProjects.length} projects`);

  console.log('Fetching Notion meetings...');
  const notionMeetings = await fetchNotionMeetings();
  console.log(`  ${notionMeetings.length} meetings`);

  const payload = {
    lastUpdated: new Date().toISOString(),
    todoist,
    notion: {
      tasks: notionTasks,
      projects: notionProjects,
      meetings: notionMeetings,
    },
  };

  writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${OUT}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
