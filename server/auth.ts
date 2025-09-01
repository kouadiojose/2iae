import { RequestHandler } from 'express';
import { storage } from './storage.js';

// Simple auth middleware - comme incub-agri
// 🚫 TEMPORAIREMENT DÉSACTIVÉ POUR DÉVELOPPEMENT
export const requireAuth: RequestHandler = (req: any, res, next) => {
  // BYPASS AUTH - Allow all requests
  req.admin = {
    id: 'temp-admin',
    username: 'admin',
    email: 'admin@2iae.com'
  };
  next();
  
  /* RÉACTIVER PLUS TARD:
  if (req.session?.adminId) {
    req.admin = req.session.admin;
    next();
  } else {
    res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }
  */
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
// 🚫 TEMPORAIREMENT DÉSACTIVÉ POUR DÉVELOPPEMENT
export function handleAuthCheck(req: any, res: any) {
  // BYPASS AUTH - Always return authenticated
  res.json({
    success: true,
    admin: {
      id: 'temp-admin',
      username: 'admin',
      email: 'admin@2iae.com'
    }
  });
  
  /* RÉACTIVER PLUS TARD:
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
  */
}