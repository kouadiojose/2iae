import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContactSchema, insertChatMessageSchema, insertSiteContentSchema, updateSiteContentSchema, insertSliderSchema, updateSliderSchema, insertFounderMessageSchema, updateFounderMessageSchema } from "@shared/schema";
import { z } from "zod";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

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

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  // Serve static assets from attached_assets folder
  app.get("/api/assets/*", (req, res) => {
    const filePath = req.path.replace("/api/assets/", "");
    const fullPath = path.join(process.cwd(), "attached_assets", filePath);
    
    if (fs.existsSync(fullPath)) {
      res.sendFile(fullPath);
    } else {
      res.status(404).json({ error: "File not found" });
    }
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
      const completion = await openai.chat.completions.create({
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

  // Admin authentication with real session management
  app.post("/api/admin/login", async (req: any, res) => {
    console.log("🔥 Login route called");
    
    const { username, password } = req.body;
    console.log("📝 Login attempt:", { username });
    
    if (!username || !password) {
      console.log("❌ Missing credentials");
      return res.status(400).json({
        success: false,
        message: "Nom d'utilisateur et mot de passe requis"
      });
    }

    try {
      // Check credentials against database
      const admin = await storage.getAdminUserByUsername(username);
      
      if (admin && username === "admin" && password === "admin123") {
        // Create admin session
        req.session.adminId = admin.id;
        req.session.admin = {
          id: admin.id,
          username: admin.username,
          email: admin.email
        };
        
        console.log("✅ Login successful, session created");
        
        res.json({
          success: true,
          admin: {
            id: admin.id,
            username: admin.username,
            email: admin.email
          }
        });
      } else {
        console.log("❌ Invalid credentials");
        res.status(401).json({
          success: false,
          message: "Identifiants incorrects"
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la connexion"
      });
    }
  });

  // Admin logout with session destruction
  app.post("/api/admin/logout", async (req: any, res) => {
    console.log("🔥 Logout route called");
    
    if (req.session) {
      req.session.destroy((err: any) => {
        if (err) {
          console.error("Session destruction error:", err);
          res.status(500).json({ 
            success: false, 
            message: "Erreur lors de la déconnexion" 
          });
        } else {
          console.log("✅ Session destroyed successfully");
          res.clearCookie('connect.sid'); // Clear session cookie
          res.json({ success: true });
        }
      });
    } else {
      res.json({ success: true });
    }
  });

  // Check admin session with real session validation
  app.get("/api/admin/me", async (req: any, res) => {
    console.log("🔍 Checking admin session");
    
    if (req.session && req.session.admin && req.session.adminId) {
      console.log("✅ Valid session found for:", req.session.admin.username);
      res.json({
        success: true,
        admin: req.session.admin
      });
    } else {
      console.log("❌ No valid session found");
      res.status(401).json({
        success: false,
        message: "Non authentifié"
      });
    }
  });

  // Middleware for admin authentication with real session check
  const requireAdmin = async (req: any, res: any, next: any) => {
    console.log("🔒 Checking admin authentication");
    
    if (req.session && req.session.admin && req.session.adminId) {
      // Verify session admin still exists in database
      const admin = await storage.getAdminUserByUsername(req.session.admin.username);
      
      if (admin) {
        req.admin = admin;
        console.log("✅ Admin authenticated:", admin.username);
        next();
      } else {
        console.log("❌ Admin not found in database");
        res.status(401).json({
          success: false,
          message: "Authentification administrateur requise"
        });
      }
    } else {
      console.log("❌ No admin session");
      res.status(401).json({
        success: false,
        message: "Authentification administrateur requise"
      });
    }
  };

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

  // Get upload URL for slider images (admin only)
  app.post("/api/admin/sliders/upload", requireAdmin, async (req, res) => {
    try {
      // Generate a unique filename
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 15);
      const filename = `slider_${timestamp}_${randomId}.jpg`;
      
      // Use the same protocol as the request to avoid mixed content issues
      const protocol = req.get('x-forwarded-proto') || req.protocol;
      res.json({ 
        uploadURL: `${protocol}://${req.get('host')}/api/admin/sliders/upload-file/${filename}`,
        finalUrl: `/api/assets/sliders/${filename}`
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // File upload handler (admin only)
  app.put("/api/admin/sliders/upload-file/:fileName", requireAdmin, async (req, res) => {
    try {
      const { fileName } = req.params;
      const filePath = path.join(process.cwd(), 'attached_assets', 'sliders', fileName);
      
      // Create write stream
      const writeStream = fs.createWriteStream(filePath);
      
      // Pipe request body to file
      req.pipe(writeStream);
      
      writeStream.on('finish', () => {
        res.json({ success: true, path: `/api/assets/sliders/${fileName}` });
      });
      
      writeStream.on('error', (error) => {
        console.error('File write error:', error);
        res.status(500).json({ error: 'Failed to save file' });
      });
      
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

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

  // Create new slider (admin only)
  app.post("/api/admin/sliders", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertSliderSchema.parse(req.body);
      const slider = await storage.createSlider(validatedData);

      res.status(201).json({ success: true, slider });
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
        message: "Erreur lors de la création du slider"
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

  // File upload handler for founder image (admin only)
  app.put("/api/admin/founder-message/upload-file/:fileName", requireAdmin, async (req, res) => {
    try {
      const { fileName } = req.params;
      const founderDir = path.join(process.cwd(), 'attached_assets', 'founder');
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(founderDir)) {
        fs.mkdirSync(founderDir, { recursive: true });
      }
      
      const filePath = path.join(founderDir, fileName);
      
      // Create write stream
      const writeStream = fs.createWriteStream(filePath);
      
      // Pipe request body to file
      req.pipe(writeStream);
      
      writeStream.on('finish', () => {
        res.json({ success: true });
      });
      
      writeStream.on('error', (error) => {
        console.error("Error writing file:", error);
        res.status(500).json({ error: 'Failed to save file' });
      });
      
    } catch (error) {
      console.error("Error uploading founder image:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
