# 🎯 Duroflex Call & Video Analysis Platform

> **An AI-powered platform for analyzing customer interaction calls and in-store videos for Duroflex, leveraging Google Gemini for intelligent audio/video analysis, sentiment detection, sales assessment, and actionable insights.**

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Backend — Detailed File Breakdown](#backend--detailed-file-breakdown)
  - [main.py — Application Entry Point](#mainpy--application-entry-point)
  - [gemini_service.py — AI Analysis Engine](#gemini_servicepy--ai-analysis-engine)
  - [Audio Processors](#audio-processors)
  - [Service Layers (CRUD & Analytics)](#service-layers-crud--analytics)
  - [Video Analysis Pipeline](#video-analysis-pipeline)
  - [Authentication](#authentication)
  - [Google Drive Integration](#google-drive-integration)
  - [Utility Scripts](#utility-scripts)
- [Frontend — Detailed File Breakdown](#frontend--detailed-file-breakdown)
  - [Configuration & Entry Files](#configuration--entry-files)
  - [Routing & Navigation](#routing--navigation)
  - [Component Modules](#component-modules)
  - [Utility Functions](#utility-functions)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Data Flow](#data-flow)
- [Environment Variables](#environment-variables)
- [Setup & Installation](#setup--installation)
- [Running the Application](#running-the-application)

---

## Overview

The **Duroflex Call & Video Analysis Platform** is a full-stack web application designed to:

1. **Ingest** customer interaction audio recordings and in-store video footage.
2. **Analyze** them using Google's Gemini AI models to extract structured insights.
3. **Store** the analysis reports in MongoDB.
4. **Visualize** the data through rich, interactive dashboards with filtering, sorting, and aggregated analytics.
5. **Chat** with an AI assistant about the analyzed video data.

The platform supports **four distinct call/interaction modules**:

| Module | Type | Description |
|---|---|---|
| **GMB Inbound** | Audio Calls | Google My Business inbound customer calls |
| **ABC Outbound** | Audio Calls | ABC outbound sales calls |
| **Store Walk-in Outbound** | Audio Calls | Post-store-visit outbound follow-up calls |
| **Popins Inbound** | Video | In-store video recordings of customer interactions |

Each module has its own upload pipeline, analysis prompt, report storage, report listing, detailed report view, and aggregated analytics dashboard.

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                     │
│                                                                    │
│   Login ──► Dashboard ──┬── GMB Reports / Analytics / Upload       │
│                         ├── ABC Reports / Analytics / Upload       │
│                         ├── Store Walk-in Reports / Analytics / Up  │
│                         ├── Video Reports / Analytics / Upload      │
│                         └── AI Video Chatbot                       │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ REST API (fetch + JWT Auth)
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                      BACKEND (FastAPI + Uvicorn)                   │
│                                                                    │
│   main.py ──┬── auth_service.py          (JWT Authentication)      │
│             ├── GmbCall_processor.py      (GMB Audio → Gemini)     │
│             ├── abc_processor.py          (ABC Audio → Gemini)     │
│             ├── outbound_processor.py     (Walk-in Audio → Gemini) │
│             ├── video_analysis_service.py (Video → Gemini)         │
│             ├── GmbCall_service.py        (GMB CRUD + Analytics)   │
│             ├── abc_service.py            (ABC CRUD + Analytics)   │
│             ├── outbound_call_service.py  (Walk-in CRUD + Analytics│
│             ├── video_chatbot_service.py  (AI Chatbot)             │
│             └── gemini_service.py         (Gemini API Wrapper)     │
└──────────┬───────────────────┬─────────────────────────────────────┘
           │                   │
           ▼                   ▼
┌─────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│    MongoDB       │  │  Google Gemini   │  │   Google Drive       │
│  (Data Store)    │  │  (AI Analysis)   │  │  (File Storage)      │
│                  │  │                  │  │                      │
│  • call_reports  │  │ • gemini-2.0-    │  │  • Upload/download   │
│  • abc_call_     │  │   flash (audio)  │  │    audio & video     │
│    reports       │  │ • gemini-2.5-    │  │  • Mirror/sync       │
│  • outbound_     │  │   flash (video)  │  │    folders           │
│    call_reports  │  │                  │  │                      │
│  • video_reports │  │                  │  │                      │
│  • users         │  │                  │  │                      │
└─────────────────┘  └──────────────────┘  └──────────────────────┘
```

---

## Technology Stack

### Backend

| Technology | Purpose |
|---|---|
| **Python 3.x** | Core programming language |
| **FastAPI** | Web framework for REST API |
| **Uvicorn** | ASGI server for running FastAPI |
| **Google Generative AI (Gemini)** | AI-powered audio & video analysis |
| **MongoDB (PyMongo)** | NoSQL database for storing reports & users |
| **python-jose** | JWT token creation & verification |
| **passlib + bcrypt** | Password hashing for authentication |
| **Pandas** | Data manipulation for CSV export & analytics |
| **soundfile + lameenc** | Audio format conversion (WAV → MP3) |
| **gdown** | Google Drive file downloading |
| **python-dotenv** | Environment variable management |
| **python-multipart** | Multipart form data handling (file uploads) |
| **NumPy** | Numerical operations |
| **requests** | HTTP requests for external API calls |

### Frontend

| Technology | Purpose |
|---|---|
| **React 19** | UI component library |
| **Vite 7** | Build tool & dev server |
| **Tailwind CSS 4** | Utility-first CSS framework |
| **React Router DOM 7** | Client-side routing |
| **Lucide React** | Icon library |
| **ESLint** | Code linting |

---

## Project Structure

```
beyondai/
├── .gitignore
├── README.md
│
├── Backend/
│   ├── .gitignore
│   ├── requirements.txt                 # Python dependencies
│   ├── routing.txt                      # API route mapping reference
│   ├── uploaded_call_reports.json       # Seed/backup data
│   ├── GMB_Calls_Analysis.ipynb         # Jupyter notebook (prototyping)
│   │
│   ├── main.py                          # FastAPI app & all route definitions
│   ├── gemini_service.py                # Google Gemini API wrapper
│   │
│   ├── audio_processor.py              # Generic audio processing pipeline
│   ├── GmbCall_processor.py            # GMB inbound call processor
│   ├── abc_processor.py                # ABC outbound call processor
│   ├── outbound_processor.py           # Store Walk-in outbound call processor
│   │
│   ├── GmbCall_service.py              # GMB CRUD & analytics service
│   ├── abc_service.py                  # ABC CRUD & analytics service
│   ├── outbound_call_service.py        # Store Walk-in CRUD & analytics service
│   │
│   ├── video_analysis_service.py       # Video analysis pipeline
│   ├── video_chatbot_service.py        # AI chatbot for video Q&A
│   ├── video_upload_service.py         # Video upload to Google Drive
│   │
│   ├── auth_service.py                 # JWT authentication service
│   ├── create_admins.py                # Admin user seeding script
│   │
│   ├── drive_downloader.py             # Google Drive file downloader
│   ├── drive_mirror_integration.py     # Drive folder sync/mirror
│   ├── drive_upload_service.py         # Drive file upload service
│   │
│   ├── flatten_csv.py                  # Nested JSON → flat CSV converter
│   ├── analysis_utils.py              # Safe type conversion helpers
│   ├── add_date.py                     # DB migration: add date fields
│   ├── preprocess_videos.py            # Video preprocessing utility
│   └── wav_to_mp3_manual.py            # Batch WAV → MP3 converter
│
└── Frontend/
    ├── .env                             # Environment variables (API URL)
    ├── .gitignore
    ├── package.json                     # NPM dependencies & scripts
    ├── package-lock.json
    ├── vite.config.js                   # Vite build configuration
    ├── eslint.config.js                 # ESLint configuration
    ├── index.html                       # HTML entry point
    │
    ├── public/
    │   ├── logo.jpg                     # Duroflex logo (favicon)
    │   └── vite.svg                     # Vite default asset
    │
    └── src/
        ├── main.jsx                     # React bootstrap (BrowserRouter)
        ├── App.jsx                      # Root component with route definitions
        ├── App.css                      # Minimal global styles
        ├── index.css                    # Tailwind CSS import
        │
        ├── assets/
        │   └── react.svg                # React logo asset
        │
        ├── utils/
        │   └── transform.js             # API response data transformers
        │
        └── components/
            ├── Login.jsx                        # Authentication page
            ├── Dashboard.jsx                    # Main navigation hub
            ├── FloatingChatButton.jsx           # Chatbot toggle button
            ├── VideoChatbot.jsx                 # AI chatbot interface
            │
            ├── GmbReportList.jsx                # GMB reports table
            ├── GmbReportDetail.jsx              # GMB single report view
            ├── GmbAggregatedDashboard.jsx       # GMB analytics dashboard
            ├── AudioCallUpload.jsx              # GMB audio file upload
            │
            ├── AbcReportsList.jsx               # ABC reports table
            ├── AbcReportDetail.jsx              # ABC single report view
            ├── AbcAggregatedDashboard.jsx       # ABC analytics dashboard
            ├── AbcCallUpload.jsx                # ABC audio file upload
            │
            ├── StoreWalkinCallsList.jsx         # Store Walk-in reports table
            ├── StoreWalkinReportDetail.jsx       # Store Walk-in single report view
            ├── StoreWalkinAggregatedDashboard.jsx # Store Walk-in analytics
            ├── OutboundCallUpload.jsx           # Store Walk-in audio upload
            │
            ├── VideoCallsList.jsx               # Video reports table
            ├── VideoCallDetail.jsx              # Video single report view
            ├── VideoAggregatedDashboard.jsx     # Video analytics dashboard
            └── VideoCallUpload.jsx              # Video file upload
```

---

## Backend — Detailed File Breakdown

### `main.py` — Application Entry Point

The central FastAPI application file that:

- **Creates the FastAPI app** with CORS middleware (allows all origins for development).
- **Connects to MongoDB** using `MONGODB_URI` from environment variables.
- **Database**: `duroflex_call_analysis` with collections: `call_reports`, `outbound_call_reports`, `abc_call_reports`, `video_reports`, `users`.
- **Defines all REST API endpoints** (see [API Reference](#api-reference)).
- **Orchestrates** file upload handling — receives `UploadFile` objects, delegates to the appropriate processor, and returns structured responses.
- **Handles analytics queries** by delegating to service modules with optional date range filters (`start_date`, `end_date` query parameters).

---

### `gemini_service.py` — AI Analysis Engine

The core AI integration wrapper providing:

- **`analyze_audio_call(audio_path, prompt)`**: Uploads an audio file to the Gemini API, sends it with a structured analysis prompt, and returns the AI-generated analysis text. Uses the **`gemini-2.0-flash`** model. Implements retry logic (up to 3 retries with exponential backoff) and automatic cleanup of uploaded files.
- **`analyze_video_call(video_path, prompt)`**: Same workflow for video files, using the **`gemini-2.5-flash`** model with extended timeouts for video processing.
- **`chat_about_videos(message, reports_context)`**: Sends a user query along with video report context to Gemini, returning a conversational AI response.
- **Configuration**: Uses `GEMINI_API_KEY` environment variable.

---

### Audio Processors

These files handle the full pipeline: receive audio → save to temp → convert format → send to Gemini → parse response → store in MongoDB.

#### `audio_processor.py` — Generic Audio Processor (GMB)

- **`process_audio_file(file, collection)`**: Main pipeline function for GMB inbound calls.
- **`build_analysis_prompt()`**: Constructs the Gemini prompt requesting structured JSON output with: `customer_name`, `customer_mobile`, `call_duration`, `purpose_of_call`, `product_discussed`, `pain_points`, `sentiment`, `sales_skills_assessment`, `call_quality`, `overall_score`, `key_insights`, `recommendations`, `full_transcript`.
- **`parse_gemini_response(response_text)`**: Extracts JSON from Gemini's response (handles markdown code block wrapping).
- **`convert_to_mp3(input_path)`**: Converts WAV/other formats to MP3 using `soundfile` (read) + `lameenc` (encode).

#### `GmbCall_processor.py` — GMB Call Processor

- **`process_gmb_call(file, collection)`**: Dedicated GMB processor with enhanced prompt engineering.
- **`get_gmb_analysis_prompt()`**: Returns a detailed prompt evaluating: customer interaction quality, sales technique, product knowledge, pain point identification, follow-up scheduling, and overall call effectiveness.
- Writes to the **`call_reports`** MongoDB collection.

#### `abc_processor.py` — ABC Outbound Call Processor

- **`process_abc_call(file, collection)`**: Processes ABC outbound call audio.
- **`get_abc_analysis_prompt()`**: Prompt tailored for outbound sales calls — focuses on outbound sales effectiveness, customer engagement, follow-up actions, and persuasion techniques.
- Writes to the **`abc_call_reports`** MongoDB collection.

#### `outbound_processor.py` — Store Walk-in Outbound Call Processor

- **`process_outbound_call(file, collection)`**: Processes Store Walk-in follow-up call audio.
- **`get_outbound_analysis_prompt()`**: Prompt focused on post-visit follow-up quality, customer satisfaction, upselling success, and appointment booking.
- Writes to the **`outbound_call_reports`** MongoDB collection.

---

### Service Layers (CRUD & Analytics)

Each call module has a corresponding service file that provides data access and analytics computation.

#### `GmbCall_service.py` — GMB Service

- **`get_all_reports(collection, start_date, end_date)`**: Retrieves all GMB reports, optionally filtered by date range, sorted by `created_at` descending.
- **`get_report_by_id(collection, call_id)`**: Retrieves a single report by MongoDB `_id`.
- **`get_analytics(collection, start_date, end_date)`**: Computes aggregated analytics:
  - Total calls, average score, average duration
  - Sentiment distribution (positive / negative / neutral)
  - Score distribution histogram (bucketed)
  - Top pain points by frequency
  - Top products discussed
  - Daily/weekly trends
  - Average sales skills scores
  - Call quality averages

#### `abc_service.py` — ABC Service

Same structure as `GmbCall_service.py`, operating on the `abc_call_reports` collection.

#### `outbound_call_service.py` — Store Walk-in Service

Same structure, operating on the `outbound_call_reports` collection.

---

### Video Analysis Pipeline

#### `video_analysis_service.py` — Video Processor

- **`process_video(file, collection)`**: Full pipeline — save video, send to Gemini (`gemini-2.5-flash`), parse structured response, store in MongoDB.
- **`get_video_analysis_prompt()`**: Comprehensive prompt instructing Gemini to evaluate:
  - Customer interaction quality (greeting, engagement, body language)
  - Product demonstration quality
  - Sales staff skills and techniques
  - Store environment and cleanliness
  - Overall customer experience
  - Returns structured JSON with scores, observations, and recommendations.
- Writes to the **`video_reports`** MongoDB collection.

#### `video_chatbot_service.py` — AI Chatbot

- **`chat_about_videos(message, reports)`**: Takes a user question and contextual video reports data, sends to Gemini, and returns a conversational answer.
- **`build_chat_prompt(message, reports_context)`**: Builds a prompt that includes all video report data as context so the AI can answer specific questions about store performance, trends, and insights.

#### `video_upload_service.py` — Video Upload to Drive

- **`upload_video_to_drive(file, folder_id)`**: Uploads video files to a Google Drive folder.
- **`process_and_upload_video(file, collection)`**: Orchestrates upload-to-Drive + Gemini analysis + MongoDB storage.

---

### Authentication

#### `auth_service.py` — JWT Auth Service

- **`authenticate_user(email, password, users_collection)`**: Validates credentials against MongoDB `users` collection using bcrypt password verification.
- **`create_access_token(data, expires_delta)`**: Generates a JWT token (24-hour expiry) containing user email and role.
- **`verify_token(token)`**: Decodes and validates JWT tokens.
- **`get_current_user(token)`**: Extracts authenticated user info from a token.
- **Security**: Uses `python-jose` for JWT operations, `passlib`/`bcrypt` for password hashing.

#### `create_admins.py` — Admin Seeding Script

- **`create_admin(email, password, name, role="admin")`**: Creates admin user accounts with bcrypt-hashed passwords in the `users` MongoDB collection.
- **`main()`**: Script entry point to seed predefined admin users. Run once during initial setup.

---

### Google Drive Integration

#### `drive_downloader.py` — Drive Downloader

- **`download_from_drive(file_id, output_path)`**: Downloads a single file by Google Drive file ID using `gdown`.
- **`download_folder_from_drive(folder_id, output_dir)`**: Downloads an entire Drive folder.

#### `drive_mirror_integration.py` — Drive Sync/Mirror

- **`sync_drive_folder(folder_id, local_dir, collection)`**: Syncs a Google Drive folder to a local directory — downloads new files, processes them through the analysis pipeline, stores reports in MongoDB.
- **`check_for_new_files(folder_id, processed_files)`**: Detects unprocessed files in a Drive folder.
- **`process_new_files(files, local_dir, collection)`**: Downloads and processes new files.
- **Use case**: Automated batch processing of calls uploaded to a shared Google Drive folder.

#### `drive_upload_service.py` — Drive Uploader

- **`upload_to_drive(file_path, folder_id, mime_type)`**: Uploads a file to Google Drive.
- **`upload_report_csv(reports, folder_id)`**: Generates a CSV from reports and uploads it.
- **`create_drive_folder(folder_name, parent_id)`**: Creates a new folder on Drive.

---

### Utility Scripts

#### `analysis_utils.py` — Helper Functions

- **`safe_float(value, default=0.0)`**: Safely converts values to float.
- **`safe_int(value, default=0)`**: Safely converts values to int.
- **`extract_score(text)`**: Extracts numeric scores from text using regex.

#### `flatten_csv.py` — CSV Export Utility

- **`flatten_report(report)`**: Flattens a nested report dict into a single-level dict.
- **`reports_to_csv(reports, output_path)`**: Converts reports to CSV using `pandas`.
- **`flatten_nested_dict(d, parent_key, sep)`**: Recursive dict flattener.

#### `preprocess_videos.py` — Video Preprocessing

- **`preprocess_video(input_path, output_path)`**: Resizes, converts, and compresses video for Gemini analysis.
- **`extract_key_frames(video_path, interval)`**: Extracts key frames at intervals.
- **`compress_video(input_path, output_path, target_size_mb)`**: Compresses video to target size.

#### `add_date.py` — Database Migration

- **`add_dates_to_collection(collection)`**: Adds `created_at` timestamps to MongoDB documents missing them.

#### `wav_to_mp3_manual.py` — Batch Audio Converter

- **`convert_wav_to_mp3(input_dir, output_dir)`**: Scans a directory for `.wav` files and converts each to `.mp3`.
- **`convert_single_file(wav_path, mp3_path)`**: Converts a single WAV → MP3 file.
- **Dependencies**: `soundfile`, `lameenc`.

#### `GMB_Calls_Analysis.ipynb` — Jupyter Notebook

A Jupyter notebook used for exploratory data analysis and prototyping the GMB call analysis pipeline before productionizing it into the Python modules.

#### `uploaded_call_reports.json` — Seed/Backup Data

A JSON file containing previously processed call report data, usable for reference, testing, or database seeding.

---

## Frontend — Detailed File Breakdown

### Configuration & Entry Files

#### `vite.config.js`

Configures Vite with the `@vitejs/plugin-react` and `@tailwindcss/vite` plugins.

#### `index.html`

HTML shell — sets page title to **"Duroflex Call Analysis"**, links the Duroflex logo as favicon, and loads `src/main.jsx` as the entry module.

#### `.env`

```
VITE_API_BASE_URL=http://localhost:8000
```

Sets the backend API base URL. All `fetch` calls in the frontend use this as the base.

#### `src/main.jsx`

React bootstrap — wraps `<App />` in `<BrowserRouter>` from `react-router-dom` and renders into the `#root` DOM element.

#### `src/index.css`

Imports Tailwind CSS v4 via `@import "tailwindcss"`.

#### `src/App.css`

Minimal global styles — sets `#root` to full width.

---

### Routing & Navigation

#### `src/App.jsx`

Defines the two application routes:

| Path | Component | Description |
|---|---|---|
| `/` | `<Login />` | Authentication page |
| `/dashboard` | `<Dashboard />` | Main application (all modules) |

The `Dashboard` component handles all sub-navigation internally via tab state — there are no URL-level sub-routes.

---

### Component Modules

#### `Login.jsx` — Authentication

- **State**: `email`, `password`, `error`, `isLoading`
- **API**: `POST /auth/login` with `{email, password}`
- **Behavior**: On success, stores `token` and `userRole` in `localStorage`, navigates to `/dashboard`. On failure, displays inline error message.
- **UI**: Full-screen dark gradient background with the Duroflex logo, email/password inputs, and a submit button.

#### `Dashboard.jsx` — Main Navigation Hub

- **State**: `activeTab` (selected section), `sidebarOpen` (mobile toggle), `userRole` (from localStorage)
- **Sidebar navigation tabs**:
  - **GMB Inbound**: Reports list + Analytics dashboard
  - **ABC Outbound**: Reports list + Analytics dashboard
  - **Store Walk-in Outbound**: Reports list + Analytics dashboard
  - **Popins Inbound (Video)**: Reports list + Analytics dashboard
  - **Upload sections** (admin only): GMB Upload, ABC Upload, Walk-in Upload, Video Upload
- **Role-based access**: Upload tabs are only visible to users with the `admin` role.
- **Logout**: Clears `localStorage` and navigates back to `/`.
- **UI**: Dark sidebar with gradient and `lucide-react` icons, main content area renders the active component.

#### `FloatingChatButton.jsx` — Chatbot Toggle

- **State**: `isOpen` (toggle)
- **Behavior**: Renders a floating action button in the bottom-right corner. Clicking toggles the `<VideoChatbot />` component.

#### `VideoChatbot.jsx` — AI Chatbot

- **State**: `messages` (chat history), `input`, `isLoading`, `reports` (video report context)
- **API calls**:
  - `GET /popins-inbound` — fetches all video reports for context on mount.
  - `POST /video/chat` — sends `{message, reports}` for AI-powered Q&A.
- **Behavior**: Loads video reports on mount. User types a question, it's sent to the backend chatbot endpoint along with report data, and the AI response is displayed in a chat bubble.

---

### GMB Inbound Module

#### `GmbReportList.jsx` — Reports Table

- **State**: `reports`, `loading`, `searchTerm`, `selectedFilter`, `selectedSentiment`, `currentPage`, `selectedReport`, `sortConfig`
- **API**: `GET /Gmb_Inbound`
- **Features**: Search by keyword, filter by call type, filter by sentiment, sort by date/score/duration, paginated (10 per page). Clicking a row opens `GmbReportDetail`.

#### `GmbReportDetail.jsx` — Single Report View

- **Props**: `report` (raw), `onBack` (callback)
- **Uses**: `transformCallReport()` from `utils/transform.js`
- **Sections**: Score badge, sentiment indicator, call metadata, purpose, products discussed, pain points, sales skills assessment (with visual indicators), call quality metrics, key insights, recommendations, full transcript (collapsible).

#### `GmbAggregatedDashboard.jsx` — Analytics Dashboard

- **State**: `analytics`, `loading`, `error`, `dateRange`
- **API**: `GET /Gmb_Inbound/analytics` (with optional date range)
- **Metrics**: Total calls, average score, average duration, sentiment distribution, score distribution histogram, top pain points, top products, daily/weekly trends, sales skills averages, call quality averages.
- **UI**: Grid of stat cards, CSS-based bar charts, color-coded indicators.

#### `AudioCallUpload.jsx` — Audio Upload (GMB)

- **State**: `files`, `uploading`, `uploadProgress`, `uploadResults`, `dragActive`
- **API**: `POST /Gmb_Inbound/upload` (multipart/form-data)
- **Supported formats**: `.mp3`, `.wav`, `.m4a`, `.ogg`
- **Features**: Drag-and-drop or file picker, per-file upload progress, success/error status per file.

---

### ABC Outbound Module

#### `AbcReportsList.jsx` — Reports Table

- **API**: `GET /abc-outbound-calls`
- **Pattern**: Same as `GmbReportList.jsx` — search, filter, sort, paginate, click to view detail.

#### `AbcReportDetail.jsx` — Single Report View

- **Uses**: `transformCallReport()`
- **Pattern**: Same structure as `GmbReportDetail.jsx`.

#### `AbcAggregatedDashboard.jsx` — Analytics Dashboard

- **API**: `GET /abc-outbound-calls/analytics`
- **Pattern**: Same structure as `GmbAggregatedDashboard.jsx`.

#### `AbcCallUpload.jsx` — Audio Upload (ABC)

- **API**: `POST /abc-outbound-calls/upload`
- **Pattern**: Same as `AudioCallUpload.jsx`.

---

### Store Walk-in Outbound Module

#### `StoreWalkinCallsList.jsx` — Reports Table

- **API**: `GET /storewalkin-outbound-calls`
- **Pattern**: Same list pattern.

#### `StoreWalkinReportDetail.jsx` — Single Report View

- **Uses**: `transformCallReport()`
- **Pattern**: Same detail pattern.

#### `StoreWalkinAggregatedDashboard.jsx` — Analytics Dashboard

- **API**: `GET /storewalkin-outbound-calls/analytics`
- **Pattern**: Same analytics pattern.

#### `OutboundCallUpload.jsx` — Audio Upload (Walk-in)

- **API**: `POST /storewalkin-outbound-calls/upload`
- **Pattern**: Same upload pattern.

---

### Video / Popins Inbound Module

#### `VideoCallsList.jsx` — Reports Table

- **API**: `GET /popins-inbound`
- **Pattern**: Same list pattern with video-specific filters.

#### `VideoCallDetail.jsx` — Single Report View

- **Uses**: `transformVideoReport()` from `utils/transform.js`
- **Sections**: Video metadata (URL, duration), customer interaction analysis, product demonstration quality, sales/staff assessment, store environment analysis, key findings, recommendations, overall score and rating.

#### `VideoAggregatedDashboard.jsx` — Analytics Dashboard

- **API**: `GET /popins-inbound/analytics`
- **Metrics**: Video-specific analytics — interaction scores, demonstration quality, environment scores, trends over time.

#### `VideoCallUpload.jsx` — Video Upload

- **API**: `POST /popins-inbound/upload`
- **Supported formats**: `.mp4`, `.mov`, `.avi`, `.mkv`
- **Pattern**: Same drag-and-drop upload pattern.

---

### Utility Functions

#### `src/utils/transform.js`

Transforms raw backend API responses into normalized formats consumed by report-detail components:

- **`transformCallReport(raw)`**: Normalizes audio call reports — maps fields like `customer_name`, `customer_mobile`, `call_duration`, `purpose_of_call`, `product_discussed`, `pain_points`, `sentiment`, `sales_skills_assessment`, `call_quality`, `overall_score`, `key_insights`, `recommendations`, `full_transcript`. Handles both flat and nested response shapes.
- **`transformVideoReport(raw)`**: Normalizes video reports — maps video metadata, customer interaction metrics, product demonstration quality, sales assessment, and environment analysis fields.

---

## API Reference

### Authentication

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/auth/login` | Login with email/password, returns JWT | No |

### GMB Inbound Calls (`/Gmb_Inbound`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/Gmb_Inbound` | List all GMB call reports (supports `start_date`, `end_date`) | Yes |
| `POST` | `/Gmb_Inbound/upload` | Upload & analyze GMB audio files | Yes (admin) |
| `GET` | `/Gmb_Inbound/{call_id}` | Get a single GMB report | Yes |
| `GET` | `/Gmb_Inbound/analytics` | Aggregated analytics for GMB calls | Yes |

### ABC Outbound Calls (`/abc-outbound-calls`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/abc-outbound-calls` | List all ABC reports | Yes |
| `POST` | `/abc-outbound-calls/upload` | Upload & analyze ABC audio files | Yes (admin) |
| `GET` | `/abc-outbound-calls/{call_id}` | Get a single ABC report | Yes |
| `GET` | `/abc-outbound-calls/analytics` | Aggregated analytics for ABC calls | Yes |

### Store Walk-in Outbound Calls (`/storewalkin-outbound-calls`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/storewalkin-outbound-calls` | List all Store Walk-in reports | Yes |
| `POST` | `/storewalkin-outbound-calls/upload` | Upload & analyze audio files | Yes (admin) |
| `GET` | `/storewalkin-outbound-calls/{call_id}` | Get a single report | Yes |
| `GET` | `/storewalkin-outbound-calls/analytics` | Aggregated analytics | Yes |

### Video / Popins Inbound (`/popins-inbound`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/popins-inbound` | List all video reports | Yes |
| `POST` | `/popins-inbound/upload` | Upload & analyze video files | Yes (admin) |
| `GET` | `/popins-inbound/{report_id}` | Get a single video report | Yes |
| `GET` | `/popins-inbound/analytics` | Aggregated analytics for videos | Yes |

### Video Chatbot

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/video/chat` | AI-powered Q&A about video reports | Yes |

---

## Database Schema

**Database**: `duroflex_call_analysis` (MongoDB)

### `users` Collection

```json
{
  "_id": "ObjectId",
  "email": "admin@duroflex.com",
  "password": "$2b$12$...",           // bcrypt hash
  "name": "Admin User",
  "role": "admin"                     // "admin" or "viewer"
}
```

### `call_reports` Collection (GMB Inbound)

```json
{
  "_id": "ObjectId",
  "created_at": "2025-01-15T10:30:00Z",
  "file_name": "call_recording_001.mp3",
  "customer_name": "John Doe",
  "customer_mobile": "+91XXXXXXXXXX",
  "call_duration": "5:32",
  "purpose_of_call": "Product inquiry about mattresses",
  "product_discussed": "Duroflex Duropedic",
  "pain_points": ["Back pain", "Sleep quality"],
  "sentiment": "positive",
  "sales_skills_assessment": {
    "greeting": 8,
    "product_knowledge": 9,
    "objection_handling": 7,
    "closing_skills": 6,
    "overall": 7.5
  },
  "call_quality": {
    "clarity": 8,
    "professionalism": 9,
    "empathy": 7
  },
  "overall_score": 78,
  "key_insights": ["Customer interested in premium range", "..."],
  "recommendations": ["Follow up within 48 hours", "..."],
  "full_transcript": "Agent: Hello, thank you for calling..."
}
```

### `abc_call_reports` Collection (ABC Outbound)

Same schema as `call_reports` with fields tailored for outbound sales calls.

### `outbound_call_reports` Collection (Store Walk-in)

Same schema as `call_reports` with fields tailored for post-visit follow-ups.

### `video_reports` Collection (Popins Video)

```json
{
  "_id": "ObjectId",
  "created_at": "2025-01-15T10:30:00Z",
  "file_name": "store_video_001.mp4",
  "video_url": "https://drive.google.com/...",
  "video_duration": "12:45",
  "customer_interaction": {
    "greeting_quality": 8,
    "engagement_level": 7,
    "body_language": 6,
    "overall": 7
  },
  "product_demonstration": {
    "quality": 8,
    "completeness": 7,
    "enthusiasm": 6
  },
  "sales_assessment": {
    "technique": 7,
    "closing": 6,
    "upselling": 5
  },
  "environment_analysis": {
    "cleanliness": 9,
    "organization": 8,
    "ambiance": 7
  },
  "overall_score": 72,
  "key_findings": ["Staff showed good product knowledge", "..."],
  "recommendations": ["Improve closing techniques", "..."]
}
```

---

## Data Flow

### Audio Call Analysis Flow

```
1. User uploads audio file(s) via Upload component
       │
       ▼
2. Frontend sends POST /[module]/upload (multipart/form-data)
       │
       ▼
3. main.py receives UploadFile, delegates to processor
       │
       ▼
4. Processor saves file to temp directory
       │
       ▼
5. Converts to MP3 if needed (soundfile + lameenc)
       │
       ▼
6. Sends audio + structured prompt to Gemini API
       │  (gemini-2.0-flash model)
       ▼
7. Gemini returns JSON analysis
       │
       ▼
8. Processor parses JSON response
       │
       ▼
9. Report stored in MongoDB collection
       │
       ▼
10. Response returned to frontend
       │
       ▼
11. Report appears in the reports list
```

### Video Analysis Flow

```
1. User uploads video file via VideoCallUpload
       │
       ▼
2. Frontend sends POST /popins-inbound/upload
       │
       ▼
3. main.py delegates to video_analysis_service
       │
       ▼
4. Video saved to temp, optionally uploaded to Google Drive
       │
       ▼
5. Video sent to Gemini API (gemini-2.5-flash model)
       │
       ▼
6. Gemini analyzes customer interaction, demonstration,
   environment, and returns structured JSON
       │
       ▼
7. Report stored in video_reports MongoDB collection
       │
       ▼
8. Report appears in VideoCallsList
```

### Authentication Flow

```
1. User enters email/password on Login page
       │
       ▼
2. Frontend sends POST /auth/login
       │
       ▼
3. auth_service validates credentials against MongoDB users collection
       │
       ▼
4. On success: JWT token created (24hr expiry) with user role
       │
       ▼
5. Token + role stored in localStorage
       │
       ▼
6. All subsequent API calls include Authorization: Bearer <token>
       │
       ▼
7. Role determines UI access (admin = uploads visible)
```

### Chatbot Flow

```
1. User opens chatbot via FloatingChatButton
       │
       ▼
2. VideoChatbot fetches all video reports (GET /popins-inbound)
       │
       ▼
3. User types a question
       │
       ▼
4. Frontend sends POST /video/chat with {message, reports}
       │
       ▼
5. video_chatbot_service builds prompt with reports context
       │
       ▼
6. Gemini generates contextual answer
       │
       ▼
7. Response displayed as chat message
```

---

## Environment Variables

### Backend

| Variable | Description | Required |
|---|---|---|
| `MONGODB_URI` | MongoDB connection string | Yes |
| `GEMINI_API_KEY` | Google Generative AI API key | Yes |
| `JWT_SECRET_KEY` | Secret key for JWT token signing | Yes |
| `GOOGLE_DRIVE_FOLDER_ID` | Google Drive folder ID (for uploads) | Optional |

### Frontend

| Variable | Description | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:8000` |

---

## Setup & Installation

### Prerequisites

- **Python 3.9+**
- **Node.js 18+** and **npm**
- **MongoDB** instance (local or cloud — e.g., MongoDB Atlas)
- **Google Gemini API Key** (from [Google AI Studio](https://aistudio.google.com/))

### Backend Setup

```bash
# Navigate to the backend directory
cd Backend

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create a .env file with your configuration
# MONGODB_URI=mongodb+srv://your-connection-string
# GEMINI_API_KEY=your-gemini-api-key
# JWT_SECRET_KEY=your-secret-key

# Seed admin users (run once)
python create_admins.py
```

### Frontend Setup

```bash
# Navigate to the frontend directory
cd Frontend

# Install dependencies
npm install

# Configure the .env file
# VITE_API_BASE_URL=http://localhost:8000
```

---

## Running the Application

### Start the Backend

```bash
cd Backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`. FastAPI auto-generates interactive API docs at:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

### Start the Frontend

```bash
cd Frontend
npm run dev
```

The frontend dev server will start at `http://localhost:5173` (default Vite port).

### Build for Production

```bash
cd Frontend
npm run build
npm run preview
```

---

<div align="center">

**Built with ❤️ for Duroflex — Powered by Google Gemini AI**

</div>
