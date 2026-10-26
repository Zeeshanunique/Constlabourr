import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import * as db from "./db.ts";

const app = new Hono();

app.use("/*", cors({ origin: "*", allowHeaders: ["Content-Type", "Authorization"], allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], exposeHeaders: ["Content-Length"], maxAge: 600 }));

async function authUser(c: any) {
  const t = c.req.header('Authorization')?.split(' ')[1];
  if (!t) return null;
  const { data: { user }, error } = await db.supabase.auth.getUser(t);
  return (!error && user) ? user : null;
}

async function getContractorId(userId: string) {
  const p = await db.getProfile(userId);
  return p?.role === 'contractor' ? userId : p?.contractorId;
}

function hashAadhaar(a: string) { return `hash_${a.slice(-4)}`; }

app.get("/make-server-689d7d60/health", (c) => c.json({ status: "ok" }));

// AUTH
app.post("/make-server-689d7d60/auth/register", async (c) => {
  try {
    const { email, password, name, role } = await c.req.json();
    if (!email || !password || !name) return c.json({ error: 'Email, password, and name are required' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: 'Invalid email format' }, 400);
    if (password.length < 6) return c.json({ error: 'Password must be at least 6 characters long' }, 400);
    const existing = await db.getProfileByEmail(email);
    if (existing) return c.json({ error: 'User with this email already exists' }, 400);
    const { data: authData, error: authError } = await db.supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name, role: role || 'contractor' } });
    if (authError) throw authError;
    await db.upsertProfile({ id: authData.user.id, email, name, role: role || 'contractor', createdAt: new Date().toISOString() });
    return c.json({ success: true, userId: authData.user.id });
  } catch (e: any) { return c.json({ error: e.message || 'Registration failed' }, 400); }
});

app.get("/make-server-689d7d60/auth/profile", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    let profile = await db.getProfile(user.id);
    if (!profile) profile = { id: user.id, email: user.email, role: 'contractor', name: user.email };
    return c.json({ profile, user: profile });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// WORKERS
app.post("/make-server-689d7d60/workers", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const contractorId = await getContractorId(user.id);
    const body = await c.req.json();
    const existing = await db.getProfileByEmail(body.email);
    if (existing) return c.json({ error: 'Email already exists' }, 400);
    const { data: authData, error: authError } = await db.supabase.auth.admin.createUser({ email: body.email, password: body.password, email_confirm: true, user_metadata: { name: body.name, role: 'labour' } });
    if (authError) return c.json({ error: authError.message }, 400);
    const worker = { id: authData.user.id, contractorId, name: body.name, email: body.email, phone: body.phone, aadhaarHash: body.aadhaar ? hashAadhaar(body.aadhaar) : null, bankDetails: body.bankDetails || {}, skillLevel: body.skillLevel || 'unskilled', dailyWage: body.dailyWage || 0, messCharge: body.messCharge || 0, siteId: body.siteId || null, status: 'active', role: 'labour', createdAt: new Date().toISOString() };
    await db.upsertProfile(worker);
    return c.json({ success: true, worker });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.get("/make-server-689d7d60/workers", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const contractorId = await getContractorId(user.id);
    const workers = await db.getWorkersByContractor(contractorId!);
    return c.json({ workers });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.put("/make-server-689d7d60/workers/:id", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const workerId = c.req.param('id');
    const body = await c.req.json();
    const worker = await db.getProfile(workerId);
    if (!worker) return c.json({ error: 'Worker not found' }, 404);
    if (body.password) {
      const { error } = await db.supabase.auth.admin.updateUserById(workerId, { password: body.password });
      if (error) return c.json({ error: 'Failed to update password' }, 400);
    }
    const updated = { ...worker, name: body.name || worker.name, email: body.email || worker.email, phone: body.phone || worker.phone, aadhaarHash: body.aadhaar ? hashAadhaar(body.aadhaar) : worker.aadhaarHash, bankDetails: body.bankDetails || worker.bankDetails, skillLevel: body.skillLevel || worker.skillLevel, dailyWage: body.dailyWage !== undefined ? body.dailyWage : worker.dailyWage, messCharge: body.messCharge !== undefined ? body.messCharge : worker.messCharge, siteId: body.siteId !== undefined ? body.siteId : worker.siteId, status: body.status || worker.status, updatedAt: new Date().toISOString() };
    await db.upsertProfile(updated);
    return c.json({ success: true, worker: updated });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.delete("/make-server-689d7d60/workers/:id", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const workerId = c.req.param('id');
    const worker = await db.getProfile(workerId);
    if (!worker) return c.json({ error: 'Worker not found' }, 404);
    await db.supabase.auth.admin.deleteUser(workerId);
    await db.deleteProfile(workerId);
    return c.json({ success: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// FOREMEN
app.post("/make-server-689d7d60/foremen", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const contractorId = await getContractorId(user.id);
    const body = await c.req.json();
    const existing = await db.getProfileByEmail(body.email);
    if (existing) return c.json({ error: 'Email already exists' }, 400);
    const { data: authData, error: authError } = await db.supabase.auth.admin.createUser({ email: body.email, password: body.password, email_confirm: true, user_metadata: { name: body.name, role: 'foreman' } });
    if (authError) return c.json({ error: authError.message }, 400);
    const foreman = { id: authData.user.id, contractorId, name: body.name, phone: body.phone, email: body.email, role: 'foreman', siteId: body.siteId || null, createdAt: new Date().toISOString() };
    await db.upsertProfile(foreman);
    return c.json({ success: true, foreman });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.get("/make-server-689d7d60/foremen", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const contractorId = await getContractorId(user.id);
    const foremen = await db.getForemenByContractor(contractorId!);
    const sites = await db.getSitesByContractor(contractorId!);
    const result = foremen.map((f: any) => { const site = sites.find((s: any) => s.id === f.siteId); return { ...f, siteName: site ? site.name : null }; });
    return c.json({ foremen: result });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.put("/make-server-689d7d60/foremen/:id", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const foremanId = c.req.param('id');
    const body = await c.req.json();
    const foreman = await db.getProfile(foremanId);
    if (!foreman) return c.json({ error: 'Foreman not found' }, 404);
    if (body.password) {
      const { error } = await db.supabase.auth.admin.updateUserById(foremanId, { password: body.password });
      if (error) return c.json({ error: 'Failed to update password' }, 400);
    }
    const updated = { ...foreman, name: body.name || foreman.name, phone: body.phone || foreman.phone, siteId: body.siteId !== undefined ? body.siteId : foreman.siteId, updatedAt: new Date().toISOString() };
    await db.upsertProfile(updated);
    return c.json({ success: true, foreman: updated });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.delete("/make-server-689d7d60/foremen/:id", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const foremanId = c.req.param('id');
    const foreman = await db.getProfile(foremanId);
    if (!foreman) return c.json({ error: 'Foreman not found' }, 404);
    await db.supabase.auth.admin.deleteUser(foremanId);
    await db.deleteProfile(foremanId);
    return c.json({ success: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// SITES
app.post("/make-server-689d7d60/sites", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const contractorId = await getContractorId(user.id);
    const body = await c.req.json();
    const site = { id: crypto.randomUUID(), contractorId, name: body.name, address: body.address, startDate: body.startDate, endDate: body.endDate || null, foremanId: body.foremanId || null, geoFence: body.geoFence || null, status: 'active', createdAt: new Date().toISOString() };
    await db.insertSite(site);
    return c.json({ success: true, site });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.get("/make-server-689d7d60/sites", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const contractorId = await getContractorId(user.id);
    const sites = await db.getSitesByContractor(contractorId!);
    return c.json({ sites });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.put("/make-server-689d7d60/sites/:id", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const siteId = c.req.param('id');
    const body = await c.req.json();
    const site = await db.getSite(siteId);
    if (!site) return c.json({ error: 'Site not found' }, 404);
    const updated = { ...site, ...body, updatedAt: new Date().toISOString() };
    await db.updateSite(siteId, updated);
    return c.json({ success: true, site: updated });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.delete("/make-server-689d7d60/sites/:id", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const siteId = c.req.param('id');
    const site = await db.getSite(siteId);
    if (!site) return c.json({ error: 'Site not found' }, 404);
    await db.deleteSite(siteId);
    return c.json({ success: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// --- Part 2 will be appended: attendance, payroll, reports, dashboard, agreements ---
// ATTENDANCE
app.post("/make-server-689d7d60/attendance", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const body = await c.req.json();
    const existing = await db.findExistingAttendance(body.workerId, body.siteId, body.date);
    if (existing) return c.json({ error: 'Attendance already marked for this date' }, 400);
    const record = { id: crypto.randomUUID(), ...body, createdAt: new Date().toISOString() };
    await db.upsertAttendance(record);
    return c.json({ success: true, attendance: record });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.get("/make-server-689d7d60/attendance", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const workerId = c.req.query('workerId');
    const siteId = c.req.query('siteId');
    const date = c.req.query('date');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const records = await db.queryAttendance({ workerId, siteId, date, startDate, endDate });
    return c.json({ attendance: records });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.put("/make-server-689d7d60/attendance/:id", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    const body = await c.req.json();
    const existing = await db.getAttendanceById(id);
    if (!existing) return c.json({ error: 'Not found' }, 404);
    const updated = { ...existing, ...body, updatedAt: new Date().toISOString() };
    await db.upsertAttendance(updated);
    return c.json({ success: true, attendance: updated });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.delete("/make-server-689d7d60/attendance/:id", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    await db.deleteAttendance(c.req.param('id'));
    return c.json({ success: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// PAYROLL
app.post("/make-server-689d7d60/payroll", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const body = await c.req.json();
    const record = { id: crypto.randomUUID(), ...body, createdBy: user.id, createdAt: new Date().toISOString() };
    await db.insertPayroll(record);
    return c.json({ success: true, payroll: record });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.get("/make-server-689d7d60/payroll", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const records = await db.queryPayroll({ createdBy: user.id });
    return c.json({ payroll: records });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.get("/make-server-689d7d60/payroll/:id", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const record = await db.getPayrollById(c.req.param('id'));
    return c.json({ payroll: record });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.put("/make-server-689d7d60/payroll/:id/status", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { status } = await c.req.json();
    await db.updatePayrollStatus(c.req.param('id'), status);
    return c.json({ success: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// ADVANCES
app.post("/make-server-689d7d60/advances", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const body = await c.req.json();
    const record = { id: crypto.randomUUID(), ...body, givenBy: user.id, createdAt: new Date().toISOString() };
    await db.insertAdvance(record);
    return c.json({ success: true, advance: record });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.get("/make-server-689d7d60/advances", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const workerId = c.req.query('workerId');
    const status = c.req.query('status');
    const records = await db.queryAdvances({ workerId, status });
    return c.json({ advances: records });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.put("/make-server-689d7d60/advances/:id/status", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { status } = await c.req.json();
    await db.updateAdvanceStatus(c.req.param('id'), status);
    return c.json({ success: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// AGREEMENTS
app.get("/make-server-689d7d60/agreements", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const contractorId = await getContractorId(user.id);
    const agreement = await db.getAgreement(contractorId!);
    return c.json({ agreement });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.post("/make-server-689d7d60/agreements/accept", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const contractorId = await getContractorId(user.id);
    const body = await c.req.json();
    const record = { id: crypto.randomUUID(), ...body, workerId: user.id, contractorId, acceptedAt: new Date().toISOString() };
    await db.insertAcceptance(record);
    return c.json({ success: true, acceptance: record });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.get("/make-server-689d7d60/agreements/acceptances", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const contractorId = await getContractorId(user.id);
    const acceptances = await db.getAcceptancesByContractor(contractorId!);
    return c.json({ acceptances });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// DASHBOARD STATS
app.get("/make-server-689d7d60/dashboard/stats", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const contractorId = await getContractorId(user.id);
    const workers = await db.getWorkersByContractor(contractorId!);
    const sites = await db.getSitesByContractor(contractorId!);
    return c.json({
      stats: {
        totalWorkers: workers.length,
        activeSites: sites.filter((s:any) => s.status === 'active').length,
        totalSites: sites.length
      }
    });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// ADDITIONAL MISSING ROUTES
app.get("/make-server-689d7d60/foreman/stats", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data: sites } = await db.supabase.from('sites').select('*').eq('foreman_id', user.id);
    const assignedSites = sites?.length || 0;
    const siteIds = sites?.map(s => s.id) || [];
    let assignedWorkersCount = 0;
    if (siteIds.length > 0) {
      const { count } = await db.supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'labour').in('site_id', siteIds);
      assignedWorkersCount = count || 0;
    }
    const today = new Date().toISOString().split('T')[0];
    let presentToday = 0;
    let absentToday = 0;
    if (siteIds.length > 0) {
      const { data: att } = await db.supabase.from('attendance').select('status').in('site_id', siteIds).eq('date', today);
      if (att) {
        presentToday = att.filter(a => a.status === 'present' || a.status === 'half-day').length;
        absentToday = att.filter(a => a.status === 'absent').length;
      }
    }
    return c.json({ stats: { assignedWorkers: assignedWorkersCount, assignedSites, presentToday, absentToday }});
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.get("/make-server-689d7d60/worker/stats", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data: att } = await db.supabase.from('attendance').select('*').eq('worker_id', user.id);
    const presentDays = att?.filter(a => a.status === 'present' || a.status === 'half-day').length || 0;
    const absentDays = att?.filter(a => a.status === 'absent').length || 0;
    const totalDaysWorked = presentDays;
    const totalEarnings = att?.reduce((sum, a) => sum + Number(a.total_payment || 0), 0) || 0;
    const thisMonth = new Date().toISOString().slice(0, 7);
    const thisMonthEarnings = att?.filter(a => a.date && a.date.startsWith(thisMonth)).reduce((sum, a) => sum + Number(a.total_payment || 0), 0) || 0;
    const { data: adv } = await db.supabase.from('advances').select('amount').eq('worker_id', user.id).eq('status', 'pending');
    const pendingAdvances = adv?.reduce((sum, a) => sum + Number(a.amount || 0), 0) || 0;
    return c.json({ stats: { totalDaysWorked, presentDays, absentDays, totalEarnings, thisMonthEarnings, pendingAdvances }});
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.get("/make-server-689d7d60/worker/attendance", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const year = c.req.query('year');
    let q = db.supabase.from('attendance').select('*').eq('worker_id', user.id);
    if (year) q = q.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`);
    const { data } = await q;
    return c.json({ attendance: data || [] });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.get("/make-server-689d7d60/agreement/status", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const profile = await db.getProfile(user.id);
    const contractorId = profile?.contractorId;
    if (!contractorId) return c.json({ agreement: null, needsAcceptance: false });
    const activeAgreement = await db.getAgreement(contractorId);
    if (!activeAgreement) return c.json({ agreement: null, needsAcceptance: false });
    const acceptance = await db.getWorkerAcceptance(user.id);
    const needsAcceptance = !acceptance || acceptance.agreementVersion < activeAgreement.version;
    return c.json({ agreement: activeAgreement, needsAcceptance, acceptedVersion: acceptance?.agreementVersion });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.post("/make-server-689d7d60/payroll/process", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { siteId, startDate, endDate } = await c.req.json();
    const { data: att } = await db.supabase.from('attendance').select('worker_id, total_payment').eq('site_id', siteId).gte('date', startDate).lte('date', endDate);
    const totalGross = att?.reduce((sum, a) => sum + Number(a.total_payment || 0), 0) || 0;
    const record = { id: crypto.randomUUID(), siteId, startDate, endDate, items: [], totalGross, totalNet: totalGross, status: 'pending', createdBy: user.id, createdAt: new Date().toISOString() };
    await db.insertPayroll(record);
    return c.json({ success: true, payroll: record });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.get("/make-server-689d7d60/reports", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const type = c.req.query('type');
    return c.json({ reports: { type, data: [] }});
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

Deno.serve(app.fetch);