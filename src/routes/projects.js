const express = require('express');
const router = express.Router();
const { getDb } = require('../utils/db');
const { makeSlug, uniqueSlug } = require('../utils/slug');

// Home - list projects
router.get(['/', '/projects'], (req, res) => {
  const db = getDb();
  const projects = db.prepare(`
    SELECT p.*,
      COUNT(DISTINCT r.id) as repo_count,
      COUNT(DISTINCT tc.id) as test_case_count,
      COUNT(DISTINCT tr.id) as test_run_count
    FROM projects p
    LEFT JOIN repositories r ON r.project_id = p.id
    LEFT JOIN test_cases tc ON tc.repository_id = r.id
    LEFT JOIN test_runs tr ON tr.repository_id = r.id
    GROUP BY p.id
    ORDER BY p.updated_at DESC
  `).all();
  db.close();
  res.render('projects/index', { projects, title: 'Projects' });
});

// Create project
router.post('/projects', (req, res) => {
  const { name, description, color } = req.body;
  if (!name) return res.redirect('/');
  const db = getDb();
  const slug = uniqueSlug(db, 'projects', makeSlug(name));
  db.prepare('INSERT INTO projects (name, slug, description, color) VALUES (?, ?, ?, ?)').run(name, slug, description || null, color || '#4f7ef8');
  db.close();
  res.redirect(`/projects/${slug}`);
});

// Show project
router.get('/projects/:slug', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE slug = ?').get(req.params.slug);
  if (!project) { db.close(); return res.status(404).render('404', { title: 'Not Found' }); }

  const repos = db.prepare(`
    SELECT r.*,
      COUNT(DISTINCT tc.id) as test_case_count,
      COUNT(DISTINCT tp.id) as test_plan_count,
      COUNT(DISTINCT tr.id) as test_run_count
    FROM repositories r
    LEFT JOIN test_cases tc ON tc.repository_id = r.id
    LEFT JOIN test_plans tp ON tp.repository_id = r.id
    LEFT JOIN test_runs tr ON tr.repository_id = r.id
    WHERE r.project_id = ?
    GROUP BY r.id
    ORDER BY r.created_at DESC
  `).all(project.id);

  // Stats
  const stats = db.prepare(`
    SELECT
      COUNT(DISTINCT tc.id) as total_cases,
      COUNT(DISTINCT tp.id) as total_plans,
      COUNT(DISTINCT tr.id) as total_runs,
      SUM(CASE WHEN tr.status='completed' THEN 1 ELSE 0 END) as completed_runs,
      SUM(CASE WHEN tr.status='in_progress' THEN 1 ELSE 0 END) as active_runs,
      COUNT(DISTINCT r.id) as total_repos
    FROM repositories r
    LEFT JOIN test_cases tc ON tc.repository_id = r.id
    LEFT JOIN test_plans tp ON tp.repository_id = r.id
    LEFT JOIN test_runs tr ON tr.repository_id = r.id
    WHERE r.project_id = ?
  `).get(project.id);

  const priorityStats = db.prepare(`
    SELECT tc.priority, COUNT(*) as cnt
    FROM test_cases tc JOIN repositories r ON r.id = tc.repository_id
    WHERE r.project_id = ?
    GROUP BY tc.priority
  `).all(project.id);

  const runStatusStats = db.prepare(`
    SELECT trr.status, COUNT(*) as cnt
    FROM test_run_results trr
    JOIN test_runs tr ON tr.id = trr.test_run_id
    JOIN repositories r ON r.id = tr.repository_id
    WHERE r.project_id = ?
    GROUP BY trr.status
  `).all(project.id);

  db.close();
  res.render('projects/show', { project, repos, stats, priorityStats, runStatusStats, title: project.name });
});

// Edit project
router.post('/projects/:slug/edit', (req, res) => {
  const { name, description, color } = req.body;
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE slug = ?').get(req.params.slug);
  if (!project) { db.close(); return res.redirect('/'); }
  db.prepare('UPDATE projects SET name=?, description=?, color=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(name, description || null, color || '#4f7ef8', project.id);
  db.close();
  res.redirect(`/projects/${project.slug}`);
});

// Delete project
router.post('/projects/:slug/delete', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM projects WHERE slug = ?').run(req.params.slug);
  db.close();
  res.redirect('/');
});

module.exports = router;
