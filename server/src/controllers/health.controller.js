import { isDatabaseConnected } from '../config/db.js';

export function getHealth(req, res) {
  const connected = isDatabaseConnected();
  const data = {
    status: connected ? 'ok' : 'degraded',
    uptime: Math.round(process.uptime()),
    database: connected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  };

  if (!connected) {
    return res.status(503).json({
      success: false,
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Database is not connected.' },
      data,
    });
  }
  return res.status(200).json({ success: true, data });
}
