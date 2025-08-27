# Overview

This is a modern full-stack web application for "2IAE International", an educational institution in Côte d'Ivoire that offers entrepreneurship and business programs. The application serves as their official website, providing information about programs, campus facilities, and allowing prospective students to contact the institution.

The application is built with a React frontend using shadcn/ui components for the user interface, Express.js backend for API services, and includes database integration with Drizzle ORM. The site features a responsive design optimized for both desktop and mobile devices, with smooth scrolling navigation and modern UI components.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **Routing**: Wouter for lightweight client-side routing
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Form Handling**: React Hook Form with Zod validation

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API endpoints for contact form submissions
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Validation**: Zod schemas for request/response validation
- **Development**: Hot reload with Vite integration in development mode

## Data Storage
- **Database**: PostgreSQL with connection pooling
- **Database Client**: Neon Database serverless driver
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Storage Interface**: Abstracted storage layer with in-memory fallback for development
- **Session Management**: Connect-pg-simple for PostgreSQL session storage

## Key Features
- **Contact Form**: Full-featured contact system with form validation and email collection
- **Responsive Design**: Mobile-first approach with Tailwind CSS breakpoints
- **Smooth Scrolling**: Single-page application with smooth scroll navigation
- **Toast Notifications**: User feedback system using Radix UI toast components
- **Loading States**: Optimistic updates and loading indicators using React Query
- **Error Handling**: Comprehensive error boundaries and API error management

## Development Workflow
- **Type Safety**: Full TypeScript coverage across frontend, backend, and shared schemas
- **Code Organization**: Monorepo structure with shared types and schemas
- **Hot Reload**: Development server with instant refresh capabilities
- **Build Process**: Separate build processes for client and server with optimized bundles

# External Dependencies

## Core Framework Dependencies
- **@tanstack/react-query**: Server state management and caching
- **wouter**: Lightweight routing for React applications
- **react-hook-form**: Form state management and validation
- **@hookform/resolvers**: Zod integration for form validation

## UI Component Library
- **@radix-ui/react-***: Comprehensive set of accessible UI primitives including dialogs, dropdowns, navigation, form controls, and feedback components
- **shadcn/ui**: Pre-built component library based on Radix UI
- **class-variance-authority**: Component variant management
- **tailwindcss**: Utility-first CSS framework
- **clsx**: Conditional className utility

## Database and Validation
- **drizzle-orm**: Type-safe ORM for PostgreSQL
- **drizzle-zod**: Integration between Drizzle and Zod for schema validation
- **@neondatabase/serverless**: Serverless PostgreSQL client
- **zod**: Schema validation library

## Development Tools
- **vite**: Build tool and development server
- **typescript**: Static type checking
- **@replit/vite-plugin-***: Replit-specific development plugins
- **esbuild**: Fast JavaScript bundler for production builds

## Date and Utility Libraries
- **date-fns**: Date manipulation utilities
- **nanoid**: Unique ID generation
- **cmdk**: Command palette component