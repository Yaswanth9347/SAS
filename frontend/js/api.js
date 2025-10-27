/**
 * API Utilities
 * Centralized API calls with error handling
 */

class APIManager {
  constructor() {
    this.baseURL = CONFIG.API_BASE_URL;
  }

  /**
   * Generic API request handler
   */
  async request(endpoint, options = {}) {
    try {
      const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
      
      // Build headers properly
      let headers = {};
      
      // Add auth headers first if not explicitly disabled
      if (options.includeAuth !== false) {
        const authHeaders = options.isUpload 
          ? authManager.getAuthHeadersForUpload()
          : authManager.getAuthHeaders();
        headers = { ...headers, ...authHeaders };
      }
      
      // Then merge with any provided headers (allows override)
      if (options.headers) {
        headers = { ...headers, ...options.headers };
      }
      
      const config = {
        ...options,
        headers
      };

      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API Request Error:', error);
      throw error;
    }
  }

  /**
   * GET request
   */
  async get(endpoint, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'GET'
    });
  }

  /**
   * POST request
   */
  async post(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  /**
   * PUT request
   */
  async put(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }

  /**
   * DELETE request
   */
  async delete(endpoint, body = null, options = {}) {
    const config = {
      ...options,
      method: 'DELETE'
    };
    
    if (body) {
      config.body = JSON.stringify(body);
    }
    
    return this.request(endpoint, config);
  }

  /**
   * Upload files (multipart/form-data)
   */
  async upload(endpoint, formData, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: formData,
      isUpload: true
    });
  }

  // ==================== AUTH ENDPOINTS ====================
  
  async login(username, password) {
    return this.post('/auth/login', { username, password }, { includeAuth: false });
  }

  async register(userData) {
    return this.post('/auth/register', userData, { includeAuth: false });
  }
  

  // ==================== VISITS ENDPOINTS ====================
  
  async getVisits(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.get(`/visits?${params}`);
  }

  async getVisit(id) {
    return this.get(`/visits/${id}`);
  }

  async createVisit(visitData) {
    return this.post('/visits', visitData);
  }

  async updateVisit(id, visitData) {
    return this.put(`/visits/${id}`, visitData);
  }

  async deleteVisit(id) {
    return this.delete(`/visits/${id}`);
  }

  async cancelVisit(id) {
    return this.put(`/visits/${id}/cancel`, {});
  }

  async submitVisitReport(id, reportData) {
    return this.post(`/visits/${id}/report`, reportData);
  }

  async getVisitGallery(id) {
    return this.get(`/visits/${id}/gallery`);
  }

  async getAllGalleryMedia(filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    const endpoint = queryParams
      ? `/visits/gallery/all?${queryParams}`
      : "/visits/gallery/all";
    return this.get(endpoint);
  }

  async uploadVisitFiles(visitId, formData) {
    return this.upload(`/visits/${visitId}/upload`, formData);
  }

  // Alias for backward compatibility
  async uploadVisitMedia(visitId, formData) {
    return this.uploadVisitFiles(visitId, formData);
  }

  async deleteVisitMedia(visitId, url) {
    return this.delete(`/visits/${visitId}/media`, { url });
  }

  // ==================== SCHOOLS ENDPOINTS ====================
  
  async getSchools() {
    return this.get('/schools');
  }

  async getSchool(id) {
    return this.get(`/schools/${id}`);
  }

  async createSchool(schoolData) {
    return this.post('/schools', schoolData);
  }

  async updateSchool(id, schoolData) {
    return this.put(`/schools/${id}`, schoolData);
  }

  async deleteSchool(id) {
    return this.delete(`/schools/${id}`);
  }

  // ==================== TEAMS ENDPOINTS ====================
  
  async getTeams() {
    return this.get('/admin/teams');
  }

  async getTeam(id) {
    return this.get(`/admin/teams/${id}`);
  }

  async createTeam(teamData) {
    return this.post('/admin/teams', teamData);
  }

  async deleteTeam(id) {
    return this.delete(`/admin/teams/${id}`);
  }

  // Team member management
  async addTeamMembers(teamId, memberIds) {
    return this.put(`/admin/teams/${teamId}/members/add`, { memberIds });
  }

  async removeTeamMember(teamId, memberId) {
    return this.put(`/admin/teams/${teamId}/members/remove`, { memberId });
  }

  async changeTeamLeader(teamId, leaderId) {
    return this.put(`/admin/teams/${teamId}/leader`, { leaderId });
  }

  async getTeamStats(teamId) {
    return this.get(`/admin/teams/${teamId}/stats`);
  }

  // ==================== ANALYTICS ENDPOINTS ====================
  
  async getAnalyticsOverview() {
    return this.get('/analytics/overview');
  }

  async getVolunteersAnalytics() {
    return this.get('/analytics/volunteers');
  }

  async getSchoolsAnalytics() {
    return this.get('/analytics/schools');
  }

  // ==================== USER PROFILE ENDPOINTS ====================
  
  async getUserProfile() {
    return this.get('/auth/profile');
  }

  async updateUserProfile(profileData) {
    return this.put('/auth/profile', profileData);
  }

  async uploadProfileAvatar(formData) {
    return this.upload('/auth/profile/avatar', formData);
  }

  async changePassword(passwordData) {
    return this.put('/auth/change-password', passwordData);
  }

  async getUserStats() {
    return this.get('/auth/stats');
  }

  // Password reset
  async forgotPassword(email) {
    return this.post('/auth/forgot-password', { email });
  }

  async resetPassword(resetToken, password) {
    return this.put(`/auth/reset-password/${resetToken}`, { password });
  }

  // ==================== ADMIN ENDPOINTS ====================
  
  async getUsers() {
    return this.get('/admin/users');
  }

  async createBulkTeams(teamsData) {
    return this.post('/admin/create-teams', teamsData);
  }

  async cleanupStorage() {
    return this.post('/admin/storage/cleanup');
  }

  // ==================== FEEDBACK ENDPOINTS ====================
  
  async submitFeedback(feedbackData) {
    return this.post('/feedback', feedbackData);
  }

  // ==================== CONTACT ENDPOINTS ====================
  
  // Public - Submit contact form
  async submitContact(contactData) {
    return this.post('/contact', contactData);
  }

  // Admin - Get all contacts
  async getContacts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/contact/admin${query ? '?' + query : ''}`);
  }

  // Admin - Get single contact
  async getContact(id) {
    return this.get(`/contact/admin/${id}`);
  }

  // Admin - Mark contact as read
  async markContactAsRead(id) {
    return this.put(`/contact/admin/${id}/read`);
  }

  // Admin - Reply to contact
  async replyToContact(id, replyMessage) {
    return this.put(`/contact/admin/${id}/reply`, { replyMessage });
  }

  // Admin - Archive contact
  async archiveContact(id) {
    return this.put(`/contact/admin/${id}/archive`);
  }

  // Admin - Delete contact
  async deleteContact(id) {
    return this.delete(`/contact/admin/${id}`);
  }

  // Admin - Get contact statistics
  async getContactStats() {
    return this.get('/contact/admin/stats');
  }

  // Admin - Bulk update contacts
  async bulkUpdateContacts(contactIds, status) {
    return this.put('/contact/admin/bulk-update', { contactIds, status });
  }
}

// Create global API manager instance
const api = new APIManager();
