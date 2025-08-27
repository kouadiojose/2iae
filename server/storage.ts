import { type User, type InsertUser, type Contact, type InsertContact, type ChatMessage, type InsertChatMessage, type AdminUser, type InsertAdminUser, type SiteContent, type InsertSiteContent, type UpdateSiteContent, type Slider, type InsertSlider, type UpdateSlider, users, contacts, chatMessages, adminUsers, siteContent, sliders } from "@shared/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createContact(contact: InsertContact): Promise<Contact>;
  getContacts(): Promise<Contact[]>;
  createChatMessage(chatMessage: InsertChatMessage): Promise<ChatMessage>;
  getChatMessages(sessionId: string): Promise<ChatMessage[]>;
  
  // Admin management
  getAdminUser(id: string): Promise<AdminUser | undefined>;
  getAdminUserByUsername(username: string): Promise<AdminUser | undefined>;
  createAdminUser(adminUser: InsertAdminUser): Promise<AdminUser>;
  validateAdminCredentials(username: string, password: string): Promise<AdminUser | null>;
  
  // Site content management
  getSiteContent(): Promise<SiteContent[]>;
  getSiteContentBySection(section: string): Promise<SiteContent[]>;
  getSiteContentByKey(key: string): Promise<SiteContent | undefined>;
  createSiteContent(content: InsertSiteContent): Promise<SiteContent>;
  updateSiteContent(key: string, content: UpdateSiteContent): Promise<SiteContent | undefined>;
  deleteSiteContent(key: string): Promise<boolean>;
  
  // Slider management
  getSliders(): Promise<Slider[]>;
  getSlider(id: string): Promise<Slider | undefined>;
  createSlider(slider: InsertSlider): Promise<Slider>;
  updateSlider(id: string, slider: UpdateSlider): Promise<Slider | undefined>;
  deleteSlider(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private contacts: Map<string, Contact>;
  private chatMessages: Map<string, ChatMessage>;
  private adminUsers: Map<string, AdminUser>;
  private siteContent: Map<string, SiteContent>;
  private sliders: Map<string, Slider>;

  constructor() {
    this.users = new Map();
    this.contacts = new Map();
    this.chatMessages = new Map();
    this.adminUsers = new Map();
    this.siteContent = new Map();
    this.sliders = new Map();
    
    // Create default admin user synchronously
    this.initializeDefaultAdmin();
    this.initializeDefaultContent();
    this.initializeDefaultSliders();
  }

  private initializeDefaultAdmin() {
    // Use simple password for development - in production, this should be properly hashed
    const defaultAdmin: AdminUser = {
      id: randomUUID(),
      username: "admin",
      password: "admin123", // Will be hashed when validating
      email: "admin@2iae.com",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.adminUsers.set(defaultAdmin.id, defaultAdmin);
    console.log("✓ Admin par défaut créé:", defaultAdmin.username);
  }

  private initializeDefaultContent() {
    const defaultContents: SiteContent[] = [
      // Homepage content
      {
        id: randomUUID(),
        key: "homepage_title",
        title: "Titre principal de la page d'accueil",
        value: "2IAE INTERNATIONAL",
        type: "text",
        section: "homepage",
        order: "1",
        updatedAt: new Date(),
        updatedBy: null
      },
      {
        id: randomUUID(),
        key: "homepage_subtitle",
        title: "Sous-titre de la page d'accueil", 
        value: "L'ÉCOLE DES ENTREPRENEURS",
        type: "text",
        section: "homepage",
        order: "2",
        updatedAt: new Date(),
        updatedBy: null
      },
      {
        id: randomUUID(),
        key: "homepage_slogan",
        title: "Slogan officiel",
        value: "2IAE, entreprendre pour devenir l'élite de demain.",
        type: "text",
        section: "homepage",
        order: "3",
        updatedAt: new Date(),
        updatedBy: null
      },
      // About content
      {
        id: randomUUID(),
        key: "about_description",
        title: "Description À propos",
        value: "2IAE International est une institution d'enseignement supérieur spécialisée dans l'entrepreneuriat, située à Abidjan, Côte d'Ivoire.",
        type: "textarea",
        section: "about",
        order: "1",
        updatedAt: new Date(),
        updatedBy: null
      }
    ];

    defaultContents.forEach(content => {
      this.siteContent.set(content.key, content);
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const id = randomUUID();
    const contact: Contact = { 
      ...insertContact, 
      id, 
      createdAt: new Date()
    };
    this.contacts.set(id, contact);
    return contact;
  }

  async getContacts(): Promise<Contact[]> {
    return Array.from(this.contacts.values()).sort(
      (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  async createChatMessage(insertChatMessage: InsertChatMessage): Promise<ChatMessage> {
    const id = randomUUID();
    const chatMessage: ChatMessage = { 
      ...insertChatMessage, 
      id, 
      createdAt: new Date()
    };
    this.chatMessages.set(id, chatMessage);
    return chatMessage;
  }

  async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    return Array.from(this.chatMessages.values())
      .filter(msg => msg.sessionId === sessionId)
      .sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0));
  }

  // Admin management methods
  async getAdminUser(id: string): Promise<AdminUser | undefined> {
    return this.adminUsers.get(id);
  }

  async getAdminUserByUsername(username: string): Promise<AdminUser | undefined> {
    console.log("🔍 Recherche admin:", username);
    console.log("📋 Admins disponibles:", Array.from(this.adminUsers.values()).map(a => a.username));
    const admin = Array.from(this.adminUsers.values()).find(
      (admin) => admin.username === username
    );
    console.log("👤 Admin trouvé:", admin ? `${admin.username} (mot de passe: ${admin.password})` : "non trouvé");
    return admin;
  }

  async createAdminUser(insertAdminUser: InsertAdminUser): Promise<AdminUser> {
    const hashedPassword = await bcrypt.hash(insertAdminUser.password, 10);
    const id = randomUUID();
    const adminUser: AdminUser = { 
      ...insertAdminUser, 
      id, 
      password: hashedPassword,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.adminUsers.set(id, adminUser);
    return adminUser;
  }

  async validateAdminCredentials(username: string, password: string): Promise<AdminUser | null> {
    console.log("🔐 Tentative de connexion:", username, "avec mot de passe:", password);
    const admin = await this.getAdminUserByUsername(username);
    if (!admin || !admin.isActive) {
      console.log("❌ Admin non trouvé ou inactif:", username);
      return null;
    }
    
    // For development - use direct comparison first
    console.log("🔑 Comparaison:", `'${password}' === '${admin.password}'`);
    const isValid = admin.password === password;
    
    console.log("🔐 Validation mot de passe pour", username, ":", isValid ? "✓" : "❌");
    return isValid ? admin : null;
  }

  // Site content management methods
  async getSiteContent(): Promise<SiteContent[]> {
    return Array.from(this.siteContent.values()).sort(
      (a, b) => parseInt(a.order || "0") - parseInt(b.order || "0")
    );
  }

  async getSiteContentBySection(section: string): Promise<SiteContent[]> {
    return Array.from(this.siteContent.values())
      .filter(content => content.section === section)
      .sort((a, b) => parseInt(a.order || "0") - parseInt(b.order || "0"));
  }

  async getSiteContentByKey(key: string): Promise<SiteContent | undefined> {
    return this.siteContent.get(key);
  }

  async createSiteContent(insertContent: InsertSiteContent): Promise<SiteContent> {
    const id = randomUUID();
    const content: SiteContent = { 
      ...insertContent, 
      id, 
      order: insertContent.order || "0",
      updatedAt: new Date(),
      updatedBy: null
    };
    this.siteContent.set(content.key, content);
    return content;
  }

  async updateSiteContent(key: string, updateData: UpdateSiteContent): Promise<SiteContent | undefined> {
    const existing = this.siteContent.get(key);
    if (!existing) {
      return undefined;
    }
    
    const updated: SiteContent = {
      ...existing,
      ...updateData,
      updatedAt: new Date()
    };
    this.siteContent.set(key, updated);
    return updated;
  }

  async deleteSiteContent(key: string): Promise<boolean> {
    return this.siteContent.delete(key);
  }

  private initializeDefaultSliders() {
    const defaultSliders: Slider[] = [
      {
        id: randomUUID(),
        title: "Bienvenue à 2IAE International",
        subtitle: "L'ÉCOLE DES ENTREPRENEURS",
        description: "Formez-vous aux métiers de demain avec nos programmes d'entrepreneuriat innovants.",
        imageUrl: "/api/placeholder/1200/600",
        button1Text: "Découvrir nos programmes",
        button1Link: "/filieres",
        button2Text: "Nous contacter",
        button2Link: "/contact",
        isActive: true,
        order: "1",
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null
      },
      {
        id: randomUUID(),
        title: "Excellence Académique",
        subtitle: "FORMATION DE QUALITÉ",
        description: "Des programmes reconnus et des formateurs experts pour votre réussite professionnelle.",
        imageUrl: "/api/placeholder/1200/600",
        button1Text: "En savoir plus",
        button1Link: "/a-propos",
        button2Text: "Candidater",
        button2Link: "/contact",
        isActive: true,
        order: "2",
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null
      }
    ];

    defaultSliders.forEach(slider => {
      this.sliders.set(slider.id, slider);
    });
  }

  // Slider management methods
  async getSliders(): Promise<Slider[]> {
    return Array.from(this.sliders.values())
      .filter(slider => slider.isActive)
      .sort((a, b) => parseInt(a.order || "0") - parseInt(b.order || "0"));
  }

  async getSlider(id: string): Promise<Slider | undefined> {
    return this.sliders.get(id);
  }

  async createSlider(insertSlider: InsertSlider): Promise<Slider> {
    const id = randomUUID();
    const slider: Slider = { 
      ...insertSlider, 
      id, 
      subtitle: insertSlider.subtitle || null,
      description: insertSlider.description || null,
      imageUrl: insertSlider.imageUrl || null,
      button1Text: insertSlider.button1Text || null,
      button1Link: insertSlider.button1Link || null,
      button2Text: insertSlider.button2Text || null,
      button2Link: insertSlider.button2Link || null,
      isActive: true,
      order: insertSlider.order || "1",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null
    };
    this.sliders.set(id, slider);
    return slider;
  }

  async updateSlider(id: string, updateData: UpdateSlider): Promise<Slider | undefined> {
    const existing = this.sliders.get(id);
    if (!existing) {
      return undefined;
    }
    
    const updated: Slider = {
      ...existing,
      ...updateData,
      updatedAt: new Date()
    };
    this.sliders.set(id, updated);
    return updated;
  }

  async deleteSlider(id: string): Promise<boolean> {
    return this.sliders.delete(id);
  }
}

export class DatabaseStorage implements IStorage {
  constructor() {
    // Initialize default data when starting
    this.initializeDefaultData();
  }

  private async initializeDefaultData() {
    try {
      // Check if admin user exists
      const existingAdmin = await this.getAdminUserByUsername("admin");
      if (!existingAdmin) {
        await this.createAdminUser({
          username: "admin",
          password: "admin123",
          email: "admin@2iae.com"
        });
        console.log("✓ Admin par défaut créé: admin");
      }

      // Check if default content exists
      const existingContent = await db.select().from(siteContent).limit(1);
      if (existingContent.length === 0) {
        await this.initializeDefaultContent();
        console.log("✓ Contenu par défaut créé");
      }

      // Check if default sliders exist
      const existingSliders = await db.select().from(sliders).limit(1);
      if (existingSliders.length === 0) {
        await this.initializeDefaultSliders();
        console.log("✓ Sliders par défaut créés");
      }
    } catch (error) {
      console.error("Erreur lors de l'initialisation des données:", error);
    }
  }

  private async initializeDefaultContent() {
    const defaultContents = [
      {
        key: "homepage_title",
        title: "Titre principal de la page d'accueil",
        value: "2IAE INTERNATIONAL",
        type: "text",
        section: "homepage",
        order: "1"
      },
      {
        key: "homepage_subtitle",
        title: "Sous-titre de la page d'accueil", 
        value: "L'ÉCOLE DES ENTREPRENEURS",
        type: "text",
        section: "homepage",
        order: "2"
      },
      {
        key: "homepage_slogan",
        title: "Slogan officiel",
        value: "2IAE, entreprendre pour devenir l'élite de demain.",
        type: "text",
        section: "homepage",
        order: "3"
      },
      {
        key: "about_description",
        title: "Description À propos",
        value: "2IAE International est une institution d'enseignement supérieur spécialisée dans l'entrepreneuriat, située à Abidjan, Côte d'Ivoire.",
        type: "textarea",
        section: "about",
        order: "1"
      }
    ];

    for (const content of defaultContents) {
      await db.insert(siteContent).values(content);
    }
  }

  private async initializeDefaultSliders() {
    const defaultSliders = [
      {
        title: "Bienvenue à 2IAE International",
        subtitle: "L'ÉCOLE DES ENTREPRENEURS",
        description: "Formez-vous aux métiers de demain avec nos programmes reconnus et nos formations de qualité.",
        imageUrl: "/public-objects/sliders/slider1.jpg",
        button1Text: "Découvrir nos programmes",
        button1Link: "/filieres",
        button2Text: "Nous contacter",
        button2Link: "/contact",
        isActive: true,
        order: "1"
      },
      {
        title: "Excellence Académique",
        subtitle: "FORMATION DE QUALITÉ",
        description: "Des programmes reconnus et des formations adaptées aux besoins du marché du travail.",
        imageUrl: "/public-objects/sliders/slider2.jpg",
        button1Text: "En savoir plus",
        button1Link: "/a-propos",
        button2Text: "Candidater",
        button2Link: "/contact",
        isActive: true,
        order: "2"
      }
    ];

    for (const slider of defaultSliders) {
      await db.insert(sliders).values(slider);
    }
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Contact operations
  async createContact(insertContact: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(insertContact).returning();
    return contact;
  }

  async getContacts(): Promise<Contact[]> {
    return await db.select().from(contacts).orderBy(contacts.createdAt);
  }

  // Chat message operations
  async createChatMessage(insertChatMessage: InsertChatMessage): Promise<ChatMessage> {
    const [chatMessage] = await db.insert(chatMessages).values(insertChatMessage).returning();
    return chatMessage;
  }

  async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    return await db.select().from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.createdAt);
  }

  // Admin user operations
  async getAdminUser(id: string): Promise<AdminUser | undefined> {
    const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
    return admin;
  }

  async getAdminUserByUsername(username: string): Promise<AdminUser | undefined> {
    const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.username, username));
    return admin;
  }

  async createAdminUser(insertAdminUser: InsertAdminUser): Promise<AdminUser> {
    const [admin] = await db.insert(adminUsers).values(insertAdminUser).returning();
    return admin;
  }

  async validateAdminCredentials(username: string, password: string): Promise<AdminUser | null> {
    const admin = await this.getAdminUserByUsername(username);
    if (!admin || !admin.isActive) {
      return null;
    }

    // Compare password (assuming plain text for development)
    if (admin.password === password) {
      return admin;
    }

    return null;
  }

  // Site content operations
  async getSiteContent(): Promise<SiteContent[]> {
    return await db.select().from(siteContent).orderBy(siteContent.section, siteContent.order);
  }

  async getSiteContentBySection(section: string): Promise<SiteContent[]> {
    return await db.select().from(siteContent)
      .where(eq(siteContent.section, section))
      .orderBy(siteContent.order);
  }

  async getSiteContentByKey(key: string): Promise<SiteContent | undefined> {
    const [content] = await db.select().from(siteContent).where(eq(siteContent.key, key));
    return content;
  }

  async createSiteContent(insertSiteContent: InsertSiteContent): Promise<SiteContent> {
    const [content] = await db.insert(siteContent).values(insertSiteContent).returning();
    return content;
  }

  async updateSiteContent(key: string, updateSiteContent: UpdateSiteContent): Promise<SiteContent | undefined> {
    const [updated] = await db.update(siteContent)
      .set({ ...updateSiteContent, updatedAt: new Date() })
      .where(eq(siteContent.key, key))
      .returning();
    return updated;
  }

  async deleteSiteContent(key: string): Promise<boolean> {
    const result = await db.delete(siteContent).where(eq(siteContent.key, key));
    return (result.rowCount ?? 0) > 0;
  }

  // Slider operations
  async getSliders(): Promise<Slider[]> {
    return await db.select().from(sliders).orderBy(sliders.order, sliders.createdAt);
  }

  async getSlider(id: string): Promise<Slider | undefined> {
    const [slider] = await db.select().from(sliders).where(eq(sliders.id, id));
    return slider;
  }

  async createSlider(insertSlider: InsertSlider): Promise<Slider> {
    const [slider] = await db.insert(sliders).values(insertSlider).returning();
    return slider;
  }

  async updateSlider(id: string, updateSlider: UpdateSlider): Promise<Slider | undefined> {
    const [updated] = await db.update(sliders)
      .set({ ...updateSlider, updatedAt: new Date() })
      .where(eq(sliders.id, id))
      .returning();
    return updated;
  }

  async deleteSlider(id: string): Promise<boolean> {
    const result = await db.delete(sliders).where(eq(sliders.id, id));
    return (result.rowCount ?? 0) > 0;
  }
}

export const storage = new DatabaseStorage();
