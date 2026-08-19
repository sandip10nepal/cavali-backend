import { Router } from 'express';
import { MultiTenantDbService } from '../services/multi-tenant-db.service';
import { AuthService } from '../services/auth.service';
import { sseService } from '../services/sse.service';
import { optionalAuth, requireAuth, requirePermission, resolveTenantRestaurantId } from '../middleware/tenant.middleware';
import type { UserRole, Timecard } from '../models/types';
import { UserRepository } from '../modules/users/user.repository';

const router = Router();

// Helper to resolve restaurant ID from request
async function resolveRestaurantId(req: any): Promise<string> {
  const rid = await resolveTenantRestaurantId(req);
  return rid || 'RES_EED4E9D266DF';
}

// Helper to check if caller is an authorized Manager or Owner
async function isAuthorizedManagerOrOwner(authPin?: any, req?: any): Promise<boolean> {
  if (req?.tenant && (req.tenant.role === 'owner' || req.tenant.role === 'manager' || req.tenant.role === 'platform_admin')) {
    return true;
  }
  if (authPin) {
    const pinStr = String(authPin).trim();
    const restaurantId = await resolveRestaurantId(req);
    if (restaurantId && MultiTenantDbService.isInitialized()) {
      const users = await UserRepository.listByRestaurant(restaurantId);
      for (const u of users) {
        if ((u.role === 'owner' || u.role === 'manager' || u.role === 'platform_admin') && AuthService.verifyPin(pinStr, u.pin_hash)) {
          return true;
        }
      }
    }
  }
  return false;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                         EMPLOYEE PROFILES LIST                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

// GET /api/employees — list all employees with role/position & active clock-in status
router.get('/', optionalAuth, async (req, res) => {
  try {
    const isAuth = await isAuthorizedManagerOrOwner(req.query.authPin || req.headers['x-admin-pin'], req);

    const restaurantId = await resolveRestaurantId(req);
    if (!restaurantId) {
      return res.json({ success: true, employees: [] });
    }

    let employees: any[] = [];

    if (MultiTenantDbService.isInitialized()) {
      try {
        const tenantUsers = await MultiTenantDbService.listUsers(restaurantId);
        for (const u of tenantUsers) {
          const activeShift = await MultiTenantDbService.getActiveTimecard(restaurantId, u._id);
          employees.push({
            id: u._id,
            name: u.name,
            role: u.role,
            position: u.position || u.role,
            hourly_rate: u.hourly_rate ?? null,
            email: u.email,
            phone: u.phone,
            pin: '****',
            active: u.active,
            is_clocked_in: !!activeShift,
            active_shift: activeShift || null,
            createdAt: u.created_at || new Date().toISOString(),
          });
        }
      } catch (e) {
        console.warn('Could not fetch multi-tenant staff list:', e);
      }
    }

    res.json({ success: true, employees });
  } catch (err) {
    console.error('Error fetching employees:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch employees' });
  }
});

// GET /api/employees/payroll/summary — Get manager weekly payroll summary across all staff
router.get('/payroll/summary', optionalAuth, async (req, res) => {
  try {
    const restaurantId = (await resolveRestaurantId(req)) || req.tenant?.restaurant_id || 'RES_EED4E9D266DF';
    const users = await MultiTenantDbService.listUsers(restaurantId);
    const timecards = await MultiTenantDbService.listTimecards(restaurantId);

    let totalPendingPayroll = 0;
    let totalFulfilledPayroll = 0;
    let unfulfilledShiftsCount = 0;

    const staffSummary = users.map(user => {
      const userCards = timecards.filter(tc => tc.user_id === (user._id || (user as any).id));
      const rate = Number(user.hourly_rate) || 15;
      
      let pendingHours = 0;
      let pendingPay = 0;
      let fulfilledPay = 0;
      let pendingShiftsCount = 0;

      userCards.forEach(tc => {
        if (tc.status === 'completed' || tc.status === 'auto_closed') {
          const hrs = tc.total_hours || ((tc.total_minutes || 0) / 60);
          const gross = hrs * rate;
          if ((tc as any).payroll_fulfilled) {
            fulfilledPay += gross;
            totalFulfilledPayroll += gross;
          } else {
            pendingHours += hrs;
            pendingPay += gross;
            pendingShiftsCount++;
            totalPendingPayroll += gross;
            unfulfilledShiftsCount++;
          }
        }
      });

      return {
        id: user._id || (user as any).id,
        name: user.name,
        role: user.role,
        hourly_rate: rate,
        pending_hours: parseFloat(pendingHours.toFixed(2)),
        pending_pay: parseFloat(pendingPay.toFixed(2)),
        fulfilled_pay: parseFloat(fulfilledPay.toFixed(2)),
        pending_shifts: pendingShiftsCount,
      };
    });

    res.json({
      success: true,
      summary: {
        total_pending_payroll: parseFloat(totalPendingPayroll.toFixed(2)),
        total_fulfilled_payroll: parseFloat(totalFulfilledPayroll.toFixed(2)),
        unfulfilled_shifts_count: unfulfilledShiftsCount,
        staff: staffSummary
      }
    });
  } catch (err: any) {
    console.error('Error fetching payroll summary:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch payroll summary' });
  }
});

// POST /api/employees/payroll/fulfill — Manager/Owner fulfills weekly payroll for employees
router.post('/payroll/fulfill', optionalAuth, async (req, res) => {
  try {
    let isAuth = await isAuthorizedManagerOrOwner(req.body?.authPin || req.headers['x-admin-pin'] || req.query.authPin, req);
    if (!isAuth && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      const token = req.headers.authorization.substring(7);
      const payload = AuthService.verifyToken(token);
      if (payload && (payload.role === 'manager' || payload.role === 'owner')) {
        isAuth = true;
      }
    }
    if (!isAuth && !(req.tenant?.role === 'owner' || req.tenant?.role === 'manager')) {
      return res.status(403).json({ success: false, message: 'Forbidden: Payroll fulfillment requires Manager or Owner authorization.' });
    }

    const restaurantId = (await resolveRestaurantId(req)) || req.tenant?.restaurant_id || 'RES_EED4E9D266DF';
    const { userId, weekKey } = req.body || {};

    const timecards = await MultiTenantDbService.listTimecards(restaurantId);
    let fulfilledCount = 0;
    let totalPayrollAmount = 0;

    for (const tc of timecards) {
      const matchUser = !userId || tc.user_id === userId;
      let matchWeek = true;
      if (weekKey && tc.clock_in) {
        const sDate = new Date(tc.clock_in);
        const wDay = sDate.getDay() || 7;
        const wStart = new Date(sDate);
        wStart.setHours(0, 0, 0, 0);
        wStart.setDate(sDate.getDate() - (wDay - 1));
        const currentWKey = wStart.toISOString().substring(0, 10);
        matchWeek = (currentWKey === weekKey);
      }

      if ((tc.status === 'completed' || tc.status === 'auto_closed') && matchUser && matchWeek && !(tc as any).payroll_fulfilled) {
        const user = await MultiTenantDbService.getUser(tc.user_id);
        const rate = Number(tc.hourly_rate || (user ? user.hourly_rate : 0) || 15);
        const hours = tc.total_hours || ((tc.total_minutes || 0) / 60);
        totalPayrollAmount += hours * rate;
        fulfilledCount++;

        if (MultiTenantDbService.isInitialized()) {
          await MultiTenantDbService.updateTimecard(tc._id, restaurantId, {
            payroll_fulfilled: true,
            payroll_fulfilled_at: new Date().toISOString()
          } as any);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Weekly payroll fulfilled successfully! ${fulfilledCount} shift timecards processed. Total payout: $${totalPayrollAmount.toFixed(2)}`,
      fulfilled_count: fulfilledCount,
      total_amount: parseFloat(totalPayrollAmount.toFixed(2))
    });
  } catch (err: any) {
    console.error('Error fulfilling payroll:', err);
    res.status(500).json({ success: false, message: 'Failed to fulfill payroll' });
  }
});

// POST /api/employees/verify-pin — verify a PIN and return employee profile + clock status
router.post('/verify-pin', optionalAuth, async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ success: false, message: 'PIN required' });
    const pinStr = String(pin).trim();

    const restaurantId = await resolveRestaurantId(req);

    // 1. Search in MultiTenantDbService
    if (MultiTenantDbService.isInitialized()) {
      const users = await UserRepository.listByRestaurant(restaurantId);
      const user = users.find(u => u.active !== false && AuthService.verifyPin(pinStr, u.pin_hash));
      if (user) {
        const activeShift = await MultiTenantDbService.getActiveTimecard(restaurantId, user._id);
        return res.json({
          success: true,
          employee: {
            id: user._id,
            name: user.name,
            role: user.role,
            position: user.position || user.role,
            hourly_rate: user.hourly_rate ?? null,
            email: user.email,
            is_clocked_in: !!activeShift,
            active_shift: activeShift || null,
          }
        });
      }
    }

    res.status(401).json({ success: false, message: 'Invalid or inactive PIN' });
  } catch (err) {
    console.error('Error verifying PIN:', err);
    res.status(500).json({ success: false, message: 'PIN verification failed' });
  }
});

// GET /api/employees/:id/profile — get detailed employee work hours, payroll, and 6-month timesheets
router.get('/:id/profile', optionalAuth, async (req, res) => {
  try {
    let authUserId = req.tenant?.user_id;
    let authRole = req.tenant?.role;
    let authRestaurantId = req.tenant?.restaurant_id;

    const authHeader = req.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = AuthService.verifyToken(token);
      if (payload) {
        authUserId = payload.sub || (payload as any).user_id || (payload as any).id;
        authRole = payload.role;
        authRestaurantId = payload.rid;
      }
    }

    const restaurantId = (await resolveRestaurantId(req)) || authRestaurantId || 'RES_EED4E9D266DF';

    let targetUserId = String(req.params.id || '');
    if (!targetUserId || targetUserId === 'me' || targetUserId === 'undefined') {
      targetUserId = authUserId || '';
    }

    if (!targetUserId && req.query.userId) {
      targetUserId = String(req.query.userId);
    }

    const users = await MultiTenantDbService.listUsers(restaurantId);

    let user: any = null;
    if (targetUserId) {
      user = users.find(u => u._id === targetUserId || (u as any).id === targetUserId);
    }

    if (!user && req.query.name) {
      const searchName = String(req.query.name).trim().toLowerCase();
      user = users.find(u => u.name.toLowerCase() === searchName);
    }

    if (!user) {
      // Find active clocked-in staff member or first active user
      const clockedInUser = users.find(u => u.active && (u as any).is_clocked_in);
      if (clockedInUser) {
        user = clockedInUser;
      } else if (users.length > 0) {
        user = users[0];
      }
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'Employee profile not found' });
    }

    // Fetch all timesheets/shifts in the last 6 months for this employee
    const timecards = await MultiTenantDbService.listTimecards(restaurantId, { userId: user._id || user.id });
    const hourlyRate = Number(user.hourly_rate) || 0;

    // Date references for period filtering
    const now = new Date();
    const nowMs = now.getTime();
    
    // Start of current week (Monday)
    const dayOfWeek = now.getDay() || 7; // 1 = Monday, 7 = Sunday
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(now.getDate() - (dayOfWeek - 1));
    const startOfWeekMs = startOfWeek.getTime();

    // Start of current month (1st day)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const startOfMonthMs = startOfMonth.getTime();

    // Start of 6 months (180 days)
    const startOf6Months = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const startOf6MonthsMs = startOf6Months.getTime();

    let lifetimeHours = 0;
    let lifetimeMinutes = 0;
    let lifetimePayroll = 0;
    let completedShiftsCount = 0;

    let weekHours = 0;
    let weekPayroll = 0;
    let weekShiftsCount = 0;

    let monthHours = 0;
    let monthPayroll = 0;
    let monthShiftsCount = 0;

    let sixMonthHours = 0;
    let sixMonthPayroll = 0;
    let sixMonthShiftsCount = 0;

    const weeklyBucketsMap: { [weekKey: string]: { period_label: string; total_hours: number; gross_pay: number; shifts_count: number; unfulfilled_count: number; fulfilled: boolean } } = {};

    let activeShiftData: any = null;

    const formattedShifts = timecards.map(tc => {
      const shiftHourlyRate = Number(tc.hourly_rate) || hourlyRate;
      let shiftHours = tc.total_hours || 0;
      let shiftMinutes = tc.total_minutes || 0;
      let shiftGrossPay = 0;

      if (tc.status === 'completed' || tc.status === 'auto_closed') {
        if (!shiftHours && shiftMinutes) {
          shiftHours = parseFloat((shiftMinutes / 60).toFixed(2));
        } else if (!shiftMinutes && shiftHours) {
          shiftMinutes = Math.round(shiftHours * 60);
        }
        shiftGrossPay = parseFloat((shiftHours * shiftHourlyRate).toFixed(2));

        lifetimeHours += shiftHours;
        lifetimeMinutes += shiftMinutes;
        lifetimePayroll += shiftGrossPay;
        completedShiftsCount++;

        const shiftStartMs = new Date(tc.clock_in).getTime();
        if (shiftStartMs >= startOfWeekMs) {
          weekHours += shiftHours;
          weekPayroll += shiftGrossPay;
          weekShiftsCount++;
        }
        if (shiftStartMs >= startOfMonthMs) {
          monthHours += shiftHours;
          monthPayroll += shiftGrossPay;
          monthShiftsCount++;
        }
        if (shiftStartMs >= startOf6MonthsMs) {
          sixMonthHours += shiftHours;
          sixMonthPayroll += shiftGrossPay;
          sixMonthShiftsCount++;
        }

        // Weekly Payroll grouping
        const sDate = new Date(tc.clock_in);
        const wDay = sDate.getDay() || 7;
        const wStart = new Date(sDate);
        wStart.setHours(0, 0, 0, 0);
        wStart.setDate(sDate.getDate() - (wDay - 1));
        const wEnd = new Date(wStart);
        wEnd.setDate(wStart.getDate() + 6);

        const wKey = wStart.toISOString().substring(0, 10);
        const label = `${wStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${wEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

        if (!weeklyBucketsMap[wKey]) {
          weeklyBucketsMap[wKey] = {
            period_label: label,
            total_hours: 0,
            gross_pay: 0,
            shifts_count: 0,
            unfulfilled_count: 0,
            fulfilled: true
          };
        }

        weeklyBucketsMap[wKey].total_hours += shiftHours;
        weeklyBucketsMap[wKey].gross_pay += shiftGrossPay;
        weeklyBucketsMap[wKey].shifts_count++;
        if (!(tc as any).payroll_fulfilled) {
          weeklyBucketsMap[wKey].unfulfilled_count++;
          weeklyBucketsMap[wKey].fulfilled = false;
        }
      } else if (tc.status === 'active') {
        const liveMinutes = Math.max(0, Math.round((nowMs - new Date(tc.clock_in).getTime()) / 60000));
        const liveHours = parseFloat((liveMinutes / 60).toFixed(2));
        const liveEarnedPay = parseFloat((liveHours * shiftHourlyRate).toFixed(2));

        activeShiftData = {
          _id: tc._id,
          clock_in: tc.clock_in,
          role: tc.role,
          hourly_rate: shiftHourlyRate,
          elapsed_minutes: liveMinutes,
          elapsed_hours: liveHours,
          live_earned_pay: liveEarnedPay,
        };
      }

      return {
        _id: tc._id,
        clock_in: tc.clock_in,
        clock_out: tc.clock_out,
        role: tc.role,
        hourly_rate: shiftHourlyRate,
        total_hours: shiftHours,
        total_minutes: shiftMinutes,
        shift_gross_pay: shiftGrossPay,
        status: tc.status,
        payroll_fulfilled: !!(tc as any).payroll_fulfilled,
        notes: tc.notes || null,
        created_at: tc.created_at,
      };
    });

    const averageShiftHours = completedShiftsCount > 0 
      ? parseFloat((lifetimeHours / completedShiftsCount).toFixed(2)) 
      : 0;

    const weeklyPayrollList = Object.keys(weeklyBucketsMap).sort().reverse().map(k => ({
      week_key: k,
      period_label: weeklyBucketsMap[k].period_label,
      total_hours: parseFloat(weeklyBucketsMap[k].total_hours.toFixed(2)),
      gross_pay: parseFloat(weeklyBucketsMap[k].gross_pay.toFixed(2)),
      shifts_count: weeklyBucketsMap[k].shifts_count,
      fulfilled: weeklyBucketsMap[k].fulfilled,
    }));

    res.json({
      success: true,
      profile: {
        id: user._id || user.id,
        name: user.name,
        role: user.role,
        position: user.position || user.role,
        hourly_rate: hourlyRate,
        email: user.email || null,
        phone: user.phone || null,
        active: user.active !== false,
        hire_date: user.created_at || null,
        is_clocked_in: !!activeShiftData,
        active_shift: activeShiftData,
      },
      payroll_summary: {
        hourly_rate: hourlyRate,
        lifetime: {
          total_hours: parseFloat(lifetimeHours.toFixed(2)),
          total_minutes: lifetimeMinutes,
          gross_pay: parseFloat(lifetimePayroll.toFixed(2)),
          completed_shifts: completedShiftsCount,
          average_shift_hours: averageShiftHours,
        },
        current_week: {
          hours: parseFloat(weekHours.toFixed(2)),
          gross_pay: parseFloat(weekPayroll.toFixed(2)),
          shifts_count: weekShiftsCount,
          period_start: startOfWeek.toISOString(),
        },
        current_month: {
          hours: parseFloat(monthHours.toFixed(2)),
          gross_pay: parseFloat(monthPayroll.toFixed(2)),
          shifts_count: monthShiftsCount,
          period_start: startOfMonth.toISOString(),
        },
        six_months: {
          hours: parseFloat(sixMonthHours.toFixed(2)),
          gross_pay: parseFloat(sixMonthPayroll.toFixed(2)),
          shifts_count: sixMonthShiftsCount,
          period_start: startOf6Months.toISOString(),
        },
        weekly_payroll: weeklyPayrollList,
      },
      timesheets_count: formattedShifts.length,
      timesheets: formattedShifts,
    });
  } catch (err: any) {
    console.error('Error fetching employee profile & payroll:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch employee profile' });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                 MANAGER PROVISIONING: CREATE / EDIT EMPLOYEE                */
/* ═══════════════════════════════════════════════════════════════════════════ */

// POST /api/employees — create a new employee profile (Manager or Owner)
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { name, role, position, pin, email, phone, hourly_rate, authPin } = req.body;
    if (!name || !role || !pin) {
      return res.status(400).json({ success: false, message: 'name, role (position), and pin are required' });
    }
    const pinStr = String(pin).trim();
    if (pinStr.length !== 4 || !/^\d{4}$/.test(pinStr)) {
      return res.status(400).json({ success: false, message: 'PIN must be exactly 4 digits' });
    }

    // Verify Manager/Owner authorization
    const isAuth = await isAuthorizedManagerOrOwner(authPin, req);
    if (!isAuth) {
      return res.status(403).json({ success: false, message: 'Manager or Owner authorization required to add employees' });
    }

    const restaurantId = await resolveRestaurantId(req);
    const validRole: UserRole = role as UserRole;
    const employeeEmail = email ? String(email).trim().toLowerCase() : `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now().toString(36)}@cavali.com`;

    // 1. Create in MultiTenantDbService
    let createdUser: any = null;
    if (MultiTenantDbService.isInitialized()) {
      // Check duplicate PIN within restaurant
      const existingUsers = await UserRepository.listByRestaurant(restaurantId);
      const duplicatePin = existingUsers.find(u => u.active && AuthService.verifyPin(pinStr, u.pin_hash));
      if (duplicatePin) {
        return res.status(409).json({ success: false, message: `That PIN is already in use by employee "${duplicatePin.name}"` });
      }

      createdUser = await UserRepository.create({
        restaurant_id: restaurantId,
        name: String(name).trim(),
        email: employeeEmail,
        phone: phone ? String(phone).trim() : null,
        role: validRole,
        position: position ? String(position).trim() : validRole,
        hourly_rate: hourly_rate !== undefined ? Number(hourly_rate) : undefined,
        pin_hash: AuthService.hashPin(pinStr),
        active: true,
      });

      await MultiTenantDbService.logAudit(
        restaurantId,
        req.tenant?.user_id || 'manager',
        req.tenant?.restaurant_name || 'Manager',
        'employee_added',
        'user',
        createdUser._id,
        { name: createdUser.name, role: validRole, position: createdUser.position }
      );

      sseService.broadcast({ type: 'employees_update', action: 'create', employee: { id: createdUser._id, name: createdUser.name, role: validRole } });
      return res.status(201).json({
        success: true,
        message: `Employee "${name}" profile created successfully`,
        employee: {
          id: createdUser._id,
          name: createdUser.name,
          role: validRole,
          position: createdUser.position || validRole,
          hourly_rate: createdUser.hourly_rate ?? null,
          email: employeeEmail,
          pin: '****',
          active: true,
          is_clocked_in: false,
          createdAt: createdUser.created_at,
        }
      });
    }

    res.status(400).json({ success: false, message: 'Database not initialized' });
  } catch (err: any) {
    console.error('Error creating employee:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to create employee' });
  }
});

// PATCH /api/employees/:id — update employee profile (Manager or Owner)
router.patch('/:id', optionalAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const { name, role, position, pin, email, phone, hourly_rate, active, authPin } = req.body;

    const isAuth = await isAuthorizedManagerOrOwner(authPin, req);
    if (!isAuth) {
      return res.status(403).json({ success: false, message: 'Manager or Owner authorization required' });
    }

    const restaurantId = await resolveRestaurantId(req);
    const updatePayload: any = {};
    if (name !== undefined) updatePayload.name = String(name).trim();
    if (role !== undefined) updatePayload.role = role as UserRole;
    if (position !== undefined) updatePayload.position = String(position).trim();
    if (email !== undefined) updatePayload.email = String(email).trim().toLowerCase();
    if (phone !== undefined) updatePayload.phone = String(phone).trim();
    if (hourly_rate !== undefined) updatePayload.hourly_rate = Number(hourly_rate);
    if (active !== undefined) updatePayload.active = Boolean(active);
    if (pin !== undefined) {
      const pinStr = String(pin).trim();
      if (!/^\d{4}$/.test(pinStr)) {
        return res.status(400).json({ success: false, message: 'PIN must be exactly 4 digits' });
      }
      updatePayload.pin_hash = AuthService.hashPin(pinStr);
    }

    await UserRepository.update(id, restaurantId, updatePayload);

    sseService.broadcast({ type: 'employees_update', action: 'update', employeeId: id });
    res.json({ success: true, message: 'Employee profile updated successfully' });
  } catch (err: any) {
    console.error('Error updating employee:', err);
    res.status(500).json({ success: false, message: 'Failed to update employee' });
  }
});

// DELETE /api/employees/:id — remove employee (Manager or Owner)
router.delete('/:id', optionalAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const { authPin } = req.body || {};

    const isAuth = await isAuthorizedManagerOrOwner(authPin, req);
    if (!isAuth) {
      return res.status(403).json({ success: false, message: 'Manager or Owner authorization required to remove employee' });
    }

    if (id === 'emp-owner' || id === 'USR_OWNER') {
      return res.status(400).json({ success: false, message: 'Cannot deactivate the primary Owner account' });
    }

    const restaurantId = await resolveRestaurantId(req);
    const activeShift = await MultiTenantDbService.getActiveTimecard(restaurantId, id);
    if (activeShift) {
      await MultiTenantDbService.updateTimecard(activeShift._id, restaurantId, {
        clock_out: new Date().toISOString(),
        status: 'auto_closed',
      });
    }

    await UserRepository.delete(id, restaurantId);
    await MultiTenantDbService.logAudit(
      restaurantId,
      req.tenant?.user_id || 'manager',
      'Manager',
      'employee_deleted',
      'user',
      id,
      {}
    );

    sseService.broadcast({ type: 'employees_update', action: 'delete', employeeId: id });
    res.json({ success: true, message: 'Employee removed successfully' });
  } catch (err) {
    console.error('Error deleting employee:', err);
    res.status(500).json({ success: false, message: 'Failed to remove employee' });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     CLOCK IN / CLOCK OUT SHIFT SYSTEM                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

// POST /api/employees/clock-in — employee clock-in (verifies user_id/name + PIN)
router.post('/clock-in', optionalAuth, async (req, res) => {
  try {
    const { pin, user_id, name, role, notes } = req.body;
    const restaurantId = await resolveRestaurantId(req);

    let employeeUser: any = null;
    const pinStr = pin ? String(pin).trim() : '';

    const users = await MultiTenantDbService.listUsers(restaurantId);

    // 1. Identify employee by authenticated session token first if present
    if (req.tenant?.user_id || (req.headers.authorization && req.headers.authorization.startsWith('Bearer '))) {
      let authUserId = req.tenant?.user_id;
      if (!authUserId && req.headers.authorization) {
        const token = req.headers.authorization.substring(7);
        const payload = AuthService.verifyToken(token);
        if (payload) {
          authUserId = payload.sub || (payload as any).user_id || (payload as any).id;
        }
      }
      if (authUserId) {
        employeeUser = users.find(u => u.active && (u._id === authUserId || (u as any).id === authUserId));
      }
    }

    if (!employeeUser && user_id) {
      employeeUser = users.find(u => u.active && (u._id === String(user_id).trim() || (u as any).id === String(user_id).trim()));
    } else if (!employeeUser && name) {
      employeeUser = users.find(u => u.active && u.name.toLowerCase() === String(name).trim().toLowerCase());
    }

    // 2. If PIN provided and employeeUser specified, verify PIN
    if (employeeUser && pinStr) {
      if (!AuthService.verifyPin(pinStr, employeeUser.pin_hash)) {
        return res.status(401).json({
          success: false,
          error: `Incorrect 4-digit PIN for ${employeeUser.name}. Please try again.`
        });
      }
    } else if (!employeeUser && pinStr) {
      // Find matching user by PIN
      const matchingStaff = users.filter(u => u.active && AuthService.verifyPin(pinStr, u.pin_hash));
      const nonManagerStaff = matchingStaff.filter(u => u.role !== 'owner' && u.role !== 'manager');
      if (nonManagerStaff.length > 0) {
        employeeUser = nonManagerStaff[0];
      } else if (matchingStaff.length > 0) {
        employeeUser = matchingStaff[0];
      }
    }

    if (!employeeUser) {
      return res.status(401).json({ success: false, error: 'Staff account or PIN is required to Clock In.' });
    }



    // 4. Check if employee already has an active clock-in
    const activeShift = await MultiTenantDbService.getActiveTimecard(restaurantId, employeeUser._id);
    if (activeShift) {
      return res.status(409).json({
        success: false,
        error: `${employeeUser.name} is already clocked in since ${new Date(activeShift.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
        is_clocked_in: true,
        timecard: activeShift,
      });
    }

    // 5. Create active Timecard
    const shiftRole = (role as UserRole) || employeeUser.role || 'server';
    const now = new Date().toISOString();

    const timecard = await MultiTenantDbService.createTimecard({
      restaurant_id: restaurantId,
      user_id: employeeUser._id,
      employee_name: employeeUser.name,
      role: shiftRole,
      hourly_rate: employeeUser.hourly_rate || undefined,
      clock_in: now,
      clock_out: null,
      notes: notes ? String(notes).trim() : undefined,
      status: 'active',
    });

    await MultiTenantDbService.logAudit(
      restaurantId,
      employeeUser._id,
      employeeUser.name,
      'timecard_clock_in',
      'timecard',
      timecard._id,
      { role: shiftRole, clock_in: now }
    );

    sseService.broadcast({
      type: 'clock_event',
      action: 'clock_in',
      employeeId: employeeUser._id,
      employeeName: employeeUser.name,
      timecard
    });

    res.status(201).json({
      success: true,
      message: `Clocked in successfully at ${new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      timecard,
      employee: {
        id: employeeUser._id,
        name: employeeUser.name,
        role: shiftRole,
        position: employeeUser.position || shiftRole,
        is_clocked_in: true,
      }
    });
  } catch (err: any) {
    console.error('Clock-in error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to clock in' });
  }
});

// POST /api/employees/clock-out — employee clock-out (verifies user_id/name + PIN)
router.post('/clock-out', optionalAuth, async (req, res) => {
  try {
    const { pin, user_id, name, notes } = req.body;
    const restaurantId = await resolveRestaurantId(req);

    let employeeUser: any = null;
    const pinStr = pin ? String(pin).trim() : '';

    const users = await MultiTenantDbService.listUsers(restaurantId);

    // 1. Identify employee by authenticated session token first if present
    if (req.tenant?.user_id || (req.headers.authorization && req.headers.authorization.startsWith('Bearer '))) {
      let authUserId = req.tenant?.user_id;
      if (!authUserId && req.headers.authorization) {
        const token = req.headers.authorization.substring(7);
        const payload = AuthService.verifyToken(token);
        if (payload) {
          authUserId = payload.sub || (payload as any).user_id || (payload as any).id;
        }
      }
      if (authUserId) {
        employeeUser = users.find(u => u.active && (u._id === authUserId || (u as any).id === authUserId));
      }
    }

    if (!employeeUser && user_id) {
      employeeUser = users.find(u => u.active && (u._id === String(user_id).trim() || (u as any).id === String(user_id).trim()));
    } else if (!employeeUser && name) {
      employeeUser = users.find(u => u.active && u.name.toLowerCase() === String(name).trim().toLowerCase());
    }

    // 2. If PIN provided and employeeUser specified, verify PIN
    if (employeeUser && pinStr) {
      if (!AuthService.verifyPin(pinStr, employeeUser.pin_hash)) {
        return res.status(401).json({
          success: false,
          error: `Incorrect 4-digit PIN for ${employeeUser.name}. Please try again.`
        });
      }
    } else if (!employeeUser && pinStr) {
      // Find matching user by PIN
      const matchingStaff = users.filter(u => u.active && AuthService.verifyPin(pinStr, u.pin_hash));
      const nonManagerStaff = matchingStaff.filter(u => u.role !== 'owner' && u.role !== 'manager');
      if (nonManagerStaff.length > 0) {
        employeeUser = nonManagerStaff[0];
      } else if (matchingStaff.length > 0) {
        employeeUser = matchingStaff[0];
      }
    }

    if (!employeeUser) {
      return res.status(401).json({ success: false, error: 'Staff account or PIN is required to Clock Out.' });
    }

    // 4. Find active shift
    const activeShift = await MultiTenantDbService.getActiveTimecard(restaurantId, employeeUser._id);
    if (!activeShift) {
      return res.status(404).json({
        success: false,
        error: `${employeeUser.name} does not have an active shift to clock out from.`,
        is_clocked_in: false,
      });
    }

    // 5. Calculate shift duration
    const clockOutTime = new Date();
    const clockInTime = new Date(activeShift.clock_in);
    const diffMs = Math.max(0, clockOutTime.getTime() - clockInTime.getTime());
    const totalMinutes = Math.round(diffMs / 60000);
    const totalHours = parseFloat((totalMinutes / 60).toFixed(2));

    const updateFields: Partial<Timecard> = {
      clock_out: clockOutTime.toISOString(),
      total_minutes: totalMinutes,
      total_hours: totalHours,
      status: 'completed',
    };
    if (notes) {
      updateFields.notes = activeShift.notes ? `${activeShift.notes} | ${notes}` : String(notes).trim();
    }

    await MultiTenantDbService.updateTimecard(activeShift._id, restaurantId, updateFields);

    const completedTimecard = await MultiTenantDbService.getTimecard(activeShift._id, restaurantId);

    await MultiTenantDbService.logAudit(
      restaurantId,
      employeeUser._id,
      employeeUser.name,
      'timecard_clock_out',
      'timecard',
      activeShift._id,
      { total_hours: totalHours, total_minutes: totalMinutes, clock_out: updateFields.clock_out }
    );

    sseService.broadcast({
      type: 'clock_event',
      action: 'clock_out',
      employeeId: employeeUser._id,
      employeeName: employeeUser.name,
      timecard: completedTimecard
    });

    res.status(200).json({
      success: true,
      message: `Clocked out successfully. Total shift: ${totalHours} hrs (${totalMinutes} mins)`,
      timecard: completedTimecard,
      summary: {
        total_hours: totalHours,
        total_minutes: totalMinutes,
        clock_in: activeShift.clock_in,
        clock_out: updateFields.clock_out,
      },
      employee: {
        id: employeeUser._id,
        name: employeeUser.name,
        is_clocked_in: false,
      }
    });
  } catch (err: any) {
    console.error('Clock-out error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to clock out' });
  }
});

// GET /api/employees/clock-status — get current shift clock status
router.get('/clock-status', optionalAuth, async (req, res) => {
  try {
    const { pin, userId } = req.query;
    const restaurantId = await resolveRestaurantId(req);

    let targetUserId = userId ? String(userId) : req.tenant?.user_id;

    if (pin) {
      const pinStr = String(pin).trim();
      const users = await MultiTenantDbService.listUsers(restaurantId);
      const matched = users.find(u => u.active && AuthService.verifyPin(pinStr, u.pin_hash));
      if (matched) targetUserId = matched._id;
    }

    if (!targetUserId) {
      // Return list of all currently active clocked-in employees for dashboard
      const allActive = await MultiTenantDbService.listTimecards(restaurantId, { status: 'active' });
      return res.json({
        success: true,
        active_count: allActive.length,
        active_shifts: allActive
      });
    }

    const activeShift = await MultiTenantDbService.getActiveTimecard(restaurantId, targetUserId);
    const user = await MultiTenantDbService.getUser(targetUserId);

    let elapsedMinutes = 0;
    if (activeShift) {
      elapsedMinutes = Math.round((Date.now() - new Date(activeShift.clock_in).getTime()) / 60000);
    }

    res.json({
      success: true,
      is_clocked_in: !!activeShift,
      employee_name: user?.name || activeShift?.employee_name || null,
      active_shift: activeShift || null,
      timecard: activeShift || null,
      elapsed_minutes: elapsedMinutes,
      elapsed_hours: parseFloat((elapsedMinutes / 60).toFixed(2)),
    });
  } catch (err: any) {
    console.error('Clock-status error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch clock status' });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                 TIMECARDS / TIMESHEETS & 6-MONTH RETENTION                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

// GET /api/employees/timecards — list timesheets / shift history (up to 6 months) (Manager/Owner only)
router.get('/timecards', optionalAuth, async (req, res) => {
  try {
    const isAuth = await isAuthorizedManagerOrOwner(req.query.authPin || req.headers['x-admin-pin'], req);
    if (!isAuth) {
      return res.status(403).json({ success: false, message: 'Forbidden: Access to timesheets is restricted to Managers and Owners.' });
    }

    const restaurantId = await resolveRestaurantId(req);
    const { userId, role, status, startDate, endDate } = req.query;

    const timecards = await MultiTenantDbService.listTimecards(restaurantId, {
      userId: userId ? String(userId) : undefined,
      role: role ? String(role) : undefined,
      status: status ? String(status) : undefined,
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
    });

    // Calculate aggregated statistics
    let totalHoursWorked = 0;
    let totalMinutesWorked = 0;
    let completedShiftsCount = 0;
    let activeShiftsCount = 0;

    timecards.forEach(tc => {
      if (tc.status === 'completed' && tc.total_hours) {
        totalHoursWorked += tc.total_hours;
        totalMinutesWorked += tc.total_minutes || Math.round(tc.total_hours * 60);
        completedShiftsCount++;
      } else if (tc.status === 'active') {
        activeShiftsCount++;
      }
    });

    res.json({
      success: true,
      count: timecards.length,
      timecards,
      summary: {
        total_hours: parseFloat(totalHoursWorked.toFixed(2)),
        total_minutes: totalMinutesWorked,
        completed_shifts: completedShiftsCount,
        active_shifts: activeShiftsCount,
        retention_window: '6 months (180 days)',
      }
    });
  } catch (err: any) {
    console.error('Error fetching timecards:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch timesheets' });
  }
});

// PATCH /api/employees/timecards/:id — update/correct shift timecard (Manager or Owner)
router.patch('/timecards/:id', optionalAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const { clock_in, clock_out, role, notes, hourly_rate, authPin } = req.body;

    const isAuth = await isAuthorizedManagerOrOwner(authPin, req);
    if (!isAuth) {
      return res.status(403).json({ success: false, message: 'Manager or Owner authorization required to edit timecards' });
    }

    const restaurantId = await resolveRestaurantId(req);
    const existing = await MultiTenantDbService.getTimecard(id, restaurantId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Timecard not found' });
    }

    const updateFields: Partial<Timecard> = {};
    if (role) updateFields.role = role as UserRole;
    if (notes !== undefined) updateFields.notes = String(notes).trim();
    if (hourly_rate !== undefined) updateFields.hourly_rate = Number(hourly_rate);

    const inTimeStr = clock_in || existing.clock_in;
    const outTimeStr = clock_out !== undefined ? clock_out : existing.clock_out;

    if (clock_in) updateFields.clock_in = inTimeStr;
    if (clock_out !== undefined) updateFields.clock_out = outTimeStr;

    // Recalculate duration if both are present
    if (inTimeStr && outTimeStr) {
      const diffMs = Math.max(0, new Date(outTimeStr).getTime() - new Date(inTimeStr).getTime());
      const totalMinutes = Math.round(diffMs / 60000);
      updateFields.total_minutes = totalMinutes;
      updateFields.total_hours = parseFloat((totalMinutes / 60).toFixed(2));
      updateFields.status = 'completed';
    }

    await MultiTenantDbService.updateTimecard(id, restaurantId, updateFields);
    const updated = await MultiTenantDbService.getTimecard(id, restaurantId);

    await MultiTenantDbService.logAudit(
      restaurantId,
      req.tenant?.user_id || 'manager',
      'Manager',
      'timecard_updated',
      'timecard',
      id,
      { updated_fields: Object.keys(updateFields) }
    );

    sseService.broadcast({ type: 'timecards_update', action: 'update', timecard: updated });
    res.json({ success: true, message: 'Timecard updated successfully', timecard: updated });
  } catch (err: any) {
    console.error('Error updating timecard:', err);
    res.status(500).json({ success: false, message: 'Failed to update timecard' });
  }
});

// DELETE /api/employees/timecards/:id — void/delete a timecard (Manager or Owner)
router.delete('/timecards/:id', optionalAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const { authPin } = req.body;

    const isAuth = await isAuthorizedManagerOrOwner(authPin, req);
    if (!isAuth) {
      return res.status(403).json({ success: false, message: 'Manager or Owner authorization required' });
    }

    const restaurantId = await resolveRestaurantId(req);
    const deleted = await MultiTenantDbService.deleteTimecard(id, restaurantId);
    if (!deleted) return res.status(404).json({ success: false, message: 'Timecard not found' });

    await MultiTenantDbService.logAudit(
      restaurantId,
      req.tenant?.user_id || 'manager',
      'Manager',
      'timecard_deleted',
      'timecard',
      id,
      {}
    );

    sseService.broadcast({ type: 'timecards_update', action: 'delete', timecardId: id });
    res.json({ success: true, message: 'Timecard deleted successfully' });
  } catch (err) {
    console.error('Error deleting timecard:', err);
    res.status(500).json({ success: false, message: 'Failed to delete timecard' });
  }
});

// POST /api/employees/timecards/prune — trigger automated 6-month retention cleanup
router.post('/timecards/prune', optionalAuth, async (req, res) => {
  try {
    const { retentionDays, authPin } = req.body;
    const isAuth = await isAuthorizedManagerOrOwner(authPin, req);
    if (!isAuth) {
      return res.status(403).json({ success: false, message: 'Manager or Owner authorization required' });
    }

    const restaurantId = await resolveRestaurantId(req);
    const days = retentionDays ? Number(retentionDays) : 180; // default 6 months
    const result = await MultiTenantDbService.pruneExpiredTimecards(restaurantId, days);

    res.json({
      success: true,
      message: `Retention pruning complete: removed ${result.prunedCount} shift records older than ${days} days (~6 months)`,
      prunedCount: result.prunedCount,
    });
  } catch (err: any) {
    console.error('Retention prune error:', err);
    res.status(500).json({ success: false, message: 'Failed to prune timecards' });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                           TAX CONFIGURATION                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

// GET /api/employees/tax-config — get current tax rates
router.get('/tax-config', (req, res) => {
  res.json({ success: true, taxConfig: { defaultRate: 0.0825, hookahRate: 0.0825, foodRate: 0.0825, drinksRate: 0.0825 } });
});

// PATCH /api/employees/tax-config — update tax rates (requires Manager+)
router.patch('/tax-config', async (req, res) => {
  const { defaultRate, hookahRate, foodRate, drinksRate, authPin } = req.body;
  const isAuth = await isAuthorizedManagerOrOwner(authPin, req);
  if (!isAuth) {
    return res.status(403).json({ success: false, message: 'Manager or Owner PIN required' });
  }

  const updated = {
    defaultRate: defaultRate !== undefined ? parseFloat(defaultRate) : 0.0825,
    hookahRate: hookahRate !== undefined ? parseFloat(hookahRate) : 0.0825,
    foodRate: foodRate !== undefined ? parseFloat(foodRate) : 0.0825,
    drinksRate: drinksRate !== undefined ? parseFloat(drinksRate) : 0.0825,
  };

  res.json({ success: true, taxConfig: updated });
});

export default router;
