import 'dotenv/config';
import axios from 'axios';
import { writeFileSync } from 'fs';

const client = axios.create({
  baseURL: 'https://services.leadconnectorhq.com',
  headers: { Authorization: `Bearer ${process.env.GHL_API_KEY}`, Version: '2021-07-28' },
});
const loc = process.env.GHL_LOCATION_ID;

// fetch pipelines for stage names
const { data: pd } = await client.get('/opportunities/pipelines', { params: { locationId: loc } });
const pipelines = pd.pipelines ?? [];
const pipelineMap = Object.fromEntries(pipelines.map(p => [p.id, p.name]));
const stageMap = {};
for (const p of pipelines) for (const s of p.stages ?? []) stageMap[s.id] = s.name;

// fetch all opportunities
let all = [], after = null;
do {
  const { data } = await client.get('/opportunities/search', {
    params: { location_id: loc, limit: 100, ...(after ? { startAfter: after[0], startAfterId: after[1] } : {}) },
  });
  const batch = data.opportunities ?? [];
  all.push(...batch);
  process.stdout.write(`\r  Fetched ${all.length}...`);
  const last = batch[batch.length - 1];
  after = last?.sort ?? null;
  if (batch.length < 100) break;
} while (after);

console.log(`\n  Total: ${all.length}\n`);

// build CSV
const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;

const headers = [
  'ID', 'Name', 'Status', 'Pipeline', 'Stage',
  'Monetary Value', 'Contact Name', 'Contact Email', 'Contact Phone',
  'Tags', 'Source', 'UTM Source', 'UTM Campaign', 'UTM Medium', 'UTM Content',
  'Custom Fields', 'Effective Probability', 'Close Date',
  'Assigned To', 'Created At', 'Updated At', 'Last Stage Change',
];

const rows = all.map(o => {
  const contact = o.contact ?? {};
  const relation = o.relations?.[0] ?? {};
  const attr = o.attributions?.[0] ?? {};
  const customFields = (o.customFields ?? [])
    .map(f => f.fieldValueString ?? f.value ?? '')
    .filter(Boolean)
    .join('; ');

  return [
    o.id,
    o.name ?? '',
    o.status ?? '',
    pipelineMap[o.pipelineId] ?? o.pipelineId ?? '',
    stageMap[o.pipelineStageId] ?? o.pipelineStageId ?? '',
    o.monetaryValue ?? 0,
    contact.name ?? relation.fullName ?? '',
    contact.email ?? relation.email ?? '',
    contact.phone ?? relation.phone ?? '',
    (relation.tags ?? contact.tags ?? []).join(', '),
    o.source ?? '',
    attr.utmSource ?? '',
    attr.utmCampaign ?? '',
    attr.utmMedium ?? '',
    attr.utmContent ?? '',
    customFields,
    o.effectiveProbability ?? '',
    o.closeDate ?? '',
    o.assignedTo ?? '',
    o.createdAt ?? '',
    o.updatedAt ?? '',
    o.lastStageChangeAt ?? '',
  ].map(escape).join(',');
});

const csv = [headers.map(escape).join(','), ...rows].join('\n');
const filename = `opportunities_export_${new Date().toISOString().slice(0,10)}.csv`;
writeFileSync(filename, csv, 'utf8');
console.log(`✓ Exported to ${filename}`);
