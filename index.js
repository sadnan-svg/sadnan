import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';
import 'dotenv/config';
import * as api from './api.js';

const hdr = chalk.bold.cyan;
const ok  = chalk.green;
const err = chalk.red;
const dim = chalk.dim;
const lbl = chalk.bold.white;

function printTable(columns, rows) {
  if (!rows.length) { console.log(dim('  (no results)')); return; }
  const t = new Table({ head: columns.map(c => hdr(c)), style: { compact: true } });
  rows.forEach(r => t.push(r));
  console.log(t.toString());
}

function truncate(str = '', n = 40) {
  return String(str).length > n ? String(str).slice(0, n - 1) + '…' : String(str);
}

function fmt(val) {
  if (val == null || val === '') return dim('—');
  if (typeof val === 'boolean') return val ? ok('yes') : err('no');
  if (Array.isArray(val)) {
    if (!val.length) return dim('[]');
    return val.map(v => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ');
  }
  if (typeof val === 'object') return JSON.stringify(val, null, 2);
  return String(val);
}

function printDetail(obj, title) {
  console.log();
  console.log(hdr(`  ── ${title} ──`));
  const t = new Table({ style: { compact: true, 'padding-left': 2 } });
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
    t.push({ [lbl(k)]: fmt(v) });
  }
  console.log(t.toString());
  console.log();
}

async function pickFromList(items, labelFn, message = 'Select:') {
  if (!items.length) return null;
  const choices = items.map((item, i) => ({ name: labelFn(item), value: i }));
  choices.push({ name: chalk.dim('← Back'), value: -1 });
  const { idx } = await inquirer.prompt({ type: 'list', name: 'idx', message, choices });
  return idx === -1 ? null : items[idx];
}

// ── Contacts ──────────────────────────────────────────────────────────────────

async function contactsMenu() {
  const { action } = await inquirer.prompt({
    type: 'list', name: 'action', message: 'Contacts',
    choices: ['Search / List', 'Create', 'Update', 'Delete', chalk.dim('← Back')],
  });

  if (action === chalk.dim('← Back')) return;

  if (action === 'Search / List') {
    const { q } = await inquirer.prompt({ type: 'input', name: 'q', message: 'Search query (blank = all):' });
    const contacts = await api.searchContacts(q, 25);
    if (!contacts.length) { console.log(dim('\n  (no results)\n')); return; }

    printTable(
      ['#', 'Name', 'Email', 'Phone', 'Source', 'Tags', 'ID'],
      contacts.map((c, i) => [
        String(i + 1),
        truncate(`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim(), 24),
        truncate(c.email ?? '', 28),
        c.phone ?? '',
        truncate(c.source ?? '', 14),
        truncate((c.tags ?? []).join(', '), 20),
        dim(c.id),
      ])
    );

    const contact = await pickFromList(contacts,
      c => `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() + dim(` — ${c.email ?? c.phone ?? c.id}`),
      'View full details for:'
    );
    if (contact) {
      const full = await api.getContact(contact.id);
      printDetail(full, `${full.firstName ?? ''} ${full.lastName ?? ''}`.trim() || full.id);
    }
  }

  if (action === 'Create') {
    const answers = await inquirer.prompt([
      { type: 'input', name: 'firstName', message: 'First name:' },
      { type: 'input', name: 'lastName',  message: 'Last name:' },
      { type: 'input', name: 'email',     message: 'Email:' },
      { type: 'input', name: 'phone',     message: 'Phone:' },
      { type: 'input', name: 'companyName', message: 'Company:' },
      { type: 'input', name: 'address1',  message: 'Address:' },
      { type: 'input', name: 'city',      message: 'City:' },
      { type: 'input', name: 'state',     message: 'State:' },
      { type: 'input', name: 'country',   message: 'Country:' },
      { type: 'input', name: 'postalCode',message: 'Postal code:' },
      { type: 'input', name: 'website',   message: 'Website:' },
      { type: 'input', name: 'source',    message: 'Source:' },
      { type: 'input', name: 'tags',      message: 'Tags (comma-separated):' },
    ]);
    const payload = { ...answers };
    if (answers.tags) payload.tags = answers.tags.split(',').map(t => t.trim()).filter(Boolean);
    const contact = await api.createContact(payload);
    console.log(ok(`\n  ✓ Created contact: ${contact.id}\n`));
    printDetail(contact, 'New Contact');
  }

  if (action === 'Update') {
    const { id } = await inquirer.prompt({ type: 'input', name: 'id', message: 'Contact ID:' });
    const current = await api.getContact(id.trim());
    printDetail(current, 'Current Values');
    const answers = await inquirer.prompt([
      { type: 'input', name: 'firstName',  message: 'First name:',   default: current.firstName  },
      { type: 'input', name: 'lastName',   message: 'Last name:',    default: current.lastName   },
      { type: 'input', name: 'email',      message: 'Email:',        default: current.email      },
      { type: 'input', name: 'phone',      message: 'Phone:',        default: current.phone      },
      { type: 'input', name: 'companyName',message: 'Company:',      default: current.companyName},
      { type: 'input', name: 'address1',   message: 'Address:',      default: current.address1   },
      { type: 'input', name: 'city',       message: 'City:',         default: current.city       },
      { type: 'input', name: 'state',      message: 'State:',        default: current.state      },
      { type: 'input', name: 'postalCode', message: 'Postal code:',  default: current.postalCode },
      { type: 'input', name: 'website',    message: 'Website:',      default: current.website    },
      { type: 'input', name: 'source',     message: 'Source:',       default: current.source     },
      { type: 'input', name: 'tags',       message: 'Tags (comma):', default: (current.tags ?? []).join(', ') },
    ]);
    const payload = { ...answers };
    if (answers.tags !== undefined) payload.tags = answers.tags.split(',').map(t => t.trim()).filter(Boolean);
    const updated = await api.updateContact(id.trim(), payload);
    console.log(ok('\n  ✓ Contact updated\n'));
    printDetail(updated, 'Updated Contact');
  }

  if (action === 'Delete') {
    const { id } = await inquirer.prompt({ type: 'input', name: 'id', message: 'Contact ID to delete:' });
    const current = await api.getContact(id.trim());
    printDetail(current, 'Contact to Delete');
    const { confirm } = await inquirer.prompt({ type: 'confirm', name: 'confirm', message: err('Delete this contact?'), default: false });
    if (confirm) { await api.deleteContact(id.trim()); console.log(ok('  ✓ Deleted\n')); }
    else console.log(dim('  Cancelled\n'));
  }
}

// ── Conversations ─────────────────────────────────────────────────────────────

async function conversationsMenu() {
  const { action } = await inquirer.prompt({
    type: 'list', name: 'action', message: 'Conversations',
    choices: ['Search / List', 'View Messages', 'Send Message', chalk.dim('← Back')],
  });

  if (action === chalk.dim('← Back')) return;

  if (action === 'Search / List') {
    const { q } = await inquirer.prompt({ type: 'input', name: 'q', message: 'Search query (blank = all):' });
    const convs = await api.searchConversations(q, 25);
    if (!convs.length) { console.log(dim('\n  (no results)\n')); return; }

    printTable(
      ['#', 'Contact', 'Channel', 'Unread', 'Last Message', 'Date', 'ID'],
      convs.map((c, i) => [
        String(i + 1),
        truncate(c.fullName ?? c.contactId ?? '', 22),
        c.type ?? '',
        c.unreadCount ? chalk.yellow(String(c.unreadCount)) : dim('0'),
        truncate(c.lastMessageBody ?? '', 36),
        c.lastMessageDate ? new Date(c.lastMessageDate).toLocaleString() : '',
        dim(c.id),
      ])
    );

    const conv = await pickFromList(convs,
      c => `${c.fullName ?? c.contactId ?? 'Unknown'}` + dim(` — ${c.type ?? ''} — ${c.id}`),
      'View full details for:'
    );
    if (conv) printDetail(conv, 'Conversation Details');
  }

  if (action === 'View Messages') {
    const { q } = await inquirer.prompt({ type: 'input', name: 'q', message: 'Search conversations (blank = all):' });
    const convs = await api.searchConversations(q, 25);
    if (!convs.length) { console.log(dim('\n  (no results)\n')); return; }

    const conv = await pickFromList(convs,
      c => `${c.fullName ?? c.contactId ?? 'Unknown'}` + dim(` — ${c.type ?? ''}`),
      'Select conversation:'
    );
    if (!conv) return;

    const msgs = await api.getMessages(conv.id);
    if (!msgs.length) { console.log(dim('\n  (no messages)\n')); return; }

    printTable(
      ['Direction', 'Type', 'Status', 'Body', 'Attachments', 'Date'],
      msgs.map(m => [
        m.direction === 'outbound' ? chalk.blue('→ out') : chalk.yellow('← in'),
        m.messageType ?? m.type ?? '',
        m.status ?? '',
        truncate(m.body ?? '', 44),
        m.attachments?.length ? String(m.attachments.length) : dim('0'),
        m.dateAdded ? new Date(m.dateAdded).toLocaleString() : '',
      ])
    );

    const msg = await pickFromList(msgs,
      m => `${m.direction === 'outbound' ? '→' : '←'} ${truncate(m.body ?? '(no body)', 50)}`,
      'View full message details:'
    );
    if (msg) printDetail(msg, 'Message Details');
  }

  if (action === 'Send Message') {
    const { q } = await inquirer.prompt({ type: 'input', name: 'q', message: 'Search contact/conversation:' });
    const convs = await api.searchConversations(q, 25);
    if (!convs.length) { console.log(dim('\n  (no results)\n')); return; }

    const conv = await pickFromList(convs,
      c => `${c.fullName ?? c.contactId ?? 'Unknown'}` + dim(` — ${c.type ?? ''}`),
      'Send to:'
    );
    if (!conv) return;

    const { message } = await inquirer.prompt({ type: 'input', name: 'message', message: 'Message text:' });
    const result = await api.sendMessage(conv.id, message);
    console.log(ok('\n  ✓ Message sent\n'));
    printDetail(result, 'Sent Message');
  }
}

// ── Opportunities ─────────────────────────────────────────────────────────────

function buildStageMap(pipelines) {
  const map = {};
  for (const p of pipelines) {
    for (const s of p.stages ?? []) map[s.id] = `${p.name} › ${s.name}`;
  }
  return map;
}

function fmtOpp(o, stageMap) {
  return {
    ...o,
    contact:      o.contact?.name ?? o.contactId ?? dim('—'),
    stage:        stageMap[o.pipelineStageId] ?? dim(o.pipelineStageId ?? '—'),
    monetaryValue: o.monetaryValue ? `$${o.monetaryValue.toLocaleString()}` : dim('$0 — not set'),
    effectiveProbability: o.effectiveProbability != null ? `${o.effectiveProbability}%` : dim('—'),
    customFields: (o.customFields ?? []).map(f => f.fieldValueString ?? f.fieldValue ?? '').filter(Boolean).join(', ') || dim('—'),
    source:       o.source ?? dim('—'),
    tags:         o.relations?.[0]?.tags?.join(', ') ?? dim('—'),
    attributionSource: o.attributions?.[0]?.utmSource ?? dim('—'),
    attributionCampaign: o.attributions?.[0]?.utmCampaign ?? dim('—'),
    createdAt:    o.createdAt ? new Date(o.createdAt).toLocaleString() : dim('—'),
    updatedAt:    o.updatedAt ? new Date(o.updatedAt).toLocaleString() : dim('—'),
    lastStageChangeAt: o.lastStageChangeAt ? new Date(o.lastStageChangeAt).toLocaleString() : dim('—'),
  };
}

async function opportunitiesMenu() {
  const { action } = await inquirer.prompt({
    type: 'list', name: 'action', message: 'Opportunities',
    choices: ['Search / List', 'Create', 'Update', 'Delete', 'View Pipelines', chalk.dim('← Back')],
  });

  if (action === chalk.dim('← Back')) return;

  if (action === 'Search / List') {
    const { q } = await inquirer.prompt({ type: 'input', name: 'q', message: 'Search query (blank = all):' });
    const [opps, pipelines] = await Promise.all([
      api.searchOpportunities(q, 25),
      api.getPipelines(),
    ]);
    if (!opps.length) { console.log(dim('\n  (no results)\n')); return; }
    const stageMap = buildStageMap(pipelines);

    printTable(
      ['#', 'Name', 'Status', 'Value', 'Contact', 'Stage', 'Prob%', 'Source', 'ID'],
      opps.map((o, i) => [
        String(i + 1),
        truncate(o.name ?? '', 24),
        o.status === 'won'  ? ok(o.status) :
        o.status === 'lost' ? err(o.status) :
        o.status === 'abandoned' ? dim(o.status) : o.status ?? '',
        o.monetaryValue ? ok(`$${o.monetaryValue.toLocaleString()}`) : err('$0'),
        truncate(o.contact?.name ?? o.contactId ?? '', 20),
        truncate(stageMap[o.pipelineStageId] ?? '', 22),
        o.effectiveProbability != null ? `${o.effectiveProbability}%` : dim('—'),
        truncate(o.source ?? '', 18),
        dim(o.id),
      ])
    );

    const opp = await pickFromList(opps,
      o => `${o.name ?? 'Untitled'}` + dim(` — ${o.status ?? ''} — $${o.monetaryValue ?? 0}`),
      'View full details for:'
    );
    if (opp) printDetail(fmtOpp(opp, stageMap), opp.name ?? 'Opportunity');
  }

  if (action === 'Create') {
    const pipelines = await api.getPipelines();
    if (!pipelines.length) { console.log(err('\n  No pipelines found.\n')); return; }
    const { pipelineId } = await inquirer.prompt({
      type: 'list', name: 'pipelineId', message: 'Pipeline:',
      choices: pipelines.map(p => ({ name: p.name, value: p.id })),
    });
    const pipeline = pipelines.find(p => p.id === pipelineId);
    const stages = pipeline.stages ?? [];
    const { pipelineStageId } = stages.length
      ? await inquirer.prompt({ type: 'list', name: 'pipelineStageId', message: 'Stage:', choices: stages.map(s => ({ name: s.name, value: s.id })) })
      : { pipelineStageId: '' };
    const answers = await inquirer.prompt([
      { type: 'input', name: 'name',         message: 'Opportunity name:' },
      { type: 'input', name: 'contactId',     message: 'Contact ID:' },
      { type: 'input', name: 'monetaryValue', message: 'Value ($):' },
      { type: 'input', name: 'closeDate',     message: 'Close date (YYYY-MM-DD):' },
      { type: 'list',  name: 'status',        message: 'Status:', choices: ['open', 'won', 'lost', 'abandoned'] },
    ]);
    const opp = await api.createOpportunity({
      ...answers, pipelineId, pipelineStageId,
      monetaryValue: Number(answers.monetaryValue) || 0,
    });
    console.log(ok(`\n  ✓ Created opportunity: ${opp.id}\n`));
    const stageMap = buildStageMap(pipelines);
    printDetail(fmtOpp(opp, stageMap), opp.name ?? 'New Opportunity');
  }

  if (action === 'Update') {
    const { q } = await inquirer.prompt({ type: 'input', name: 'q', message: 'Search opportunities:' });
    const [opps, pipelines] = await Promise.all([
      api.searchOpportunities(q, 25),
      api.getPipelines(),
    ]);
    if (!opps.length) { console.log(dim('\n  (no results)\n')); return; }
    const stageMap = buildStageMap(pipelines);
    const opp = await pickFromList(opps,
      o => `${o.name ?? 'Untitled'}` + dim(` — ${o.status} — $${o.monetaryValue ?? 0}`),
      'Select opportunity to update:'
    );
    if (!opp) return;
    printDetail(fmtOpp(opp, stageMap), `Current: ${opp.name}`);

    const { field } = await inquirer.prompt({
      type: 'list', name: 'field', message: 'What to update?',
      choices: ['Status', 'Monetary Value', 'Name', 'Stage', 'Close Date', chalk.dim('← Back')],
    });
    if (field === chalk.dim('← Back')) return;

    if (field === 'Status') {
      const { status } = await inquirer.prompt({ type: 'list', name: 'status', message: 'New status:', choices: ['open', 'won', 'lost', 'abandoned'] });
      const updated = await api.updateOpportunity(opp.id, { status });
      console.log(ok(`\n  ✓ Status → "${status}"\n`));
      if (updated) printDetail(fmtOpp(updated, stageMap), opp.name ?? 'Opportunity');
    }

    if (field === 'Monetary Value') {
      const { val } = await inquirer.prompt({ type: 'input', name: 'val', message: 'New value ($):', default: String(opp.monetaryValue ?? 0) });
      const updated = await api.updateOpportunity(opp.id, { monetaryValue: Number(val) || 0 });
      console.log(ok(`\n  ✓ Value → $${Number(val).toLocaleString()}\n`));
      if (updated) printDetail(fmtOpp(updated, stageMap), opp.name ?? 'Opportunity');
    }

    if (field === 'Name') {
      const { name } = await inquirer.prompt({ type: 'input', name: 'name', message: 'New name:', default: opp.name });
      const updated = await api.updateOpportunity(opp.id, { name });
      console.log(ok(`\n  ✓ Name updated\n`));
      if (updated) printDetail(fmtOpp(updated, stageMap), updated?.name ?? 'Opportunity');
    }

    if (field === 'Stage') {
      const pipeline = pipelines.find(p => p.id === opp.pipelineId);
      const stages = pipeline?.stages ?? [];
      if (!stages.length) { console.log(err('  No stages in this pipeline.\n')); return; }
      const { pipelineStageId } = await inquirer.prompt({
        type: 'list', name: 'pipelineStageId', message: 'New stage:',
        choices: stages.map(s => ({ name: s.name, value: s.id })),
      });
      const updated = await api.updateOpportunity(opp.id, { pipelineStageId });
      console.log(ok(`\n  ✓ Stage updated\n`));
      if (updated) printDetail(fmtOpp(updated, stageMap), opp.name ?? 'Opportunity');
    }

    if (field === 'Close Date') {
      const { closeDate } = await inquirer.prompt({ type: 'input', name: 'closeDate', message: 'Close date (YYYY-MM-DD):', default: opp.closeDate?.slice(0, 10) ?? '' });
      const updated = await api.updateOpportunity(opp.id, { closeDate });
      console.log(ok(`\n  ✓ Close date updated\n`));
      if (updated) printDetail(fmtOpp(updated, stageMap), opp.name ?? 'Opportunity');
    }
  }

  if (action === 'Delete') {
    const { q } = await inquirer.prompt({ type: 'input', name: 'q', message: 'Search opportunities:' });
    const [opps, pipelines] = await Promise.all([
      api.searchOpportunities(q, 25),
      api.getPipelines(),
    ]);
    if (!opps.length) { console.log(dim('\n  (no results)\n')); return; }
    const stageMap = buildStageMap(pipelines);
    const opp = await pickFromList(opps,
      o => `${o.name ?? 'Untitled'}` + dim(` — ${o.status} — $${o.monetaryValue ?? 0}`),
      'Select to delete:'
    );
    if (!opp) return;
    printDetail(fmtOpp(opp, stageMap), 'Opportunity to Delete');
    const { confirm } = await inquirer.prompt({ type: 'confirm', name: 'confirm', message: err('Delete this opportunity?'), default: false });
    if (confirm) { await api.deleteOpportunity(opp.id); console.log(ok('  ✓ Deleted\n')); }
    else console.log(dim('  Cancelled\n'));
  }

  if (action === 'View Pipelines') {
    const pipelines = await api.getPipelines();
    if (!pipelines.length) { console.log(dim('\n  (no pipelines)\n')); return; }
    for (const p of pipelines) {
      console.log();
      console.log(hdr(`  Pipeline: ${p.name}`) + dim(` — ${p.id}`));
      if (p.stages?.length) {
        printTable(
          ['#', 'Stage Name', 'ID'],
          p.stages.map((s, i) => [String(i + 1), s.name, dim(s.id)])
        );
      } else {
        console.log(dim('  (no stages)'));
      }
    }
    console.log();
  }
}

// ── Calendars & Appointments ──────────────────────────────────────────────────

async function calendarsMenu() {
  const { action } = await inquirer.prompt({
    type: 'list', name: 'action', message: 'Calendars & Appointments',
    choices: ['List Calendars', 'View Appointments', chalk.dim('← Back')],
  });

  if (action === chalk.dim('← Back')) return;

  if (action === 'List Calendars') {
    const cals = await api.getCalendars();
    if (!cals.length) { console.log(dim('\n  (no calendars)\n')); return; }
    printTable(
      ['#', 'Name', 'Type', 'Slug', 'Duration', 'ID'],
      cals.map((c, i) => [
        String(i + 1),
        c.name ?? '',
        c.eventType ?? c.calendarType ?? '',
        c.slug ?? dim('—'),
        c.slotDuration ? `${c.slotDuration} min` : dim('—'),
        dim(c.id),
      ])
    );
    const cal = await pickFromList(cals,
      c => `${c.name ?? ''}` + dim(` — ${c.eventType ?? ''}`),
      'View full details for:'
    );
    if (cal) printDetail(cal, cal.name ?? 'Calendar');
  }

  if (action === 'View Appointments') {
    const cals = await api.getCalendars();
    if (!cals.length) { console.log(err('\n  No calendars found.\n')); return; }
    const cal = await pickFromList(cals, c => c.name ?? c.id, 'Calendar:');
    if (!cal) return;

    const { days } = await inquirer.prompt({ type: 'input', name: 'days', message: 'Days ahead to look:', default: '30' });
    const now   = new Date();
    const later = new Date(now.getTime() + Number(days) * 24 * 60 * 60 * 1000);
    const appts = await api.getAppointments(cal.id, now.toISOString(), later.toISOString());

    if (!appts.length) { console.log(dim('\n  (no appointments in range)\n')); return; }

    printTable(
      ['#', 'Title / Contact', 'Start', 'End', 'Status', 'Notes', 'ID'],
      appts.map((a, i) => [
        String(i + 1),
        truncate(a.title ?? a.contactId ?? '', 22),
        a.startTime ? new Date(a.startTime).toLocaleString() : dim('—'),
        a.endTime   ? new Date(a.endTime).toLocaleString()   : dim('—'),
        a.appointmentStatus ?? '',
        truncate(a.notes ?? '', 24),
        dim(a.id),
      ])
    );

    const appt = await pickFromList(appts,
      a => `${a.title ?? a.contactId ?? 'Unknown'}` + dim(` — ${a.startTime ? new Date(a.startTime).toLocaleString() : ''}`),
      'View full details for:'
    );
    if (appt) printDetail(appt, appt.title ?? 'Appointment');
  }
}

// ── Forms ─────────────────────────────────────────────────────────────────────

async function formsMenu() {
  const forms = await api.getForms();
  if (!forms.length) { console.log(dim('\n  (no forms)\n')); return; }
  printTable(
    ['#', 'Name', 'Steps', 'ID'],
    forms.map((f, i) => [String(i + 1), f.name ?? '', String(f.steps?.length ?? 0), dim(f.id)])
  );
  const form = await pickFromList(forms, f => f.name ?? f.id, 'View full details for:');
  if (form) printDetail(form, form.name ?? 'Form');
}

// ── Location Info ─────────────────────────────────────────────────────────────

async function locationInfo() {
  const loc = await api.getLocation();
  printDetail(loc, `Location: ${loc.name ?? loc.id}`);
}

// ── Main Loop ─────────────────────────────────────────────────────────────────

async function main() {
  console.log();
  console.log(hdr('  ╔══════════════════════════╗'));
  console.log(hdr('  ║     GHL Manager  🚀       ║'));
  console.log(hdr('  ╚══════════════════════════╝'));
  console.log(dim(`  Location: ${process.env.GHL_LOCATION_ID}`));
  console.log();

  while (true) {
    const { section } = await inquirer.prompt({
      type: 'list', name: 'section', message: 'What do you want to manage?',
      choices: [
        '📋  Contacts',
        '💬  Conversations',
        '💼  Opportunities',
        '📅  Calendars & Appointments',
        '📝  Forms',
        'ℹ️   Location Info',
        chalk.red('✕  Exit'),
      ],
    });

    try {
      if (section.includes('Contacts'))      await contactsMenu();
      if (section.includes('Conversations')) await conversationsMenu();
      if (section.includes('Opportunities')) await opportunitiesMenu();
      if (section.includes('Calendars'))     await calendarsMenu();
      if (section.includes('Forms'))         await formsMenu();
      if (section.includes('Location'))      await locationInfo();
      if (section.includes('Exit'))          { console.log(dim('\n  Bye!\n')); process.exit(0); }
    } catch (e) {
      const msg = e.response?.data?.message ?? e.message;
      console.log(err(`\n  Error: ${msg}\n`));
    }
  }
}

main();
