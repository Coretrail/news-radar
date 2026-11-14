// Mutating tests must never fall back to an operator's application database.
if (
  process.env.NODE_ENV !== 'test' ||
  !process.env.PGDATABASE?.endsWith('_test') ||
  process.env.DATABASE_URL
) {
  throw Error(
    'Use NODE_ENV=test, an explicit PGDATABASE ending in _test, and unset DATABASE_URL for integration/browser tests',
  );
}
