const roleCheck = (requiredRole) => {
  return function (req, res, next) {
    if (req.user && req.user.role === requiredRole) {
      return next();
    } else {
      return res.status(403).json({ message: 'Forbidden: Insufficient role' });
    }
  };
};

module.exports = roleCheck;
