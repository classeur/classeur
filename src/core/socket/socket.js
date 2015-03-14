angular.module('classeur.core.socket', [])
	.factory('clSocketSvc', function($window, $location) {
		var socketTokenKey = 'socketToken';
		var socket, msgHandlers = {};
		var socketToken;

		function setToken(token) {
			localStorage[socketTokenKey] = token;
		}

		function clearToken() {
			localStorage.removeItem(socketTokenKey);
			clSocketSvc.hasToken = false;
		}

		function checkToken() {
			socketToken = localStorage[socketTokenKey];
			clSocketSvc.hasToken = !!socketToken;
			return clSocketSvc.hasToken;
		}

		var lastConnectionAttempt = 0;
		var nextConnectionAttempt = 1000;

		function attemptOpenSocket() {
			lastConnectionAttempt = Date.now();
			closeSocket();
			socket = new WebSocket('ws://' + $location.host() + ':' + $location.port() + '/?token=' + socketToken);
			clSocketSvc.ctx = {
				socket: socket
			};
			socket.onopen = function() {
				nextConnectionAttempt = 1000;
			};
			socket.onmessage = function(event) {
				var msg = JSON.parse(event.data);
				(msgHandlers[msg.type] || []).forEach(function(handler) {
					return handler(msg, clSocketSvc.ctx);
				});
			};
			socket.onclose = function() {
				clSocketSvc.isReady = false;
				clSocketSvc.ctx = undefined;
			};
		}

		function isPendingAttempt() {
			return (!socket || socket.readyState > 1) && checkToken() && $window.navigator.onLine !== false;
		}

		function openSocket() {
			if (isPendingAttempt() && Date.now() > lastConnectionAttempt + nextConnectionAttempt) {
				attemptOpenSocket();
				if (nextConnectionAttempt < 30000) {
					// Exponential backoff
					nextConnectionAttempt *= 2;
				}
			}
		}

		function closeSocket() {
			if (socket) {
				socket.onopen = undefined;
				socket.onmessage = undefined;
				socket.onclose = undefined;
				socket.close();
				socket = undefined;
			}
			clSocketSvc.isReady = false;
			clSocketSvc.ctx = undefined;
		}

		function sendMsg(msg) {
			clSocketSvc.isReady && socket.send(JSON.stringify(msg));
		}

		function addMsgHandler(type, handler) {
			var typeHandlers = msgHandlers[type] || [];
			typeHandlers.push(handler);
			msgHandlers[type] = typeHandlers;
		}

		addMsgHandler('signedInUser', function(msg) {
			msg.token && setToken(msg.token);
			clSocketSvc.isReady = true;
		});

		var clSocketSvc = {
			hasToken: false,
			setToken: setToken,
			clearToken: clearToken,
			checkToken: checkToken,
			openSocket: openSocket,
			closeSocket: closeSocket,
			sendMsg: sendMsg,
			addMsgHandler: addMsgHandler
		};

		openSocket();
		return clSocketSvc;
	});
