import { type User, type InsertUser, type Contact, type InsertContact, type ChatMessage, type InsertChatMessage, type AdminUser, type InsertAdminUser, type SiteContent, type InsertSiteContent, type UpdateSiteContent } from "@shared/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private contacts: Map<string, Contact>;
  private chatMessages: Map<string, ChatMessage>;
  private adminUsers: Map<string, AdminUser>;
  private siteContent: Map<string, SiteContent>;

  constructor() {
    this.users = new Map();
    this.contacts = new Map();
    this.chatMessages = new Map();
    this.adminUsers = new Map();
    this.siteContent = new Map();
    
    // Create default admin user
    this.initializeDefaultAdmin();
    this.initializeDefaultContent();
  }

  private async initializeDefaultAdmin() {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    const defaultAdmin: AdminUser = {
      id: randomUUID(),
      username: "admin",
      password: hashedPassword,
      email: "admin@2iae.com",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.adminUsers.set(defaultAdmin.id, defaultAdmin);
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
    return Array.from(this.adminUsers.values()).find(
      (admin) => admin.username === username
    );
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
    const admin = await this.getAdminUserByUsername(username);
    if (!admin || !admin.isActive) {
      return null;
    }
    
    const isValid = await bcrypt.compare(password, admin.password);
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
}

export const storage = new MemStorage();
