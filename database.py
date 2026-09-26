"""
database.py - Database setup and seed data for Airlines Reservation System
Uses SQLite3 with automatic schema creation and realistic international/domestic flights.
"""

import sqlite3
import os
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), 'airline.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # 1. Airports Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS airports (
        code TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        city TEXT NOT NULL,
        country TEXT NOT NULL
    );
    """)

    # 2. Flights Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS flights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        flight_number TEXT UNIQUE NOT NULL,
        airline TEXT NOT NULL,
        origin_code TEXT NOT NULL,
        dest_code TEXT NOT NULL,
        departure_time TEXT NOT NULL, -- e.g. "08:30"
        arrival_time TEXT NOT NULL,   -- e.g. "11:45"
        duration_mins INTEGER NOT NULL,
        stops INTEGER DEFAULT 0,
        aircraft TEXT NOT NULL,
        economy_price REAL NOT NULL,
        business_price REAL NOT NULL,
        first_price REAL NOT NULL,
        total_seats INTEGER DEFAULT 60,
        days_active TEXT DEFAULT '1,2,3,4,5,6,7', -- Mon=1, Sun=7
        FOREIGN KEY (origin_code) REFERENCES airports (code),
        FOREIGN KEY (dest_code) REFERENCES airports (code)
    );
    """)

    # 3. Bookings Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pnr TEXT UNIQUE NOT NULL,
        flight_id INTEGER NOT NULL,
        travel_date TEXT NOT NULL, -- YYYY-MM-DD
        return_flight_id INTEGER,
        return_travel_date TEXT,
        passenger_name TEXT NOT NULL,
        passenger_email TEXT NOT NULL,
        passenger_phone TEXT NOT NULL,
        passport_num TEXT,
        cabin_class TEXT NOT NULL, -- Economy, Business, First
        seat_number TEXT NOT NULL,
        return_seat_number TEXT,
        fare_amount REAL NOT NULL,
        status TEXT DEFAULT 'CONFIRMED', -- CONFIRMED, CANCELLED
        created_at TEXT NOT NULL,
        FOREIGN KEY (flight_id) REFERENCES flights (id),
        FOREIGN KEY (return_flight_id) REFERENCES flights (id)
    );
    """)

    # 4. Occupied Seats Table (Track booked seats per flight & date)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS occupied_seats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        flight_id INTEGER NOT NULL,
        travel_date TEXT NOT NULL,
        seat_number TEXT NOT NULL,
        booking_id INTEGER NOT NULL,
        FOREIGN KEY (flight_id) REFERENCES flights (id),
        FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
        UNIQUE(flight_id, travel_date, seat_number)
    );
    """)

    conn.commit()
    seed_data(conn)
    conn.close()

def seed_data(conn):
    cursor = conn.cursor()

    # Check if airports already seeded
    cursor.execute("SELECT COUNT(*) FROM airports")
    if cursor.fetchone()[0] == 0:
        airports = [
            ('JFK', 'John F. Kennedy International Airport', 'New York', 'United States'),
            ('LHR', 'London Heathrow Airport', 'London', 'United Kingdom'),
            ('DXB', 'Dubai International Airport', 'Dubai', 'United Arab Emirates'),
            ('SIN', 'Singapore Changi Airport', 'Singapore', 'Singapore'),
            ('DEL', 'Indira Gandhi International Airport', 'New Delhi', 'India'),
            ('BOM', 'Chhatrapati Shivaji Maharaj International', 'Mumbai', 'India'),
            ('SFO', 'San Francisco International Airport', 'San Francisco', 'United States'),
            ('CDG', 'Charles de Gaulle Airport', 'Paris', 'France'),
            ('HND', 'Tokyo Haneda Airport', 'Tokyo', 'Japan'),
            ('SYD', 'Sydney Kingsford Smith Airport', 'Sydney', 'Australia'),
            ('FRA', 'Frankfurt Airport', 'Frankfurt', 'Germany'),
            ('ORD', "O'Hare International Airport", 'Chicago', 'United States')
        ]
        cursor.executemany("INSERT INTO airports (code, name, city, country) VALUES (?, ?, ?, ?)", airports)

    # Check if flights already seeded
    cursor.execute("SELECT COUNT(*) FROM flights")
    if cursor.fetchone()[0] == 0:
        flights = [
            # JFK <-> LHR
            ('SW-101', 'SkyWings Airways', 'JFK', 'LHR', '08:00', '20:10', 430, 0, 'Boeing 787-9', 580.0, 1420.0, 2600.0, 60),
            ('BA-178', 'British Airways', 'JFK', 'LHR', '18:30', '06:45', 435, 0, 'Airbus A350-1000', 620.0, 1550.0, 2800.0, 60),
            ('SW-102', 'SkyWings Airways', 'LHR', 'JFK', '11:15', '14:25', 490, 0, 'Boeing 787-9', 590.0, 1450.0, 2650.0, 60),
            ('BA-179', 'British Airways', 'LHR', 'JFK', '16:00', '19:15', 495, 0, 'Airbus A350-1000', 640.0, 1580.0, 2850.0, 60),

            # JFK <-> SFO
            ('SW-205', 'SkyWings Airways', 'JFK', 'SFO', '06:45', '10:05', 380, 0, 'Airbus A321neo', 220.0, 650.0, 1100.0, 60),
            ('AG-312', 'AeroGlobe', 'JFK', 'SFO', '13:30', '16:55', 385, 0, 'Boeing 737 MAX 9', 245.0, 690.0, 1150.0, 60),
            ('SW-206', 'SkyWings Airways', 'SFO', 'JFK', '12:00', '20:30', 330, 0, 'Airbus A321neo', 230.0, 670.0, 1120.0, 60),
            ('AG-313', 'AeroGlobe', 'SFO', 'JFK', '22:15', '06:40', 325, 0, 'Boeing 737 MAX 9', 210.0, 620.0, 1080.0, 60),

            # LHR <-> DXB
            ('EK-008', 'Emirates Air', 'LHR', 'DXB', '09:10', '19:20', 430, 0, 'Airbus A380-800', 710.0, 1850.0, 3400.0, 60),
            ('SW-401', 'SkyWings Airways', 'LHR', 'DXB', '14:00', '00:15', 435, 0, 'Boeing 777-300ER', 660.0, 1720.0, 3100.0, 60),
            ('EK-009', 'Emirates Air', 'DXB', 'LHR', '07:45', '12:25', 460, 0, 'Airbus A380-800', 730.0, 1880.0, 3450.0, 60),
            ('SW-402', 'SkyWings Airways', 'DXB', 'LHR', '16:30', '21:05', 455, 0, 'Boeing 777-300ER', 680.0, 1750.0, 3150.0, 60),

            # DXB <-> DEL
            ('SW-501', 'SkyWings Airways', 'DXB', 'DEL', '04:15', '09:10', 205, 0, 'Boeing 737 MAX 8', 190.0, 480.0, 890.0, 60),
            ('EK-512', 'Emirates Air', 'DXB', 'DEL', '21:50', '02:40', 200, 0, 'Boeing 777-300ER', 220.0, 540.0, 950.0, 60),
            ('SW-502', 'SkyWings Airways', 'DEL', 'DXB', '10:30', '12:45', 225, 0, 'Boeing 737 MAX 8', 195.0, 490.0, 910.0, 60),

            # DEL <-> BOM
            ('SW-601', 'SkyWings Airways', 'DEL', 'BOM', '06:00', '08:15', 135, 0, 'Airbus A320neo', 95.0, 240.0, 420.0, 60),
            ('AG-702', 'AeroGlobe', 'DEL', 'BOM', '11:45', '14:00', 135, 0, 'Boeing 737-800', 85.0, 220.0, 390.0, 60),
            ('SW-603', 'SkyWings Airways', 'DEL', 'BOM', '17:30', '19:45', 135, 0, 'Airbus A320neo', 110.0, 260.0, 450.0, 60),
            ('SW-602', 'SkyWings Airways', 'BOM', 'DEL', '09:00', '11:15', 135, 0, 'Airbus A320neo', 95.0, 240.0, 420.0, 60),
            ('AG-703', 'AeroGlobe', 'BOM', 'DEL', '15:15', '17:30', 135, 0, 'Boeing 737-800', 88.0, 230.0, 400.0, 60),

            # SIN <-> SYD
            ('SW-801', 'SkyWings Airways', 'SIN', 'SYD', '00:45', '10:55', 430, 0, 'Airbus A350-900', 510.0, 1390.0, 2400.0, 60),
            ('SW-802', 'SkyWings Airways', 'SYD', 'SIN', '12:15', '18:40', 505, 0, 'Airbus A350-900', 530.0, 1420.0, 2450.0, 60),

            # CDG <-> JFK
            ('AF-022', 'Air France', 'CDG', 'JFK', '08:30', '11:00', 510, 0, 'Boeing 777-300ER', 640.0, 1600.0, 2900.0, 60),
            ('SW-902', 'SkyWings Airways', 'JFK', 'CDG', '19:00', '08:20', 440, 0, 'Boeing 787-9', 610.0, 1520.0, 2750.0, 60),

            # HND <-> SFO
            ('SW-710', 'SkyWings Airways', 'HND', 'SFO', '17:25', '10:45', 560, 0, 'Boeing 787-9', 780.0, 2100.0, 3800.0, 60),
            ('SW-711', 'SkyWings Airways', 'SFO', 'HND', '13:00', '17:15', 675, 0, 'Boeing 787-9', 810.0, 2150.0, 3900.0, 60),

            # Connecting Flights (1 Stop)
            ('SW-150', 'SkyWings Airways', 'DEL', 'LHR', '03:30', '13:45', 645, 1, 'Boeing 787 / 737 (via DXB)', 460.0, 1150.0, 1950.0, 60),
            ('SW-151', 'SkyWings Airways', 'LHR', 'DEL', '15:20', '04:50', 540, 1, 'Boeing 787 / 737 (via DXB)', 480.0, 1190.0, 2010.0, 60),
            ('AG-880', 'AeroGlobe', 'JFK', 'DXB', '20:15', '18:30', 855, 1, 'Airbus A350 (via CDG)', 690.0, 1680.0, 2950.0, 60)
        ]

        cursor.executemany("""
        INSERT INTO flights (
            flight_number, airline, origin_code, dest_code, departure_time,
            arrival_time, duration_mins, stops, aircraft, economy_price,
            business_price, first_price, total_seats
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, flights)

    # Seed an example booking so user can test "My Bookings / PNR lookup" immediately!
    cursor.execute("SELECT COUNT(*) FROM bookings")
    if cursor.fetchone()[0] == 0:
        sample_pnr = "SW789X"
        sample_date = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
        cursor.execute("""
        INSERT INTO bookings (
            pnr, flight_id, travel_date, passenger_name, passenger_email,
            passenger_phone, passport_num, cabin_class, seat_number,
            fare_amount, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            sample_pnr, 1, sample_date, 'Captain James Kirk', 'kirk@starfleet.org',
            '+1-555-0199', 'P8920147', 'Business', '3A',
            1420.0, 'CONFIRMED', datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ))
        booking_id = cursor.lastrowid
        cursor.execute("""
        INSERT INTO occupied_seats (flight_id, travel_date, seat_number, booking_id)
        VALUES (?, ?, ?, ?)
        """, (1, sample_date, '3A', booking_id))

    conn.commit()

if __name__ == '__main__':
    init_db()
    print("Database initialized successfully at", DB_PATH)
