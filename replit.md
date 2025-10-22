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
- **Remediations Table**: Tracks automated remediation attempts with status, original/remediated code diffs, LLM model used, PR URLs, and attempt counts
- **Settings Table**: Stores user configuration for LLM providers, endpoints, API keys, and preferences
- **Relationships**: Foreign key relationships between scans→issues and issues→remediations

### Security Scanning Engine
- **Multi-Tool Integration**: Comprehensive security scanning with 8 different tools:
  - ESLint for code quality and security linting
  - npm audit for dependency vulnerability scanning
  - Custom security pattern matching for additional threat detection
  - Semgrep for advanced static analysis (SAST)
  - Trivy for vulnerability and misconfiguration scanning
  - TruffleHog for secret detection
  - Bandit for Python security analysis
  - Safety for Python dependency vulnerability checking
- **Asynchronous Processing**: Background scan execution with progress tracking
- **GitHub Integration**: Repository cloning and validation through GitHub API
- **Real-time Updates**: Progress polling system for live scan status updates
- **Security Hardening**: 
  - Path traversal protection with secure directory validation
  - Input sanitization and validation for all user inputs
  - Secure logging practices preventing format string vulnerabilities
  - UUID validation for scan IDs to prevent injection attacks
  - Integrity checking for external scripts with SHA-384 hashes

### External Dependencies
- **GitHub API**: Repository validation and metadata retrieval
- **Git Operations**: Repository cloning using system git commands
- **Security Tools**: 
  - ESLint for JavaScript/TypeScript code quality
  - npm audit for Node.js dependency vulnerabilities
  - Semgrep for multi-language static analysis
  - Trivy for container and filesystem vulnerability scanning
  - TruffleHog for secrets and credentials detection
  - Bandit for Python security issues
  - Safety for Python package vulnerability checking
- **Development Tools**: 
  - Replit integration for development environment
  - Vite dev server with HMR for development
  - TypeScript compiler for type checking

### API Structure
- **GET /api/scans**: Retrieve all scans
- **GET /api/scans/:id**: Get specific scan with associated issues
- **POST /api/scans**: Create new security scan with repository URL and options
- **POST /api/scans/:scanId/issues/:issueId/remediate**: Generate AI-powered fix for a specific issue
- **POST /api/scans/:scanId/issues/:issueId/create-pr**: Create GitHub pull request with remediated code
- **GET /api/settings**: Retrieve current LLM and GitHub settings
- **POST /api/settings**: Update LLM provider and configuration settings
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
- **Security Utilities**: Centralized security utilities in `server/utils/security.ts` for input validation and safe operations

### Recent Security Enhancements (August 14, 2025)
- **Vulnerability Resolution**: Fixed all critical path traversal vulnerabilities with secure path validation
- **Logging Security**: Replaced unsafe logging practices with structured secure logging to prevent format string attacks
- **Input Validation**: Added comprehensive input sanitization for repository names, scan IDs, and file paths
- **Directory Protection**: Implemented secure temporary directory generation with randomized suffixes
- **Error Handling**: Enhanced error handling to prevent information leakage in error messages
- **Semgrep Compliance**: Resolved all medium-severity path traversal warnings identified by Semgrep static analysis
- **Defense in Depth**: Implemented multi-layer security validation including character filtering, path normalization, and boundary checking

### Automated Remediation Features (October 22, 2025)
SecureScan now includes intelligent automated remediation capabilities that use AI to suggest and apply fixes for detected security issues:

#### LLM Integration Service
- **Multi-Provider Support**: Configurable LLM providers including Ollama (for local models like Llama), OpenAI, Anthropic, and custom endpoints
- **Flexible Configuration**: Settings page allows users to configure model endpoints, API keys, and select preferred providers
- **Robust Error Handling**: Comprehensive error handling with fallback mechanisms and detailed error messages
- **Type Safety**: Strongly typed responses with Zod schema validation

#### Automated Remediation System
- **Intelligent Fix Generation**: Uses LLM models to analyze security issues and generate context-aware code fixes
- **Code Preservation**: Ensures fixes maintain code functionality while addressing security concerns
- **Diff Preview**: Side-by-side diff viewer showing original code vs. proposed fixes before applying
- **Tracking System**: Database schema tracks remediation attempts, status, and metadata
- **Multi-Attempt Support**: Tracks multiple remediation attempts per issue with success/failure status

#### GitHub PR Integration
- **Automated PR Creation**: Creates pull requests directly from remediation fixes with detailed descriptions
- **Security Hardening**: Uses `simple-git` library to prevent command injection vulnerabilities
- **Branch Naming**: Automatic branch naming with severity level and issue ID
- **Commit Messages**: Well-formatted commit messages including issue title and description
- **OAuth Integration**: Leverages Replit's GitHub connector for secure authentication
- **Path Validation**: Comprehensive file path sanitization to prevent path traversal attacks

#### User Interface Enhancements
- **Issue Actions**: Each detected issue includes "Remediate" and "Create PR" action buttons
- **Visual Feedback**: Loading states, success/error messages, and progress indicators
- **Diff Viewer Component**: Syntax-highlighted side-by-side comparison of code changes
- **Settings Management**: Dedicated settings page for configuring LLM endpoints and GitHub integration
- **Real-time Updates**: Automatic cache invalidation and UI updates after remediation actions

#### Security Considerations
- **Input Sanitization**: All file paths and branch names are sanitized before use
- **No Shell Injection**: Replaced unsafe `exec()` calls with type-safe library methods
- **API Key Protection**: Secure storage of API keys and tokens using Replit's secret management
- **Path Traversal Prevention**: Validates all file paths to ensure they stay within repository boundaries
- **Rate Limiting Ready**: Infrastructure supports rate limiting for LLM API calls