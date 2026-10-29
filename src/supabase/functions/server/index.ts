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
function getTodayIST(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function getCurrentISTHour(): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      hour12: false,
    });
    return parseInt(formatter.format(new Date()), 10);
  } catch {
    return new Date().getUTCHours() + 5.5;
  }
}

// ATTENDANCE
app.post("/make-server-689d7d60/attendance", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const body = await c.req.json();

    const todayIST = getTodayIST();
    if (body.date && body.date > todayIST) {
      return c.json({ error: 'Cannot mark attendance for future dates' }, 400);
    }

    const shift = db.normalizeShift(body.shift);
    if (body.date === todayIST && shift === 'night') {
      const currentHour = getCurrentISTHour();
      if (currentHour < 19) {
        return c.json({ error: 'Night shift has not started yet for today (begins at 07:00 PM). Attendance cannot be marked in advance.' }, 400);
      }
    }
    const existing = await db.findExistingAttendance(body.workerId, body.siteId, body.date, shift);

    // Resolve worker wage if not supplied in body
    let dailyWage = body.dailyWage;
    let dailyPayment = body.dailyPayment;
    let totalPayment = body.totalPayment;
    if (dailyWage === undefined || dailyPayment === undefined || totalPayment === undefined) {
      const worker = await db.getProfile(body.workerId);
      const wage = worker?.dailyWage || 0;
      dailyWage = dailyWage !== undefined ? dailyWage : wage;
      if (body.status === 'present') {
        dailyPayment = wage;
        totalPayment = wage;
      } else if (body.status === 'half-day') {
        dailyPayment = wage / 2;
        totalPayment = wage / 2;
      } else {
        dailyPayment = 0;
        totalPayment = 0;
      }
    }

    if (existing) {
      const updated = {
        ...existing,
        ...body,
        shift,
        dailyWage,
        dailyPayment,
        totalPayment,
        markedBy: user.id,
        updatedAt: new Date().toISOString()
      };
      await db.upsertAttendance(updated);
      return c.json({ success: true, attendance: updated });
    }

    const record = { 
      id: crypto.randomUUID(), 
      ...body, 
      shift,
      dailyWage,
      dailyPayment,
      totalPayment,
      markedBy: user.id,
      createdAt: new Date().toISOString() 
    };
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
    const shift = c.req.query('shift');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const records = await db.queryAttendance({ workerId, siteId, date, shift, startDate, endDate });
    return c.json({ attendance: records });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.put("/make-server-689d7d60/attendance/:id", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    const body = await c.req.json();

    const todayIST = getTodayIST();
    if (body.date && body.date > todayIST) {
      return c.json({ error: 'Cannot update attendance to a future date' }, 400);
    }

    const existing = await db.getAttendanceById(id);
    if (!existing) return c.json({ error: 'Not found' }, 404);

    const targetDate = body.date || existing.date;
    const shift = body.shift ? db.normalizeShift(body.shift) : (existing.shift ? db.normalizeShift(existing.shift) : 'day');
    if (targetDate === todayIST && shift === 'night') {
      const currentHour = getCurrentISTHour();
      if (currentHour < 19) {
        return c.json({ error: 'Night shift has not started yet for today (begins at 07:00 PM). Attendance cannot be updated in advance.' }, 400);
      }
    }

    let dailyWage = body.dailyWage !== undefined ? body.dailyWage : existing.dailyWage;
    let dailyPayment = body.dailyPayment !== undefined ? body.dailyPayment : existing.dailyPayment;
    let totalPayment = body.totalPayment !== undefined ? body.totalPayment : existing.totalPayment;

    if (body.status && body.status !== existing.status) {
      if (body.status === 'present') {
        dailyPayment = dailyWage;
        totalPayment = dailyWage + (existing.overtimePayment || 0);
      } else if (body.status === 'half-day') {
        dailyPayment = dailyWage / 2;
        totalPayment = (dailyWage / 2) + (existing.overtimePayment || 0);
      } else if (body.status === 'absent') {
        dailyPayment = 0;
        totalPayment = 0;
      }
    }

    const updated = { 
      ...existing, 
      ...body, 
      dailyWage,
      dailyPayment,
      totalPayment,
      updatedAt: new Date().toISOString() 
    };
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
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const records = await db.queryPayroll({ createdBy: user.id, startDate, endDate });
    const allItems: any[] = [];
    records.forEach(r => {
      if (Array.isArray(r.items) && r.items.length > 0) {
        r.items.forEach((item: any) => {
          allItems.push({ ...item, payrollId: r.id, cycleStart: r.startDate, cycleEnd: r.endDate });
        });
      } else {
        allItems.push(r);
      }
    });
    return c.json({ payroll: allItems, batches: records });
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

app.post("/make-server-689d7d60/payroll/:id/mark-paid", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    await db.updatePayrollStatus(c.req.param('id'), 'paid');
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

app.get("/make-server-689d7d60/agreement/list", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const contractorId = await getContractorId(user.id);
    const agreements = await db.getAllAgreements(contractorId!);
    const acceptances = await db.getAcceptancesByContractor(contractorId!);
    const result = agreements.map((a: any) => ({
      id: a.id,
      version: a.version,
      terms: a.content,
      effectiveDate: a.created_at,
      status: a.is_active ? 'active' : 'draft',
      acceptances: acceptances.filter((acc: any) => acc.agreementId === a.id).length
    }));
    return c.json({ agreements: result });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.post("/make-server-689d7d60/agreement/create", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const contractorId = await getContractorId(user.id);
    const { terms, effectiveDate } = await c.req.json();
    const existing = await db.getAllAgreements(contractorId!);
    const nextVersion = existing.length > 0 ? Math.max(...existing.map((a: any) => a.version)) + 1 : 1;
    const newAgreement = {
      id: crypto.randomUUID(),
      contractorId: contractorId!,
      title: 'Worker Employment Agreement',
      content: terms || '',
      version: nextVersion,
      isActive: existing.length === 0,
      createdAt: effectiveDate || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.upsertAgreement(newAgreement);
    return c.json({ success: true, agreement: newAgreement });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.put("/make-server-689d7d60/agreement/:id", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    const { terms } = await c.req.json();
    const existing = await db.getAgreementById(id);
    if (!existing) return c.json({ error: 'Agreement not found' }, 404);
    const updated = { ...existing, content: terms || existing.content, updatedAt: new Date().toISOString() };
    await db.upsertAgreement(updated);
    return c.json({ success: true, agreement: updated });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.post("/make-server-689d7d60/agreement/:id/activate", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const contractorId = await getContractorId(user.id);
    const id = c.req.param('id');
    await db.activateAgreement(contractorId!, id);
    return c.json({ success: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

const handleAcceptAgreement = async (c: any) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const body = await c.req.json();
    const profile = await db.getProfile(user.id);
    const contractorId = profile?.contractorId || (await getContractorId(user.id));
    const record = {
      id: crypto.randomUUID(),
      agreementId: body.agreementId,
      agreementVersion: body.agreementVersion,
      signature: body.signature,
      workerId: user.id,
      contractorId,
      ipAddress: c.req.header('x-forwarded-for') || '',
      deviceInfo: c.req.header('user-agent') || '',
      acceptedAt: new Date().toISOString(),
    };
    await db.insertAcceptance(record);
    return c.json({ success: true, acceptance: record });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
};

app.post("/make-server-689d7d60/agreements/accept", handleAcceptAgreement);
app.post("/make-server-689d7d60/agreement/accept", handleAcceptAgreement);

app.get("/make-server-689d7d60/agreements/acceptances", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const contractorId = await getContractorId(user.id);
    const acceptances = await db.getAcceptancesByContractor(contractorId!);
    const workers = await db.getWorkersByContractor(contractorId!);
    const enriched = acceptances.map((acc: any) => {
      const w = workers.find((w: any) => w.id === acc.workerId);
      return { ...acc, workerName: w ? w.name : 'Unknown Worker' };
    });
    return c.json({ acceptances: enriched });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// DASHBOARD STATS
app.get("/make-server-689d7d60/dashboard/stats", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const contractorId = await getContractorId(user.id);
    const allWorkers = await db.getWorkersByContractor(contractorId!);
    const allSites = await db.getSitesByContractor(contractorId!);

    const siteId = c.req.query('siteId');
    const dateParam = c.req.query('date');
    const today = dateParam || new Date().toISOString().split('T')[0];

    // Filter by site if specified
    const isFiltered = Boolean(siteId && siteId !== 'all');
    const targetSites = isFiltered
      ? allSites.filter((s: any) => s.id === siteId)
      : allSites;
    const targetWorkers = isFiltered
      ? allWorkers.filter((w: any) => w.siteId === siteId)
      : allWorkers;

    const targetSiteIds = targetSites.map((s: any) => s.id);

    let presentToday = 0;
    let halfDayToday = 0;
    let absentToday = 0;
    let totalWagesToday = 0;
    let recentActivity: any[] = [];

    if (targetSiteIds.length > 0) {
      // Query today's attendance for the target sites
      const { data: todayAttendance, error: attError } = await db.supabase
        .from('attendance')
        .select('*')
        .in('site_id', targetSiteIds)
        .eq('date', today);

      if (!attError && todayAttendance) {
        for (const a of todayAttendance) {
          if (a.status === 'present') presentToday++;
          else if (a.status === 'half-day') halfDayToday++;
          else if (a.status === 'absent') absentToday++;

          let pay = Number(a.total_payment || 0);
          if (!pay) {
            const worker = allWorkers.find((w: any) => w.id === a.worker_id);
            const baseWage = Number(worker?.dailyWage || 800);
            if (a.status === 'present') pay = baseWage;
            else if (a.status === 'half-day') pay = Math.round(baseWage / 2);
          }
          totalWagesToday += pay;
        }
      }

      // Query recent attendance punches for activity feed
      const { data: recentPunches } = await db.supabase
        .from('attendance')
        .select('*')
        .in('site_id', targetSiteIds)
        .order('created_at', { ascending: false })
        .limit(8);

      if (recentPunches) {
        recentActivity = recentPunches.map((p: any) => {
          const w = allWorkers.find((wrk: any) => wrk.id === p.worker_id);
          const s = allSites.find((st: any) => st.id === p.site_id);
          return {
            id: p.id,
            workerId: p.worker_id,
            workerName: w?.name || p.worker_name || 'Worker',
            trade: w?.skillLevel ? w.skillLevel.toUpperCase() : 'GENERAL',
            siteId: p.site_id,
            siteName: s?.name || 'Site',
            status: p.status,
            shift: p.shift || 'day',
            checkIn: p.check_in,
            checkOut: p.check_out,
            date: p.date,
            createdAt: p.created_at,
          };
        });
      }
    }

    const totalWorkers = targetWorkers.length;
    const activeWorkers = presentToday + halfDayToday;
    const unmarkedToday = Math.max(0, totalWorkers - (presentToday + halfDayToday + absentToday));
    const activeSites = isFiltered
      ? targetSites.filter((s: any) => s.status === 'active').length
      : allSites.filter((s: any) => s.status === 'active').length;
    const totalSites = isFiltered ? 1 : allSites.length;
    const turnoutPercentage = totalWorkers > 0
      ? Math.min(100, Math.round((activeWorkers / totalWorkers) * 100))
      : 0;

    return c.json({
      stats: {
        totalWorkers,
        activeWorkers,
        presentToday,
        halfDayToday,
        absentToday,
        unmarkedToday,
        totalSites,
        activeSites,
        totalWagesToday,
        turnoutPercentage,
        date: today,
        siteId: siteId || 'all',
      },
      recentActivity,
      sites: allSites.map((s: any) => ({
        id: s.id,
        name: s.name,
        address: s.address,
        status: s.status,
      })),
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
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
    const month = c.req.query('month');
    let q = db.supabase.from('attendance').select('*').eq('worker_id', user.id);
    if (year && month) {
      const mStr = String(month).padStart(2, '0');
      q = q.gte('date', `${year}-${mStr}-01`).lte('date', `${year}-${mStr}-31`);
    } else if (year) {
      q = q.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`);
    }
    const { data, error } = await q;
    if (error) throw error;
    return c.json({ attendance: (data || []).map(db.mapAttendance) });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.get("/make-server-689d7d60/agreement/status", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const profile = await db.getProfile(user.id);
    const contractorId = profile?.contractorId;
    if (!contractorId) return c.json({ agreement: null, currentAgreement: null, needsAcceptance: false });
    const activeAgreement = await db.getAgreement(contractorId);
    if (!activeAgreement) return c.json({ agreement: null, currentAgreement: null, needsAcceptance: false });
    const acceptance = await db.getWorkerAcceptance(user.id);
    const needsAcceptance = !acceptance || acceptance.agreementVersion < activeAgreement.version;
    return c.json({
      agreement: activeAgreement,
      currentAgreement: activeAgreement,
      needsAcceptance,
      acceptedVersion: acceptance?.agreementVersion
    });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.post("/make-server-689d7d60/payroll/process", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { siteId, startDate, endDate } = await c.req.json();
    const contractorId = await getContractorId(user.id);
    const workers = await db.getWorkersByContractor(contractorId!);

    let q = db.supabase.from('attendance')
      .select('worker_id, status, total_payment, date')
      .gte('date', startDate)
      .lte('date', endDate);

    if (siteId) {
      q = q.eq('site_id', siteId);
    } else {
      const sites = await db.getSitesByContractor(contractorId!);
      const siteIds = sites.map((s: any) => s.id);
      if (siteIds.length > 0) q = q.in('site_id', siteIds);
    }
    const { data: att } = await q;
    const attRecords = att || [];

    const { data: advances } = await db.supabase.from('advances')
      .select('*')
      .eq('status', 'pending');
    const pendingAdvances = advances || [];

    const items = workers.map((worker: any) => {
      const workerAtt = attRecords.filter((a: any) => a.worker_id === worker.id);
      const presentDays = workerAtt.filter((a: any) => a.status === 'present').length;
      const halfDays = workerAtt.filter((a: any) => a.status === 'half-day').length;
      const daysWorked = presentDays + (halfDays * 0.5);

      const totalWage = workerAtt.reduce((sum: number, a: any) => sum + Number(a.total_payment || 0), 0) || (daysWorked * (worker.dailyWage || 0));
      const workerAdvances = pendingAdvances.filter((adv: any) => adv.worker_id === worker.id).reduce((sum: number, adv: any) => sum + Number(adv.amount || 0), 0);
      const deductions = (worker.messCharge || 0) * daysWorked;
      const netPay = Math.max(0, totalWage - workerAdvances - deductions);

      return {
        id: crypto.randomUUID(),
        workerId: worker.id,
        workerName: worker.name,
        daysWorked,
        dailyWage: worker.dailyWage || 0,
        totalWage,
        advances: workerAdvances,
        deductions,
        netPay,
        status: 'pending'
      };
    }).filter((item: any) => item.daysWorked > 0 || item.advances > 0);

    const totalGross = items.reduce((sum: number, item: any) => sum + item.totalWage, 0);
    const totalNet = items.reduce((sum: number, item: any) => sum + item.netPay, 0);

    const record = {
      id: crypto.randomUUID(),
      siteId: siteId || null,
      startDate,
      endDate,
      items,
      totalGross,
      totalNet,
      status: 'pending',
      createdBy: user.id,
      createdAt: new Date().toISOString()
    };
    await db.insertPayroll(record);
    return c.json({ success: true, payroll: record });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.get("/make-server-689d7d60/reports", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const contractorId = await getContractorId(user.id);
    const workers = await db.getWorkersByContractor(contractorId!);
    const sites = await db.getSitesByContractor(contractorId!);
    const siteIds = sites.map((s: any) => s.id);

    // 1. Skill distribution
    const skillCounts: Record<string, number> = { 'Unskilled': 0, 'Semi-skilled': 0, 'Skilled': 0 };
    workers.forEach((w: any) => {
      const level = (w.skillLevel || 'unskilled').toLowerCase();
      if (level.includes('semi')) skillCounts['Semi-skilled'] = (skillCounts['Semi-skilled'] || 0) + 1;
      else if (level.includes('skill')) skillCounts['Skilled'] = (skillCounts['Skilled'] || 0) + 1;
      else skillCounts['Unskilled'] = (skillCounts['Unskilled'] || 0) + 1;
    });

    // 2. Attendance for last 7 days
    const days: string[] = [];
    const dayLabels: string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const labels: string[] = [];
    const presentCounts: number[] = [];
    const absentCounts: number[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      days.push(iso);
      labels.push(dayLabels[d.getDay()]);
    }

    let attRecords: any[] = [];
    if (siteIds.length > 0) {
      const { data } = await db.supabase.from('attendance').select('date, status').in('site_id', siteIds).gte('date', days[0]).lte('date', days[6]);
      attRecords = data || [];
    }

    days.forEach((day) => {
      const onDay = attRecords.filter((a: any) => a.date === day);
      presentCounts.push(onDay.filter((a: any) => a.status === 'present' || a.status === 'half-day').length);
      absentCounts.push(onDay.filter((a: any) => a.status === 'absent').length);
    });

    // 3. Payroll summaries
    const payrollRecords = await db.queryPayroll({ createdBy: user.id });
    const payrollLabels = payrollRecords.slice(0, 4).map((p: any) => `${p.startDate?.slice(5)} to ${p.endDate?.slice(5)}`);
    const payrollAmounts = payrollRecords.slice(0, 4).map((p: any) => p.totalGross || 0);

    return c.json({
      attendance: {
        labels: labels.length > 0 ? labels : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        present: presentCounts.length > 0 ? presentCounts : [0, 0, 0, 0, 0, 0, 0],
        absent: absentCounts.length > 0 ? absentCounts : [0, 0, 0, 0, 0, 0, 0],
      },
      payroll: {
        labels: payrollLabels.length > 0 ? payrollLabels : ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        amounts: payrollAmounts.length > 0 ? payrollAmounts : [0, 0, 0, 0],
      },
      workersBySkill: {
        labels: Object.keys(skillCounts),
        values: Object.values(skillCounts),
      },
    });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

Deno.serve(app.fetch);