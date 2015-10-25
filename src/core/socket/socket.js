angular.module('classeur.core.socket', [])
	.factory('clSocketSvc',
		function($rootScope, $location, clLocalStorage, clUserActivity, clIsNavigatorOnline) {
			var socketTokenKey = 'socketToken';
			var socket, msgHandlers = {};
			var socketToken;

			function setToken(token) {
				clLocalStorage[socketTokenKey] = token;
			}

			function clearToken() {
				clLocalStorage.removeItem(socketTokenKey);
				clSocketSvc.hasToken = false;
			}

			function checkToken() {
				socketToken = clLocalStorage[socketTokenKey];
				clSocketSvc.hasToken = !!socketToken;
				return clSocketSvc.hasToken;
			}

			var lastConnectionAttempt = 0;
			var nextConnectionAttempt = 1000;
			var maxNextConnectionAttempt = nextConnectionAttempt * Math.pow(2, 5); // Has to be a power of 2

			function attemptOpenSocket() {
				lastConnectionAttempt = Date.now();
				closeSocket();
				socket = new WebSocket(($location.protocol() === 'https' ? 'wss://' : 'ws://') + $location.host() + ':' + $location.port() + '/?token=' + socketToken);
				clSocketSvc.ctx = {
					socket: socket
				};
				socket.onopen = function() {
					nextConnectionAttempt = 1000;
				};
				socket.onmessage = function(event) {
					var msg = JSON.parse(event.data);
					(msgHandlers[msg.type] || []).cl_each(function(handler) {
						return handler(JSON.parse(event.data), clSocketSvc.ctx); // Give each handler a different msg object
					});
				};
				socket.onclose = function() {
					closeSocket();
				};
			}

			function shouldAttempt() {
				return (!socket || socket.readyState > 1) && checkToken() && clUserActivity.checkActivity() && clIsNavigatorOnline();
			}

			function openSocket() {
				if (shouldAttempt() && Date.now() > lastConnectionAttempt + nextConnectionAttempt) {
					attemptOpenSocket();
					if (nextConnectionAttempt < maxNextConnectionAttempt) {
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
				$rootScope.$evalAsync();
			}

			function isOnline() {
				if (checkToken()) {
					openSocket();
					return clSocketSvc.isReady;
				}
				closeSocket();
			}

			function sendMsg(msg) {
				clSocketSvc.isReady && socket.send(JSON.stringify(msg));
			}

			function addMsgHandler(type, handler) {
				var typeHandlers = msgHandlers[type] || [];
				typeHandlers.push(handler);
				msgHandlers[type] = typeHandlers;
			}

			function removeMsgHandler(type, handler) {
				var typeHandlers = msgHandlers[type];
				if (typeHandlers) {
					typeHandlers = typeHandlers.cl_filter(function(typeHandler) {
						return typeHandler !== handler;
					});
					msgHandlers[type] = typeHandlers;
				}
			}

			addMsgHandler('userToken', function(msg, ctx) {
				ctx.userId = msg.userId;
				setToken(msg.token);
				clSocketSvc.isReady = true;
				$rootScope.$evalAsync();
			});

			var clSocketSvc = {
				hasToken: false,
				setToken: setToken,
				clearToken: clearToken,
				openSocket: openSocket,
				closeSocket: closeSocket,
				isOnline: isOnline,
				sendMsg: sendMsg,
				addMsgHandler: addMsgHandler,
				removeMsgHandler: removeMsgHandler,
			};

			openSocket();
			return clSocketSvc;
		});
