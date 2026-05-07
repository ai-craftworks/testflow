const express = require('express');
const router = express.Router({ mergeParams: true });
const { getDb } = require('../utils/db');
const { makeSlug, uniqueSlug } = require('../utils/slug');

function getProject(db, slug) {
  return db.prepare('SELECT * FROM projects WHERE slug = ?').get(slug);
}
function getRepo(db, projectId, slug) {
  return db.prepare('SELECT * FROM repositories WHERE project_id = ? AND slug = ?').get(projectId, slug);
}

// Create repository
router.post('/', (req, res) => {
  const { name, description } = req.body;
  const db = getDb();
  const project = getProject(db, req.params.projectSlug);
  if (!project) { db.close(); return res.redirect('/'); }
  const slug = uniqueSlug(db, 'repositories', makeSlug(name), 'slug', 'AND project_id = ?', [project.id]);
  db.prepare('INSERT INTO repositories (project_id, name, slug, description) VALUES (?,?,?,?)').run(project.id, name, slug, description || null);
  db.prepare('UPDATE projects SET updated_at=CURRENT_TIMESTAMP WHERE id=?').run(project.id);
  db.close();
  res.redirect(`/projects/${project.slug}/repos/${slug}`);
});

// Show repository
router.get('/:repoSlug', (req, res) => {
  const db = getDb();
  const project = getProject(db, req.params.projectSlug);
  if (!project) { db.close(); return res.status(404).render('404', { title: 'Not Found' }); }
  const repo = getRepo(db, project.id, req.params.repoSlug);
  if (!repo) { db.close(); return res.status(404).render('404', { title: 'Not Found' }); }

  const groups = db.prepare('SELECT * FROM test_groups WHERE repository_id = ? ORDER BY name').all(repo.id);
  const testCases = db.prepare(`
    SELECT tc.*, tg.name as group_name
    FROM test_cases tc
    LEFT JOIN test_groups tg ON tg.id = tc.group_id
    WHERE tc.repository_id = ?
    ORDER BY tc.group_id, tc.priority, tc.title
  `).all(repo.id);

  // Pre-group for clean template rendering
  const ungroupedCases = testCases.filter(c => c.group_id === null || c.group_id === undefined);
  const groupedCases = groups.map(g => ({
    id: g.id, name: g.name,
    cases: testCases.filter(c => String(c.group_id) === String(g.id))
  })).filter(g => g.cases.length > 0);

  const testPlans = db.prepare(`
    SELECT tp.*, COUNT(tpc.id) as case_count
    FROM test_plans tp
    LEFT JOIN test_plan_cases tpc ON tpc.test_plan_id = tp.id
    WHERE tp.repository_id = ?
    GROUP BY tp.id
    ORDER BY tp.created_at DESC
  `).all(repo.id);

  const testRuns = db.prepare(`
    SELECT tr.*,
      COUNT(trr.id) as total,
      SUM(CASE WHEN trr.status='passed' THEN 1 ELSE 0 END) as passed,
      SUM(CASE WHEN trr.status='failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN trr.status='blocked' THEN 1 ELSE 0 END) as blocked,
      SUM(CASE WHEN trr.status='skipped' THEN 1 ELSE 0 END) as skipped,
      SUM(CASE WHEN trr.status='pending' THEN 1 ELSE 0 END) as pending,
      tp.name as plan_name
    FROM test_runs tr
    LEFT JOIN test_run_results trr ON trr.test_run_id = tr.id
    LEFT JOIN test_plans tp ON tp.id = tr.test_plan_id
    WHERE tr.repository_id = ?
    GROUP BY tr.id
    ORDER BY tr.created_at DESC
  `).all(repo.id);

  // Stats
  const stats = {
    totalCases: testCases.length,
    totalPlans: testPlans.length,
    totalRuns: testRuns.length,
    activeRuns: testRuns.filter(r => r.status === 'in_progress').length
  };

  const priorityStats = db.prepare(`SELECT priority, COUNT(*) as cnt FROM test_cases WHERE repository_id = ? GROUP BY priority`).all(repo.id);
  const typeStats = db.prepare(`SELECT type, COUNT(*) as cnt FROM test_cases WHERE repository_id = ? GROUP BY type`).all(repo.id);

  db.close();
  res.render('repositories/show', { project, repo, groups, testCases, ungroupedCases, groupedCases, testPlans, testRuns, stats, priorityStats, typeStats, title: `${repo.name} - ${project.name}` });
});

// Edit repository
router.post('/:repoSlug/edit', (req, res) => {
  const { name, description } = req.body;
  const db = getDb();
  const project = getProject(db, req.params.projectSlug);
  const repo = getRepo(db, project.id, req.params.repoSlug);
  if (!repo) { db.close(); return res.redirect(`/projects/${req.params.projectSlug}`); }
  db.prepare('UPDATE repositories SET name=?, description=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(name, description || null, repo.id);
  db.close();
  res.redirect(`/projects/${project.slug}/repos/${repo.slug}`);
});

// Delete repository
router.post('/:repoSlug/delete', (req, res) => {
  const db = getDb();
  const project = getProject(db, req.params.projectSlug);
  const repo = getRepo(db, project.id, req.params.repoSlug);
  if (repo) db.prepare('DELETE FROM repositories WHERE id=?').run(repo.id);
  db.close();
  res.redirect(`/projects/${req.params.projectSlug}`);
});

// Groups
router.post('/:repoSlug/groups', (req, res) => {
  const { name, description } = req.body;
  const db = getDb();
  const project = getProject(db, req.params.projectSlug);
  const repo = getRepo(db, project.id, req.params.repoSlug);
  if (repo) db.prepare('INSERT INTO test_groups (repository_id, name, description) VALUES (?,?,?)').run(repo.id, name, description || null);
  db.close();
  res.redirect(`/projects/${req.params.projectSlug}/repos/${req.params.repoSlug}`);
});

router.post('/:repoSlug/groups/:groupId/delete', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM test_groups WHERE id=?').run(req.params.groupId);
  db.close();
  res.redirect(`/projects/${req.params.projectSlug}/repos/${req.params.repoSlug}`);
});

module.exports = router;
