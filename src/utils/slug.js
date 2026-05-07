function makeSlug(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

function uniqueSlug(db, table, slug, column = 'slug', extraWhere = '', extraParams = []) {
  let candidate = slug;
  let count = 0;
  while (true) {
    const row = db.prepare(
      `SELECT id FROM ${table} WHERE ${column} = ? ${extraWhere}`
    ).get([candidate, ...extraParams]);
    if (!row) return candidate;
    count++;
    candidate = `${slug}-${count}`;
  }
}

module.exports = { makeSlug, uniqueSlug };
