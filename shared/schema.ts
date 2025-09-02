import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for production persistence
export const session = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull()
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id").notNull(),
  message: text("message").notNull(),
  response: text("response").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const siteContent = pgTable("site_content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(), // e.g., "homepage_title", "about_description", etc.
  title: text("title").notNull(), // Friendly name for admin
  value: text("value").notNull(), // The actual content
  type: text("type").notNull(), // "text", "textarea", "image", "url"
  section: text("section").notNull(), // "homepage", "about", "programs", etc.
  order: text("order").default("0"), // For ordering elements
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => adminUsers.id),
});

// Sliders table for hero slider management
export const sliders = pgTable("sliders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  description: text("description"),
  imageUrl: text("image_url"),
  imageData: text("image_data"), // Base64 image storage for persistence
  button1Text: text("button1_text"),
  button1Link: text("button1_link"),
  button2Text: text("button2_text"),
  button2Link: text("button2_link"),
  isActive: boolean("is_active").default(true),
  order: text("order").default("1"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => adminUsers.id),
});

// Founder message table for founder section management
export const founderMessage = pgTable("founder_message", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  quote: text("quote").notNull(),
  vision: text("vision").notNull(),
  founderName: text("founder_name").notNull(),
  founderRole: text("founder_role").notNull(),
  founderOrganization: text("founder_organization").notNull(),
  founderImageUrl: text("founder_image_url"),
  imageData: text("image_data"), // Base64 image storage for persistence
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => adminUsers.id),
});

// Institutes table for institutes section management
export const institutes = pgTable("institutes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  link: text("link").default("/filieres"),
  buttonText: text("button_text").default("EN SAVOIR PLUS"),
  bgColor: text("bg_color").default("from-gray-800 to-gray-900"),
  isActive: boolean("is_active").default(true),
  order: text("order").default("1"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => adminUsers.id),
});

// Programs table for academic programs/filières management
export const programs = pgTable("programs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Nom de la filière
  category: text("category").notNull(), // Catégorie (BTS TERTIAIRES, BTS INDUSTRIEL, etc.)
  description: text("description"), // Description complète de la filière
  imageUrl: text("image_url"), // Image de la filière
  duration: text("duration"), // Durée (2 ans, 3 mois, etc.)
  level: text("level"), // Niveau (BTS, Licence, Master, Certificat)
  isActive: boolean("is_active").default(true),
  order: text("order").default("1"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => adminUsers.id),
});

// News table for news/articles management
export const news = pgTable("news", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  summary: text("summary"),
  content: text("content"),
  imageUrl: text("image_url"), // Image principale pour les listes
  imageData: text("image_data"), // Base64 image storage for persistence
  date: text("date").notNull(),
  category: text("category").notNull(),
  author: text("author").notNull(),
  featured: boolean("featured").default(false),
  isActive: boolean("is_active").default(true),
  order: text("order").default("1"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => adminUsers.id),
});

// News images table for multiple images per news article
export const newsImages = pgTable("news_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  newsId: varchar("news_id").notNull().references(() => news.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  caption: text("caption"),
  order: integer("order").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertContactSchema = createInsertSchema(contacts).pick({
  name: true,
  email: true,
  phone: true,
  message: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).pick({
  sessionId: true,
  message: true,
  response: true,
});

export const insertAdminUserSchema = createInsertSchema(adminUsers).pick({
  username: true,
  password: true,
  email: true,
});

export const insertSiteContentSchema = createInsertSchema(siteContent).pick({
  key: true,
  title: true,
  value: true,
  type: true,
  section: true,
  order: true,
});

export const updateSiteContentSchema = createInsertSchema(siteContent).pick({
  title: true,
  value: true,
  order: true,
}).partial();

export const insertSliderSchema = createInsertSchema(sliders).pick({
  title: true,
  subtitle: true,
  description: true,
  imageUrl: true,
  imageData: true,
  button1Text: true,
  button1Link: true,
  button2Text: true,
  button2Link: true,
  order: true,
});

export const updateSliderSchema = createInsertSchema(sliders).pick({
  title: true,
  subtitle: true,
  description: true,
  imageUrl: true,
  button1Text: true,
  button1Link: true,
  button2Text: true,
  button2Link: true,
  isActive: true,
  order: true,
}).partial();

export const insertFounderMessageSchema = createInsertSchema(founderMessage).pick({
  title: true,
  quote: true,
  vision: true,
  founderName: true,
  founderRole: true,
  founderOrganization: true,
  founderImageUrl: true,
  imageData: true,
});

export const updateFounderMessageSchema = createInsertSchema(founderMessage).pick({
  title: true,
  quote: true,
  vision: true,
  founderName: true,
  founderRole: true,
  founderOrganization: true,
  founderImageUrl: true,
  imageData: true,
  isActive: true,
}).partial();

export const insertInstituteSchema = createInsertSchema(institutes).pick({
  title: true,
  description: true,
  link: true,
  buttonText: true,
  bgColor: true,
  order: true,
});

export const updateInstituteSchema = createInsertSchema(institutes).pick({
  title: true,
  description: true,
  link: true,
  buttonText: true,
  bgColor: true,
  isActive: true,
  order: true,
}).partial();

export const insertNewsSchema = createInsertSchema(news).pick({
  title: true,
  slug: true,
  summary: true,
  content: true,
  imageUrl: true,
  date: true,
  category: true,
  author: true,
  featured: true,
  order: true,
});

export const updateNewsSchema = createInsertSchema(news).pick({
  title: true,
  slug: true,
  summary: true,
  content: true,
  imageUrl: true,
  date: true,
  category: true,
  author: true,
  featured: true,
  isActive: true,
  order: true,
}).partial();

export const insertNewsImageSchema = createInsertSchema(newsImages).pick({
  newsId: true,
  imageUrl: true,
  caption: true,
  order: true,
});

export const updateNewsImageSchema = createInsertSchema(newsImages).pick({
  imageUrl: true,
  caption: true,
  order: true,
}).partial();

export const insertProgramSchema = createInsertSchema(programs).pick({
  name: true,
  category: true,
  description: true,
  imageUrl: true,
  duration: true,
  level: true,
  isActive: true,
  order: true,
});

export const updateProgramSchema = createInsertSchema(programs).pick({
  name: true,
  category: true,
  description: true,
  imageUrl: true,
  duration: true,
  level: true,
  isActive: true,
  order: true,
}).partial();

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertSiteContent = z.infer<typeof insertSiteContentSchema>;
export type SiteContent = typeof siteContent.$inferSelect;
export type UpdateSiteContent = z.infer<typeof updateSiteContentSchema>;
export type InsertSlider = z.infer<typeof insertSliderSchema>;
export type Slider = typeof sliders.$inferSelect;
export type UpdateSlider = z.infer<typeof updateSliderSchema>;
export type InsertFounderMessage = z.infer<typeof insertFounderMessageSchema>;
export type FounderMessage = typeof founderMessage.$inferSelect;
export type UpdateFounderMessage = z.infer<typeof updateFounderMessageSchema>;
export type InsertInstitute = z.infer<typeof insertInstituteSchema>;
export type Institute = typeof institutes.$inferSelect;
export type UpdateInstitute = z.infer<typeof updateInstituteSchema>;
export type InsertNews = z.infer<typeof insertNewsSchema>;
export type News = typeof news.$inferSelect;
export type UpdateNews = z.infer<typeof updateNewsSchema>;
export type InsertNewsImage = z.infer<typeof insertNewsImageSchema>;
export type NewsImage = typeof newsImages.$inferSelect;
export type UpdateNewsImage = z.infer<typeof updateNewsImageSchema>;
export type InsertProgram = z.infer<typeof insertProgramSchema>;
export type Program = typeof programs.$inferSelect;
export type UpdateProgram = z.infer<typeof updateProgramSchema>;
