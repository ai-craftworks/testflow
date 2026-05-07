const { getDb, initDb } = require('./db');

async function seed() {
  await initDb();
  const db = getDb();

  const existing = db.prepare('SELECT COUNT(*) as n FROM projects').get();
  if (existing && existing.n > 0) {
    console.log('⚠️  Database already has data. Run `npm run reset-db` first.');
    db.close(); return;
  }

  const p1 = db.prepare('INSERT INTO projects (name,slug,description,color) VALUES (?,?,?,?) RETURNING id').get('E-Commerce Platform','e-commerce-platform','Main product store – web and mobile','#4f7ef8');
  const p2 = db.prepare('INSERT INTO projects (name,slug,description,color) VALUES (?,?,?,?) RETURNING id').get('Admin Dashboard','admin-dashboard','Internal admin tools and analytics','#16a34a');
  const r1 = db.prepare('INSERT INTO repositories (project_id,name,slug,description) VALUES (?,?,?,?) RETURNING id').get(p1.id,'Checkout Flow','checkout-flow','Cart, checkout, payment, order confirmation');
  const r2 = db.prepare('INSERT INTO repositories (project_id,name,slug,description) VALUES (?,?,?,?) RETURNING id').get(p1.id,'User Authentication','user-authentication','Login, signup, password reset, sessions');
  const r3 = db.prepare('INSERT INTO repositories (project_id,name,slug,description) VALUES (?,?,?,?) RETURNING id').get(p2.id,'User Management','user-management','Admin user CRUD, roles, permissions');
  const g1 = db.prepare('INSERT INTO test_groups (repository_id,name) VALUES (?,?) RETURNING id').get(r1.id,'Happy Path');
  const g2 = db.prepare('INSERT INTO test_groups (repository_id,name) VALUES (?,?) RETURNING id').get(r1.id,'Edge Cases');
  const g3 = db.prepare('INSERT INTO test_groups (repository_id,name) VALUES (?,?) RETURNING id').get(r2.id,'Login');
  const g4 = db.prepare('INSERT INTO test_groups (repository_id,name) VALUES (?,?) RETURNING id').get(r2.id,'Registration');

  const ins = db.prepare('INSERT INTO test_cases (repository_id,group_id,title,description,url,priority,type,status,preconditions,steps,expected_result,tags) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id');
  const c = [
    ins.get(r1.id,g1.id,'User can add item to cart','User adds a product from the listing page','https://example.com/products','high','functional','active','User is logged in','1. Navigate to /products\n2. Click "Add to Cart"\n3. View cart','Cart count increments, item appears','cart, happy-path'),
    ins.get(r1.id,g1.id,'Checkout with credit card','Full checkout flow','https://example.com/checkout','critical','functional','active','Cart has items','1. Open cart\n2. Checkout\n3. Fill shipping\n4. Card 4242424242424242\n5. Pay','Order confirmation shown','checkout, payment'),
    ins.get(r1.id,g1.id,'Order confirmation email sent','Email arrives after checkout',null,'medium','functional','active','Checkout completed','1. Complete checkout\n2. Check inbox','Confirmation email received','email'),
    ins.get(r1.id,g2.id,'Cart persists after refresh','Items survive reload','https://example.com/cart','medium','functional','active','Items in cart','1. Add 2 items\n2. Refresh','Same items shown','cart, persistence'),
    ins.get(r1.id,g2.id,'Declined card shows error','Helpful error on decline','https://example.com/checkout','high','functional','active','Cart has items','1. Enter card 4000000000000002\n2. Pay','Error shown, stays on page','checkout, errors'),
    ins.get(r1.id,null,'Apply coupon code','Valid coupon discounts total','https://example.com/checkout','medium','functional','active',null,'1. Add item\n2. Enter SAVE10\n3. Apply','10% discount applied','coupon'),
    ins.get(r2.id,g3.id,'Login with valid credentials','Standard login','https://example.com/login','critical','smoke','active','Account exists','1. /login\n2. Enter credentials\n3. Sign In','Redirect to dashboard','login, smoke'),
    ins.get(r2.id,g3.id,'Login fails bad password','Error on wrong password','https://example.com/login','high','functional','active',null,'1. Valid email, wrong password\n2. Sign In','Error shown, no session','login, security'),
    ins.get(r2.id,g3.id,'Lockout after 5 failures','Brute-force protection','https://example.com/login','high','security','active',null,'1. Fail login 5 times','Account locked','security'),
    ins.get(r2.id,g4.id,'Register new account','User signup','https://example.com/register','critical','functional','active','Email not registered','1. /register\n2. Fill form\n3. Submit','Account created, email sent','registration'),
    ins.get(r2.id,g4.id,'Reject duplicate email','No duplicate registrations','https://example.com/register','high','functional','active',null,'1. Register with used email','Error shown','registration, validation'),
    ins.get(r2.id,null,'Password reset flow','Reset via email link','https://example.com/forgot','high','functional','active','Verified account','1. Forgot password\n2. Enter email\n3. Open link\n4. New password','Login works with new password','password-reset'),
    ins.get(r3.id,null,'Admin creates user','Admin panel user creation',null,'high','functional','active',null,'1. Login as admin\n2. Users > New\n3. Save','User in list','admin'),
    ins.get(r3.id,null,'Admin deactivates user','Deactivating blocks login',null,'medium','functional','active',null,'1. Find user\n2. Deactivate','Login blocked','admin, security'),
  ];

  const plan1 = db.prepare('INSERT INTO test_plans (repository_id,name,description) VALUES (?,?,?) RETURNING id').get(r1.id,'Checkout Smoke Suite','Critical smoke tests for checkout');
  [0,1,2].forEach((i,o) => db.prepare('INSERT INTO test_plan_cases (test_plan_id,test_case_id,sort_order) VALUES (?,?,?)').run(plan1.id, c[i].id, o));

  const plan2 = db.prepare('INSERT INTO test_plans (repository_id,name,description) VALUES (?,?,?) RETURNING id').get(r2.id,'Auth Regression Suite','Full auth regression');
  [6,7,8,9,10,11].forEach((i,o) => db.prepare('INSERT INTO test_plan_cases (test_plan_id,test_case_id,sort_order) VALUES (?,?,?)').run(plan2.id, c[i].id, o));

  const run1 = db.prepare('INSERT INTO test_runs (repository_id,test_plan_id,name,description) VALUES (?,?,?,?) RETURNING id').get(r1.id, plan1.id,'Sprint 5 – Smoke Run','Pre-release smoke check');
  ['passed','passed','failed'].forEach((s,idx) => {
    const res = db.prepare('INSERT INTO test_run_results (test_run_id,test_case_id,status) VALUES (?,?,?) RETURNING id').get(run1.id, c[idx].id, s);
    if (s === 'failed') {
      db.prepare('INSERT INTO test_run_notes (test_run_result_id,content) VALUES (?,?)').run(res.id, '<p>Email <strong>not received</strong> after 10 minutes. Spam folder also checked — nothing there.</p><p>Suspected Sendgrid issue in staging. Ticket: <strong>ISSUE-421</strong></p>');
    }
  });

  db.close();
  console.log('✅ Seed data inserted: 2 projects, 3 repos, 14 cases, 2 plans, 1 run');
}

seed().catch(e => { console.error(e); process.exit(1); });
