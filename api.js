import axios from 'axios';
import 'dotenv/config';

const BASE = 'https://services.leadconnectorhq.com';
const VERSION = '2021-07-28';

const client = axios.create({
  baseURL: BASE,
  headers: {
    Authorization: `Bearer ${process.env.GHL_API_KEY}`,
    Version: VERSION,
    'Content-Type': 'application/json',
  },
});

const loc = process.env.GHL_LOCATION_ID;

// ── Contacts ──────────────────────────────────────────────────────────────────

export async function searchContacts(query = '', limit = 20) {
  const { data } = await client.get('/contacts/search', {
    params: { locationId: loc, query, limit },
  });
  return data.contacts ?? [];
}

export async function getContact(id) {
  const { data } = await client.get(`/contacts/${id}`);
  return data.contact;
}

export async function createContact(fields) {
  const { data } = await client.post('/contacts/', { locationId: loc, ...fields });
  return data.contact;
}

export async function updateContact(id, fields) {
  const { data } = await client.put(`/contacts/${id}`, fields);
  return data.contact;
}

export async function deleteContact(id) {
  await client.delete(`/contacts/${id}`);
}

// ── Conversations ─────────────────────────────────────────────────────────────

export async function searchConversations(query = '', limit = 20) {
  const { data } = await client.get('/conversations/search', {
    params: { locationId: loc, query, limit },
  });
  return data.conversations ?? [];
}

export async function getMessages(conversationId) {
  const { data } = await client.get(`/conversations/${conversationId}/messages`);
  return data.messages ?? [];
}

export async function sendMessage(conversationId, message) {
  const { data } = await client.post(`/conversations/${conversationId}/messages`, {
    type: 'SMS',
    message,
  });
  return data;
}

// ── Opportunities ─────────────────────────────────────────────────────────────

export async function searchOpportunities(query = '', limit = 20) {
  const { data } = await client.get('/opportunities/search', {
    params: { location_id: loc, query, limit },
  });
  return data.opportunities ?? [];
}

export async function createOpportunity(fields) {
  const { data } = await client.post('/opportunities/', { locationId: loc, ...fields });
  return data.opportunity;
}

export async function updateOpportunityStatus(id, status) {
  const { data } = await client.patch(`/opportunities/${id}`, { status });
  return data.opportunity;
}

export async function deleteOpportunity(id) {
  await client.delete(`/opportunities/${id}`);
}

// ── Pipelines ─────────────────────────────────────────────────────────────────

export async function getPipelines() {
  const { data } = await client.get('/opportunities/pipelines', {
    params: { locationId: loc },
  });
  return data.pipelines ?? [];
}

// ── Calendars & Appointments ──────────────────────────────────────────────────

export async function getCalendars() {
  const { data } = await client.get('/calendars/', {
    params: { locationId: loc },
  });
  return data.calendars ?? [];
}

export async function getAppointments(calendarId, startTime, endTime) {
  const { data } = await client.get('/calendars/events/appointments', {
    params: { locationId: loc, calendarId, startTime, endTime },
  });
  return data.appointments ?? [];
}

// ── Forms ─────────────────────────────────────────────────────────────────────

export async function getForms() {
  const { data } = await client.get('/forms/', {
    params: { locationId: loc },
  });
  return data.forms ?? [];
}

// ── Snapshots / Location info ─────────────────────────────────────────────────

export async function getLocation() {
  const { data } = await client.get(`/locations/${loc}`);
  return data.location;
}
