import { RequestHandler } from 'express';
import { storage } from './storage.js';

// Simple auth middleware - comme incub-agri
export const requireAuth: RequestHandler = (req: any, res, next) => {
  if (req.session?.adminId) {
    req.admin = req.session.admin;
    next();
  } else {
    res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }
};

// Simple login handler
export async function handleLogin(req: any, res: any) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password required'
    });
  }

  try {
    // Use the existing validateAdminCredentials method from storage
    const admin = await storage.validateAdminCredentials(username, password);
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Simple session creation
    req.session.adminId = admin.id;
    req.session.admin = {
      id: admin.id,
      username: admin.username,
      email: admin.email
    };

    res.json({
      success: true,
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}

// Simple logout handler
export function handleLogout(req: any, res: any) {
  req.session.destroy((err: any) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({
        success: false,
        message: 'Logout failed'
      });
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  });
}

// Simple auth check
export function handleAuthCheck(req: any, res: any) {
  if (req.session?.adminId && req.session?.admin) {
    res.json({
      success: true,
      admin: req.session.admin
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Not authenticated'
    });
  }
}