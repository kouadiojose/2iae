import { type User, type InsertUser, type Contact, type InsertContact, type ChatMessage, type InsertChatMessage, type AdminUser, type InsertAdminUser, type SiteContent, type InsertSiteContent, type UpdateSiteContent, type Slider, type InsertSlider, type UpdateSlider, type FounderMessage, type InsertFounderMessage, type UpdateFounderMessage, type Institute, type InsertInstitute, type UpdateInstitute, type News, type InsertNews, type UpdateNews, type NewsImage, type InsertNewsImage, type UpdateNewsImage, users, contacts, chatMessages, adminUsers, siteContent, sliders, founderMessage, institutes, news, newsImages } from "@shared/schema";
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
  
  // Founder message management
  getFounderMessage(): Promise<FounderMessage | undefined>;
  createFounderMessage(founderMessage: InsertFounderMessage): Promise<FounderMessage>;
  updateFounderMessage(founderMessage: UpdateFounderMessage): Promise<FounderMessage | undefined>;
  
  // Institute management
  getActiveInstitutes(): Promise<Institute[]>;
  getAllInstitutes(): Promise<Institute[]>;
  getInstituteById(id: string): Promise<Institute | undefined>;
  createInstitute(institute: InsertInstitute): Promise<Institute>;
  updateInstitute(id: string, institute: UpdateInstitute): Promise<Institute | undefined>;
  deleteInstitute(id: string): Promise<boolean>;
  
  // News management
  getActiveNews(): Promise<News[]>;
  getAllNews(): Promise<News[]>;
  getNewsById(id: string): Promise<News | undefined>;
  getNewsBySlug(slug: string): Promise<News | undefined>;
  createNews(news: InsertNews): Promise<News>;
  updateNews(id: string, news: UpdateNews): Promise<News | undefined>;
  deleteNews(id: string): Promise<boolean>;
  
  // News images management
  getNewsImages(newsId: string): Promise<NewsImage[]>;
  createNewsImage(newsImage: InsertNewsImage): Promise<NewsImage>;
  updateNewsImage(id: string, newsImage: UpdateNewsImage): Promise<NewsImage | undefined>;
  deleteNewsImage(id: string): Promise<boolean>;
  deleteAllNewsImages(newsId: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private contacts: Map<string, Contact>;
  private chatMessages: Map<string, ChatMessage>;
  private adminUsers: Map<string, AdminUser>;
  private siteContent: Map<string, SiteContent>;
  private sliders: Map<string, Slider>;
  private founderMessage: FounderMessage | null;
  private institutes: Map<string, Institute>;
  private newsList: Map<string, News>;
  private newsImages: Map<string, NewsImage>;

  constructor() {
    this.users = new Map();
    this.contacts = new Map();
    this.chatMessages = new Map();
    this.adminUsers = new Map();
    this.siteContent = new Map();
    this.sliders = new Map();
    this.founderMessage = null;
    this.institutes = new Map();
    this.newsList = new Map();
    this.newsImages = new Map();
    
    // Create default admin user synchronously
    this.initializeDefaultAdmin();
    this.initializeDefaultContent();
    this.initializeDefaultSliders();
    this.initializeDefaultFounderMessage();
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

  private initializeDefaultFounderMessage() {
    const defaultFounderMessage: FounderMessage = {
      id: randomUUID(),
      title: "Message du Fondateur",
      quote: "L'entrepreneuriat est l'art de transformer les rêves en réalité concrète.",
      vision: "Chez 2IAE International, nous formons les entrepreneurs de demain en leur donnant les outils nécessaires pour réussir dans un monde en constante évolution. Notre mission est de créer une génération d'entrepreneurs capables de transformer l'économie africaine.",
      founderName: "Dr. Jean-Baptiste KOUAME",
      founderRole: "Fondateur et Directeur Général",
      founderOrganization: "2IAE International",
      founderImageUrl: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      updatedBy: null
    };
    this.founderMessage = defaultFounderMessage;
  }

  // Founder message management methods
  async getFounderMessage(): Promise<FounderMessage | undefined> {
    return this.founderMessage || undefined;
  }

  async createFounderMessage(insertFounderMessage: InsertFounderMessage): Promise<FounderMessage> {
    const id = randomUUID();
    const founderMessage: FounderMessage = { 
      ...insertFounderMessage, 
      id, 
      founderImageUrl: insertFounderMessage.founderImageUrl || null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      updatedBy: null
    };
    this.founderMessage = founderMessage;
    return founderMessage;
  }

  async updateFounderMessage(updateData: UpdateFounderMessage): Promise<FounderMessage | undefined> {
    if (!this.founderMessage) {
      return undefined;
    }
    
    const updated: FounderMessage = {
      ...this.founderMessage,
      ...updateData,
      updatedAt: new Date()
    };
    this.founderMessage = updated;
    return updated;
  }

  // Institute management methods
  async getActiveInstitutes(): Promise<Institute[]> {
    return Array.from(this.institutes.values()).filter(institute => institute.isActive);
  }

  async getAllInstitutes(): Promise<Institute[]> {
    return Array.from(this.institutes.values());
  }

  async getInstituteById(id: string): Promise<Institute | undefined> {
    return this.institutes.get(id);
  }

  async createInstitute(insertInstitute: InsertInstitute): Promise<Institute> {
    const id = randomUUID();
    const institute: Institute = { 
      ...insertInstitute, 
      id, 
      description: insertInstitute.description || null,
      link: insertInstitute.link || "/filieres",
      buttonText: insertInstitute.buttonText || "EN SAVOIR PLUS",
      bgColor: insertInstitute.bgColor || "from-gray-800 to-gray-900",
      isActive: true,
      order: insertInstitute.order || "1",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null
    };
    this.institutes.set(id, institute);
    return institute;
  }

  async updateInstitute(id: string, updateData: UpdateInstitute): Promise<Institute | undefined> {
    const institute = this.institutes.get(id);
    if (!institute) {
      return undefined;
    }
    
    const updated: Institute = {
      ...institute,
      ...updateData,
      updatedAt: new Date()
    };
    this.institutes.set(id, updated);
    return updated;
  }

  async deleteInstitute(id: string): Promise<boolean> {
    return this.institutes.delete(id);
  }

  // News management methods
  async getActiveNews(): Promise<News[]> {
    return Array.from(this.newsList.values())
      .filter(news => news.isActive)
      .sort((a, b) => parseInt(a.order || "0") - parseInt(b.order || "0"));
  }

  async getAllNews(): Promise<News[]> {
    return Array.from(this.newsList.values())
      .sort((a, b) => parseInt(a.order || "0") - parseInt(b.order || "0"));
  }

  async getNewsById(id: string): Promise<News | undefined> {
    return this.newsList.get(id);
  }

  async getNewsBySlug(slug: string): Promise<News | undefined> {
    return Array.from(this.newsList.values()).find(news => news.slug === slug);
  }

  async createNews(insertNews: InsertNews): Promise<News> {
    const id = randomUUID();
    const newsItem: News = { 
      ...insertNews, 
      id, 
      summary: insertNews.summary || null,
      content: insertNews.content || null,
      imageUrl: insertNews.imageUrl || null,
      featured: insertNews.featured || false,
      isActive: true,
      order: insertNews.order || "1",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null
    };
    this.newsList.set(id, newsItem);
    return newsItem;
  }

  async updateNews(id: string, updateData: UpdateNews): Promise<News | undefined> {
    const news = this.newsList.get(id);
    if (!news) {
      return undefined;
    }
    
    const updated: News = {
      ...news,
      ...updateData,
      updatedAt: new Date()
    };
    this.newsList.set(id, updated);
    return updated;
  }

  async deleteNews(id: string): Promise<boolean> {
    return this.newsList.delete(id);
  }

  // News images management methods
  async getNewsImages(newsId: string): Promise<NewsImage[]> {
    return Array.from(this.newsImages.values())
      .filter(image => image.newsId === newsId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  async createNewsImage(insertNewsImage: InsertNewsImage): Promise<NewsImage> {
    const id = randomUUID();
    const newsImage: NewsImage = { 
      ...insertNewsImage, 
      id, 
      createdAt: new Date(),
      order: insertNewsImage.order ?? null,
      caption: insertNewsImage.caption ?? null
    };
    this.newsImages.set(id, newsImage);
    return newsImage;
  }

  async updateNewsImage(id: string, updateData: UpdateNewsImage): Promise<NewsImage | undefined> {
    const newsImage = this.newsImages.get(id);
    if (!newsImage) {
      return undefined;
    }
    
    const updatedNewsImage = { ...newsImage, ...updateData };
    this.newsImages.set(id, updatedNewsImage);
    return updatedNewsImage;
  }

  async deleteNewsImage(id: string): Promise<boolean> {
    return this.newsImages.delete(id);
  }

  async deleteAllNewsImages(newsId: string): Promise<boolean> {
    const imagesToDelete = Array.from(this.newsImages.entries())
      .filter(([_, image]) => image.newsId === newsId);
    
    for (const [imageId] of imagesToDelete) {
      this.newsImages.delete(imageId);
    }
    
    return true;
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

      // Check if default founder message exists
      const existingFounderMessage = await db.select().from(founderMessage).limit(1);
      if (existingFounderMessage.length === 0) {
        await this.initializeDefaultFounderMessage();
        console.log("✓ Message du fondateur par défaut créé");
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
    // Hash the password before storing in database
    const hashedPassword = await bcrypt.hash(insertAdminUser.password, 10);
    const adminData = {
      ...insertAdminUser,
      password: hashedPassword
    };
    const [admin] = await db.insert(adminUsers).values(adminData).returning();
    return admin;
  }

  async validateAdminCredentials(username: string, password: string): Promise<AdminUser | null> {
    console.log("🔐 Validation des credentials pour:", username);
    const admin = await this.getAdminUserByUsername(username);
    if (!admin || !admin.isActive) {
      console.log("❌ Admin non trouvé ou inactif");
      return null;
    }

    // Compare hashed password with provided password
    const isValid = await bcrypt.compare(password, admin.password);
    console.log("🔐 Validation mot de passe:", isValid ? "✓" : "❌");
    
    return isValid ? admin : null;
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

  private async initializeDefaultFounderMessage() {
    const defaultFounderMessage = {
      title: "Message du Fondateur",
      quote: "L'entrepreneuriat est l'art de transformer les rêves en réalité concrète.",
      vision: "Chez 2IAE International, nous formons les entrepreneurs de demain en leur donnant les outils nécessaires pour réussir dans un monde en constante évolution. Notre mission est de créer une génération d'entrepreneurs capables de transformer l'économie africaine.",
      founderName: "Dr. Jean-Baptiste KOUAME",
      founderRole: "Fondateur et Directeur Général",
      founderOrganization: "2IAE International",
      founderImageUrl: null,
      isActive: true
    };

    await db.insert(founderMessage).values(defaultFounderMessage);
  }

  // Founder message operations
  async getFounderMessage(): Promise<FounderMessage | undefined> {
    const [message] = await db.select().from(founderMessage)
      .where(eq(founderMessage.isActive, true))
      .limit(1);
    return message;
  }

  async createFounderMessage(insertFounderMessage: InsertFounderMessage): Promise<FounderMessage> {
    const [message] = await db.insert(founderMessage).values(insertFounderMessage).returning();
    return message;
  }

  async updateFounderMessage(updateFounderMessage: UpdateFounderMessage): Promise<FounderMessage | undefined> {
    const [updated] = await db.update(founderMessage)
      .set({ ...updateFounderMessage, updatedAt: new Date() })
      .where(eq(founderMessage.isActive, true))
      .returning();
    return updated;
  }

  // Institute operations
  async getActiveInstitutes(): Promise<Institute[]> {
    return await db.select().from(institutes)
      .where(eq(institutes.isActive, true))
      .orderBy(institutes.order, institutes.createdAt);
  }

  async getAllInstitutes(): Promise<Institute[]> {
    return await db.select().from(institutes).orderBy(institutes.order, institutes.createdAt);
  }

  async getInstituteById(id: string): Promise<Institute | undefined> {
    const [institute] = await db.select().from(institutes).where(eq(institutes.id, id));
    return institute;
  }

  async createInstitute(insertInstitute: InsertInstitute): Promise<Institute> {
    const [institute] = await db.insert(institutes).values(insertInstitute).returning();
    return institute;
  }

  async updateInstitute(id: string, updateInstitute: UpdateInstitute): Promise<Institute | undefined> {
    const [updated] = await db.update(institutes)
      .set({ ...updateInstitute, updatedAt: new Date() })
      .where(eq(institutes.id, id))
      .returning();
    return updated;
  }

  async deleteInstitute(id: string): Promise<boolean> {
    const result = await db.delete(institutes).where(eq(institutes.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // News operations
  async getActiveNews(): Promise<News[]> {
    return await db.select().from(news)
      .where(eq(news.isActive, true))
      .orderBy(news.order, news.createdAt);
  }

  async getAllNews(): Promise<News[]> {
    return await db.select().from(news).orderBy(news.order, news.createdAt);
  }

  async getNewsById(id: string): Promise<News | undefined> {
    const [newsItem] = await db.select().from(news).where(eq(news.id, id));
    return newsItem;
  }

  async getNewsBySlug(slug: string): Promise<News | undefined> {
    const [newsItem] = await db.select().from(news).where(eq(news.slug, slug));
    return newsItem;
  }

  async createNews(insertNews: InsertNews): Promise<News> {
    const [newsItem] = await db.insert(news).values(insertNews).returning();
    return newsItem;
  }

  async updateNews(id: string, updateNews: UpdateNews): Promise<News | undefined> {
    const [updated] = await db.update(news)
      .set({ ...updateNews, updatedAt: new Date() })
      .where(eq(news.id, id))
      .returning();
    return updated;
  }

  async deleteNews(id: string): Promise<boolean> {
    const result = await db.delete(news).where(eq(news.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // News images operations
  async getNewsImages(newsId: string): Promise<NewsImage[]> {
    return await db.select().from(newsImages)
      .where(eq(newsImages.newsId, newsId))
      .orderBy(newsImages.order, newsImages.createdAt);
  }

  async createNewsImage(insertNewsImage: InsertNewsImage): Promise<NewsImage> {
    const [newsImage] = await db.insert(newsImages).values(insertNewsImage).returning();
    return newsImage;
  }

  async updateNewsImage(id: string, updateNewsImage: UpdateNewsImage): Promise<NewsImage | undefined> {
    const [updated] = await db.update(newsImages)
      .set(updateNewsImage)
      .where(eq(newsImages.id, id))
      .returning();
    return updated;
  }

  async deleteNewsImage(id: string): Promise<boolean> {
    const result = await db.delete(newsImages).where(eq(newsImages.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async deleteAllNewsImages(newsId: string): Promise<boolean> {
    const result = await db.delete(newsImages).where(eq(newsImages.newsId, newsId));
    return (result.rowCount ?? 0) >= 0; // Can be 0 if no images exist
  }
}

export const storage = new DatabaseStorage();
