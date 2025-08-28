--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (84ade85)
-- Dumped by pg_dump version 16.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP DATABASE neondb;
--
-- Name: neondb; Type: DATABASE; Schema: -; Owner: -
--

CREATE DATABASE neondb WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'C.UTF-8';


\connect neondb

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    email text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    session_id text NOT NULL,
    message text NOT NULL,
    response text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    message text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: founder_message; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.founder_message (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    quote text NOT NULL,
    vision text NOT NULL,
    founder_name text NOT NULL,
    founder_role text NOT NULL,
    founder_organization text NOT NULL,
    founder_image_url text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    updated_by character varying
);


--
-- Name: institutes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institutes (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    link text DEFAULT '/filieres'::text,
    button_text text DEFAULT 'EN SAVOIR PLUS'::text,
    bg_color text DEFAULT 'from-gray-800 to-gray-900'::text,
    is_active boolean DEFAULT true,
    "order" text DEFAULT '1'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying
);


--
-- Name: news; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    summary text,
    content text,
    image_url text,
    date text NOT NULL,
    category text NOT NULL,
    author text NOT NULL,
    featured boolean DEFAULT false,
    is_active boolean DEFAULT true,
    "order" text DEFAULT '1'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying,
    slug text NOT NULL
);


--
-- Name: news_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news_images (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    news_id character varying NOT NULL,
    image_url text NOT NULL,
    caption text,
    "order" integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.programs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    description text,
    image_url text,
    duration text,
    level text,
    is_active boolean DEFAULT true,
    "order" text DEFAULT '1'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying
);


--
-- Name: site_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_content (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    title text NOT NULL,
    value text NOT NULL,
    type text NOT NULL,
    section text NOT NULL,
    "order" text DEFAULT '0'::text,
    updated_at timestamp without time zone DEFAULT now(),
    updated_by character varying
);


--
-- Name: sliders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sliders (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    subtitle text,
    description text,
    image_url text,
    button1_text text,
    button1_link text,
    button2_text text,
    button2_link text,
    is_active boolean DEFAULT true,
    "order" text DEFAULT '1'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    username text NOT NULL,
    password text NOT NULL
);


--
-- Data for Name: admin_users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.admin_users VALUES ('49804d0c-f3f3-48bf-bbf5-7422126db2bc', 'admin', '$2b$10$uWCBXMNTGFvcLXTvpJhw5OyYvYhXp.NBAwWBZs9v6sKi3VODySWhW', 'admin@2iae.com', true, '2025-08-27 17:24:34.085267', '2025-08-27 17:24:34.085267');


--
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.chat_messages VALUES ('69538328-fa2e-4ad3-bc6b-6ba60def7b7c', 'session-1756313698774-0.8672108162504497', 'Tu es la ?', 'Oui, je suis là pour vous aider ! Comment puis-je vous assister aujourd''hui concernant le Groupe Écoles 2IAE International ?', '2025-08-27 17:16:34.960181');


--
-- Data for Name: contacts; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: founder_message; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.founder_message VALUES ('bbadcfa6-8df9-418d-9916-f6e55c4f354b', 'Message du Fondateur', 'L''entrepreneuriat est l''art de transformer les rêves en réalité concrète.', 'Si en Côte d''Ivoire, les écoles et les universités ont réussi dans les programmes de formation des cadres, les moyennes et grandes entreprises, elles ont connu moins de succès dans les programmes destinés aux chefs des petites entreprises, et moins encore dans la constitution d''une nouvelle catégorie d''entrepreneurs. Combien d''Ivoiriens rêvent-ils de créer leur entreprise chaque année ?? Plusieurs milliers peut-être, même plusieurs centaines de milliers! Longtemps restés en arrière-plan de cette formidable aventure de défi personnel, les ivoiriens semblent s''y intéresser de plus en plus. Par manque de formation au niveau entrepreneurial la plupart des entreprises qui se créent, disparaissent en...', 'Koua Séraphin', 'Fondateur et Président Directeur Général', 'Groupe Ecoles 2IAE International', '/api/assets/founder/founder_1756311786515_c950o98h15h.jpg', true, '2025-08-27 16:12:44.630771', '2025-08-27 16:23:21.977', NULL);


--
-- Data for Name: institutes; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.institutes VALUES ('0243cd47-1e25-4487-bad0-09bc8219a6c1', 'INSTITUTS DE FORMATION AUX NOUVELLES TECHNOLOGIES', 'Formation aux technologies numériques et innovations', '/filieres', 'EN SAVOIR PLUS', 'from-green-800 to-green-900', true, '2', '2025-08-27 19:08:34.064195', '2025-08-27 19:08:34.064195', NULL);
INSERT INTO public.institutes VALUES ('c0b517e8-bb75-433c-acbf-64af221e9fbe', 'INSTITUTS DE FORMATION AGRICOLE', 'Formation en agriculture moderne et durable', '/filieres', 'EN SAVOIR PLUS', 'from-orange-800 to-orange-900', true, '3', '2025-08-27 19:08:34.064195', '2025-08-27 19:08:34.064195', NULL);
INSERT INTO public.institutes VALUES ('104a75c0-ebf9-427f-ad92-80681dcec1b0', 'INSTITUTS DE FORMATION EN MANAGEMENT', 'Formation en gestion et management d''entreprise', '/filieres', 'EN SAVOIR PLUS', 'from-blue-800 to-blue-900', true, '1', '2025-08-27 19:08:34.064195', '2025-08-27 19:11:26.609', NULL);
INSERT INTO public.institutes VALUES ('aa03f7f6-b110-4599-804d-151e76be2a8f', 'INSTITUTS DE FORMATION EN GÉNIE CIVIL', 'Formation en génie civil et construction', '/filieres', 'EN SAVOIR PLUS', 'from-purple-800 to-purple-900', true, '4', '2025-08-27 19:13:16.589562', '2025-08-27 19:13:16.589562', NULL);


--
-- Data for Name: news; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.news VALUES ('7d6fd535-434f-4dfb-94eb-1a1ca91d67b6', 'PRIX INTERNATIONAL DES BATISSEURS AFRICAINS', ' Les votes se poursuivent ; N''oubliez pas !
Soutenons notre PDG, M. Séraphin KOUA, candidat aux AfriBusiness Awards 2025 à Dubaï !
Votez ici : https://afribusinesschallenge.com/.../01k22thzarm2h71ejqq...
www.2iae.com
2IAE, l’École des Entrepreneurs', ' Les votes se poursuivent ; N''oubliez pas !
Soutenons notre PDG, M. Séraphin KOUA, candidat aux AfriBusiness Awards 2025 à Dubaï !
Votez ici : https://afribusinesschallenge.com/.../01k22thzarm2h71ejqq...
www.2iae.com
2IAE, l’École des Entrepreneurs', 'https://afribusinesschallenge.com/storage/participants/U46wIOv7ALWgZSEpCxUBHqLYDOxzIWJLssXKsmOl.jpg', '2025-08-27', 'Événements', 'Admin', false, true, '1', '2025-08-27 20:43:20.08087', '2025-08-27 20:43:20.08087', NULL, 'prix-international-des-batisseurs-africains');
INSERT INTO public.news VALUES ('2a7dae01-704b-4bbc-9c57-91b09947e651', 'Signature de convention entre 2IAE et CATALYSTE', 'Signature  de conventions   le lundi  25 Août  2025 entre Catalyste plus et le groupe  Écoles  2IAE  représenté  par son premier  responsable  Séraphin  Koua  et Madame  ,  ......
Représentant  Catalyste  plus.', 'Signature  de conventions   le lundi  25 Août  2025 entre Catalyste plus et le groupe  Écoles  2IAE  représenté  par son premier  responsable  séraphin  koua  et madam  ,  ......
Représentant  Catalyste  plus.', '/api/assets/actualites/news_1756330108173_19e451469c034dae86a9d6d5e6fb91e0.jpg', '2025-08-27', 'Partenariats', 'Direction 2IAE', true, true, '1', '2025-08-27 20:52:10.86244', '2025-08-27 21:31:30.832', NULL, 'signature-de-convention-entre-2iae-et-catalyste');


--
-- Data for Name: news_images; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.news_images VALUES ('fcd1fdaa-3dcf-4c2f-b444-57e3fbc37595', '2a7dae01-704b-4bbc-9c57-91b09947e651', '/api/assets/actualites/news_1756330264179_ca17bf40b7604bb1b17c1750535513ca.jpg', NULL, 1, '2025-08-27 21:31:04.19815');
INSERT INTO public.news_images VALUES ('c9493c22-a041-44e3-adbb-5a13e4305218', '2a7dae01-704b-4bbc-9c57-91b09947e651', '/api/assets/actualites/news_1756330273305_3cd28406848c473fab30f2ede3bf3e50.jpg', NULL, 2, '2025-08-27 21:31:13.323859');
INSERT INTO public.news_images VALUES ('c8688fd1-8812-4565-9af9-1648b0e3f914', '2a7dae01-704b-4bbc-9c57-91b09947e651', '/api/assets/actualites/news_1756330286672_b8886653cb7c4a158aa31a2f0ab55ad3.jpg', NULL, 3, '2025-08-27 21:31:26.692633');


--
-- Data for Name: programs; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.programs VALUES ('02d6cc6b-b59f-4daf-b9f8-6a16dd6be6f8', 'GESTION COMMERCIALE', 'BTS TERTIAIRES', 'Formation en techniques commerciales, marketing et vente pour développer des compétences en gestion des relations clients et développement commercial.', 'https://images.unsplash.com/photo-1556761175-4b46a572b786?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '2 ans', 'BTS', true, '2', '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL);
INSERT INTO public.programs VALUES ('1e8ad5a1-9d61-4d77-a30a-0eb89647d217', 'RESSOURCES HUMAINES & COMMUNICATION', 'BTS TERTIAIRES', 'Formation en gestion des ressources humaines et communication d''entreprise pour devenir un professionnel RH capable de gérer le capital humain.', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '2 ans', 'BTS', true, '3', '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL);
INSERT INTO public.programs VALUES ('9601845c-cc1f-4cfa-bb09-b7dbee4e5b6b', 'LOGISTIQUE', 'BTS TERTIAIRES', 'Formation en gestion logistique et chaîne d''approvisionnement pour optimiser les flux de marchandises et la distribution.', 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '2 ans', 'BTS', true, '4', '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL);
INSERT INTO public.programs VALUES ('9d445675-fa45-4262-a522-f4bec682a73b', 'SCIENCE DE L''INFORMATION', 'BTS INDUSTRIEL', 'Formation en sciences de l''information et technologies numériques pour maîtriser les systèmes d''information modernes.', 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '2 ans', 'BTS', true, '5', '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL);
INSERT INTO public.programs VALUES ('491f3ba2-ebaa-4dd2-aa80-d8ced2597276', 'INFORMATIQUE DÉVELOPPEUR D''APPLICATIONS (IDA)', 'BTS INDUSTRIEL', 'Formation en développement d''applications informatiques pour créer des solutions logicielles innovantes et performantes.', 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '2 ans', 'BTS', true, '6', '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL);
INSERT INTO public.programs VALUES ('aec5eae6-f050-47c9-8afd-e101155b0d98', 'GÉNIE CIVIL OPTION BÂTIMENT (GBAT)', 'BTS INDUSTRIEL', 'Formation en génie civil spécialisée dans la construction de bâtiments pour devenir technicien supérieur en construction.', 'https://images.unsplash.com/photo-1541976590-713941681591?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '2 ans', 'BTS', true, '7', '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL);
INSERT INTO public.programs VALUES ('add068f0-4269-466b-8ced-999085776f22', 'GÉNIE CIVIL OPTION TRAVAUX PUBLICS', 'BTS INDUSTRIEL', 'Formation en génie civil orientée travaux publics pour participer à la construction d''infrastructures publiques.', 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '2 ans', 'BTS', true, '8', '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL);
INSERT INTO public.programs VALUES ('d725a9ba-68a6-4365-a656-f11b0c71a545', 'AGRICULTURE TROPICALE OPTION - PRODUCTION VÉGÉTALE (ATPV)', 'BTS INDUSTRIEL', 'Formation en agriculture tropicale spécialisée en production végétale pour optimiser les rendements agricoles en milieu tropical.', 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '2 ans', 'BTS', true, '9', '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL);
INSERT INTO public.programs VALUES ('c5cfa6ec-ddca-49c9-995d-b53874042b5d', 'MANAGEMENT & ENTREPRENEURIAT', 'LICENCE/MASTER', 'Formation complète en management et entrepreneuriat pour développer les compétences de leadership et créer des entreprises innovantes.', 'https://images.unsplash.com/photo-1497486751825-1233686d5d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '3 ans', 'Licence', true, '10', '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL);
INSERT INTO public.programs VALUES ('9c596d84-c5b8-43ee-8ed3-aa382d72f6d3', 'MARKETING DIGITAL & COMMUNICATION', 'LICENCE/MASTER', 'Formation en marketing digital et communication pour maîtriser les stratégies de communication numérique et les réseaux sociaux.', 'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '3 ans', 'Licence', true, '11', '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL);
INSERT INTO public.programs VALUES ('0f884988-c10a-4dd0-9df5-7f923aa8f70b', 'GESTION FINANCIÈRE & CONTRÔLE', 'LICENCE/MASTER', 'Formation avancée en gestion financière et contrôle de gestion pour devenir expert en analyse financière et pilotage d''entreprise.', 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '3 ans', 'Licence', true, '12', '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL);
INSERT INTO public.programs VALUES ('e508269f-ce2d-40d3-ab0a-bc7318ca3e85', 'CRÉATION & GESTION D''ENTREPRISE', 'CERTIFICAT', 'Formation intensive en création et gestion d''entreprise pour accompagner les porteurs de projets dans la concrétisation de leur vision entrepreneuriale.', 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '6 mois', 'Certificat', true, '13', '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL);
INSERT INTO public.programs VALUES ('88943b35-59a9-4bf1-b924-88b5d398dab5', 'COMPTABILITÉ ANALYTIQUE & FISCALITÉ', 'CERTIFICAT', 'Formation spécialisée en comptabilité analytique et fiscalité pour maîtriser les aspects comptables et fiscaux d''une entreprise.', 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '4 mois', 'Certificat', true, '14', '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL);
INSERT INTO public.programs VALUES ('ffd5a4f2-94e0-438b-abfb-04a350d5280d', 'LEADERSHIP & MANAGEMENT D''ÉQUIPE', 'CERTIFICAT', 'Formation en leadership et management d''équipe pour développer les compétences de direction et d''animation d''équipes performantes.', 'https://images.unsplash.com/photo-1600880292089-90a7e086ee0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '3 mois', 'Certificat', true, '15', '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL);
INSERT INTO public.programs VALUES ('f5ad5015-09b4-4105-b016-e718c8303425', 'FINANCE COMPTABILITÉ & GESTION D''ENTREPRISE', 'BTS TERTIAIRES', 'Formation complète en finance, comptabilité et gestion d''entreprise pour former des experts financiers capables de gérer les ressources d''une organisation.', 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '2 ans', 'BTS', true, '1', '2025-08-28 06:30:17.982851', '2025-08-28 06:47:10.145', NULL);


--
-- Data for Name: site_content; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.site_content VALUES ('2af679b8-f095-4cf9-976b-2a3aabbde723', 'homepage_title', 'Titre principal de la page d''accueil', '2IAE INTERNATIONAL', 'text', 'homepage', '1', '2025-08-27 15:07:53.087', NULL);
INSERT INTO public.site_content VALUES ('5e4425c8-4935-4106-bee9-fae17de7bddc', 'homepage_subtitle', 'Sous-titre de la page d''accueil', 'L''ÉCOLE DES ENTREPRENEURS', 'text', 'homepage', '2', '2025-08-27 15:07:53.13271', NULL);
INSERT INTO public.site_content VALUES ('df68ea83-8c84-4964-b8e7-b0eb9d41b7a1', 'homepage_slogan', 'Slogan officiel', '2IAE, entreprendre pour devenir l''élite de demain.', 'text', 'homepage', '3', '2025-08-27 15:07:53.175979', NULL);
INSERT INTO public.site_content VALUES ('b4a6771a-281e-4902-9c12-64f0bf108d09', 'about_description', 'Description À propos', '2IAE International est une institution d''enseignement supérieur spécialisée dans l''entrepreneuriat, située à Abidjan, Côte d''Ivoire.', 'textarea', 'about', '1', '2025-08-27 15:07:53.219741', NULL);


--
-- Data for Name: sliders; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.sliders VALUES ('6b59da7a-3f0d-4a44-9a3f-65c073dd9235', 'Bienvenue à 2IAE International', 'L''ÉCOLE DES ENTREPRENEURS', 'Formez-vous aux métiers de demain avec nos programmes reconnus et nos formations de qualité.', 'https://z-p3-scontent.fabj8-1.fna.fbcdn.net/v/t39.30808-6/534517010_1382046610587487_2896989814974958510_n.jpg?_nc_cat=109&ccb=1-7&_nc_sid=833d8c&_nc_eui2=AeHEC0W3qoz932Ga2c0HzyTI8z3SqkDZKeDzPdKqQNkp4GAuMl8EuAHAAqh1M7GEazWUKlmJs70ayZ4wMoMRjPaY&_nc_ohc=x3pFAUfn7gIQ7kNvwGZ8OMw&_nc_oc=AdlITggUDu6l5hEzIcy3wukiGbiNS-vzYcmtjD_buuT5q7W9mr8kKMh-vOiECeRK5pk&_nc_zt=23&_nc_ht=z-p3-scontent.fabj8-1.fna&_nc_gid=-rwEUQXb93TMNi6aPU971Q&oh=00_AfVlEEPccNcPHQGxcn5olNIcg7rhFwdTBHBig1-fs-AyUg&oe=68B4E9A7', 'Découvrir nos programmes', '/filieres', 'Nous contacter', '/contact', true, '1', '2025-08-27 15:07:53.688718', '2025-08-27 15:21:47.323', NULL);
INSERT INTO public.sliders VALUES ('868125e6-aa58-4186-8e91-4ec2123bc1de', 'Excellence Académique', 'FORMATION DE QUALITÉ', 'Des programmes reconnus et des formations adaptées aux besoins du marché du travail.', '/api/assets/sliders/slider_1756310758893_yf48p14frs.jpg', 'En savoir plus', '/a-propos', 'Contactez-nous', '/contact', true, '2', '2025-08-27 15:07:53.751034', '2025-08-27 17:00:34.105', NULL);


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);


--
-- Name: admin_users admin_users_username_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_username_unique UNIQUE (username);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: founder_message founder_message_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.founder_message
    ADD CONSTRAINT founder_message_pkey PRIMARY KEY (id);


--
-- Name: institutes institutes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institutes
    ADD CONSTRAINT institutes_pkey PRIMARY KEY (id);


--
-- Name: news_images news_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_images
    ADD CONSTRAINT news_images_pkey PRIMARY KEY (id);


--
-- Name: news news_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news
    ADD CONSTRAINT news_pkey PRIMARY KEY (id);


--
-- Name: news news_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news
    ADD CONSTRAINT news_slug_unique UNIQUE (slug);


--
-- Name: programs programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programs
    ADD CONSTRAINT programs_pkey PRIMARY KEY (id);


--
-- Name: site_content site_content_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_content
    ADD CONSTRAINT site_content_key_unique UNIQUE (key);


--
-- Name: site_content site_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_content
    ADD CONSTRAINT site_content_pkey PRIMARY KEY (id);


--
-- Name: sliders sliders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sliders
    ADD CONSTRAINT sliders_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: founder_message founder_message_updated_by_admin_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.founder_message
    ADD CONSTRAINT founder_message_updated_by_admin_users_id_fk FOREIGN KEY (updated_by) REFERENCES public.admin_users(id);


--
-- Name: institutes institutes_created_by_admin_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institutes
    ADD CONSTRAINT institutes_created_by_admin_users_id_fk FOREIGN KEY (created_by) REFERENCES public.admin_users(id);


--
-- Name: news news_created_by_admin_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news
    ADD CONSTRAINT news_created_by_admin_users_id_fk FOREIGN KEY (created_by) REFERENCES public.admin_users(id);


--
-- Name: news_images news_images_news_id_news_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_images
    ADD CONSTRAINT news_images_news_id_news_id_fk FOREIGN KEY (news_id) REFERENCES public.news(id) ON DELETE CASCADE;


--
-- Name: programs programs_created_by_admin_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programs
    ADD CONSTRAINT programs_created_by_admin_users_id_fk FOREIGN KEY (created_by) REFERENCES public.admin_users(id);


--
-- Name: site_content site_content_updated_by_admin_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_content
    ADD CONSTRAINT site_content_updated_by_admin_users_id_fk FOREIGN KEY (updated_by) REFERENCES public.admin_users(id);


--
-- Name: sliders sliders_created_by_admin_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sliders
    ADD CONSTRAINT sliders_created_by_admin_users_id_fk FOREIGN KEY (created_by) REFERENCES public.admin_users(id);


--
-- PostgreSQL database dump complete
--

