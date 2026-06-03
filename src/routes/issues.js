const express = require('express');
const router = express.Router({ mergeParams: true });
const { getDb } = require('../utils/db');

function getProject(db, slug) {
  return db.prepare('SELECT * FROM projects WHERE slug = ?').get(slug);
}

const ISSUE_TYPES = ['bug', 'feature', 'improvement', 'task', 'question', 'documentation'];
const ISSUE_STATUSES = ['open', 'in_progress', 'resolved', 'closed', 'wont_fix'];

// List issues (used by project show page via AJAX and direct)
router.get('/', (req, res) => {
  const db = getDb();
  const project = getProject(db, req.params.projectSlug);
  if (!project) { db.close(); return res.status(404).render('404', { title: 'Not Found' }); }

  const issues = db.prepare(`
    SELECT i.*, COUNT(ds.id) as step_count
    FROM issues i
    LEFT JOIN debug_steps ds ON ds.issue_id = i.id
    WHERE i.project_id = ?
    GROUP BY i.id
    ORDER BY i.created_at DESC
  `).all(project.id);

  db.close();
  res.render('issues/index', { project, issues, issueTypes: ISSUE_TYPES, title: `Issues — ${project.name}` });
});

// Create issue
router.post('/', (req, res) => {
  const { title, description, type } = req.body;
  if (!title) return res.redirect(`/projects/${req.params.projectSlug}/issues`);
  const db = getDb();
  const project = getProject(db, req.params.projectSlug);
  if (!project) { db.close(); return res.redirect('/'); }
  const result = db.prepare('INSERT INTO issues (project_id, title, description, type) VALUES (?,?,?,?) RETURNING id')
    .get(project.id, title, description || null, type || 'bug');
  db.close();
  res.redirect(`/projects/${req.params.projectSlug}/issues/${result.id}`);
});

// Show issue
router.get('/:issueId', (req, res) => {
  const db = getDb();
  const project = getProject(db, req.params.projectSlug);
  if (!project) { db.close(); return res.status(404).render('404', { title: 'Not Found' }); }

  const issue = db.prepare('SELECT * FROM issues WHERE id = ? AND project_id = ?').get(req.params.issueId, project.id);
  if (!issue) { db.close(); return res.status(404).render('404', { title: 'Not Found' }); }

  const steps = db.prepare('SELECT * FROM debug_steps WHERE issue_id = ? ORDER BY sort_order, created_at').all(issue.id);

  // Linked test runs
  const linkedRuns = db.prepare(`
    SELECT tr.*, r.name as repo_name, r.slug as repo_slug
    FROM test_run_issues tri
    JOIN test_runs tr ON tr.id = tri.test_run_id
    JOIN repositories r ON r.id = tr.repository_id
    WHERE tri.issue_id = ?
    ORDER BY tr.created_at DESC
  `).all(issue.id);

  db.close();
  res.render('issues/show', { project, issue, steps, linkedRuns, issueTypes: ISSUE_TYPES, issueStatuses: ISSUE_STATUSES, title: issue.title });
});

// Update issue
router.post('/:issueId/edit', (req, res) => {
  const { title, description, type, status } = req.body;
  const db = getDb();
  const project = getProject(db, req.params.projectSlug);
  if (!project) { db.close(); return res.redirect('/'); }
  db.prepare('UPDATE issues SET title=?, description=?, type=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND project_id=?')
    .run(title, description || null, type || 'bug', status || 'open', req.params.issueId, project.id);
  db.close();
  res.redirect(`/projects/${req.params.projectSlug}/issues/${req.params.issueId}`);
});

// Delete issue
router.post('/:issueId/delete', (req, res) => {
  const db = getDb();
  const project = getProject(db, req.params.projectSlug);
  if (project) db.prepare('DELETE FROM issues WHERE id=? AND project_id=?').run(req.params.issueId, project.id);
  db.close();
  res.redirect(`/projects/${req.params.projectSlug}/issues`);
});

// Create debug step
router.post('/:issueId/steps', (req, res) => {
  const { title, description, observation, code_snippet, code_language } = req.body;
  if (!title) return res.redirect(`/projects/${req.params.projectSlug}/issues/${req.params.issueId}`);
  const db = getDb();
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM debug_steps WHERE issue_id = ?').get(req.params.issueId);
  const nextOrder = (maxOrder?.m ?? -1) + 1;
  db.prepare('INSERT INTO debug_steps (issue_id, title, description, observation, code_snippet, code_language, sort_order) VALUES (?,?,?,?,?,?,?)')
    .run(req.params.issueId, title, description || null, observation || null, code_snippet || null, code_language || 'javascript', nextOrder);
  db.close();
  res.redirect(`/projects/${req.params.projectSlug}/issues/${req.params.issueId}`);
});

// Update debug step
router.post('/:issueId/steps/:stepId/edit', (req, res) => {
  const { title, description, observation, code_snippet, code_language } = req.body;
  const db = getDb();
  db.prepare('UPDATE debug_steps SET title=?, description=?, observation=?, code_snippet=?, code_language=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND issue_id=?')
    .run(title, description || null, observation || null, code_snippet || null, code_language || 'javascript', req.params.stepId, req.params.issueId);
  db.close();
  res.redirect(`/projects/${req.params.projectSlug}/issues/${req.params.issueId}`);
});

// Delete debug step
router.post('/:issueId/steps/:stepId/delete', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM debug_steps WHERE id=? AND issue_id=?').run(req.params.stepId, req.params.issueId);
  db.close();
  res.redirect(`/projects/${req.params.projectSlug}/issues/${req.params.issueId}`);
});

module.exports = router;