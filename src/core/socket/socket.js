angular.module('classeur.core.socket', [])
	.factory('clSocketSvc', function($window, $location) {
		var socketTokenKey = 'socketToken';
		var socketToken = localStorage[socketTokenKey];
		var socket, msgHandlers = {};

		function setToken(token) {
			socketToken = token;
			localStorage[socketTokenKey] = token;
		}

		function clearToken() {
			localStorage.removeItem(socketTokenKey);
			socketToken = undefined;
		}

		var lastConnectionAttempt;
		var nextConnectionAttempt = 1000;
		function attemptOpenSocket() {
			lastConnectionAttempt = Date.now();
			closeSocket();
			socket = new WebSocket('ws://' + $location.host() + ':' + $location.port() + '/?token=' + socketToken);
			socket.onopen = function() {
				nextConnectionAttempt = 1000;
			};
			socket.onmessage = function(event) {
				var msg = JSON.parse(event.data);
				console.log(msg);
				(msgHandlers[msg.type] || []).forEach(function(handler) {
					return handler(msg, socket);
				});
			};
			socket.onclose = function() {
				clSocketSvc.isReady = false;
			};
		}

		function isSocketToBeOpened() {
			return (!socket || socket.readyState > 1) && socketToken && $window.navigator.onLine !== false;
		}

		function openSocket() {
			isSocketToBeOpened() && attemptOpenSocket();
		}

		function closeSocket() {
			if(socket) {
				socket.onopen = undefined;
				socket.onmessage = undefined;
				socket.onclose = undefined;
				socket.close();
				socket = undefined;
			}
			clSocketSvc.isReady = false;
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
		
		setInterval(function() {
			if(!isSocketToBeOpened()) {
				nextConnectionAttempt = 1000;
				return;
			}
			if(Date.now() > lastConnectionAttempt + nextConnectionAttempt) {
				attemptOpenSocket();
				if(nextConnectionAttempt < 30000) {
					// Exponential backoff
					nextConnectionAttempt *= 2;
				}
			}
		}, 1000);

		var clSocketSvc = {
			setToken: setToken,
			clearToken: clearToken,
			openSocket: openSocket,
			closeSocket: closeSocket,
			sendMsg: sendMsg,
			addMsgHandler: addMsgHandler
		};

		openSocket();
		return clSocketSvc;
	});