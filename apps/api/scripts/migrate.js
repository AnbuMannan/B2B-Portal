/**
 * scripts/migrate.js
 *
 * Non-interactive Prisma migration runner for CI/CD environments and
 * non-interactive shells (Git Bash, PowerShell, Docker, etc.) where
 * `prisma migrate dev` blocks waiting for a migration name prompt.
 *
 * Usage:
 *   node scripts/migrate.js                     # auto-names migration by timestamp
 *   node scripts/migrate.js "add_2fa_fields"    # custom migration name
 *
 * npm script alias:  npm run db:migrate:ci
 */

const { execSync } = require('child_process');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'src', 'database', 'schema.prisma');

// Build migration name: arg or timestamp
const nameArg = process.argv[2];
const migrationName = nameArg
  ? nameArg.replace(/\s+/g, '_').toLowerCase()
  : `migration_${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}`;

const cmd = [
  'npx prisma migrate dev',
  `--schema="${schemaPath}"`,
  `--name="${migrationName}"`,
  '--skip-generate',   // skip client regeneration — run db:generate separately
].join(' ');

console.log(`\n▶ Running: ${cmd}\n`);

try {
  execSync(cmd, {
    stdio: 'inherit',
    env: { ...process.env },
    // Force non-interactive: supply empty stdin so Prisma's readline prompt
    // gets EOF immediately and uses the --name value instead of prompting.
    input: '',
  });
  console.log(`\n✅ Migration "${migrationName}" applied successfully.\n`);

  // Regenerate Prisma client after migration
  console.log('▶ Regenerating Prisma client…');
  execSync(`npx prisma generate --schema="${schemaPath}"`, { stdio: 'inherit' });
  console.log('✅ Prisma client regenerated.\n');
} catch (err) {
  console.error('\n❌ Migration failed.\n');
  process.exit(1);
}
