const { validationResult, query, body, param } = require('express-validator');

// Generic validation result handler
function validate(req, res, next) {
	const errors = validationResult(req);
	if (errors.isEmpty()) return next();
	return res.status(400).json({
		success: false,
		error: 'Validation failed',
		details: errors.array().map(e => ({ field: e.path, msg: e.msg }))
	});
}

// Common validators
const paginationValidators = [
	query('page').optional().isInt({ min: 1 }).toInt().withMessage('page must be a positive integer'),
	query('limit').optional().isInt({ min: 1, max: 10000 }).toInt().withMessage('limit must be between 1 and 10000')
];

const userFilterValidators = [
	query('search').optional().isString().isLength({ max: 200 }).withMessage('search too long'),
	query('role').optional().isIn(['admin', 'volunteer']).withMessage('invalid role'),
	query('status').optional().isIn(['approved', 'pending', 'rejected']).withMessage('invalid status'),
	query('verified').optional().isIn(['true', 'false']).withMessage('invalid verified flag')
];

const idParamValidator = [
	param('id').isString().isLength({ min: 10, max: 64 }).withMessage('invalid id')
];

const bulkUserActionValidators = [
	body('action').exists().isIn(['approve', 'reject', 'role']).withMessage('action must be one of approve|reject|role'),
	body('userIds').isArray({ min: 1 }).withMessage('userIds must be a non-empty array'),
	body('userIds.*').isString().isLength({ min: 10, max: 64 }).withMessage('each user id must be a string id'),
	body('reason').optional().isString().isLength({ max: 500 }).withMessage('reason too long'),
	body('role').optional().isIn(['admin', 'volunteer']).withMessage('invalid role'),
	body('idempotencyKey').optional().isString().isLength({ max: 200 }).withMessage('idempotencyKey too long')
];

const bulkDeleteValidators = [
	body('userIds').optional().isArray({ min: 1 }).withMessage('userIds must be a non-empty array when provided'),
	body('userIds.*').optional().isString().isLength({ min: 10, max: 64 }).withMessage('each user id must be a string id')
];

module.exports = {
	validate,
	paginationValidators,
	userFilterValidators,
	idParamValidator,
	bulkUserActionValidators,
	bulkDeleteValidators
};

// Team validators
const teamCreateValidators = [
	body('name').isString().trim().isLength({ min: 1, max: 100 }).withMessage('name is required'),
	body('members').isArray({ min: 1 }).withMessage('members must be a non-empty array'),
	body('members.*').isString().isLength({ min: 10, max: 64 }).withMessage('each member id must be a valid id'),
	body('teamLeader').isString().isLength({ min: 10, max: 64 }).withMessage('teamLeader is required')
];

const addTeamMembersValidators = [
	param('id').isString().isLength({ min: 10, max: 64 }),
	body('memberIds').isArray({ min: 1 }).withMessage('memberIds must be a non-empty array'),
	body('memberIds.*').isString().isLength({ min: 10, max: 64 }).withMessage('each member id must be a valid id')
];

const removeTeamMemberValidators = [
	param('id').isString().isLength({ min: 10, max: 64 }),
	body('memberId').isString().isLength({ min: 10, max: 64 }).withMessage('memberId is required')
];

const changeTeamLeaderValidators = [
	param('id').isString().isLength({ min: 10, max: 64 }),
	body('leaderId').isString().isLength({ min: 10, max: 64 }).withMessage('leaderId is required')
];

module.exports.teamCreateValidators = teamCreateValidators;
module.exports.addTeamMembersValidators = addTeamMembersValidators;
module.exports.removeTeamMemberValidators = removeTeamMemberValidators;
module.exports.changeTeamLeaderValidators = changeTeamLeaderValidators;

