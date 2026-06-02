# GoldenHours
GoldenHours is a smart travel planning application designed specifically for people lacking time. Regular travel planning applications consider whole days when designing an itinerary; thus, the itinerary created is often too long for tourists having limited time for visiting particular sites. Nevertheless, this problem is easily overcome by GoldenHours because this software program makes it possible to generate a personalized schedule taking into consideration how much time the traveler has, his/her preferences, and the speed at which he or she travels.

The traveler simply states his or her destination, amount of time he or she has available between one and four hours, favorite activities like culture, food, nature, shopping, art, or history, and the means of transport. After considering this information, GoldenHours generates a personalized schedule making sure that every destination in the list fits into the time available.

---
## Features
- Secure user authentication and profile management
- Personalized travel itineraries for 1–4 hour city visits
- Interest-based recommendations including culture, food, nature, shopping, art, and history
- Interactive maps and route visualization using Leaflet
- Responsive design for desktop and mobile devices
- Carbon footprint tracking using CodeCarbon
---
## Live App
https://new-proj-ufyw.onrender.com/

GoldenHours is publicly accessible and can be used directly through thedeployed application without any local installation.
---
## Running locally
### Installation

### Prerequisites
```bash
Node.js (v18 or later)
npm
```
---
## Clone the Repository
```bash
git clone https://gitlab.eurecom.fr/Nayoneeka23/golden-hours.git

cd golden-hours
```

## Install Frontend Dependencies
```bash
npm install
```

## Install Backend Dependencies
```bash
cd backend
npm install
```

## Start Backend Server
```bash
npm run dev
```

## Start Frontend Application
Open a new terminal:
```bash
cd golden-hours
npm run dev
```

## Access the Application
http://127.0.0.1:5173
---
## Carbon Emission Measurement
GoldenHours includes sustainability monitoring using CodeCarbon.
- Run: python measure_carbon.py

This script is for tracking application energy consumption and estimates CO₂ emissions generated during executions. Results are stored for analysis and reporting.
---
## Progressive Web App
GoldenHours supports Progressive Web App functionality:
- Installable on supported devices
- Web manifest support
- Mobile-friendly experience
- Enhanced accessibility
---
## Project Outcomes
- Responsive web application
- Personalized travel recommendations
- Interactive route management
- Carbon footprint analysis
- Progressive Web App support
---
## Team
- Nayoneeka Paul
- Adhitya Kiran Kanakaraj
- Ketaki Chavan
- Nareshini Tamilarasan
---
## Tech Stack

### Frontend
- React - User interface development
- Vite - Frontend build tool and development server
- Leaflet - Interactive maps and route visualization
- React Router DOM - Client-side routing and navigation
- React Toastify - User notifications and alerts

### Backend
- Node.js - Server-side application logic
- Native HTTP module - REST API implementation

### APIs & Services
- Geoapify API - Location search, geocoding and route generation

### Deployment
- Render - Application hosting and deployment
---
## Project structure
```text
src/
├── main.jsx          # Main React application
├── itinerary.js      # Itinerary generation algorithm
├── RouteMap.jsx      # Leaflet map component

backend/
├── server.js         # REST API server
├── data/             # Places database and saved plans

public/
├── sw.js             # Service worker

manifest.webmanifest  # PWA configuration
measure_carbon.py     # CodeCarbon measurement script
emissions.csv         # Carbon measurement results
```