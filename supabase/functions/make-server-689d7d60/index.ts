import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const app = new Hono();

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Helper function to get or create user profile
async function getUserProfile(userId: string, userEmail: string, userMetadata: any) {
  let userProfile = await kv.get(`user:${userId}`);
  
  if (!userProfile) {
    console.log(`User profile not found for ${userId}, creating from auth metadata`);
    userProfile = {
      id: userId,
      email: userEmail,
      name: userMetadata?.name || userEmail,
      role: userMetadata?.role || 'contractor',
      createdAt: new Date().toISOString(),
    };
    await kv.set(`user:${userId}`, userProfile);
  }
  
  return userProfile;
}

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-689d7d60/health", (c) => {
  return c.json({ status: "ok" });
});

// ============================================
// AUTH ROUTES
// ============================================

// Register new contractor
app.post("/make-server-689d7d60/auth/register", async (c) => {
  try {
    const { email, password, name, role } = await c.req.json();

    if (!email || !password || !name) {
      return c.json({ error: 'Email, password, and name are required' }, 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({ error: 'Invalid email format' }, 400);
    }

    // Validate password length
    if (password.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters long' }, 400);
    }

    // Check if user already exists
    const existingUser = await kv.getByPrefix(`user:`);
    const userExists = existingUser.some((u: any) => u.email === email);
    if (userExists) {
      return c.json({ error: 'User with this email already exists' }, 400);
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm since email server not configured
      user_metadata: { name, role: role || 'contractor' },
    });

    if (authError) {
      console.error('Supabase auth error:', authError);
      throw authError;
    }

    // Store user profile
    await kv.set(`user:${authData.user.id}`, {
      id: authData.user.id,
      email,
      name,
      role: role || 'contractor',
      createdAt: new Date().toISOString(),
    });

    console.log('User registered successfully:', email);
    return c.json({ success: true, userId: authData.user.id });
  } catch (error: any) {
    console.error('Registration error:', error);
    return c.json({ error: error.message || 'Registration failed' }, 400);
  }
});

// Get user profile
app.get("/make-server-689d7d60/auth/profile", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await kv.get(`user:${user.id}`);
    return c.json({ user: userProfile || { id: user.id, email: user.email, role: 'contractor', name: user.email } });
  } catch (error: any) {
    console.error('Profile fetch error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// WORKER ROUTES
// ============================================

// Create worker
app.post("/make-server-689d7d60/workers", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const userProfile = await kv.get(`user:${user.id}`);
    const contractorId = userProfile.role === 'contractor' ? user.id : userProfile.contractorId;

    const body = await c.req.json();
    
    // Check if email already exists
    const existingUsers = await kv.getByPrefix(`user:`);
    const emailExists = existingUsers.some((u: any) => u.email === body.email);
    if (emailExists) {
      return c.json({ error: 'Email already exists' }, 400);
    }

    // Create user in Supabase Auth for worker
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { name: body.name, role: 'labour' },
    });

    if (authError) {
      console.error('Supabase auth error:', authError);
      return c.json({ error: authError.message }, 400);
    }

    const workerId = authData.user.id;
    
    const worker = {
      id: workerId,
      contractorId,
      name: body.name,
      email: body.email,
      phone: body.phone,
      aadhaarHash: body.aadhaar ? hashAadhaar(body.aadhaar) : null,
      bankDetails: body.bankDetails || {},
      skillLevel: body.skillLevel || 'unskilled',
      dailyWage: body.dailyWage || 0,
      messCharge: body.messCharge || 0,
      siteId: body.siteId || null,
      status: 'active',
      role: 'labour',
      createdAt: new Date().toISOString(),
    };

    await kv.set(`user:${workerId}`, worker);

    return c.json({ success: true, worker });
  } catch (error: any) {
    console.error('Worker creation error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get all workers for contractor
app.get("/make-server-689d7d60/workers", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const userProfile = await getUserProfile(user.id, user.email!, user.user_metadata);
    const contractorId = userProfile.role === 'contractor' ? user.id : userProfile.contractorId;

    const workers = await kv.getByPrefix(`user:`);
    const contractorWorkers = workers.filter((w: any) => w.contractorId === contractorId && w.role === 'labour');

    return c.json({ workers: contractorWorkers });
  } catch (error: any) {
    console.error('Workers fetch error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Update worker
app.put("/make-server-689d7d60/workers/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const workerId = c.req.param('id');
    const body = await c.req.json();
    
    const worker = await kv.get(`user:${workerId}`);
    if (!worker) return c.json({ error: 'Worker not found' }, 404);

    // Update auth if password is provided
    if (body.password) {
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        workerId,
        { password: body.password }
      );
      if (updateError) {
        console.error('Password update error:', updateError);
        return c.json({ error: 'Failed to update password' }, 400);
      }
    }

    const updatedWorker = { 
      ...worker, 
      name: body.name || worker.name,
      email: body.email || worker.email,
      phone: body.phone || worker.phone,
      aadhaarHash: body.aadhaar ? hashAadhaar(body.aadhaar) : worker.aadhaarHash,
      bankDetails: body.bankDetails || worker.bankDetails,
      skillLevel: body.skillLevel || worker.skillLevel,
      dailyWage: body.dailyWage !== undefined ? body.dailyWage : worker.dailyWage,
      messCharge: body.messCharge !== undefined ? body.messCharge : worker.messCharge,
      siteId: body.siteId !== undefined ? body.siteId : worker.siteId,
      status: body.status || worker.status,
      updatedAt: new Date().toISOString() 
    };
    await kv.set(`user:${workerId}`, updatedWorker);

    return c.json({ success: true, worker: updatedWorker });
  } catch (error: any) {
    console.error('Worker update error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Delete worker
app.delete("/make-server-689d7d60/workers/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const workerId = c.req.param('id');
    
    const worker = await kv.get(`user:${workerId}`);
    if (!worker) return c.json({ error: 'Worker not found' }, 404);

    // Delete from Supabase Auth
    const { error: deleteError } = await supabase.auth.admin.deleteUser(workerId);
    if (deleteError) {
      console.error('Auth delete error:', deleteError);
    }

    // Delete from KV store
    await kv.del(`user:${workerId}`);

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Worker deletion error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// FOREMAN ROUTES
// ============================================

// Create foreman
app.post("/make-server-689d7d60/foremen", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const userProfile = await kv.get(`user:${user.id}`);
    const contractorId = userProfile.role === 'contractor' ? user.id : userProfile.contractorId;

    const body = await c.req.json();
    
    // Check if email already exists
    const existingUsers = await kv.getByPrefix(`user:`);
    const emailExists = existingUsers.some((u: any) => u.email === body.email);
    if (emailExists) {
      return c.json({ error: 'Email already exists' }, 400);
    }

    // Create user in Supabase Auth for foreman
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { name: body.name, role: 'foreman' },
    });

    if (authError) {
      console.error('Supabase auth error:', authError);
      return c.json({ error: authError.message }, 400);
    }

    const foremanId = authData.user.id;
    
    const foreman = {
      id: foremanId,
      contractorId,
      name: body.name,
      phone: body.phone,
      email: body.email,
      role: 'foreman',
      siteId: body.siteId || null,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`user:${foremanId}`, foreman);

    return c.json({ success: true, foreman });
  } catch (error: any) {
    console.error('Foreman creation error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get all foremen for contractor
app.get("/make-server-689d7d60/foremen", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const userProfile = await getUserProfile(user.id, user.email!, user.user_metadata);
    const contractorId = userProfile.role === 'contractor' ? user.id : userProfile.contractorId;

    // Get all users and filter foremen
    const users = await kv.getByPrefix(`user:`);
    const foremen = users.filter((u: any) => u.role === 'foreman' && u.contractorId === contractorId);

    // Get sites to add site names
    const sites = await kv.getByPrefix(`site:`);
    const foremenWithSites = foremen.map((foreman: any) => {
      const site = sites.find((s: any) => s.id === foreman.siteId);
      return {
        ...foreman,
        siteName: site ? site.name : null,
      };
    });

    return c.json({ foremen: foremenWithSites });
  } catch (error: any) {
    console.error('Foremen fetch error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Update foreman
app.put("/make-server-689d7d60/foremen/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const foremanId = c.req.param('id');
    const body = await c.req.json();
    
    const foreman = await kv.get(`user:${foremanId}`);
    if (!foreman) return c.json({ error: 'Foreman not found' }, 404);

    // Update auth if password is provided
    if (body.password) {
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        foremanId,
        { password: body.password }
      );
      if (updateError) {
        console.error('Password update error:', updateError);
        return c.json({ error: 'Failed to update password' }, 400);
      }
    }

    const updatedForeman = { 
      ...foreman, 
      name: body.name || foreman.name,
      phone: body.phone || foreman.phone,
      siteId: body.siteId !== undefined ? body.siteId : foreman.siteId,
      updatedAt: new Date().toISOString() 
    };
    await kv.set(`user:${foremanId}`, updatedForeman);

    return c.json({ success: true, foreman: updatedForeman });
  } catch (error: any) {
    console.error('Foreman update error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Delete foreman
app.delete("/make-server-689d7d60/foremen/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const foremanId = c.req.param('id');
    
    const foreman = await kv.get(`user:${foremanId}`);
    if (!foreman) return c.json({ error: 'Foreman not found' }, 404);

    // Delete from Supabase Auth
    const { error: deleteError } = await supabase.auth.admin.deleteUser(foremanId);
    if (deleteError) {
      console.error('Auth delete error:', deleteError);
    }

    // Delete from KV store
    await kv.del(`user:${foremanId}`);

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Foreman deletion error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// SITE ROUTES
// ============================================

// Create site
app.post("/make-server-689d7d60/sites", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const userProfile = await getUserProfile(user.id, user.email!, user.user_metadata);
    const contractorId = userProfile.role === 'contractor' ? user.id : userProfile.contractorId;

    const body = await c.req.json();
    const siteId = crypto.randomUUID();
    
    const site = {
      id: siteId,
      contractorId,
      name: body.name,
      address: body.address,
      startDate: body.startDate,
      endDate: body.endDate || null,
      foremanId: body.foremanId || null,
      geoFence: body.geoFence || null,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    await kv.set(`site:${siteId}`, site);
    await addToList(`contractor:${contractorId}:sites`, siteId);

    return c.json({ success: true, site });
  } catch (error: any) {
    console.error('Site creation error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get all sites for contractor
app.get("/make-server-689d7d60/sites", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const userProfile = await getUserProfile(user.id, user.email!, user.user_metadata);
    const contractorId = userProfile.role === 'contractor' ? user.id : userProfile.contractorId;

    const sites = await kv.getByPrefix(`site:`);
    const contractorSites = sites.filter((s: any) => s.contractorId === contractorId);

    return c.json({ sites: contractorSites });
  } catch (error: any) {
    console.error('Sites fetch error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Update site
app.put("/make-server-689d7d60/sites/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const siteId = c.req.param('id');
    const body = await c.req.json();
    
    const site = await kv.get(`site:${siteId}`);
    if (!site) return c.json({ error: 'Site not found' }, 404);

    const updatedSite = { ...site, ...body, updatedAt: new Date().toISOString() };
    await kv.set(`site:${siteId}`, updatedSite);

    return c.json({ success: true, site: updatedSite });
  } catch (error: any) {
    console.error('Site update error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Delete site
app.delete("/make-server-689d7d60/sites/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const siteId = c.req.param('id');
    
    const site = await kv.get(`site:${siteId}`);
    if (!site) return c.json({ error: 'Site not found' }, 404);

    // Delete the site
    await kv.del(`site:${siteId}`);

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Site deletion error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// ATTENDANCE ROUTES
// ============================================

// Mark attendance
app.post("/make-server-689d7d60/attendance", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    
    // Fetch worker details for wage calculation
    const worker = await kv.get(`user:${body.workerId}`);
    if (!worker) return c.json({ error: 'Worker not found' }, 404);

    // Check if attendance record already exists for this worker+site+date
    const allAttendance = await kv.getByPrefix(`attendance:`);
    const existingRecord = allAttendance.find((a: any) => 
      a.workerId === body.workerId && 
      a.siteId === body.siteId && 
      a.date === (body.date || new Date().toISOString().split('T')[0])
    );

    // Use existing ID or create new one
    const attendanceId = existingRecord?.id || crypto.randomUUID();
    
    // Calculate work hours, overtime, and payment
    let workHours = 0;
    let regularHours = 0;
    let overtimeHours = 0;
    let breakHours = 0;
    let netWorkHours = 0;
    let status = body.status || 'present';
    let dailyPayment = 0;
    let overtimePayment = 0;
    let totalPayment = 0;

    // If check-in and check-out are provided, calculate automatically
    if (body.checkIn && body.checkOut) {
      const checkIn = new Date(`2000-01-01T${body.checkIn}`);
      const checkOut = new Date(`2000-01-01T${body.checkOut}`);
      
      // Calculate total hours
      workHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
      
      // Calculate break hours if provided
      if (body.breakStart && body.breakEnd) {
        const breakStart = new Date(`2000-01-01T${body.breakStart}`);
        const breakEnd = new Date(`2000-01-01T${body.breakEnd}`);
        breakHours = (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60 * 60);
      }
      
      // Net work hours (excluding break)
      netWorkHours = Math.max(0, workHours - breakHours);
      
      // Auto-detect status based on hours worked
      if (netWorkHours >= 8) {
        status = 'present'; // Full day
        regularHours = 8;
        overtimeHours = netWorkHours - 8;
      } else if (netWorkHours >= 4) {
        status = 'half-day'; // Half day (4-8 hours)
        regularHours = netWorkHours;
        overtimeHours = 0;
      } else if (netWorkHours > 0) {
        status = 'half-day'; // Less than 4 hours still counts as half day
        regularHours = netWorkHours;
        overtimeHours = 0;
      } else {
        status = 'absent';
        regularHours = 0;
        overtimeHours = 0;
      }
      
      // Calculate payment
      const hourlyRate = worker.dailyWage / 8; // Daily wage divided by 8 hours
      const overtimeRate = hourlyRate; // Same rate for overtime (1x, not 1.5x)
      
      dailyPayment = regularHours * hourlyRate;
      overtimePayment = overtimeHours * overtimeRate;
      totalPayment = dailyPayment + overtimePayment;
    } else {
      // Manual status marking without times
      if (status === 'present') {
        regularHours = 8;
        netWorkHours = 8;
        dailyPayment = worker.dailyWage;
        totalPayment = worker.dailyWage;
      } else if (status === 'half-day') {
        regularHours = 4;
        netWorkHours = 4;
        dailyPayment = worker.dailyWage * 0.5;
        totalPayment = worker.dailyWage * 0.5;
      } else {
        // absent
        regularHours = 0;
        netWorkHours = 0;
        dailyPayment = 0;
        totalPayment = 0;
      }
    }
    
    const attendance = {
      id: attendanceId,
      workerId: body.workerId,
      workerName: worker.name,
      siteId: body.siteId,
      date: body.date || new Date().toISOString().split('T')[0],
      checkIn: body.checkIn || null,
      checkOut: body.checkOut || null,
      breakStart: body.breakStart || null,
      breakEnd: body.breakEnd || null,
      status: status,
      totalHours: workHours,
      breakHours: breakHours,
      netWorkHours: netWorkHours,
      regularHours: regularHours,
      overtimeHours: overtimeHours,
      dailyWage: worker.dailyWage,
      hourlyRate: worker.dailyWage / 8,
      overtimeRate: (worker.dailyWage / 8) * 1.5,
      dailyPayment: dailyPayment,
      overtimePayment: overtimePayment,
      totalPayment: totalPayment,
      geoLocation: body.geoLocation || null,
      notes: body.notes || '',
      markedBy: user.id,
      createdAt: existingRecord?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`attendance:${attendanceId}`, attendance);
    
    // Only add to list if it's a new record
    if (!existingRecord) {
      await addToList(`worker:${body.workerId}:attendance`, attendanceId);
    }

    return c.json({ success: true, attendance });
  } catch (error: any) {
    console.error('Attendance marking error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get attendance records
app.get("/make-server-689d7d60/attendance", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const workerId = c.req.query('workerId');
    const siteId = c.req.query('siteId');
    const date = c.req.query('date');

    const allAttendance = await kv.getByPrefix(`attendance:`);
    let filtered = allAttendance;

    if (workerId) filtered = filtered.filter((a: any) => a.workerId === workerId);
    if (siteId) filtered = filtered.filter((a: any) => a.siteId === siteId);
    if (date) filtered = filtered.filter((a: any) => a.date === date);

    return c.json({ attendance: filtered });
  } catch (error: any) {
    console.error('Attendance fetch error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Delete attendance record (for reverting)
app.delete("/make-server-689d7d60/attendance/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const attendanceId = c.req.param('id');
    
    const attendance = await kv.get(`attendance:${attendanceId}`);
    if (!attendance) return c.json({ error: 'Attendance record not found' }, 404);

    // Delete the attendance record
    await kv.del(`attendance:${attendanceId}`);

    return c.json({ success: true, message: 'Attendance record deleted successfully' });
  } catch (error: any) {
    console.error('Attendance deletion error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Clear all attendance records (for testing/reset)
app.delete("/make-server-689d7d60/attendance/clear/all", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    // Only contractors can clear all attendance
    const userProfile = await kv.get(`user:${user.id}`);
    if (userProfile.role !== 'contractor') {
      return c.json({ error: 'Only contractors can clear all attendance records' }, 403);
    }

    // Get all attendance records
    const allAttendance = await kv.getByPrefix(`attendance:`);
    
    // Delete each attendance record
    let deletedCount = 0;
    for (const attendance of allAttendance) {
      await kv.del(`attendance:${attendance.id}`);
      deletedCount++;
    }

    console.log(`Cleared ${deletedCount} attendance records by user ${user.id}`);
    return c.json({ 
      success: true, 
      message: `Successfully cleared ${deletedCount} attendance records`,
      deletedCount 
    });
  } catch (error: any) {
    console.error('Clear all attendance error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Apply break hours to all workers on site for a specific date
app.post("/make-server-689d7d60/attendance/apply-break", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const { siteId, date, breakStart, breakEnd } = await c.req.json();

    if (!siteId || !date || !breakStart || !breakEnd) {
      return c.json({ error: 'siteId, date, breakStart, and breakEnd are required' }, 400);
    }

    // Get all attendance records for this site and date
    const allAttendance = await kv.getByPrefix(`attendance:`);
    const siteAttendance = allAttendance.filter((a: any) => 
      a.siteId === siteId && a.date === date
    );

    let updatedCount = 0;

    // Apply break to each attendance record
    for (const attendance of siteAttendance) {
      // Recalculate with new break times
      if (attendance.checkIn && attendance.checkOut) {
        const checkIn = new Date(`2000-01-01T${attendance.checkIn}`);
        const checkOut = new Date(`2000-01-01T${attendance.checkOut}`);
        const breakStartTime = new Date(`2000-01-01T${breakStart}`);
        const breakEndTime = new Date(`2000-01-01T${breakEnd}`);
        
        const totalHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
        const breakHours = (breakEndTime.getTime() - breakStartTime.getTime()) / (1000 * 60 * 60);
        const netWorkHours = Math.max(0, totalHours - breakHours);
        
        // Auto-detect status
        let status = 'absent';
        let regularHours = 0;
        let overtimeHours = 0;
        
        if (netWorkHours >= 8) {
          status = 'present';
          regularHours = 8;
          overtimeHours = netWorkHours - 8;
        } else if (netWorkHours >= 4) {
          status = 'half-day';
          regularHours = netWorkHours;
          overtimeHours = 0;
        } else if (netWorkHours > 0) {
          status = 'half-day';
          regularHours = netWorkHours;
          overtimeHours = 0;
        }
        
        // Get worker for wage calculation
        const worker = await kv.get(`user:${attendance.workerId}`);
        const hourlyRate = worker.dailyWage / 8;
        const dailyPayment = regularHours * hourlyRate;
        const overtimePayment = overtimeHours * hourlyRate;
        const totalPayment = dailyPayment + overtimePayment;
        
        // Update attendance record
        const updatedAttendance = {
          ...attendance,
          breakStart,
          breakEnd,
          breakHours,
          totalHours,
          netWorkHours,
          regularHours,
          overtimeHours,
          status,
          dailyPayment,
          overtimePayment,
          totalPayment,
          updatedAt: new Date().toISOString(),
          updatedBy: user.id,
        };
        
        await kv.set(`attendance:${attendance.id}`, updatedAttendance);
        updatedCount++;
      }
    }

    return c.json({ 
      success: true, 
      message: `Break hours applied to ${updatedCount} attendance records`,
      updatedCount 
    });
  } catch (error: any) {
    console.error('Apply break hours error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// BULK ATTENDANCE ROUTE
// ============================================

// Create bulk attendance
app.post("/make-server-689d7d60/attendance/bulk", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const { records } = await c.req.json();

    if (!records || !Array.isArray(records)) {
      return c.json({ error: 'Records array is required' }, 400);
    }

    const savedRecords = [];
    for (const record of records) {
      const attendanceId = crypto.randomUUID();
      const attendance = {
        id: attendanceId,
        workerId: record.workerId,
        date: record.date,
        status: record.status,
        checkIn: record.checkIn || null,
        checkOut: record.checkOut || null,
        createdBy: user.id,
        createdAt: new Date().toISOString(),
      };

      await kv.set(`attendance:${attendanceId}`, attendance);
      await addToList(`worker:${record.workerId}:attendance`, attendanceId);
      savedRecords.push(attendance);
    }

    return c.json({ success: true, count: savedRecords.length });
  } catch (error: any) {
    console.error('Bulk attendance creation error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// REPORTS ROUTE
// ============================================

// Get reports
app.get("/make-server-689d7d60/reports", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const type = c.req.query('type') || 'summary';
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    // Fetch all attendance records
    const allAttendance = await kv.getByPrefix('attendance:');
    const filteredAttendance = allAttendance.filter((a: any) => {
      if (startDate && a.date < startDate) return false;
      if (endDate && a.date > endDate) return false;
      return true;
    });

    // Calculate attendance stats
    const presentDays = filteredAttendance.filter((a: any) => a.status === 'present').length;
    const absentDays = filteredAttendance.filter((a: any) => a.status === 'absent').length;
    const halfDays = filteredAttendance.filter((a: any) => a.status === 'half-day').length;
    const totalDays = filteredAttendance.length;
    const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

    // Fetch payroll records
    const allPayroll = await kv.getByPrefix('payroll:');
    const filteredPayroll = allPayroll.filter((p: any) => {
      if (startDate && p.startDate < startDate) return false;
      if (endDate && p.endDate > endDate) return false;
      return true;
    });
    const totalPaid = filteredPayroll.reduce((sum: number, p: any) => sum + (p.totalNet || 0), 0);

    // Fetch advances
    const allAdvances = await kv.getByPrefix('advance:');
    const totalAdvances = allAdvances.reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
    const pendingAdvances = allAdvances
      .filter((a: any) => a.status === 'pending')
      .reduce((sum: number, a: any) => sum + (a.amount || 0), 0);

    // Fetch workers
    const allUsers = await kv.getByPrefix('user:');
    const workers = allUsers.filter((u: any) => u.role === 'labour');
    const totalWorkers = workers.length;
    const activeWorkers = workers.filter((w: any) => !w.inactive).length;

    // Fetch sites
    const allSites = await kv.getByPrefix('site:');
    const totalSites = allSites.length;
    const activeSites = allSites.filter((s: any) => s.status === 'active').length;

    // Calculate worker-wise detailed report
    const workerDetails = workers.map((worker: any) => {
      const workerAttendance = filteredAttendance.filter((a: any) => a.workerId === worker.id);
      const workerPayroll = filteredPayroll.filter((p: any) => p.workerId === worker.id);
      const workerAdvances = allAdvances.filter((a: any) => a.workerId === worker.id);

      const presentCount = workerAttendance.filter((a: any) => a.status === 'present').length;
      const halfDayCount = workerAttendance.filter((a: any) => a.status === 'half-day').length;
      const absentCount = workerAttendance.filter((a: any) => a.status === 'absent').length;
      
      const totalRegularHours = workerAttendance.reduce((sum: number, a: any) => sum + (a.regularHours || 0), 0);
      const totalOvertimeHours = workerAttendance.reduce((sum: number, a: any) => sum + (a.overtimeHours || 0), 0);
      const totalBreakHours = workerAttendance.reduce((sum: number, a: any) => sum + (a.breakHours || 0), 0);
      
      const totalGrossPayment = workerAttendance.reduce((sum: number, a: any) => sum + (a.totalPayment || 0), 0);
      const totalDailyPayment = workerAttendance.reduce((sum: number, a: any) => sum + (a.dailyPayment || 0), 0);
      const totalOvertimePayment = workerAttendance.reduce((sum: number, a: any) => sum + (a.overtimePayment || 0), 0);
      
      const totalAdvancesAmount = workerAdvances.reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
      const pendingAdvancesAmount = workerAdvances
        .filter((a: any) => a.status === 'pending')
        .reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
      
      const totalMessCharges = workerAttendance.reduce((sum: number, a: any) => {
        // Calculate mess charges only for present and half-day
        if (a.status === 'present' || a.status === 'half-day') {
          return sum + (worker.messCharge || 0);
        }
        return sum;
      }, 0);

      const totalPayrollPaid = workerPayroll.reduce((sum: number, p: any) => sum + (p.totalNet || 0), 0);
      
      const netPayment = totalGrossPayment - totalMessCharges - pendingAdvancesAmount;

      return {
        workerId: worker.id,
        workerName: worker.name,
        workerPhone: worker.phone,
        dailyWage: worker.dailyWage || 0,
        messCharge: worker.messCharge || 0,
        presentDays: presentCount,
        halfDays: halfDayCount,
        absentDays: absentCount,
        totalAttendanceDays: workerAttendance.length,
        totalRegularHours: totalRegularHours.toFixed(2),
        totalOvertimeHours: totalOvertimeHours.toFixed(2),
        totalBreakHours: totalBreakHours.toFixed(2),
        totalDailyPayment: totalDailyPayment.toFixed(2),
        totalOvertimePayment: totalOvertimePayment.toFixed(2),
        totalGrossPayment: totalGrossPayment.toFixed(2),
        totalMessCharges: totalMessCharges.toFixed(2),
        totalAdvances: totalAdvancesAmount.toFixed(2),
        pendingAdvances: pendingAdvancesAmount.toFixed(2),
        netPayment: netPayment.toFixed(2),
        totalPayrollPaid: totalPayrollPaid.toFixed(2),
        attendanceDetails: workerAttendance.map((a: any) => ({
          date: a.date,
          status: a.status,
          checkIn: a.checkIn,
          checkOut: a.checkOut,
          regularHours: a.regularHours || 0,
          overtimeHours: a.overtimeHours || 0,
          breakHours: a.breakHours || 0,
          dailyPayment: a.dailyPayment || 0,
          overtimePayment: a.overtimePayment || 0,
          totalPayment: a.totalPayment || 0,
          messCharge: (a.status === 'present' || a.status === 'half-day') ? (worker.messCharge || 0) : 0,
        }))
      };
    });

    return c.json({
      attendanceReport: {
        totalDays,
        presentDays,
        absentDays,
        halfDays,
        attendanceRate,
      },
      payrollReport: {
        totalPaid,
        totalAdvances,
        pendingAdvances,
        netPayments: totalPaid - pendingAdvances,
        totalMessCharges: workerDetails.reduce((sum: number, w: any) => sum + parseFloat(w.totalMessCharges), 0),
      },
      workerStats: {
        totalWorkers,
        activeWorkers,
        inactiveWorkers: totalWorkers - activeWorkers,
      },
      siteStats: {
        totalSites,
        activeSites,
      },
      workerDetails,
      rawAttendance: filteredAttendance,
      rawPayroll: filteredPayroll,
    });
  } catch (error: any) {
    console.error('Reports generation error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// ADVANCE ROUTES
// ============================================

// Create advance
app.post("/make-server-689d7d60/advances", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    const advanceId = crypto.randomUUID();
    
    const advance = {
      id: advanceId,
      workerId: body.workerId,
      amount: body.amount,
      date: body.date || new Date().toISOString().split('T')[0],
      reason: body.reason || '',
      status: 'pending', // pending, deducted, cancelled
      givenBy: user.id,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`advance:${advanceId}`, advance);
    await addToList(`worker:${body.workerId}:advances`, advanceId);

    return c.json({ success: true, advance });
  } catch (error: any) {
    console.error('Advance creation error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get advances
app.get("/make-server-689d7d60/advances", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const workerId = c.req.query('workerId');
    const status = c.req.query('status');

    const allAdvances = await kv.getByPrefix(`advance:`);
    let filtered = allAdvances;

    if (workerId) filtered = filtered.filter((a: any) => a.workerId === workerId);
    if (status) filtered = filtered.filter((a: any) => a.status === status);

    return c.json({ advances: filtered });
  } catch (error: any) {
    console.error('Advances fetch error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// PAYROLL ROUTES
// ============================================

// Calculate payroll
app.post("/make-server-689d7d60/payroll/calculate", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const { siteId, startDate, endDate, workerIds } = await c.req.json();

    // Fetch attendance for date range
    const allAttendance = await kv.getByPrefix(`attendance:`);
    const relevantAttendance = allAttendance.filter((a: any) => 
      a.siteId === siteId && 
      a.date >= startDate && 
      a.date <= endDate &&
      (!workerIds || workerIds.includes(a.workerId))
    );

    // Group by worker
    const workerAttendance = relevantAttendance.reduce((acc: any, a: any) => {
      if (!acc[a.workerId]) acc[a.workerId] = [];
      acc[a.workerId].push(a);
      return acc;
    }, {});

    const payrollItems = [];

    for (const workerId in workerAttendance) {
      const worker = await kv.get(`user:${workerId}`);
      const attendance = workerAttendance[workerId];
      
      // Calculate days worked
      let daysWorked = 0;
      let totalHours = 0;
      let overtimeHours = 0;

      attendance.forEach((a: any) => {
        if (a.status === 'present') daysWorked += 1;
        else if (a.status === 'half-day') daysWorked += 0.5;
        
        totalHours += a.workHours || 0;
        overtimeHours += a.overtime || 0;
      });

      // Fetch production records
      const allProduction = await kv.getByPrefix(`production:`);
      const workerProduction = allProduction.filter((p: any) => 
        p.workerId === workerId && 
        p.date >= startDate && 
        p.date <= endDate
      );

      const pieceRateEarnings = workerProduction.reduce((sum: number, p: any) => 
        sum + (p.units * p.ratePerUnit), 0
      );

      // Fetch pending advances
      const allAdvances = await kv.getByPrefix(`advance:`);
      const pendingAdvances = allAdvances.filter((a: any) => 
        a.workerId === workerId && a.status === 'pending'
      );

      const totalAdvances = pendingAdvances.reduce((sum: number, a: any) => sum + a.amount, 0);

      // Calculate pay
      const dailyWageAmount = daysWorked * worker.dailyWage;
      const overtimePay = overtimeHours * (worker.dailyWage / 8) * 1.5; // 1.5x for overtime
      const grossPay = dailyWageAmount + overtimePay + pieceRateEarnings;
      const netPay = grossPay - totalAdvances;

      payrollItems.push({
        workerId,
        workerName: worker.name,
        daysWorked,
        totalHours,
        overtimeHours,
        dailyWage: worker.dailyWage,
        dailyWageAmount,
        overtimePay,
        pieceRateEarnings,
        grossPay,
        advances: totalAdvances,
        netPay,
        pendingAdvances: pendingAdvances.map((a: any) => a.id),
      });
    }

    return c.json({ payrollItems });
  } catch (error: any) {
    console.error('Payroll calculation error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Create payroll
app.post("/make-server-689d7d60/payroll", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    const payrollId = crypto.randomUUID();
    
    const payroll = {
      id: payrollId,
      siteId: body.siteId,
      startDate: body.startDate,
      endDate: body.endDate,
      items: body.items || [],
      totalGross: body.items.reduce((sum: number, i: any) => sum + i.grossPay, 0),
      totalNet: body.items.reduce((sum: number, i: any) => sum + i.netPay, 0),
      status: 'paid', // Contractor has full control, no approval needed
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`payroll:${payrollId}`, payroll);

    // Mark advances as deducted
    for (const item of body.items) {
      if (item.pendingAdvances) {
        for (const advanceId of item.pendingAdvances) {
          const advance = await kv.get(`advance:${advanceId}`);
          await kv.set(`advance:${advanceId}`, { ...advance, status: 'deducted', deductedAt: new Date().toISOString() });
        }
      }
    }

    return c.json({ success: true, payroll });
  } catch (error: any) {
    console.error('Payroll creation error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// PAYMENT ROUTES
// ============================================

// Create payment
app.post("/make-server-689d7d60/payments", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    const paymentId = crypto.randomUUID();
    
    const payment = {
      id: paymentId,
      workerId: body.workerId,
      amount: body.amount,
      paymentMethod: body.paymentMethod, // cash, bank, upi, cheque
      transactionRef: body.transactionRef || '',
      date: body.date || new Date().toISOString().split('T')[0],
      payrollId: body.payrollId || null,
      notes: body.notes || '',
      status: 'completed',
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`payment:${paymentId}`, payment);
    await addToList(`worker:${body.workerId}:payments`, paymentId);

    return c.json({ success: true, payment });
  } catch (error: any) {
    console.error('Payment creation error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// PRODUCTION ROUTES
// ============================================

// Record production
app.post("/make-server-689d7d60/production", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    const productionId = crypto.randomUUID();
    
    const production = {
      id: productionId,
      workerId: body.workerId,
      siteId: body.siteId,
      taskType: body.taskType,
      units: body.units,
      ratePerUnit: body.ratePerUnit,
      totalAmount: body.units * body.ratePerUnit,
      date: body.date || new Date().toISOString().split('T')[0],
      recordedBy: user.id,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`production:${productionId}`, production);
    await addToList(`worker:${body.workerId}:production`, productionId);

    return c.json({ success: true, production });
  } catch (error: any) {
    console.error('Production recording error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// DASHBOARD STATS
// ============================================

// Get dashboard statistics
app.get("/make-server-689d7d60/dashboard/stats", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const userProfile = await kv.get(`user:${user.id}`);
    const contractorId = userProfile.role === 'contractor' ? user.id : userProfile.contractorId;

    const workers = await kv.getByPrefix(`user:`);
    const contractorWorkers = workers.filter((w: any) => w.contractorId === contractorId && w.role === 'labour');
    
    const sites = await kv.getByPrefix(`site:`);
    const contractorSites = sites.filter((s: any) => s.contractorId === contractorId);
    
    const today = new Date().toISOString().split('T')[0];
    const allAttendance = await kv.getByPrefix(`attendance:`);
    const todayAttendance = allAttendance.filter((a: any) => a.date === today);

    const activeSites = contractorSites.filter((s: any) => s.status === 'active').length;
    const activeWorkers = contractorWorkers.filter((w: any) => w.status === 'active').length;
    const presentToday = todayAttendance.filter((a: any) => a.status === 'present').length;

    return c.json({ 
      stats: {
        totalWorkers: contractorWorkers.length,
        activeWorkers,
        totalSites: contractorSites.length,
        activeSites,
        presentToday,
        absentToday: activeWorkers - presentToday,
      }
    });
  } catch (error: any) {
    console.error('Dashboard stats error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get foreman dashboard stats
app.get("/make-server-689d7d60/foreman/stats", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const userProfile = await getUserProfile(user.id, user.email!, user.user_metadata);
    
    // Verify user is a foreman
    if (userProfile.role !== 'foreman') {
      return c.json({ error: 'Access denied. Foreman role required.' }, 403);
    }

    // Get sites assigned to this foreman
    const allSites = await kv.getByPrefix(`site:`);
    const foremanSites = allSites.filter((s: any) => s.foremanId === user.id);
    const siteIds = foremanSites.map((s: any) => s.id);

    // Get workers assigned to foreman's sites
    const allWorkers = await kv.getByPrefix(`user:`);
    const foremanWorkers = allWorkers.filter((w: any) => 
      w.role === 'labour' && siteIds.includes(w.siteId)
    );
    
    // Get today's attendance for foreman's workers
    const today = new Date().toISOString().split('T')[0];
    const allAttendance = await kv.getByPrefix(`attendance:`);
    const workerIds = foremanWorkers.map((w: any) => w.id);
    const todayAttendance = allAttendance.filter((a: any) => 
      a.date === today && workerIds.includes(a.workerId)
    );

    const presentToday = todayAttendance.filter((a: any) => a.status === 'present').length;
    const absentToday = todayAttendance.filter((a: any) => a.status === 'absent').length;

    return c.json({ 
      stats: {
        assignedWorkers: foremanWorkers.length,
        assignedSites: foremanSites.length,
        presentToday,
        absentToday,
      }
    });
  } catch (error: any) {
    console.error('Foreman stats error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get worker dashboard stats
app.get("/make-server-689d7d60/worker/stats", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const userProfile = await getUserProfile(user.id, user.email!, user.user_metadata);
    
    // Verify user is a worker
    if (userProfile.role !== 'labour') {
      return c.json({ error: 'Access denied. Worker role required.' }, 403);
    }

    // Get worker's attendance records
    const allAttendance = await kv.getByPrefix(`attendance:`);
    const workerAttendance = allAttendance.filter((a: any) => a.workerId === user.id);
    
    // Calculate stats
    const presentDays = workerAttendance.filter((a: any) => a.status === 'present').length;
    const absentDays = workerAttendance.filter((a: any) => a.status === 'absent').length;
    const totalDaysWorked = presentDays + absentDays;
    
    // Calculate earnings (daily wage * present days)
    const dailyWage = userProfile.dailyWage || 0;
    const messCharge = userProfile.messCharge || 0;
    const totalEarnings = presentDays * (dailyWage - messCharge);
    
    // Calculate this month's earnings
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const thisMonthAttendance = workerAttendance.filter((a: any) => {
      const date = new Date(a.date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear && a.status === 'present';
    });
    const thisMonthEarnings = thisMonthAttendance.length * (dailyWage - messCharge);
    
    // Get pending advances
    const allAdvances = await kv.getByPrefix(`advance:`);
    const workerAdvances = allAdvances.filter((a: any) => a.workerId === user.id && a.status === 'pending');
    const pendingAdvances = workerAdvances.reduce((sum: number, a: any) => sum + (a.amount || 0), 0);

    return c.json({ 
      stats: {
        totalDaysWorked,
        presentDays,
        absentDays,
        totalEarnings,
        thisMonthEarnings,
        pendingAdvances,
      }
    });
  } catch (error: any) {
    console.error('Worker stats error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get worker attendance history
app.get("/make-server-689d7d60/worker/attendance", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const userProfile = await getUserProfile(user.id, user.email!, user.user_metadata);
    
    // Verify user is a worker
    if (userProfile.role !== 'labour') {
      return c.json({ error: 'Access denied. Worker role required.' }, 403);
    }

    // Get query parameters
    const year = c.req.query('year');
    const month = c.req.query('month');

    // Get all attendance for this worker
    const allAttendance = await kv.getByPrefix(`attendance:`);
    let workerAttendance = allAttendance.filter((a: any) => a.workerId === user.id);

    // Filter by year and month if provided
    if (year && month) {
      const targetYear = parseInt(year);
      const targetMonth = parseInt(month) - 1; // JavaScript months are 0-indexed
      workerAttendance = workerAttendance.filter((a: any) => {
        const date = new Date(a.date);
        return date.getFullYear() === targetYear && date.getMonth() === targetMonth;
      });
    }

    // Sort by date (newest first)
    workerAttendance.sort((a: any, b: any) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    // Get site names
    const allSites = await kv.getByPrefix(`site:`);
    const attendance = workerAttendance.map((a: any) => {
      const site = allSites.find((s: any) => s.id === a.siteId);
      return {
        ...a,
        siteName: site?.name,
      };
    });

    return c.json({ attendance });
  } catch (error: any) {
    console.error('Worker attendance error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// AGREEMENT MANAGEMENT
// ============================================

// Get active agreement for contractor
app.get("/make-server-689d7d60/agreement", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const userProfile = await kv.get(`user:${user.id}`);
    const contractorId = userProfile.role === 'contractor' ? user.id : userProfile.contractorId;

    const agreement = await kv.get(`agreement:${contractorId}`);
    
    return c.json({ agreement: agreement || null });
  } catch (error: any) {
    console.error('Get agreement error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Create or update agreement (Contractor only)
app.post("/make-server-689d7d60/agreement", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const userProfile = await kv.get(`user:${user.id}`);
    if (userProfile.role !== 'contractor') {
      return c.json({ error: 'Only contractors can manage agreements' }, 403);
    }

    const body = await c.req.json();
    
    const agreement = {
      id: `agreement:${user.id}`,
      contractorId: user.id,
      title: body.title || 'Worker Employment Agreement',
      content: body.content,
      version: body.version || 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
    };

    await kv.set(`agreement:${user.id}`, agreement);

    return c.json({ success: true, agreement });
  } catch (error: any) {
    console.error('Create/update agreement error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Worker accepts agreement
app.post("/make-server-689d7d60/agreement/accept", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const userProfile = await kv.get(`user:${user.id}`);
    if (userProfile.role !== 'labour') {
      return c.json({ error: 'Only workers can accept agreements' }, 403);
    }

    const body = await c.req.json();
    const acceptanceId = crypto.randomUUID();
    
    const acceptance = {
      id: acceptanceId,
      workerId: user.id,
      workerName: userProfile.name,
      workerPhone: userProfile.phone,
      contractorId: userProfile.contractorId,
      agreementId: body.agreementId,
      agreementVersion: body.agreementVersion,
      signature: body.signature, // Base64 signature image
      acceptedAt: new Date().toISOString(),
      ipAddress: c.req.header('x-forwarded-for') || 'unknown',
      deviceInfo: c.req.header('user-agent') || 'unknown',
    };

    // Save the acceptance
    await kv.set(`agreement_acceptance:${acceptanceId}`, acceptance);
    
    // Track acceptance in worker profile
    await kv.set(`worker:${user.id}:agreement_acceptance`, acceptanceId);
    
    // Add to contractor's acceptance list
    await addToList(`contractor:${userProfile.contractorId}:acceptances`, acceptanceId);

    return c.json({ success: true, acceptance });
  } catch (error: any) {
    console.error('Accept agreement error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get worker's agreement acceptance status
app.get("/make-server-689d7d60/agreement/status", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const userProfile = await kv.get(`user:${user.id}`);
    const acceptanceId = await kv.get(`worker:${user.id}:agreement_acceptance`);
    
    let acceptance = null;
    if (acceptanceId) {
      acceptance = await kv.get(`agreement_acceptance:${acceptanceId}`);
    }

    // Get current agreement
    const agreement = await kv.get(`agreement:${userProfile.contractorId}`);

    return c.json({ 
      hasAccepted: !!acceptance,
      acceptance,
      currentAgreement: agreement,
      needsAcceptance: !acceptance || (agreement && acceptance.agreementVersion < agreement.version)
    });
  } catch (error: any) {
    console.error('Get agreement status error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get all agreement acceptances (Contractor only)
app.get("/make-server-689d7d60/agreement/acceptances", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401);

    const userProfile = await kv.get(`user:${user.id}`);
    if (userProfile.role !== 'contractor') {
      return c.json({ error: 'Only contractors can view acceptances' }, 403);
    }

    const acceptanceIds = await kv.get(`contractor:${user.id}:acceptances`) || [];
    const acceptances = await kv.mget(acceptanceIds.map((id: string) => `agreement_acceptance:${id}`));

    return c.json({ acceptances: acceptances.filter(Boolean) });
  } catch (error: any) {
    console.error('Get acceptances error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function hashAadhaar(aadhaar: string): string {
  // Simple hash function (in production, use crypto library)
  return `hash_${aadhaar.slice(-4)}`;
}

async function addToList(key: string, value: string) {
  const list = await kv.get(key) || [];
  if (!list.includes(value)) {
    list.push(value);
    await kv.set(key, list);
  }
}

Deno.serve(app.fetch);