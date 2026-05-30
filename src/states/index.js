// In-memory states for managing user sessions and bot wizards/flows
const waitingForSignup = {};
const uploadStates = {};
const searchStates = {};
const broadcastStates = {};
const adminStates = {}; // Tracks administrative states (e.g. selected user IDs, active pagination)

module.exports = {
    waitingForSignup,
    uploadStates,
    searchStates,
    broadcastStates,
    adminStates
};

