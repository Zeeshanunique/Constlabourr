import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

export { supabase };

// ---- Profile helpers ----
export async function getProfile(id: string) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapProfile(data) : null;
}

export async function getProfileByEmail(email: string) {
  const { data } = await supabase.from('profiles').select('*').eq('email', email).maybeSingle();
  return data ? mapProfile(data) : null;
}

export async function upsertProfile(profile: any) {
  const row = unmapProfile(profile);
  const { error } = await supabase.from('profiles').upsert(row);
  if (error) throw error;
}

export async function deleteProfile(id: string) {
  const { error } = await supabase.from('profiles').delete().eq('id', id);
  if (error) throw error;
}

export async function getWorkersByContractor(contractorId: string) {
  const { data, error } = await supabase.from('profiles').select('*')
    .eq('contractor_id', contractorId).eq('role', 'labour');
  if (error) throw error;
  return (data || []).map(mapProfile);
}

export async function getForemenByContractor(contractorId: string) {
  const { data, error } = await supabase.from('profiles').select('*')
    .eq('contractor_id', contractorId).eq('role', 'foreman');
  if (error) throw error;
  return (data || []).map(mapProfile);
}

export async function getAllProfiles() {
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) throw error;
  return (data || []).map(mapProfile);
}

// ---- Site helpers ----
export async function getSite(id: string) {
  const { data, error } = await supabase.from('sites').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapSite(data) : null;
}

export async function getSitesByContractor(contractorId: string) {
  const { data, error } = await supabase.from('sites').select('*').eq('contractor_id', contractorId);
  if (error) throw error;
  return (data || []).map(mapSite);
}

export async function insertSite(site: any) {
  const row = unmapSite(site);
  const { error } = await supabase.from('sites').insert(row);
  if (error) throw error;
}

export async function updateSite(id: string, updates: any) {
  const row = unmapSite(updates);
  const { error } = await supabase.from('sites').update(row).eq('id', id);
  if (error) throw error;
}

export async function deleteSite(id: string) {
  const { error } = await supabase.from('sites').delete().eq('id', id);
  if (error) throw error;
}

// ---- Attendance helpers ----
export async function getAttendanceById(id: string) {
  const { data, error } = await supabase.from('attendance').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapAttendance(data) : null;
}

export function normalizeShift(s?: string): 'day' | 'night' {
  if (!s) return 'day';
  const lower = String(s).toLowerCase();
  return lower.includes('night') ? 'night' : 'day';
}

export function sanitizeTime(t: any): string | null {
  if (!t || typeof t !== 'string') return null;
  const trimmed = t.replace(/[\u202f\u00a0]/g, ' ').trim();
  if (!trimmed) return null;

  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match24) {
    const h = match24[1].padStart(2, '0');
    const m = match24[2];
    const s = match24[3] || '00';
    return `${h}:${m}:${s}`;
  }

  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = match12[2];
    const s = match12[3] || '00';
    const ampm = match12[4].toLowerCase();
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}:${s}`;
  }

  return null;
}

export async function queryAttendance(filters: { workerId?: string; siteId?: string; date?: string; shift?: string; startDate?: string; endDate?: string }) {
  let q = supabase.from('attendance').select('*');
  if (filters.workerId) q = q.eq('worker_id', filters.workerId);
  if (filters.siteId) q = q.eq('site_id', filters.siteId);
  if (filters.date) q = q.eq('date', filters.date);
  if (filters.shift) {
    const s = normalizeShift(filters.shift);
    q = q.in('shift', [s, s === 'day' ? 'Day Shift' : 'Night Shift']);
  }
  if (filters.startDate) q = q.gte('date', filters.startDate);
  if (filters.endDate) q = q.lte('date', filters.endDate);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(mapAttendance);
}

export async function findExistingAttendance(workerId: string, siteId: string, date: string, shift?: string) {
  let q = supabase.from('attendance').select('*')
    .eq('worker_id', workerId).eq('date', date);
  if (siteId) q = q.eq('site_id', siteId);
  if (shift) {
    const s = normalizeShift(shift);
    q = q.in('shift', [s, s === 'day' ? 'Day Shift' : 'Night Shift']);
  }
  const { data } = await q.maybeSingle();
  return data ? mapAttendance(data) : null;
}

export async function upsertAttendance(record: any) {
  const row = unmapAttendance(record);
  const { error } = await supabase.from('attendance').upsert(row);
  if (error) throw error;
}

export async function deleteAttendance(id: string) {
  const { error } = await supabase.from('attendance').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteAllAttendance() {
  const { data, error } = await supabase.from('attendance').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id');
  if (error) throw error;
  return data?.length || 0;
}

// ---- Advance helpers ----
export async function insertAdvance(adv: any) {
  const row = { id: adv.id, worker_id: adv.workerId, amount: adv.amount, date: adv.date, reason: adv.reason || '', status: adv.status || 'pending', given_by: adv.givenBy, created_at: adv.createdAt };
  const { error } = await supabase.from('advances').insert(row);
  if (error) throw error;
}

export async function queryAdvances(filters: { workerId?: string; status?: string }) {
  let q = supabase.from('advances').select('*');
  if (filters.workerId) q = q.eq('worker_id', filters.workerId);
  if (filters.status) q = q.eq('status', filters.status);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(mapAdvance);
}

export async function updateAdvanceStatus(id: string, status: string) {
  const updates: any = { status };
  if (status === 'deducted') updates.deducted_at = new Date().toISOString();
  const { error } = await supabase.from('advances').update(updates).eq('id', id);
  if (error) throw error;
}

// ---- Payroll helpers ----
export async function insertPayroll(p: any) {
  const row = { id: p.id, site_id: p.siteId, start_date: p.startDate, end_date: p.endDate, items: p.items, total_gross: p.totalGross, total_net: p.totalNet, status: p.status, created_by: p.createdBy, created_at: p.createdAt };
  const { error } = await supabase.from('payroll').insert(row);
  if (error) throw error;
}

export async function queryPayroll(filters: { createdBy?: string; startDate?: string; endDate?: string }) {
  let q = supabase.from('payroll').select('*');
  if (filters.createdBy) q = q.eq('created_by', filters.createdBy);
  if (filters.startDate) q = q.gte('start_date', filters.startDate);
  if (filters.endDate) q = q.lte('end_date', filters.endDate);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(mapPayroll);
}

export async function getPayrollById(id: string) {
  const { data, error } = await supabase.from('payroll').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapPayroll(data) : null;
}

export async function updatePayrollStatus(id: string, status: string) {
  const { error } = await supabase.from('payroll').update({ status }).eq('id', id);
  if (error) throw error;
}

// ---- Payment helpers ----
export async function insertPayment(p: any) {
  const row = { id: p.id, worker_id: p.workerId, amount: p.amount, payment_method: p.paymentMethod, transaction_ref: p.transactionRef, date: p.date, payroll_id: p.payrollId, notes: p.notes, status: p.status, created_by: p.createdBy, created_at: p.createdAt };
  const { error } = await supabase.from('payments').insert(row);
  if (error) throw error;
}

// ---- Production helpers ----
export async function insertProduction(p: any) {
  const row = { id: p.id, worker_id: p.workerId, site_id: p.siteId, task_type: p.taskType, units: p.units, rate_per_unit: p.ratePerUnit, total_amount: p.totalAmount, date: p.date, recorded_by: p.recordedBy, created_at: p.createdAt };
  const { error } = await supabase.from('production').insert(row);
  if (error) throw error;
}

export async function queryProduction(filters: { workerId?: string; siteId?: string; startDate?: string; endDate?: string }) {
  let q = supabase.from('production').select('*');
  if (filters.workerId) q = q.eq('worker_id', filters.workerId);
  if (filters.siteId) q = q.eq('site_id', filters.siteId);
  if (filters.startDate) q = q.gte('date', filters.startDate);
  if (filters.endDate) q = q.lte('date', filters.endDate);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((r: any) => ({ id: r.id, workerId: r.worker_id, siteId: r.site_id, taskType: r.task_type, units: r.units, ratePerUnit: r.rate_per_unit, totalAmount: r.total_amount, date: r.date, recordedBy: r.recorded_by, createdAt: r.created_at }));
}

// ---- Agreement helpers ----
export async function getAgreement(contractorId: string) {
  const { data } = await supabase.from('agreements').select('*').eq('contractor_id', contractorId).eq('is_active', true).order('version', { ascending: false }).limit(1).maybeSingle();
  return data ? { id: data.id, contractorId: data.contractor_id, title: data.title, content: data.content, version: data.version, isActive: data.is_active, createdAt: data.created_at, updatedAt: data.updated_at } : null;
}

export async function getAllAgreements(contractorId: string) {
  const { data, error } = await supabase.from('agreements').select('*').eq('contractor_id', contractorId).order('version', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getAgreementById(id: string) {
  const { data, error } = await supabase.from('agreements').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, contractorId: data.contractor_id, title: data.title, content: data.content, version: data.version, isActive: data.is_active, createdAt: data.created_at, updatedAt: data.updated_at } : null;
}

export async function activateAgreement(contractorId: string, id: string) {
  await supabase.from('agreements').update({ is_active: false }).eq('contractor_id', contractorId);
  const { error } = await supabase.from('agreements').update({ is_active: true }).eq('id', id);
  if (error) throw error;
}

export async function upsertAgreement(a: any) {
  const row = { id: a.id, contractor_id: a.contractorId, title: a.title, content: a.content, version: a.version, is_active: a.isActive, created_at: a.createdAt, updated_at: a.updatedAt };
  const { error } = await supabase.from('agreements').upsert(row);
  if (error) throw error;
}

export async function insertAcceptance(a: any) {
  const row = { id: a.id, worker_id: a.workerId, contractor_id: a.contractorId, agreement_id: a.agreementId, agreement_version: a.agreementVersion, signature: a.signature, ip_address: a.ipAddress, device_info: a.deviceInfo, accepted_at: a.acceptedAt };
  const { error } = await supabase.from('agreement_acceptances').insert(row);
  if (error) throw error;
}

export async function getWorkerAcceptance(workerId: string) {
  const { data } = await supabase.from('agreement_acceptances').select('*').eq('worker_id', workerId).order('accepted_at', { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  return { id: data.id, workerId: data.worker_id, contractorId: data.contractor_id, agreementId: data.agreement_id, agreementVersion: data.agreement_version, signature: data.signature, ipAddress: data.ip_address, deviceInfo: data.device_info, acceptedAt: data.accepted_at };
}

export async function getAcceptancesByContractor(contractorId: string) {
  const { data, error } = await supabase.from('agreement_acceptances').select('*').eq('contractor_id', contractorId);
  if (error) throw error;
  return (data || []).map((d: any) => ({ id: d.id, workerId: d.worker_id, workerName: '', contractorId: d.contractor_id, agreementId: d.agreement_id, agreementVersion: d.agreement_version, signature: d.signature, ipAddress: d.ip_address, deviceInfo: d.device_info, acceptedAt: d.accepted_at }));
}

// ---- Mappers ----
export function mapProfile(r: any) {
  return { id: r.id, email: r.email, name: r.name, role: r.role, phone: r.phone, aadhaarHash: r.aadhaar_hash, bankDetails: r.bank_details, skillLevel: r.skill_level, dailyWage: Number(r.daily_wage), messCharge: Number(r.mess_charge), contractorId: r.contractor_id, siteId: r.site_id, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at };
}

function unmapProfile(p: any) {
  const row: any = {};
  if (p.id !== undefined) row.id = p.id;
  if (p.email !== undefined) row.email = p.email;
  if (p.name !== undefined) row.name = p.name;
  if (p.role !== undefined) row.role = p.role;
  if (p.phone !== undefined) row.phone = p.phone;
  if (p.aadhaarHash !== undefined) row.aadhaar_hash = p.aadhaarHash;
  if (p.bankDetails !== undefined) row.bank_details = p.bankDetails;
  if (p.skillLevel !== undefined) row.skill_level = p.skillLevel;
  if (p.dailyWage !== undefined) row.daily_wage = p.dailyWage;
  if (p.messCharge !== undefined) row.mess_charge = p.messCharge;
  if (p.contractorId !== undefined) row.contractor_id = p.contractorId;
  if (p.siteId !== undefined) row.site_id = p.siteId;
  if (p.status !== undefined) row.status = p.status;
  if (p.createdAt !== undefined) row.created_at = p.createdAt;
  if (p.updatedAt !== undefined) row.updated_at = p.updatedAt;
  return row;
}

export function mapSite(r: any) {
  return { id: r.id, contractorId: r.contractor_id, name: r.name, address: r.address, startDate: r.start_date, endDate: r.end_date, foremanId: r.foreman_id, geoFence: r.geo_fence, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at };
}

function unmapSite(s: any) {
  const row: any = {};
  if (s.id !== undefined) row.id = s.id;
  if (s.contractorId !== undefined) row.contractor_id = s.contractorId;
  if (s.name !== undefined) row.name = s.name;
  if (s.address !== undefined) row.address = s.address;
  if (s.startDate !== undefined) row.start_date = s.startDate;
  if (s.endDate !== undefined) row.end_date = s.endDate;
  if (s.foremanId !== undefined) row.foreman_id = s.foremanId;
  if (s.geoFence !== undefined) row.geo_fence = s.geoFence;
  if (s.status !== undefined) row.status = s.status;
  if (s.createdAt !== undefined) row.created_at = s.createdAt;
  if (s.updatedAt !== undefined) row.updated_at = s.updatedAt;
  return row;
}

export function mapAttendance(r: any) {
  return { id: r.id, workerId: r.worker_id, workerName: r.worker_name, siteId: r.site_id, date: r.date, shift: r.shift || 'day', checkIn: r.check_in, checkOut: r.check_out, breakStart: r.break_start, breakEnd: r.break_end, status: r.status, totalHours: Number(r.total_hours || 0), breakHours: Number(r.break_hours || 0), netWorkHours: Number(r.net_work_hours || 0), regularHours: Number(r.regular_hours || 0), overtimeHours: Number(r.overtime_hours || 0), dailyWage: Number(r.daily_wage || 0), hourlyRate: Number(r.hourly_rate || 0), overtimeRate: Number(r.overtime_rate || 0), dailyPayment: Number(r.daily_payment || 0), overtimePayment: Number(r.overtime_payment || 0), totalPayment: Number(r.total_payment || 0), geoLocation: r.geo_location, notes: r.notes, markedBy: r.marked_by, createdAt: r.created_at, updatedAt: r.updated_at };
}

function unmapAttendance(a: any) {
  const row: any = {};
  if (a.id !== undefined) row.id = a.id;
  if (a.workerId !== undefined) row.worker_id = a.workerId;
  if (a.workerName !== undefined) row.worker_name = a.workerName;
  if (a.siteId !== undefined) row.site_id = a.siteId;
  if (a.date !== undefined) row.date = a.date;
  if (a.shift !== undefined) row.shift = normalizeShift(a.shift);
  if (a.checkIn !== undefined) row.check_in = sanitizeTime(a.checkIn);
  if (a.checkOut !== undefined) row.check_out = sanitizeTime(a.checkOut);
  if (a.breakStart !== undefined) row.break_start = sanitizeTime(a.breakStart);
  if (a.breakEnd !== undefined) row.break_end = sanitizeTime(a.breakEnd);
  if (a.status !== undefined) row.status = a.status;
  if (a.totalHours !== undefined) row.total_hours = a.totalHours;
  if (a.breakHours !== undefined) row.break_hours = a.breakHours;
  if (a.netWorkHours !== undefined) row.net_work_hours = a.netWorkHours;
  if (a.regularHours !== undefined) row.regular_hours = a.regularHours;
  if (a.overtimeHours !== undefined) row.overtime_hours = a.overtimeHours;
  if (a.dailyWage !== undefined) row.daily_wage = a.dailyWage;
  if (a.hourlyRate !== undefined) row.hourly_rate = a.hourlyRate;
  if (a.overtimeRate !== undefined) row.overtime_rate = a.overtimeRate;
  if (a.dailyPayment !== undefined) row.daily_payment = a.dailyPayment;
  if (a.overtimePayment !== undefined) row.overtime_payment = a.overtimePayment;
  if (a.totalPayment !== undefined) row.total_payment = a.totalPayment;
  if (a.geoLocation !== undefined) row.geo_location = a.geoLocation;
  if (a.notes !== undefined) row.notes = a.notes;
  if (a.markedBy !== undefined) row.marked_by = a.markedBy;
  if (a.createdAt !== undefined) row.created_at = a.createdAt;
  if (a.updatedAt !== undefined) row.updated_at = a.updatedAt;
  return row;
}

export function mapAdvance(r: any) {
  return { id: r.id, workerId: r.worker_id, amount: Number(r.amount), date: r.date, reason: r.reason, status: r.status, givenBy: r.given_by, deductedAt: r.deducted_at, createdAt: r.created_at };
}

export function mapPayroll(r: any) {
  return { id: r.id, siteId: r.site_id, startDate: r.start_date, endDate: r.end_date, items: r.items, totalGross: Number(r.total_gross), totalNet: Number(r.total_net), status: r.status, createdBy: r.created_by, createdAt: r.created_at };
}
