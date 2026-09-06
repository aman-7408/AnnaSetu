// Centralized API Base URL configuration
// In development: fallback to '' (uses Vite proxy /api -> localhost:5000)
// In production: uses VITE_API_BASE_URL (e.g., https://annasetu-backend.onrender.com)
export const API_ROOT = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export const API_BASE = API_ROOT;
export const API_FARMERS = `${API_ROOT}/api/farmers`;
export const API_CAPACITY = `${API_ROOT}/api/capacity`;
export const API_BOOKINGS = `${API_ROOT}/api/bookings`;
export const API_BOOKING = `${API_ROOT}/api/booking`;
export const API_PAYMENTS = `${API_ROOT}/api/payments`;
export const API_NOTIFICATIONS = `${API_ROOT}/api/notifications`;
