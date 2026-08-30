import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContactSchema, insertChatMessageSchema, insertSiteContentSchema, updateSiteContentSchema, insertSliderSchema, updateSliderSchema, insertFounderMessageSchema, updateFounderMessageSchema, insertInstituteSchema, updateInstituteSchema, insertProgramSchema, updateProgramSchema, insertNewsSchema, updateNewsSchema, insertProjectSchema, updateProjectSchema, insertTariffSchema, updateTariffSchema, insertAlbumSchema, updateAlbumSchema, insertGalleryItemSchema, updateGalleryItemSchema } from "@shared/schema";
import { z } from "zod";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import multer from "multer";
import { randomUUID } from "crypto";
import { enregistrerRoutesFacebook } from "./facebook/routes";

// Pour ES modules, obtenir __dirname équivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Répertoire des uploads : chemin stable quel que soit le mode (dev via tsx,
// prod via le bundle dist/index.js où __dirname pointerait vers dist/).
// Sur Railway, montez un volume ici (ou définissez UPLOADS_DIR) pour la persistance.
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'server', 'uploads');

// Joint des segments à une racine en refusant toute sortie de la racine
// (protection contre la traversée de répertoire type "../../etc/passwd").
function safeJoin(root: string, ...segments: string[]): string | null {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, ...segments);
  if (target !== resolvedRoot && !target.startsWith(resolvedRoot + path.sep)) {
    return null;
  }
  return target;
}

// Function to generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    // Replace accented characters
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ýÿ]/g, 'y')
    .replace(/[ñ]/g, 'n')
    .replace(/[ç]/g, 'c')
    // Remove special characters and replace spaces with hyphens
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Configure multer for physical file storage in /server/uploads/
// Configuration pour upload direct vers DigitalOcean Spaces
const uploadConfig = multer({
  storage: multer.memoryStorage(), // Stockage en mémoire pour upload direct
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé. Utilisez JPG, PNG, GIF ou WebP.'));
    }
  }
});

// DIGITALOCEAN SPACES CONFIGURATION
import AWS from 'aws-sdk';

// Configuration DigitalOcean Spaces (compatible S3)
// Extraire le domaine propre de l'endpoint
const rawEndpoint = process.env.DO_SPACES_ENDPOINT || 'https://nyc3.digitaloceanspaces.com';
const spacesEndpoint = rawEndpoint.replace('https://', '').replace(/^[^.]+\./, ''); // Enlever https:// et le nom du bucket
const s3 = new AWS.S3({
  endpoint: `https://${spacesEndpoint}`,
  accessKeyId: process.env.DO_SPACES_KEY,
  secretAccessKey: process.env.DO_SPACES_SECRET,
  region: 'us-east-1',
  s3ForcePathStyle: false,
  signatureVersion: 'v4'
});

// Fonction pour upload direct vers DigitalOcean Spaces
async function uploadToDigitalOceanSpaces(file: Express.Multer.File, subFolder: string): Promise<string> {
  try {
    const bucketName = process.env.DO_SPACES_BUCKET;
    if (!bucketName || !process.env.DO_SPACES_KEY || !process.env.DO_SPACES_SECRET) {
      throw new Error('DigitalOcean Spaces non configuré');
    }

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const ext = path.extname(file.originalname);
    const filename = `${subFolder.slice(0, -1)}_${timestamp}_${randomId}${ext}`;
    const key = `${subFolder}/${filename}`;

    console.log(`🚀 Upload vers DigitalOcean Spaces: ${key}`);

    const uploadParams = {
      Bucket: bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read' // Images publiques
    };

    const result = await s3.upload(uploadParams).promise();
    console.log(`✅ Upload DigitalOcean Spaces réussi: ${result.Location}`);
    
    return result.Location; // URL publique complète
    
  } catch (error) {
    console.error(`💥 Erreur upload DigitalOcean Spaces:`, error);
    throw error;
  }
}

// Utilisation de la même configuration pour tous les uploads
const slidersUpload = uploadConfig;
const newsUpload = uploadConfig;
const founderUpload = uploadConfig;
const programsUpload = uploadConfig;
const projectsUpload = uploadConfig;

// Legacy configurations removed - now using createUploadConfig() function above

// Physical file upload helper - stores files in /server/uploads/
function getFileUrl(filename: string, folder: string): string {
  return `/api/assets/${folder}/${filename}`;
}

// Function to generate presigned URL for object storage
async function generatePresignedUrl(bucketName: string, objectName: string): Promise<string> {
  const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
  
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method: "PUT",
    expires_at: new Date(Date.now() + 900 * 1000).toISOString(), // 15 minutes
  };

  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`
    );
  }

  const { signed_url: signedURL } = await response.json();
  return signedURL;
}

// Client OpenAI initialisé à la demande : évite un crash au démarrage
// quand OPENAI_API_KEY n'est pas configurée (le chatbot renvoie alors une erreur propre).
let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY n'est pas configurée");
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

const SYSTEM_PROMPT = `Tu es l'assistant virtuel officiel de 2IAE International (Groupe Écoles 2IAE International), une institution d'enseignement supérieur spécialisée dans l'entrepreneuriat située à Abidjan, Côte d'Ivoire.

INFORMATIONS CLÉS SUR 2IAE INTERNATIONAL:

IDENTITÉ & MISSION:
- Nom officiel: Groupe Écoles 2IAE International
- Slogan: "2IAE, entreprendre pour devenir l'élite de demain"
- Mission: Former des entrepreneurs capables de transformer l'économie africaine
- Vision: Combler le vide dans la formation entrepreneuriale en Côte d'Ivoire

LOCALISATION & CONTACT:
- Adresse: Riviera Palmeraie, rue ministère, centre de pharmacie, carrefour MACI CANARA (Siège), Abidjan
- Téléphone: (+225) 27 22 81 87 76, (+225) 07 57 82 82, (+225) 06 05 29 28
- Email: contact@2iae.com, info@2iae.com, admissions@2iae.com
- Horaires: Lun-Ven: 8h-18h, Samedi: 8h-14h, Dimanche: Fermé

PROGRAMMES DE FORMATION:
1. Management et Entrepreneuriat (3 ans, Post-BTS)
   - Création et gestion d'entreprise
   - Leadership et management d'équipes
   - Innovation et développement produit
   - Débouchés: Entrepreneur, Directeur Général, Consultant

2. Marketing Digital & E-Commerce (2 ans, Post-BTS)
   - Stratégies digitales avancées
   - Gestion des réseaux sociaux
   - E-commerce et marketplace
   - Débouchés: Digital Manager, E-commerce Manager, Growth Hacker

3. Gestion des Entreprises (3 ans, Post-BTS)
   - Gestion financière avancée
   - Contrôle de gestion
   - Ressources humaines
   - Débouchés: Contrôleur de Gestion, Directeur Financier, Auditeur

INSTITUTS SPÉCIALISÉS:
- Institut de Formation en Management
- Institut de Formation aux Nouvelles Technologies
- Institut de Formation Agricole

AVANTAGES PÉDAGOGIQUES:
- Diplômes homologués avec reconnaissance internationale
- Partenariat avec l'Université de Sherbrooke, Canada
- Classes réduites (25 étudiants maximum)
- Stages garantis dans 50+ entreprises partenaires
- Formation digitalisée avec technologies éducatives de pointe
- Centre d'incubation opérationnel
- Campus moderne de 5000m² avec 25+ salles équipées

INFRASTRUCTURES CAMPUS:
- Amphithéâtres et salles modernes
- Bibliothèque avec 10,000+ ouvrages
- Laboratoire informatique (50 postes)
- Centre d'incubation pour startups
- Espaces de détente et coworking
- WiFi gratuit, parking sécurisé
- Sécurité 24/7

CITATIONS DU FONDATEUR:
"Si en Côte D'Ivoire, les Écoles et les Universités ont réussi dans les programmes de formation des cadres, les moyennes et grandes entreprises, elles ont connu moins de succès dans les programmes destinés aux cadres des petites entreprises, et moins encore dans la formation d'entrepreneurs."

INSTRUCTIONS DE RÉPONSE:
- Réponds toujours en français
- Sois professionnel, bienveillant et informatif
- Utilise les informations exactes fournies ci-dessus
- Si une question sort du cadre de 2IAE, redirige poliment vers les sujets de l'école
- Encourage les visiteurs à prendre contact pour plus d'informations
- Mets en avant l'excellence et le caractère innovant de l'institution`;

export async function registerRoutes(app: Express): Promise<Server> {
  // CORS middleware for object storage
  app.use('/api/object-storage/*', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Proxy route for Object Storage files (handles bucket public access prevention)
  app.get("/api/object-storage/:folderName/:fileName", async (req, res) => {
    try {
      const { folderName, fileName } = req.params;
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      
      if (!bucketId) {
        return res.status(500).json({ error: "Object storage not configured" });
      }
      
      const objectPath = `public/${folderName}/${fileName}`;
      
      // Generate presigned URL for downloading (10 minutes for reliability)
      const downloadRequest = {
        bucket_name: bucketId,
        object_name: objectPath,
        method: "GET",
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      };
      
      const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
      const response = await fetch(
        `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(downloadRequest),
        }
      );
      
      if (!response.ok) {
        return res.status(404).json({ error: "Image not found" });
      }
      
      const { signed_url: signedURL } = await response.json();
      
      // Fetch and serve the file directly with proper headers
      const fileResponse = await fetch(signedURL);
      
      if (!fileResponse.ok) {
        return res.status(404).json({ error: "Image not found" });
      }
      
      // Set headers before piping
      res.set({
        'Content-Type': fileResponse.headers.get('content-type') || 'image/jpeg',
        'Content-Length': fileResponse.headers.get('content-length') || '',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*'
      });
      
      console.log(`🎯 Serving image directly: ${objectPath}`);
      
      // Convert to buffer and send
      const arrayBuffer = await fileResponse.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
      
    } catch (error) {
      console.error("Error serving object storage file:", error);
      res.status(500).json({ error: "Error loading image" });
    }
  });

  // Serve legacy assets (anciennes images seulement - nouvelles images sont sur DigitalOcean Spaces)
  app.get("/api/assets/*", async (req, res) => {
    const filePath = decodeURIComponent(req.path.replace("/api/assets/", ""));
    console.log(`🔍 [LEGACY] Serving old asset: ${filePath}`);

    // PRIORITÉ 1: Stockage physique local (temporaire)
    const uploadPath = safeJoin(UPLOADS_DIR, filePath);
    if (uploadPath && fs.existsSync(uploadPath)) {
      console.log(`✅ Serving from local storage: ${uploadPath}`);
      return res.sendFile(uploadPath);
    }

    // PRIORITÉ 2: attached_assets (legacy)
    const localPath = safeJoin(path.join(process.cwd(), "attached_assets"), filePath);
    if (localPath && fs.existsSync(localPath)) {
      console.log(`✅ Serving from attached_assets: ${localPath}`);
      return res.sendFile(localPath);
    }
    
    // File not found in all locations
    console.log(`❌ [LEGACY] File not found: ${filePath}`);
    res.status(404).json({ error: "File not found" });
  });

  // Public object serving endpoint (legacy)
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    const publicPath = process.env.PUBLIC_OBJECT_SEARCH_PATHS;
    
    if (!bucketId || !publicPath) {
      return res.status(404).json({ error: "Object storage not configured" });
    }

    // For simplicity, redirect to the direct GCS URL
    const objectUrl = `https://storage.googleapis.com/${bucketId}/public/${filePath}`;
    res.redirect(objectUrl);
  });


  // Contact form submission
  app.post("/api/contact", async (req, res) => {
    try {
      const validatedData = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(validatedData);
      res.json({ success: true, contact });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          success: false, 
          message: "Données invalides",
          errors: error.errors 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "Erreur interne du serveur" 
        });
      }
    }
  });

  // Get all contacts (for admin purposes)
  app.get("/api/contacts", async (req, res) => {
    try {
      const contacts = await storage.getContacts();
      res.json({ success: true, contacts });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: "Erreur lors de la récupération des contacts" 
      });
    }
  });

  // Chatbot endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, sessionId } = req.body;
      
      if (!message || !sessionId) {
        return res.status(400).json({
          success: false,
          message: "Message et sessionId requis"
        });
      }

      // Get conversation history
      const chatHistory = await storage.getChatMessages(sessionId);
      
      // Build conversation context
      const messages: any[] = [
        { role: "system", content: SYSTEM_PROMPT }
      ];
      
      // Add previous conversation
      chatHistory.forEach(chat => {
        messages.push({ role: "user", content: chat.message });
        messages.push({ role: "assistant", content: chat.response });
      });
      
      // Add current message
      messages.push({ role: "user", content: message });

      // Get response from OpenAI
      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        max_tokens: 500,
        temperature: 0.7,
      });

      const response = completion.choices[0].message.content || "Désolé, je n'ai pas pu traiter votre demande.";

      // Save conversation
      await storage.createChatMessage({
        sessionId,
        message,
        response
      });

      res.json({ 
        success: true, 
        response 
      });
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erreur lors du traitement de votre message" 
      });
    }
  });

  // Get chat history
  app.get("/api/chat/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const chatHistory = await storage.getChatMessages(sessionId);
      res.json({ success: true, chatHistory });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: "Erreur lors de la récupération de l'historique" 
      });
    }
  });

  // Test route
  app.get("/api/test", (req, res) => {
    res.json({ message: "Server is working!" });
  });

  // Simple auth routes
  const { requireAuth, handleLogin, handleLogout, handleAuthCheck } = await import('./auth.js');
  
  app.post("/api/admin/login", handleLogin);
  app.post("/api/admin/logout", handleLogout);
  app.get("/api/admin/me", handleAuthCheck);

  // Use simple auth middleware  
  const requireAdmin = requireAuth;

  // Get all site content (admin only)
  app.get("/api/admin/content", requireAdmin, async (req, res) => {
    try {
      const content = await storage.getSiteContent();
      res.json({ success: true, content });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération du contenu"
      });
    }
  });

  // Get content by section (admin only)
  app.get("/api/admin/content/section/:section", requireAdmin, async (req, res) => {
    try {
      const { section } = req.params;
      const content = await storage.getSiteContentBySection(section);
      res.json({ success: true, content });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération du contenu"
      });
    }
  });

  // Update site content (admin only)
  app.put("/api/admin/content/:key", requireAdmin, async (req, res) => {
    try {
      const { key } = req.params;
      const validatedData = updateSiteContentSchema.parse(req.body);
      
      const updated = await storage.updateSiteContent(key, validatedData);

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: "Contenu non trouvé"
        });
      }

      res.json({ success: true, content: updated });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Données invalides",
          errors: error.errors
        });
      }
      res.status(500).json({
        success: false,
        message: "Erreur lors de la mise à jour"
      });
    }
  });

  // Create new site content (admin only)
  app.post("/api/admin/content", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertSiteContentSchema.parse(req.body);
      
      const content = await storage.createSiteContent(validatedData);

      res.status(201).json({ success: true, content });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Données invalides",
          errors: error.errors
        });
      }
      res.status(500).json({
        success: false,
        message: "Erreur lors de la création"
      });
    }
  });

  // Delete site content (admin only)
  app.delete("/api/admin/content/:key", requireAdmin, async (req, res) => {
    try {
      const { key } = req.params;
      const deleted = await storage.deleteSiteContent(key);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: "Contenu non trouvé"
        });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Erreur lors de la suppression"
      });
    }
  });

  // ===== SLIDER MANAGEMENT ROUTES (ADMIN ONLY) =====

  // Upload slider image directly to DigitalOcean Spaces (admin only)
  app.post("/api/admin/sliders/upload", slidersUpload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          error: "Aucun fichier image fourni" 
        });
      }
      
      // Upload direct vers DigitalOcean Spaces
      const imageUrl = await uploadToDigitalOceanSpaces(req.file, 'sliders');
      const filename = imageUrl.split('/').pop();
      
      console.log(`✅ Slider image uploaded to DigitalOcean Spaces: ${imageUrl}`);
      
      res.json({ 
        success: true,
        imageUrl,
        filename,
        message: "Image uploadée avec succès vers DigitalOcean Spaces"
      });
    } catch (error) {
      console.error("Error uploading slider image:", error);
      res.status(500).json({ 
        success: false,
        error: "Erreur lors de l'upload de l'image" 
      });
    }
  });

  // Legacy route removed - now using direct multer upload above

  // Get all sliders (admin only)
  app.get("/api/admin/sliders", requireAdmin, async (req, res) => {
    try {
      const sliders = await storage.getSliders();
      res.json({ success: true, sliders });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération des sliders"
      });
    }
  });

  // Get single slider (admin only)
  app.get("/api/admin/sliders/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const slider = await storage.getSlider(id);
      
      if (!slider) {
        return res.status(404).json({
          success: false,
          message: "Slider non trouvé"
        });
      }

      res.json({ success: true, slider });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération du slider"
      });
    }
  });

  // Create new slider (admin only) - NOUVEAU SYSTÈME PHYSIQUE
  app.post("/api/admin/sliders", requireAdmin, async (req, res) => {
    try {
      console.log('📝 [SLIDER CREATE] Request body:', req.body);
      console.log('📝 [SLIDER CREATE] ImageUrl provided:', !!req.body.imageUrl);
      
      // Validation des données avec imageUrl (plus d'imageData)
      const validatedData = insertSliderSchema.parse(req.body);
      console.log('✅ [SLIDER CREATE] Validation passed');
      
      const slider = await storage.createSlider(validatedData);
      console.log('✅ [SLIDER CREATE] Slider created with imageUrl:', slider.imageUrl);

      res.status(201).json({ 
        success: true, 
        slider,
        message: "Slider créé avec succès"
      });
    } catch (error) {
      console.error('❌ [SLIDER CREATE] Error:', error);
      if (error instanceof z.ZodError) {
        console.error('❌ [SLIDER CREATE] Zod validation errors:', error.errors);
        return res.status(400).json({
          success: false,
          message: "Données invalides",
          errors: error.errors
        });
      }
      console.error('❌ [SLIDER CREATE] Server error:', error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({
        success: false,
        message: "Erreur lors de la création du slider: " + (error instanceof Error ? error.message : 'Unknown error')
      });
    }
  });

  // Update slider (admin only)
  app.put("/api/admin/sliders/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateSliderSchema.parse(req.body);
      
      const updated = await storage.updateSlider(id, validatedData);

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: "Slider non trouvé"
        });
      }

      res.json({ success: true, slider: updated });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Données invalides",
          errors: error.errors
        });
      }
      res.status(500).json({
        success: false,
        message: "Erreur lors de la mise à jour du slider"
      });
    }
  });

  // Delete slider (admin only)
  app.delete("/api/admin/sliders/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteSlider(id);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: "Slider non trouvé"
        });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Erreur lors de la suppression du slider"
      });
    }
  });

  // Get public sliders (for frontend)
  app.get("/api/sliders", async (req, res) => {
    try {
      const sliders = await storage.getSliders();
      res.json({ success: true, sliders });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération des sliders"
      });
    }
  });

  // Get public site content (for frontend)
  app.get("/api/content", async (req, res) => {
    try {
      const content = await storage.getSiteContent();
      res.json({ success: true, content });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération du contenu"
      });
    }
  });

  // Get public founder message (for frontend)
  app.get("/api/founder-message", async (req, res) => {
    try {
      const founderMessage = await storage.getFounderMessage();
      res.json({ success: true, founderMessage });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération du message du fondateur"
      });
    }
  });

  // Get public content by section
  app.get("/api/content/section/:section", async (req, res) => {
    try {
      const { section } = req.params;
      const content = await storage.getSiteContentBySection(section);
      res.json({ success: true, content });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération du contenu"
      });
    }
  });

  // ===== FOUNDER MESSAGE MANAGEMENT ROUTES (ADMIN ONLY) =====

  // Get founder message (admin only)
  app.get("/api/admin/founder-message", requireAdmin, async (req, res) => {
    try {
      const founderMessage = await storage.getFounderMessage();
      res.json({ success: true, founderMessage });
    } catch (error) {
      console.error("Erreur lors de la récupération du message du fondateur:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération du message du fondateur"
      });
    }
  });

  // Create founder message (admin only)
  app.post("/api/admin/founder-message", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertFounderMessageSchema.parse(req.body);
      const founderMessage = await storage.createFounderMessage(validatedData);

      res.status(201).json({ success: true, founderMessage });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Données invalides",
          errors: error.errors
        });
      }
      console.error("Erreur lors de la création du message du fondateur:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la création du message du fondateur"
      });
    }
  });

  // Update founder message (admin only)
  app.put("/api/admin/founder-message", requireAdmin, async (req, res) => {
    try {
      const validatedData = updateFounderMessageSchema.parse(req.body);
      
      const updated = await storage.updateFounderMessage(validatedData);

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: "Message du fondateur non trouvé"
        });
      }

      res.json({ success: true, founderMessage: updated });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Données invalides",
          errors: error.errors
        });
      }
      console.error("Erreur lors de la mise à jour du message du fondateur:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la mise à jour du message du fondateur"
      });
    }
  });

  // Get upload URL for founder image (admin only)
  app.post("/api/admin/founder-message/upload", requireAdmin, async (req, res) => {
    try {
      // Generate a unique filename for founder image
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 15);
      const filename = `founder_${timestamp}_${randomId}.jpg`;
      
      // Use the same protocol as the request to avoid mixed content issues
      const protocol = req.get('x-forwarded-proto') || req.protocol;
      res.json({ 
        uploadURL: `${protocol}://${req.get('host')}/api/admin/founder-message/upload-file/${filename}`,
        finalUrl: `/api/assets/founder/${filename}`
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // File upload handler for founder image (admin only) - USING OBJECT STORAGE
  app.put("/api/admin/founder-message/upload-file/:fileName", requireAdmin, async (req, res) => {
    try {
      const { fileName } = req.params;
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      
      if (!bucketId) {
        return res.status(500).json({ error: "Object storage not configured" });
      }
      
      // Create a buffer from the request stream
      const chunks: Buffer[] = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          const objectPath = `public/founder/${fileName}`;
          
          // Upload to Google Cloud Storage
          const { Storage } = await import('@google-cloud/storage');
          const storage = new Storage({
            credentials: {
              audience: "replit",
              subject_token_type: "access_token", 
              token_url: "http://127.0.0.1:1106/token",
              type: "external_account",
              credential_source: {
                url: "http://127.0.0.1:1106/credential",
                format: {
                  type: "json",
                  subject_token_field_name: "access_token"
                }
              },
              universe_domain: "googleapis.com"
            },
            projectId: ""
          });
          
          const bucket = storage.bucket(bucketId);
          const file = bucket.file(objectPath);
          
          await file.save(buffer, {
            metadata: {
              contentType: req.get('content-type') || 'image/jpeg'
            }
          });
          
          // Return server-proxied URL (avoids bucket public access policy)
          const serverUrl = `/api/object-storage/founder/${fileName}`;
          
          console.log(`✅ Founder image uploaded to Object Storage, serving via: ${serverUrl}`);
          
          res.json({ 
            success: true, 
            path: serverUrl,
            localPath: `/api/assets/founder/${fileName}` // For backward compatibility
          });
          
        } catch (uploadError) {
          console.error("Object storage upload error:", uploadError);
          res.status(500).json({ error: "Failed to upload to object storage" });
        }
      });
      
    } catch (error) {
      console.error("Error uploading founder image:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // =================== INSTITUTES ROUTES ===================

  // Public route to get all active institutes
  app.get("/api/institutes", async (req, res) => {
    try {
      const institutesData = await storage.getActiveInstitutes();
      res.json({ success: true, institutes: institutesData });
    } catch (error) {
      console.error("Error fetching institutes:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la récupération des instituts" 
      });
    }
  });

  // Admin route to get all institutes
  app.get("/api/admin/institutes", requireAdmin, async (req, res) => {
    try {
      const institutesData = await storage.getAllInstitutes();
      res.json({ success: true, institutes: institutesData });
    } catch (error) {
      console.error("Error fetching institutes for admin:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la récupération des instituts" 
      });
    }
  });

  // Admin route to get single institute
  app.get("/api/admin/institutes/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const institute = await storage.getInstituteById(id);
      
      if (!institute) {
        return res.status(404).json({ 
          success: false, 
          error: "Institut non trouvé" 
        });
      }

      res.json({ success: true, institute });
    } catch (error) {
      console.error("Error fetching institute:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la récupération de l'institut" 
      });
    }
  });

  // Admin route to create institute
  app.post("/api/admin/institutes", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertInstituteSchema.parse(req.body);
      const newInstitute = await storage.createInstitute(validatedData);
      
      res.status(201).json({ 
        success: true, 
        institute: newInstitute,
        message: "Institut créé avec succès" 
      });
    } catch (error) {
      console.error("Error creating institute:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          error: "Données invalides", 
          details: error.errors 
        });
      }
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la création de l'institut" 
      });
    }
  });

  // Admin route to update institute
  app.put("/api/admin/institutes/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateInstituteSchema.parse(req.body);
      
      const updatedInstitute = await storage.updateInstitute(id, validatedData);
      
      if (!updatedInstitute) {
        return res.status(404).json({ 
          success: false, 
          error: "Institut non trouvé" 
        });
      }

      res.json({ 
        success: true, 
        institute: updatedInstitute,
        message: "Institut mis à jour avec succès" 
      });
    } catch (error) {
      console.error("Error updating institute:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          error: "Données invalides", 
          details: error.errors 
        });
      }
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la mise à jour de l'institut" 
      });
    }
  });

  // Admin route to delete institute
  app.delete("/api/admin/institutes/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteInstitute(id);
      
      if (!success) {
        return res.status(404).json({ 
          success: false, 
          error: "Institut non trouvé" 
        });
      }

      res.json({ 
        success: true, 
        message: "Institut supprimé avec succès" 
      });
    } catch (error) {
      console.error("Error deleting institute:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la suppression de l'institut" 
      });
    }
  });

  // ========================
  // PROGRAM ROUTES (FILIÈRES)
  // ========================

  // Public route to get all active programs
  app.get("/api/programs", async (req, res) => {
    try {
      const programsData = await storage.getActivePrograms();
      res.json({ success: true, programs: programsData });
    } catch (error) {
      console.error("Error fetching programs:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la récupération des filières" 
      });
    }
  });

  // Admin route to get all programs
  app.get("/api/admin/programs", requireAdmin, async (req, res) => {
    try {
      const programsData = await storage.getAllPrograms();
      res.json({ success: true, programs: programsData });
    } catch (error) {
      console.error("Error fetching programs for admin:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la récupération des filières" 
      });
    }
  });

  // Admin route to get single program
  app.get("/api/admin/programs/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const program = await storage.getProgramById(id);
      
      if (!program) {
        return res.status(404).json({ 
          success: false, 
          error: "Filière non trouvée" 
        });
      }

      res.json({ success: true, program });
    } catch (error) {
      console.error("Error fetching program:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la récupération de la filière" 
      });
    }
  });

  // Admin route to create program
  app.post("/api/admin/programs", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertProgramSchema.parse(req.body);
      const newProgram = await storage.createProgram(validatedData);
      
      res.status(201).json({ 
        success: true, 
        program: newProgram,
        message: "Filière créée avec succès" 
      });
    } catch (error) {
      console.error("Error creating program:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          error: "Données invalides", 
          details: error.errors 
        });
      }
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la création de la filière" 
      });
    }
  });

  // Admin route to update program
  app.put("/api/admin/programs/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateProgramSchema.parse(req.body);
      const updatedProgram = await storage.updateProgram(id, validatedData);
      
      if (!updatedProgram) {
        return res.status(404).json({ 
          success: false, 
          error: "Filière non trouvée" 
        });
      }

      res.json({ 
        success: true, 
        program: updatedProgram,
        message: "Filière mise à jour avec succès" 
      });
    } catch (error) {
      console.error("Error updating program:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          error: "Données invalides", 
          details: error.errors 
        });
      }
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la mise à jour de la filière" 
      });
    }
  });

  // Admin route to delete program
  app.delete("/api/admin/programs/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteProgram(id);
      
      if (!success) {
        return res.status(404).json({ 
          success: false, 
          error: "Filière non trouvée" 
        });
      }

      res.json({ 
        success: true, 
        message: "Filière supprimée avec succès" 
      });
    } catch (error) {
      console.error("Error deleting program:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la suppression de la filière" 
      });
    }
  });

  // Upload route for program images (admin only)
  app.post("/api/admin/programs/upload", programsUpload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Aucun fichier image fourni"
        });
      }

      // Upload direct vers DigitalOcean Spaces
      const imageUrl = await uploadToDigitalOceanSpaces(req.file, 'programs');
      const filename = imageUrl.split('/').pop();
      
      console.log(`✅ Program image uploaded to DigitalOcean Spaces: ${imageUrl}`);
      
      return res.json({
        success: true,
        image: {
          imageUrl,
          localPath: `/api/assets/filieres/${filename}`, // For backward compatibility
          filename
        }
      });
    } catch (error) {
      console.error("Error uploading program image:", error);
      return res.status(500).json({
        success: false,
        error: "Erreur lors de l'upload de l'image"
      });
    }
  });

  // Route to serve program images - OBJECT STORAGE REDIRECT
  app.get("/api/assets/filieres/:filename", async (req, res) => {
    const { filename } = req.params;
    const localPath = path.join(process.cwd(), 'attached_assets', 'filieres', filename);
    
    // Try local file first (for backward compatibility)
    if (fs.existsSync(localPath)) {
      return res.sendFile(localPath);
    }
    
    // Redirect to Object Storage for persistent files
    try {
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (bucketId) {
        const objectPath = `public/filieres/${filename}`;
        const publicUrl = `https://storage.googleapis.com/${bucketId}/${objectPath}`;
        console.log(`↗️ Redirecting to Object Storage: ${publicUrl}`);
        return res.redirect(publicUrl);
      }
    } catch (error) {
      console.error("Object Storage redirect error:", error);
    }
    
    // File not found in both locations
    res.status(404).json({ 
      success: false, 
      error: "Image non trouvée" 
    });
  });

  // =================== NEWS ROUTES ===================

  // Public route to get all active news
  app.get("/api/news", async (req, res) => {
    try {
      const newsData = await storage.getActiveNews();
      const albumsParActu = await storage.getNewsAlbumMap();
      res.json({
        success: true,
        news: newsData.map((n) => ({ ...n, albumId: albumsParActu[n.id] ?? null })),
      });
    } catch (error) {
      console.error("Error fetching news:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la récupération des actualités" 
      });
    }
  });

  // Public route to get single news article by slug
  app.get("/api/news/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const newsItem = await storage.getNewsBySlug(slug);

      if (!newsItem || !newsItem.isActive) {
        return res.status(404).json({
          success: false,
          error: "Actualité non trouvée"
        });
      }

      const albumsParActu = await storage.getNewsAlbumMap();
      res.json({ ...newsItem, albumId: albumsParActu[newsItem.id] ?? null });
    } catch (error) {
      console.error("Error fetching news by slug:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la récupération de l'actualité" 
      });
    }
  });

  // Public route to get images for a news article by slug
  app.get("/api/news/:slug/images", async (req, res) => {
    try {
      const { slug } = req.params;
      
      // First verify the news exists and is active
      const newsItem = await storage.getNewsBySlug(slug);
      if (!newsItem || !newsItem.isActive) {
        return res.status(404).json({ 
          success: false, 
          error: "Actualité non trouvée" 
        });
      }
      
      const images = await storage.getNewsImages(newsItem.id);
      res.json({ 
        success: true, 
        images 
      });
    } catch (error) {
      console.error("Error fetching news images:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la récupération des images" 
      });
    }
  });

  // Admin route to get all news
  app.get("/api/admin/news", requireAdmin, async (req, res) => {
    try {
      const newsData = await storage.getAllNews();
      res.json({ success: true, news: newsData });
    } catch (error) {
      console.error("Error fetching news for admin:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la récupération des actualités" 
      });
    }
  });

  // Admin route to get single news
  app.get("/api/admin/news/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const news = await storage.getNewsById(id);
      
      if (!news) {
        return res.status(404).json({ 
          success: false, 
          error: "Actualité non trouvée" 
        });
      }
      
      res.json({ 
        success: true, 
        news 
      });
    } catch (error) {
      console.error("Error fetching single news:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la récupération de l'actualité" 
      });
    }
  });

  // Admin route to create news
  app.post("/api/admin/news", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertNewsSchema.parse(req.body);
      const newNews = await storage.createNews(validatedData);
      
      res.status(201).json({ 
        success: true, 
        news: newNews,
        message: "Actualité créée avec succès" 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Données invalides",
          details: error.errors
        });
      }
      
      console.error("Error creating news:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la création de l'actualité" 
      });
    }
  });

  // Admin route to update news
  app.put("/api/admin/news/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateNewsSchema.parse(req.body);
      
      const updatedNews = await storage.updateNews(id, validatedData);
      
      if (!updatedNews) {
        return res.status(404).json({ 
          success: false, 
          error: "Actualité non trouvée" 
        });
      }
      
      res.json({ 
        success: true, 
        news: updatedNews,
        message: "Actualité mise à jour avec succès" 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Données invalides",
          details: error.errors
        });
      }
      
      console.error("Error updating news:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la mise à jour de l'actualité" 
      });
    }
  });

  // Admin route to delete news
  app.delete("/api/admin/news/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteNews(id);
      
      if (!success) {
        return res.status(404).json({ 
          success: false, 
          error: "Actualité non trouvée" 
        });
      }

      res.json({ 
        success: true, 
        message: "Actualité supprimée avec succès" 
      });
    } catch (error) {
      console.error("Error deleting news:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la suppression de l'actualité" 
      });
    }
  });

  // Route for news image upload
  app.post("/api/objects/upload", async (req, res) => {
    try {
      // Generate a unique filename for news image
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 15);
      const filename = `news_${timestamp}_${randomId}.jpg`;
      
      // Get bucket name from environment variable
      const bucketName = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (!bucketName) {
        return res.status(500).json({ 
          success: false, 
          error: "Bucket de stockage non configuré" 
        });
      }

      // Generate object name with news directory
      const objectName = `news/${filename}`;
      
      // Generate presigned URL for uploading
      const uploadURL = await generatePresignedUrl(bucketName, objectName);
      
      res.json({ 
        success: true, 
        uploadURL,
        message: "URL de téléchargement générée avec succès" 
      });
    } catch (error) {
      console.error("Error generating upload URL for news image:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la génération de l'URL de téléchargement" 
      });
    }
  });

  // Route to serve news images from object storage
  app.get("/api/assets/news/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const bucketName = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      
      if (!bucketName) {
        return res.status(500).json({ 
          success: false, 
          error: "Bucket de stockage non configuré" 
        });
      }

      // Generate object name
      const objectName = `news/${filename}`;
      
      // Generate presigned URL for downloading (24 hours)
      const downloadRequest = {
        bucket_name: bucketName,
        object_name: objectName,
        method: "GET",
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      };

      const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
      const response = await fetch(
        `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(downloadRequest),
        }
      );

      if (!response.ok) {
        return res.status(404).json({ 
          success: false, 
          error: "Image non trouvée" 
        });
      }

      const { signed_url: signedURL } = await response.json();
      
      // Redirect to the signed URL
      res.redirect(signedURL);
    } catch (error) {
      console.error("Error serving news image:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors du chargement de l'image" 
      });
    }
  });

  // Route to serve news images - OBJECT STORAGE REDIRECT
  app.get("/api/assets/actualites/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const localPath = path.join(process.cwd(), 'attached_assets', 'actualites', filename);
      
      // Try local file first (for backward compatibility)
      if (fs.existsSync(localPath)) {
        return res.sendFile(localPath);
      }
      
      // Redirect to Object Storage for persistent files
      try {
        const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
        if (bucketId) {
          const objectPath = `public/actualites/${filename}`;
          const publicUrl = `https://storage.googleapis.com/${bucketId}/${objectPath}`;
          console.log(`↗️ Redirecting to Object Storage: ${publicUrl}`);
          return res.redirect(publicUrl);
        }
      } catch (error) {
        console.error("Object Storage redirect error:", error);
      }
      
      // File not found in both locations
      res.status(404).json({ 
        success: false, 
        error: "Image non trouvée" 
      });
    } catch (error) {
      console.error("Error serving news image:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors du chargement de l'image" 
      });
    }
  });

  // Routes for news images management
  app.get("/api/admin/news/:newsId/images", requireAdmin, async (req, res) => {
    try {
      const { newsId } = req.params;
      const images = await storage.getNewsImages(newsId);
      
      res.json({ 
        success: true, 
        images,
        message: "Images récupérées avec succès" 
      });
    } catch (error) {
      console.error("Error fetching news images:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la récupération des images" 
      });
    }
  });

  // Upload route for main news images (DigitalOcean Spaces)
  app.post("/api/admin/news/temp/images/upload", requireAdmin, newsUpload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Aucun fichier image fourni"
        });
      }

      // Upload direct vers DigitalOcean Spaces
      const imageUrl = await uploadToDigitalOceanSpaces(req.file, 'news');
      const filename = imageUrl.split('/').pop();
      
      console.log(`✅ News main image uploaded to DigitalOcean Spaces: ${imageUrl}`);
      
      return res.json({
        success: true,
        image: {
          imageUrl,
          localPath: imageUrl, // For backward compatibility
          filename
        }
      });
    } catch (error) {
      console.error("Error uploading main news image:", error);
      return res.status(500).json({
        success: false,
        error: "Erreur lors de l'upload de l'image"
      });
    }
  });

  // Upload route for news images (local storage)
  app.post("/api/admin/news/:newsId/images/upload", newsUpload.single('image'), async (req, res) => {
    try {
      const { newsId } = req.params;
      const { caption, order } = req.body;
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Aucun fichier image fourni"
        });
      }

      // Upload direct vers DigitalOcean Spaces
      const imageUrl = await uploadToDigitalOceanSpaces(req.file, 'news');
      
      const newsImage = await storage.createNewsImage({
        newsId,
        imageUrl,
        caption: caption || null,
        order: order ? parseInt(order) : null
      });

      console.log(`✅ News image uploaded to DigitalOcean Spaces: ${imageUrl}`);

      res.status(201).json({ 
        success: true, 
        image: newsImage,
        message: "Image uploadée avec succès vers DigitalOcean Spaces" 
      });
    } catch (error) {
      console.error("Error uploading news image:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de l'upload de l'image" 
      });
    }
  });

  app.post("/api/admin/news/:newsId/images", requireAdmin, async (req, res) => {
    try {
      const { newsId } = req.params;
      const { imageUrl, caption, order } = req.body;
      
      if (!imageUrl) {
        return res.status(400).json({
          success: false,
          error: "URL de l'image requise"
        });
      }

      const newsImage = await storage.createNewsImage({
        newsId,
        imageUrl,
        caption: caption || null,
        order: order || 1
      });
      
      res.status(201).json({ 
        success: true, 
        image: newsImage,
        message: "Image ajoutée avec succès" 
      });
    } catch (error) {
      console.error("Error creating news image:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de l'ajout de l'image" 
      });
    }
  });

  app.put("/api/admin/news-images/:imageId", requireAdmin, async (req, res) => {
    try {
      const { imageId } = req.params;
      const { caption, order } = req.body;
      
      const updatedImage = await storage.updateNewsImage(imageId, {
        caption,
        order
      });
      
      if (!updatedImage) {
        return res.status(404).json({ 
          success: false, 
          error: "Image non trouvée" 
        });
      }
      
      res.json({ 
        success: true, 
        image: updatedImage,
        message: "Image mise à jour avec succès" 
      });
    } catch (error) {
      console.error("Error updating news image:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la mise à jour de l'image" 
      });
    }
  });

  app.delete("/api/admin/news-images/:imageId", requireAdmin, async (req, res) => {
    try {
      const { imageId } = req.params;
      const success = await storage.deleteNewsImage(imageId);
      
      if (!success) {
        return res.status(404).json({ 
          success: false, 
          error: "Image non trouvée" 
        });
      }

      res.json({ 
        success: true, 
        message: "Image supprimée avec succès" 
      });
    } catch (error) {
      console.error("Error deleting news image:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la suppression de l'image" 
      });
    }
  });

  // ==================== PROJECT ROUTES (Cabinet 2IAE) ====================
  
  // Public route to get active projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getActiveProjects();
      res.json({ success: true, projects });
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la récupération des projets" 
      });
    }
  });

  // Public route to get single project by ID
  app.get("/api/projects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const project = await storage.getProjectById(id);
      
      if (!project || !project.isActive) {
        return res.status(404).json({ 
          success: false, 
          error: "Projet non trouvé" 
        });
      }
      
      res.json({ 
        success: true, 
        project 
      });
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la récupération du projet" 
      });
    }
  });

  // Admin route to get all projects
  app.get("/api/admin/projects", requireAdmin, async (req, res) => {
    try {
      const projects = await storage.getAllProjects();
      res.json({ success: true, projects });
    } catch (error) {
      console.error("Error fetching admin projects:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la récupération des projets" 
      });
    }
  });

  // Admin route to get single project
  app.get("/api/admin/projects/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const project = await storage.getProjectById(id);
      
      if (!project) {
        return res.status(404).json({ 
          success: false, 
          error: "Projet non trouvé" 
        });
      }
      
      res.json({ 
        success: true, 
        project 
      });
    } catch (error) {
      console.error("Error fetching single project:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la récupération du projet" 
      });
    }
  });

  // Admin route to create project
  app.post("/api/admin/projects", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertProjectSchema.parse(req.body);
      const newProject = await storage.createProject(validatedData);
      
      res.status(201).json({ 
        success: true, 
        project: newProject,
        message: "Projet créé avec succès" 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Données invalides",
          details: error.errors
        });
      }
      
      console.error("Error creating project:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la création du projet" 
      });
    }
  });

  // Admin route to update project
  app.put("/api/admin/projects/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateProjectSchema.parse(req.body);
      
      const updatedProject = await storage.updateProject(id, validatedData);
      
      if (!updatedProject) {
        return res.status(404).json({ 
          success: false, 
          error: "Projet non trouvé" 
        });
      }
      
      res.json({ 
        success: true, 
        project: updatedProject,
        message: "Projet mis à jour avec succès" 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Données invalides",
          details: error.errors
        });
      }
      
      console.error("Error updating project:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la mise à jour du projet" 
      });
    }
  });

  // Admin route to delete project
  app.delete("/api/admin/projects/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteProject(id);
      
      if (!success) {
        return res.status(404).json({ 
          success: false, 
          error: "Projet non trouvé" 
        });
      }

      res.json({ 
        success: true, 
        message: "Projet supprimé avec succès" 
      });
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la suppression du projet" 
      });
    }
  });

  // Upload route for project media (images/videos) - admin only
  app.post("/api/admin/projects/upload", requireAdmin, projectsUpload.single('media'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Aucun fichier média fourni"
        });
      }

      // Upload direct vers DigitalOcean Spaces
      const mediaUrl = await uploadToDigitalOceanSpaces(req.file, 'projects');
      const filename = mediaUrl.split('/').pop();
      
      console.log(`✅ Project media uploaded to DigitalOcean Spaces: ${mediaUrl}`);
      
      return res.json({
        success: true,
        media: {
          mediaUrl,
          filename,
          type: req.file.mimetype.startsWith('video/') ? 'video' : 'image'
        }
      });
    } catch (error) {
      console.error("Error uploading project media:", error);
      return res.status(500).json({
        success: false,
        error: "Erreur lors de l'upload du média"
      });
    }
  });

  // Upload route for founder images (DigitalOcean Spaces) - admin only
  app.post("/api/admin/founder/upload", requireAdmin, founderUpload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Aucun fichier image fourni"
        });
      }

      // Upload direct vers DigitalOcean Spaces
      const imageUrl = await uploadToDigitalOceanSpaces(req.file, 'founder');
      const filename = imageUrl.split('/').pop();
      
      console.log(`✅ Founder image uploaded to DigitalOcean Spaces: ${imageUrl}`);
      
      return res.json({
        success: true,
        image: {
          imageUrl,
          filename
        }
      });
    } catch (error) {
      console.error("Error uploading founder image:", error);
      return res.status(500).json({
        success: false,
        error: "Erreur lors de l'upload de l'image"
      });
    }
  });

  // Serve uploaded files from physical storage (/server/uploads/)
  app.get("/api/assets/:folder/:filename", (req, res) => {
    const { folder, filename } = req.params;
    const filePath = safeJoin(UPLOADS_DIR, folder, filename);

    // Check if file exists
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }
    
    // Serve the file with appropriate headers
    res.sendFile(filePath);
  });

  // ===== TARIFF MANAGEMENT ROUTES =====
  
  // Get all tariffs (public)
  app.get("/api/tariffs", async (req, res) => {
    try {
      const tariffs = await storage.getActiveTariffs();
      res.json({ success: true, tariffs });
    } catch (error) {
      console.error("Error fetching tariffs:", error);
      res.status(500).json({ success: false, error: "Erreur lors de la récupération des tarifs" });
    }
  });
  
  // Admin routes for tariff management
  app.get("/api/admin/tariffs", requireAdmin, async (req, res) => {
    try {
      const tariffs = await storage.getAllTariffs();
      res.json({ success: true, tariffs });
    } catch (error) {
      console.error("Error fetching all tariffs:", error);
      res.status(500).json({ success: false, error: "Erreur lors de la récupération des tarifs" });
    }
  });

  app.get("/api/admin/tariffs/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const tariff = await storage.getTariffById(id);
      
      if (!tariff) {
        return res.status(404).json({ success: false, error: "Tarif non trouvé" });
      }
      
      res.json({ success: true, tariff });
    } catch (error) {
      console.error("Error fetching tariff:", error);
      res.status(500).json({ success: false, error: "Erreur lors de la récupération du tarif" });
    }
  });

  app.post("/api/admin/tariffs", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertTariffSchema.parse(req.body);
      const tariff = await storage.createTariff(validatedData);
      
      res.status(201).json({ success: true, tariff, message: "Tarif créé avec succès" });
    } catch (error) {
      console.error("Error creating tariff:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: "Données invalides", details: error.errors });
      }
      res.status(500).json({ success: false, error: "Erreur lors de la création du tarif" });
    }
  });

  app.put("/api/admin/tariffs/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateTariffSchema.parse(req.body);
      const tariff = await storage.updateTariff(id, validatedData);
      
      if (!tariff) {
        return res.status(404).json({ success: false, error: "Tarif non trouvé" });
      }
      
      res.json({ success: true, tariff, message: "Tarif mis à jour avec succès" });
    } catch (error) {
      console.error("Error updating tariff:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: "Données invalides", details: error.errors });
      }
      res.status(500).json({ success: false, error: "Erreur lors de la mise à jour du tarif" });
    }
  });

  app.delete("/api/admin/tariffs/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteTariff(id);
      
      if (!success) {
        return res.status(404).json({ success: false, error: "Tarif non trouvé" });
      }
      
      res.json({ success: true, message: "Tarif supprimé avec succès" });
    } catch (error) {
      console.error("Error deleting tariff:", error);
      res.status(500).json({ success: false, error: "Erreur lors de la suppression du tarif" });
    }
  });

  // ===================== GALLERY & ALBUMS ROUTES =====================

  // Public routes for albums
  app.get("/api/albums", async (req, res) => {
    try {
      const albums = await storage.getActiveAlbums();
      res.json({ success: true, albums });
    } catch (error) {
      console.error("Error fetching albums:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la récupération des albums" 
      });
    }
  });

  // Public route to get single album with its items
  app.get("/api/albums/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const album = await storage.getAlbumWithItems(id);
      
      if (!album || !album.isActive) {
        return res.status(404).json({ 
          success: false, 
          error: "Album non trouvé" 
        });
      }
      
      res.json({ 
        success: true, 
        album 
      });
    } catch (error) {
      console.error("Error fetching album:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la récupération de l'album" 
      });
    }
  });

  // Admin routes for albums
  app.get("/api/admin/albums", requireAdmin, async (req, res) => {
    try {
      const albums = await storage.getAllAlbums();
      res.json({ success: true, albums });
    } catch (error) {
      console.error("Error fetching admin albums:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la récupération des albums" 
      });
    }
  });

  // Admin route to get single album
  app.get("/api/admin/albums/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const album = await storage.getAlbumWithItems(id);
      
      if (!album) {
        return res.status(404).json({ 
          success: false, 
          error: "Album non trouvé" 
        });
      }
      
      res.json({ 
        success: true, 
        album 
      });
    } catch (error) {
      console.error("Error fetching single album:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la récupération de l'album" 
      });
    }
  });

  // Admin route to create album
  app.post("/api/admin/albums", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertAlbumSchema.parse(req.body);
      const newAlbum = await storage.createAlbum(validatedData);
      
      res.status(201).json({ 
        success: true, 
        album: newAlbum,
        message: "Album créé avec succès" 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Données invalides",
          details: error.errors
        });
      }
      
      console.error("Error creating album:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la création de l'album" 
      });
    }
  });

  // Admin route to update album
  app.put("/api/admin/albums/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateAlbumSchema.parse(req.body);
      
      const updatedAlbum = await storage.updateAlbum(id, validatedData);
      
      if (!updatedAlbum) {
        return res.status(404).json({ 
          success: false, 
          error: "Album non trouvé" 
        });
      }
      
      res.json({ 
        success: true, 
        album: updatedAlbum,
        message: "Album mis à jour avec succès" 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Données invalides",
          details: error.errors
        });
      }
      
      console.error("Error updating album:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la mise à jour de l'album" 
      });
    }
  });

  // Admin route to delete album
  app.delete("/api/admin/albums/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteAlbum(id);
      
      if (!success) {
        return res.status(404).json({ 
          success: false, 
          error: "Album non trouvé" 
        });
      }
      
      res.json({ 
        success: true, 
        message: "Album supprimé avec succès" 
      });
    } catch (error) {
      console.error("Error deleting album:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la suppression de l'album" 
      });
    }
  });

  // ===================== GALLERY ITEMS ROUTES =====================

  // Admin routes for gallery items
  app.get("/api/admin/gallery-items", requireAdmin, async (req, res) => {
    try {
      const { albumId } = req.query;
      let items;
      
      if (albumId) {
        items = await storage.getGalleryItemsByAlbum(albumId as string);
      } else {
        items = await storage.getActiveGalleryItems();
      }
      
      res.json({ success: true, items });
    } catch (error) {
      console.error("Error fetching gallery items:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la récupération des éléments" 
      });
    }
  });

  // Admin route to create gallery item
  app.post("/api/admin/gallery-items", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertGalleryItemSchema.parse(req.body);
      const newItem = await storage.createGalleryItem(validatedData);
      
      res.status(201).json({ 
        success: true, 
        item: newItem,
        message: "Élément de galerie créé avec succès" 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Données invalides",
          details: error.errors
        });
      }
      
      console.error("Error creating gallery item:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la création de l'élément" 
      });
    }
  });

  // Admin route to update gallery item
  app.put("/api/admin/gallery-items/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateGalleryItemSchema.parse(req.body);
      
      const updatedItem = await storage.updateGalleryItem(id, validatedData);
      
      if (!updatedItem) {
        return res.status(404).json({ 
          success: false, 
          error: "Élément non trouvé" 
        });
      }
      
      res.json({ 
        success: true, 
        item: updatedItem,
        message: "Élément mis à jour avec succès" 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Données invalides",
          details: error.errors
        });
      }
      
      console.error("Error updating gallery item:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la mise à jour de l'élément" 
      });
    }
  });

  // Admin route to delete gallery item
  app.delete("/api/admin/gallery-items/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteGalleryItem(id);
      
      if (!success) {
        return res.status(404).json({ 
          success: false, 
          error: "Élément non trouvé" 
        });
      }
      
      res.json({ 
        success: true, 
        message: "Élément supprimé avec succès" 
      });
    } catch (error) {
      console.error("Error deleting gallery item:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erreur lors de la suppression de l'élément" 
      });
    }
  });

  // Admin route to upload gallery media (images/videos)
  app.post('/api/admin/gallery-upload', requireAdmin, uploadConfig.single('media'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Aucun fichier fourni"
        });
      }

      // Upload to DigitalOcean Spaces or fallback to local
      let mediaUrl;
      let filename;
      
      try {
        mediaUrl = await uploadToDigitalOceanSpaces(req.file, 'gallery/');
        filename = path.basename(mediaUrl);
      } catch (uploadError) {
        console.error("Upload DigitalOcean Spaces échoué, sauvegarde locale:", uploadError);
        
        // Fallback: Save locally
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 15);
        const ext = path.extname(req.file.originalname);
        filename = `gallery_${timestamp}_${randomId}${ext}`;
        const localPath = path.join(UPLOADS_DIR, 'gallery', filename);
        
        // Create gallery directory if it doesn't exist
        const galleryDir = path.dirname(localPath);
        if (!fs.existsSync(galleryDir)) {
          fs.mkdirSync(galleryDir, { recursive: true });
        }
        
        fs.writeFileSync(localPath, req.file.buffer);
        mediaUrl = `/api/assets/gallery/${filename}`;
      }

      res.json({
        success: true,
        mediaUrl,
        filename
      });
    } catch (error) {
      console.error("Error uploading gallery media:", error);
      return res.status(500).json({
        success: false,
        error: "Erreur lors de l'upload du média"
      });
    }
  });

  // Intégration Facebook : webhook temps réel + synchronisation
  enregistrerRoutesFacebook(app, requireAdmin);

  const httpServer = createServer(app);
  return httpServer;
}
