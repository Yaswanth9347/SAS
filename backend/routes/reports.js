const express = require('express');
const router = express.Router();
const reportGenerator = require('../../report/services/reportGenerator');
const dataAggregator = require('../../report/services/dataAggregator');
const { protect, adminOnly } = require('../middleware/auth');

/**
 * @route   POST /api/reports/generate
 * @desc    Generate a PDF report based on configuration
 * @access  Private (Admin only)
 */
router.post('/generate', protect, adminOnly, async (req, res) => {
    try {
        console.log('📄 Report generation request received');
        
        const config = req.body;

        // Validate configuration
        const validation = reportGenerator.validateConfig(config);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid report configuration',
                errors: validation.errors
            });
        }

        // Fetch data based on filters
        console.log('📊 Fetching report data...');
        const reportData = await dataAggregator.getReportData(config);

        // Merge data into config
        config.data = reportData;

        // Generate PDF
        console.log('🔄 Generating PDF...');
        const pdf = await reportGenerator.generateReport(config);

        // Set response headers for PDF download
        const filename = `${config.title.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdf.length);

        // Send PDF
        res.send(pdf);
        
        console.log(`✅ Report sent successfully: ${filename}`);

    } catch (error) {
        console.error('❌ Report generation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate report',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/reports/preview
 * @desc    Generate a preview (first page) of the report
 * @access  Private (Admin only)
 */
router.post('/preview', protect, adminOnly, async (req, res) => {
    try {
        console.log('👁️ Report preview request received');
        
        const config = req.body;

        // Limit data for preview (faster generation)
        if (config.sections) {
            if (config.sections.visitDetails) {
                config.filters = { ...config.filters, limit: 10 };
            }
        }

        // Fetch limited data
        const reportData = await dataAggregator.getReportData(config);
        config.data = reportData;

        // Generate PDF with single page option
        const pdfOptions = {
            ...config.pdfOptions,
            pageRanges: '1' // Only first page
        };
        config.pdfOptions = pdfOptions;

        const pdf = await reportGenerator.generateReport(config);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
        res.send(pdf);

        console.log('✅ Preview sent successfully');

    } catch (error) {
        console.error('❌ Preview generation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate preview',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/reports/filters
 * @desc    Get available filter options for report generation
 * @access  Private (Admin only)
 */
router.get('/filters', protect, adminOnly, async (req, res) => {
    try {
        console.log('🔍 Fetching available filters...');
        
        const filters = await dataAggregator.getAvailableFilters();

        res.json({
            success: true,
            data: filters
        });

        console.log('✅ Filters sent successfully');

    } catch (error) {
        console.error('❌ Error fetching filters:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch filters',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/reports/data
 * @desc    Get report data without generating PDF (for custom processing)
 * @access  Private (Admin only)
 */
router.post('/data', protect, adminOnly, async (req, res) => {
    try {
        console.log('📊 Report data request received');
        
        const config = req.body;
        const reportData = await dataAggregator.getReportData(config);

        res.json({
            success: true,
            data: reportData
        });

        console.log('✅ Report data sent successfully');

    } catch (error) {
        console.error('❌ Error fetching report data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch report data',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/reports/templates
 * @desc    Get available report templates
 * @access  Private (Admin only)
 */
router.get('/templates', protect, adminOnly, (req, res) => {
    const templates = [
        {
            id: 'visit-summary',
            name: 'Visit Summary Report',
            description: 'Comprehensive overview of visits with statistics',
            sections: ['summary', 'visitDetails', 'schoolBreakdown', 'teamPerformance']
        },
        {
            id: 'executive-summary',
            name: 'Executive Summary',
            description: 'High-level summary for leadership',
            sections: ['summary', 'schoolBreakdown']
        },
        {
            id: 'detailed-report',
            name: 'Detailed Report',
            description: 'Complete detailed report with all information',
            sections: ['summary', 'visitDetails', 'schoolBreakdown', 'teamPerformance']
        }
    ];

    res.json({
        success: true,
        data: templates
    });
});

// Cleanup browser instance on server shutdown
process.on('SIGINT', async () => {
    console.log('🧹 Cleaning up report generator...');
    await reportGenerator.closeBrowser();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🧹 Cleaning up report generator...');
    await reportGenerator.closeBrowser();
    process.exit(0);
});

module.exports = router;
