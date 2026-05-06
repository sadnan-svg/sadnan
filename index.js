import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';
import 'dotenv/config';
import * as api from './api.js';

const hdr = chalk.bold.cyan;
const ok  = chalk.green;
const err = chalk.red;
const dim = chalk.dim;

function printTable(columns, rows) {
  if (!rows.length) { console.log(dim('  (no results)')); return; }
  const t = new Table({ head: columns.map(c => hdr(c)), style: { compact: true } });
  rows.forEach(r => t.push(r));
  console.log(t.toString());
}

function truncate(str = '', n = 40) {
  return String(str).length > n ? String(str).slice(0, n - 1) + '…' : String(str);
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
    printTable(
      ['Name', 'Email', 'Phone', 'ID'],
      contacts.map(c => [
        truncate(`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim(), 28),
        truncate(c.email ?? '', 32),
        c.phone ?? '',
        dim(c.id),
      ])
    );
  }

  if (action === 'Create') {
    const answers = await inquirer.prompt([
      { type: 'input', name: 'firstName', message: 'First name:' },
      { type: 'input', name: 'lastName',  message: 'Last name:' },
      { type: 'input', name: 'email',     message: 'Email:' },
      { type: 'input', name: 'phone',     message: 'Phone:' },
    ]);
    const contact = await api.createContact(answers);
    console.log(ok(`✓ Created contact: ${contact.id}`));
  }

  if (action === 'Update') {
    const { id } = await inquirer.prompt({ type: 'input', name: 'id', message: 'Contact ID:' });
    const current = await api.getContact(id.trim());
    console.log(dim(`Current: ${current.firstName} ${current.lastName} | ${current.email} | ${current.phone}`));
    const answers = await inquirer.prompt([
      { type: 'input', name: 'firstName', message: 'First name (blank = keep):', default: current.firstName },
      { type: 'input', name: 'lastName',  message: 'Last name (blank = keep):',  default: current.lastName  },
      { type: 'input', name: 'email',     message: 'Email (blank = keep):',      default: current.email     },
      { type: 'input', name: 'phone',     message: 'Phone (blank = keep):',      default: current.phone     },
    ]);
    await api.updateContact(id.trim(), answers);
    console.log(ok('✓ Contact updated'));
  }

  if (action === 'Delete') {
    const { id } = await inquirer.prompt({ type: 'input', name: 'id', message: 'Contact ID to delete:' });
    const { confirm } = await inquirer.prompt({ type: 'confirm', name: 'confirm', message: err('Delete this contact?'), default: false });
    if (confirm) { await api.deleteContact(id.trim()); console.log(ok('✓ Deleted')); }
    else console.log(dim('Cancelled'));
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
    printTable(
      ['Contact', 'Last Message', 'Type', 'ID'],
      convs.map(c => [
        truncate(c.fullName ?? c.contactId ?? '', 24),
        truncate(c.lastMessageBody ?? '', 36),
        c.type ?? '',
        dim(c.id),
      ])
    );
  }

  if (action === 'View Messages') {
    const { id } = await inquirer.prompt({ type: 'input', name: 'id', message: 'Conversation ID:' });
    const msgs = await api.getMessages(id.trim());
    printTable(
      ['Direction', 'Type', 'Body', 'Date'],
      msgs.map(m => [
        m.direction === 'outbound' ? chalk.blue('→ out') : chalk.yellow('← in'),
        m.type ?? '',
        truncate(m.body ?? '', 48),
        m.dateAdded ? new Date(m.dateAdded).toLocaleString() : '',
      ])
    );
  }

  if (action === 'Send Message') {
    const { id, message } = await inquirer.prompt([
      { type: 'input', name: 'id',      message: 'Conversation ID:' },
      { type: 'input', name: 'message', message: 'Message text:' },
    ]);
    await api.sendMessage(id.trim(), message);
    console.log(ok('✓ Message sent'));
  }
}

// ── Opportunities ─────────────────────────────────────────────────────────────

async function opportunitiesMenu() {
  const { action } = await inquirer.prompt({
    type: 'list', name: 'action', message: 'Opportunities',
    choices: ['Search / List', 'Create', 'Update Status', 'Delete', 'View Pipelines', chalk.dim('← Back')],
  });

  if (action === chalk.dim('← Back')) return;

  if (action === 'Search / List') {
    const { q } = await inquirer.prompt({ type: 'input', name: 'q', message: 'Search query (blank = all):' });
    const opps = await api.searchOpportunities(q, 25);
    printTable(
      ['Name', 'Status', 'Value', 'Stage', 'ID'],
      opps.map(o => [
        truncate(o.name ?? '', 28),
        o.status ?? '',
        o.monetaryValue != null ? `$${o.monetaryValue}` : '',
        truncate(o.pipelineStageId ?? '', 20),
        dim(o.id),
      ])
    );
  }

  if (action === 'Create') {
    const pipelines = await api.getPipelines();
    if (!pipelines.length) { console.log(err('No pipelines found.')); return; }
    const { pipelineId } = await inquirer.prompt({
      type: 'list', name: 'pipelineId', message: 'Pipeline:',
      choices: pipelines.map(p => ({ name: p.name, value: p.id })),
    });
    const pipeline = pipelines.find(p => p.id === pipelineId);
    const stages = pipeline.stages ?? [];
    const { pipelineStageId } = await inquirer.prompt({
      type: 'list', name: 'pipelineStageId', message: 'Stage:',
      choices: stages.length ? stages.map(s => ({ name: s.name, value: s.id })) : ['(none)'],
    });
    const answers = await inquirer.prompt([
      { type: 'input', name: 'name',           message: 'Opportunity name:' },
      { type: 'input', name: 'contactId',       message: 'Contact ID:' },
      { type: 'input', name: 'monetaryValue',   message: 'Value ($):' },
    ]);
    const opp = await api.createOpportunity({ ...answers, pipelineId, pipelineStageId, monetaryValue: Number(answers.monetaryValue) || 0 });
    console.log(ok(`✓ Created opportunity: ${opp.id}`));
  }

  if (action === 'Update Status') {
    const { id, status } = await inquirer.prompt([
      { type: 'input', name: 'id', message: 'Opportunity ID:' },
      { type: 'list',  name: 'status', message: 'New status:', choices: ['open', 'won', 'lost', 'abandoned'] },
    ]);
    await api.updateOpportunityStatus(id.trim(), status);
    console.log(ok(`✓ Status updated to "${status}"`));
  }

  if (action === 'Delete') {
    const { id } = await inquirer.prompt({ type: 'input', name: 'id', message: 'Opportunity ID to delete:' });
    const { confirm } = await inquirer.prompt({ type: 'confirm', name: 'confirm', message: err('Delete this opportunity?'), default: false });
    if (confirm) { await api.deleteOpportunity(id.trim()); console.log(ok('✓ Deleted')); }
    else console.log(dim('Cancelled'));
  }

  if (action === 'View Pipelines') {
    const pipelines = await api.getPipelines();
    printTable(
      ['Pipeline', 'Stages', 'ID'],
      pipelines.map(p => [
        p.name,
        (p.stages ?? []).map(s => s.name).join(', ') || dim('(none)'),
        dim(p.id),
      ])
    );
  }
}

// ── Calendars ─────────────────────────────────────────────────────────────────

async function calendarsMenu() {
  const { action } = await inquirer.prompt({
    type: 'list', name: 'action', message: 'Calendars & Appointments',
    choices: ['List Calendars', 'View Appointments', chalk.dim('← Back')],
  });

  if (action === chalk.dim('← Back')) return;

  if (action === 'List Calendars') {
    const cals = await api.getCalendars();
    printTable(
      ['Name', 'Type', 'ID'],
      cals.map(c => [c.name ?? '', c.eventType ?? '', dim(c.id)])
    );
  }

  if (action === 'View Appointments') {
    const cals = await api.getCalendars();
    if (!cals.length) { console.log(err('No calendars found.')); return; }
    const { calendarId } = await inquirer.prompt({
      type: 'list', name: 'calendarId', message: 'Calendar:',
      choices: cals.map(c => ({ name: c.name, value: c.id })),
    });
    const now   = new Date();
    const later = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const appts = await api.getAppointments(calendarId, now.toISOString(), later.toISOString());
    printTable(
      ['Contact', 'Start', 'End', 'Status', 'ID'],
      appts.map(a => [
        truncate(a.title ?? a.contactId ?? '', 24),
        a.startTime ? new Date(a.startTime).toLocaleString() : '',
        a.endTime   ? new Date(a.endTime).toLocaleString()   : '',
        a.appointmentStatus ?? '',
        dim(a.id),
      ])
    );
  }
}

// ── Forms ─────────────────────────────────────────────────────────────────────

async function formsMenu() {
  const forms = await api.getForms();
  printTable(
    ['Name', 'ID'],
    forms.map(f => [f.name ?? '', dim(f.id)])
  );
}

// ── Location Info ─────────────────────────────────────────────────────────────

async function locationInfo() {
  const loc = await api.getLocation();
  console.log();
  console.log(hdr('Location Info'));
  console.log(`  Name:     ${loc.name}`);
  console.log(`  Email:    ${loc.email}`);
  console.log(`  Phone:    ${loc.phone}`);
  console.log(`  Address:  ${[loc.address, loc.city, loc.state, loc.postalCode].filter(Boolean).join(', ')}`);
  console.log(`  Timezone: ${loc.timezone}`);
  console.log(`  ID:       ${dim(loc.id)}`);
  console.log();
}

// ── Main Loop ─────────────────────────────────────────────────────────────────

async function main() {
  console.log();
  console.log(hdr('  GHL Manager'));
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
      if (section.includes('Contacts'))     await contactsMenu();
      if (section.includes('Conversations')) await conversationsMenu();
      if (section.includes('Opportunities')) await opportunitiesMenu();
      if (section.includes('Calendars'))    await calendarsMenu();
      if (section.includes('Forms'))        await formsMenu();
      if (section.includes('Location'))     await locationInfo();
      if (section.includes('Exit'))         { console.log(dim('Bye!')); process.exit(0); }
    } catch (e) {
      const msg = e.response?.data?.message ?? e.message;
      console.log(err(`\n  Error: ${msg}\n`));
    }

    console.log();
  }
}

main();
