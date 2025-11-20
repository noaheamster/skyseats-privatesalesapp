import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Calendar,
  MapPin,
  Ticket,
  Send,
  Settings,
  CheckCircle,
  X,
  Loader2,
  Music,
  Info,
  Copy,
  Smartphone,
  ChevronRight,
  User,
  Map, // Added Map icon
} from "lucide-react";

// --- CONFIGURATION (HARDCODED) ---
// REPLACE THESE VALUES BEFORE SHARING WITH CLIENTS
const API_KEY = "t7jFHAVzoSBp577f4jnd53lA9Yu0vXrj"; // e.g., 'xYz123AbC...'
const RESELLER_PHONE = "17734145264"; // e.g., '12125551234'

// --- Components ---

const Button = ({
  children,
  onClick,
  variant = "primary",
  className = "",
  disabled = false,
  icon: Icon,
}) => {
  const baseStyle =
    "flex items-center justify-center px-4 py-3 rounded-xl font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary:
      "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50",
    secondary:
      "bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700",
    outline:
      "border-2 border-indigo-500 text-indigo-400 hover:bg-indigo-500/10",
    ghost: "text-gray-400 hover:text-white hover:bg-white/5",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${className}`}
    >
      {Icon && <Icon className="w-5 h-5 mr-2" />}
      {children}
    </button>
  );
};

const Input = ({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-400 mb-1.5 ml-1">
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
    />
  </div>
);

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- Main Application ---

export default function TicketConciergeApp() {
  // State: Search & Data
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState([]);
  const [suggestions, setSuggestions] = useState([]);

  // State: Loading indicators
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError] = useState(null);

  // State: Suggestions Dropdown
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef(null);

  // State: Selection & Request
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showSeatMap, setShowSeatMap] = useState(false);
  const [requestDetails, setRequestDetails] = useState({
    quantity: "2",
    section: "Best Available",
    budget: "",
    notes: "",
  });

  // Helper: Get Dynamic Section Options based on Classification
  const getSectionOptions = useCallback((event) => {
    if (!event) return ["Best Available"];

    const segment =
      event?.classifications?.[0]?.segment?.name?.toLowerCase() || "";
    const genre = event?.classifications?.[0]?.genre?.name?.toLowerCase() || "";
    const subGenre =
      event?.classifications?.[0]?.subGenre?.name?.toLowerCase() || "";

    // 1. Racing / Motorsports (F1, NASCAR, etc.)
    if (
      genre.includes("motorsports") ||
      genre.includes("racing") ||
      subGenre.includes("auto")
    ) {
      return [
        "Any / Best Available",
        "Paddock Club / VIP Hospitality",
        "Main Grandstand (Start/Finish)",
        "Turn / Corner Grandstand",
        "General Admission (GA)",
        "Team Garage / Suite",
        "Specific Section (See Notes)",
      ];
    }

    // 2. Concerts
    if (segment.includes("music")) {
      return [
        "Any / Best Available",
        "Floor / GA Pit",
        "Lower Bowl (100 Level)",
        "Club Level / VIP",
        "Upper Bowl (300+ Level)",
        "Aisle Seats Only",
        "Specific Section (See Notes)",
      ];
    }

    // 3. Default (Standard Sports - NBA, NFL, MLB, etc.)
    return [
      "Any / Best Available",
      "Floor / Field / Courtside",
      "Lower Bowl (100 Level)",
      "Club Level / Mezzanine",
      "Upper Bowl (300+ Level)",
      "Aisle Seats Only",
      "Specific Section (See Notes)",
    ];
  }, []);

  // Reset Map & Options when event changes
  useEffect(() => {
    if (selectedEvent) {
      setShowSeatMap(false);

      // If map exists, clear the input so they can type specifically.
      // If no map, default to "Best Available" dropdown selection.
      const hasMap = !!selectedEvent.seatmap?.staticUrl;

      setRequestDetails((prev) => ({
        ...prev,
        section: hasMap ? "" : "Best Available",
      }));
    }
  }, [selectedEvent]);

  // Handle clicking outside suggestions to close them
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- 1. Fetch Suggestions (Attractions & Venues) ---
  const fetchSuggestions = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    if (API_KEY === "YOUR_TICKETMASTER_API_KEY") return;

    try {
      const attUrl = `https://app.ticketmaster.com/discovery/v2/attractions.json?apikey=${API_KEY}&keyword=${encodeURIComponent(
        searchQuery
      )}&size=4&sort=name,asc`;
      const venUrl = `https://app.ticketmaster.com/discovery/v2/venues.json?apikey=${API_KEY}&keyword=${encodeURIComponent(
        searchQuery
      )}&size=3&sort=name,asc`;

      const [attRes, venRes] = await Promise.all([
        fetch(attUrl),
        fetch(venUrl),
      ]);
      const attData = await attRes.json();
      const venData = await venRes.json();

      let combined = [];

      if (attData._embedded?.attractions) {
        combined = [
          ...combined,
          ...attData._embedded.attractions.map((a) => ({
            ...a,
            type: "artist",
          })),
        ];
      }

      if (venData._embedded?.venues) {
        combined = [
          ...combined,
          ...venData._embedded.venues.map((v) => ({ ...v, type: "venue" })),
        ];
      }

      setSuggestions(combined);
      if (combined.length > 0) setShowSuggestions(true);
    } catch (err) {
      console.error("Suggestion error", err);
    }
  }, []);

  // --- 2. Fetch Events (The actual schedule) ---
  const fetchEvents = useCallback(
    async ({ keyword, attractionId, venueId }) => {
      if (API_KEY === "YOUR_TICKETMASTER_API_KEY") {
        setError("System Error: API Key not configured.");
        return;
      }

      setLoadingEvents(true);
      setError(null);
      setEvents([]);
      setShowSuggestions(false);

      try {
        const currentDateTime = new Date().toISOString().split(".")[0] + "Z";
        let url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${API_KEY}&size=50&sort=date,asc&startDateTime=${currentDateTime}`;

        if (attractionId) url += `&attractionId=${attractionId}`;
        if (venueId) url += `&venueId=${venueId}`;
        if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data._embedded && data._embedded.events) {
          const validEvents = data._embedded.events.filter((event) => {
            const name = event.name ? event.name.toLowerCase() : "";

            const isParking =
              name.includes("parking") ||
              name.includes("shuttle") ||
              name.includes("valet");
            const isPackage =
              name.includes("package") ||
              name.includes("vip club") ||
              name.includes("upgrade");
            const isTest =
              name.includes("test event") || name.includes("tm internal");
            const hasVenue =
              event._embedded?.venues && event._embedded.venues.length > 0;
            const hasGoodImage =
              event.images && event.images.some((img) => img.width > 600);

            return (
              !isParking && !isPackage && !isTest && hasVenue && hasGoodImage
            );
          });

          if (validEvents.length > 0) {
            setEvents(validEvents);
          } else {
            setError("No events found matching those filters.");
          }
        } else {
          setError("No upcoming events found.");
        }
      } catch (err) {
        console.error(err);
        setError("Connection error.");
      } finally {
        setLoadingEvents(false);
      }
    },
    []
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        fetchSuggestions(query);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, fetchSuggestions]);

  const handleSuggestionClick = (item) => {
    setQuery(item.name);
    if (item.type === "artist") {
      fetchEvents({ attractionId: item.id });
    } else {
      fetchEvents({ venueId: item.id });
    }
  };

  const handleManualSearch = (e) => {
    e.preventDefault();
    fetchEvents({ keyword: query });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "TBD";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getVenueLocation = (event) => {
    const venue = event._embedded?.venues?.[0];
    if (!venue) return "Venue TBD";
    const parts = [];
    if (venue.name) parts.push(venue.name);
    if (venue.city?.name) parts.push(venue.city.name);
    return parts.join(", ") || "Venue TBD";
  };

  const generateMessage = () => {
    if (!selectedEvent) return "";

    const venueLocation = getVenueLocation(selectedEvent);
    const date = formatDate(selectedEvent.dates?.start?.dateTime);

    // --- NEW CLEANER MESSAGE FORMAT ---
    return `Hey! Looking for tickets to:
${selectedEvent.name}

📅 ${date}
📍 ${venueLocation}

Request Details:
🎟️ Qty: ${requestDetails.quantity}
💺 Section: ${requestDetails.section || "Any"}
💰 Budget: ${requestDetails.budget ? "$" + requestDetails.budget : "Open"}
📝 Notes: ${requestDetails.notes || "None"}

Let me know what you have!`;
  };

  const handleSendSMS = () => {
    const message = generateMessage();
    const encodedMessage = encodeURIComponent(message);

    if (navigator.share && /mobile/i.test(navigator.userAgent)) {
      navigator
        .share({
          title: "Ticket Request",
          text: message,
        })
        .catch((err) => {
          window.location.href = `sms:${RESELLER_PHONE}${
            navigator.userAgent.match(/iPhone|iPad/i) ? "&" : "?"
          }body=${encodedMessage}`;
        });
    } else {
      window.location.href = `sms:${RESELLER_PHONE}${
        navigator.userAgent.match(/iPhone|iPad/i) ? "&" : "?"
      }body=${encodedMessage}`;
    }
  };

  // Seatmap URL extraction
  const seatmapUrl = selectedEvent?.seatmap?.staticUrl;

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Ticket className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              VIP Concierge
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24">
        {/* Search Area with Suggestions */}
        <div className="mb-8 relative" ref={searchContainerRef}>
          <form onSubmit={handleManualSearch} className="relative z-20 group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-200"></div>
            <div className="relative flex bg-gray-900 rounded-2xl shadow-xl overflow-hidden border border-gray-800">
              <input
                type="text"
                value={query}
                onFocus={() =>
                  suggestions.length > 0 && setShowSuggestions(true)
                }
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Artist or Venue (e.g. 'Sphere')..."
                className="flex-1 px-6 py-4 bg-transparent text-white placeholder-gray-500 focus:outline-none text-lg"
              />
              <button
                type="submit"
                className="px-6 flex items-center justify-center bg-gray-800/50 text-indigo-400 border-l border-gray-800 hover:bg-gray-800 transition-colors"
              >
                {loadingEvents ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <Search className="w-6 h-6" />
                )}
              </button>
            </div>
          </form>

          {/* Autocomplete Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-30 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-900/95 sticky top-0 backdrop-blur-sm border-b border-gray-800">
                  Suggestions
                </div>
                {suggestions.map((item) => {
                  const thumb =
                    item.images?.find(
                      (img) => img.ratio === "16_9" && img.width < 400
                    ) || item.images?.[0];
                  const isArtist = item.type === "artist";

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSuggestionClick(item)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-800 flex items-center gap-4 transition-colors border-b border-gray-800/50 last:border-0 group"
                    >
                      <div
                        className={`w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 relative flex items-center justify-center ${
                          thumb ? "bg-gray-800" : "bg-gray-800/50"
                        }`}
                      >
                        {thumb ? (
                          <img
                            src={thumb.url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : isArtist ? (
                          <User className="w-5 h-5 text-gray-500" />
                        ) : (
                          <MapPin className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white truncate group-hover:text-indigo-400 transition-colors">
                          {item.name}
                        </div>
                        <div className="text-xs text-gray-400 uppercase tracking-wider font-medium flex items-center">
                          {isArtist ? "Performer" : "Venue"}
                          {item.city?.name && (
                            <span className="ml-1 text-gray-500">
                              • {item.city.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-indigo-400" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && typeof error === "string" && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center animate-in fade-in">
              {error}
            </div>
          )}
        </div>

        {/* Empty State / Welcome */}
        {!loadingEvents && events.length === 0 && !error && (
          <div className="text-center py-12 text-gray-600">
            <Music className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg">Find Your Event</p>
            <p className="text-sm opacity-60">
              Search for an Artist or Venue above to see their schedule.
            </p>
          </div>
        )}

        {/* Main Grid Results */}
        <div className="space-y-4">
          {events.map((event) => {
            const image =
              event.images?.find(
                (img) => img.ratio === "16_9" && img.width > 600
              ) || event.images?.find((img) => img.width > 600);

            return (
              <div
                key={event.id}
                onClick={() => setSelectedEvent(event)}
                className="group bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-indigo-500/50 transition-all cursor-pointer relative shadow-lg hover:shadow-indigo-500/10 animate-in fade-in slide-in-from-bottom-4 duration-500"
              >
                <div className="h-36 bg-gray-800 relative overflow-hidden">
                  {image && (
                    <img
                      src={image.url}
                      alt={event.name}
                      className="w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent"></div>

                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="flex items-end justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-white leading-tight mb-1 shadow-black drop-shadow-md">
                          {event.name}
                        </h3>
                        <div className="flex items-center text-indigo-300 text-xs font-medium uppercase tracking-wider">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(event.dates?.start?.dateTime)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3 flex items-center justify-between text-sm text-gray-400 bg-gray-900 border-t border-gray-800/50">
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-2 text-gray-500" />
                    {getVenueLocation(event)}
                  </div>
                  <div className="text-indigo-500 group-hover:translate-x-1 transition-transform">
                    Request &rarr;
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Request Modal */}
      <Modal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title="Ticket Request"
      >
        {selectedEvent && (
          <div className="space-y-6">
            {/* Event Summary */}
            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
              <h4 className="font-bold text-white mb-1">
                {selectedEvent.name}
              </h4>
              <p className="text-sm text-gray-400">
                {formatDate(selectedEvent.dates?.start?.dateTime)} •{" "}
                {selectedEvent._embedded?.venues?.[0]?.name}
              </p>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Quantity"
                  type="number"
                  value={requestDetails.quantity}
                  onChange={(val) =>
                    setRequestDetails({ ...requestDetails, quantity: val })
                  }
                  placeholder="e.g. 2"
                />
                <Input
                  label="Budget per Tix"
                  value={requestDetails.budget}
                  onChange={(val) =>
                    setRequestDetails({ ...requestDetails, budget: val })
                  }
                  placeholder="Max price?"
                />
              </div>

              {/* Section Selection with Map Toggle */}
              <div className="space-y-2">
                <div className="flex justify-between items-end px-1">
                  <label className="block text-sm font-medium text-gray-400">
                    Preferred Section(s)
                  </label>
                  {seatmapUrl && (
                    <button
                      onClick={() => setShowSeatMap(!showSeatMap)}
                      className="text-xs font-semibold text-indigo-400 flex items-center hover:text-indigo-300 transition-colors bg-indigo-500/10 px-2 py-1 rounded-lg"
                    >
                      <Map className="w-3 h-3 mr-1.5" />
                      {showSeatMap ? "Hide Map" : "View Seat Map"}
                    </button>
                  )}
                </div>

                {/* Inline Seat Map Viewer */}
                {showSeatMap && seatmapUrl && (
                  <div className="p-2 bg-white rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <img
                      src={seatmapUrl}
                      alt="Venue Seat Map"
                      className="w-full h-auto rounded-lg border border-gray-200"
                    />
                    <p className="text-xs text-center text-gray-500 mt-1">
                      Static seat map provided by Ticketmaster
                    </p>
                  </div>
                )}

                {/* Conditional Input: Text if Map exists, Dropdown if not */}
                {seatmapUrl ? (
                  <input
                    type="text"
                    value={requestDetails.section}
                    onChange={(e) =>
                      setRequestDetails({
                        ...requestDetails,
                        section: e.target.value,
                      })
                    }
                    placeholder="e.g. Section 112, Row 5 (See Map)"
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                ) : (
                  <div className="relative">
                    <select
                      value={requestDetails.section}
                      onChange={(e) =>
                        setRequestDetails({
                          ...requestDetails,
                          section: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all cursor-pointer"
                    >
                      {getSectionOptions(selectedEvent).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                      <ChevronRight className="w-4 h-4 rotate-90" />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5 ml-1">
                  Special Requests / Notes
                </label>
                <textarea
                  value={requestDetails.notes}
                  onChange={(e) =>
                    setRequestDetails({
                      ...requestDetails,
                      notes: e.target.value,
                    })
                  }
                  placeholder="Specific row preference? VIP? ADA seating? Parking needed?"
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[80px] resize-none"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-3">
              <Button
                onClick={handleSendSMS}
                variant="primary"
                className="w-full"
                icon={Send}
                disabled={!RESELLER_PHONE}
              >
                Send Request
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
