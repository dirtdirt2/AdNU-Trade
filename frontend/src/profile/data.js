import { apiUrl } from "../api.js";
// Helpers shared by the profile and navigation components. Account data is
// fetched from the authenticated API; the token is only a session fallback.
export const readTokenPayload = () => {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return null;
    let b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    b64 += '='.repeat((4 - (b64.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

export const toProfileView = (user = {}) => {
  const fullName = String(user.fullName || '').trim();
  const names = fullName.split(/\s+/).filter(Boolean);
  return {
    id: user.id || '',
    fullName,
    first: names[0] || '',
    last: names.slice(1).join(' '),
    studentId: user.idNumber || '',
    email: user.email || '',
    role: user.role || 'student',
    isVerified: Boolean(user.isVerified),
    createdAt: user.createdAt || null,
  };
};

const getStoredUser = () => {
  const payload = readTokenPayload() || {};
  return toProfileView({
    id: payload.userId || payload.id,
    fullName: payload.fullName || payload.name,
    idNumber: payload.idNumber || payload.studentId,
    email: payload.email,
    role: payload.role,
    isVerified: payload.isVerified,
  });
};

export const profileStore = getStoredUser();
export const refreshProfileStore = () => Object.assign(profileStore, getStoredUser());
export const setProfileStoreFromUser = (user) => Object.assign(profileStore, toProfileView(user));

export const maskId = (id) => {
  if (!id) return 'Not provided';
  const strId = String(id);
  if (strId.length <= 4) return strId;
  return `${strId.slice(0, 4)}${'•'.repeat(Math.max(strId.length - 6, 2))}${strId.slice(-2)}`;
};

export const roleLabel = (role) => ({
  student: 'Student',
  teacher: 'Faculty',
  staff: 'Staff',
  admin: 'Administrator',
}[role] || 'AdNU Account');

export const apiRequest = async (path, options = {}) => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const headers = { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(apiUrl(path), { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
};
