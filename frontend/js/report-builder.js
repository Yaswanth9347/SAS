/**
 * Report Builder JavaScript
 * Handles user interactions and PDF generation
 */

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5001'
    : '';

class ReportBuilder {
    constructor() {
        this.selectedTemplate = 'visit-summary';
        this.init();
    }

    /**
     * Initialize the report builder
     */
    async init() {
        console.log('📄 Initializing Report Builder...');
        
        // Check authentication
        if (!authManager.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        // Setup event listeners
        this.setupEventListeners();

        // Load available filters
        await this.loadFilters();

        // Set default date range (last 30 days)
        this.setDefaultDateRange();

        console.log('✅ Report Builder initialized');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Template selection
        document.querySelectorAll('.template-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedTemplate = card.dataset.template;
                console.log('📋 Template selected:', this.selectedTemplate);
            });
        });

        // Generate button
        document.getElementById('generateBtn').addEventListener('click', () => {
            this.generateReport();
        });

        // Reset button
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetForm();
        });
    }

    /**
     * Load available filter options from API
     */
    async loadFilters() {
        try {
            console.log('🔍 Loading filter options...');

            const response = await fetch(`${API_BASE_URL}/api/reports/filters`, {
                headers: {
                    'Authorization': `Bearer ${authManager.getToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load filters');
            }

            const result = await response.json();
            const filters = result.data;

            // Populate schools dropdown
            const schoolsSelect = document.getElementById('filterSchools');
            schoolsSelect.innerHTML = filters.schools.length > 0
                ? filters.schools.map(s => `<option value="${s.id}">${s.name}</option>`).join('')
                : '<option value="">No schools available</option>';

            // Populate teams dropdown
            const teamsSelect = document.getElementById('filterTeams');
            teamsSelect.innerHTML = filters.teams.length > 0
                ? filters.teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('')
                : '<option value="">No teams available</option>';

            console.log('✅ Filters loaded successfully');

        } catch (error) {
            console.error('❌ Error loading filters:', error);
            this.showNotification('Failed to load filter options', 'error');
        }
    }

    /**
     * Set default date range (last 30 days)
     */
    setDefaultDateRange() {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        document.getElementById('dateEnd').valueAsDate = endDate;
        document.getElementById('dateStart').valueAsDate = startDate;
    }

    /**
     * Build report configuration from form
     */
    buildConfig() {
        // Get selected schools
        const schoolsSelect = document.getElementById('filterSchools');
        const selectedSchools = Array.from(schoolsSelect.selectedOptions).map(opt => opt.value);

        // Get selected teams
        const teamsSelect = document.getElementById('filterTeams');
        const selectedTeams = Array.from(teamsSelect.selectedOptions).map(opt => opt.value);

        // Build config object
        const config = {
            title: document.getElementById('reportTitle').value || 'SAS Report',
            subtitle: document.getElementById('reportSubtitle').value || '',
            template: this.selectedTemplate,
            sections: {
                summary: document.getElementById('section-summary').checked,
                visitDetails: document.getElementById('section-visits').checked,
                schoolBreakdown: document.getElementById('section-schools').checked,
                teamPerformance: document.getElementById('section-teams').checked
            },
            filters: {
                dateRange: {
                    start: document.getElementById('dateStart').value || null,
                    end: document.getElementById('dateEnd').value || null
                },
                schools: selectedSchools.length > 0 ? selectedSchools : undefined,
                teams: selectedTeams.length > 0 ? selectedTeams : undefined,
                status: document.getElementById('filterStatus').value || undefined
            },
            notes: document.getElementById('reportNotes').value || ''
        };

        return config;
    }

    /**
     * Generate PDF report
     */
    async generateReport() {
        try {
            console.log('🔄 Starting report generation...');

            // Build configuration
            const config = this.buildConfig();
            console.log('📋 Report config:', config);

            // Validate
            if (!config.title) {
                this.showNotification('Please enter a report title', 'error');
                return;
            }

            // Show loading
            this.showLoading(true);
            document.getElementById('generateBtn').disabled = true;

            // Make API request
            const response = await fetch(`${API_BASE_URL}/api/reports/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authManager.getToken()}`
                },
                body: JSON.stringify(config)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to generate report');
            }

            // Get PDF blob
            const blob = await response.blob();
            
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${config.title.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            console.log('✅ Report generated successfully!');
            this.showNotification('Report generated and downloaded successfully!', 'success');

        } catch (error) {
            console.error('❌ Report generation error:', error);
            this.showNotification(`Error: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
            document.getElementById('generateBtn').disabled = false;
        }
    }

    /**
     * Reset form to defaults
     */
    resetForm() {
        document.getElementById('reportTitle').value = 'SAS Activity Report';
        document.getElementById('reportSubtitle').value = 'Student Activity Service';
        document.getElementById('reportNotes').value = '';
        
        // Reset sections
        document.getElementById('section-summary').checked = true;
        document.getElementById('section-visits').checked = true;
        document.getElementById('section-schools').checked = true;
        document.getElementById('section-teams').checked = true;

        // Reset filters
        document.getElementById('filterSchools').selectedIndex = -1;
        document.getElementById('filterTeams').selectedIndex = -1;
        document.getElementById('filterStatus').value = '';

        // Reset date range
        this.setDefaultDateRange();

        // Reset template
        document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
        document.querySelector('[data-template="visit-summary"]').classList.add('selected');
        this.selectedTemplate = 'visit-summary';

        this.showNotification('Form reset to defaults', 'info');
    }

    /**
     * Show/hide loading indicator
     */
    showLoading(show) {
        const loader = document.getElementById('loadingIndicator');
        if (show) {
            loader.classList.add('active');
        } else {
            loader.classList.remove('active');
        }
    }

    /**
     * Show notification message
     */
    showNotification(message, type = 'info') {
        // You can implement a toast notification system here
        // For now, using alert
        if (type === 'error') {
            alert('❌ ' + message);
        } else if (type === 'success') {
            alert('✅ ' + message);
        } else {
            alert('ℹ️ ' + message);
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ReportBuilder();
});
