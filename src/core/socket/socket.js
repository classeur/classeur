angular.module('classeur.core.socket', [])
	.factory('clSocketSvc',
		function($window, $rootScope, $location, clConfig, clLocalStorage, clUserActivity, clIsNavigatorOnline) {
			var socketTokenKey = 'socketToken',
				msgHandlers = {},
				socketToken

			var clSocketSvc = {
				hasToken: false,
				setToken: setToken,
				makeAuthorizationHeader: makeAuthorizationHeader,
				clearToken: clearToken,
				openSocket: openSocket,
				closeSocket: closeSocket,
				isOnline: isOnline,
				sendMsg: sendMsg,
				addMsgHandler: addMsgHandler,
				removeMsgHandler: removeMsgHandler,
			}

			function setToken(token) {
				clLocalStorage[socketTokenKey] = token
			}

			function clearToken() {
				clLocalStorage.removeItem(socketTokenKey)
				clSocketSvc.hasToken = false
			}

			function checkToken() {
				socketToken = clLocalStorage[socketTokenKey]
				clSocketSvc.hasToken = !!socketToken
				return clSocketSvc.hasToken
			}

			var lastConnectionAttempt = 0,
				nextConnectionAttempt = 1000,
				maxNextConnectionAttempt = nextConnectionAttempt * Math.pow(2, 5) // Has to be a power of 2

			function attemptOpenSocket() {
				lastConnectionAttempt = Date.now()
				closeSocket()
				;(function() {
					var ctx = {
						socket: $window.eio()
					}
					clSocketSvc.ctx = ctx
					ctx.socket.on('message', function(msg) {
						var type = JSON.parse(msg)[0]
						var handlers = msgHandlers[type] || []
						handlers.cl_each(function(handler) {
							clSocketSvc.ctx === ctx && handler(JSON.parse(msg)[1], ctx)
						})
					})
					ctx.socket.on('open', function() {
						nextConnectionAttempt = 1000
						ctx.socket.send(JSON.stringify(['authenticate', {token: socketToken}]))
					})
					ctx.socket.on('error', closeSocket)
					ctx.socket.on('close', closeSocket)
				})()
			}

			function shouldAttempt() {
				return !clSocketSvc.ctx && checkToken() && clUserActivity.checkActivity() && clIsNavigatorOnline()
			}

			function openSocket() {
				if (shouldAttempt() && Date.now() > lastConnectionAttempt + nextConnectionAttempt) {
					attemptOpenSocket()
					if (nextConnectionAttempt < maxNextConnectionAttempt) {
						// Exponential backoff
						nextConnectionAttempt *= 2
					}
				}
			}

			function closeSocket() {
				if (clSocketSvc.ctx) {
					clSocketSvc.ctx.socket.close()
					clSocketSvc.ctx = undefined
					if (clSocketSvc.isReady) {
						clSocketSvc.isReady = false
						$rootScope.$evalAsync()
					}
				}
			}

			function isOnline() {
				if (checkToken()) {
					openSocket()
					return clSocketSvc.isReady
				}
				closeSocket()
			}

			function sendMsg(type, msg) {
				clSocketSvc.isReady && clSocketSvc.ctx.socket.send(JSON.stringify([type, msg]))
			}

			function addMsgHandler(type, handler) {
				var typeHandlers = msgHandlers[type] || []
				typeHandlers.push(handler)
				msgHandlers[type] = typeHandlers
			}

			function removeMsgHandler(type, handler) {
				var typeHandlers = msgHandlers[type]
				if (typeHandlers) {
					typeHandlers = typeHandlers.cl_filter(function(typeHandler) {
						return typeHandler !== handler
					})
					msgHandlers[type] = typeHandlers
				}
			}

			addMsgHandler('userToken', function(msg, ctx) {
				ctx.userId = msg.userId
				setToken(msg.token)
				clSocketSvc.isReady = true
				$rootScope.$evalAsync()
			})

			function makeAuthorizationHeader() {
				var headers = {}
				var sysKey = $location.search().sysKey
				var token = clLocalStorage[socketTokenKey]
				if (sysKey) {
					headers.Authorization = 'SysKey ' + sysKey
				} else if (token) {
					headers.Authorization = 'UserToken ' + token
				}
				if (!headers.Authorization && clConfig.restrictPublic) {
					if (clConfig.loginForm) {
						$location.url('/signin')
					} else {
						$rootScope.userSvc.startOAuth()
					}
					throw new Error('Restricted access') // Skip the execution
				}
				return headers
			}

			openSocket()
			return clSocketSvc
		})
