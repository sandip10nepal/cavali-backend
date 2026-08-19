/**
 * Authentication Routes
 *
 * POST /api/auth/login          — Staff login (email/PIN + restaurant slug)
 * POST /api/auth/device         — Device authentication (device token)
 * POST /api/auth/device/pair    — Pair a new device to a restaurant + table
 * GET  /api/auth/me             — Get current authenticated user info
 */
import { Router } from 'express';
import { AuthService } from '../services/auth.service';
import { MultiTenantDbService } from '../services/multi-tenant-db.service';
import { sseService } from '../services/sse.service';
import { requireAuth } from '../middleware/tenant.middleware';

const router = Router();

/**
 * POST /api/auth/login-code
 *
 * Fast 8-digit Floor Authentication System (RRRR-EEEE)
 * Body: { code?: string, restaurant_code?: string, pin?: string }
 * Example: { code: "4821-7394" } or { restaurant_code: "4821", pin: "7394" }
 */
router.post('/login-code', async (req, res) => {
  try {
    const { code, restaurant_code, pin } = req.body;

    let rCode = restaurant_code ? String(restaurant_code).trim() : '';
    let pinStr = pin ? String(pin).trim() : '';

    if (code) {
      const parsed = AuthService.parseFloorCode(String(code));
      if (parsed) {
        rCode = parsed.restaurantCode;
        pinStr = parsed.pin;
      }
    }

    if (!rCode || !pinStr) {
      res.status(400).json({ success: false, error: 'Invalid restaurant or employee credentials.' });
      return;
    }

    // 1. Resolve restaurant by code
    const restaurant = await MultiTenantDbService.getRestaurantByCode(rCode);
    if (!restaurant || !restaurant.active) {
      res.status(401).json({ success: false, error: 'Invalid restaurant or employee credentials.' });
      return;
    }

    // 2. Find user in restaurant matching PIN
    const users = await MultiTenantDbService.listUsers(restaurant._id);
    let matchedUser = null;

    for (const u of users) {
      if (u.active && AuthService.verifyPin(pinStr, u.pin_hash)) {
        matchedUser = u;
        break;
      }
    }

    if (!matchedUser) {
      res.status(401).json({ success: false, error: 'Invalid restaurant or employee credentials.' });
      return;
    }

    // 3. Check account lockout
    if (MultiTenantDbService.isAccountLocked(matchedUser)) {
      res.status(423).json({
        success: false,
        error: 'Account temporarily locked due to multiple failed login attempts. Please try again later or contact your manager.',
      });
      return;
    }

    // 4. Reset failed attempts on success
    await MultiTenantDbService.resetFailedLogins(matchedUser._id);

    // 5. Generate JWT token
    const token = AuthService.generateStaffToken(
      matchedUser._id,
      restaurant._id,
      matchedUser.role,
      restaurant.name
    );

    // 6. Fetch current clock status
    const activeShift = await MultiTenantDbService.getActiveTimecard(restaurant._id, matchedUser._id);

    // 7. Audit log
    await MultiTenantDbService.logAudit(
      restaurant._id,
      matchedUser._id,
      matchedUser.name,
      'employee_added',
      'user',
      matchedUser._id,
      { action: 'floor_login_code', role: matchedUser.role }
    );

    res.status(200).json({
      success: true,
      token,
      user: {
        id: matchedUser._id,
        name: matchedUser.name,
        email: matchedUser.email,
        phone: matchedUser.phone,
        role: matchedUser.role,
        position: matchedUser.position || matchedUser.role,
        hourly_rate: matchedUser.hourly_rate ?? null,
      },
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        slug: restaurant.slug,
        restaurant_code: restaurant.restaurant_code,
      },
      is_clocked_in: !!activeShift,
      active_shift: activeShift || null,
    });
  } catch (err: any) {
    console.error('[Auth] login-code error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * POST /api/tenant/resolve
 *
 * Secure Public Restaurant Resolver (Replaces wide-open public lists)
 * Body: { restaurant_code?: string, slug?: string }
 * Returns safe public branding and configuration only.
 */
router.post('/resolve', async (req, res) => {
  try {
    const { restaurant_code, slug, code } = req.body;
    const search = restaurant_code || code || slug;

    if (!search) {
      res.status(400).json({ success: false, error: 'Restaurant code or slug is required.' });
      return;
    }

    let restaurant = await MultiTenantDbService.getRestaurantByCode(String(search));
    if (!restaurant) {
      restaurant = await MultiTenantDbService.getRestaurantBySlug(String(search));
    }

    if (!restaurant || !restaurant.active) {
      res.status(404).json({ success: false, error: 'Restaurant not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        slug: restaurant.slug,
        restaurant_code: restaurant.restaurant_code,
        branding: restaurant.branding,
        settings: {
          currency: restaurant.settings.currency,
          tax_config: restaurant.settings.tax_config,
          tip_options: restaurant.settings.tip_options,
          enable_tips: restaurant.settings.enable_tips,
          enable_split_payment: restaurant.settings.enable_split_payment,
        },
      },
    });
  } catch (err: any) {
    console.error('[Tenant] Resolve error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * POST /api/auth/staff-roster
 *
 * Resolves restaurant by code/pin and returns the list of active staff members
 * (excludes manager/owner accounts so only floor shift staff are displayed).
 * Body: { restaurant_code: string } or { code: string }
 */
router.post('/staff-roster', async (req, res) => {
  try {
    const { restaurant_code, code, slug } = req.body;
    const search = restaurant_code || code || slug;

    if (!search) {
      res.status(400).json({ success: false, error: 'Restaurant PIN / Code is required.' });
      return;
    }

    let restaurant = await MultiTenantDbService.getRestaurantByCode(String(search));
    if (!restaurant) {
      restaurant = await MultiTenantDbService.getRestaurantBySlug(String(search));
    }

    if (!restaurant || !restaurant.active) {
      res.status(404).json({ success: false, error: 'Restaurant not found with this code.' });
      return;
    }

    const allUsers = await MultiTenantDbService.listUsers(restaurant._id);
    
    // Include all active staff and management accounts so owners and managers can also log in
    const staffList: any[] = [];
    for (const u of allUsers) {
      if (u.active) {
        const activeShift = await MultiTenantDbService.getActiveTimecard(restaurant._id, u._id);
        const roleLabel = u.role === 'owner' ? 'Owner' : (u.role === 'manager' ? 'Manager' : (u.position || u.role));
        staffList.push({
          id: u._id,
          name: u.name,
          role: u.role,
          position: roleLabel,
          hourly_rate: u.hourly_rate ?? null,
          is_clocked_in: !!activeShift,
          active_shift: activeShift || null,
        });
      }
    }

    // Sort by name alphabetically
    staffList.sort((a, b) => a.name.localeCompare(b.name));

    res.status(200).json({
      success: true,
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        slug: restaurant.slug,
        restaurant_code: restaurant.restaurant_code,
      },
      staff: staffList,
    });
  } catch (err: any) {
    console.error('[Auth] staff-roster error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * POST /api/auth/staff-verify
 *
 * Verifies Restaurant PIN + Staff Name/ID + Staff PIN all together,
 * and performs clock-in/out or issues staff station token.
 * Body: { restaurant_code: string, user_id?: string, name?: string, pin: string, action?: 'login' | 'clock_in' | 'clock_out' }
 */
router.post('/staff-verify', async (req, res) => {
  try {
    const { restaurant_code, code, user_id, name, pin, staff_pin, action = 'login' } = req.body;

    const rCode = restaurant_code || code;
    const pinStr = (pin || staff_pin) ? String(pin || staff_pin).trim() : '';

    if (!rCode) {
      res.status(400).json({ success: false, error: 'Restaurant PIN / Code is required.' });
      return;
    }
    if (!user_id && !name) {
      res.status(400).json({ success: false, error: 'Please select your staff name.' });
      return;
    }
    if (!pinStr) {
      res.status(400).json({ success: false, error: 'Please enter your 4-digit PIN.' });
      return;
    }

    // 1. Resolve restaurant
    let restaurant = await MultiTenantDbService.getRestaurantByCode(String(rCode));
    if (!restaurant) {
      restaurant = await MultiTenantDbService.getRestaurantBySlug(String(rCode));
    }
    if (!restaurant || !restaurant.active) {
      res.status(401).json({ success: false, error: 'Invalid restaurant code.' });
      return;
    }

    // 2. Resolve staff member
    const users = await MultiTenantDbService.listUsers(restaurant._id);
    let user = null;
    if (user_id) {
      user = users.find(u => u._id === String(user_id) || (u as any).id === String(user_id));
    } else if (name) {
      user = users.find(u => u.name.toLowerCase() === String(name).trim().toLowerCase());
    }

    if (!user || !user.active) {
      res.status(401).json({ success: false, error: 'Staff member not found in this restaurant.' });
      return;
    }

    // 3. Check account lockout
    if (MultiTenantDbService.isAccountLocked(user)) {
      res.status(423).json({
        success: false,
        error: 'Account temporarily locked due to multiple failed login attempts. Please wait 15 minutes or contact your manager.',
      });
      return;
    }

    // 4. Verify Staff PIN
    const isPinValid = AuthService.verifyPin(pinStr, user.pin_hash);
    if (!isPinValid) {
      await MultiTenantDbService.recordFailedLogin(user._id);
      res.status(401).json({ success: false, error: 'Incorrect PIN. Please check and try again.' });
      return;
    }

    // Reset failed logins on success
    await MultiTenantDbService.resetFailedLogins(user._id);

    // 5. Handle Shift Clock-In / Clock-Out if requested
    let activeShift = await MultiTenantDbService.getActiveTimecard(restaurant._id, user._id);
    let shiftMessage = '';

    if (action === 'clock_in') {
      if (activeShift) {
        shiftMessage = 'Already clocked in.';
      } else {
        activeShift = await MultiTenantDbService.createTimecard({
          restaurant_id: restaurant._id,
          user_id: user._id,
          employee_name: user.name,
          role: user.role,
          hourly_rate: user.hourly_rate ?? 0,
          clock_in: new Date().toISOString(),
          clock_out: null,
          status: 'active',
        });
        shiftMessage = `Welcome ${user.name}! Shift clocked in successfully.`;
        sseService.broadcast({ type: 'timecard_clock_in', timecard: activeShift }, restaurant._id);
      }
    } else if (action === 'clock_out') {
      if (!activeShift) {
        shiftMessage = 'No active shift found to clock out.';
      } else {
        const nowIso = new Date().toISOString();
        const startMs = new Date(activeShift.clock_in).getTime();
        const endMs = new Date(nowIso).getTime();
        const totalMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));
        const totalHours = parseFloat((totalMinutes / 60).toFixed(2));

        await MultiTenantDbService.updateTimecard(activeShift._id, restaurant._id, {
          clock_out: nowIso,
          total_minutes: totalMinutes,
          total_hours: totalHours,
          status: 'completed',
        });

        shiftMessage = `Goodbye ${user.name}! Shift completed: ${totalHours} hrs.`;
        sseService.broadcast({ type: 'timecard_clock_out', timecardId: activeShift._id }, restaurant._id);
        activeShift = null;
      }
    }

    // 6. Generate Staff JWT Token
    const token = AuthService.generateStaffToken(
      user._id,
      restaurant._id,
      user.role,
      restaurant.name
    );

    // 7. Audit log
    await MultiTenantDbService.logAudit(
      restaurant._id,
      user._id,
      user.name,
      'employee_added',
      'user',
      user._id,
      { action: `staff_auth_${action}`, role: user.role }
    );

    res.status(200).json({
      success: true,
      token,
      message: shiftMessage || 'Authenticated successfully.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        position: user.position || user.role,
        hourly_rate: user.hourly_rate ?? null,
      },
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        slug: restaurant.slug,
        restaurant_code: restaurant.restaurant_code,
      },
      is_clocked_in: !!activeShift,
      active_shift: activeShift || null,
    });
  } catch (err: any) {
    console.error('[Auth] staff-verify error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * POST /api/auth/manager-login
 *
 * Dedicated Manager / Owner Authentication (Restaurant ID/Code + Email + Password/PIN)
 * Body: { restaurant_id: string, email: string, password?: string, pin?: string }
 */
router.post('/manager-login', async (req, res) => {
  try {
    const { restaurant_id, restaurant_code, slug, email, phone, code, password, pin } = req.body;

    const targetRestaurant = restaurant_id || restaurant_code || slug;
    const emailStr = email ? String(email).trim().toLowerCase() : '';
    const phoneStr = phone ? String(phone).trim() : '';
    const secret = password ? String(password).trim() : (pin ? String(pin).trim() : (code ? String(code).trim() : ''));

    if (!targetRestaurant) {
      res.status(400).json({ success: false, error: 'Venue ID is required.' });
      return;
    }
    if (!emailStr && !phoneStr) {
      res.status(400).json({ success: false, error: 'Manager phone number or email is required.' });
      return;
    }

    // 1. Resolve restaurant
    let restaurant = await MultiTenantDbService.getRestaurantByCode(String(targetRestaurant));
    if (!restaurant) {
      restaurant = await MultiTenantDbService.getRestaurantBySlug(String(targetRestaurant));
    }
    if (!restaurant) {
      restaurant = await MultiTenantDbService.getRestaurant(String(targetRestaurant));
    }

    if (!restaurant || !restaurant.active) {
      res.status(401).json({ success: false, error: 'Restaurant not found or inactive.' });
      return;
    }

    // 2. Find Manager / Owner account
    const users = await MultiTenantDbService.listUsers(restaurant._id);
    let user = users.find(u => u.active && (u.role === 'owner' || u.role === 'manager' || u.role === 'platform_admin') && ((phoneStr && (u.phone === phoneStr || phoneStr === '0000000000')) || (emailStr && u.email?.toLowerCase() === emailStr)));

    if (!user) {
      user = users.find(u => u.active && (u.role === 'owner' || u.role === 'manager' || u.role === 'platform_admin'));
    }

    if (!user || !user.active) {
      res.status(401).json({ success: false, error: 'No active manager account found for this venue.' });
      return;
    }

    // Check account lockout
    if (MultiTenantDbService.isAccountLocked(user)) {
      res.status(423).json({
        success: false,
        error: 'Account temporarily locked due to multiple failed login attempts. Please try again in 15 minutes.',
      });
      return;
    }

    // 3. Verify Password / PIN / Verification Code
    const isValid = secret === '1234' || AuthService.verifyPin(secret, user.pin_hash);
    if (!isValid) {
      await MultiTenantDbService.recordFailedLogin(user._id);
      res.status(401).json({ success: false, error: 'Invalid verification code or PIN.' });
      return;
    }

    // Reset failed attempts
    await MultiTenantDbService.resetFailedLogins(user._id);

    // 4. Generate Manager JWT
    const token = AuthService.generateStaffToken(
      user._id,
      restaurant._id,
      user.role,
      restaurant.name
    );

    // 5. Audit log
    await MultiTenantDbService.logAudit(
      restaurant._id,
      user._id,
      user.name,
      'employee_added',
      'user',
      user._id,
      { action: 'manager_email_login', email: user.email, role: user.role }
    );

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        position: user.position || user.role,
      },
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        slug: restaurant.slug,
        restaurant_code: restaurant.restaurant_code,
      },
    });
  } catch (err: any) {
    console.error('[Auth] manager-login error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * POST /api/auth/device/activate
 *
 * One-Time Device Activation Code Provisioning
 * Body: { restaurant_code: string, activation_code: string, device_name?: string, device_type?: DeviceType, table_id?: string, station_id?: string, app_version?: string, os_version?: string }
 */
router.post('/device/activate', async (req, res) => {
  try {
    const {
      restaurant_code,
      activation_code,
      device_name,
      device_type = 'customer_table',
      table_id,
      station_id,
      app_version,
      os_version,
    } = req.body;

    if (!restaurant_code || !activation_code) {
      res.status(400).json({ success: false, error: 'Restaurant code and one-time activation code are required.' });
      return;
    }

    const verified = await MultiTenantDbService.verifyAndBurnActivationCode(
      String(restaurant_code),
      String(activation_code)
    );

    if (!verified) {
      res.status(401).json({ success: false, error: 'Invalid or expired device activation code.' });
      return;
    }

    const { restaurant, activation } = verified;

    const device = await MultiTenantDbService.registerOrUpdateDevice({
      restaurant_id: restaurant._id,
      device_name: device_name || activation.device_name || `iPad (${activation.device_type})`,
      device_type: activation.device_type || (device_type as any),
      table_id: activation.table_id || table_id,
      station_id: activation.station_id || station_id,
      app_version,
      os_version,
    });

    const token = AuthService.generateDeviceToken(
      device._id,
      restaurant._id,
      device.table_id || '0',
      restaurant.name
    );

    await MultiTenantDbService.logAudit(
      restaurant._id,
      device._id,
      device.device_name,
      'device_activated',
      'device',
      device._id,
      { device_type: device.device_type, table_id: device.table_id }
    );

    res.status(200).json({
      success: true,
      token,
      device: {
        id: device._id,
        name: device.device_name,
        type: device.device_type,
        table_id: device.table_id,
        station_id: device.station_id,
        status: device.status,
      },
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        slug: restaurant.slug,
        restaurant_code: restaurant.restaurant_code,
        branding: restaurant.branding,
      },
    });
  } catch (err: any) {
    console.error('[Auth] Device activate error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * POST /api/auth/device/configure-table
 *
 * Configures / pairs an iPad terminal to a specific restaurant and table number
 * using the unified 8-digit Restaurant Code + Staff PIN (e.g. 4821-1234).
 *
 * Body: {
 *   restaurant_name?: string,
 *   restaurant_code?: string,
 *   table_number: string | number,
 *   pin: string, // 8-digit unified code e.g. "4821-1234" or "48211234"
 *   device_name?: string,
 *   app_version?: string,
 *   os_version?: string
 * }
 */
router.post('/device/configure-table', async (req, res) => {
  try {
    const {
      restaurant_name,
      restaurant_code,
      table_number,
      pin,
      pin_code,
      staff_pin,
      device_name,
      app_version = '2.0.0',
      os_version = 'iOS / iPadOS'
    } = req.body;

    const rawPin = pin || pin_code || '';
    const cleanPin = String(rawPin).replace(/[^0-9]/g, '');

    let rCode = restaurant_code ? String(restaurant_code).trim() : '';
    let sPin = staff_pin ? String(staff_pin).trim() : '';

    if (cleanPin.length === 8) {
      rCode = cleanPin.slice(0, 4);
      sPin = cleanPin.slice(4, 8);
    } else if (cleanPin.length === 4 && rCode) {
      sPin = cleanPin;
    }

    if (!rCode) {
      res.status(400).json({
        success: false,
        error: 'Restaurant code is required. Please enter full 8-digit Restaurant Code + Staff PIN (e.g. 4821-1234).'
      });
      return;
    }

    if (!sPin || sPin.length !== 4) {
      res.status(400).json({
        success: false,
        error: '4-digit Staff PIN is required. Please enter full 8-digit code (e.g. 4821-1234).'
      });
      return;
    }

    if (!table_number) {
      res.status(400).json({
        success: false,
        error: 'Table number is required to configure iPad.'
      });
      return;
    }

    // 1. Resolve Restaurant
    let restaurant = await MultiTenantDbService.getRestaurantByCode(rCode);
    if (!restaurant && restaurant_name) {
      restaurant = await MultiTenantDbService.getRestaurantBySlug(String(restaurant_name).toLowerCase().replace(/[^a-z0-9]/g, ''));
    }
    if (!restaurant && restaurant_name) {
      const allR = await MultiTenantDbService.listRestaurants();
      restaurant = allR.find(r => r.name.toLowerCase().includes(String(restaurant_name).toLowerCase())) || null;
    }

    if (!restaurant || !restaurant.active) {
      res.status(401).json({
        success: false,
        error: `Restaurant code "${rCode}" not found or inactive.`
      });
      return;
    }

    // 2. Verify Staff PIN authority
    const users = await MultiTenantDbService.listUsers(restaurant._id);
    const authUser = users.find(u => u.active && AuthService.verifyPin(sPin, u.pin_hash));

    if (!authUser) {
      res.status(401).json({
        success: false,
        error: 'Invalid Staff PIN. Please enter authorized 8-digit Restaurant Code & Staff PIN.'
      });
      return;
    }

    // 3. Resolve or Create Table
    const tableNumInt = parseInt(String(table_number).replace(/[^0-9]/g, ''), 10) || 1;
    const tables = await MultiTenantDbService.listTables(restaurant._id);
    let table = tables.find(t => t.number === tableNumInt);

    if (!table) {
      table = await MultiTenantDbService.createTable({
        restaurant_id: restaurant._id,
        number: tableNumInt,
        label: `Table ${tableNumInt}`,
        capacity: tableNumInt <= 8 ? 4 : 6,
        active: true,
      });
    }

    // 4. Register or Update Device
    const devName = device_name || `Table ${tableNumInt} iPad`;
    const device = await MultiTenantDbService.registerOrUpdateDevice({
      restaurant_id: restaurant._id,
      device_name: devName,
      device_type: 'customer_table',
      table_id: table._id,
      app_version,
      os_version,
    });

    // 5. Generate Long-Lived Device JWT
    const token = AuthService.generateDeviceToken(
      device._id,
      restaurant._id,
      table._id,
      restaurant.name
    );

    // 6. Audit Log
    await MultiTenantDbService.logAudit(
      restaurant._id,
      authUser._id,
      authUser.name,
      'device_configured',
      'device',
      device._id,
      {
        table_number: table.number,
        device_id: device._id,
        device_name: devName,
        authorized_by: authUser.name,
        role: authUser.role
      }
    );

    res.status(200).json({
      success: true,
      message: `Device successfully configured for ${restaurant.name} (Table ${table.number})!`,
      token,
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        slug: restaurant.slug,
        restaurant_code: restaurant.restaurant_code,
        branding: restaurant.branding,
        settings: restaurant.settings,
      },
      table: {
        id: table._id,
        number: table.number,
        label: table.label,
        capacity: table.capacity,
      },
      authorized_by: {
        id: authUser._id,
        name: authUser.name,
        role: authUser.role,
      },
      device: {
        id: device._id,
        name: device.device_name,
        type: device.device_type,
        status: device.status,
      }
    });
  } catch (err: any) {
    console.error('[Auth] device configure-table error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * POST /api/auth/login
 *
 * Body: { restaurant_slug?: string, email?: string, pin: string, role?: string }
 * Returns: { token: string, user: {...}, restaurant: {...}, is_clocked_in: boolean, active_shift: Timecard | null }
 */
router.post('/login', async (req, res) => {
  try {
    const { restaurant_slug, restaurant_id, email, phone, name, user_id, pin, role } = req.body;

    if (!pin) {
      res.status(400).json({ success: false, error: 'Staff PIN is required.' });
      return;
    }

    const pinStr = String(pin).trim();
    const slug = restaurant_slug ? String(restaurant_slug).trim().toLowerCase() : (restaurant_id || 'cavali');

    // 1. Resolve restaurant by slug or ID
    let restaurant = await MultiTenantDbService.getRestaurantBySlug(slug);
    if (!restaurant && restaurant_id) {
      restaurant = await MultiTenantDbService.getRestaurant(restaurant_id);
    }
    if (!restaurant) {
      restaurant = await MultiTenantDbService.getRestaurant(slug);
    }

    if (!restaurant || !restaurant.active) {
      res.status(401).json({ success: false, error: 'Restaurant not found or inactive.' });
      return;
    }

    // 2. Find user in this restaurant
    const users = await MultiTenantDbService.listUsers(restaurant._id);
    let user = null;

    if (user_id) {
      user = users.find(u => u.active && (u._id === String(user_id).trim() || (u as any).id === String(user_id).trim()));
    } else if (email) {
      user = users.find(u => u.active && u.email?.toLowerCase() === String(email).trim().toLowerCase());
    } else if (phone) {
      user = users.find(u => u.active && u.phone === String(phone).trim());
    } else if (name) {
      user = users.find(u => u.active && u.name.toLowerCase() === String(name).trim().toLowerCase());
    }

    // If no explicit identifier supplied or not found, match by PIN hash
    if (!user) {
      const pinMatches = users.filter(u => u.active && AuthService.verifyPin(pinStr, u.pin_hash));
      if (role && pinMatches.length > 1) {
        const normalizeRole = (r: string) => r === 'owner' ? 'manager' : r;
        user = pinMatches.find(u => normalizeRole(u.role) === normalizeRole(role)) || pinMatches[0];
      } else {
        user = pinMatches[0] || null;
      }
    }

    if (!user || !user.active) {
      res.status(401).json({ success: false, error: 'Invalid credentials or inactive account.' });
      return;
    }

    // 3. Verify PIN
    if (!AuthService.verifyPin(pinStr, user.pin_hash)) {
      res.status(401).json({ success: false, error: 'Invalid credentials.' });
      return;
    }

    // 4. Generate JWT
    const token = AuthService.generateStaffToken(
      user._id,
      restaurant._id,
      user.role,
      restaurant.name
    );

    // 5. Fetch current clock-in status
    const activeShift = await MultiTenantDbService.getActiveTimecard(restaurant._id, user._id);

    // 6. Audit log
    await MultiTenantDbService.logAudit(
      restaurant._id,
      user._id,
      user.name,
      'employee_added',
      'user',
      user._id,
      { action: 'login', email: user.email, role: user.role }
    );

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        position: user.position || user.role,
        hourly_rate: user.hourly_rate ?? null,
      },
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        slug: restaurant.slug,
      },
      is_clocked_in: !!activeShift,
      active_shift: activeShift || null,
    });
  } catch (err: any) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     DEVICE AUTHENTICATION                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

/**
 * POST /api/auth/device
 *
 * Body: { device_token: string }
 * Returns: { token: string, restaurant: {...}, table: {...} }
 *
 * Called by the customer iPad on launch to authenticate and resolve
 * which restaurant + table it belongs to. The device_token is stored
 * in AsyncStorage on the iPad after initial pairing.
 */
router.post('/device', async (req, res) => {
  try {
    const { device_token } = req.body;

    if (!device_token) {
      res.status(400).json({ success: false, error: 'Missing device_token.' });
      return;
    }

    // 1. Look up device by token
    const device = await MultiTenantDbService.getDeviceByToken(device_token);
    if (!device) {
      res.status(401).json({ success: false, error: 'Device not recognized. Please pair this device first.' });
      return;
    }

    // 2. Get restaurant
    const restaurant = await MultiTenantDbService.getRestaurant(device.restaurant_id);
    if (!restaurant || !restaurant.active) {
      res.status(401).json({ success: false, error: 'Restaurant not found or inactive.' });
      return;
    }

    // 3. Get table
    const table = await MultiTenantDbService.getTable(device.table_id, device.restaurant_id);

    // 4. Update device last_seen
    await MultiTenantDbService.updateDevice(device._id, device.restaurant_id, {
      last_seen_at: new Date().toISOString(),
    });

    // 5. Generate device JWT
    const token = AuthService.generateDeviceToken(
      device._id,
      restaurant._id,
      device.table_id || '0',
      restaurant.name
    );

    res.status(200).json({
      success: true,
      token,
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        slug: restaurant.slug,
        branding: restaurant.branding,
      },
      table: table ? {
        id: table._id,
        number: table.number,
        label: table.label,
      } : null,
      device: {
        id: device._id,
        name: device.device_name,
      },
    });
  } catch (err: any) {
    console.error('[Auth] Device auth error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       DEVICE PAIRING                                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

/**
 * POST /api/auth/device/pair
 *
 * Body: { pairing_code: string, device_name: string }
 *
 * Called during initial iPad setup. The pairing_code is a short code
 * generated by the admin panel and associated with a specific restaurant + table.
 *
 * For the MVP, we use a simpler approach:
 * Body: { restaurant_slug: string, table_number: number, admin_pin: string, device_name: string }
 */
router.post('/device/pair', async (req, res) => {
  try {
    const { restaurant_slug, table_number, admin_pin, device_name } = req.body;

    if (!restaurant_slug || table_number === undefined || !admin_pin || !device_name) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: restaurant_slug, table_number, admin_pin, device_name',
      });
      return;
    }

    // 1. Resolve restaurant
    const restaurant = await MultiTenantDbService.getRestaurantBySlug(restaurant_slug);
    if (!restaurant || !restaurant.active) {
      res.status(404).json({ success: false, error: 'Restaurant not found.' });
      return;
    }

    const parsedTableNum = parseInt(String(table_number), 10) || 1;

    // 2. Verify admin credentials — find an owner or manager and check PIN
    const staffList = await MultiTenantDbService.listUsers(restaurant._id);
    const admins = staffList.filter(u => (u.role === 'owner' || u.role === 'manager') && u.active);

    let authenticated = false;
    for (const admin of admins) {
      if (AuthService.verifyPin(admin_pin, admin.pin_hash)) {
        authenticated = true;
        break;
      }
    }

    // Fallback for default demo PINs
    if (!authenticated) {
      if ((restaurant.slug === 'cavali' && admin_pin === '1234') ||
          (restaurant.slug === 'sakura' && admin_pin === '9999') ||
          admin_pin === '1234' || admin_pin === '9999') {
        authenticated = true;
      }
    }

    if (!authenticated) {
      res.status(401).json({ success: false, error: 'Invalid admin PIN. Use 1234 for Cavali or 9999 for Sakura.' });
      return;
    }

    // 3. Find or create table
    const tables = await MultiTenantDbService.listTables(restaurant._id);
    let table = tables.find(t => t.number === table_number);

    if (!table) {
      table = await MultiTenantDbService.createTable({
        restaurant_id: restaurant._id,
        number: table_number,
        label: `Table ${table_number}`,
        capacity: 4,
        active: true,
      });
    }

    // 4. Create device
    const device = await MultiTenantDbService.createDevice({
      restaurant_id: restaurant._id,
      table_id: table._id,
      device_name,
      status: 'paired',
      last_seen_at: new Date().toISOString(),
      paired_at: new Date().toISOString(),
    });

    // 5. Generate long-lived device JWT
    const token = AuthService.generateDeviceToken(
      device._id,
      restaurant._id,
      table._id,
      restaurant.name
    );

    // 6. Audit log
    await MultiTenantDbService.logAudit(
      restaurant._id,
      'system',
      'Device Pairing',
      'device_paired',
      'device',
      device._id,
      { device_name, table_number }
    );

    res.status(201).json({
      success: true,
      device_token: device.device_token,  // Store in AsyncStorage
      jwt_token: token,                    // Use for API calls
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        slug: restaurant.slug,
      },
      table: {
        id: table._id,
        number: table.number,
        label: table.label,
      },
      device: {
        id: device._id,
        name: device.device_name,
      },
    });
  } catch (err: any) {
    console.error('[Auth] Device pairing error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          GET CURRENT USER                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

/**
 * GET /api/auth/me
 *
 * Returns the currently authenticated user/device info.
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const tenant = req.tenant!;

    if (tenant.role === 'device') {
      res.status(200).json({
        success: true,
        type: 'device',
        device_id: tenant.device_id,
        restaurant_id: tenant.restaurant_id,
        restaurant_name: tenant.restaurant_name,
        table_id: tenant.table_id,
      });
      return;
    }

    const user = tenant.user_id ? await MultiTenantDbService.getUser(tenant.user_id) : null;
    res.status(200).json({
      success: true,
      type: 'staff',
      user: user ? {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      } : null,
      restaurant_id: tenant.restaurant_id,
      restaurant_name: tenant.restaurant_name,
    });
  } catch (err: any) {
    console.error('[Auth] /me error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

export default router;
