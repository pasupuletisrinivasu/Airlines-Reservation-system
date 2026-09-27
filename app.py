"""
app.py - Main Flask Application for Airlines Reservation System
Provides Web UI and RESTful APIs for flight search, filtering, seat selection,
booking management, PNR lookup, and admin operations.
"""

from flask import Flask, render_template, request, jsonify, redirect, url_for
from database import get_db, init_db
import sqlite3
import random
import string
from datetime import datetime, timedelta

app = Flask(__name__)
app.config['SECRET_KEY'] = 'skywings-secret-key-2026'

# Ensure database is initialized
init_db()

def generate_pnr():
    """Generate a unique 6-character alphanumeric PNR (e.g., SW48K2)"""
    chars = string.ascii_uppercase + string.digits
    while True:
        pnr = 'SW' + ''.join(random.choices(chars, k=4))
        conn = get_db()
        existing = conn.execute("SELECT id FROM bookings WHERE pnr = ?", (pnr,)).fetchone()
        conn.close()
        if not existing:
            return pnr

# ==========================================
# PAGE ROUTES
# ==========================================

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/my-bookings')
def my_bookings():
    pnr = request.args.get('pnr', '')
    return render_template('bookings.html', default_pnr=pnr)

@app.route('/flights')
def flight_schedules():
    return render_template('schedule.html')

@app.route('/admin')
def admin_portal():
    return render_template('admin.html')

# ==========================================
# REST API ENDPOINTS
# ==========================================

@app.route('/api/airports', methods=['GET'])
def get_airports():
    conn = get_db()
    airports = conn.execute("SELECT * FROM airports ORDER BY city ASC").fetchall()
    conn.close()
    return jsonify([dict(a) for a in airports])

@app.route('/api/flights/search', methods=['GET'])
def search_flights():
    """
    Search flights with rich filtering:
    - origin (airport code or 'any')
    - dest (airport code or 'any')
    - date (YYYY-MM-DD)
    - cabin_class (Economy, Business, First)
    - max_price (float)
    - stops ('all', '0', '1')
    - airline ('all' or specific name)
    - sort_by ('price_asc', 'price_desc', 'duration_asc', 'departure_asc')
    """
    origin = request.args.get('origin', '').strip().upper()
    dest = request.args.get('dest', '').strip().upper()
    date_str = request.args.get('date', datetime.now().strftime("%Y-%m-%d"))
    cabin_class = request.args.get('cabin_class', 'Economy')
    max_price = request.args.get('max_price', type=float)
    stops = request.args.get('stops', 'all')
    airline = request.args.get('airline', 'all')
    sort_by = request.args.get('sort_by', 'price_asc')

    price_col = 'economy_price'
    if cabin_class == 'Business':
        price_col = 'business_price'
    elif cabin_class == 'First':
        price_col = 'first_price'

    query = f"""
    SELECT f.*,
           orig.city as origin_city, orig.name as origin_name, orig.country as origin_country,
           dst.city as dest_city, dst.name as dest_name, dst.country as dest_country,
           f.{price_col} as selected_price
    FROM flights f
    JOIN airports orig ON f.origin_code = orig.code
    JOIN airports dst ON f.dest_code = dst.code
    WHERE 1=1
    """
    params = []

    if origin and origin != 'ANY':
        query += " AND f.origin_code = ?"
        params.append(origin)

    if dest and dest != 'ANY':
        query += " AND f.dest_code = ?"
        params.append(dest)

    if stops != 'all' and stops != '':
        query += " AND f.stops = ?"
        params.append(int(stops))

    if airline != 'all' and airline != '':
        query += " AND f.airline = ?"
        params.append(airline)

    if max_price is not None and max_price > 0:
        query += f" AND f.{price_col} <= ?"
        params.append(max_price)

    # Sorting
    if sort_by == 'price_asc':
        query += f" ORDER BY f.{price_col} ASC"
    elif sort_by == 'price_desc':
        query += f" ORDER BY f.{price_col} DESC"
    elif sort_by == 'duration_asc':
        query += " ORDER BY f.duration_mins ASC"
    elif sort_by == 'departure_asc':
        query += " ORDER BY f.departure_time ASC"
    else:
        query += f" ORDER BY f.{price_col} ASC"

    conn = get_db()
    flights_rows = conn.execute(query, params).fetchall()

    results = []
    for row in flights_rows:
        flight_dict = dict(row)
        # Calculate available seats for the requested date
        occupied = conn.execute("""
            SELECT COUNT(*) FROM occupied_seats
            WHERE flight_id = ? AND travel_date = ?
        """, (flight_dict['id'], date_str)).fetchone()[0]
        flight_dict['seats_available'] = max(0, flight_dict['total_seats'] - occupied)
        flight_dict['occupied_count'] = occupied
        flight_dict['price'] = flight_dict['selected_price']
        results.append(flight_dict)

    conn.close()
    return jsonify({
        'date': date_str,
        'count': len(results),
        'flights': results
    })

@app.route('/api/flights/<int:flight_id>/seats', methods=['GET'])
def get_flight_seats(flight_id):
    """Return aircraft seat map layout and occupied seats for a flight on a specific date."""
    date_str = request.args.get('date', datetime.now().strftime("%Y-%m-%d"))

    conn = get_db()
    flight = conn.execute("""
        SELECT f.*,
               orig.city as origin_city, orig.name as origin_name,
               dst.city as dest_city, dst.name as dest_name
        FROM flights f
        JOIN airports orig ON f.origin_code = orig.code
        JOIN airports dst ON f.dest_code = dst.code
        WHERE f.id = ?
    """, (flight_id,)).fetchone()

    if not flight:
        conn.close()
        return jsonify({'error': 'Flight not found'}), 404

    # Fetch occupied seats
    occupied_rows = conn.execute("""
        SELECT seat_number FROM occupied_seats
        WHERE flight_id = ? AND travel_date = ?
    """, (flight_id, date_str)).fetchall()
    occupied_seats = [r['seat_number'] for r in occupied_rows]

    conn.close()

    # Generate layout: 10 rows (Rows 1-2 First, 3-5 Business, 6-10 Economy)
    # Columns: A, B, C (Aisle) D, E, F
    seat_layout = []
    for row_num in range(1, 11):
        if row_num in [1, 2]:
            seat_class = 'First'
            cols = ['A', 'B', 'E', 'F'] # Wider seats in first class
        elif row_num in [3, 4, 5]:
            seat_class = 'Business'
            cols = ['A', 'B', 'C', 'D', 'E', 'F']
        else:
            seat_class = 'Economy'
            cols = ['A', 'B', 'C', 'D', 'E', 'F']

        row_seats = []
        for col in cols:
            seat_code = f"{row_num}{col}"
            is_occupied = seat_code in occupied_seats
            seat_type = 'window' if col in ['A', 'F'] else ('aisle' if col in ['C', 'D'] else 'middle')
            row_seats.append({
                'seat_code': seat_code,
                'class': seat_class,
                'type': seat_type,
                'is_occupied': is_occupied
            })
        seat_layout.append({
            'row_num': row_num,
            'class': seat_class,
            'seats': row_seats
        })

    return jsonify({
        'flight': dict(flight),
        'travel_date': date_str,
        'occupied_seats': occupied_seats,
        'layout': seat_layout
    })

@app.route('/api/bookings', methods=['POST'])
def create_booking():
    """Create a new flight booking and reserve the selected seat"""
    data = request.get_json() or {}

    flight_id = data.get('flight_id')
    travel_date = data.get('travel_date')
    passenger_name = data.get('passenger_name', '').strip()
    passenger_email = data.get('passenger_email', '').strip()
    passenger_phone = data.get('passenger_phone', '').strip()
    passport_num = data.get('passport_num', '').strip()
    cabin_class = data.get('cabin_class', 'Economy')
    seat_number = data.get('seat_number', '').strip().upper()
    return_flight_id = data.get('return_flight_id')
    return_travel_date = data.get('return_travel_date')
    return_seat_number = data.get('return_seat_number', '').strip().upper() or None

    if not all([flight_id, travel_date, passenger_name, passenger_email, seat_number]):
        return jsonify({'error': 'Missing required booking details'}), 400

    conn = get_db()
    cursor = conn.cursor()

    # Verify flight exists
    flight = cursor.execute("SELECT * FROM flights WHERE id = ?", (flight_id,)).fetchone()
    if not flight:
        conn.close()
        return jsonify({'error': 'Flight not found'}), 404

    # Calculate fare
    base_fare = flight['economy_price']
    if cabin_class == 'Business':
        base_fare = flight['business_price']
    elif cabin_class == 'First':
        base_fare = flight['first_price']

    # If round trip, add return flight fare
    total_fare = base_fare
    if return_flight_id:
        ret_flight = cursor.execute("SELECT * FROM flights WHERE id = ?", (return_flight_id,)).fetchone()
        if ret_flight:
            ret_fare = ret_flight['economy_price']
            if cabin_class == 'Business':
                ret_fare = ret_flight['business_price']
            elif cabin_class == 'First':
                ret_fare = ret_flight['first_price']
            total_fare += ret_fare

    # Check if outbound seat is already occupied
    is_seat_taken = cursor.execute("""
        SELECT id FROM occupied_seats
        WHERE flight_id = ? AND travel_date = ? AND seat_number = ?
    """, (flight_id, travel_date, seat_number)).fetchone()

    if is_seat_taken:
        conn.close()
        return jsonify({'error': f'Seat {seat_number} is already reserved for this flight and date. Please select another seat.'}), 409

    pnr = generate_pnr()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    try:
        cursor.execute("""
        INSERT INTO bookings (
            pnr, flight_id, travel_date, return_flight_id, return_travel_date,
            passenger_name, passenger_email, passenger_phone, passport_num,
            cabin_class, seat_number, return_seat_number, fare_amount, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', ?)
        """, (
            pnr, flight_id, travel_date, return_flight_id, return_travel_date,
            passenger_name, passenger_email, passenger_phone, passport_num,
            cabin_class, seat_number, return_seat_number, total_fare, now_str
        ))
        booking_id = cursor.lastrowid

        # Record outbound occupied seat
        cursor.execute("""
        INSERT INTO occupied_seats (flight_id, travel_date, seat_number, booking_id)
        VALUES (?, ?, ?, ?)
        """, (flight_id, travel_date, seat_number, booking_id))

        # If return seat provided, record it too
        if return_flight_id and return_travel_date and return_seat_number:
            cursor.execute("""
            INSERT INTO occupied_seats (flight_id, travel_date, seat_number, booking_id)
            VALUES (?, ?, ?, ?)
            """, (return_flight_id, return_travel_date, return_seat_number, booking_id))

        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({'error': f'Failed to create booking: {str(e)}'}), 500

    conn.close()
    return jsonify({
        'success': True,
        'message': 'Booking confirmed successfully!',
        'pnr': pnr,
        'fare_amount': total_fare
    }), 201

@app.route('/api/bookings/<pnr>', methods=['GET'])
def get_booking_details(pnr):
    """Retrieve full booking info by PNR reference code"""
    conn = get_db()
    booking = conn.execute("""
        SELECT b.*,
               f.flight_number, f.airline, f.departure_time, f.arrival_time,
               f.duration_mins, f.stops, f.aircraft,
               orig.code as origin_code, orig.city as origin_city, orig.name as origin_name,
               dst.code as dest_code, dst.city as dest_city, dst.name as dest_name
        FROM bookings b
        JOIN flights f ON b.flight_id = f.id
        JOIN airports orig ON f.origin_code = orig.code
        JOIN airports dst ON f.dest_code = dst.code
        WHERE b.pnr = ?
    """, (pnr.upper().strip(),)).fetchone()

    if not booking:
        conn.close()
        return jsonify({'error': 'Booking not found. Please verify your PNR code.'}), 404

    booking_dict = dict(booking)

    # If round-trip, fetch return flight details
    if booking_dict.get('return_flight_id'):
        ret = conn.execute("""
            SELECT f.flight_number as ret_flight_number, f.airline as ret_airline,
                   f.departure_time as ret_departure_time, f.arrival_time as ret_arrival_time,
                   f.duration_mins as ret_duration_mins, f.aircraft as ret_aircraft,
                   orig.code as ret_origin_code, orig.city as ret_origin_city,
                   dst.code as ret_dest_code, dst.city as ret_dest_city
            FROM flights f
            JOIN airports orig ON f.origin_code = orig.code
            JOIN airports dst ON f.dest_code = dst.code
            WHERE f.id = ?
        """, (booking_dict['return_flight_id'],)).fetchone()
        if ret:
            booking_dict.update(dict(ret))

    conn.close()
    return jsonify({'booking': booking_dict})

@app.route('/api/bookings/<pnr>/cancel', methods=['POST'])
def cancel_booking(pnr):
    """Cancel booking and release reserved seats"""
    conn = get_db()
    cursor = conn.cursor()

    booking = cursor.execute("SELECT id, status FROM bookings WHERE pnr = ?", (pnr.upper().strip(),)).fetchone()
    if not booking:
        conn.close()
        return jsonify({'error': 'Booking not found'}), 404

    if booking['status'] == 'CANCELLED':
        conn.close()
        return jsonify({'error': 'This reservation has already been cancelled.'}), 400

    booking_id = booking['id']

    # Update status to CANCELLED
    cursor.execute("UPDATE bookings SET status = 'CANCELLED' WHERE id = ?", (booking_id,))

    # Release occupied seats
    cursor.execute("DELETE FROM occupied_seats WHERE booking_id = ?", (booking_id,))

    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': f'Booking {pnr.upper()} has been successfully cancelled.'})

# ==========================================
# ADMIN API ENDPOINTS
# ==========================================

@app.route('/api/admin/stats', methods=['GET'])
def admin_stats():
    conn = get_db()

    total_flights = conn.execute("SELECT COUNT(*) FROM flights").fetchone()[0]
    total_bookings = conn.execute("SELECT COUNT(*) FROM bookings").fetchone()[0]
    confirmed_bookings = conn.execute("SELECT COUNT(*) FROM bookings WHERE status = 'CONFIRMED'").fetchone()[0]
    cancelled_bookings = conn.execute("SELECT COUNT(*) FROM bookings WHERE status = 'CANCELLED'").fetchone()[0]
    total_revenue = conn.execute("SELECT COALESCE(SUM(fare_amount), 0) FROM bookings WHERE status = 'CONFIRMED'").fetchone()[0]
    total_occupied_seats = conn.execute("SELECT COUNT(*) FROM occupied_seats").fetchone()[0]

    # Recent bookings
    recent_bookings = conn.execute("""
        SELECT b.pnr, b.passenger_name, b.travel_date, b.cabin_class, b.seat_number,
               b.fare_amount, b.status, b.created_at, f.flight_number, f.origin_code, f.dest_code
        FROM bookings b
        JOIN flights f ON b.flight_id = f.id
        ORDER BY b.id DESC LIMIT 10
    """).fetchall()

    conn.close()
    return jsonify({
        'total_flights': total_flights,
        'total_bookings': total_bookings,
        'confirmed_bookings': confirmed_bookings,
        'cancelled_bookings': cancelled_bookings,
        'total_revenue': total_revenue,
        'occupied_seats': total_occupied_seats,
        'recent_bookings': [dict(b) for b in recent_bookings]
    })

@app.route('/api/admin/flights', methods=['GET', 'POST'])
def manage_flights():
    conn = get_db()
    cursor = conn.cursor()

    if request.method == 'GET':
        flights = conn.execute("""
            SELECT f.*, orig.city as origin_city, dst.city as dest_city
            FROM flights f
            JOIN airports orig ON f.origin_code = orig.code
            JOIN airports dst ON f.dest_code = dst.code
            ORDER BY f.flight_number ASC
        """).fetchall()
        conn.close()
        return jsonify([dict(f) for f in flights])

    elif request.method == 'POST':
        data = request.get_json() or {}
        required = ['flight_number', 'airline', 'origin_code', 'dest_code', 'departure_time', 'arrival_time', 'duration_mins', 'economy_price']
        for field in required:
            if not data.get(field):
                conn.close()
                return jsonify({'error': f'Field {field} is required'}), 400

        try:
            cursor.execute("""
            INSERT INTO flights (
                flight_number, airline, origin_code, dest_code, departure_time,
                arrival_time, duration_mins, stops, aircraft, economy_price,
                business_price, first_price, total_seats
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                data['flight_number'].upper().strip(),
                data['airline'].strip(),
                data['origin_code'].upper().strip(),
                data['dest_code'].upper().strip(),
                data['departure_time'],
                data['arrival_time'],
                int(data['duration_mins']),
                int(data.get('stops', 0)),
                data.get('aircraft', 'Boeing 737-800'),
                float(data['economy_price']),
                float(data.get('business_price', float(data['economy_price']) * 2.5)),
                float(data.get('first_price', float(data['economy_price']) * 4.5)),
                int(data.get('total_seats', 60))
            ))
            conn.commit()
            new_id = cursor.lastrowid
            conn.close()
            return jsonify({'success': True, 'id': new_id, 'message': 'Flight added successfully'}), 201
        except sqlite3.IntegrityError:
            conn.close()
            return jsonify({'error': 'Flight number already exists.'}), 409
        except Exception as e:
            conn.close()
            return jsonify({'error': str(e)}), 500

@app.route('/api/admin/flights/<int:flight_id>', methods=['DELETE'])
def delete_flight(flight_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM flights WHERE id = ?", (flight_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Flight deleted successfully'})

if __name__ == '__main__':
    print("Starting Airlines Reservation System on http://127.0.0.1:5000 ...")
    app.run(host='127.0.0.1', port=5000, debug=True)
