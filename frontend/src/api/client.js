import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export const getTasks = () => api.get('/tasks').then(r => r.data);

export const updateTask = (id, updates) =>
  api.patch(`/tasks/${id}`, updates).then(r => r.data);

export const addDependency = (taskId, prerequisiteId) =>
  api.post('/dependencies', { taskId, prerequisiteId }).then(r => r.data);

export default api;