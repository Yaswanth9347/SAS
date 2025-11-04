const puppeteer = require('puppeteer');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs').promises;

/**
 * Main Report Generator Service
 * Converts EJS templates with data into PDF documents
 */
class ReportGenerator {
    constructor() {
        this.templatePath = path.join(__dirname, '../templates');
        this.browser = null;
    }

    /**
     * Initialize Puppeteer browser instance
     */
    async initBrowser() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--disable-software-rasterizer',
                    '--disable-dev-tools',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-extensions'
                ],
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 
                               (process.env.NODE_ENV === 'production' 
                                 ? '/usr/bin/chromium-browser' 
                                 : undefined)
            });
            console.log('✅ Browser launched successfully');
        }
        return this.browser;
    }

    /**
     * Close browser instance
     */
    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    /**
     * Render EJS template with data
     * @param {string} templateName - Name of the template file (without .ejs)
     * @param {object} data - Data to inject into template
     * @returns {Promise<string>} - Rendered HTML string
     */
    async renderTemplate(templateName, data) {
        try {
            const templateFile = path.join(this.templatePath, `${templateName}.ejs`);
            const html = await ejs.renderFile(templateFile, data, {
                async: true
            });
            return html;
        } catch (error) {
            console.error('❌ Template rendering error:', error);
            throw new Error(`Failed to render template: ${error.message}`);
        }
    }

    /**
     * Generate PDF from HTML content
     * @param {string} html - HTML content to convert
     * @param {object} options - PDF generation options
     * @returns {Promise<Buffer>} - PDF buffer
     */
    async generatePDF(html, options = {}) {
        let page;
        try {
            const browser = await this.initBrowser();
            page = await browser.newPage();

            // Set content and wait for any dynamic content
            await page.setContent(html, {
                waitUntil: ['networkidle0', 'domcontentloaded'],
                timeout: 30000
            });

            // Default PDF options
            const pdfOptions = {
                format: options.format || 'A4',
                printBackground: true,
                margin: {
                    top: options.marginTop || '10mm',
                    right: options.marginRight || '10mm',
                    bottom: options.marginBottom || '10mm',
                    left: options.marginLeft || '10mm'
                },
                ...options
            };

            // Generate PDF
            const pdf = await page.pdf(pdfOptions);
            
            await page.close();
            
            return pdf;
        } catch (error) {
            if (page) await page.close();
            console.error('❌ PDF generation error:', error);
            throw new Error(`Failed to generate PDF: ${error.message}`);
        }
    }

    /**
     * Main function to generate complete report
     * @param {object} config - Report configuration
     * @returns {Promise<Buffer>} - PDF buffer
     */
    async generateReport(config) {
        try {
            console.log('📄 Starting report generation...');
            console.log('📋 Config:', JSON.stringify(config, null, 2));

            // Prepare data for templates
            const templateData = {
                title: config.title || 'SAS Report',
                subtitle: config.subtitle || 'Student Activity Service',
                generatedDate: new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                dateRange: config.dateRange || null,
                sections: config.sections || {},
                customSections: config.customSections || [],
                notes: config.notes || '',
                data: config.data || {}
            };

            // Render content template
            console.log('🔄 Rendering content template...');
            const contentTemplate = config.template || 'visit-summary';
            const content = await this.renderTemplate(contentTemplate, templateData);

            // Render base template with content
            console.log('🔄 Rendering base template...');
            const fullHtml = await this.renderTemplate('base-template', {
                ...templateData,
                content: content
            });

            // Generate PDF
            console.log('🔄 Generating PDF...');
            const pdf = await this.generatePDF(fullHtml, config.pdfOptions || {});

            console.log('✅ Report generated successfully!');
            return pdf;

        } catch (error) {
            console.error('❌ Report generation failed:', error);
            throw error;
        }
    }

    /**
     * Generate and save report to file
     * @param {object} config - Report configuration
     * @param {string} outputPath - Path to save PDF
     * @returns {Promise<string>} - Path to saved file
     */
    async generateAndSave(config, outputPath) {
        try {
            const pdf = await this.generateReport(config);
            await fs.writeFile(outputPath, pdf);
            console.log(`✅ Report saved to: ${outputPath}`);
            return outputPath;
        } catch (error) {
            console.error('❌ Failed to save report:', error);
            throw error;
        }
    }

    /**
     * Validate report configuration
     * @param {object} config - Report configuration
     * @returns {object} - Validation result
     */
    validateConfig(config) {
        const errors = [];

        if (!config) {
            errors.push('Configuration object is required');
            return { valid: false, errors };
        }

        if (!config.title) {
            errors.push('Report title is required');
        }

        // Issue 4: Validate template name
        const validTemplates = ['visit-summary', 'executive', 'detailed'];
        if (!config.template) {
            errors.push('Template name is required');
        } else if (!validTemplates.includes(config.template)) {
            errors.push(`Invalid template name '${config.template}'. Must be one of: ${validTemplates.join(', ')}`);
        }

        if (!config.dateRange) {
            errors.push('Date range is required');
        } else {
            if (!config.dateRange.start) {
                errors.push('Start date is required');
            }
            if (!config.dateRange.end) {
                errors.push('End date is required');
            }
            if (config.dateRange.start && config.dateRange.end) {
                if (new Date(config.dateRange.start) > new Date(config.dateRange.end)) {
                    errors.push('Start date must be before or equal to end date');
                }
            }
        }

        // Issue 3: Validate sections object
        if (!config.sections || typeof config.sections !== 'object') {
            errors.push('Sections configuration is required and must be an object');
        } else {
            // Check if sections is empty or all sections are disabled
            const enabledSections = Object.values(config.sections).filter(val => val === true);
            if (enabledSections.length === 0) {
                errors.push('At least one report section must be enabled. All sections are currently disabled.');
            }

            // Validate section property names
            const validSectionNames = ['summary', 'visitDetails', 'topicsCovered', 'schoolInfo', 'teamInfo', 'otherActivities'];
            const invalidSections = Object.keys(config.sections).filter(key => !validSectionNames.includes(key));
            if (invalidSections.length > 0) {
                errors.push(`Invalid section names found: ${invalidSections.join(', ')}. Valid sections are: ${validSectionNames.join(', ')}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
}

// Export singleton instance
module.exports = new ReportGenerator();
