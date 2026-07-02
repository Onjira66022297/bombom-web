import axios from 'axios';

const client = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('bombom_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('bombom_token');
    }
    return Promise.reject(err);
  }
);

export const api = {
  register: (data) => client.post('/auth/register', data).then((r) => r.data),
  login: (data) => client.post('/auth/login', data).then((r) => r.data),
  me: () => client.get('/auth/me').then((r) => r.data),
  listUsers: (status) => client.get('/users', { params: { status } }).then((r) => r.data),
  approveUser: (id) => client.post(`/users/${id}/approve`).then((r) => r.data),
  rejectUser: (id) => client.post(`/users/${id}/reject`).then((r) => r.data),
  listCases: () => client.get('/cases').then((r) => r.data),
  getCase: (id) => client.get(`/cases/${id}`).then((r) => r.data),
  createCase: (data) => client.post('/cases', data).then((r) => r.data),
  analyzeCase: (id, extractedRequirements) =>
    client.patch(`/cases/${id}/analyze`, { extractedRequirements }).then((r) => r.data),
  selectSpecs: (id, eCode) => client.patch(`/cases/${id}/specs`, { eCode }).then((r) => r.data),
  runBomCheck: (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return client
      .post(`/cases/${id}/bom-check`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data);
  },
  listProducts: (params) => client.get('/products', { params }).then((r) => r.data),
  searchEmails: (q) => client.get('/emails/search', { params: { q } }).then((r) => r.data),
};

export default client;
