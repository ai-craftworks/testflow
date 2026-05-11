const express = require('express');
const router = express.Router({ mergeParams: true });
const { getDb } = require('../utils/db');

function ctx(db, pSlug, rSlug) {
  const project = db.prepare('SELECT * FROM projects WHERE slug = ?').get(pSlug);
  if (!project) return null;
  const repo = db.prepare('SELECT * FROM repositories WHERE project_id = ? AND slug = ?').get(project.id, rSlug);
  if (!repo) return null;
  return { project, repo };
}

// Create plan form
router.get('/new', (req, res) => {
  const db = getDb();
  const c = ctx(db, req.params.projectSlug, req.params.repoSlug);
  if (!c) { db.close(); return res.redirect('/'); }

  const groups = db.prepare('SELECT * FROM test_groups WHERE repository_id = ? ORDER BY name').all(c.repo.id);
  const testCases = db.prepare(`
    SELECT tc.*, tg.name as group_name FROM test_cases tc
    LEFT JOIN test_groups tg ON tg.id = tc.group_id
    WHERE tc.repository_id = ? AND tc.status != 'deprecated'
    ORDER BY tc.group_id NULLS LAST, tc.priority, tc.title
  `).all(c.repo.id);

  db.close();

  // Pre-group for clean template rendering
  const ungroupedCases = testCases.filter(c => c.group_id === null || c.group_id === undefined);
  const groupedCases = groups.map(g => ({
    id: g.id, name: g.name,
    cases: testCases.filter(c => String(c.group_id) === String(g.id))
  })).filter(g => g.cases.length > 0);
  res.render('testplans/new', { project: c.project, repo: c.repo, groups, testCases, ungroupedCases, groupedCases, title: 'New Test Plan' });
});

// Create plan
router.post('/', (req, res) => {
  const db = getDb();
  const c = ctx(db, req.params.projectSlug, req.params.repoSlug);
  if (!c) { db.close(); return res.redirect('/'); }

  const { name, description } = req.body;
  let caseIds = req.body.case_ids || [];
  if (!Array.isArray(caseIds)) caseIds = [caseIds];

  const planId = db.prepare('INSERT INTO test_plans (repository_id, name, description) VALUES (?,?,?) RETURNING id')
    .get(c.repo.id, name, description || null).id;

  const insertCase = db.prepare('INSERT OR IGNORE INTO test_plan_cases (test_plan_id, test_case_id, sort_order) VALUES (?,?,?)');
  caseIds.forEach((id, i) => insertCase.run(planId, id, i));

  db.close();
  res.redirect(`/projects/${req.params.projectSlug}/repos/${req.params.repoSlug}/plans/${planId}`);
});

// Show plan
router.get('/:planId', (req, res) => {
  const db = getDb();
  const c = ctx(db, req.params.projectSlug, req.params.repoSlug);
  if (!c) { db.close(); return res.status(404).render('404', { title: 'Not Found' }); }

  const plan = db.prepare('SELECT * FROM test_plans WHERE id = ? AND repository_id = ?').get(req.params.planId, c.repo.id);
  if (!plan) { db.close(); return res.status(404).render('404', { title: 'Not Found' }); }

  const cases = db.prepare(`
    SELECT tc.*, tg.name as group_name, tpc.sort_order
    FROM test_plan_cases tpc
    JOIN test_cases tc ON tc.id = tpc.test_case_id
    LEFT JOIN test_groups tg ON tg.id = tc.group_id
    WHERE tpc.test_plan_id = ?
    ORDER BY tpc.sort_order, tc.priority
  `).all(plan.id);

  const runs = db.prepare(`
    SELECT tr.*,
      SUM(CASE WHEN trr.status='passed' THEN 1 ELSE 0 END) as passed,
      SUM(CASE WHEN trr.status='failed' THEN 1 ELSE 0 END) as failed,
      COUNT(trr.id) as total
    FROM test_runs tr
    LEFT JOIN test_run_results trr ON trr.test_run_id = tr.id
    WHERE tr.test_plan_id = ?
    GROUP BY tr.id ORDER BY tr.created_at DESC
  `).all(plan.id);

  db.close();
  res.render('testplans/show', { project: c.project, repo: c.repo, plan, cases, runs, title: plan.name });
});

// Edit plan form
router.get('/:planId/edit', (req, res) => {
  const db = getDb();
  const c = ctx(db, req.params.projectSlug, req.params.repoSlug);
  if (!c) { db.close(); return res.redirect('/'); }

  const plan = db.prepare('SELECT * FROM test_plans WHERE id = ? AND repository_id = ?').get(req.params.planId, c.repo.id);
  if (!plan) { db.close(); return res.redirect(`/projects/${req.params.projectSlug}/repos/${req.params.repoSlug}`); }

  const selectedIds = db.prepare('SELECT test_case_id FROM test_plan_cases WHERE test_plan_id = ? ORDER BY sort_order').all(plan.id).map(r => String(r.test_case_id));
  const groups = db.prepare('SELECT * FROM test_groups WHERE repository_id = ? ORDER BY name').all(c.repo.id);
  const testCases = db.prepare(`
    SELECT tc.*, tg.name as group_name FROM test_cases tc
    LEFT JOIN test_groups tg ON tg.id = tc.group_id
    WHERE tc.repository_id = ? AND tc.status != 'deprecated'
    ORDER BY tc.group_id NULLS LAST, tc.priority, tc.title
  `).all(c.repo.id);

  db.close();

  // Pre-group for clean template rendering
  const ungroupedCases = testCases.filter(c => c.group_id === null || c.group_id === undefined);
  const groupedCases = groups.map(g => ({
    id: g.id, name: g.name,
    cases: testCases.filter(c => String(c.group_id) === String(g.id))
  })).filter(g => g.cases.length > 0);
  res.render('testplans/edit', { project: c.project, repo: c.repo, plan, testCases, selectedIds, groups, ungroupedCases, groupedCases, title: `Edit - ${plan.name}` });
});

// Update plan
router.post('/:planId/edit', (req, res) => {
  const db = getDb();
  const c = ctx(db, req.params.projectSlug, req.params.repoSlug);
  if (!c) { db.close(); return res.redirect('/'); }

  const { name, description, status } = req.body;
  let caseIds = req.body.case_ids || [];
  if (!Array.isArray(caseIds)) caseIds = [caseIds];

  db.prepare('UPDATE test_plans SET name=?, description=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(name, description || null, status || 'active', req.params.planId);

  db.prepare('DELETE FROM test_plan_cases WHERE test_plan_id = ?').run(req.params.planId);
  const insertCase = db.prepare('INSERT OR IGNORE INTO test_plan_cases (test_plan_id, test_case_id, sort_order) VALUES (?,?,?)');
  caseIds.forEach((id, i) => insertCase.run(req.params.planId, id, i));

  db.close();
  res.redirect(`/projects/${req.params.projectSlug}/repos/${req.params.repoSlug}/plans/${req.params.planId}`);
});

// Delete plan
router.post('/:planId/delete', (req, res) => {
  const db = getDb();
  const c = ctx(db, req.params.projectSlug, req.params.repoSlug);
  if (c) db.prepare('DELETE FROM test_plans WHERE id=? AND repository_id=?').run(req.params.planId, c.repo.id);
  db.close();
  res.redirect(`/projects/${req.params.projectSlug}/repos/${req.params.repoSlug}`);
});

module.exports = router;
