angular.module('classeur.core.socket', [])

  .factory('clSocketSvc',
    function ($window, $rootScope, $location, clConfig, clLocalStorage, clSetInterval, clUserActivity, clIsNavigatorOnline, clDebug) {
      var debug = clDebug('classeur:clSocketSvc')
      var socketTimeout = clUserActivity.inactiveAfter + 60 * 1000 // 2 + 1 min
      var socketTokenKey = 'socketToken'
      var msgHandlers = {}
      var socketToken

      var clSocketSvc = {
        hasToken: false,
        setToken: setToken,
        clearToken: clearToken,
        toggleSocket: toggleSocket,
        makeAuthorizationHeader: makeAuthorizationHeader,
        sendMsg: sendMsg,
        addMsgHandler: addMsgHandler,
        removeMsgHandler: removeMsgHandler
      }

      function setToken (token) {
        clLocalStorage.setItem(socketTokenKey, token)
        toggleSocket()
      }

      function clearToken () {
        clLocalStorage.removeItem(socketTokenKey)
        toggleSocket()
      }

      function toggleSocket () {
        socketToken = clLocalStorage.getItem(socketTokenKey)
        var hasToken = !!socketToken
        if (clSocketSvc.hasToken !== hasToken) {
          clSocketSvc.hasToken = hasToken
          $rootScope.$evalAsync()
        }
        hasToken
          ? openSocket()
          : closeSocket()
        return hasToken
      }

      var lastConnectionAttempt = 0
      var nextConnectionAttempt = 1000
      var maxNextConnectionAttempt = nextConnectionAttempt * Math.pow(2, 5) // Has to be a power of 2

      function attemptOpenSocket () {
        lastConnectionAttempt = Date.now()
        closeSocket()
        ;(function () {
          var hash = Math.random().toString(36).slice(2, 10) // https://gist.github.com/benweet/a74c87dc2ef0add10e7aeb83f986f013
          var ctx = {
            socket: $window.eio('/engine.io/?hash=' + hash, {
              // transports: ['polling', 'websocket']
            }),
            extendSocketLifetime: $window.cledit.Utils.debounce(function () {
              if (clSocketSvc.ctx === ctx) {
                closeSocket()
              }
            }, socketTimeout)
          }
          ctx.extendSocketLifetime()
          clSocketSvc.ctx = ctx
          ctx.socket.on('message', function (msg) {
            var type = JSON.parse(msg)[0]
            var handlers = msgHandlers[type] || []
            handlers.cl_each(function (handler) {
              clSocketSvc.ctx === ctx && handler(JSON.parse(msg)[1], ctx)
            })
          })
          ctx.socket.on('open', function () {
            debug('Socket is open')
            nextConnectionAttempt = 1000
            ctx.socket.send(JSON.stringify(['authenticate', {token: socketToken, protocolVersion: 2}]))
          })
          ctx.socket.on('error', closeSocket)
          ctx.socket.on('close', closeSocket)
        })()
      }

      function shouldAttempt () {
        if (!clUserActivity.checkActivity()) {
          // User is not active
          return
        }
        if (clSocketSvc.ctx) {
          // Socket is already open, extend its lifetime if user is active
          clSocketSvc.ctx.extendSocketLifetime()
          return
        }
        // Attempt if token is present and navigator is online
        return clSocketSvc.hasToken && clIsNavigatorOnline()
      }

      function openSocket () {
        if (shouldAttempt() && Date.now() - lastConnectionAttempt > nextConnectionAttempt) {
          attemptOpenSocket()
          if (nextConnectionAttempt < maxNextConnectionAttempt) {
            // Exponential backoff
            nextConnectionAttempt *= 2
          }
        }
      }

      function closeSocket () {
        if (clSocketSvc.ctx) {
          debug('Socket was closed')
          try {
            clSocketSvc.ctx.socket.close()
          } catch (e) {}
          clSocketSvc.ctx = undefined
          if (clSocketSvc.isReady) {
            clSocketSvc.isReady = false
            $rootScope.$evalAsync()
          }
        }
      }

      function sendMsg (type, msg) {
        if (clSocketSvc.isReady) {
          clSocketSvc.ctx.socket.send(JSON.stringify([type, msg]))
          clSocketSvc.ctx.extendSocketLifetime()
        }
      }

      function addMsgHandler (type, handler) {
        var typeHandlers = msgHandlers[type] || []
        typeHandlers.push(handler)
        msgHandlers[type] = typeHandlers
      }

      function removeMsgHandler (type, handler) {
        var typeHandlers = msgHandlers[type]
        if (typeHandlers) {
          typeHandlers = typeHandlers.cl_filter(function (typeHandler) {
            return typeHandler !== handler
          })
          msgHandlers[type] = typeHandlers
        }
      }

      addMsgHandler('userToken', function (msg, ctx) {
        ctx.userId = msg.userId
        setToken(msg.token)
        clSocketSvc.isReady = true
        $rootScope.$evalAsync()
      })

      function makeAuthorizationHeader () {
        var headers = {}
        var searchParams = $location.search()
        var sysKey = searchParams.syskey || searchParams.sysKey
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

      toggleSocket()
      return clSocketSvc
    })

  .factory('clRestSvc',
    function ($window, clSocketSvc) {
      function parseHeaders (xhr) {
        var pairs = xhr.getAllResponseHeaders().trim().split('\n')
        return pairs.cl_reduce(function (headers, header) {
          var split = header.trim().split(':')
          var key = split.shift().trim().toLowerCase()
          var value = split.join(':').trim()
          headers[key] = value
          return headers
        }, {})
      }

      function request (config) {
        // Assume user is active, so keep socket alive
        clSocketSvc.ctx && clSocketSvc.ctx.extendSocketLifetime()

        var retryAfter = 500 // 500 ms
        var maxRetryAfter = 30 * 1000 // 30 sec
        config = angular.extend({}, config || {})
        config.headers = angular.extend({}, config.headers || {}, {
          'content-type': 'application/json'
        }, clSocketSvc.makeAuthorizationHeader())

        return (function tryRequest () {
          // Reimplement http layer to avoid unnecessary angular scope.$apply
          return new Promise(function (resolve, reject) {
            var xhr = new $window.XMLHttpRequest()

            xhr.onload = function () {
              clearTimeout(timeout)
              var result = {
                status: xhr.status,
                headers: parseHeaders(xhr),
                body: xhr.responseText
              }
              try {
                result.body = JSON.parse(result.body)
              } catch (e) {}
              if (result.status >= 200 && result.status < 300) {
                return resolve(result)
              }
              // Reason field is a snake_case message, make it pretty
              var message = ((result.body.reason || 'unknown_network_error') + '.').replace(/_/g, ' ')
              result.message = message[0].toUpperCase() + message.slice(1)
              reject(result)
            }

            xhr.onerror = function () {
              clearTimeout(timeout)
              reject(new Error('Network request failed.'))
            }

            var timeout = setTimeout(function () {
              xhr.abort()
              reject(new Error('Network request timeout.'))
            }, clRestSvc.timeout)

            // Add query params to URL
            var url = config.url || ''
            if (config.params) {
              var params = config.params
                .cl_map(function (value, key) {
                  return encodeURIComponent(key) + '=' + encodeURIComponent(value)
                })
              if (params.length) {
                url += '?' + params.join('&')
              }
            }

            xhr.open(config.method, url)
            config.headers.cl_each(function (value, name) {
              xhr.setRequestHeader(name, value)
            })
            xhr.send(config.body ? JSON.stringify(config.body) : null)
          })
            .catch(function (err) {
              // Try again later in case of error 503
              if (err.status === 503 && retryAfter < maxRetryAfter) {
                return new Promise(function (resolve) {
                  setTimeout(resolve, retryAfter)
                  // Exponential backoff
                  retryAfter *= 2
                })
                  .then(tryRequest)
              }
              throw err
            })
        })()
      }

      // Save bandwidth when ETag was received through websocket
      function requestIgnore304 (config, updated) {
        var etag = 'W/"' + updated + '"'
        config.headers = angular.extend({}, config.headers || {}, {
          'If-None-Match': etag
        })
        return request(config)
          .catch(function (err) {
            if (err.status !== 304) {
              throw err
            }
          })
      }

      function list (url, params, rangeStart, rangeEnd, result) {
        result = result || []
        rangeStart = rangeStart > 0 ? rangeStart : 0
        rangeEnd = rangeEnd >= 0 ? rangeEnd : 999999999
        var config = {
          method: 'GET',
          url: url,
          params: params,
          headers: {
            range: 'items=' + rangeStart + '-' + rangeEnd
          }
        }

        return request(config)
          .then(function (res) {
            if (!res.body.length) {
              return result
            }
            var parsedRange = res.headers['content-range'].match(/^items (\d+)-(\d+)\/(\d+)$/)
            result = result.concat(res.body)
            var last = parseInt(parsedRange[2], 10)
            var count = parseInt(parsedRange[3], 10)
            if (res.body.length > rangeEnd - rangeStart || last + 1 === count) {
              return result
            }
            return list(url, params, last + 1, rangeEnd, result)
          })
      }

      function listFromSeq (url, minSeq, params, result) {
        result = result || []
        var config = {
          method: 'GET',
          url: url,
          params: angular.extend({}, params || {}, {
            minSeq: minSeq,
            view: 'private'
          }),
          headers: {
            range: 'items=0-999999999'
          }
        }

        return request(config)
          .then(function (res) {
            if (!res.body.length) {
              return result
            }
            var parsedRange = res.headers['content-range'].match(/^items (\d+)-(\d+)\/(\d+)$/)
            result = result.concat(res.body)
            var count = parseInt(parsedRange[3], 10)
            if (res.body.length === count) {
              return result
            }
            // Make sure we don't miss any item with the same `seq`
            var lastItem = result.pop()
            while (result.length && result[result.length - 1].seq === lastItem.seq) {
              result.pop()
            }
            if (!result.length) {
              return result
            }
            return listFromSeq(url, result[result.length - 1].seq + 1, params, result)
          })
      }

      var clRestSvc = {
        timeout: 30 * 1000, // 30 sec
        request: request,
        requestIgnore304: requestIgnore304,
        list: list,
        listFromSeq: listFromSeq
      }

      return clRestSvc
    })
