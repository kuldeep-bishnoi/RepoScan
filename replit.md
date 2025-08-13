# SecureScan - GitHub Security Scanner

## Overview

SecureScan is a comprehensive security analysis tool for GitHub repositories that performs automated vulnerability scanning using multiple security tools. The application provides a web-based interface for initiating scans, tracking progress in real-time, and viewing detailed security findings. It combines static code analysis (ESLint), dependency vulnerability scanning (npm audit), and custom security pattern detection to provide comprehensive security coverage.

The system is built as a full-stack web application with a React frontend and Express.js backend, designed to clone GitHub repositories and perform various security scans while providing real-time feedback to users.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Framework**: Radix UI components with shadcn/ui design system
- **Styling**: Tailwind CSS with custom design tokens and CSS variables
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod schema validation

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with JSON responses
- **Request Processing**: Express middleware for JSON parsing, URL encoding, and request/response logging
- **Error Handling**: Centralized error handling middleware with structured error responses

### Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Connection**: Neon Database serverless PostgreSQL for cloud hosting
- **Development Storage**: In-memory storage implementation for development/testing

### Database Schema
- **Scans Table**: Stores scan metadata including repository URL, status, progress, and scan options
- **Issues Table**: Stores individual security findings with severity levels, file locations, and remediation guidance
- **Relationships**: Foreign key relationship between scans and their associated issues

### Security Scanning Engine
- **Multi-Tool Integration**: Combines ESLint, npm audit, and custom security pattern detection
- **Asynchronous Processing**: Background scan execution with progress tracking
- **GitHub Integration**: Repository cloning and validation through GitHub API
- **Real-time Updates**: Progress polling system for live scan status updates

### External Dependencies
- **GitHub API**: Repository validation and metadata retrieval
- **Git Operations**: Repository cloning using system git commands
- **Security Tools**: 
  - ESLint for code quality and security linting
  - npm audit for dependency vulnerability scanning
  - Custom security pattern matching for additional threat detection
- **Development Tools**: 
  - Replit integration for development environment
  - Vite dev server with HMR for development
  - TypeScript compiler for type checking

### API Structure
- **GET /api/scans**: Retrieve all scans
- **GET /api/scans/:id**: Get specific scan with associated issues
- **POST /api/scans**: Create new security scan with repository URL and options
- **Real-time Progress**: Polling-based progress tracking during scan execution

### Authentication & Authorization
- Currently implements session-based approach with plans for extension
- No authentication currently required for basic scanning functionality
- Designed for extension with user authentication and authorization

### File Organization
- **Monorepo Structure**: Client and server code in separate directories with shared types
- **Shared Schema**: Common TypeScript types and Zod schemas in shared directory
- **Component Architecture**: Modular React components with clear separation of concerns
- **Service Layer**: Dedicated service classes for GitHub operations and security scanning