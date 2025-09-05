import { RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import { storage } from './storage.js';

// Create PostgreSQL session store
const PostgreSQLStore = connectPg(session);

// Session configuration for production
export function getSessionConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  const sessionSecret = process.env.SESSION_SECRET || 'votre-secret-super-securise-2iae-admin';
  
  return {
    store: new PostgreSQLStore({
      conString: process.env.DATABASE_URL,
      tableName: 'session',
      createTableIfMissing: true,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: '2iae_admin_session',
    cookie: {
      secure: isProduction, // HTTPS only in production
      httpOnly: true, // Prevent XSS
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: isProduction ? 'strict' : 'lax' as const
    },
    rolling: true // Reset expiry on activity
  };
}

// Hash password using bcrypt
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

// Verify password
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// 🔐 SECURE AUTH MIDDLEWARE - NOW ACTIVE
export const requireAuth: RequestHandler = (req: any, res, next) => {
  if (req.session?.adminId && req.session?.admin) {
    req.admin = req.session.admin;
    next();
  } else {
    res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }
};

// 🔐 SECURE LOGIN HANDLER
export async function handleLogin(req: any, res: any) {
  const { username, password } = req.body;

  // Validate inputs
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Nom d\'utilisateur et mot de passe requis'
    });
  }

  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Données invalides'
    });
  }

  try {
    // Use existing storage validation method
    const admin = await storage.validateAdminCredentials(username, password);
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }

    // Create secure session
    req.session.adminId = admin.id;
    req.session.admin = {
      id: admin.id,
      username: admin.username,
      email: admin.email
    };

    // Session created successfully

    res.json({
      success: true,
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email
      },
      message: 'Connexion réussie'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
}

// 🔐 SECURE LOGOUT HANDLER
export function handleLogout(req: any, res: any) {
  req.session.destroy((err: any) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la déconnexion'
      });
    }
    
    // Clear cookie
    res.clearCookie('2iae_admin_session');
    
    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });
  });
}

// 🔐 SECURE AUTH CHECK - NOW ACTIVE
export function handleAuthCheck(req: any, res: any) {
  if (req.session?.adminId && req.session?.admin) {
    res.json({
      success: true,
      admin: req.session.admin
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Non authentifié'
    });
  }
}

// Create first admin user if none exists
export async function ensureAdminExists() {
  try {
    const adminUser = await storage.getAdminUserByUsername('admin');
    if (!adminUser) {
      // createAdminUser already hashes the password, no need to hash here
      await storage.createAdminUser({
        username: 'admin',
        password: 'admin2iae2024!', // Pass plain password, storage will hash it
        email: 'admin@2iae.com'
      });
      console.log('✅ Admin par défaut créé: admin / admin2iae2024!');
    }
  } catch (error) {
    console.error('Erreur lors de la création de l\'admin par défaut:', error);
  }
}