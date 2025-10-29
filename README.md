# Spread A Smile (SAS)

![Spread A Smile Logo](https://img.shields.io/badge/SAS-Spread%20A%20Smile-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Version](https://img.shields.io/badge/version-1.0.0-orange)

A comprehensive web application to manage volunteer visits to schools, enabling college students to teach and inspire children while tracking impact.

## 📑 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the Application](#running-the-application)
    - [Background Notifications](#background-notifications)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)
  - [One-off migration: backfill upload windows](#one-off-migration-backfill-upload-windows)

## 🌟 Overview

Spread A Smile (SAS) is a platform designed to facilitate and manage volunteer visits by college students to local schools. The platform helps organize teams, schedule visits, submit reports, and track the impact of these educational outreach programs.

The system allows volunteers to:
- Join teams and coordinate school visits
- Schedule and plan teaching sessions
- Submit detailed reports with photos and videos after visits
- Track their volunteer work and impact

Administrators can:
- Manage schools, volunteers, and teams
- Review visit reports and media
- Access analytics on volunteer activities and impact
- Monitor overall program effectiveness

## 🚀 Features

### User Authentication
- Secure login and registration
- Role-based access (admin, volunteer)
- JWT-based authentication

### Volunteer Management
- Team creation and assignment
- Volunteer profiles and skills tracking
- Availability management

### School Management
- School profiles and contact information
- Class information and needs assessment
- Visit history and statistics

### Visit Scheduling & Reporting
- Interactive visit planning
- Comprehensive report submission
- Photo and video uploads
- Teaching topics and methods tracking

### Analytics & Dashboards
- Volunteer participation metrics
- School engagement statistics
- Impact assessment visualizations
- Administrative overview

### Other Features
- Responsive UI for mobile and desktop
- Real-time notifications
- File upload/download capabilities
- Export data for reporting

## 💻 Technology Stack

### Frontend
- HTML5, CSS3, JavaScript
- Responsive design with custom CSS
- Font Awesome for icons
- Client-side form validation

### Backend
- Node.js (v14+)
- Express.js framework
- MongoDB Atlas for database
- Mongoose ODM
- JWT for authentication
- Bcrypt for password hashing
- Multer for file uploads
- Express Validator for input validation
- Nodemailer for email notifications

### DevOps & Tools
- Git for version control
- Jest for testing
- Nodemon for development
- dotenv for environment configuration

## 📁 Project Structure

```
SAS/
├── backend/
│   ├── config/
│   │   └── database.js
│   ├── controllers/
│   │   ├── adminController.js
│   │   ├── analyticsController.js
│   │   ├── authController.js
│   │   ├── feedbackController.js
│   │   ├── schoolController.js
│   │   ├── visitController.js
│   │   └── volunteerController.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── role.js
│   │   └── upload.js
│   ├── models/
│   │   ├── School.js
│   │   ├── Team.js
│   │   ├── User.js
│   │   └── Visit.js
│   ├── routes/
│   │   ├── admin.js
│   │   ├── analytics.js
│   │   ├── auth.js
│   │   ├── feedback.js
│   │   ├── schools.js
│   │   ├── visits.js
│   │   └── volunteers.js
│   ├── tests/
│   │   ├── api.test.js
│   │   ├── integration.test.js
│   │   ├── comprehensive.test.js
│   │   └── ...
│   ├── uploads/
│   ├── .env
│   ├── package.json
│   └── server.js
│
├── frontend/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── register.js
│   │   └── script.js
│   ├── tests/
│   │   └── functional.test.js
│   ├── about.html
│   ├── analytics.html
│   ├── dashboard.html
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── schedule-visit.html
│   ├── schools.html
│   ├── teams.html
│   ├── visit-gallery.html
│   ├── visit-report.html
│   └── visits.html
│
├── .gitignore
├── package.json
├── jest.config.js
└── README.md
```

## 🚦 Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)
- MongoDB Atlas account or local MongoDB installation
- Git

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/SAS.git
cd SAS
```

2. Install backend dependencies
```bash
cd backend
npm install
```

3. Install frontend dependencies (if using package manager for frontend)
```bash
cd ../frontend
# If using npm for frontend dependencies
npm install
```

### Environment Variables

Create a `.env` file in the backend directory with the following variables:

```env
PORT=5001
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=30d
EMAIL_SERVICE=your_email_service
EMAIL_USERNAME=your_email_username
EMAIL_PASSWORD=your_email_password
```

### Running the Application

1. Start the backend server
```bash
cd backend
npm run dev
```

2. Access the application
   - Open your browser and navigate to `http://localhost:5001`
   - The API endpoints are available at `http://localhost:5001/api/`
   - Health check endpoint: `http://localhost:5001/api/health`

### Background Notifications

A lightweight worker sends reminders and upload-window alerts to team members:

- Reminders for upcoming visits (next 24h)
- Report submission reminders for recently completed visits
- Upload window alerts for scheduled visits:
  - When uploads open (12:00 PM IST on visit date)
  - 1 hour before the upload window closes
  - When uploads close (48 hours after open)

Run it on a schedule (e.g., every 10–15 minutes) with your process manager or cron. It reads the same environment as the backend and connects via `MONGODB_URI`:

```bash
# example (cron, every 15 minutes)
*/15 * * * * cd /path/to/SAS/backend && /usr/bin/node scripts/notification-worker.js >> /var/log/sas-worker.log 2>&1
```

The worker is idempotent and uses flags on each Visit to avoid duplicate notifications.

### One-off migration: backfill upload windows

If your database contains legacy visits created before the upload window feature, run the backfill to compute and store per-visit upload windows and safe defaults:

- Computes uploadWindowStartUtc (12:00 PM IST on the visit date) and uploadWindowEndUtc (+48 hours)
- Ensures timezone='Asia/Kolkata' and uploadVisibility='public' if missing
- Sets notification flags to prevent spamming users for old visits:
  - For completed/cancelled or already-closed windows: marks all window flags true
  - For currently-open windows: marks windowOpenNotified true (so no immediate "open now" blast)
  - For future windows: keeps flags false so the worker can notify later

Run a dry-run first to review the changes, then run the actual update:

```bash
# From the backend folder
node scripts/backfill-upload-windows.js --dry-run
node scripts/backfill-upload-windows.js

# Or via npm script
npm run migrate:windows -- --dry-run
npm run migrate:windows
```

Environment variables: use MONGODB_URI (or MONGO_URI) and optional DB_NAME to target the correct database.

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and get token
- `GET /api/auth/me` - Get current user profile

### Volunteer Endpoints
- `GET /api/volunteers` - Get all volunteers
- `GET /api/volunteers/:id` - Get volunteer by ID
- `PUT /api/volunteers/:id` - Update volunteer profile

### School Endpoints
- `GET /api/schools` - Get all schools
- `POST /api/schools` - Add a new school
- `GET /api/schools/:id` - Get school by ID
- `PUT /api/schools/:id` - Update school details
- `DELETE /api/schools/:id` - Delete a school

### Visit Endpoints
- `GET /api/visits` - Get all visits
- `POST /api/visits` - Schedule a new visit
- `GET /api/visits/:id` - Get visit details
- `POST /api/visits/:id/upload` - Upload visit photos/videos
- `PUT /api/visits/:id/complete-report` - Submit visit report
- `GET /api/visits/stats` - Get visit statistics

### Admin Endpoints
- `GET /api/admin/dashboard` - Get admin dashboard data
- `POST /api/admin/users` - Create a user (admin only)
- `PUT /api/admin/users/:id` - Update any user (admin only)

### Analytics Endpoints
- `GET /api/analytics/overview` - Get program analytics overview
- `GET /api/analytics/schools` - Get school-specific analytics
- `GET /api/analytics/volunteers` - Get volunteer participation analytics

## 🧪 Testing

The project includes comprehensive test suites:

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:api
npm run test:integration
npm run test:comprehensive
npm run test:security
npm run test:performance

# Get test coverage report
npm run test:coverage
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.
