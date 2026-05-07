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

// Create test case
router.post('/', (req, res) => {
  const db = getDb();
  const c = ctx(db, req.params.projectSlug, req.params.repoSlug);
  if (!c) { db.close(); return res.redirect('/'); }

  const { title, description, url, priority, type, status, preconditions, steps, expected_result, tags, group_id } = req.body;
  db.prepare(`
    INSERT INTO test_cases (repository_id, group_id, title, description, url, priority, type, status, preconditions, steps, expected_result, tags)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(c.repo.id, group_id || null, title, description || null, url || null,
    priority || 'medium', type || 'functional', status || 'active',
    preconditions || null, steps || null, expected_result || null, tags || null);

  db.prepare('UPDATE repositories SET updated_at=CURRENT_TIMESTAMP WHERE id=?').run(c.repo.id);
  db.close();
  res.redirect(`/projects/${req.params.projectSlug}/repos/${req.params.repoSlug}`);
});

// Show test case
router.get('/:caseId', (req, res) => {
  const db = getDb();
  const c = ctx(db, req.params.projectSlug, req.params.repoSlug);
  if (!c) { db.close(); return res.status(404).render('404', { title: 'Not Found' }); }

  const testCase = db.prepare(`
    SELECT tc.*, tg.name as group_name
    FROM test_cases tc LEFT JOIN test_groups tg ON tg.id = tc.group_id
    WHERE tc.id = ? AND tc.repository_id = ?
  `).get(req.params.caseId, c.repo.id);
  if (!testCase) { db.close(); return res.status(404).render('404', { title: 'Not Found' }); }

  const groups = db.prepare('SELECT * FROM test_groups WHERE repository_id = ? ORDER BY name').all(c.repo.id);

  // Plans this case belongs to
  const plans = db.prepare(`
    SELECT tp.* FROM test_plans tp
    JOIN test_plan_cases tpc ON tpc.test_plan_id = tp.id
    WHERE tpc.test_case_id = ?
  `).all(testCase.id);

  // Recent results for this case
  const results = db.prepare(`
    SELECT trr.*, tr.name as run_name, tr.id as run_id
    FROM test_run_results trr
    JOIN test_runs tr ON tr.id = trr.test_run_id
    WHERE trr.test_case_id = ?
    ORDER BY trr.updated_at DESC LIMIT 10
  `).all(testCase.id);

  db.close();
  res.render('testcases/show', { project: c.project, repo: c.repo, testCase, groups, plans, results, title: testCase.title });
});

// Edit test case (form page)
router.get('/:caseId/edit', (req, res) => {
  const db = getDb();
  const c = ctx(db, req.params.projectSlug, req.params.repoSlug);
  if (!c) { db.close(); return res.redirect('/'); }

  const testCase = db.prepare('SELECT * FROM test_cases WHERE id = ? AND repository_id = ?').get(req.params.caseId, c.repo.id);
  if (!testCase) { db.close(); return res.redirect(`/projects/${req.params.projectSlug}/repos/${req.params.repoSlug}`); }

  const groups = db.prepare('SELECT * FROM test_groups WHERE repository_id = ? ORDER BY name').all(c.repo.id);
  db.close();
  res.render('testcases/edit', { project: c.project, repo: c.repo, testCase, groups, title: `Edit - ${testCase.title}` });
});

// Update test case
router.post('/:caseId/edit', (req, res) => {
  const db = getDb();
  const c = ctx(db, req.params.projectSlug, req.params.repoSlug);
  if (!c) { db.close(); return res.redirect('/'); }

  const { title, description, url, priority, type, status, preconditions, steps, expected_result, tags, group_id } = req.body;
  db.prepare(`
    UPDATE test_cases SET title=?, description=?, url=?, priority=?, type=?, status=?,
    preconditions=?, steps=?, expected_result=?, tags=?, group_id=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=? AND repository_id=?
  `).run(title, description || null, url || null, priority || 'medium', type || 'functional',
    status || 'active', preconditions || null, steps || null, expected_result || null,
    tags || null, group_id || null, req.params.caseId, c.repo.id);

  db.close();
  res.redirect(`/projects/${req.params.projectSlug}/repos/${req.params.repoSlug}/cases/${req.params.caseId}`);
});

// Delete test case
router.post('/:caseId/delete', (req, res) => {
  const db = getDb();
  const c = ctx(db, req.params.projectSlug, req.params.repoSlug);
  if (c) db.prepare('DELETE FROM test_cases WHERE id=? AND repository_id=?').run(req.params.caseId, c.repo.id);
  db.close();
  res.redirect(`/projects/${req.params.projectSlug}/repos/${req.params.repoSlug}`);
});

module.exports = router;
