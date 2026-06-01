# GoldenHours
A travel planning web app built for the Web Intelligence course at EURECOM (Spring 2026).
The idea is simple — most travel apps are made for full day trips. We built this for when you only have 1 to 4 hours free and want to actually do something useful with that time. You enter your location, how much time you have, what you're into, and it gives you a short itinerary that fits.
---
## Live App
https://new-proj-ufyw.onrender.com/
---
## Team
- Nayoneeka Paul
- Adhitya Kiran Kanakaraj
- Ketaki Chavan
- Nareshini Tamilarasan
---
## What it does
- Sign up and log in to access the planner
- Enter your location, pick 1 to 4 hours, choose your interests (Culture, Food, Nature, Shopping, Art, History), pace (Relaxed, Moderate, Fast) and whether you're walking or taking transit
- Get a personalised itinerary where the stops actually fit your time
- Drag and drop stops to reorder them
- See the route on a map
- Save trips and come back to them later
- Works on mobile
---
## Tech used
- React + Vite (frontend)
- Node.js with built-in http module (backend, no Express)
- Leaflet for the map
- React Router DOM for navigation
- React Toastify for notifications
- Geoapify API for location search and routing
- localStorage for saving preferences and credentials
- Deployed on Render.com
---
## How to run locally
Clone the repo first
git clone https://gitlab.eurecom.fr/Nayoneeka23/golden-hours.git
cd golden-hours
Install and start the backend
cd backend
npm install
npm run dev
Open a new terminal and start the frontend
cd golden-hours
npm install
npm run dev
Then open http://127.0.0.1:5173 in your browser
---
## Project structure
src/main.jsx — all React screens and components
src/itinerary.js — the algorithm that fits stops into your time budget
src/RouteMap.jsx — Leaflet map component
backend/server.js — Node.js REST API
backend/data/ — places database and saved plans
public/sw.js — service worker for PWA
manifest.webmanifest — PWA manifest
measure_carbon.py — CodeCarbon script we used for carbon measurement
emissions.csv — results from the carbon measurement
---
## Course requirements met
- Lighthouse accessibility score: 95/100
- W3C HTML validation: 0 errors, 0 warnings
- Carbon footprint: approximately 5.7 mg CO2eq per session measured with CodeCarbon
- GitLab commit history with 19 commits
- Deployed at https://new-proj-ufyw.onrender.com/
## Course requirements met
- Lighthouse accessibility score: 95/100
- W3C HTML validation: 0 errors, 0 warnings
- Carbon footprint: approximately 5.7 mg CO2eq per session measured with CodeCarbon
- GitLab commit history with 19 commits
- Deployed at https://new-proj-ufyw.onrender.com/
