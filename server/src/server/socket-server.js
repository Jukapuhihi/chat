// socket-server.js

//Splice out the config for this server
let myConfig = {
    "id": "server-1",
    "ip": "127.0.0.1",
    "port": 3001
  };
console.log("myconfiggggggggggggggggggggg", myConfig);

// Bail if we didn't find our config
if (!myConfig){
    console.log(usage);
    process.exit();
}

// Messaging constants
const IM = 'im';
const IDENT = 'identify';
const CONNECT = 'connect';
const CONNECTION = 'connection';
const DISCONNECT = 'disconnect';
const UPDATE_CLIENT = 'update_client';

// Connection hashes
let users = {};
let usersByConnection = {};

// Listen for clients
let port = myConfig.port;
let socket = require('socket.io')(port);
socket.on(CONNECTION, onConnection);
console.log(`Listening for connections on port: ${port}`);

// Initiate connection to peers
// let io = require('socket.io-client');

// Handle connection from clients (users)
function onConnection(connection) {

    // Listen for message events
    connection.on(IM, onIm);
    connection.on(IDENT,onIdentify);
    connection.on(DISCONNECT, onDisconnect);

    // Handle an identification event from a user
    function onIdentify(userId) {

        // Store the connection for this user
        let user = users[userId];
        if (user){
            user.push(connection);
        } else {
            users[userId] = [connection];
        }
        usersByConnection[connection.id] = userId;

        // Log the new connection and update peers
        reportUserConnections(userId);

        // Send new user list to all the clients (including this one)
        updateClients();
    }

    // Handle an 'im' event from a client
    function onIm(message) {

        console.log(`Received ${message.forwarded?'forwarded ':''}IM from ${message.from} to ${message.to}: ${message.text}`);

        // Send to all recipient connections
        let recipientConnections = users[message.to];
        if (recipientConnections) { // User is connected to this server
            console.log(`Recipient ${message.to} has ${recipientConnections.length} connection${recipientConnections.length>1?'s':''} to this server, sending...`);
            recipientConnections.forEach(userConnection => userConnection.emit(IM, message));
        } else {
            console.log(`Recipient ${message.to} not connected to this server`);
        }

        // Update sender's other connections so all their clients have complete discussion history
        let senderConnections = users[message.from];
        if (senderConnections) { // User is connected to this server
            console.log(`Sender ${message.from} has ${senderConnections.length} connection${senderConnections.length>1?'s':''} to this server, sending...`);
            senderConnections.forEach(senderConnection => senderConnection.emit(IM, message));
        } else {
            console.log(`Sender ${message.from} not connected to this server`);
        }
    }

    // Handle disconnect from a client
    function onDisconnect() {
        // If it is a user, remove from users by connection list
        let userId = usersByConnection[connection.id];
        if (userId) {
            delete usersByConnection[connection.id];
            let userConnections = users[userId];
            if (userConnections) {
                // Remove connection from the user's collection
                console.log(`User ${userId} disconnected.`);
                userConnections.forEach( (userConnection, index) => {
                    if (userConnection.id === connection.id){
                        userConnections.splice(index, 1);
                    }
                });
                if (userConnections.length > 0) {
                    console.log(`User ${userId} still has ${userConnections.length} connections.`);
                } else {
                    delete users[userId];
                }
            }
            reportUserConnections(userId);
            updateClients();
        }

        // Remove listeners
        connection.removeListener(IM, onIm);
        connection.removeListener(IDENT, onIdentify);
        connection.removeListener(DISCONNECT, onDisconnect);
    }

    // Report user connections to console
    function reportUserConnections(user){
        // Report number of connections on console
        let count = users[user] ? users[user].length : 0;
        if (count) console.log(`User: ${user} connected ${count} time${(count>1)?'s':''}.`);
    }

}

// Update clients with user list
function updateClients(){
    console.log(`Updating clients with new user list...`);
    let message = {
        list: getSystemUserList()
    };
    Object.keys(users).forEach(user =>
        users[user].forEach(connection =>
            connection.emit(UPDATE_CLIENT, message)
        )
    );
}

function getSystemUserList(){
    let usersHash = Object.assign({}, users);
    let uniqueUsers = Object.keys(usersHash);
    uniqueUsers.sort();
    return uniqueUsers;
}