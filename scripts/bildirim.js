import { notifyDeadlines, notifyNewMaterials } from '../integrations/bildirim.js';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const mode = args.has('--materials') ? 'materials' : 'deadlines';

const result = mode === 'materials'
  ? notifyNewMaterials({ dryRun })
  : notifyDeadlines({ dryRun });

console.log(JSON.stringify({ mode, dryRun, ...result }));
