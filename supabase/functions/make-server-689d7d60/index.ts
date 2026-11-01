import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import * as db from "./db.ts";

const app = new Hono();

app.use("/*", cors({ origin: "*", allowHeaders: ["Content-Type", "Authorization", "x-device-session-id"], allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], exposeHeaders: ["Content-Length"], maxAge: 600 }));

async function authUser(c: any) {
  const t = c.req.header('Authorization')?.split(' ')[1];
  if (!t) return null;
  const { data: { user }, error } = await db.supabase.auth.getUser(t);
  if (error || !user) return null;

  // Single-device session enforcement
  const clientSessionId = c.req.header('x-device-session-id');
  if (clientSessionId) {
    const { data: profile } = await db.supabase
      .from('profiles')
      .select('device_session_id')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.device_session_id && profile.device_session_id !== clientSessionId) {
      console.warn(`Device session mismatch for user ${user.id}: client=${clientSessionId}, db=${profile.device_session_id}`);
      return null; // Triggers 401 Unauthorized for previous device!
    }
  }

  return user;
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
    const { phone, password, name, email, role } = await c.req.json();
    if (!phone || !password || !name) {
      return c.json({ error: 'Mobile number, password, and name are required' }, 400);
    }
    const cleanPhone = phone.replace(/\D/g, '').slice(0, 10);
    if (cleanPhone.length !== 10) {
      return c.json({ error: 'Mobile number must be exactly 10 digits' }, 400);
    }
    if (password.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters long' }, 400);
    }

    // 1. Check phone uniqueness
    const existingPhone = await db.getProfileByPhone(cleanPhone);
    if (existingPhone) {
      return c.json({ error: 'Mobile number already registered' }, 400);
    }

    // 2. Check email uniqueness if email is provided
    let cleanEmail = email ? email.trim().toLowerCase() : null;
    if (cleanEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return c.json({ error: 'Invalid email format' }, 400);
      }
      const existingEmail = await db.getProfileByEmail(cleanEmail);
      if (existingEmail) {
        return c.json({ error: 'Email already registered' }, 400);
      }
    }

    const authEmail = cleanEmail || `${cleanPhone}@constlabour.com`;

    const { data: authData, error: authError } = await db.supabase.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: { name, role: role || 'contractor', phone: cleanPhone },
    });
    if (authError) throw authError;

    await db.upsertProfile({
      id: authData.user.id,
      phone: cleanPhone,
      email: cleanEmail,
      name,
      role: role || 'contractor',
      createdAt: new Date().toISOString(),
    });

    return c.json({ success: true, userId: authData.user.id });
  } catch (e: any) {
    return c.json({ error: e.message || 'Registration failed' }, 400);
  }
});

// LOGIN WITH PHONE & PASSWORD
app.post("/make-server-689d7d60/auth/login-phone", async (c) => {
  try {
    const { phone, password, deviceSessionId } = await c.req.json();
    if (!phone || !password) {
      return c.json({ error: 'Mobile number and password are required' }, 400);
    }
    const cleanPhone = phone.replace(/\D/g, '').slice(0, 10);
    if (cleanPhone.length !== 10) {
      return c.json({ error: 'Please enter a valid 10-digit mobile number' }, 400);
    }

    const profile = await db.getProfileByPhone(cleanPhone);
    if (!profile) {
      return c.json({ error: 'Mobile number not registered' }, 404);
    }

    let authEmail = profile.email;
    if (!authEmail) {
      const { data: authUserData } = await db.supabase.auth.admin.getUserById(profile.id);
      authEmail = authUserData?.user?.email || `${cleanPhone}@constlabour.com`;
    }

    const { data: signInData, error: signInError } = await db.supabase.auth.signInWithPassword({
      email: authEmail,
      password,
    });

    if (signInError) {
      return c.json({ error: 'Incorrect password. Please try again or login with OTP.' }, 401);
    }

    if (deviceSessionId) {
      await db.supabase.from('profiles').update({ device_session_id: deviceSessionId }).eq('id', profile.id);
      profile.deviceSessionId = deviceSessionId;
    }

    return c.json({
      success: true,
      session: signInData.session,
      profile,
    });
  } catch (e: any) {
    return c.json({ error: e.message || 'Login failed' }, 500);
  }
});

// REQUEST OTP (DISABLED FOR SECURITY)
app.post("/make-server-689d7d60/auth/request-otp", async (c) => {
  return c.json({ error: 'OTP login is temporarily disabled. Please log in using your mobile number and password.' }, 403);
});

// VERIFY OTP & SIGN IN (DISABLED FOR SECURITY)
app.post("/make-server-689d7d60/auth/verify-otp", async (c) => {
  return c.json({ error: 'OTP login is temporarily disabled. Please log in using your mobile number and password.' }, 403);
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

app.put("/make-server-689d7d60/auth/profile", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const body = await c.req.json();
    let profile = await db.getProfile(user.id);
    if (!profile) {
      profile = { id: user.id, email: user.email, role: 'contractor', name: user.email };
    }

    if (body.name !== undefined) profile.name = String(body.name).trim();
    if (body.deviceSessionId !== undefined) profile.deviceSessionId = body.deviceSessionId;
    if (body.email !== undefined && String(body.email).trim()) {
      profile.email = String(body.email).trim().toLowerCase();
    }
    // Mobile number is strictly non-editable as required by user

    await db.upsertProfile(profile);
    return c.json({ success: true, profile });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// WORKERS
app.post("/make-server-689d7d60/workers", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const contractorId = await getContractorId(user.id);
    const body = await c.req.json();

    if (!body.name || !body.phone) {
      return c.json({ error: 'Worker name and mobile number are required' }, 400);
    }
    const cleanPhone = body.phone.replace(/\D/g, '').slice(0, 10);
    if (cleanPhone.length !== 10) {
      return c.json({ error: 'Mobile number must be exactly 10 digits' }, 400);
    }

    // Check phone uniqueness
    const existingPhone = await db.getProfileByPhone(cleanPhone);
    if (existingPhone) {
      return c.json({ error: 'Mobile number already registered' }, 400);
    }

    // Check email uniqueness if email provided
    let cleanEmail = body.email ? body.email.trim().toLowerCase() : null;
    if (cleanEmail) {
      const existingEmail = await db.getProfileByEmail(cleanEmail);
      if (existingEmail) {
        return c.json({ error: 'Email already registered' }, 400);
      }
    }

    const authEmail = cleanEmail || `${cleanPhone}@constlabour.com`;
    const password = body.password || 'worker123';

    const { data: authData, error: authError } = await db.supabase.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: { name: body.name, role: 'labour', phone: cleanPhone },
    });
    if (authError) return c.json({ error: authError.message }, 400);

    const worker = {
      id: authData.user.id,
      contractorId,
      name: body.name,
      email: cleanEmail,
      phone: cleanPhone,
      aadhaarHash: body.aadhaar ? hashAadhaar(body.aadhaar) : null,
      bankDetails: body.bankDetails || {},
      skillLevel: body.skillLevel || 'unskilled',
      dailyWage: body.dailyWage || 0,
      overtimeRate: body.overtimeRate !== undefined ? Number(body.overtimeRate) : 100,
      messCharge: body.messCharge || 0,
      siteId: body.siteId || null,
      status: 'active',
      role: 'labour',
      upiId: body.upiId || body.upi_id || null,
      createdAt: new Date().toISOString(),
    };
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

    let cleanPhone = worker.phone;
    if (body.phone) {
      cleanPhone = body.phone.replace(/\D/g, '').slice(0, 10);
      if (cleanPhone.length !== 10) {
        return c.json({ error: 'Mobile number must be exactly 10 digits' }, 400);
      }
      const existingPhone = await db.getProfileByPhone(cleanPhone);
      if (existingPhone && existingPhone.id !== workerId) {
        return c.json({ error: 'Mobile number already registered to another user' }, 400);
      }
    }

    let cleanEmail = worker.email;
    if (body.email !== undefined) {
      cleanEmail = body.email ? body.email.trim().toLowerCase() : null;
      if (cleanEmail) {
        const existingEmail = await db.getProfileByEmail(cleanEmail);
        if (existingEmail && existingEmail.id !== workerId) {
          return c.json({ error: 'Email already registered to another user' }, 400);
        }
      }
    }

    if (body.password) {
      const { error } = await db.supabase.auth.admin.updateUserById(workerId, { password: body.password });
      if (error) return c.json({ error: 'Failed to update password' }, 400);
    }
    const updated = {
      ...worker,
      name: body.name || worker.name,
      email: cleanEmail,
      phone: cleanPhone,
      aadhaarHash: body.aadhaar ? hashAadhaar(body.aadhaar) : worker.aadhaarHash,
      bankDetails: body.bankDetails || worker.bankDetails,
      skillLevel: body.skillLevel || worker.skillLevel,
      dailyWage: body.dailyWage !== undefined ? body.dailyWage : worker.dailyWage,
      overtimeRate: body.overtimeRate !== undefined ? Number(body.overtimeRate) : (worker.overtimeRate !== undefined ? worker.overtimeRate : 100),
      messCharge: body.messCharge !== undefined ? body.messCharge : worker.messCharge,
      siteId: body.siteId !== undefined ? body.siteId : worker.siteId,
      status: body.status || worker.status,
      upiId: body.upiId !== undefined ? body.upiId : (body.upi_id !== undefined ? body.upi_id : worker.upiId),
      updatedAt: new Date().toISOString(),
    };
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

    if (!body.name || !body.phone) {
      return c.json({ error: 'Foreman name and mobile number are required' }, 400);
    }
    const cleanPhone = body.phone.replace(/\D/g, '').slice(0, 10);
    if (cleanPhone.length !== 10) {
      return c.json({ error: 'Mobile number must be exactly 10 digits' }, 400);
    }

    // Check phone uniqueness
    const existingPhone = await db.getProfileByPhone(cleanPhone);
    if (existingPhone) {
      return c.json({ error: 'Mobile number already registered' }, 400);
    }

    // Check email uniqueness if email provided
    let cleanEmail = body.email ? body.email.trim().toLowerCase() : null;
    if (cleanEmail) {
      const existingEmail = await db.getProfileByEmail(cleanEmail);
      if (existingEmail) {
        return c.json({ error: 'Email already registered' }, 400);
      }
    }

    const authEmail = cleanEmail || `${cleanPhone}@constlabour.com`;
    const password = body.password || 'foreman123';

    const { data: authData, error: authError } = await db.supabase.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: { name: body.name, role: 'foreman', phone: cleanPhone },
    });
    if (authError) return c.json({ error: authError.message }, 400);

    const foreman = {
      id: authData.user.id,
      contractorId,
      name: body.name,
      phone: cleanPhone,
      email: cleanEmail,
      role: 'foreman',
      siteId: body.siteId || null,
      createdAt: new Date().toISOString(),
    };
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

    let cleanPhone = foreman.phone;
    if (body.phone) {
      cleanPhone = body.phone.replace(/\D/g, '').slice(0, 10);
      if (cleanPhone.length !== 10) {
        return c.json({ error: 'Mobile number must be exactly 10 digits' }, 400);
      }
      const existingPhone = await db.getProfileByPhone(cleanPhone);
      if (existingPhone && existingPhone.id !== foremanId) {
        return c.json({ error: 'Mobile number already registered to another user' }, 400);
      }
    }

    let cleanEmail = foreman.email;
    if (body.email !== undefined) {
      cleanEmail = body.email ? body.email.trim().toLowerCase() : null;
      if (cleanEmail) {
        const existingEmail = await db.getProfileByEmail(cleanEmail);
        if (existingEmail && existingEmail.id !== foremanId) {
          return c.json({ error: 'Email already registered to another user' }, 400);
        }
      }
    }

    if (body.password) {
      const { error } = await db.supabase.auth.admin.updateUserById(foremanId, { password: body.password });
      if (error) return c.json({ error: 'Failed to update password' }, 400);
    }
    const updated = {
      ...foreman,
      name: body.name || foreman.name,
      phone: cleanPhone,
      email: cleanEmail,
      siteId: body.siteId !== undefined ? body.siteId : foreman.siteId,
      updatedAt: new Date().toISOString(),
    };
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
    const normShift = db.normalizeShift(body.shift);
    const existing = await db.findExistingAttendance(body.workerId, body.siteId, body.date, normShift);

    // Compute wage & payments if missing or 0
    let dailyWage = body.dailyWage !== undefined && body.dailyWage !== null ? Number(body.dailyWage) : (existing?.dailyWage !== undefined ? Number(existing.dailyWage) : undefined);
    let overtimeRate = body.overtimeRate !== undefined && body.overtimeRate !== null ? Number(body.overtimeRate) : (existing?.overtimeRate !== undefined ? Number(existing.overtimeRate) : undefined);

    if (dailyWage === undefined || dailyWage === 0 || overtimeRate === undefined) {
      const workerProfile = await db.getProfile(body.workerId || existing?.workerId);
      if (dailyWage === undefined || dailyWage === 0) dailyWage = Number(workerProfile?.dailyWage || 0);
      if (overtimeRate === undefined) overtimeRate = Number(workerProfile?.overtimeRate || 100);
    }

    const otHours = Number(body.overtimeHours ?? existing?.overtimeHours ?? 0);
    const otRate = Number(overtimeRate || 100);
    const otPayment = body.overtimePayment !== undefined && body.overtimePayment !== null
      ? Number(body.overtimePayment)
      : (existing?.overtimePayment !== undefined ? Number(existing.overtimePayment) : Math.round(otHours * otRate));

    let rawStatus = ((body.status || existing?.status || 'present') as string).toLowerCase().trim();
    let status = rawStatus;
    if (status === 'overtime') status = 'present';
    if (status === 'half_day') status = 'half-day';

    let dailyPayment = body.dailyPayment !== undefined && body.dailyPayment !== null ? Number(body.dailyPayment) : undefined;
    if (dailyPayment === undefined) {
      if (rawStatus === 'present' || rawStatus === 'overtime') {
        dailyPayment = dailyWage;
      } else if (rawStatus === 'half-day' || rawStatus === 'half_day') {
        dailyPayment = Math.round(dailyWage / 2);
      } else {
        dailyPayment = 0;
      }
    }

    const totalPayment = body.totalPayment !== undefined && body.totalPayment !== null
      ? Number(body.totalPayment)
      : (dailyPayment + otPayment);

    const record = {
      id: existing ? existing.id : crypto.randomUUID(),
      ...body,
      status,
      shift: normShift,
      dailyWage,
      overtimeRate: otRate,
      overtimeHours: otHours,
      overtimePayment: otPayment,
      dailyPayment,
      totalPayment,
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
    const existing = await db.getAttendanceById(id);
    if (!existing) return c.json({ error: 'Not found' }, 404);

    let dailyWage = body.dailyWage !== undefined && body.dailyWage !== null ? Number(body.dailyWage) : (existing.dailyWage || undefined);
    let overtimeRate = body.overtimeRate !== undefined && body.overtimeRate !== null ? Number(body.overtimeRate) : (existing.overtimeRate || undefined);

    if (dailyWage === undefined || dailyWage === 0 || overtimeRate === undefined) {
      const workerProfile = await db.getProfile(body.workerId || existing.workerId);
      if (dailyWage === undefined || dailyWage === 0) dailyWage = Number(workerProfile?.dailyWage || 0);
      if (overtimeRate === undefined) overtimeRate = Number(workerProfile?.overtimeRate || 100);
    }

    const otHours = Number(body.overtimeHours ?? existing.overtimeHours ?? 0);
    const otRate = Number(overtimeRate || 100);
    const otPayment = body.overtimePayment !== undefined && body.overtimePayment !== null
      ? Number(body.overtimePayment)
      : (existing.overtimePayment !== undefined ? Number(existing.overtimePayment) : Math.round(otHours * otRate));

    let rawStatus = ((body.status || existing.status || 'present') as string).toLowerCase().trim();
    let status = rawStatus;
    if (status === 'overtime') status = 'present';
    if (status === 'half_day') status = 'half-day';

    let dailyPayment = body.dailyPayment !== undefined && body.dailyPayment !== null ? Number(body.dailyPayment) : undefined;
    if (dailyPayment === undefined) {
      if (rawStatus === 'present' || rawStatus === 'overtime') {
        dailyPayment = dailyWage;
      } else if (rawStatus === 'half-day' || rawStatus === 'half_day') {
        dailyPayment = Math.round(dailyWage / 2);
      } else {
        dailyPayment = 0;
      }
    }

    const totalPayment = body.totalPayment !== undefined && body.totalPayment !== null
      ? Number(body.totalPayment)
      : (dailyPayment + otPayment);

    const shift = body.shift !== undefined ? db.normalizeShift(body.shift) : existing.shift;

    const updated = {
      ...existing,
      ...body,
      status,
      shift,
      dailyWage,
      overtimeRate: otRate,
      overtimeHours: otHours,
      overtimePayment: otPayment,
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
    const allowedStatuses = ['pending', 'deducted', 'cancelled'];
    const safeStatus = allowedStatuses.includes(body.status) ? body.status : 'pending';
    const record = { id: crypto.randomUUID(), ...body, status: safeStatus, givenBy: user.id, createdAt: new Date().toISOString() };
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

app.put("/make-server-689d7d60/advances/:id", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    const body = await c.req.json();
    await db.updateAdvance(id, {
      amount: body.amount !== undefined ? Number(body.amount) : undefined,
      reason: body.reason !== undefined ? body.reason : undefined,
      status: body.status !== undefined ? body.status : undefined,
      date: body.date !== undefined ? body.date : undefined,
    });
    return c.json({ success: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.delete("/make-server-689d7d60/advances/:id", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    await db.deleteAdvance(id);
    return c.json({ success: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// PAYMENTS & DISBURSALS
app.post("/make-server-689d7d60/payments", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const body = await c.req.json();
    const record = {
      id: crypto.randomUUID(),
      workerId: body.workerId,
      amount: Number(body.amount || 0),
      paymentMethod: body.paymentMethod || 'UPI',
      transactionRef: body.transactionRef || '',
      date: body.date || new Date().toISOString().split('T')[0],
      payrollId: body.payrollId || null,
      notes: body.notes || '',
      status: 'completed',
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };
    await db.insertPayment(record);
    return c.json({ success: true, payment: record });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.get("/make-server-689d7d60/payments", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const workerId = c.req.query('workerId');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const records = await db.queryPayments({ workerId, createdBy: user.id, startDate, endDate });
    return c.json({ payments: records });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.delete("/make-server-689d7d60/payments/:id", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { error } = await db.supabase.from('payments').delete().eq('id', c.req.param('id'));
    if (error) throw error;
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
    const siteIdParam = c.req.query('siteId');

    const allSites = await db.getSitesByContractor(contractorId!);
    const activeSites = allSites.filter((s: any) => s.status === 'active');
    const siteIds = allSites.map((s: any) => s.id);

    // Fetch workers for contractor
    let allWorkers = await db.getWorkersByContractor(contractorId!);

    // Also include any workers assigned to contractor's sites
    if (siteIds.length > 0) {
      const { data: siteWorkers } = await db.supabase
        .from('profiles')
        .select('id, name, phone, daily_wage, role, site_id, contractor_id, skill_level')
        .eq('role', 'labour')
        .in('site_id', siteIds);
      if (siteWorkers && siteWorkers.length > 0) {
        const existingIds = new Set(allWorkers.map((w: any) => w.id));
        for (const sw of siteWorkers) {
          if (!existingIds.has(sw.id)) {
            allWorkers.push(db.mapProfile(sw));
            existingIds.add(sw.id);
          }
        }
      }
    }

    // Filter by siteId if provided and not 'all'
    let relevantWorkers = allWorkers;
    let relevantSiteIds = siteIds;
    if (siteIdParam && siteIdParam !== 'all') {
      relevantWorkers = allWorkers.filter((w: any) => w.siteId === siteIdParam);
      relevantSiteIds = [siteIdParam];
    }

    const totalWorkers = relevantWorkers.length;
    const workerIds = relevantWorkers.map((w: any) => w.id);

    // Current date in IST (Asia/Kolkata)
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

    let presentToday = 0;
    let halfDayToday = 0;
    let absentToday = 0;
    let totalWagesToday = 0;

    if (relevantSiteIds.length > 0 || workerIds.length > 0) {
      let q = db.supabase
        .from('attendance')
        .select('worker_id, status, daily_payment, total_payment, daily_wage')
        .eq('date', today);

      if (relevantSiteIds.length > 0 && workerIds.length > 0) {
        q = q.or(`site_id.in.(${relevantSiteIds.join(',')}),worker_id.in.(${workerIds.join(',')})`);
      } else if (relevantSiteIds.length > 0) {
        q = q.in('site_id', relevantSiteIds);
      } else if (workerIds.length > 0) {
        q = q.in('worker_id', workerIds);
      }

      const { data: todayAtt } = await q;

      if (todayAtt && todayAtt.length > 0) {
        const workerAttendanceMap = new Map<string, any>();
        for (const record of todayAtt) {
          if (workerIds.length > 0 && !workerIds.includes(record.worker_id)) {
            continue;
          }
          workerAttendanceMap.set(record.worker_id, record);
        }

        for (const record of workerAttendanceMap.values()) {
          const status = (record.status || '').toLowerCase();
          const workerObj = relevantWorkers.find((w: any) => w.id === record.worker_id);
          const workerDailyWage = Number(workerObj?.dailyWage || record.daily_wage || 0);

          let payment = Number(record.total_payment || record.daily_payment || 0);
          if (payment === 0) {
            if (status === 'present' || status === 'overtime') {
              payment = workerDailyWage;
            } else if (status === 'half-day' || status === 'half_day') {
              payment = Math.round(workerDailyWage / 2);
            }
          }

          if (status === 'present' || status === 'overtime') {
            presentToday++;
            totalWagesToday += payment;
          } else if (status === 'half-day' || status === 'half_day') {
            halfDayToday++;
            totalWagesToday += payment;
          } else if (status === 'absent') {
            absentToday++;
          }
        }
      }
    }

    const markedCount = presentToday + halfDayToday + absentToday;
    const unmarkedToday = Math.max(0, totalWorkers - markedCount);
    const turnoutPercentage = totalWorkers > 0
      ? Math.round(((presentToday + (halfDayToday * 0.5)) / totalWorkers) * 100)
      : 0;

    return c.json({
      stats: {
        totalWorkers,
        activeWorkers: totalWorkers,
        presentToday,
        halfDayToday,
        absentToday,
        unmarkedToday,
        totalSites: allSites.length,
        activeSites: activeSites.length,
        totalWagesToday: Math.round(totalWagesToday),
        turnoutPercentage,
        date: today,
        siteId: siteIdParam || 'all'
      },
      sites: allSites
    });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// ADDITIONAL MISSING ROUTES
app.get("/make-server-689d7d60/foreman/stats", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data: sites } = await db.supabase.from('sites').select('id, name').eq('foreman_id', user.id);
    const assignedSites = sites?.length || 0;
    const siteIds = sites?.map((s: any) => s.id) || [];
    const siteName = sites?.[0]?.name || 'Assigned Site';

    let assignedWorkersCount = 0;
    if (siteIds.length > 0) {
      const { count } = await db.supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'labour').in('site_id', siteIds);
      assignedWorkersCount = count || 0;
    }
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    let presentToday = 0;
    let halfDayToday = 0;
    let absentToday = 0;
    let totalWagesToday = 0;

    if (siteIds.length > 0) {
      const { data: att } = await db.supabase.from('attendance').select('status, daily_wage, total_payment, daily_payment').in('site_id', siteIds).eq('date', today);
      if (att) {
        for (const a of att) {
          const status = (a.status || '').toLowerCase();
          const baseWage = Number(a.daily_wage || 0);
          let payment = Number(a.total_payment || a.daily_payment || 0);
          if (payment === 0 && baseWage > 0) {
            payment = (status === 'present' || status === 'overtime') ? baseWage : (status === 'half-day' || status === 'half_day') ? Math.round(baseWage / 2) : 0;
          }
          if (status === 'present' || status === 'overtime') {
            presentToday++;
            totalWagesToday += payment;
          } else if (status === 'half-day' || status === 'half_day') {
            halfDayToday++;
            totalWagesToday += payment;
          } else if (status === 'absent') {
            absentToday++;
          }
        }
      }
    }
    const unmarkedToday = Math.max(0, assignedWorkersCount - (presentToday + halfDayToday + absentToday));
    const turnoutPercentage = assignedWorkersCount > 0
      ? Math.round(((presentToday + (halfDayToday * 0.5)) / assignedWorkersCount) * 100)
      : 0;

    return c.json({
      stats: {
        assignedWorkers: assignedWorkersCount,
        assignedSites,
        presentToday,
        halfDayToday,
        absentToday,
        unmarkedToday,
        totalWagesToday: Math.round(totalWagesToday),
        turnoutPercentage,
        siteName,
        date: today
      }
    });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.get("/make-server-689d7d60/worker/stats", async (c) => {
  try {
    const user = await authUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data: att } = await db.supabase.from('attendance').select('status, total_payment, date').eq('worker_id', user.id);
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
    let q = db.supabase.from('attendance').select('worker_id, total_payment, date').gte('date', startDate).lte('date', endDate);
    if (siteId) {
      q = q.eq('site_id', siteId);
    } else {
      const contractorId = await getContractorId(user.id);
      const sites = await db.getSitesByContractor(contractorId!);
      const siteIds = sites.map((s: any) => s.id);
      if (siteIds.length > 0) q = q.in('site_id', siteIds);
    }
    const { data: att } = await q;
    const totalGross = (att || []).reduce((sum: number, a: any) => sum + Number(a.total_payment || 0), 0);
    const record = {
      id: crypto.randomUUID(),
      siteId: siteId || null,
      startDate,
      endDate,
      items: [],
      totalGross,
      totalNet: totalGross,
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