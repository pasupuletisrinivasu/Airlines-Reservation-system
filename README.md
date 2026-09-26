# SkyWings Airlines Reservation System ✈️

A full-stack, production-grade Airlines Reservation Web Application built with **Python (Flask)**, **SQLite3**, and a modern **Vanilla CSS & JavaScript** frontend.

---

## ✨ Features

- **Flight Search & Filtering**:
  - One-Way and Round-Trip flight search across domestic and international airports (JFK, LHR, DXB, SIN, DEL, BOM, SFO, CDG, etc.).
  - Real-time client & server filtering: Price range slider, non-stop vs 1-stop filters, airline carriers, and sorting (price, duration, departure time).
  - Live seat availability indicators with badge highlights for low-seat warnings.

- **Interactive Aircraft Cabin Seat Selector**:
  - Visual aircraft cabin layout with Cockpit, Wings, Aisle, and Window seats.
  - Divided by cabin classes: First Class, Business Class, and Economy Class.
  - Real-time seat occupancy check preventing double bookings.

- **Passenger Booking & Instant Checkout**:
  - Passenger information collection with contact details and optional passport/ID.
  - Transparent fare breakdown: Base fare, airport taxes & security fee, and cabin surcharge.
  - Unique 6-character PNR code generation (e.g., `SW48K2`).

- **E-Ticket & Boarding Pass Generator**:
  - Authentic airline boarding pass aesthetic complete with a tear-off stub, barcode, QR code, gate, terminal, and boarding group.
  - Print & PDF download-friendly layout with `@media print` rules.

- **Reservation Management (PNR Lookup & Cancel)**:
  - Instant ticket retrieval using PNR code.
  - Booking cancellation with immediate seat release in SQLite.

- **Operations & Admin Portal**:
  - KPI Dashboard: Active Flights, Confirmed Bookings, Total Revenue, Occupied Seats.
  - Schedule new flights with custom departure, arrival, duration, aircraft model, and tier fares.
  - View real-time list of all bookings and remove obsolete flights.

---

## 🚀 Quick Start Guide

### 1. Requirements
- Python 3.10+ (Tested on Python 3.14)
- Flask (`pip install -r requirements.txt`)

### 2. Run the Application
```bash
python app.py
```
Open your browser and navigate to:
```
http://127.0.0.1:5000
```

---

## 🗄️ Database Architecture (SQLite)

- `airports`: Airport codes (IATA), names, cities, and countries.
- `flights`: Flight numbers, airlines, routes, departure/arrival schedules, durations, aircraft models, and pricing for Economy, Business, and First class.
- `bookings`: Passenger details, PNR references, flight associations, seat numbers, fare paid, timestamps, and status (`CONFIRMED` / `CANCELLED`).
- `occupied_seats`: Real-time tracking of reserved seats per flight and travel date.

---

## 🌐 API Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/airports` | List all available airports |
| `GET` | `/api/flights/search` | Search flights with filters (price, stops, airline, sort) |
| `GET` | `/api/flights/<id>/seats` | Get seat map and occupied seats for a flight date |
| `POST` | `/api/bookings` | Reserve seat and create confirmed booking with PNR |
| `GET` | `/api/bookings/<pnr>` | Retrieve full booking and boarding pass details |
| `POST` | `/api/bookings/<pnr>/cancel` | Cancel reservation and release occupied seat |
| `GET` | `/api/admin/stats` | Operational stats (revenue, bookings, occupancy) |
| `GET/POST`| `/api/admin/flights` | List or add new flight schedules |
| `DELETE` | `/api/admin/flights/<id>` | Delete a flight schedule |
