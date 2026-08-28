import { sql, relations } from "drizzle-orm";
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
  button1Text: text("button1_text"),
  button1Link: text("button1_link"),
  button2Text: text("button2_text"),
  button2Link: text("button2_link"),
  isActive: boolean("is_active").default(true),
  order: text("order").default("1"),
  // Provenance : un slider issu d'une publication Facebook est renouvelé
  // automatiquement, ceux saisis à la main ne sont jamais touchés.
  source: text("source").default("manual"),
  sourceId: text("source_id").unique(),
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
  date: text("date").notNull(),
  category: text("category").notNull(),
  author: text("author").notNull(),
  featured: boolean("featured").default(false),
  isActive: boolean("is_active").default(true),
  order: text("order").default("1"),
  // Provenance : "manual" (saisie admin) ou "facebook" (importé de la page)
  source: text("source").default("manual"),
  sourceId: text("source_id").unique(),   // id du post Facebook, garantit l'unicité
  sourceUrl: text("source_url"),          // permalien vers le post d'origine
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
});

export const updateFounderMessageSchema = createInsertSchema(founderMessage).pick({
  title: true,
  quote: true,
  vision: true,
  founderName: true,
  founderRole: true,
  founderOrganization: true,
  founderImageUrl: true,
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

// Projects table for Cabinet 2IAE projects showcase
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull(), // "upcoming" | "completed"
  images: jsonb("images").default('[]'), // Array of image URLs
  videos: jsonb("videos").default('[]'), // Array of video URLs
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true),
  order: text("order").default("1"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => adminUsers.id),
});

export const insertProjectSchema = createInsertSchema(projects).pick({
  title: true,
  description: true,
  status: true,
  images: true,
  videos: true,
  isActive: true,
  order: true,
}).extend({
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
});

export const updateProjectSchema = createInsertSchema(projects).pick({
  title: true,
  description: true,
  status: true,
  images: true,
  videos: true,
  isActive: true,
  order: true,
}).extend({
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
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
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;
export type UpdateProject = z.infer<typeof updateProjectSchema>;

// Tariffs table for managing 2IAE site pricing
export const tariffs = pgTable("tariffs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  site: text("site").notNull(), // 2IAE PALMERAIE, 2IAE YAMOUSSOUKRO, etc.
  location: text("location").notNull(), // Abidjan - Riviera Palmeraie, etc.
  phone: text("phone"),
  email: text("email"),
  accountInfo: text("account_info"), // Bank account information
  programName: text("program_name").notNull(), // BTS - Orientés 1ère Année
  programDuration: text("program_duration").default("2 ans"),
  
  // Fees structure
  inscriptionFee: integer("inscription_fee").notNull(), // 85000
  fraisAnnexes: integer("frais_annexes").notNull(), // 140000, 145000, 165000
  totalFee: integer("total_fee").notNull(), // 225000, 230000, 250000
  
  // Payment schedule (échéancier)
  firstPayment: integer("first_payment").notNull(), // Premier versement obligatoire
  secondPayment: integer("second_payment").notNull(), // Deuxième versement 
  thirdPayment: integer("third_payment").notNull(), // Troisième versement
  
  // Required documents (JSON array)
  requiredDocuments: jsonb("required_documents").default('[]'),
  
  // Uniform costs (JSON object)
  uniformCosts: jsonb("uniform_costs").default('{}'), // { tissu, cravate, blouse }
  
  // Supplies (JSON array)
  supplies: jsonb("supplies").default('[]'),
  
  description: text("description"),
  isActive: boolean("is_active").default(true),
  order: text("order").default("1"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => adminUsers.id),
});

export const insertTariffSchema = createInsertSchema(tariffs).pick({
  site: true,
  location: true,
  phone: true,
  email: true,
  accountInfo: true,
  programName: true,
  programDuration: true,
  inscriptionFee: true,
  fraisAnnexes: true,
  totalFee: true,
  firstPayment: true,
  secondPayment: true,
  thirdPayment: true,
  requiredDocuments: true,
  uniformCosts: true,
  supplies: true,
  description: true,
  order: true,
});

export const updateTariffSchema = createInsertSchema(tariffs).pick({
  site: true,
  location: true,
  phone: true,
  email: true,
  accountInfo: true,
  programName: true,
  programDuration: true,
  inscriptionFee: true,
  fraisAnnexes: true,
  totalFee: true,
  firstPayment: true,
  secondPayment: true,
  thirdPayment: true,
  requiredDocuments: true,
  uniformCosts: true,
  supplies: true,
  description: true,
  isActive: true,
  order: true,
}).partial();

export type InsertTariff = z.infer<typeof insertTariffSchema>;
export type Tariff = typeof tariffs.$inferSelect;
export type UpdateTariff = z.infer<typeof updateTariffSchema>;

// ==================== INTÉGRATION FACEBOOK ====================

// Journal d'ingestion de la page Facebook.
// Une ligne par publication vue, qu'elle ait été publiée sur le site ou non :
// c'est ce qui rend la synchronisation idempotente (on ne retraite jamais deux
// fois le même post) et ce qui permet de comprendre après coup pourquoi une
// publication n'est pas apparue sur le site.
export const facebookPosts = pgTable("facebook_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: text("post_id").notNull().unique(),   // id Graph API du post
  permalink: text("permalink"),
  message: text("message"),                      // texte brut d'origine
  publishedAt: timestamp("published_at"),
  // "published"  : repris sur le site
  // "skipped"    : jugé hors sujet pour un site institutionnel
  // "failed"     : erreur de traitement, sera réessayé
  status: text("status").notNull().default("published"),
  reason: text("reason"),                        // pourquoi écarté ou en échec
  rubrique: text("rubrique"),                    // rubrique retenue
  importance: integer("importance"),             // 0 à 100, décide de la une
  newsId: varchar("news_id").references(() => news.id, { onDelete: "set null" }),
  albumId: varchar("album_id").references(() => albums.id, { onDelete: "set null" }),
  mediaCount: integer("media_count").default(0),
  classifier: text("classifier"),                // "ai" ou "rules"
  // Empreinte du texte : la page republie le même contenu à quelques jours
  // d'écart, ce qui produirait des articles jumeaux sur le site.
  contentHash: text("content_hash"),
  sliderId: varchar("slider_id").references(() => sliders.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type FacebookPost = typeof facebookPosts.$inferSelect;

// Cache des analyses d'images.
// Faire décrire une image par le modèle coûte un appel ; la même image est vue
// à chaque resynchronisation. La clé est l'empreinte du fichier.
export const imageAnalyses = pgTable("image_analyses", {
  cle: varchar("cle").primaryKey(),
  // « analyse » est un mot réservé de PostgreSQL (ANALYZE) : la colonne
  // s'appelle donc "donnees".
  donnees: text("donnees").notNull(), // JSON
  createdAt: timestamp("created_at").defaultNow(),
});

// ==================== GALLERY SCHEMA ====================

// Albums table for organizing gallery content
export const albums = pgTable("albums", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  coverImage: text("cover_image"), // URL of the cover image
  category: text("category").notNull(), // "events", "campus", "student-life", "graduations", etc.
  isActive: boolean("is_active").default(true),
  order: text("order").default("1"),
  source: text("source").default("manual"),
  sourceId: text("source_id").unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => adminUsers.id),
});

// Gallery items (photos and videos) within albums
export const galleryItems = pgTable("gallery_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  albumId: varchar("album_id").notNull().references(() => albums.id, { onDelete: "cascade" }),
  title: text("title"),
  description: text("description"),
  mediaUrl: text("media_url").notNull(), // URL of the image or video
  mediaType: text("media_type").notNull(), // "image" or "video"
  thumbnailUrl: text("thumbnail_url"), // For videos, thumbnail image
  isActive: boolean("is_active").default(true),
  order: text("order").default("1"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => adminUsers.id),
});

// Relations for gallery
export const albumsRelations = relations(albums, ({ many, one }) => ({
  items: many(galleryItems),
  creator: one(adminUsers, {
    fields: [albums.createdBy],
    references: [adminUsers.id],
  }),
}));

export const galleryItemsRelations = relations(galleryItems, ({ one }) => ({
  album: one(albums, {
    fields: [galleryItems.albumId],
    references: [albums.id],
  }),
  creator: one(adminUsers, {
    fields: [galleryItems.createdBy],
    references: [adminUsers.id],
  }),
}));

// Gallery schemas for validation
export const insertAlbumSchema = createInsertSchema(albums).pick({
  title: true,
  description: true,
  coverImage: true,
  category: true,
  isActive: true,
  order: true,
});

export const updateAlbumSchema = createInsertSchema(albums).pick({
  title: true,
  description: true,
  coverImage: true,
  category: true,
  isActive: true,
  order: true,
}).partial();

export const insertGalleryItemSchema = createInsertSchema(galleryItems).pick({
  albumId: true,
  title: true,
  description: true,
  mediaUrl: true,
  mediaType: true,
  thumbnailUrl: true,
  isActive: true,
  order: true,
});

export const updateGalleryItemSchema = createInsertSchema(galleryItems).pick({
  albumId: true,
  title: true,
  description: true,
  mediaUrl: true,
  mediaType: true,
  thumbnailUrl: true,
  isActive: true,
  order: true,
}).partial();

export type Album = typeof albums.$inferSelect;
export type InsertAlbum = z.infer<typeof insertAlbumSchema>;
export type UpdateAlbum = z.infer<typeof updateAlbumSchema>;

export type GalleryItem = typeof galleryItems.$inferSelect;
export type InsertGalleryItem = z.infer<typeof insertGalleryItemSchema>;
export type UpdateGalleryItem = z.infer<typeof updateGalleryItemSchema>;
