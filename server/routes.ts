import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContactSchema, insertChatMessageSchema } from "@shared/schema";
import { z } from "zod";
import OpenAI from "openai";

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
        model: "gpt-5",
        messages: messages,
        max_completion_tokens: 500,
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

  const httpServer = createServer(app);
  return httpServer;
}
