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
        // Only include auth headers if authManager is available (not on public pages)
        if (typeof authManager !== 'undefined' && authManager) {
          const authHeaders = options.isUpload 
            ? authManager.getAuthHeadersForUpload()
            : authManager.getAuthHeaders();
          headers = { ...headers, ...authHeaders };
        }
      }
      
      // Then merge with any provided headers (allows override)
      if (options.headers) {
        headers = { ...headers, ...options.headers };
      }

      // Ensure JSON content-type for non-upload requests when not explicitly provided
      if (!options.isUpload) {
        const headerKeys = Object.keys(headers).map(k => k.toLowerCase());
        if (!headerKeys.includes('content-type')) {
          headers['Content-Type'] = 'application/json';
        }
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

      // Validate server instance ID if authManager is available and user is authenticated
      if (typeof authManager !== 'undefined' && authManager && authManager.isAuthenticated()) {
        const isValid = authManager.validateServerInstance(data);
        if (!isValid) {
          // Server restarted, user will be logged out by validateServerInstance
          throw new Error('Server restarted. Please log in again.');
        }
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
    // Legacy method (not used by current UI). Backend uses PUT /:id/submit or /:id/complete-report
    return this.put(`/visits/${id}/submit`, reportData);
  }

  async getVisitGallery(id) {
    return this.get(`/visits/${id}/gallery`);
  }

  // Complete visit report (uploads done separately). Matches backend route PUT /api/visits/:id/complete-report
  async completeVisitReport(id, reportData) {
    return this.put(`/visits/${id}/complete-report`, reportData);
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

  // ==================== REPORT (ADMIN) ====================

  async getReportDraft(visitId) {
    return this.get(`/visits/${visitId}/report/draft`);
  }

  async saveReportDraft(visitId, draft) {
    return this.put(`/visits/${visitId}/report/draft`, draft);
  }

  async finalizeReportPdf(visitId) {
    return this.post(`/visits/${visitId}/report/finalize`, {});
  }

  getReportDownloadUrl(visitId) {
    // Use API download endpoint (auth required)
    return `${this.baseURL}/visits/${visitId}/report/download`;
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
    // Use the public endpoint for regular users, admin endpoint for admins
    const endpoint = authManager.isAdmin() ? '/admin/teams' : '/teams';
    return this.get(endpoint);
  }

  async getTeam(id) {
    const endpoint = authManager.isAdmin() ? `/admin/teams/${id}` : `/teams/${id}`;
    return this.get(endpoint);
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

  // User preferences / settings
  async getUserPreferences() {
    return this.get('/auth/preferences');
  }

  async updateUserPreferences(prefs) {
    return this.put('/auth/preferences', prefs);
  }

  // Password reset
  async forgotPassword(email) {
    return this.post('/auth/forgot-password', { email }, { includeAuth: false });
  }

  async resetPassword(resetToken, password) {
    return this.put(`/auth/reset-password/${resetToken}`, { password }, { includeAuth: false });
  }

  // ==================== ADMIN ENDPOINTS ====================
  
  async getUsers() {
    return this.get('/admin/users');
  }

  // Admin - Users management
  async getAdminUsers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/admin/users${query ? '?' + query : ''}`);
  }

  // Admin - Users IDs only (server-assisted select-all)
  async getAdminUserIds(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/admin/users/ids${query ? '?' + query : ''}`);
  }

  async approveUser(userId, notes) {
    return this.put(`/admin/users/${userId}/approve`, { notes });
  }

  async rejectUser(userId, reason) {
    return this.put(`/admin/users/${userId}/reject`, { reason });
  }

  async updateUserRole(userId, role) {
    return this.put(`/admin/users/${userId}/role`, { role });
  }

  async bulkUpdateUsers(payload) {
    // Accept optional fetch options (e.g., signal for AbortController)
    const options = arguments[1] || {};
    return this.put('/admin/users/bulk', payload, options);
  }

  async deleteUser(userId) {
    return this.delete(`/admin/users/${userId}`);
  }

  async bulkDeleteUsers(userIds) {
    // Accept optional fetch options (e.g., signal for AbortController)
    const options = arguments[1] || {};
    return this.delete('/admin/users/bulk', { userIds }, options);
  }

  async getActivityLogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/admin/activity${query ? '?' + query : ''}`);
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

  // ==================== NOTIFICATIONS ====================
  async getNotifications(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.get(`/notifications${q ? '?' + q : ''}`);
  }

  async markNotificationRead(id) {
    return this.put(`/notifications/${id}/read`, {});
  }

  async markNotificationUnread(id) {
    return this.put(`/notifications/${id}/unread`, {});
  }

  async markAllNotificationsRead() {
    return this.put('/notifications/mark-all-read', {});
  }
}

// Create global API manager instance
const api = new APIManager();
