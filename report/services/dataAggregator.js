const Visit = require('../../backend/models/Visit');
const School = require('../../backend/models/School');
const Team = require('../../backend/models/Team');
const User = require('../../backend/models/User');

/**
 * Data Aggregator Service
 * Fetches and processes data from MongoDB for report generation
 */
class DataAggregator {
    
    /**
     * Build MongoDB query from filters
     * @param {object} filters - Filter configuration
     * @returns {object} - MongoDB query object
     */
    buildQuery(filters) {
        const query = {};

        // Date range filter
        if (filters.dateRange) {
            query.date = {};
            if (filters.dateRange.start) {
                query.date.$gte = new Date(filters.dateRange.start);
            }
            if (filters.dateRange.end) {
                query.date.$lte = new Date(filters.dateRange.end);
            }
        }

        // School filter
        if (filters.schools && filters.schools.length > 0) {
            query.school = { $in: filters.schools };
        }

        // Team filter
        if (filters.teams && filters.teams.length > 0) {
            query.team = { $in: filters.teams };
        }

        // Status filter
        if (filters.status) {
            query.status = filters.status;
        }

        // Volunteer filter
        if (filters.volunteers && filters.volunteers.length > 0) {
            query.volunteers = { $in: filters.volunteers };
        }

        return query;
    }

    /**
     * Get summary statistics
     * @param {object} filters - Filter configuration
     * @returns {Promise<object>} - Summary data
     */
    async getSummaryStats(filters = {}) {
        try {
            const query = this.buildQuery(filters);

            // Total visits
            const totalVisits = await Visit.countDocuments(query);

            // Get all visits with populated data
            const visits = await Visit.find(query)
                .populate('school')
                .populate('team')
                .lean();

            // Unique schools
            const uniqueSchools = new Set(
                visits.map(v => v.school?._id?.toString()).filter(Boolean)
            );

            // Unique teams
            const uniqueTeams = new Set(
                visits.map(v => v.team?._id?.toString()).filter(Boolean)
            );

            // Total students reached
            const totalStudents = visits.reduce((sum, visit) => {
                return sum + (visit.studentsCount || 0);
            }, 0);

            return {
                totalVisits,
                totalSchools: uniqueSchools.size,
                totalTeams: uniqueTeams.size,
                totalStudents
            };
        } catch (error) {
            console.error('❌ Error getting summary stats:', error);
            throw error;
        }
    }

    /**
     * Get detailed visit data
     * @param {object} filters - Filter configuration
     * @returns {Promise<Array>} - Visit records
     */
    async getVisitDetails(filters = {}) {
        try {
            const query = this.buildQuery(filters);

            const visits = await Visit.find(query)
                .populate('school', 'name address contactPerson')
                .populate('team', 'name members')
                .populate('submittedBy', 'name email')
                .sort({ date: -1 })
                .lean();

            return visits;
        } catch (error) {
            console.error('❌ Error getting visit details:', error);
            throw error;
        }
    }

    /**
     * Get school-wise statistics
     * @param {object} filters - Filter configuration
     * @returns {Promise<Array>} - School statistics
     */
    async getSchoolStats(filters = {}) {
        try {
            const query = this.buildQuery(filters);

            const schoolStats = await Visit.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: '$school',
                        visitCount: { $sum: 1 },
                        studentsReached: { $sum: '$studentsCount' }
                    }
                },
                {
                    $lookup: {
                        from: 'schools',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'schoolInfo'
                    }
                },
                { $unwind: '$schoolInfo' },
                {
                    $project: {
                        name: '$schoolInfo.name',
                        location: '$schoolInfo.location',
                        visitCount: 1,
                        studentsReached: 1
                    }
                },
                { $sort: { visitCount: -1 } }
            ]);

            return schoolStats;
        } catch (error) {
            console.error('❌ Error getting school stats:', error);
            throw error;
        }
    }

    /**
     * Get team performance statistics
     * @param {object} filters - Filter configuration
     * @returns {Promise<Array>} - Team statistics
     */
    async getTeamStats(filters = {}) {
        try {
            const query = this.buildQuery(filters);

            const teamStats = await Visit.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: '$team',
                        visitCount: { $sum: 1 },
                        totalStudents: { $sum: '$studentsCount' }
                    }
                },
                {
                    $lookup: {
                        from: 'teams',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'teamInfo'
                    }
                },
                { $unwind: '$teamInfo' },
                {
                    $project: {
                        name: '$teamInfo.name',
                        leader: '$teamInfo.leader',
                        visitCount: 1,
                        totalStudents: 1,
                        memberCount: { $size: { $ifNull: ['$teamInfo.members', []] } }
                    }
                },
                { $sort: { visitCount: -1 } }
            ]);

            return teamStats;
        } catch (error) {
            console.error('❌ Error getting team stats:', error);
            throw error;
        }
    }

    /**
     * Get detailed school information with visits
     * @param {object} filters - Filter configuration
     * @returns {Promise<Array>} - School details with visits
     */
    async getSchoolDetailsWithVisits(filters = {}) {
        try {
            const query = this.buildQuery(filters);
            
            const visits = await Visit.find(query)
                .populate('school')
                .populate('team')
                .sort({ date: -1 })
                .lean();

            // Group by school
            const schoolMap = new Map();
            
            visits.forEach(visit => {
                if (visit.school) {
                    const schoolId = visit.school._id.toString();
                    if (!schoolMap.has(schoolId)) {
                        schoolMap.set(schoolId, {
                            name: visit.school.name,
                            visits: []
                        });
                    }
                    schoolMap.get(schoolId).visits.push({
                        date: visit.date,
                        topics: visit.topics || visit.description || visit.notes || 'General activities',
                        team: visit.team?.name || 'N/A'
                    });
                }
            });

            return Array.from(schoolMap.values());
        } catch (error) {
            console.error('❌ Error getting school details with visits:', error);
            throw error;
        }
    }

    /**
     * Get complete school information
     * @param {object} filters - Filter configuration
     * @returns {Promise<Array>} - Complete school details
     */
    async getSchoolsFullInfo(filters = {}) {
        try {
            const query = this.buildQuery(filters);
            
            // Get unique school IDs from visits
            const visits = await Visit.find(query).distinct('school');
            
            // Fetch full school details
            const schools = await School.find({ _id: { $in: visits } })
                .select('name address location headmaster principalName phone contactNumber')
                .lean();

            return schools;
        } catch (error) {
            console.error('❌ Error getting schools full info:', error);
            throw error;
        }
    }

    /**
     * Get teams with member details
     * @param {object} filters - Filter configuration
     * @returns {Promise<Array>} - Teams with members
     */
    async getTeamsWithMembers(filters = {}) {
        try {
            const query = this.buildQuery(filters);
            
            // Get unique team IDs from visits
            const visits = await Visit.find(query).distinct('team');
            
            // Fetch full team details with members
            const teams = await Team.find({ _id: { $in: visits } })
                .populate('members', 'name email')
                .lean();

            return teams;
        } catch (error) {
            console.error('❌ Error getting teams with members:', error);
            throw error;
        }
    }

    /**
     * Get other activities from visits
     * @param {object} filters - Filter configuration
     * @returns {Promise<Array>} - Other activities
     */
    async getOtherActivities(filters = {}) {
        try {
            const query = this.buildQuery(filters);
            
            const visits = await Visit.find(query)
                .populate('school', 'name')
                .populate('team', 'name')
                .lean();

            // Filter visits that have other activities mentioned
            const activities = visits
                .filter(visit => visit.otherActivities || visit.additionalNotes || visit.extraActivities)
                .map(visit => ({
                    date: visit.date,
                    school: visit.school?.name || 'N/A',
                    team: visit.team?.name || 'N/A',
                    description: visit.otherActivities || visit.additionalNotes || visit.extraActivities
                }));

            return activities;
        } catch (error) {
            console.error('❌ Error getting other activities:', error);
            throw error;
        }
    }

    /**
     * Get aggregated report data
     * @param {object} config - Report configuration with filters and sections
     * @returns {Promise<object>} - Complete report data
     */
    async getReportData(config) {
        try {
            console.log('📊 Aggregating report data...');
            
            const filters = config.filters || {};
            const sections = config.sections || {};
            const data = {};

            // Always get summary stats
            const summaryStats = await this.getSummaryStats(filters);
            Object.assign(data, summaryStats);

            // Get visit details (always needed for the new format)
            data.visits = await this.getVisitDetails(filters);

            // Get school details with topics covered
            data.schoolDetails = await this.getSchoolDetailsWithVisits(filters);

            // Get complete school information
            data.schools = await this.getSchoolsFullInfo(filters);

            // Get teams with members
            data.teams = await this.getTeamsWithMembers(filters);

            // Get other activities
            data.otherActivities = await this.getOtherActivities(filters);

            // Legacy data for backward compatibility
            if (sections.schoolBreakdown) {
                data.schoolStats = await this.getSchoolStats(filters);
            }

            if (sections.teamPerformance) {
                data.teamStats = await this.getTeamStats(filters);
            }

            console.log('✅ Data aggregation complete');
            return data;

        } catch (error) {
            console.error('❌ Error aggregating report data:', error);
            throw error;
        }
    }

    /**
     * Get available filters (for UI)
     * @returns {Promise<object>} - Available filter options
     */
    async getAvailableFilters() {
        try {
            const [schools, teams, statuses] = await Promise.all([
                School.find({}, 'name').lean(),
                Team.find({}, 'name').lean(),
                Visit.distinct('status')
            ]);

            return {
                schools: schools.map(s => ({ id: s._id, name: s.name })),
                teams: teams.map(t => ({ id: t._id, name: t.name })),
                statuses: statuses
            };
        } catch (error) {
            console.error('❌ Error getting available filters:', error);
            throw error;
        }
    }
}

// Export singleton instance
module.exports = new DataAggregator();
