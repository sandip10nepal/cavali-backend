/**
 * Device Management Routes
 *
 * Provides device provisioning (one-time activation codes), device lifecycle management,
 * heartbeat monitoring, and status controls for restaurant administrators.
 */

import { Router } from 'express';
import { MultiTenantDbService } from '../services/multi-tenant-db.service';
import { requireAuth, requirePermission, requireRole } from '../middleware/tenant.middleware';
import { sseService } from '../services/sse.service';
import type { DeviceType, DeviceLifecycleStatus } from '../models/types';

const router = Router();

/**
 * POST /api/devices/activation-code
 *
 * Generates a 6-digit one-time device activation code (valid for 15 minutes).
 * Used by managers/owners to provision new iPad terminals or station screens.
 */
router.post('/activation-code', requireAuth, requireRole('owner', 'manager', 'platform_admin'), async (req, res) => {
  try {
    const tenant = req.tenant!;
    const { device_type = 'customer_table', device_name, table_id, station_id } = req.body;

    const restaurant = await MultiTenantDbService.getRestaurant(tenant.restaurant_id);
    if (!restaurant) {
      res.status(404).json({ success: false, error: 'Restaurant tenant not found.' });
      return;
    }

    const activation = await MultiTenantDbService.generateDeviceActivationCode(
      tenant.restaurant_id,
      device_type as DeviceType,
      device_name || `iPad ${table_id ? `Table ${table_id}` : device_type}`,
      table_id ? String(table_id) : undefined,
      station_id ? String(station_id) : undefined,
      tenant.user_id || 'manager'
    );

    res.status(201).json({
      success: true,
      activation_code: activation.code,
      restaurant_code: restaurant.restaurant_code,
      restaurant_name: restaurant.name,
      device_type: activation.device_type,
      device_name: activation.device_name,
      table_id: activation.table_id,
      station_id: activation.station_id,
      expires_at: activation.expires_at,
    });
  } catch (err: any) {
    console.error('[Devices] Activation code generation error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * GET /api/devices
 *
 * Lists all paired devices for the current restaurant tenant with live status.
 */
router.get('/', requireAuth, requireRole('owner', 'manager', 'platform_admin'), async (req, res) => {
  try {
    const tenant = req.tenant!;
    const devices = await MultiTenantDbService.listDevices(tenant.restaurant_id);
    const now = Date.now();

    const formatted = devices.map(d => {
      const lastSeenMs = new Date(d.last_seen_at || d.paired_at).getTime();
      const isOnline = now - lastSeenMs < 60000 && d.status === 'ACTIVE'; // Active within last 60 seconds

      return {
        id: d._id,
        name: d.device_name,
        type: d.device_type,
        table_id: d.table_id || null,
        station_id: d.station_id || null,
        status: d.status,
        is_online: isOnline,
        last_seen_at: d.last_seen_at,
        app_version: d.app_version || '1.0.0',
        os_version: d.os_version || 'Unknown',
        last_activity: d.last_activity || 'Active',
        paired_at: d.paired_at,
      };
    });

    res.status(200).json({
      success: true,
      devices: formatted,
    });
  } catch (err: any) {
    console.error('[Devices] List devices error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * PATCH /api/devices/:id
 *
 * Updates device settings (name, table assignment, station, or status).
 */
router.patch('/:id', requireAuth, requireRole('owner', 'manager', 'platform_admin'), async (req, res) => {
  try {
    const tenant = req.tenant!;
    const id = String(req.params.id);
    const { device_name, device_type, table_id, station_id, status } = req.body;

    const device = await MultiTenantDbService.getDevice(id);
    if (!device || device.restaurant_id !== tenant.restaurant_id) {
      res.status(404).json({ success: false, error: 'Device not found.' });
      return;
    }

    const updates: Partial<any> = {};
    if (device_name !== undefined) updates.device_name = String(device_name).trim();
    if (device_type !== undefined) updates.device_type = device_type;
    if (table_id !== undefined) updates.table_id = String(table_id).trim();
    if (station_id !== undefined) updates.station_id = String(station_id).trim();
    if (status !== undefined) updates.status = status as DeviceLifecycleStatus;

    await MultiTenantDbService.updateDevice(id, tenant.restaurant_id, updates);

    await MultiTenantDbService.logAudit(
      tenant.restaurant_id,
      tenant.user_id || 'manager',
      tenant.role,
      'device_updated',
      'device',
      id,
      updates
    );

    sseService.broadcast({ type: 'device_updated', deviceId: id, updates }, tenant.restaurant_id);

    res.status(200).json({
      success: true,
      message: 'Device updated successfully.',
      device: { ...device, ...updates },
    });
  } catch (err: any) {
    console.error('[Devices] Update device error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * DELETE /api/devices/:id
 *
 * Revokes a device (prevents any further API calls or orders from this device).
 */
router.delete('/:id', requireAuth, requireRole('owner', 'manager', 'platform_admin'), async (req, res) => {
  try {
    const tenant = req.tenant!;
    const id = String(req.params.id);

    const device = await MultiTenantDbService.getDevice(id);
    if (!device || device.restaurant_id !== tenant.restaurant_id) {
      res.status(404).json({ success: false, error: 'Device not found.' });
      return;
    }

    await MultiTenantDbService.revokeDevice(id, tenant.restaurant_id);

    await MultiTenantDbService.logAudit(
      tenant.restaurant_id,
      tenant.user_id || 'manager',
      tenant.role,
      'device_revoked',
      'device',
      id,
      { device_name: device.device_name }
    );

    sseService.broadcast({ type: 'device_revoked', deviceId: id }, tenant.restaurant_id);

    res.status(200).json({
      success: true,
      message: 'Device has been permanently revoked.',
    });
  } catch (err: any) {
    console.error('[Devices] Revoke device error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * POST /api/devices/heartbeat
 *
 * Heartbeat endpoint for active iPad tablets and station screens.
 * iPad calls this every 30 seconds to report online status, battery, app version, and OS.
 */
router.post('/heartbeat', async (req, res) => {
  try {
    const { device_id, device_token, app_version, os_version } = req.body;
    const targetId = device_id || device_token;

    if (targetId) {
      await MultiTenantDbService.recordDeviceHeartbeat(String(targetId), app_version, os_version);
    }

    res.status(200).json({
      success: true,
      status: 'OK',
      server_time: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Devices] Heartbeat error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

export default router;
