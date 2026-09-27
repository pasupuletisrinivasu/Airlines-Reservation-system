/**
 * app.js - Flight Search, Real-Time Filtering, Seat Selection & Booking Engine
 * SkyWings Airlines Reservation System
 */

document.addEventListener('DOMContentLoaded', () => {
  // Global State
  const state = {
    tripType: 'oneway',
    selectedCabin: 'Economy',
    passengers: 1,
    origin: '',
    dest: '',
    depDate: '',
    returnDate: '',
    maxPrice: 2000,
    stops: 'all',
    airline: 'all',
    sortBy: 'price_asc',
    currentFlights: [],
    selectedFlight: null,
    selectedSeat: null,
    confirmedBooking: null
  };

  // Elements
  const originSelect = document.getElementById('originSelect');
  const destSelect = document.getElementById('destSelect');
  const depDateInput = document.getElementById('depDate');
  const returnDateInput = document.getElementById('returnDate');
  const returnDateWrapper = document.getElementById('returnDateWrapper');
  const cabinSelect = document.getElementById('cabinClassSelect');
  const passengerSelect = document.getElementById('passengersSelect');
  const searchForm = document.getElementById('flightSearchForm');
  const swapBtn = document.getElementById('swapAirportsBtn');
  const flightsContainer = document.getElementById('flightsList');
  const resultsCountText = document.getElementById('resultsCountText');
  const sortSelect = document.getElementById('sortSelect');
  const priceSlider = document.getElementById('priceSlider');
  const priceDisplay = document.getElementById('priceDisplay');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');

  // Modals
  const seatModal = document.getElementById('seatSelectionModal');
  const closeSeatModalBtn = document.getElementById('closeSeatModal');
  const cabinMap = document.getElementById('cabinMap');
  const selectedSeatText = document.getElementById('selectedSeatText');
  const proceedToCheckoutBtn = document.getElementById('proceedToCheckoutBtn');

  const checkoutModal = document.getElementById('checkoutModal');
  const closeCheckoutModalBtn = document.getElementById('closeCheckoutModal');
  const checkoutFlightSummary = document.getElementById('checkoutFlightSummary');
  const passengerForm = document.getElementById('passengerForm');

  const confirmationModal = document.getElementById('confirmationModal');
  const closeConfirmationModalBtn = document.getElementById('closeConfirmationModal');
  const confirmedPnrText = document.getElementById('confirmedPnrText');
  const copyPnrBtn = document.getElementById('copyPnrBtn');
  const viewTicketBtn = document.getElementById('viewTicketBtn');

  // Initialize Default Dates
  const today = new Date().toISOString().split('T')[0];
  depDateInput.min = today;
  depDateInput.value = today;
  state.depDate = today;

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split('T')[0];
  returnDateInput.min = today;
  returnDateInput.value = nextWeekStr;
  state.returnDate = nextWeekStr;

  // 1. Fetch and Populate Airports
  async function loadAirports() {
    try {
      const res = await fetch('/api/airports');
      const airports = await res.json();

      let originHtml = '<option value="">All Origins (Any)</option>';
      let destHtml = '<option value="">All Destinations (Any)</option>';

      airports.forEach(a => {
        const option = `<option value="${a.code}">${a.city} (${a.code}) - ${a.name}</option>`;
        originHtml += option;
        destHtml += option;
      });

      originSelect.innerHTML = originHtml;
      destSelect.innerHTML = destHtml;

      // Populate airline filter options if available
      loadFlights();
    } catch (err) {
      console.error('Failed to load airports:', err);
    }
  }

  // 2. Setup Trip Type Tabs (One-way vs Round-trip)
  document.querySelectorAll('.trip-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.trip-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      state.tripType = e.target.dataset.type;

      if (state.tripType === 'roundtrip') {
        returnDateWrapper.style.display = 'flex';
      } else {
        returnDateWrapper.style.display = 'none';
      }
    });
  });

  // 3. Swap Origin and Destination
  swapBtn.addEventListener('click', () => {
    const temp = originSelect.value;
    originSelect.value = destSelect.value;
    destSelect.value = temp;
    state.origin = originSelect.value;
    state.dest = destSelect.value;
  });

  // 4. Load & Search Flights from API
  async function loadFlights() {
    flightsContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✈️</div>
        <h3>Searching available flights...</h3>
        <p>Fetching real-time schedules and fares.</p>
      </div>
    `;

    const params = new URLSearchParams({
      origin: state.origin,
      dest: state.dest,
      date: state.depDate,
      cabin_class: state.selectedCabin,
      stops: state.stops,
      airline: state.airline,
      sort_by: state.sortBy,
      max_price: state.maxPrice
    });

    try {
      const res = await fetch(`/api/flights/search?${params.toString()}`);
      const data = await res.json();
      state.currentFlights = data.flights || [];
      renderFlightResults(state.currentFlights);
    } catch (err) {
      console.error('Search error:', err);
      flightsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3>Unable to fetch flights</h3>
          <p>Please check your connection and try again.</p>
        </div>
      `;
    }
  }

  // 5. Render Flight Results Cards
  function renderFlightResults(flights) {
    resultsCountText.innerHTML = `Showing <strong>${flights.length}</strong> available flights`;

    if (flights.length === 0) {
      flightsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🛫</div>
          <h3>No Flights Found</h3>
          <p>We couldn't find any flights matching your criteria. Try adjusting the dates, route, or filter sliders.</p>
        </div>
      `;
      return;
    }

    let html = '';
    flights.forEach(f => {
      const durationHours = Math.floor(f.duration_mins / 60);
      const durationMins = f.duration_mins % 60;
      const durationStr = `${durationHours}h ${durationMins > 0 ? durationMins + 'm' : ''}`;
      const isNonStop = f.stops === 0;
      const stopsBadge = isNonStop
        ? `<span class="path-badge nonstop">Non-stop</span>`
        : `<span class="path-badge stop">1 Stop</span>`;

      const remainingSeats = f.seats_available;
      const seatAlert = remainingSeats <= 10
        ? `<span class="seats-badge">🔥 Only ${remainingSeats} seats left</span>`
        : `<span class="seats-badge" style="color:#059669;background:#ecfdf5;">✓ ${remainingSeats} available</span>`;

      const perPersonPrice = Math.round(f.price);
      const totalPrice = Math.round(f.price * state.passengers);

      html += `
        <div class="flight-card" data-flight-id="${f.id}">
          <!-- Airline info -->
          <div class="airline-info">
            <div class="airline-badge">
              ${f.airline.substring(0, 2).toUpperCase()}
            </div>
            <div class="airline-meta">
              <span class="airline-name">${f.airline}</span>
              <div class="flight-code-aircraft">
                <span class="flight-code">${f.flight_number}</span>
                <span>•</span>
                <span>${f.aircraft}</span>
              </div>
            </div>
          </div>

          <!-- Timeline -->
          <div class="flight-timeline">
            <div class="time-box origin">
              <span class="time">${f.departure_time}</span>
              <span class="airport-code">${f.origin_code}</span>
              <span class="city-name">${f.origin_city}</span>
            </div>

            <div class="path-visual">
              <span class="path-duration">${durationStr}</span>
              <div class="path-line-container">
                <div class="path-dot"></div>
                <div class="path-line">
                  <span class="path-plane-icon">✈</span>
                </div>
                <div class="path-dot"></div>
              </div>
              ${stopsBadge}
            </div>

            <div class="time-box dest">
              <span class="time">${f.arrival_time}</span>
              <span class="airport-code">${f.dest_code}</span>
              <span class="city-name">${f.dest_city}</span>
            </div>
          </div>

          <!-- Price & CTA -->
          <div class="price-cta-col">
            ${seatAlert}
            <div class="fare-price">
              $${perPersonPrice} <span>/ traveler</span>
            </div>
            ${state.passengers > 1 ? `<div style="font-size:0.8rem; color:#64748b;">Total: $${totalPrice}</div>` : ''}
            <button class="btn-select-flight" onclick="window.initSeatSelection(${f.id})">
              Select Seats →
            </button>
          </div>
        </div>
      `;
    });

    flightsContainer.innerHTML = html;
  }

  // 6. Interactive Seat Selection
  window.initSeatSelection = async function(flightId) {
    const flight = state.currentFlights.find(f => f.id === flightId);
    if (!flight) return;

    state.selectedFlight = flight;
    state.selectedSeat = null;
    selectedSeatText.textContent = 'None';
    proceedToCheckoutBtn.disabled = true;

    document.getElementById('seatModalFlightNum').textContent = `${flight.airline} (${flight.flight_number})`;
    document.getElementById('seatModalRoute').textContent = `${flight.origin_code} ➔ ${flight.dest_code} • ${state.depDate}`;

    cabinMap.innerHTML = `<div style="text-align:center; padding:2rem;">Loading aircraft cabin map...</div>`;
    seatModal.classList.add('active');

    try {
      const res = await fetch(`/api/flights/${flightId}/seats?date=${state.depDate}`);
      const data = await res.json();
      renderSeatMap(data.layout);
    } catch (err) {
      cabinMap.innerHTML = `<div style="color:red; text-align:center;">Failed to load seat layout.</div>`;
    }
  };

  function renderSeatMap(layout) {
    let html = `
      <div class="airplane-cabin">
        <div class="cockpit-view">Cockpit / Front of Plane ✈</div>
    `;

    let currentSection = '';

    layout.forEach(row => {
      if (row.class !== currentSection) {
        currentSection = row.class;
        html += `<div class="cabin-section-label">${currentSection} Class</div>`;
      }

      html += `<div class="cabin-row">`;
      html += `<span class="row-number">${row.row_num}</span>`;

      // Split seats into left cluster and right cluster with aisle
      const mid = Math.ceil(row.seats.length / 2);
      const leftSeats = row.seats.slice(0, mid);
      const rightSeats = row.seats.slice(mid);

      html += `<div class="seat-cluster">`;
      leftSeats.forEach(s => {
        html += renderSeatButton(s);
      });
      html += `</div>`;

      html += `<div class="aisle-gap"></div>`;

      html += `<div class="seat-cluster">`;
      rightSeats.forEach(s => {
        html += renderSeatButton(s);
      });
      html += `</div>`;

      html += `</div>`;
    });

    html += `</div>`;
    cabinMap.innerHTML = html;

    // Attach Seat Click Handlers
    document.querySelectorAll('.seat-btn:not(:disabled)').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const clickedSeat = e.currentTarget.dataset.seat;
        document.querySelectorAll('.seat-btn').forEach(b => b.classList.remove('selected'));
        e.currentTarget.classList.add('selected');
        state.selectedSeat = clickedSeat;
        selectedSeatText.textContent = clickedSeat;
        proceedToCheckoutBtn.disabled = false;
      });
    });
  }

  function renderSeatButton(seat) {
    const disabledAttr = seat.is_occupied ? 'disabled' : '';
    const occupiedClass = seat.is_occupied ? 'occupied' : 'available';
    return `
      <button type="button" class="seat-btn ${occupiedClass}"
        data-seat="${seat.seat_code}"
        data-class="${seat.class}"
        title="${seat.seat_code} (${seat.class} - ${seat.type})"
        ${disabledAttr}>
        ${seat.seat_code}
      </button>
    `;
  }

  // 7. Proceed to Checkout / Passenger Modal
  proceedToCheckoutBtn.addEventListener('click', () => {
    if (!state.selectedSeat || !state.selectedFlight) return;
    seatModal.classList.remove('active');
    openCheckoutModal();
  });

  function openCheckoutModal() {
    const flight = state.selectedFlight;
    const baseFare = Math.round(flight.price);
    const taxes = Math.round(baseFare * 0.12);
    const seatFee = state.selectedSeat.startsWith('1') || state.selectedSeat.startsWith('2') ? 50 : 0;
    const grandTotal = baseFare + taxes + seatFee;

    state.fareBreakdown = { baseFare, taxes, seatFee, grandTotal };

    checkoutFlightSummary.innerHTML = `
      <div class="summary-flight-info">
        <h4>${flight.airline} ${flight.flight_number}</h4>
        <p style="color:#64748b; font-size:0.9rem;">
          ${flight.origin_city} (${flight.origin_code}) ➔ ${flight.dest_city} (${flight.dest_code})
        </p>
        <p style="font-weight:600; font-size:0.85rem; margin-top:0.4rem; color:#1e40af;">
          📅 Date: ${state.depDate} &nbsp;|&nbsp; 💺 Seat: ${state.selectedSeat} (${state.selectedCabin})
        </p>
      </div>

      <div class="fare-breakdown">
        <div class="fare-row">
          <span>Flight Fare (${state.selectedCabin})</span>
          <span>$${baseFare}</span>
        </div>
        <div class="fare-row">
          <span>Airport Taxes & Security</span>
          <span>$${taxes}</span>
        </div>
        ${seatFee > 0 ? `
        <div class="fare-row">
          <span>Premium Seat Surcharge</span>
          <span>$${seatFee}</span>
        </div>` : ''}
        <div class="fare-row total">
          <span>Total Amount</span>
          <span style="color:#1e40af;">$${grandTotal}</span>
        </div>
      </div>
    `;

    checkoutModal.classList.add('active');
  }

  // 8. Handle Passenger Form Submission (Create Booking)
  passengerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = passengerForm.querySelector('.btn-confirm-pay');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = 'Securing Reservation... ⏳';
    submitBtn.disabled = true;

    const payload = {
      flight_id: state.selectedFlight.id,
      travel_date: state.depDate,
      cabin_class: state.selectedCabin,
      seat_number: state.selectedSeat,
      passenger_name: document.getElementById('passName').value.trim(),
      passenger_email: document.getElementById('passEmail').value.trim(),
      passenger_phone: document.getElementById('passPhone').value.trim(),
      passport_num: document.getElementById('passPassport').value.trim()
    };

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;

      if (res.ok) {
        checkoutModal.classList.remove('active');
        state.confirmedBooking = data;
        confirmedPnrText.textContent = data.pnr;
        confirmationModal.classList.add('active');
        passengerForm.reset();
      } else {
        alert(data.error || 'Booking reservation failed. Please select another seat.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error while booking. Please try again.');
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  });

  // Copy PNR Code Button
  copyPnrBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(confirmedPnrText.textContent);
    copyPnrBtn.textContent = '✓ Copied!';
    setTimeout(() => {
      copyPnrBtn.textContent = '📋 Copy PNR';
    }, 2000);
  });

  // Redirect to Boarding Pass / My Bookings View
  viewTicketBtn.addEventListener('click', () => {
    const pnr = confirmedPnrText.textContent;
    window.location.href = `/my-bookings?pnr=${pnr}`;
  });

  // Modal Closures
  closeSeatModalBtn.addEventListener('click', () => seatModal.classList.remove('active'));
  closeCheckoutModalBtn.addEventListener('click', () => checkoutModal.classList.remove('active'));
  closeConfirmationModalBtn.addEventListener('click', () => confirmationModal.classList.remove('active'));

  // Close modals when clicking overlay background
  [seatModal, checkoutModal, confirmationModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  });

  // 9. Search Form Submission
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    state.origin = originSelect.value;
    state.dest = destSelect.value;
    state.depDate = depDateInput.value;
    state.returnDate = returnDateInput.value;
    state.selectedCabin = cabinSelect.value;
    state.passengers = parseInt(passengerSelect.value, 10);
    loadFlights();
  });

  // 10. Sidebar Filters Listeners
  priceSlider.addEventListener('input', (e) => {
    state.maxPrice = parseFloat(e.target.value);
    priceDisplay.textContent = `$${state.maxPrice}`;
  });

  priceSlider.addEventListener('change', () => {
    loadFlights();
  });

  document.querySelectorAll('input[name="stopsFilter"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.stops = e.target.value;
      loadFlights();
    });
  });

  document.querySelectorAll('input[name="airlineFilter"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.airline = e.target.value;
      loadFlights();
    });
  });

  sortSelect.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    loadFlights();
  });

  resetFiltersBtn.addEventListener('click', () => {
    state.maxPrice = 2000;
    priceSlider.value = 2000;
    priceDisplay.textContent = '$2000';
    state.stops = 'all';
    state.airline = 'all';
    state.sortBy = 'price_asc';
    sortSelect.value = 'price_asc';
    document.querySelector('input[name="stopsFilter"][value="all"]').checked = true;
    document.querySelector('input[name="airlineFilter"][value="all"]').checked = true;
    loadFlights();
  });

  // Initial Boot
  loadAirports();
});
