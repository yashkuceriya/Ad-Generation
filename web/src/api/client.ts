import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      error.message = 'Request timed out — the server may be busy processing';
    } else if (!error.response) {
      error.message = 'Cannot reach server — make sure the backend is running';
    }
    return Promise.reject(error);
  },
);

export default api;
