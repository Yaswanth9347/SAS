// DEPRECATED: Role-based authorization has been removed
// This middleware is kept for backward compatibility but does not restrict access
const roleCheck = (requiredRole) => {
  return function (req, res, next) {
    // Role authorization removed - all authenticated users can access
    return next();
  };
};

module.exports = roleCheck;
