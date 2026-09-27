/**
 * admin.js - Admin Portal Management, Analytics & Flight Operations
 * SkyWings Airlines Reservation System
 */

document.addEventListener('DOMContentLoaded', () => {
  const totalFlightsStat = document.getElementById('statTotalFlights');
  const totalBookingsStat = document.getElementById('statTotalBookings');
  const totalRevenueStat = document.getElementById('statTotalRevenue');
  const totalOccupiedStat = document.getElementById('statTotalOccupied');
  const bookingsTableBody = document.getElementById('adminBookingsTableBody');
  const flightsTableBody = document.getElementById('adminFlightsTableBody');

  const addFlightForm = document.getElementById('addFlightForm');
  const addFlightModal = document.getElementById('addFlightModal');
  const openAddFlightBtn = document.getElementById('openAddFlightBtn');
  const closeAddFlightBtn = document.getElementById('closeAddFlightBtn');

  // Load Dashboard Stats & Bookings
  async function loadAdminStats() {
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();

      totalFlightsStat.textContent = data.total_flights;
      totalBookingsStat.textContent = `${data.confirmed_bookings} / ${data.total_bookings}`;
      totalRevenueStat.textContent = `$${Math.round(data.total_revenue).toLocaleString()}`;
      totalOccupiedStat.textContent = `${data.occupied_seats} seats`;

      // Render recent bookings
      if (data.recent_bookings && data.recent_bookings.length > 0) {
        let bHtml = '';
        data.recent_bookings.forEach(b => {
          const isCancelled = b.status === 'CANCELLED';
          bHtml += `
            <tr>
              <td><strong style="color:#1e40af; letter-spacing:0.5px;">${b.pnr}</strong></td>
              <td>${b.passenger_name}</td>
              <td><strong>${b.flight_number}</strong> (${b.origin_code} ➔ ${b.dest_code})</td>
              <td>${b.travel_date}</td>
              <td><span style="font-weight:700;">${b.seat_number}</span> (${b.cabin_class})</td>
              <td><strong>$${Math.round(b.fare_amount)}</strong></td>
              <td>
                <span style="padding:0.25rem 0.6rem; border-radius:999px; font-size:0.75rem; font-weight:700; background:${isCancelled ? '#fee2e2;color:#b91c1c' : '#dcfce7;color:#15803d'}">
                  ${b.status}
                </span>
              </td>
            </tr>
          `;
        });
        bookingsTableBody.innerHTML = bHtml;
      } else {
        bookingsTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:#94a3b8;">No bookings recorded yet.</td></tr>`;
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  // Load All Flights
  async function loadFlightsTable() {
    try {
      const res = await fetch('/api/admin/flights');
      const flights = await res.json();

      let fHtml = '';
      flights.forEach(f => {
        fHtml += `
          <tr>
            <td><strong>${f.flight_number}</strong></td>
            <td>${f.airline}</td>
            <td>${f.origin_code} (${f.origin_city})</td>
            <td>${f.dest_code} (${f.dest_city})</td>
            <td>${f.departure_time} - ${f.arrival_time}</td>
            <td>${Math.floor(f.duration_mins / 60)}h ${f.duration_mins % 60}m</td>
            <td>$${Math.round(f.economy_price)}</td>
            <td>$${Math.round(f.business_price)}</td>
            <td>
              <button style="background:#fee2e2; color:#b91c1c; border:none; padding:0.35rem 0.75rem; border-radius:6px; font-weight:700; cursor:pointer;" onclick="window.deleteFlight(${f.id}, '${f.flight_number}')">
                Delete
              </button>
            </td>
          </tr>
        `;
      });
      flightsTableBody.innerHTML = fHtml;
    } catch (err) {
      console.error('Failed to load flights:', err);
    }
  }

  // Handle Add Flight Form
  if (addFlightForm) {
    addFlightForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const payload = {
        flight_number: document.getElementById('newFlightNum').value.trim(),
        airline: document.getElementById('newAirline').value.trim(),
        origin_code: document.getElementById('newOrigin').value.trim(),
        dest_code: document.getElementById('newDest').value.trim(),
        departure_time: document.getElementById('newDepTime').value.trim(),
        arrival_time: document.getElementById('newArrTime').value.trim(),
        duration_mins: parseInt(document.getElementById('newDuration').value, 10),
        aircraft: document.getElementById('newAircraft').value.trim(),
        economy_price: parseFloat(document.getElementById('newEconPrice').value),
        business_price: parseFloat(document.getElementById('newBusPrice').value),
        first_price: parseFloat(document.getElementById('newFirstPrice').value)
      };

      try {
        const res = await fetch('/api/admin/flights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok) {
          alert('Flight schedule created successfully!');
          addFlightForm.reset();
          addFlightModal.classList.remove('active');
          loadAdminStats();
          loadFlightsTable();
        } else {
          alert(data.error || 'Failed to add flight.');
        }
      } catch (err) {
        console.error(err);
        alert('Error adding flight schedule.');
      }
    });
  }

  // Delete Flight
  window.deleteFlight = async function(flightId, flightNum) {
    if (!confirm(`Are you sure you want to remove flight ${flightNum}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/flights/${flightId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        loadAdminStats();
        loadFlightsTable();
      } else {
        alert(data.error || 'Failed to delete flight.');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting flight.');
    }
  };

  // Modal open/close
  if (openAddFlightBtn) {
    openAddFlightBtn.addEventListener('click', () => addFlightModal.classList.add('active'));
  }
  if (closeAddFlightBtn) {
    closeAddFlightBtn.addEventListener('click', () => addFlightModal.classList.remove('active'));
  }

  // Initial load
  loadAdminStats();
  loadFlightsTable();
});
