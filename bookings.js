/**
 * bookings.js - Manage Bookings, PNR Lookup & E-Ticket Boarding Pass
 * SkyWings Airlines Reservation System
 */

document.addEventListener('DOMContentLoaded', () => {
  const pnrSearchForm = document.getElementById('pnrSearchForm');
  const pnrInput = document.getElementById('pnrInput');
  const bookingResultSection = document.getElementById('bookingResultSection');

  // Check URL parameters for default PNR (e.g. ?pnr=SW789X)
  const urlParams = new URLSearchParams(window.location.search);
  const defaultPnr = urlParams.get('pnr');
  if (defaultPnr) {
    pnrInput.value = defaultPnr.toUpperCase().trim();
    lookupBooking(defaultPnr);
  }

  pnrSearchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const pnr = pnrInput.value.trim().toUpperCase();
    if (pnr) {
      lookupBooking(pnr);
    }
  });

  async function lookupBooking(pnr) {
    bookingResultSection.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>Looking up reservation ${pnr}...</h3>
        <p>Retrieving your ticket and flight details.</p>
      </div>
    `;

    try {
      const res = await fetch(`/api/bookings/${pnr}`);
      const data = await res.json();

      if (res.ok && data.booking) {
        renderBoardingPass(data.booking);
      } else {
        bookingResultSection.innerHTML = `
          <div class="empty-state" style="border-color:#fca5a5;">
            <div class="empty-icon">❌</div>
            <h3 style="color:#b91c1c;">Booking Not Found</h3>
            <p>${data.error || 'No active flight reservation found for PNR ' + pnr + '. Please double-check your 6-character code.'}</p>
          </div>
        `;
      }
    } catch (err) {
      console.error(err);
      bookingResultSection.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3>System Error</h3>
          <p>Unable to retrieve booking details. Please try again later.</p>
        </div>
      `;
    }
  }

  function renderBoardingPass(booking) {
    const isCancelled = booking.status === 'CANCELLED';
    const cancelBadge = isCancelled
      ? `<div class="cancelled-overlay-stamp">CANCELLED</div>`
      : '';

    // Generate simulated gate and terminal
    const gateLetters = ['A', 'B', 'C', 'D'];
    const gate = `${gateLetters[booking.id % 4]}${12 + (booking.id % 15)}`;
    const terminal = `T${1 + (booking.id % 3)}`;
    const boardingGroup = booking.cabin_class === 'First' ? 'GROUP 1' : (booking.cabin_class === 'Business' ? 'GROUP 2' : 'GROUP 3');

    const html = `
      <div class="boarding-actions-bar no-print" style="display:flex; justify-content:space-between; align-items:center; max-width:860px; margin:0 auto 1rem; flex-wrap:wrap; gap:1rem;">
        <div>
          <span style="font-size:0.9rem; color:#64748b;">Booking Reference:</span>
          <strong style="font-size:1.15rem; color:#1e40af; margin-left:0.4rem; letter-spacing:1px;">${booking.pnr}</strong>
          <span style="margin-left:0.75rem; font-size:0.8rem; padding:0.25rem 0.65rem; border-radius:999px; font-weight:700; background:${isCancelled ? '#fee2e2;color:#b91c1c' : '#dcfce7;color:#15803d'}">
            ● ${booking.status}
          </span>
        </div>
        <div style="display:flex; gap:0.75rem;">
          <button class="btn" style="background:#1e40af; color:#fff; border:none; padding:0.6rem 1.25rem; border-radius:8px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:0.4rem;" onclick="window.print()">
            🖨️ Print / Download Ticket
          </button>
          ${!isCancelled ? `
          <button class="btn" style="background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; padding:0.6rem 1.25rem; border-radius:8px; font-weight:700; cursor:pointer;" onclick="window.cancelReservation('${booking.pnr}')">
            Cancel Booking
          </button>` : ''}
        </div>
      </div>

      <div class="boarding-pass-wrapper">
        <div class="boarding-pass ${isCancelled ? 'cancelled-ticket' : ''}">
          ${cancelBadge}

          <!-- Main Pass -->
          <div class="pass-main">
            <div class="pass-header">
              <div class="pass-airline">
                <span style="background:#1e40af; color:#fff; width:32px; height:32px; border-radius:6px; display:inline-flex; align-items:center; justify-content:center; font-size:0.9rem;">✈</span>
                ${booking.airline}
              </div>
              <div class="pass-flight-type">
                ${booking.cabin_class} Class Boarding Pass
              </div>
            </div>

            <!-- Route and timing -->
            <div class="pass-route">
              <div class="route-point">
                <span class="route-city">${booking.origin_city}</span>
                <span class="route-code">${booking.origin_code}</span>
                <span class="route-time">${booking.departure_time}</span>
              </div>

              <div class="route-path-graphic">
                <span style="font-size:0.75rem; font-weight:700; color:#64748b;">${Math.floor(booking.duration_mins / 60)}h ${booking.duration_mins % 60}m</span>
                <div style="width:100%; height:2px; background:#cbd5e1; position:relative; margin:0.4rem 0;">
                  <span style="position:absolute; left:50%; top:-9px; transform:translateX(-50%); font-size:0.9rem; color:#1e40af; background:#fff; padding:0 4px;">✈</span>
                </div>
                <span style="font-size:0.72rem; color:#059669; font-weight:700;">${booking.stops === 0 ? 'NON-STOP' : '1 STOP'}</span>
              </div>

              <div class="route-point right">
                <span class="route-city">${booking.dest_city}</span>
                <span class="route-code">${booking.dest_code}</span>
                <span class="route-time">${booking.arrival_time}</span>
              </div>
            </div>

            <!-- Detailed Grid -->
            <div class="pass-details-grid">
              <div class="pass-detail-item">
                <span class="detail-label">Passenger Name</span>
                <span class="detail-value">${booking.passenger_name}</span>
              </div>
              <div class="pass-detail-item">
                <span class="detail-label">Flight Number</span>
                <span class="detail-value highlight">${booking.flight_number}</span>
              </div>
              <div class="pass-detail-item">
                <span class="detail-label">Departure Date</span>
                <span class="detail-value">${booking.travel_date}</span>
              </div>
              <div class="pass-detail-item">
                <span class="detail-label">Seat Assigned</span>
                <span class="detail-value highlight" style="font-size:1.25rem; color:#1e40af;">${booking.seat_number}</span>
              </div>
              <div class="pass-detail-item">
                <span class="detail-label">Boarding Gate</span>
                <span class="detail-value">${gate}</span>
              </div>
              <div class="pass-detail-item">
                <span class="detail-label">Terminal</span>
                <span class="detail-value">${terminal}</span>
              </div>
              <div class="pass-detail-item">
                <span class="detail-label">Boarding Group</span>
                <span class="detail-value">${boardingGroup}</span>
              </div>
              <div class="pass-detail-item">
                <span class="detail-label">Aircraft</span>
                <span class="detail-value" style="font-size:0.85rem;">${booking.aircraft}</span>
              </div>
            </div>

            <!-- Barcode & PNR footer -->
            <div class="pass-barcode-area">
              <svg class="barcode-svg" viewBox="0 0 100 24" preserveAspectRatio="none">
                <rect x="0" y="0" width="2" height="24" fill="#0f172a" />
                <rect x="4" y="0" width="1" height="24" fill="#0f172a" />
                <rect x="7" y="0" width="3" height="24" fill="#0f172a" />
                <rect x="12" y="0" width="2" height="24" fill="#0f172a" />
                <rect x="16" y="0" width="4" height="24" fill="#0f172a" />
                <rect x="22" y="0" width="1" height="24" fill="#0f172a" />
                <rect x="25" y="0" width="2" height="24" fill="#0f172a" />
                <rect x="29" y="0" width="3" height="24" fill="#0f172a" />
                <rect x="34" y="0" width="2" height="24" fill="#0f172a" />
                <rect x="38" y="0" width="1" height="24" fill="#0f172a" />
                <rect x="41" y="0" width="4" height="24" fill="#0f172a" />
                <rect x="47" y="0" width="2" height="24" fill="#0f172a" />
                <rect x="51" y="0" width="3" height="24" fill="#0f172a" />
                <rect x="56" y="0" width="1" height="24" fill="#0f172a" />
                <rect x="60" y="0" width="3" height="24" fill="#0f172a" />
                <rect x="65" y="0" width="2" height="24" fill="#0f172a" />
                <rect x="69" y="0" width="4" height="24" fill="#0f172a" />
                <rect x="75" y="0" width="1" height="24" fill="#0f172a" />
                <rect x="78" y="0" width="3" height="24" fill="#0f172a" />
                <rect x="83" y="0" width="2" height="24" fill="#0f172a" />
                <rect x="87" y="0" width="3" height="24" fill="#0f172a" />
                <rect x="92" y="0" width="1" height="24" fill="#0f172a" />
                <rect x="95" y="0" width="4" height="24" fill="#0f172a" />
              </svg>
              <div class="pnr-box-pass">
                PNR: <strong>${booking.pnr}</strong> &nbsp;|&nbsp; Fare Paid: <strong>$${Math.round(booking.fare_amount)}</strong>
              </div>
            </div>
          </div>

          <!-- Tear-Off Stub -->
          <div class="pass-stub">
            <div class="stub-header">
              <span class="stub-flight-badge">${booking.flight_number}</span>
              <div class="stub-route">${booking.origin_code} ➔ ${booking.dest_code}</div>
            </div>

            <div class="stub-details">
              <div>
                <span class="detail-label">Passenger</span>
                <div style="font-weight:700; font-size:0.85rem; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                  ${booking.passenger_name}
                </div>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <div>
                  <span class="detail-label">Date</span>
                  <div style="font-weight:700; font-size:0.85rem;">${booking.travel_date}</div>
                </div>
                <div>
                  <span class="detail-label">Time</span>
                  <div style="font-weight:700; font-size:0.85rem; color:#1e40af;">${booking.departure_time}</div>
                </div>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <div>
                  <span class="detail-label">Seat</span>
                  <div style="font-weight:900; font-size:1.2rem; color:#1e40af;">${booking.seat_number}</div>
                </div>
                <div>
                  <span class="detail-label">Class</span>
                  <div style="font-weight:700; font-size:0.85rem;">${booking.cabin_class}</div>
                </div>
              </div>
            </div>

            <!-- Simulated QR Code -->
            <div class="qr-code-box" title="Scan at Gate for Boarding">
              <svg viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="1.8">
                <rect x="2" y="2" width="7" height="7" rx="1.5" />
                <rect x="15" y="2" width="7" height="7" rx="1.5" />
                <rect x="2" y="15" width="7" height="7" rx="1.5" />
                <path d="M6 6h.01M18 6h.01M6 18h.01M15 15h2v2h-2zM19 19h2v2h-2zM15 19h2v2h-2zM19 15h2v2h-2z" />
              </svg>
            </div>
            <div style="text-align:center; font-size:0.68rem; color:#94a3b8; font-weight:600; margin-top:0.35rem;">
              SCAN AT BOARDING GATE
            </div>
          </div>
        </div>
      </div>
    `;

    bookingResultSection.innerHTML = html;
  }

  // Handle Cancellation
  window.cancelReservation = async function(pnr) {
    if (!confirm(`Are you sure you want to cancel booking ${pnr}? This will release your reserved seat.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/bookings/${pnr}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        lookupBooking(pnr);
      } else {
        alert(data.error || 'Failed to cancel booking.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error while cancelling booking.');
    }
  };
});
